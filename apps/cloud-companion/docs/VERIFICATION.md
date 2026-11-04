# Prototype verification

This file records achieved checks separately from requirements still needing evidence. It is not a new roadmap; the APPS Cloud Companion row in the master roadmap owns stage/status.

## Current checks

Native macOS CI is being run against the exact candidate commit. The workflow runs the portable Swift tests, generates the Xcode project, builds the iOS app and WidgetKit extension without signing, and captures native simulator screens. Final results and the run link will be recorded here once complete.

## Physical-device checks still required

WeatherKit and App Group provisioning must succeed for both identifiers. Select a city, add small/medium widgets, record initial fetch timestamps, leave the app unopened and record updates over 24 hours. Repeat with normal use, Low Power Mode, overnight idle, offline/reconnect, reboot/unlock, city and temperature-unit changes. Confirm future values remain labelled Forecast and old cached temperatures disappear after expiry. Test missing/denied location with manual city selection. An app swipe-away and an OS restart are separate cases. Do not claim full-day automatic-refresh reliability from a simulator screenshot or a successful build.

Check actual home-screen sizing, tint/dark mode, large text and VoiceOver. Complete attribution artwork/source-link review and app icon/store metadata before signed distribution. Android/Windows are future scope. No TestFlight upload, store submission or public release has been performed.
