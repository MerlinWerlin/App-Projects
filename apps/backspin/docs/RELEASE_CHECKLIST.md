# Backspin release evidence — 26 October 2026

## Current release

Native **build 7**, version 1.0.0 (Apple listing 1.0), and **Backspin Plus** were submitted together on 26 October 2026 at 21:48 Sydney (10:48 UTC). App Store Connect confirmed **2 Items Submitted**, and both items show **Waiting for Review** in [submission 22938d32-20f4-400f-ae3a-0271fb08027b](https://appstoreconnect.apple.com/apps/6826553963/distribution/reviewsubmissions/details/22938d32-20f4-400f-ae3a-0271fb08027b). Automatic release after approval is selected. Jared authorized submission/release and confirmed build 7 recording/playback/sharing and Plus purchase/Restore passed on his iPhone. Apple approval and public availability remain pending; no owner action is currently required.

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
- Microphone wording covers hold and tap mode. Review notes (1.0) disclosed EAS Update and do not claim an unverified video has been supplied. First-launch language hint, Settings language picker and empty-filter Show all behavior are already implemented.

## Tablet captures

The app keeps native iPad support. [Capture 40293901740](https://github.com/MerlinWerlin/App-Projects/actions/runs/40293901740) succeeded. One actual 2064x2752 native first-launch screenshot was inspected and selected for the 13-inch iPad set; three route shots showing the system Open confirmation were excluded. See [store/ipad/README.md](../store/ipad/README.md). OTA was disabled only in the capture environment. No physical-iPad success is claimed. [Apple readback at 09:31 UTC](https://github.com/MerlinWerlin/App-Projects/commit/0f731a8520f2d4d2b29f08af9a296e62170ea835#commitcomment-206656898) confirms this iPad image and all eight iPhone images are COMPLETE.

## 1.0.1: Guideline 5.6 rejection and OTA removal (10 Nov 2026)

- Apple rejected 1.0 (build 7, submission 22938d32-20f4-400f-ae3a-0271fb08027b) on 10 Nov under Guideline 5.6 ("features ... intentionally hidden during the review process"). No hidden screens or flags exist. The likely trigger is that the build could change its own code after review: `expo-updates` with `checkAutomatically: ON_LOAD`, disclosed in the review notes as "Expo EAS Update for app-code updates".
- 1.0.1 removes `expo-updates` completely: the dependency and its lockfile packages (expo-eas-client, expo-manifests, expo-structured-headers, expo-json-utils, expo-updates-interface), `updates` and `runtimeVersion` in app.json, and the EAS Update `channel` in eas.json. The app has no `Updates.*` code. Autolinking no longer finds an updates module. The EAS project id is now pinned in app.json, so ship-mac skips `eas update:configure`.
- iPad: the app supports all four iPad orientations (Expo's default for `supportsTablet` without full-screen), so content now sits in a centred column up to 640 pt wide. Phones are narrower than that and render as before.
- Store data prepared in the repo only: review notes in `store/listing.json`, App Privacy and policy changes in `store/APP_PRIVACY_1_0_1.md`, and the reply to App Review in `store/REVIEW_REPLY_5_6.md`. None of it has been applied to App Store Connect.
- The Google Play build still contains EAS Update; `privacy-android.html` stays unchanged until Android ships a build without it.

## 1.0.1: no background audio mode (11 Nov 2026)

- Apple rejected Cue under Guideline 2.5.4 for declaring `UIBackgroundModes` "audio" without a feature that needs it. Backspin had the same issue: the expo-audio plugin turns background playback on by default, and `npx expo config --type introspect` on build 9's source (ea9f919) shows `UIBackgroundModes: ["audio"]`.
- Fix: `enableBackgroundPlayback: false` and `enableBackgroundRecording: false` on the expo-audio plugin. Introspect now shows no `UIBackgroundModes`, and the microphone usage text is unchanged. Version stays 1.0.1.
- The app's behaviour doesn't change. Source never sets `shouldPlayInBackground` or `allowsBackgroundRecording` (both default off), so expo-audio already paused playback and recording when the app went to the background.
- This needs a new binary: build 9 still declares "audio". Jared approved swapping it, so this PR changes RELEASE.json and merging ships a new 1.0.1 build to TestFlight.

## Release authorization and review status

- **Device checks passed (owner confirmation):** on 26 October Jared answered “Yes, all passed” for TestFlight build 7 recording/playback/sharing and Plus purchase + Restore. Do not ask for these checks again.
- **Release authorized and submitted:** “looks good, can you release it?” authorizes submission with Plus and automatic release after Apple approval. Jared then signed in and asked to verify the app picture and send it through. The selected build icon is the purple mascot. The signed-in website confirmed `AFTER_APPROVAL` before submission.
- **First In-App Purchase included:** the website draft contained iOS App 1.0 / 1.0.0 (7) and Backspin Plus before Submit for Review. The final review receipt lists both as Waiting for Review, with no draft items remaining.
- **Price and privacy gates resolved:** the main app's free price tier was explicitly saved for all 175 regions (Australia base A$0.00); Plus stays A$1.99. App Privacy is published as Device ID and Crash Data, used for App Functionality only, not linked to identity and not used for tracking.
- **Next:** Apple review. Respond to any actual reviewer request; do not resubmit, create another binary, or run metadata `apply` while review is pending without a reason. The store request is now read-only `status`.
- A physical-iPhone review video has not been supplied. The release standard says to attach it when Apple asks; owner-confirmed testing is not a claim that video exists.

References for first-purchase routing: [Apple managing In-App Purchases](https://developer.apple.com/documentation/appstoreconnectapi/managing-in-app-purchases), [submit an In-App Purchase](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/).

The 10-go free tier is usage-limited, not an automatically started time-based trial. Android export success does not establish Android production readiness; native Android work stays in PR106.

References: [factory release standard](../../../docs/RELEASE_STANDARD.md), [OpenIAP transaction lifecycle](https://www.openiap.dev/docs/features/purchase), [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Signed-in submission checks

On 26 October, App Store Connect's Included Assets > App Icon for attached build 7 displays the new purple mascot at full size. The global navigation still displays the old record icon; it is not the selected build asset. No duplicate build is needed.

The App Privacy page was initially at Get Started. The questionnaire was completed and published with Device ID and Crash Data, for App Functionality only, not linked to identity and not used for tracking. This corrects the earlier blanket no-data statement: installed `expo-updates` sends `EAS-Client-ID` and `Expo-Recent-Failed-Update-IDs`. [PR112](https://github.com/MerlinWerlin/App-Projects/pull/112) corrected the public policy/support text and review notes; [store sync 40309411260](https://github.com/MerlinWerlin/App-Projects/actions/runs/40309411260) succeeded and the public policy was verified live. The accurate on-device recording claim is preserved.

Local browser proof is retained in the release checkout under `apps/backspin/.expo/apple-release-icon.png`, `apple-privacy-published.png`, and `apple-review-submitted.png`. The submission screenshot displays the purple mascot next to both submitted items; the global navigation still shows the old record icon. No public App Store availability is inferred from submission.

Sources: [Expo submission guidance](https://docs.expo.dev/distribution/app-stores/), [Expo installation identifier](https://docs.expo.dev/eas/observe/reference/client-id/), [Apple data-collection definition](https://developer.apple.com/app-store/app-privacy-details/). This is a disclosure correction for existing build behavior; no runtime code or binary changes.
