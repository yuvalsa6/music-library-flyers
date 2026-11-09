/* Offline support: app files are cached so the app opens without network.
   Audio files themselves are stored by the app in IndexedDB. */
const CACHE = 'audio-lib-v10';
const SHELL = ['./', 'index.html', 'cloud.js', 'config.js', 'manifest.webmanifest',
  'vendor/firebase-app-compat.js', 'vendor/firebase-auth-compat.js', 'vendor/firebase-firestore-compat.js',
  'vendor/firebase-storage-compat.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const CDN = ['https://cdn.jsdelivr.net/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const local = url.origin === self.location.origin;
  if (!local && !CDN.some((p) => req.url.startsWith(p))) return; // Firebase etc. go straight to network
  if (req.headers.has('range')) return;
  if (local) {
    // network first, so updates arrive; cache as offline fallback
    // cache:'no-cache' asks the server every time (a cheap check when nothing changed),
    // so a new version is never held back by the browser's HTTP cache
    e.respondWith(fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
  } else {
    // versioned CDN files: cache first
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return res;
    })));
  }
});
