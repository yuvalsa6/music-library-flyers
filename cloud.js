/*
 * Cloud adapter.
 * The app was first built as a Claude artifact and talks to the cloud through
 * window.claude.use('db' | 'assets' | 'mcp' | 'user' | 'room').
 * This file provides the same interface on top of Firebase, so the app code
 * stays almost unchanged:
 *   db     -> Cloud Firestore (same doc/collection/get/set/onSnapshot API)
 *   assets -> Firebase Storage (optional, CLOUD_USE_STORAGE in config.js)
 *   mcp / user / room -> not available (the app falls back on its own)
 * Without a Firebase config the app runs in local mode (files stay on the device).
 *
 * Access code: every library lives under libs/<CODE>/..., and the Firestore rules
 * refuse listing the libs collection. So only someone who knows the code can
 * reach the data. The code is typed once per device (or opened from a link
 * ending in #code=XXXX) and kept in localStorage. It is never stored in the repo.
 */
(function () {
  const cfg = window.FIREBASE_CONFIG;
  const enabled = !!(cfg && cfg.apiKey && cfg.projectId && window.firebase);
  window.HAS_DRIVE = false;

  /* ===== access code ===== */
  const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');
  const MIN = 12; // characters, without dashes
  const valid = (c) => c.replace(/-/g, '').length >= MIN;
  let code = '';
  try {
    const m = location.hash.match(/code=([A-Za-z0-9-]+)/);
    if (m && valid(norm(m[1]))) {
      localStorage.setItem('libcode', norm(m[1]));
      history.replaceState(null, '', location.pathname + location.search);
    }
    code = localStorage.getItem('libcode') || '';
  } catch (e) {}
  const prefix = () => 'libs/' + code + '/';
  window.libCode = () => code;

  let readyPr = null;
  function ready() {
    if (!enabled) return Promise.resolve(false);
    if (readyPr) return readyPr;
    readyPr = (async () => {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      const auth = firebase.auth();
      const emu = window.FIREBASE_EMULATOR; // local testing only, e.g. { host: 'localhost' }
      if (emu) {
        auth.useEmulator('http://' + emu.host + ':9099');
        firebase.firestore().useEmulator(emu.host, 8080);
      }
      if (!auth.currentUser) {
        await new Promise((res) => {
          const off = auth.onAuthStateChanged((u) => { if (u) { off(); res(); } });
          auth.signInAnonymously().catch((e) => { console.error('Firebase sign-in failed', e); off(); res(); });
        });
      }
      return !!auth.currentUser;
    })();
    return readyPr;
  }

  function assets() {
    const st = firebase.storage();
    return {
      async upload(blob) {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        const ref = st.ref('audio/' + id);
        await ref.put(blob, { contentType: blob.type || 'audio/mpeg' });
        return { id: await ref.getDownloadURL() };
      },
      async delete(url) {
        if (/^https?:/.test(url)) await st.refFromURL(url).delete();
      },
    };
  }

  window.assetUrl = (a) => a;

  /* data: base64 string of the chunk.
     Fast parallel write of one audio chunk through the Firestore REST API.
     The SDK sends writes one after another on a single stream; parallel HTTP
     requests upload a song about 3.5x faster. Result is the same document. */
  window.fastSet = async (path, data) => {
    if (!(await ready())) throw new Error('offline');
    const emu = window.FIREBASE_EMULATOR;
    const root = emu ? 'http://' + emu.host + ':8080' : 'https://firestore.googleapis.com';
    const url = root + '/v1/projects/' + cfg.projectId + '/databases/(default)/documents/' + prefix() + path;
    const tok = emu ? 'owner' : await firebase.auth().currentUser.getIdToken();
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { d: { bytesValue: data } } }), // stored as raw bytes (no base64 overhead)
    });
    if (!r.ok) throw new Error('upload ' + r.status);
  };

  function codeDialog(canCancel) {
    if (document.getElementById('lcx')) return;
    const css = document.createElement('style');
    css.textContent = '#lcx{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '#lcx .c{background:var(--surface,#fff);color:var(--ink,#000);border-radius:22px;padding:20px;width:100%;max-width:380px;box-shadow:0 8px 30px rgba(0,0,0,.25);direction:rtl}' +
      '#lcx h2{margin:0 0 6px;font-size:20px}#lcx p{margin:0 0 12px;color:var(--muted,#888);font-size:14px}' +
      '#lcx input{width:100%;box-sizing:border-box;font:inherit;font-size:20px;letter-spacing:2px;text-align:center;direction:ltr;border:1px solid var(--line,#ddd);background:var(--bg,#fff);color:inherit;border-radius:12px;padding:12px;margin-bottom:10px}' +
      '#lcx .e{color:var(--danger,#d33);font-size:14px;min-height:20px;margin-bottom:6px}' +
      '#lcx button{display:block;width:100%;margin-top:8px;border:0;border-radius:12px;min-height:46px;font:inherit;font-weight:600;cursor:pointer}' +
      '#lcx .ok{background:var(--accent,#fa243c);color:#fff}#lcx .no{background:var(--soft,#eee);color:var(--ink,#000)}';
    const w = document.createElement('div');
    w.id = 'lcx';
    w.innerHTML = '<div class="c"><h2>🔑 קוד ספרייה</h2><p>כדי לראות את השירים ולסנכרן בין מכשירים, הקלד את קוד הספרייה. מקבלים אותו ממי שמנהל את הספרייה.</p>' +
      '<input autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX"><div class="e"></div>' +
      '<button class="ok">המשך</button><button class="no">' + (canCancel ? 'ביטול' : 'המשך בלי ענן (רק במכשיר הזה)') + '</button></div>';
    document.body.appendChild(css);
    document.body.appendChild(w);
    const inp = w.querySelector('input'), err = w.querySelector('.e'), ok = w.querySelector('.ok');
    let confirmNew = '';
    inp.value = canCancel ? code : '';
    inp.oninput = () => { const v = norm(inp.value); if (v !== inp.value) inp.value = v; err.textContent = ''; confirmNew = ''; ok.textContent = 'המשך'; };
    w.querySelector('.no').onclick = () => { w.remove(); css.remove(); };
    const go = async () => {
      const c = norm(inp.value);
      if (!valid(c)) { err.textContent = 'הקוד קצר מדי'; return; }
      ok.disabled = true; ok.textContent = 'בודק…';
      try {
        if (!(await ready())) throw new Error('אין חיבור לענן');
        const st = await firebase.firestore().doc('libs/' + c + '/state/main').get();
        if (!st.exists && confirmNew !== c) {
          confirmNew = c;
          err.textContent = 'לא נמצאה ספרייה עם הקוד הזה. בדוק שהקלדת נכון. כדי ליצור ספרייה חדשה עם הקוד הזה, לחץ שוב.';
          ok.disabled = false; ok.textContent = 'צור ספרייה חדשה';
          return;
        }
        if (!st.exists) await firebase.firestore().doc('libs/' + c + '/state/main').set({ created: Date.now() }, { merge: true });
        localStorage.setItem('libcode', c);
        location.reload();
      } catch (e) {
        err.textContent = 'הבדיקה נכשלה: ' + ((e && e.message) || e);
        ok.disabled = false; ok.textContent = 'המשך';
      }
    };
    ok.onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    setTimeout(() => inp.focus(), 50);
  }
  window.libCodeDialog = () => enabled && codeDialog(!!code);

  window.claude = {
    async use(name) {
      if (!enabled) return null;
      if (!valid(code)) {
        if (name === 'db') {
          if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => codeDialog(false));
          else codeDialog(false);
        }
        return null;
      }
      if (!(await ready())) return null;
      if (name === 'db') {
        const fs = firebase.firestore();
        return { doc: (p) => fs.doc(prefix() + p), collection: (p) => fs.collection(prefix() + p) };
      }
      if (name === 'assets') return window.CLOUD_USE_STORAGE ? assets() : null;
      return null;
    },
  };
})();
