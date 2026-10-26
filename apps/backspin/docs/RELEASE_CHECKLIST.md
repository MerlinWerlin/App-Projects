# Backspin release evidence — 26 October 2026

## Current release

Native **build 7**, version 1.0.0 (Apple listing 1.0), is VALID and attached to the editable App Store release. The app remains PREPARE_FOR_SUBMISSION. Jared explicitly authorized App Store submission/release and confirmed build 7 recording/playback/sharing and Plus purchase/Restore passed on his iPhone on 26 October. App Review submission is pending the signed-in website session; no public release is claimed.

- Mascot and native purchase fixes: [PR108](https://github.com/MerlinWerlin/App-Projects/pull/108), merged source `26bab64`.
- Final listing assets/settings: [PR110](https://github.com/MerlinWerlin/App-Projects/pull/110), merged `0f731a8`; [store sync 40300235155](https://github.com/MerlinWerlin/App-Projects/actions/runs/40300235155) succeeded with all steps verified in its Apple readback.
- Apple setup: [PR109](https://github.com/MerlinWerlin/App-Projects/pull/109), merged `7743a6e`.
- [Apple readback at 09:04 UTC](https://github.com/MerlinWerlin/App-Projects/commit/7743a6ecae3e19648df37a9ec6f3511f994c2ed8#commitcomment-206653861): build 7 VALID and attached; review contact complete; notes saved; Plus READY_TO_SUBMIT; eight iPhone screenshots present.
- Existing price retained: first 10 scored rounds free, then A$1.99 non-consumable lifetime Plus (`com.jared797.backspin.plus`). Missing purchase availability was initialized for 175 territories; existing selections and price schedules are preserved on repeat runs.

## Verified checks

- 33/33 Node tests, TypeScript, and iOS + Android release exports passed locally. [GitHub check 40292738007](https://github.com/MerlinWerlin/App-Projects/actions/runs/40292738007) also passed.
- Four purchase regression cases cover event-only transactions, competing error/success, recovery after a rejected request, and cancellation cleanup. `expo-iap` is pinned to 6.2.0; native builds keep the existing guard against Expo Go's fake unlock.
- Seven offline Apple-setup tests cover contact preservation, complete/partial source contact, missing/existing purchase availability, authentication failure and incomplete territory results. Contact values remain in Apple API requests and are never logged or committed.
- Opaque RGB 1254x1254 icon; transparent padded launch/adaptive assets. [ART_BRIEF.md](ART_BRIEF.md) records exact built-in ImageGen prompts and actual output dimensions. Expo produces platform icon sizes during the native build.
- Expo's monthly cloud quota refused build 6. The existing [Mac fallback 40293135600](https://github.com/MerlinWerlin/App-Projects/actions/runs/40293135600) signed a 20.5 MB IPA and successfully uploaded build 7 at 08:58 UTC. [Upload receipt](https://github.com/MerlinWerlin/App-Projects/commit/26bab64ca0e2b9a0ae4141e826260b2504740b14#commitcomment-206653171).
- Public marketing, privacy and support pages return HTTP 200. The public icon's SHA256 matches the committed mascot asset.
- Microphone wording covers hold and tap mode. Review notes disclose EAS Update and do not claim an unverified video has been supplied. First-launch language hint, Settings language picker and empty-filter Show all behavior are already implemented.

## Tablet captures

The app keeps native iPad support. [Capture 40293901740](https://github.com/MerlinWerlin/App-Projects/actions/runs/40293901740) succeeded. One actual 2064x2752 native first-launch screenshot was inspected and selected for the 13-inch iPad set; three route shots showing the system Open confirmation were excluded. See [store/ipad/README.md](../store/ipad/README.md). OTA was disabled only in the capture environment. No physical-iPad success is claimed. [Apple readback at 09:31 UTC](https://github.com/MerlinWerlin/App-Projects/commit/0f731a8520f2d4d2b29f08af9a296e62170ea835#commitcomment-206656898) confirms this iPad image and all eight iPhone images are COMPLETE.

## Release authorization and remaining requirements

- **Device checks passed (owner confirmation):** on 26 October Jared answered “Yes, all passed” for TestFlight build 7 recording/playback/sharing and Plus purchase + Restore. Do not ask for these checks again.
- **Release authorized:** “looks good, can you release it?” authorizes submission with Plus and automatic release after Apple approval. Apple readback at 09:31 UTC confirms `AFTER_APPROVAL` is saved. Build 7 remains attached, VALID and IN_BETA_TESTING; one internal group has automatic build access. Plus remains READY_TO_SUBMIT.
- **Signed-in Apple website required:** Apple's current API documentation requires the first In-App Purchase to be submitted with the app through App Store Connect. The API setup remains useful for metadata, screenshots and release settings. The in-app browser is at sign-in; desktop Chrome inspection failed twice with `GetCursorPos: Access is denied (0x80070005)`.
- Verify the published App Privacy questionnaire in the signed-in website, include Plus with version 1.0/build 7, and submit. Account paid agreement/bank/tax completion was recorded in the factory guide; handle any new account warning shown by Apple.
- A physical-iPhone review video has not been supplied. The release standard says to attach it when Apple asks; owner-confirmed testing is not a claim that video exists.

References for first-purchase routing: [Apple managing In-App Purchases](https://developer.apple.com/documentation/appstoreconnectapi/managing-in-app-purchases), [submit an In-App Purchase](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/).

The 10-go free tier is usage-limited, not an automatically started time-based trial. Android export success does not establish Android production readiness; native Android work stays in PR106.

References: [factory release standard](../../../docs/RELEASE_STANDARD.md), [OpenIAP transaction lifecycle](https://www.openiap.dev/docs/features/purchase), [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Signed-in submission checks

On 26 October, App Store Connect's Included Assets > App Icon for attached build 7 displays the new purple mascot at full size. The global navigation still displays the old record icon; it is not the selected build asset. No duplicate build is needed.

The App Privacy page was still at Get Started. The questionnaire is being completed with Device ID and Crash Data, for App Functionality only, not linked to identity and not used for tracking. This corrects the earlier blanket no-data statement: installed `expo-updates` sends `EAS-Client-ID` and `Expo-Recent-Failed-Update-IDs`. The public policy/support text and review notes now disclose these technical update-service details while preserving the accurate on-device recording claim.

Sources: [Expo submission guidance](https://docs.expo.dev/distribution/app-stores/), [Expo installation identifier](https://docs.expo.dev/eas/observe/reference/client-id/), [Apple data-collection definition](https://developer.apple.com/app-store/app-privacy-details/). This is a disclosure correction for existing build behavior; no runtime code or binary changes.
