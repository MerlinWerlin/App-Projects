# Cue Android data review — submitted with production release

## 5 November replacement candidate

The attempted d87a013d source flags did not exclude scanners from its actual APK.
Native reuse41897180445 correctly failed the new scanner-packaging gate.
The build log shows precompiled expo-camera; that bypassed the source Gradle flags.
Corrected49c89927 forces only Android Camera to compile from source, with
Apple autolinking unchanged. Actual source49 APK41897835294 and full signed
source1290 AAB41904947064 exclude scanner providers, native libraries and models.
Expo Camera58.0.14's build.gradle independently enables barcode and document
scanning by default; disabling barcode alone does not exclude the document
scanner. The Play overlay disables barcode via its plugin option and document
scanning via the supported expo.camera.document-scanner-enabled Gradle property.
The original iOS configuration is preserved. Camera's bare manifest
barcode_ui download marker remains and is explicitly recorded; absence of
packaged scanners is not a claim that the platform cannot download a module.

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
SDK diagnostic traffic. The declaration was saved and sent with the11production
changes on5November. After quick checks completed, Publishing overview confirmed
Your changes are now in review. It is not yet a public store label.

Saved answers: diagnostics collected/shared for analytics, required and not
ephemeral; purchase history collected optionally for app functionality, not
ephemeral. Purchase tokens/records support purchase acknowledgement and Plus
ownership; payment-card details remain solely with Google. User-initiated store
transactions use the sharing exception. No credit-card, script, recording,
document, location, advertising-ID or app-account collection is declared.
Transport is encrypted. Cue has no account creation/external account login,
independent security badge or general collected-data deletion badge. The
developer cannot promise deletion of Google's diagnostic/store records.

Official Billing9.1.0 AAR bytecode was also inspected: BillingClientImpl
constructors generate a fresh Random.nextLong into zzM, and launchBillingFlow
generates another random event number. No Android-ID, advertising-ID, app-set-ID,
device-ID or IMEI reference was found in that library's classes. This supports
distinguishing observed session/event numbers from persistent device IDs; it is
not proof about every possible Google Play service implementation. Source URL,
AAR hash and bytecode are retained in the local archive.

Both repaired4KB/16KB flows41906973573 captured the synthetic preview app's
own Data Transport queue after its complete UI flow. SQLite integrity is OK.
There are24/20 PLAY_BILLING_LIBRARY events and360/300 metadata rows respectively,
using the cct backend with an HTTPS firebase logging endpoint. The payloads
include operation failures, Billing9.1.0, package, app version, Android version,
manufacturer/model/build and per-session numbers. Transport metadata contains
language/country settings, timezone, network type and SIM operator. These
observations support technical-diagnostics disclosure. The build fingerprint
is not a demonstrated unique device ID, and undecoded session numbers must not
be labelled persistent device identifiers without evidence. Local queues do
not establish successful upload; the official source describes their network
transport. Licensed purchase payloads remain unobserved. The signed AAB has
Expo updates disabled and no advertising-ID or broad media-read permission.

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

Exact CCT3.1.8 source was retrieved from Google's official Maven source JAR,
matching the transport-backend-cct.properties in both the original production
AAB2 and rejected d87 preview APK. Its decorator/request builder includes
Android API/build/model/manufacturer/fingerprint, app build, language/region
settings, timezone, network type/subtype and SIM operator. The build fingerprint
is an OS-build identifier; do not relabel it as a demonstrated unique device ID.
The opaque Billing payload and full licensed-transaction path still need
inspection. Exact source JAR/hash receipt is retained in the local release
archive. A new Android privacy paragraph is prepared for this technical store
traffic; it is not a submitted Data safety form or proof of complete SDK audit.
