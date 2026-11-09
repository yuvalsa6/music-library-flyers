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
 */
(function () {
  const cfg = window.FIREBASE_CONFIG;
  const enabled = !!(cfg && cfg.apiKey && cfg.projectId && window.firebase);
  window.HAS_DRIVE = false;

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

  /* Fast parallel write of one audio chunk through the Firestore REST API.
     The SDK sends writes one after another on a single stream; parallel HTTP
     requests upload a song about 3.5x faster. Result is the same document. */
  window.fastSet = async (path, data) => {
    if (!(await ready())) throw new Error('offline');
    const emu = window.FIREBASE_EMULATOR;
    const root = emu ? 'http://' + emu.host + ':8080' : 'https://firestore.googleapis.com';
    const url = root + '/v1/projects/' + cfg.projectId + '/databases/(default)/documents/' + path;
    const tok = emu ? 'owner' : await firebase.auth().currentUser.getIdToken();
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { d: { stringValue: data } } }),
    });
    if (!r.ok) throw new Error('upload ' + r.status);
  };

  window.claude = {
    async use(name) {
      if (!(await ready())) return null;
      if (name === 'db') return firebase.firestore();
      if (name === 'assets') return window.CLOUD_USE_STORAGE ? assets() : null;
      return null;
    },
  };
})();
