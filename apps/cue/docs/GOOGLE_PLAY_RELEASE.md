# Cue Google Play preparation â€” updated 5 November 2026

## 5 November Android continuation

The existing iOS App Store submission is outside this work. No Apple action or
RELEASE.json change was made. The seven iOS release-policy checks still pass.
All initial Console setup tasks are saved. The production release and11changes
were sent for review on5November. After refreshing, Publishing overview
confirms: Your changes are now in review. The quick-check queue has completed.
There is no public-availability claim. Managed publishing remains off, so an
approved release will publish automatically. Availability targets177countries/
regions plus Rest of World; Plus retains its separately configured174regions.
The additional Advertising ID declaration is No, matching the inspected build.
Version1.0.0/code4 is available on the internal track (release2,5November07:46
Sydney). Its release notes describe only Cue's script, prompter, recording and
optional Plus features. The public listing likewise focuses on the product.
Reviewer access is saved with the actual reusable complimentary code, and the
target audience is13-15,16-17 and18+. No Cue account is required.

The owner has created the merchant profile. Cue Plus is now active as
`com.jared797.cue.plus`, purchase option `lifetime`, Buy, backwards compatible,
available in174regions. Australia is verified atAUD2.99; other prices use
Google's conversion from that base. No subscription or Android trial product
was created. The existing owner-only1tester list is selected and saved for
account-wide License testing, responseRESPOND_NORMALLY. Neither eligibility
nor an active product proves an actual purchase. Payout bank verification is
pending; no release block has been established from that status alone.

PR233 adds visible Settings > Access code on Android. A reusable complimentary
code grants all Plus features with no account, payment, trial, expiry or
location restriction. It stores a code digest locally, separate from paid
ownership and trial records. Removing it preserves purchases and the original
trial. The same code can be re-entered after clearing data or reinstalling.
iOS cannot activate it. The actual code is outside Git and supplied to CI as
CUE_PLAY_REVIEW_CODE; the field is masked and text reports are redacted before
artifact upload. This is complimentary access, not a store transaction.

Google's [review-access requirements](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en)
require reusable access and permit additional access resources. The current
Console prohibits relying on reviewer payment or a free trial. Full-access
certification was saved after qualified code4 was published internally. The
older internal build2 had no access-code screen and is no longer included.

The attempted d87a013d scanner exclusions did NOT remove ML Kit. Its actual
72,320,983-byte preview APK (SHA256f7610e788d0222063d7b18d125148dd8f55e1384808ea6d9654b94fadd15a803)
still contains both scanner providers/libraries. Build job41893758645 passed,
but its original simulations were cancelled after securing the APK. Reuse
41897180445 was rejected by the stronger SDK packaging guard before runtime.
Keep those outcomes; no new native pass was obtained from that binary.

Root cause: Expo58 linked a precompiled Camera AAR, bypassing the Gradle scanner
flags. Corrected source `49c8992756fd505ce14710c81c3e719ae5d99d0c` forces only
Android expo-camera to build from source, so barcodeScannerEnabled=false and
expo.camera.document-scanner-enabled=false can take effect. An actual
platform-options test confirms Apple buildFromSource remains unset. The actual
replacement binary and video evidence are recorded below.

Actual source49 APK41897835294 excludes scanner providers, libraries and models,
with56 aligned64-bit native libraries. Camera's bare barcode_ui download marker
remains; this is explicitly recorded and does not establish no platform download.
The original build's broad marker guard failure remains preserved. Runtime
41902492942 then found a real complimentary-access removal bug: AsyncStorage
returns null after storing an empty string. Source1290bdf4 fixes that adapter
case while preserving paid and trial state; both old failures remain failures.

The repaired JavaScript1290bdf4 and unchanged source49 native payloads passed
the full4KB and16KB flows in41906973573. QA packaging41906122748 checks equal
native fingerprints and all1448 retained APK payloads; only the JavaScript
bundle changes. The QA APK is test-signed and must never be uploaded to Play.
Code activation, restart, Plus colour unlock, removal and persistent relocking
passed, alongside the earlier script/trial/recording flows. Synthetic videos
are8511/8515ms at1280x720. There are no Cue process failures; three external
Google Services fatal events on the16KB guest are retained separately.

