# Backspin Android release — 4 November 2026

Jared authorized Backspin Android simulation and Google Play review/release. Live checkout: Apps/backspin-google-play-release, branch codex/backspin-google-play-release-20261103, [PR202](https://github.com/MerlinWerlin/App-Projects/pull/202). Google identity/phone gates still block app creation and submission. No Play application, billing transaction, review submission or public release is claimed.

## Verified results

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

The identical APK installed and launched on a device reporting 16384-byte pages. Run 41704766267 stopped at the microphone dialog because the test waited too briefly. Corrected run 41705876794 passed permission handling but rejected a silent original recording despite nonzero host input. No full16KB gameplay pass is claimed; the emulator route versus app behavior remains unresolved.

Diagnostic run 41710351145 stopped on an unrelated Google Search process crash. The crash checker was repaired to attribute failures to the tested app; Java/native detection checks pass. Run 41711341099 then passed both native decoder tests on the verified 16 KB device, but Android system services restarted during the copy recording. Its failure screenshot shows the launcher, and logs report DeadSystemException. Root cause remains unresolved; no complete gameplay pass is claimed.

[Run 41713732204](https://github.com/MerlinWerlin/App-Projects/actions/runs/41713732204) tests the identical APK on the official Android 16/API 36, 16 KB image. This changes the test environment, not the application. See store/play/diagnostics-16k-api35.json for the bounded API 35 result.

Human voice quality and physical phone routes/interruptions remain unverified. Jared has no Android phone or paid testers. Do not invent those results or purchase testers. Earlier failures and screenshots remain retained, including Pixel Launcher ANR/ADB loss, silent constant-tone input and an offscreen save assertion. Actual cramped audio controls were repaired and visually rechecked.

## Website and privacy

Play Console website ownership is VERIFIED through Search Console. Preserve the homepage tag from [commit21e9e0c](https://github.com/MerlinWerlin/App-Projects/commit/21e9e0cd0b65e5d0acb5299437eed77e25e2d600).

Settings opens the full platform-specific policy. The [Android privacy page](https://merlinwerlin.github.io/App-Projects/backspin/privacy-android.html) was published by [commitff7f742](https://github.com/MerlinWerlin/App-Projects/commit/ff7f742023a6b5744c439fc3a1832c3439f61d77); HTTPS200 and exact source hash verified. Existing iOS policy is unchanged. Android OTA updates are disabled; do not copy Apple's update-service disclosures without checking the Android binary/SDK behavior.

## Remaining store gates

1. Obtain organization/identity approval, then both phone verifications. Google currently disables phone verification and app creation. Original emails, expired certificate-link evidence and current public ABR record are saved privately; no original current registration PDF was recovered. A public lookup is not claimed as that certificate. No government-ID upload or approval occurred.
2. Create the app with the stable package, register the upload certificate with Play App Signing, and preserve an owner-controlled recoverable key/password backup before upload. A signed bundle alone is not Google registration or approval.
3. Configure Plus com.jared797.backspin.plus: 10 scored goes free, then authorized A$1.99 lifetime purchase, no ads/subscription. Test actual Play-installed purchase, cancellation and restore. Standalone guards prohibit fake paid unlocks.
4. Resolve or explicitly qualify the16KB microphone result; complete app access, target audience, content rating, ads and Data safety declarations from actual behavior.
5. Submit after those gates are verified. Jared already authorized review/release; do not repeatedly request generic release permission or fabricate identity evidence.
