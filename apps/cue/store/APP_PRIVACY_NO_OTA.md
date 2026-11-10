# Cue 1.0 (new build): App Privacy and policy changes (prepared, not applied)

The new 1.0.0 build removes `expo-updates`. That library was the only part of the iOS app that sent anything off the device: a random installation ID and failed-update diagnostics to Expo EAS Update. The app has no network requests of its own in `app/` or `src/`. The only URL it opens is the privacy policy, in the browser. Apple handles StoreKit purchases and the free 7-day Trial, and these do not count as developer data collection.

## App Store Connect: App Privacy (change this before resubmitting)

| Field | Was (1.0, build 13) | Should be (new build) |
|---|---|---|
| Do you or your third-party partners collect data from this app? | Yes: Device ID and Crash Data, for App Functionality, not linked, not tracking | **No, we do not collect data from this app** |
| Device ID | Collected (EAS installation ID) | Remove |
| Crash Data | Collected (EAS failed-update diagnostics) | Remove |

After the App Privacy change is published in App Store Connect, the product page shows "Data Not Collected".

## Public privacy policy (`docs/cue/privacy.html`)

The policy still describes Expo EAS Update for iOS. This PR does not change the page, because it is outside `apps/cue` and goes live as soon as it merges. Make these changes before resubmitting so the policy matches "Data Not Collected":

- Badge: replace "Limited technical data supports app updates and store functions." with "Cue does not collect any data."
- Delete the first two paragraphs of "App updates and diagnostics" (the EAS Update request contents and Expo's processing). Optionally replace them with: "Cue does not download app code or updates outside the App Store and Google Play. Updates come only through the store."
- Keep the Android/Google Play paragraph. The Play build already disables EAS Update, and from this version it no longer contains it.
- Children's privacy: delete the sentence that begins "The platform-specific update-service processing described above applies".

## Release notes

- `store/listing.json`: the review notes and the description's privacy line no longer mention EAS Update. They state that the app has no remote code-update mechanism and collects no data.
- Nothing here has been applied to App Store Connect.
