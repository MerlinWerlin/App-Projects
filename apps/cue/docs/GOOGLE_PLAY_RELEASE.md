# Cue Google Play preparation — updated 4 November 2026

Jared requested that Cue be simulated and pushed toward Google Play release.
Work started from App-Projects main at dc444372ca15ba1c88d9badca11d67e0d20b56b7,
with Cue-only Android preparation in codex/cue-google-play-release-20261103.
The older October test APK is not the release candidate.

## Verified so far

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
  Saved videos are 8424 ms and 8431 ms respectively, both 1280×720.
  Cue runtime reports contain no app failures and bind to the checked log hash.
  Two unrelated Google Services crashes on the 16 KB guest remain recorded
  separately; these results do not establish overall emulator health or billing.
- Current APK: 72,287,275 bytes, target SDK 36, embedded JavaScript and 58 native
  libraries passing 16 KB alignment inspection. SHA-256:
  7b2205a5920af4fb26d4c05ee6a3a2c01ebaae157d4990a356aa58ee1b3b98ec.
- Previous completed APK was source 070ad0c: 72,286,111 bytes, target SDK 36, embedded
  JavaScript and 58 native libraries passing 16 KB alignment inspection.
  SHA-256 2e5aec751b67ffbd088c860788026040af1c53422d92fbd6f41f3105e3a65843.
  Its complete 4 KB flow passed in run 41723153512, saving an 8,456 ms, 1280×720
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
  including a saved 8,528 ms video at 1280×720. The 16 KB runner exited during
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

## Live Console blocker

The signed-in Astro Labs AU organisation Console was rechecked on 4 November.
It displays “To publish apps, finish setting up your developer account” and
“Complete account verifications to create apps”. Create app is disabled.

Outstanding items displayed by Google:

1. Google is verifying identity: the owner has uploaded documents and approval
   is pending. Google says this may take a few days and it will email the owner.
2. Verify phone numbers after organisation/identity documents are approved.

The website verification task was visible earlier but is absent in the latest
live Home view. Identity and phone verification still block Create app.

The account exists; its existence and payment do not complete these checks.
The owner completed the document upload; this agent did not upload identity
documents, submit a phone code or accept a legal agreement.

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

After account verification enables app creation, create the Cue app record,
configure Play App Signing against the verified upload certificate, and finish
content rating and Data safety from the final binary and SDK behaviour.

The English listing assets are now prepared and visually inspected in
`store/assets`: four actual 1080×1920 Android UI captures, the existing-brand
512×512 icon and a 1024×500 feature graphic. Capture run 41732019758 passed on
the same APK. MANIFEST.json records source/hashes and lossless screenshot
pixel provenance; VISUAL_REVIEW.md records inspection. These remain unuploaded.

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
or physical-camera results. No store upload, review submission or public
availability is claimed.
