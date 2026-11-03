# Backspin Android release — 4 November 2026

Jared authorized Backspin Android simulation and Google Play review/release. Live checkout: Apps/backspin-google-play-release, branch codex/backspin-google-play-release-20261103, [PR202](https://github.com/MerlinWerlin/App-Projects/pull/202). Google identity/phone gates still block app creation and submission. No Play application, billing transaction, review submission or public release is claimed.

## Verified results

The signed runtime155a670 bundle below is retained as the previous candidate. A subsequent Android billing audit found that pending/unknown Plus payments could grant access and that a failed acknowledgement could be skipped by cached ownership. The source now requires purchased state and a token on Android, reconciles ownership on foreground, and retries unacknowledged completed payments on queries, Restore and startup. Seven additional regression tests pass (40 app tests total), with TypeScript, five configuration checks and a fresh iOS export. Pending Android payments now have an explicit pending result and localized guidance; Android errors/Restore name Google Play and avoid an unverified no-charge promise. The existing iOS transaction path is preserved. A fresh native candidate and gameplay checks are required before using the repaired source for release; the old bundle does not contain this repair. Real Play transactions remain untested.

[Run 41701424210](https://github.com/MerlinWerlin/App-Projects/actions/runs/41701424210) completed successfully with runtime source 155a67047b63dcc4655c5de65963145c75dba951.

- Full API 35/x86_64 gameplay on 4096-byte pages PASS: onboarding, actual microphone permission, original recording, AAC decoding, reverse playback, copy recording, scoring, save, Android share sheet, exactly one free go consumed, and persistence after process restart. Input was synthetic speech through the host microphone.
- Two native decoder instrumentation tests PASS, including valid AAC conversion and invalid input rejection.
- 33 app tests, 5 configuration checks, TypeScript and a fresh iOS export PASS. Existing iOS build profiles and RELEASE.json remain unchanged; no Apple resubmission occurred.
- Preview APK: com.jared797.backspin.playtest, target SDK 36, embedded JS, OTA disabled. Downloaded SHA256: 12aa3f6af825c425b22cefac0097c59e268719c0221bcef68d11cf13843a6d01. Never upload this test-signed APK to Google Play.
- Production AAB: com.jared797.backspin, version 1.0.0/versionCode 1, target SDK 36. Official Google bundletool validation and compiled-package check PASS. Durable RSA4096 upload signature and strict signature verification PASS. Signed SHA256: e70cd5f5b92b0ae4be8acf417629f808a5ccb83160700464e592357e0c1216aa; 45,511,317 bytes.
- Signed AAB audit: 54 native libraries across arm64-v8a/x86_64, all ELF load alignments at least 16384; embedded code and OTA-disabled configuration confirmed. No overlay, broad storage or foreground-service permissions. Compiled Play Billing version 9.1.0; no real purchase result is implied.
- Five unmodified actual screenshots from the passing run are in store/play/screenshots with source hashes. Visual review confirms the repaired two-column audio controls and save confirmation. Icon 512 px and feature graphic 1024x500 are prepared.

Private upload key/password remain outside Git/public artifacts. Signed AAB and receipts are also saved in an owner-accessible release folder outside this checkout. Public summaries: store/play/bundle-verification.json and store/play/gameplay-4k.json.

## 16 KB and physical-audio limitations

The identical APK installed and launched on verified 16384-byte-page devices running API 35 and API 36. Both native decoder tests passed on both versions. Full microphone gameplay remains UNQUALIFIED.

API 35 run 41711341099 reached copy recording before Android system services restarted. API 36 run 41713732204 reached reversed playback before its screenshot RPC disconnected; logs recorded 52 low-memory process kills. Test screenshots now use ADB independently. Run 41715297715 verified 6,072,516 KiB of guest memory, passed both decoder tests, and recorded only three background low-memory kills with no DeadSystemException or Backspin fatal-process line. It still rejected the original take as too short. The microphone-signal cause is unresolved; passing codec tests do not substitute for a full round.

An alternative authenticated SDK injectAudio experiment caused the emulator process to segfault before Backspin was installed in runs 41717696727 and 41718822479, including paced stereo delivery. Those are simulator/prototype failures, not app results. The prototype is preserved under scripts/play/archive_20261104_grpc_emulator_segfault and disconnected from the release workflow. Run 41715067110 was cancelled before emulator testing to replace the undersized configuration. Run41726474225 independently captured the actual 4.435-second recording: raw AAC and the app WAV both contain195584 decoded samples, near-zero RMS (0.00000193/0.00000209) and zero active windows. The host speech source RMS was2931.5 PCM16. Ranchu audio HAL logs repeatedly report pcm_readi I/O errors and inserted silence. This localizes the observed loss before PCM conversion, in the emulator capture path; it does not establish physical-device behavior or a full16KB gameplay pass. Both decoder tests pass again. A fresh candidate is required after the billing repair; run41727788636 was cancelled before native compilation so it could include corrected pending-payment messages.

Public bounded diagnostics are store/play/diagnostics-16k-api35.json, store/play/diagnostics-16k-api36.json and store/play/microphone-sdk-experiment.json. Complete logs/screenshots are retained locally and in the corresponding CI artifacts.

Human voice quality and physical phone routes/interruptions remain unverified. Jared has no Android phone or paid testers. Do not invent those results or purchase testers. Earlier failures and screenshots remain retained, including Pixel Launcher ANR/ADB loss, silent constant-tone input and an offscreen save assertion. Actual cramped audio controls were repaired and visually rechecked.

## Website and privacy

Play Console website ownership is VERIFIED through Search Console. Preserve the homepage tag from [commit21e9e0c](https://github.com/MerlinWerlin/App-Projects/commit/21e9e0cd0b65e5d0acb5299437eed77e25e2d600).

Settings opens the full platform-specific policy. The [Android privacy page](https://merlinwerlin.github.io/App-Projects/backspin/privacy-android.html) was published by [commitff7f742](https://github.com/MerlinWerlin/App-Projects/commit/ff7f742023a6b5744c439fc3a1832c3439f61d77); HTTPS200 and exact source hash verified. Existing iOS policy is unchanged. Android OTA updates are disabled; do not copy Apple's update-service disclosures without checking the Android binary/SDK behavior.

## Remaining store gates

Prepared questionnaire facts (not submitted): all app features are accessible without a Backspin account; reviewers receive the same ten free scored rounds. No login credentials are needed. The app contains no ads, public feed, chat, health or financial-service features. Plus is a single non-consumable purchase. Microphone access occurs after the permission explanation and Android prompt, while a round is open. Saved audio can be deleted in Takes.

Data safety draft: audio, scores, preferences and party names are processed locally. Sharing opens the Android chooser and feedback opens an editable email in the user's mail app. Google's [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) excludes solely local processing from collection and provides a user-initiated sharing exception. Payment details collected directly by Google are distinct from purchase status received by the app; do not copy a blanket payment exemption onto all transaction data. The compiled bundle has OTA disabled and no advertising/analytics SDK integration in app source. Final SDK/network behavior and the actual Console questions must still be checked before submission. Content rating and target-audience answers remain to be completed from the app and existing audience decision; no rating has been issued.

1. Wait for Google to approve the documents already submitted by the other chat. The shared 4 November checkpoint and Lane 4 confirmation show Organization: Submitted and Authorized representative: In review. Phone verification and app creation remain locked until approval. The earlier recommendation to obtain a replacement ABN letter is superseded; no replacement or duplicate upload is currently required unless Google requests it. Historical business-source files remain saved privately.
2. Create the app with the stable package, register the upload certificate with Play App Signing, and preserve an owner-controlled recoverable key/password backup before upload. A signed bundle alone is not Google registration or approval.
3. Configure Plus com.jared797.backspin.plus: 10 scored goes free, then authorized A$1.99 lifetime purchase, no ads/subscription. Test actual Play-installed purchase, cancellation and restore. Standalone guards prohibit fake paid unlocks.
4. Resolve or explicitly qualify the16KB microphone result; complete app access, target audience, content rating, ads and Data safety declarations from actual behavior.
5. Submit after those gates are verified. Jared already authorized review/release; do not repeatedly request generic release permission or fabricate identity evidence.
