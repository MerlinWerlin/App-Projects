# Backspin Android release — 3 November 2026

Jared authorized Android simulation and Google Play review/release for **Backspin**. This checkout, `Apps/backspin-google-play-release` on `codex/backspin-google-play-release-20261103`, is the live Android release preparation. It starts from current App-Projects main and brings over only Backspin's Android support from PR106. Desktop/Apps/backspin remains a refreshed test copy.

## Current evidence

- 33 Node tests and TypeScript pass locally.
- Native AAC-to-PCM module and separate Android profiles retained from PR106. [Run 41612177418](https://github.com/MerlinWerlin/App-Projects/actions/runs/41612177418) compiled, verified, installed and launched the APK. Its first gameplay attempt rejected silent emulator input. A later harness attempt encountered a captured Pixel Launcher ANR; neither is reported as gameplay success. Host audio activation and a narrowly scoped launcher-dialog recovery are now explicit. [Run 41617261644](https://github.com/MerlinWerlin/App-Projects/actions/runs/41617261644) builds the final foreground-only, restricted-permission configuration and gates the unsigned production AAB on gameplay success.
- New emulator flow exercises onboarding, the microphone prompt, actual recording/decoding, reverse playback, copy recording, score, save, Android share sheet, free-go accounting and persistence after process restart. A synthetic host microphone supplies the sound. A test script's presence is not a passing test result; read the run receipt.
- Preview package: `com.jared797.backspin.playtest`, embedded JS, OTA disabled, generated test signing key. **Do not upload the preview APK to Play.**
- Intended store package: `com.jared797.backspin`, AAB via `play-production`. A durable RSA4096 upload key and public certificate were generated and read back successfully outside Git, with a Windows-user DPAPI password record. Certificate SHA256: `1E87EC4C603A4B12721ADD35C75D2753A37A5FC6EDC59357E226CE4F03BB3DB8`. No signed production bundle or Google key registration is claimed.
- Original iOS release profile and RELEASE.json are unchanged. No Apple resubmission is part of this work.

## 4 November continuation

The final restricted-permission APK from run41617261644 is downloaded and independently hash-verified: SHA256 `89e4f6575ee9f28f24e737b1c5bd7886414cf679e6ab5e0b09a9e8659da6bfc0`. Native build, signature, embedded bundle and static 16KB alignment passed. Run41622116518 completed original recording, AAC decoding and reversed playback but rejected the copy recording as too short. Recording screenshots show multiple elapsed seconds and transient sound; this is not a completed gameplay pass. Run41698872892 reuses the identical APK with synthetic speech instead of a constant sine, plus complete gameplay logs, to investigate possible microphone signal suppression. Production AAB remains gated on gameplay success.

Run41698872892 with synthetic speech reached scoring and saved the take. Its final assertion failed because the visible save confirmation was below the scroll viewport; the complete gameplay log records the actual `✓ Saved to Takes` node. Screenshots also exposed row sizing on the animated pressable child, which squeezed the four audio controls. Commit `af5a3b9` moves parent-row sizing to the actual pressable and scrolls to the save confirmation. All33 tests, TypeScript and a fresh iOS export pass after that repair. Fresh native build/gameplay/AAB run41700129048 tests the changed runtime; prior APK evidence cannot qualify this new source.

Commit `155a670` adds an accessible Settings link to the full platform-specific privacy policy and a separate Android policy at `docs/backspin/privacy-android.html`. The existing published iOS policy is unchanged. The Android page must be published and its URL checked before store submission. This changes runtime input, so final native run41701424210 supersedes the earlier layout-only build for release qualification. Final source checks:33app tests,5config checks,TypeScript and fresh iOS export pass. A same-APK16KB gameplay run is prepared but not yet passed.

## Confirmed submission blocker

**Website verified:** the existing portfolio website was registered and verified in Google Search Console, and Play Console independently shows **Website verified**. [Homepage verification commit](https://github.com/MerlinWerlin/App-Projects/commit/21e9e0cd0b65e5d0acb5299437eed77e25e2d600). Do not remove the verification meta tag. Screenshots are retained privately under `.expo/` and are not committed.

Identity/organization document approval remains outstanding. Google explicitly disables phone verification until the documents are approved. App creation/release remain blocked on those account gates. Source emails and document retrieval receipts are stored outside Git; no current registration certificate was recovered from the expired email download links. No government-ID upload or identity approval is claimed.

No Backspin Google Play app, purchase product, review submission or public release is claimed. Complete Google's account gates before creating the app. The registration payment does not establish verification approval.

## Remaining release evidence

1. Finish organization/identity verification, then both phone verifications, and create Backspin with the stable production package. Website verification is already complete.
2. Establish durable protected upload signing, produce the production AAB, and verify its final manifest, SDK level, native alignment and embedded assets. Keep keys and passwords outside Git and public artifacts.
3. Configure the one-time Backspin Plus product (`com.jared797.backspin.plus`) at the authorized A$1.99 tier, then test actual Play Billing purchase/cancellation/restore using a Play-installed build. Native store guards prohibit a simulated paid unlock in a standalone build.
4. Use the actual final build's phone screenshots; prepare the 512px icon and 1024×500 feature graphic, full listing, app access, content rating, ads, target audience and Data safety declarations from the final binary/SDK behavior. Do not copy Apple's declarations without checking Android's embedded-only build.
5. Submit only after the main gameplay run and these store gates are verified. Human voice quality, physical microphone/audio routes and interruptions, and a 16 KB runtime remain separate from the API35 synthetic-microphone emulator result.

The user has no Android phone or paid testers. Do not invent device or billing success, or purchase tester services. Organization-account eligibility is visible; no personal-account testing rule is assumed.