The current full production AAB passed41904947064, compiled from exact source
1290bdf42acaf5f2bd216f5443b4a83e31001d5f with existing Expo-managed upload
credentials inside disposable CI. Package com.jared797.cue,1.0.0/code4,
target36,72,686,741 bytes, SHA256
51310e5424cff417bd725550b8e4c51579e21be6b51af85884c2ab1a1f998ca4.
Bundletool/JAR signature, existing certificate pin, embedded JS/disabled OTA,
scanner inventory and16KB packaging/ELF checks pass. This local EAS build has
no Expo cloud UUID. Cloud builds3(fc348389) and4(f4821a5c) are both confirmed
CANCELED in41902737684/41905350750; neither supplied this production binary.

96Jest tests, TypeScript and both mobile exports pass41904460668. Six native
privacy/Play-configuration checks, seven iOS release-policy checks and22Python
inspection tests pass. Queued Billing diagnostics were captured from only the
synthetic preview app:24events on4KB and20on16KB, with app/OS/model/build,
language/country settings and network/carrier metadata. These are local queue
observations, not proof of a successful network delivery or licensed purchase.
Data safety answers are saved pending review, based on source and the captured
SDK behaviour. Licensed billing and speech/interruption QA remain open.

The owner approved the official Android SDK license and installation. Stable
platform-tools37.0.1, emulator37.2.13 and Google Play API35/x86_64 revision9 are
installed under the dedicated cue-android-sdk cache. WHPX is usable and the
unique Cue emulator is running. Owner Google sign-in remains pending; the
owner is remote and cannot currently complete that handoff. Do not treat
license-testing eligibility or emulator installation as a transaction pass.

Public listing and release-note copy describes Cue's product features; build,
simulation and internal validation details belong only in these release records.

The sections below retain the4November baseline. Their build2/c809ffd runtime
evidence is not proof for the replacement source.

Jared requested that Cue be simulated and pushed toward Google Play release.
Work started from App-Projects main at dc444372ca15ba1c88d9badca11d67e0d20b56b7,
with Cue-only Android preparation in codex/cue-google-play-release-20261103.
The older October test APK is not the release candidate.

## Android port alongside the existing iOS app

On 4 November Jared clarified that this release is for Android, not TestFlight.
A separate Claude App Factory ship run created PR206 after PR200 merged,
changed only RELEASE.json, and triggered the legacy iOS ship workflow at
12:22 Sydney time (run41753643435 succeeded). This was not the Android
production workflow. The original Android PR did not change RELEASE.json.

`ops/release-policy.json` now records Android-only intent separately from
RELEASE.json. Both legacy ship.yml and ship-mac.yml must check that policy
before Expo access; Cue's iOS builds and OTA releases fail closed. Inferred
source changes or an automated RELEASE.json bump cannot authorise TestFlight.
A later explicit owner decision is required to enable iOS shipping again.
The owner subsequently clarified that the existing iOS App Store submission
must remain in review. Only accidental TestFlight build14 was expired in
run41783651780. Independent read41783879096 confirmed the older App Store
submission still WAITING_FOR_REVIEW. Do not withdraw or delete it. The original
Android AAB remains the internal-test baseline; the replacement needs separate validation.

## Verified 4 November baseline

- Latest candidate is c809ffd, which adds bounded Android acknowledgement
  recovery to the previously built SDK-aligned source.
- TypeScript, 92 Jest tests, three native speech guards and eleven Python
  validation tests pass. Generic check run 41729425808 also passes both mobile
  exports on the same app source.
- Current-candidate native build job passed:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41724507628/job/126225642242
  Its original undersized-guest simulations were cancelled after the artifact
  was secured; the successful build result is retained.
- Complete current-candidate 4 KB and 16 KB simulations passed:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41729426511
  Workflow e254802 verifies unchanged app source against compiled c809ffd.
  Both flows cover editing, prompting/mirror, process-restart persistence,
  trial persistence, camera denial/recovery and saved synthetic-camera video.
  Saved videos are 8424 ms and 8431 ms respectively, both 1280Ã—720.
  Cue runtime reports contain no app failures and bind to the checked log hash.
  Two unrelated Google Services crashes on the 16 KB guest remain recorded
  separately; these results do not establish overall emulator health or billing.
