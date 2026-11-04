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
  and physical-phone uptake are still **pending**.
- Existing builds check on launch with zero fallback wait; a downloaded update can need another cold
  launch before it runs. After publication, open Hollowhue online, allow the download, then fully close
  and reopen it. The new gallery says **November colour & discovery update**. Thereafter Settings
  exposes **Check for updates** and **Save & apply update** for explicit update handling.
- The reviewed `TESTFLIGHT_REQUEST.json` change dispatches `ship-mac` (`app=hollowhue`) on main to embed the same code;
  verify Apple's processing state and internal tester availability before saying it is installable.
