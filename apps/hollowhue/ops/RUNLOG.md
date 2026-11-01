# Run log

- 2026-11-01 (Claude, from Jared's brief): Started Hollowhue. Pure-TS core (SVG path flattening and even-odd hit
  tests, nested level layout, camera/zoom maths, reveal + culling, progress with undo/redo), four scenes (Bookshop Lane
  4 levels, Endless Mandala 3 levels, Café Window, Dinosaur Jungle; about 1,950 colourable shapes), canvas with
  pinch/pan, tap-fill and freehand pencil/marker/rubber, gallery, settings, language line, icon and splash.
  Offline: tests and strict stub typecheck clean; art checked with scripts/preview.py. Not yet on a device.
- 2026-11-01 (same chat): PR #181 merged after a green check (typecheck, 24 tests, iOS + Android bundle, doctor 21/21). ship (dispatch, no RELEASE.json) linked the Expo project; ios-credentials (reference backspin, build off) registered the bundle id, made the App Store profile and linked it on Expo. Blocked: App Store Connect wasn't signed in in Chrome, so the app record needs Jared; then add RELEASE.json {mode build, ascAppId, ascKeyAuth true}.