- Current APK: 72,287,275 bytes, target SDK 36, embedded JavaScript and 58 native
  libraries passing 16 KB alignment inspection. SHA-256:
  7b2205a5920af4fb26d4c05ee6a3a2c01ebaae157d4990a356aa58ee1b3b98ec.
- Previous completed APK was source 070ad0c: 72,286,111 bytes, target SDK 36, embedded
  JavaScript and 58 native libraries passing 16 KB alignment inspection.
  SHA-256 2e5aec751b67ffbd088c860788026040af1c53422d92fbd6f41f3105e3a65843.
  Its complete 4 KB flow passed in run 41723153512, saving an 8,456 ms, 1280Ã—720
  video. This binary predates c809ffd's acknowledgement recovery.
- The same binary's 16 KB checks exposed two harness failures: an emulator
  disappeared during installation, and run 41723866270 timed out starting
  Maestro's driver. The latter's guest log explicitly records lowmemorykiller
  killing dev.mobile.maestro (PID 5011) because the minimum watermark was breached.
  The host still had 11.7 GB available and no host OOM event. The guest image's
  2560 MB default was raised to 4096 MB, confirmed by final guest-memory receipts.
  The current candidate passes under that configuration.
- Play preview uses com.jared797.cue.playtest, separate data, embedded JavaScript
  and disabled OTA. Play production preserves com.jared797.cue.
- Existing iOS profiles, app.json and RELEASE.json are unchanged.

## Earlier evidence retained

- Permission-restricted native build:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41618079984
  Compilation, signing and ZIP alignment passed. The original static check
  rejected aapt's synthesized legacy READ_EXTERNAL_STORAGE entry. Inspection of
  the compiled manifest shows no read declaration; aapt derives it from WRITE
  capped at API32. The repaired checker distinguishes declared from implied
  permissions, has five regression tests, and passes this exact APK.
- Guarded APK reuse exposed a real video-save API failure on both page sizes:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41621450349
  The Expo SDK's root MediaLibrary export throws for the old save API. Cue now
  uses the supported `expo-media-library/legacy` entry point.
- Historical binary with the save and Voice Pace repairs:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41622370763
  Native build/static inspection passed. The complete 4 KB simulation passed,
  including a saved 8,528 ms video at 1280Ã—720. The 16 KB runner exited during
  its initial launch command without an app-crash record; it did not pass.
- Historical identical-APK rerun, started 4 November:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41698286454
  The 4 KB job passed; the 16 KB job failed its KVM access check.
- Historical inspected APK: 72,279,195 bytes, source f572a109a0dc6fa9f8ef5ffc24572b792fe0581c,
  SHA-256 dbf7f03738c708f08e34962d9a58727ee9c62e3a6b411c555938a7cdfb137425.

4 November follow-up: the 4 KB flow passed again in run 41698286454 and
run 41698547987. The latter 16 KB flow passed script creation/editing/prompter,
then its next Maestro process reported `device offline` / `DeviceServerDiedException`.
No app native/JavaScript crash was recorded. The harness now uses one Maestro
session with nested flows and explicit stopApp/relaunch for persistence; no
assertions were removed. These are runner-transport findings, not a 16 KB pass.

The check bot subsequently aligned SDK patch dependencies at dac129c, including
Expo 58.0.23 and router 58.0.30. The older APK cannot validate those changed native
dependencies. Fresh native build and simulations at source 070ad0c:
https://github.com/MerlinWerlin/App-Projects/actions/runs/41699589503
Compilation/static checks passed. Both Maestro 2.12 simulation jobs failed their
transport connection. Generic checks passed in run 41699709429 (the earlier
dispatch was superseded by that docs-inclusive check). Do not reuse f572a10 as
current-source proof.

Maestro 2.10 still includes the direct ADB socket transport. The changelog places
the transition at 2.5, so the current harness pins checksum-verified 2.4. It keeps
every UI assertion in one session, caps its JVM heap and captures host memory,
process and kernel state on exit. Harness-only commits no longer trigger a
redundant native compilation; dispatch can reuse an APK only after app-source
equality checks. Failed runs and their artifacts are retained.

Run 41727921756 completed every Cue UI/video assertion on 16 KB but failed its
global crash grep because Google Services crashed. The corrected checker
attributes errors to Cue PIDs, including previous app processes, and rejects
Cue native/JavaScript failures and ANRs. Six regression tests protect this
attribution. The original run remains failed; fresh run 41729426511 is the pass.

