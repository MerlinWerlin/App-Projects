# Prototype verification

This file records achieved checks separately from requirements still needing evidence. It is not a new roadmap; the APPS Cloud Companion row in the master roadmap owns stage/status.

## Current checks

Verified source commit: `20cd03702121653815f2a412d1d172979e73ab5a`. [Native macOS run 41787586007](https://github.com/MerlinWerlin/App-Projects/actions/runs/41787586007) reported:

- All 12 Swift cache/model/timeline tests passed with zero failures.
- XcodeGen generated the native project successfully.
- The complete iOS application and real WidgetKit extension built successfully for the simulator, without signing, at 06:46:36 UTC on 4 November 2026.
- The simulator capture step completed successfully. The public run page lists a 1.76 MB native-evidence artifact. This establishes capture, not visual approval.
- The shared App Group UserDefaults privacy manifest parses locally and declares `1C8F.1`; project generation/build checks the target definitions. Capability declarations are not proof of signed entitlement authorization.

The artifact could not be retrieved for visual inspection: GitHub API requests returned rate-limit errors. Computer Use was attempted as a browser fallback but stopped because the runtime could not determine the current Windows browser URL with sufficient confidence. No further browser actions were taken. Screenshots therefore remain **unreviewed**. Overall artifact-upload/final-run status was not independently re-read after the API refusal; individual successful build/test/capture steps were observed before it.

Earlier run 41787182928 exposed a Swift type-inference error in the sample fixture. Run 41787331467 passed all 12 tests and built the widget, then exposed a city-search catch-variable error in the app. Both source issues were fixed before the successful complete native build above. A duplicate draft-PR run was cancelled; it is not counted as additional validation. Documentation commits after the verified source do not change runtime files.

Prototype delivery: [draft PR 215](https://github.com/MerlinWerlin/App-Projects/pull/215). The branch is not merged or released. This Windows machine has no local Swift/Xcode installation; compilation and simulator execution occurred on the macOS CI runner.

## Physical-device checks still required

WeatherKit and App Group provisioning must succeed for both identifiers. Select a city, add small/medium widgets, record initial fetch timestamps, leave the app unopened and record updates over 24 hours. Repeat with normal use, Low Power Mode, overnight idle, offline/reconnect, reboot/unlock, city and temperature-unit changes. Confirm future values remain labelled Forecast and old cached temperatures disappear after expiry. Test missing/denied location with manual city selection. An app swipe-away and an OS restart are separate cases. Do not claim full-day automatic-refresh reliability from a simulator screenshot or a successful build.

Check actual home-screen sizing, tint/dark mode, large text and VoiceOver. Complete attribution artwork/source-link review and app icon/store metadata before signed distribution. Android/Windows are future scope. No TestFlight upload, store submission or public release has been performed.
