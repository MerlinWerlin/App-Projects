# Cue Google Play preparation — 3 November 2026

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
- Guarded APK reuse and current 4 KB / 16 KB emulator evidence:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41621450349
  App source must match the compiled commit before reuse. Simulations are still
  running; this is not a runtime-pass claim.
- The subsequent Voice Pace cleanup fix requires its own final binary:
  https://github.com/MerlinWerlin/App-Projects/actions/runs/41622056532
  It is building at source 421bff5. Earlier APKs do not include this repair.
- Inspected APK: 72,288,523 bytes,
  SHA-256 b282e31d15dde8a6f929c209004a89883da7fa772fdefcd86a3eeed9dff588ca.

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

The signed-in Astro Labs AU organisation Console was read on 3 November.
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