The emulator flows create and edit a script, open the prompter, toggle mirror,
then force-stop/restart and verify the saved title/body. They also start the
Android trial and verify its persisted date, deny/recover camera permission,
record a synthetic-camera take and verify saved video duration/dimensions.
The matrix independently checks actual 4096/16384 page sizes.
The compiled APK is a release-mode test build
signed with the generated test key, not a durable Google Play upload key.

The earlier 83ad50c APK compiled successfully: target SDK 36, embedded JavaScript,
58 inspected native libraries, 72,337,919 bytes, SHA-256
7b3e320dd95feba953a1e6942addb1c6929cafcd4fa662112c784ae5ec6daf85.
Its manifest exposed unused SDK media-read, overlay and background-playback
declarations. The final Play overlay removes these capabilities; final binary
inspection rejects them. This baseline APK is not the release candidate.

Legacy WRITE_EXTERNAL_STORAGE is capped at API32. Android's packaging tool
also reports implied READ_EXTERNAL_STORAGE with that same cap. The compiled
manifest contains no explicit read declaration. This is legacy platform
compatibility access, not a claim that older Android versions enforce add-only
library access.

The initial generic CI check exposed a missing explicit sharing config plugin;
the SDK-aligned follow-up passes TypeScript, tests and both mobile exports.
A local Windows Hermes bytecode export crashed; no local bytecode-export pass
is claimed. The independent Linux CI exports pass.

## Android-specific repairs

Android starts the existing seven-day trial explicitly on-device without
requesting Apple's free non-consumable product. It persists the earliest start
in local/secure storage, never renews an expired date, and does not turn trial
access into permanent Plus. This is device-local, not account-linked or
reinstall-proof. Clearing app data or reinstalling can lose the trial record.

Google queries only the Plus product. Store refresh and revocation preserve a
valid local trial, while corrupt trial storage cannot block a verified paid
purchase or cause a new trial. A listener-only pending purchase never unlocks
or acknowledges Plus. Google price metadata bypasses the iOS-only TestFlight
currency workaround. Purchase wording now applies to either store.

These cases are unit-tested; real Play Billing still needs licensed testing
after an app/product record can be created.

Android refresh/restore now retry failed acknowledgement for purchased items
that Google marks unacknowledged. Pending, unknown and unrelated products are
excluded; successful acknowledgements and concurrent attempts are deduplicated.
A failed attempt retains the store-confirmed ownership and is retried on a
later read. Both recovery and exclusion cases are unit-tested.

Voice Pace now explicitly stops and deletes its temporary microphone cache.
Leaving while permission or preparation is pending cannot start recording
later. Cancellation, stop failure, denial and single cleanup are unit-tested.
See GOOGLE_PLAY_DATA_AUDIT.md for the source/SDK review and published privacy
copy; this is not a submitted Data safety form.

## Live Play Console progress

Identity was approved on 4 November at18:14 Sydney, confirmed by Google's email
and the live Console. Both contact and public developer phone numbers are now
verified. The owner explicitly approved Developer Program Policies, Play App
Signing Terms and the US export declaration; all three were accepted when
creating Cue: Teleprompter, package `com.jared797.cue`, English(en-US), Free.
Play app ID: `4974377533213924164`.

The original signed AAB was uploaded and accepted as version1.0.0/build2,
target36, minimum API24. It was published to the internal track
`4701155287852725598`, release1, at20:07 Sydney. Google reports it available to
internal testers, not reviewed. The owner-only email list contains one account
and is selected/saved. Joining/installing and licensed billing have not been
verified. This is not a public production release or App Review submission.

Eight of eleven setup tasks are saved: content ratings, privacy policy, no ads, non-government,
no financial features, no health features, Productivity category/public support
details, and the English listing with icon/feature graphic/four screenshots.
Only the AI-assisted feature-graphic composition was AI-labeled; phone assets
are actual emulator captures and the icon is an existing-brand export. Content
changes are saved in Publishing overview but have not been sent for review.

Remaining Console gates:

- Sign-in details requires full, non-expiring reviewer access to Plus; Google
  explicitly says reviewers cannot pay or start free trials. No false full-access
  certification was saved. Target audience is blocked until this section is done.
