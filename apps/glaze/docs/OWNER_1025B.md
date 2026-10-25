# Owner brief 25 Oct 2026 21:29 Sydney (fb-1025b)

Source: Jared, manual fire of the Glaze build task (imported run 120). Outranks the backlog.

| | Owner said | What we did | Task |
|---|---|---|---|
| 1 | Remove ALL bounce animations everywhere | Springs were already gone in code (run 115, waiting in the unbuilt PR). Now also every scroll view stops the iOS overscroll bounce and Android glow; the spring preset is deleted; guard test `t151NoBounce.test.ts`. | T151 |
| 2 | Make Glaze Plus purchasable at A$2.99 one-time in TestFlight (sandbox) | Own StoreKit 2 module `modules/glaze-store` (no npm), real Unlock + Restore in production-native builds, App Store price shown. Needs the product `com.jared797.glaze.plus` in App Store Connect: `docs/IAP_SANDBOX.md`. | T152 |
| 3a | Bulk install must actually work, or say plainly if impossible | Verdict: **possible with limits** (`docs/BULK_INSTALL_VERDICT.md`, sources inside). Fixed a real fault: Safari now asks for the profile instantly, before iOS suspends Glaze's mini server. | T154 |
| 3b | Widget theme changer must work | Fix (PR #96 + link check, runs 115-117) is in the next build; unchanged this run. | T145, T146 |
| 3c | Live Photo wallpaper must work | Export rebuilt to the format other developers found iPhone accepts (1080x1920 HEVC, HEIC still, still-image-time -1). One camera-only metadata track can't be reproduced, so it may still say "Motion not available". | T153 |

Why his phone still showed bounce and "arrives with the store release": the 25 Oct fixes have not been built yet; they sit in the unmerged App-Projects ship PR (#96 and whatever auto-ship opens next). Nothing here was compiled with Xcode or tested on a device. Retest: docs/TRIAL.md, top section.
