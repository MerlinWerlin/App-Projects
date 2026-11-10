# Backspin 1.0.1: App Privacy and policy changes (prepared, not applied)

Version 1.0.1 removes `expo-updates`, the only part of the iOS app that sent anything off the device. The app makes no network requests of its own (no `fetch`, sockets or URLs in `app/` or `src/`). StoreKit purchases are handled by Apple and do not count as developer data collection.

## App Store Connect: App Privacy (Jared changes this before resubmitting)

| Field | Was (1.0, build 7) | Should be (1.0.1) |
|---|---|---|
| Do you or your third-party partners collect data from this app? | Yes: Device ID and Crash Data, for App Functionality, not linked, not tracking | **No, we do not collect data from this app** |
| Device ID | Collected (EAS installation ID) | Remove |
| Crash Data | Collected (EAS failed-update diagnostics) | Remove |

Publish the App Privacy change in App Store Connect, then the product page shows "Data Not Collected".

## Public privacy policy (`docs/backspin/privacy.html`, iOS)

The iOS policy still describes Expo EAS Update: the badge line, the "What Backspin does not do" bullet, the whole "App updates and technical data" section, and a sentence in "Children's privacy" and "Your choices and requests". These must be removed before the resubmission, so that the policy matches "Data Not Collected". This PR did not touch that page because it is outside `apps/backspin` and is published as soon as it merges.

Replacement wording:
- Badge: "Backspin has no accounts, ads or tracking. Audio, scores and saved takes are processed and stored on your device, and the app does not collect any data."
- "What Backspin does not do", first bullet: "No advertising, analytics or tracking of any kind, and no data collection."
- Delete the "App updates and technical data" section. Optionally replace it with: "Backspin does not download app code or updates outside the App Store. Updates come only through the App Store."
- Children's privacy: delete "The limited update-service data described above applies to every installation."
- Your choices and requests: replace "relating to update-service data" with "about the app".

`privacy-android.html` stays as it is: the Google Play build still includes EAS Update until Android ships a build without it.
