# Project notes for Claude

## What this is
"ספריית שמע לאימונים": a Hebrew (RTL) PWA audio library for acrobatic gymnastics coaches
(training music, practice queue, A-B loop, speed, count-in, run log, remote control between devices).
It started as a Claude artifact and was converted to a standalone app.
The owner talks in Hebrew and is not a developer: explain in plain Hebrew, give step-by-step
instructions for GitHub/Firebase screens, and show previews before shipping visual changes.

## Files
- `index.html`: the whole app (HTML/CSS/JS, ~2000 lines, many layered style blocks).
  Later layers override earlier ones; the last `<style id="ui2">` block and the `ui2` script
  near the end are the current design layer (app bar, settings sheet, player sections, icons).
- `cloud.js`: Firebase adapter exposing the old artifact API `window.claude.use('db'|'assets')`.
  Data lives under `libs/<ACCESS CODE>/<collection>/<doc>`; the code is entered once per device
  (or via `#code=XXXX-XXXX-XXXX` link) and kept in localStorage. Also `fastSet` (parallel REST
  writes for audio chunks).
- `config.js`: Firebase web config (public by design). `CLOUD_USE_STORAGE=false` (audio stored as
  bytes chunks in Firestore, 960KB pieces; older songs may be base64 strings, both are read).
- Audio storage server (optional): `AUDIO_HOST` in config.js = a Cloudflare Worker (`worker/audio-worker.js`)
  in front of a Backblaze B2 bucket; songs stored there get `asset:'b2:<itemId>'`. Empty AUDIO_HOST = old
  behaviour (Firestore chunks). `AUDIO_MIGRATE=true` moves old chunk songs to the server. Setup: docs/audio-host.md.
  Local test: run the worker in Node against a fake B2 (see scratchpad wk/serve.mjs pattern).
- `sw.js`: service worker (network-first, `no-cache`); bump `CACHE` on every release.
- `firestore.rules`: only `libs/{code}/{coll}/{doc}` with code length >= 14 is readable/writable.
- `.github/workflows/pages.yml`: deploys to GitHub Pages on push to `main`.
- `.claude/skills/`: `frontend-design` and `ui-ux-pro-max` (search tool:
  `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <d>`).

## Live setup
- App: https://yuvalsa6.github.io/music-library-flyers/ (repo is public).
- Firebase project `music-library-flyers` (Spark/free plan, anonymous auth, Firestore).
- The library access code is private: never write it into the repo, commits or PRs.
- The app auto-updates on open; version shown in the settings sheet (`APP_VER` in index.html).

## Working rules learned
- Never interact with the real library in tests (clicks once added items to the real queue).
  Use the Firebase emulator (`npx firebase emulators:exec --only firestore,auth`) with a seeded
  copy, or local mode. Reading real data read-only is OK when needed.
- Keep Firestore usage within the free quota (avoid frequent polling/heartbeats).
- Check layout stability (no jumps while syncing), 44px touch targets, contrast >= 4.5:1,
  light + dark, 375px and landscape before shipping UI changes.
- Workflow: develop on the session branch, open a PR, the owner merges (or asks Claude to merge).

## Open thread
- New app icon: paused. Favored direction: a ♫ made of two acrobats (flyer in a handstand on the
  left note head, base standing on the right note head holding her foot; her leg is the beam).
