# Cue Google Play preparation — updated 4 November 2026

Jared requested that Cue be simulated and pushed toward Google Play release.
Source is current App-Projects main at dc444372ca15ba1c88d9badca11d67e0d20b56b7,
with Cue-only Android preparation in codex/cue-google-play-release-20261103.
The older October test APK is not the release candidate.

## Verified so far

- Current local TypeScript check passes.
- All 90 Jest tests and three native speech guard checks pass; the binary
  permission checker also has five passing Python regression tests.
- Play preview uses com.jared797.cue.playtest, separate data, embedded JavaScript
  and disabled OTA. Play production preserves com.jared797.cue.
- Existing iOS profiles, app.json and RELEASE.json are unchanged.
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
- Current binary with the save and Voice Pace repairs:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41622370763
  Native build/static inspection passed. The complete 4 KB simulation passed,
  including a saved 8,528 ms video at 1280×720. The 16 KB runner exited during
  its initial launch command without an app-crash record; it did not pass.
- Identical-APK rerun, started 4 November:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41698286454
  App source must match the compiled commit before reuse. Await this run's
  results before claiming complete 4 KB / 16 KB validation.
- Current inspected APK: 72,279,195 bytes, source f572a109a0dc6fa9f8ef5ffc24572b792fe0581c,
  SHA-256 dbf7f03738c708f08e34962d9a58727ee9c62e3a6b411c555938a7cdfb137425.

4 November follow-up: the 4 KB flow passed again in run41698286454 and
run41698547987. The latter 16 KB flow passed script creation/editing/prompter,
then its next Maestro process reported `device offline` / `DeviceServerDiedException`.
No app native/JavaScript crash was recorded. The harness now uses one Maestro
session with nested flows and explicit stopApp/relaunch for persistence; no
assertions were removed. These are runner-transport findings, not a 16 KB pass.

The check bot subsequently aligned SDK patch dependencies at dac129c, including
Expo58.0.23 and router58.0.30. The older APK cannot validate those changed native
dependencies. Fresh native build and simulations at source070ad0c:
https://github.com/MerlinWerlin/App-Projects/actions/runs/41699589503
Generic checks were also dispatched for that source (run41699624923).
Both are pending at this checkpoint. Do not reuse f572a10 as current-source proof.

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

Voice Pace now explicitly stops and deletes its temporary microphone cache.
Leaving while permission or preparation is pending cannot start recording
later. Cancellation, stop failure, denial and single cleanup are unit-tested.
See GOOGLE_PLAY_DATA_AUDIT.md for the source/SDK review and privacy-page changes
needed before the Android listing; this is not a submitted Data safety form.

## Live Console blocker

The signed-in Astro Labs AU organisation Console was rechecked on 4 November.
It displays “To publish apps, finish setting up your developer account” and
“Complete account verifications to create apps”. Create app is disabled.

Outstanding items displayed by Google:

1. Verify identity by uploading an official document.
2. Verify phone numbers after organisation/identity documents are approved.

The website verification task was visible earlier but is absent in the latest
live Home view. Identity and phone verification still block Create app.

The account exists; its existence and payment do not complete these checks.
No identity document, phone code or legal agreement was submitted by this work.

## Remaining release checks

After account verification enables app creation, create the Cue app record,
configure Play App Signing and a durable upload key, build the production AAB,
and prepare the listing, Android screenshots, content rating and Data safety
from the final binary and SDK behaviour.

Verify camera/microphone interruption and video save, on-device recognition
availability and its truthful fallback, and real Play Billing purchase,
pending/cancel, acknowledgement, revocation and restore using a licensed tester.
The Android trial is device-local; verify its native start/restart simulation
before advertising it. The Apple trial remains transaction-backed on iOS.
Keep the existing one-time price decision and avoid inventing subscriptions.

Emulator library/prompter checks do not establish those purchase, real-speech
or physical-camera results. No store upload, review submission or public
availability is claimed.
