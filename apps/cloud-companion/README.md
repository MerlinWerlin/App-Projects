# Cloud Companion (working name)

A small native iOS weather companion whose home-screen widget fetches weather independently of the app. Started by Codex, solo, under Jared's 4 November 2026 conditional research/build request. Serves the APPS Cloud Companion prototype row in the master roadmap. Name is provisional and has not been cleared for release.

Open `docs/RESEARCH.md` for the competitor assessment and `docs/VERIFICATION.md` for measured results and outstanding device checks. `Shared/Core.swift` contains the cache and timeline policy; `Widget/CloudWidget.swift` owns network refresh. The app and widget share a selected city and a cache through an App Group. The widget does not require the app to run or background GPS permission.

## Run on a Mac

Install Xcode and XcodeGen, then run `xcodegen generate` in this folder and open `CloudCompanion.xcodeproj`. The app and widget require the same development team, App Group `group.com.jared797.cloudcompanion`, and WeatherKit capability enabled on both identifiers. This prototype does not register or modify Apple account resources automatically.

`swift test` tests the portable model and timeline policy. `xcodebuild -project CloudCompanion.xcodeproj -scheme CloudCompanion -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build` builds the app and extension without signing. GitHub's `cloud-companion-ios` workflow performs these checks and captures simulator screens.

Launch with `--demo` for an explicitly labelled sample forecast and `--widget-preview` to see the shared native widget layouts in the app. Demo data never enters the shared live cache. An unsigned simulator build does not prove WeatherKit authorization or physical-device refresh behavior.
