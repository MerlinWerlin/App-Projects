# Backspin store kit

This kit serves the APPS A2 release work. Codex and the Backspin build owner maintain it in GitHub App-Projects; GitHub main is authoritative. `listing.json` is the editable App Store listing and review-note source. The existing store workflow reads `ASC_REQUEST.json` and posts its actual results as a commit comment; a green workflow alone does not mean every Apple operation succeeded.

App Store Connect app: 6826553963. Bundle: com.jared797.backspin. App version: 1.0 / native 1.0.0. First 10 scored rounds are free; Plus is the existing A$1.99 non-consumable lifetime product com.jared797.backspin.plus. Price remains unchanged.

Eight 1320x2868 iPhone marketing screenshots live in `jpg/ios`, generated from the app layout by `src/render.mjs`. These are designed screenshots, not evidence of a real-device test. `docs/RELEASE_CHECKLIST.md` records verified checks and remaining submission requirements. Never describe a physical-iPhone video as supplied until its actual upload is verified.

The new mascot is included in native build 7; an OTA update cannot replace the installed Home Screen icon. The existing ship workflow uploads to TestFlight, falling back to GitHub's Mac build when Expo build quota is exhausted. Jared authorized the first App Review submission and confirmed physical-iPhone checks. Codex submitted build 7 and Plus together through the signed-in Apple website on 26 October at 21:48 Sydney; both are Waiting for Review with automatic release after approval. The main download is free in 175 regions; Plus remains A$1.99. `ASC_REQUEST.json` is read-only `status` while review is pending. See the release checklist for the receipt and published privacy disclosure.
