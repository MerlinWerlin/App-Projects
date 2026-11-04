# Run log

- 2026-11-04 (Codex, Jared's request to continue; target TestFlight on iPhone): resumed phase 2 in
  isolated `Apps/hollowhue-update`. Added four-level Hidden Library and Owlwood Forest, custom HSV/hex
  colours and ten persistent recent colours, a visible release marker and Settings update check/apply.
  Serialized retryable saves are awaited before an update reload. Kept original scene IDs/progress,
  native dependency versions and runtime 0.1.0. Corrected stale first-build status: build 2 and PR188 OTA
  were already delivered on 1 November; public production manifest still served that OTA on 4 November.
  38 tests, full/stub strict typechecks and iOS/Hermes export pass; art raster previews reviewed.
  Native iPhone simulator QA and this update's publication are pending; PR211 is draft.

- 2026-11-01 (Claude, from Jared's brief): Started Hollowhue. Pure-TS core (SVG path flattening and even-odd hit
  tests, nested level layout, camera/zoom maths, reveal + culling, progress with undo/redo), four scenes (Bookshop Lane
  4 levels, Endless Mandala 3 levels, Café Window, Dinosaur Jungle; about 1,950 colourable shapes), canvas with
  pinch/pan, tap-fill and freehand pencil/marker/rubber, gallery, settings, language line, icon and splash.
  Offline: tests and strict stub typecheck clean; art checked with scripts/preview.py. Not yet on a device.
- 2026-11-01 (same chat): PR #181 merged after a green check (typecheck, 24 tests, iOS + Android bundle, doctor 21/21). ship (dispatch, no RELEASE.json) linked the Expo project; ios-credentials (reference backspin, build off) registered the bundle id, made the App Store profile and linked it on Expo. Blocked: App Store Connect wasn't signed in in Chrome, so the app record needs Jared; then add RELEASE.json {mode build, ascAppId, ascKeyAuth true}.
- 2026-11-01 round 1 (Jared's TestFlight notes: eraser, deeper zoom, visible pop): labelled Eraser tool in both modes (tap clears a fill; in Draw it rubs out strokes and a tap clears a fill). Bookshop Lane +2 levels (embroidered garden through the cushion motif, ladybird on a leaf) and Endless Mandala +2; max zoom x8 past the deepest level. Reveal rewritten: no stand-ins, child levels drawn in place from 10 px wide, each shape fades in between 1.5 and 5 px on screen (quarter-octave steps), parent hidden only when a child (rect or ellipse) covers the screen, nested backgrounds have no outline, drawing is relative to the outermost drawn level (no float loss at depth). Checked with scripts/zoom-frames.ts + zoom-preview.py: frame-to-frame differences stay flat across every level change. Shipped as an OTA update.

- 2026-11-04: native iPhone rerun41788606169 passed at774e5328 after fitting the canvas above its measured
  tray and preserving a deliberate zoom during tray changes. Actual drawn stroke/undo/redo, custom hex
  picker, new scenes and recent colours after relaunch passed; all8screenshots reviewed and preserved
  in docs/qa-20261104 with a runtime-source equality receipt. Release PR211 is prepared to publish OTA
  and trigger a fresh signed TestFlight binary. Publication/Apple beta state still to verify.

- 2026-11-04 07:19UTC: PR211 merged4cb96f4; production OTA41791352443 PASS. Group889daefd-5069-47c7-aab4-7db47b71fb15 now served to iOS/runtime0.1.0. Actual2604624B download matches manifest SHA25be239f6da76dbb5e8f5d7b2886eade7638a842fdd7fb55ea5fd31cac3b3f7f; receipt in docs/qa-20261104. Fresh signed TestFlight41791367613 is building; Apple availability and physical-phone uptake are not yet verified.

- 4 Nov: signed native0.1.0(3) uploaded successfully at07:29UTC. Apple upload API41794648774 confirms PROCESSING with no errors/warnings; processed list still has build2. Added read-only in-flight upload probe so pending uploads are not confused with latest processed builds. Owner says zoom now looks good but rejects artwork; next revision is improved art + Linework-style topic/difficulty filters +6actual zoom transitions/+20Mega.
