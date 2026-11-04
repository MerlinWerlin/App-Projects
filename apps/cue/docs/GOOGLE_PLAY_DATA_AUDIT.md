# Cue Android data review — draft, not submitted

## 5 November replacement candidate

Candidate d87a013d excludes both unused Expo Camera scanners on Android only.
Expo Camera58.0.14's build.gradle independently enables barcode and document
scanning by default; disabling barcode alone does not exclude the document
scanner. The Play overlay disables barcode via its plugin option and document
scanning via the supported expo.camera.document-scanner-enabled Gradle property.
The original iOS configuration is preserved. Compiled SDK absence must still
be verified in build3; do not apply this source claim to uploaded build2.

Complimentary Plus access uses only local storage of a code digest, without
network requests, account creation, payment or trial mutation. No raw code is
stored by the app. Source network-call review finds only the user-opened privacy
URL and mail composer; this does not rule out native SDK network activity.

The official [Billing SDK Index entry](https://play.google.com/sdks/details/com-android-billingclient-billing)
was inspected on5November, including version9.1.0. It does not provide a
data-collection guide. Its “No permissions found” text explicitly warns that
undetected permissions may exist and is not evidence of no collection.
Google's [Data safety instructions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
require native SDK collection to be included. Payment-card information handled
directly by Play is a separate exception; it does not automatically exempt
SDK diagnostic traffic. No new Data safety declaration has been saved.

The remaining table and production-build2 inspection below are historical
baseline evidence; new candidate results must be recorded separately.

This review describes the Play overlay and repairs through candidate c809ffd. It is preparation
for the Console forms, not a completed Data safety declaration or a network
capture. Recheck against the signed production AAB before submission.

| Feature | Current source behaviour | Evidence / remaining check |
| --- | --- | --- |
| Scripts and preferences | AsyncStorage on device; no app account or script upload endpoint found | `src/state/AppState.tsx`; review Android system-backup rules in the production manifest |
| Video and audio | Camera/microphone used for takes; saves own video through MediaLibrary write-only request | `app/record/[id].tsx`; emulator save test does not establish physical microphone quality |
| Voice Pace | Local microphone level metering through a cached audio recording; explicit stop/delete cleanup | `src/native/voiceRecording.ts`; cancellation, partial recording, denied permission and stop failure are unit-tested. Verify native cache cleanup and interruption before release |
| Voice Follow | Requests `requiresOnDeviceRecognition: true`; unsupported recognition returns a fallback | `src/native/speech.ts`; Google recognizer availability/resources vary; verify native fallback |
| Import and export | System document picker and share sheet; user chooses files and destinations | Native document-picker/sharing modules; no broad media-read declaration in inspected APK |
| Plus purchase | Google Play Billing queries Plus only, store handles payment; app checks ownership and caches access. Refresh/restore retry failed acknowledgement for confirmed, unacknowledged purchases | `src/plus/purchases.ts`; retry and pending/unknown exclusion are unit-tested; licensed purchase/pending/cancel/restore/revocation tests still required |
| Android trial | Earliest start timestamp in local storage and SecureStore; not a Google trial SKU | `src/plus/androidTrial.ts`; clearing data/reinstall can remove local state |
| Updates | Play overlay sets `updates.enabled: false` and embeds JS | Compiled manifest/config; do not reuse iOS EAS Update disclosure as Android behaviour |
| Feedback | Opens mail composer, sending remains the user's action | Support correspondence may contain the information the user chooses to send |

On older Android versions, the capped legacy write permission also implies
storage read access. The absence of explicit read declarations does not prove
the operating system enforces add-only access there. Cue's code saves its own
takes and does not browse the collection; describe that behaviour precisely.

The signed production AAB was inspected in run41745767651. Its manifest sets
`allowBackup=true` and has no explicit `fullBackupContent` or
`dataExtractionRules` attributes. The final backup-resource/SDK review remains
open; do not claim that scripts or trial records are excluded from platform
backup. Expo updates are disabled and no broad media-read or foreground-service
permission is declared. Legacy write stops at API32.

The installed package includes Billing and Google Android Data Transport
components from dependencies. Their presence alone proves neither collection
nor absence of collection. Audit resolved SDK behaviour and final network
traffic before answering the Console's collection/sharing questions. The
review did not find an app analytics or advertising dependency in package.json.

## Published privacy page

PR200 merged as `772b677` on 4 November. GitHub Pages built that commit, and
the public [privacy policy](https://merlinwerlin.github.io/App-Projects/cue/privacy.html)
returned HTTP200 with the Android copy. The policy preserves the shipped iOS
descriptions and adds these Android qualifications:

- Google Play processes the optional one-time Android Plus purchase. Cue does
  not receive payment-card details.
- Android's free, user-started seven-day trial is device-local. It does not
  create a store transaction or charge automatically. Clearing app data or
  reinstalling can lose its start record. Restoring Plus checks the Google
  store account; it does not create another trial.
- These Play profiles disable Expo EAS Update. The existing iOS profiles still
  use the update service described by the current policy.
- Photos/gallery sync, operating-system backups and store purchase records
  are controlled separately by the relevant platform and user settings.
- Store purchase approval follows the platform's account and family settings.

No Data safety answers were submitted. Publication of the policy does not
establish that all SDK/network behaviour has been tested.
