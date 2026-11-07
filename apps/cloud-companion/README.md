# Cloud Companion (working name)

A small native iOS weather companion whose home-screen widget fetches weather independently of the app. Started by Codex, solo, under Jared's 4 November 2026 conditional research/build request. Serves the APPS Cloud Companion prototype row in the master roadmap. Name is provisional and has not been cleared for release.

Open `docs/RESEARCH.md` for the competitor assessment and `docs/VERIFICATION.md` for measured results and outstanding device checks. `Shared/Core.swift` contains cache and timeline policy. Each widget uses App Intents to choose its own city and temperature unit, fetches WeatherKit directly and caches forecasts in the extension's own container. The host app has its own saved places. There is no App Group or background GPS dependency.

Version 0.2 adds original floating/blinking clouds, weather particles, a tap response, a sample-weather playground, an animation preference that respects Reduce Motion, a custom cloud name, saved cities and a five-day forecast. Continuous animation runs in the foreground app; widgets use short transitions between weather updates. Demo/playground data never replaces live readings.

## Run on a Mac

Install Xcode and XcodeGen, run `swift tools/MakeIcon.swift` and `xcodegen generate` in this folder, then open `CloudCompanion.xcodeproj`. The app and widget require the same development team and WeatherKit capability enabled on both identifiers. The original vector app icon is generated during the build. The dedicated delivery workflow uses the repository's existing Apple/Expo credentials and existing distribution certificate, creates profiles only for this app and widget, and targets internal TestFlight. It does not create API keys, revoke certificates or submit a public store release.

`swift test` tests the portable model and timeline policy. `xcodebuild -project CloudCompanion.xcodeproj -scheme CloudCompanion -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build` builds the app and extension without signing. The dedicated `cloud-companion-ios` workflow also exercises actual native controls, captures all eight scenes and a video, and compares moving/reduced-motion frames. CI publishes synthetic review evidence on `codex/cloud-companion-evidence`; that branch is not product source and contains no signing material.

Launch with `--demo` for an explicitly labelled sample forecast, `--widget-preview` for the native widget gallery, or `--demo --playground --mood=rainy` for a weather scene. `--motion-off` disables motion in demo mode. Demo data never enters a live cache. An unsigned simulator build does not prove WeatherKit authorization or physical-device refresh behavior.
