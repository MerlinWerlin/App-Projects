# Shipping notes

- Bundle id com.jared797.hollowhue; Expo project @jared797/hollowhue (linked by the ship workflow's `eas init`).
- First TestFlight build: RELEASE.json {"mode": "build", "note": "...", "ascAppId": "<ASC app id>", "ascKeyAuth": true}
  with the default `production` profile, as Roamlings did.
- A new app's first non-interactive build fails with "Distribution Certificate is not validated"; run the
  `ios-credentials` workflow (inputs app=hollowhue, reference=backspin, build=true), which makes the provisioning
  profile with the App Store Connect API, links it on Expo and starts `ship-mac`.
- Changes compatible with the existing native dependencies and runtime can go out over the air
  (RELEASE.json mode "update"). Native dependency/config changes require a fresh binary.

## November iPhone update

- Prior delivery verified: first native build was **0.1.0 (2)**, ship-mac run 41287140968 on 1 November.
  Its Expo.plist used project `2f10e62c-2086-4e7d-9437-649fc240e82d`, production channel, runtime 0.1.0.
- Last OTA before this work: PR188, ship run 41290162730, group
  `d679a9f4-8624-4bbf-9628-4b3975d28565`, published 1 November 08:46 UTC. A public protocol request
  on 4 November still served iOS update `01a1964a-2a8a-7421-8ce5-d28fa1cb9f7c` from that group.
  There had been no newer Hollowhue source update; no broken channel/runtime mapping was found.
- Native iPhone QA **passed** on source `774e5328`, run **41788606169**. All eight screenshots are in
  `docs/qa-20261104` and have been visually reviewed; the fitted canvas stays above the tray. Custom hex
  entry, fill/draw undo-redo, both new worlds and recent colours after relaunch passed. Production OTA
  networking is separately probed; the simulator capture disables OTA for reproducibility. Publication
  is recorded below; physical-phone uptake is unverified.
- Existing builds check on launch with zero fallback wait; a downloaded update can need another cold
  launch before it runs. After publication, open Hollowhue online, allow the download, then fully close
  and reopen it. The new gallery says **November colour & discovery update**. Thereafter Settings
  exposes **Check for updates** and **Save & apply update** for explicit update handling.
- The reviewed `TESTFLIGHT_REQUEST.json` change dispatches `ship-mac` (`app=hollowhue`) on main to embed the same code;
  verify Apple's processing state and internal tester availability before saying it is installable.

## Production delivery (4 November 2026)

- PR211 merged as `4cb96f4e495c1a38b2072fe6e4d258a41c73e26b`. Production OTA run
  **41791352443** passed. Group **889daefd-5069-47c7-aab4-7db47b71fb15**, iOS update
  `01a1a56d-ca44-73fa-ab8c-fb62661c997b`, published **07:19:58 UTC**, runtime **0.1.0**.
- Public manifest and actual downloaded **2,604,624-byte** bundle verified. SHA256
  `25be239f6da76dbb5e8f5d7b2886eade7638a842fdd7fb55ea5fd31cac3b3f7f`; receipt
  `docs/qa-20261104/production-update.json`. This proves server delivery, not uptake on the owner's iPhone.
- Fresh signed TestFlight build/upload run **41791367613** succeeded: **0.1.0 (3)** uploaded at
  07:29UTC, submission `a9aee4e4-1f6a-44f1-8cc5-eb2bab86b3c2`. Apple upload probe41794648774
  confirms **PROCESSING**, no errors or warnings; build3 is not yet in the processed build list.
  `docs/qa-20261104/apple-upload-status.json` records the in-flight state. Beta availability is pending.
- Existing build: fully close Hollowhue, reopen online for a minute to download, then close and reopen
  once more. Look for **November colour & discovery update**. The fresh TestFlight binary will embed
  this release directly.

- New owner direction after trying the live update: zoom motion now looks good, artwork is rejected;
  next revision needs topic categories and beginner/intermediate/advanced levels like Linework, six
  actual standard zoom transitions and twenty in a separate Mega Zoom category.

- Apple probe **41801311385** subsequently confirmed build **3 COMPLETE / VALID / IN_BETA_TESTING**,
  no errors or warnings. Receipt: `docs/qa-20261104/apple-complete-status.json`.

## Realistic artwork revision

- The owner rejected the Linework-based preview as low quality and requested more realistic detail.
  Its draft was not published. The replacement has 42 original illustrated pictures, preserved source
  pixels and prompts, cubic ink silhouettes and closed tappable areas. Six regular worlds have six
  actual zooms each; Mega has twenty transitions through twenty-one different pictures.
- Garden Blooms is beginner, botanicals and sea life intermediate, wildlife/places/ornaments advanced.
  Five topic categories combine with difficulty filters. Earlier saved scenes are unchanged.
- Native draft run41801065091 reached all six standard and all twenty Mega stops, painted at depth and
  exercised undo/redo. Its final saved-picture step exposed retained gallery scroll position; changing
  category/difficulty now returns the list to the top. The final illustrated source needs a fresh run.
- 57 tests, full/stub strict types and iOS/Hermes export pass. Packed vectors reduce the illustrated
  bundle from65MB to29MB. Pinned fflate is pure JS; native dependencies and runtime0.1.0 are unchanged.
- Final native QA and publication are pending; see `ops/status.json` for current delivery evidence.
- Illustrated run **41807826539**, source **391f5ed8**, reached all six regular and twenty Mega stops,
  painted at twenty and completed undo/redo. Reviewed cottage/cafe/deep-paint screenshots show the new art.
  Its final saved-card selector required100%visibility and overscrolled the card despite its saved data being
  present. The test now centres partially visible cards with smaller scroll steps. Blank gallery cards also
  use generated covers to avoid thousands of SVG views during cold launch; painted roots keep live previews.
  A fresh native run is required for that gallery performance change. Earlier captures remain failed evidence.

## Illustrated release delivered

- PR224 merged as **94f11922**. Full native iPhone **41812677928 PASS** on app source **2c585f9b**;
  merged runtime equality verified separately from capture-only YAML changes. All six regular and twenty
  Mega stops, deep paint, drawing/undo/redo and saved work after relaunch pass. 57 tests, strict types,
  iOS export and doctor21/21 pass. Evidence and frame qualifications: `docs/qa-art-20261104/README.md`.
- OTA **41817626284 PASS**, published **10:58:40UTC**. Group **28b985e9-003d-4211-8cba-f73de9565c9f**,
  update `01a1a636-0322-7e89-aad8-4b780bee7e6e`, iOS/runtime **0.1.0**. Actual **28,726,172-byte** bundle
  matches SHA256 `29ab81377870abd715a2af76d93f047a6b99be50b9026bd23aa07786367bdbcf`.
- Signed native **0.1.0 (4)** uploaded **11:13UTC** in **41817626016**, submission
  `1c7e39ae-8994-489a-a718-6d8487c32996`. Probe **41819703539**: Apple **PROCESSING**, no errors/warnings;
  build4 is not yet in the processed list. Build3 remains VALID/IN_BETA_TESTING. No new binary availability
  or physical-phone uptake claim until verified.
- Final probe **41821210892** confirms build4 **COMPLETE / VALID / IN_BETA_TESTING**, no errors/warnings.
  `docs/qa-art-20261104/apple-complete-status.json` records availability; the earlier processing receipt is
  retained separately. The same probe reverified the served production update and downloaded bundle hash.
- In the existing TestFlight app: **Settings → App updates → Check for updates → Save & apply update**.
  New banner: **New art. Six zooms. Twenty in Mega.** The compatible OTA is available independently of
  Apple's processing of the fresh native binary.
- GitHub's Git/PR/Actions incident delayed pushes. The squash inherited a skip-ci marker, so both release
  workflows were dispatched explicitly on the reviewed main commit; no duplicate automatic builds ran.
