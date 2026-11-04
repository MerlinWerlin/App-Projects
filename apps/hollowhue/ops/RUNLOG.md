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

- 4 Nov artwork revision: curated57 original repo-authored Linework illustrations into6standard worlds (7pictures/6transitions each) and1Mega world (21distinct pictures/20transitions). Original smooth ink retained; closed fill regions baked beneath it. Added topic bubbles, difficulty filters and My colouring for all saved legacy scenes. 56 checks including all20Mega focus/paint stops, deep persistence and full legacy-shape checksum pass; strict types clean. Native iPhone flow now exercises6+20actual zooms, deep paint and saved work. Publication pending.

- 4 Nov realistic revision: owner explicitly rejected the Linework art preview. Replaced it with42original images generated using built-in image_gen: detailed places, botanicals, wildlife, sea life and ornaments, plus7simpler beginner flowers. Preserved lossless source pixels/prompts and traced cubic ink above closed tappable areas. Gzip-packed vectors with pure-JS fflate reduce iOS bundle65MB to29MB, native runtimeunchanged. 57tests/full+stub types/export pass. Draft native run41801065091 reached6+20stops but failed final saved-card navigation because scroll position was retained; filter changes now reset scroll. Final source native rerun/publication pending. Apple confirms previous build3 VALID/IN_BETA_TESTING.

- Illustrated native run41807826539/source391f5ed8: all6+20zoom stops, deep paint and undo/redo pass; cottage/cafe/deep screenshots reviewed. Final saved-card search overscrolled because it required100%visibility; the data was present. Centred40%-visible cards and reduced scroll speed in the test. Added lightweight generated gallery covers to avoid thousands of native SVG views on cold launch, retaining live previews for painted roots and full editable vectors in the canvas. 57tests and both strict typechecks pass; final native rerun required.

- Final app source2c585f9b passed full native iPhone41812677928: all6+20stops, deep painting/drawing/undo-redo and saved picture/recent colours after relaunch. Gallery launch-to-banner assertion fell from31s in the prior capture to14s on relaunch in this simulator run (not a physical-device benchmark). One first cottage screenshot preceded SVG rendering; capture-only bda2943d returns from cafe to Whole scene and reuses the exact compiled app in41816934677. Runtime equality verified; production OTA/fresh TestFlight release requested.

- 4 November10:58UTC: PR224 merged94f11922; OTA41817626284 published group28b985e9. Actual28,726,172-byte
  iOS/runtime0.1.0 bundle SHA29ab81377870abd715a2af76d93f047a6b99be50b9026bd23aa07786367bdbcf matches.
  Signed native0.1.0(4) uploaded11:13UTC in41817626016, submission1c7e39ae-8994-489a-a718-6d8487c32996.
  Apple probe41819703539 reportsPROCESSING/no errors or warnings; prior3 remainsVALID/IN_BETA_TESTING.
  GitHub outage delayed pushes, and the squash inherited skip-ci, so reviewed-main releases were dispatched
  explicitly once each. Ten usable current-source native captures plus separately attributed cottage-art
  reference retained in docs/qa-art-20261104. Raw premature frame remains in original capture archive.
  Retakes41816934677/41819117906 ended in simulator accessibility-driver connection failures; no completed
  Whole scene assertion is claimed. Full app qualification remains successful41812677928/source2c585f9b,
  with merged runtime equality checked. No physical-phone uptake or new native install availability claim.

- Final Apple probe41821210892 confirms build0.1.0(4) COMPLETE/VALID/IN_BETA_TESTING, no errors/warnings. Production group28b985e9 and actual bundle hash independently reverified in the same probe. Both OTA and fresh TestFlight are available; physical owner-phone uptake remains unverified. Complete and earlier in-flight receipts retained in docs/qa-art-20261104.