- The owner explicitly approved IARC Terms of Use, which were accepted. The
  All Other App Types questionnaire is complete and saved: ESRB Everyone,
  PEGI3, USK All Ages, IARC Generic3+, Russia/South Korea3+, and Brazil14+.
  In-App Purchases is declared, without random/chance purchases. No packaged
  ratings-relevant content, native user-to-user exchange, online content feed,
  age-restricted product promotion, location sharing, rewards, browser/search
  engine or primary news/education features were declared. These answers match
  Cue's supplied content and functionality; user-authored local scripts are not
  a hosted content feed. Ratings are saved pending Publishing overview review.
- Data safety still needs the final SDK/network review.
- The merchant profile is now created by the owner. Plus/lifetime is active at
  AUD2.99 and the owner license list is saved; actual transactions are untested.

Screenshots and operation evidence are in the local Cue release archive under
`Apps/outputs/cue-google-play-20261104`.

## Remaining release checks

PR200 merged to main as `772b677abd1f0983627e7f8235e072f2c0570146` on
4 November. Main's app source matches the validated production build.
The Android-qualified privacy policy is live through GitHub Pages (HTTP200,
deployment of that commit verified). Store listing and Data safety remain
unsubmitted.

Production EAS build `637caa56-f5d2-46d0-801e-6d644f26c359` was queued on
4 November from `2a16e7fe1e5bf70a320ca44c8ae5549d51e140fd`: profile
`play-production`, package `com.jared797.cue`, version 1.0.0/build 2,
embedded JavaScript and Expo updates disabled. The build is finished, and
production validation run 41745767651 passed. The AAB is 83,006,582 bytes;
SHA256 `e365915a9f9acdc518060929af9ae0471c2751d976659e2dcd491a00a1c60eb5`.
Google bundletool 1.18.3 validated the bundle, target SDK36, package/version,
embedded JS and `PAGE_ALIGNMENT_16K` packaging. All 58 arm64/x86_64 native
libraries have at least 16 KB ELF segment alignment; 58 additional 32-bit
libraries are recorded separately. JAR signature verification passed with no
unsigned entries. The managed upload certificate is valid through March2054;
its SHA256 fingerprint is
`BD:CA:03:41:01:5C:37:B8:39:EA:74:69:B8:01:88:C1:EA:8C:07:00:23:43:05:8A:66:99:10:C9:83:53:AD:AB`.
No private signing key was downloaded. Nineteen Python validator tests pass,
including eight production-bundle/download cases. Original dependency/link
and HTTP403 download-check failures remain failures; the finished binary was
validated in the later successful run. The artifact endpoint accepts a
CLI-style user agent without sending Expo credentials.

The same app source passed preview runtime simulations; the production AAB
itself has not been installed through Play or used for licensed billing.
The workflow can inspect the existing UUID without queueing another build.

The account/app creation and initial bundle upload are complete. Finish the
remaining Console gates, actual Plus transactions and Data safety
from the final binary and SDK behaviour before production submission.

The English listing assets are now prepared and visually inspected in
`store/assets`: four actual 1080Ã—1920 Android UI captures, the existing-brand
512Ã—512 icon and a 1024Ã—500 feature graphic. Capture run 41732019758 passed on
the same APK. MANIFEST.json records source/hashes and lossless screenshot
pixel provenance; VISUAL_REVIEW.md records inspection. These are now saved in
the English Play listing, pending review rather than publicly published.

GOOGLE_PLAY_BILLING_QA.md contains the licensed, one-time purchase rehearsal;
every case is explicitly unexecuted. Baseline simulation archives, source-bound
receipts and the guest-memory failure log are preserved in
`C:/Users/jared/Documents/ChatGPT/Apps/outputs/cue-google-play-20261104`.
Open its README.md and INDEX.json for scope, hashes and source runs.

Verify real Play Billing purchase,
pending/cancel, acknowledgement, revocation and restore using a licensed tester.
The device-local Android trial's native start/restart simulation has passed;
the Apple trial remains transaction-backed on iOS. Audio interruption and
on-device speech availability/fallback still need separate validation. Current
camera/audio proof is synthetic, with no physical-microphone quality claim.
Keep the existing one-time price decision and avoid inventing subscriptions.

The emulator flows do not establish those purchase, real-speech
or physical-camera results. Internal-track upload/publication is verified;
production submission and public availability are not claimed.
