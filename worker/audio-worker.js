/*
 * Audio storage gatekeeper for the training audio library.
 * Runs as a Cloudflare Worker (free plan) in front of a Backblaze B2 bucket.
 *
 * Why: the app's code is public, so the B2 keys can't live in it. The keys stay
 * here, as Worker secrets. The app sends the library access code with every
 * request, and the Worker only answers when that code is one of LIB_CODES.
 *
 * Settings (Cloudflare dashboard → the Worker → Settings → Variables and Secrets):
 *   B2_ENDPOINT  e.g. s3.us-west-004.backblazeb2.com  (bucket page → "Endpoint")
 *   B2_BUCKET    the bucket name
 *   B2_KEY_ID    application key ID          (type: Secret)
 *   B2_APP_KEY   application key             (type: Secret)
 *   LIB_CODES    the library code(s), comma separated, e.g. ABCD-EFGH-IJKL-MNOP  (type: Secret)
 *
 * API (every request needs the library code: header X-Lib-Code, or ?k=<code> for audio players):
 *   GET    /ping      → {"ok":true}          check that the settings work
 *   PUT    /a/<id>    body = audio file      → {"ok":true,"size":<bytes>}
 *   GET    /a/<id>                           → the audio file
 *   DELETE /a/<id>                           → {"ok":true}
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Lib-Code, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const MAX_BYTES = 95 * 1024 * 1024; // Workers free plan accepts request bodies up to 100MB

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hmac(key, s) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(s));
}
const uriEnc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/* AWS Signature V4 (B2 speaks the S3 protocol). headers: lower-case names. */
export async function signV4({ method, host, path, region, accessKey, secretKey, headers, amzDate }) {
  const date = amzDate.slice(0, 8);
  const h = { host, ...headers, 'x-amz-date': amzDate };
  const names = Object.keys(h).map((n) => n.toLowerCase()).sort();
  const canonHeaders = names.map((n) => n + ':' + String(h[n]).trim() + '\n').join('');
  const signed = names.join(';');
  const canonPath = path.split('/').map(uriEnc).join('/');
  const canonical = [method, canonPath, '', canonHeaders, signed, h['x-amz-content-sha256']].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n');
  let k = await hmac('AWS4' + secretKey, date);
  k = await hmac(k, region);
  k = await hmac(k, 's3');
  k = await hmac(k, 'aws4_request');
  const sig = hex(await hmac(k, toSign));
  return { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed}, Signature=${sig}` };
}

async function b2(env, method, key, extra = {}, body) {
  const host = String(env.B2_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const region = (host.match(/^s3\.([^.]+)\./) || [])[1] || 'us-east-1';
  const path = '/' + env.B2_BUCKET + '/' + key;
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const headers = await signV4({
    method, host, path, region, amzDate,
    accessKey: env.B2_KEY_ID, secretKey: env.B2_APP_KEY,
    headers: { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', ...extra },
  });
  delete headers.host;
  return fetch('https://' + host + path.split('/').map(uriEnc).join('/'), { method, headers, body });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const missing = ['B2_ENDPOINT', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY', 'LIB_CODES'].filter((k) => !env[k]);
    if (missing.length) return json({ ok: false, error: 'missing settings: ' + missing.join(', ') }, 500);

    const codes = String(env.LIB_CODES).split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
    const code = String(req.headers.get('X-Lib-Code') || url.searchParams.get('k') || '').trim().toUpperCase();
    if (code.replace(/-/g, '').length < 12 || !codes.includes(code)) return json({ ok: false, error: 'wrong library code' }, 403);
    const lib = (await sha256('lib:' + code)).slice(0, 20); // folder per library, without the code itself

    if (url.pathname === '/ping') {
      const r = await b2(env, 'HEAD', lib + '/.ping');
      // 404 = settings work, file just doesn't exist. 403 = wrong key or bucket.
      if (r.status === 404 || r.ok) return json({ ok: true });
      return json({ ok: false, error: 'B2 answered ' + r.status }, 502);
    }

    const m = url.pathname.match(/^\/a\/([A-Za-z0-9]{6,40})$/);
    if (!m) return json({ ok: false, error: 'not found' }, 404);
    const key = lib + '/' + m[1];

    if (req.method === 'PUT') {
      const len = +req.headers.get('Content-Length') || 0;
      if (len > MAX_BYTES) return json({ ok: false, error: 'file too large' }, 413);
      const buf = await req.arrayBuffer();
      if (!buf.byteLength) return json({ ok: false, error: 'empty file' }, 400);
      if (buf.byteLength > MAX_BYTES) return json({ ok: false, error: 'file too large' }, 413);
      const r = await b2(env, 'PUT', key, { 'content-type': req.headers.get('Content-Type') || 'application/octet-stream', 'content-length': String(buf.byteLength) }, buf);
      if (!r.ok) return json({ ok: false, error: 'B2 upload failed ' + r.status, detail: (await r.text()).slice(0, 300) }, 502);
      return json({ ok: true, size: buf.byteLength });
    }

    if (req.method === 'GET') {
      const range = req.headers.get('Range');
      const r = await b2(env, 'GET', key, range ? { range } : {});
      if (!r.ok && r.status !== 206) return json({ ok: false, error: 'B2 download failed ' + r.status }, r.status === 404 ? 404 : 502);
      const h = new Headers(CORS);
      ['content-type', 'content-length', 'content-range', 'etag', 'last-modified'].forEach((n) => { const v = r.headers.get(n); if (v) h.set(n, v); });
      h.set('Cache-Control', 'private, max-age=31536000, immutable');
      return new Response(r.body, { status: r.status, headers: h });
    }

    if (req.method === 'DELETE') {
      const r = await b2(env, 'DELETE', key);
      if (!r.ok && r.status !== 404) return json({ ok: false, error: 'B2 delete failed ' + r.status }, 502);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'method not allowed' }, 405);
  },
};
