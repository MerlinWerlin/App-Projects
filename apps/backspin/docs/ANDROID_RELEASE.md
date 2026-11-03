# Backspin Android release — 3 November 2026

Jared authorized Android simulation and Google Play review/release for **Backspin**. This checkout, `Apps/backspin-google-play-release` on `codex/backspin-google-play-release-20261103`, is the live Android release preparation. It starts from current App-Projects main and brings over only Backspin's Android support from PR106. Desktop/Apps/backspin remains a refreshed test copy.

## Current evidence

- 33 Node tests and TypeScript pass locally.
- Native AAC-to-PCM module and separate Android profiles retained from PR106. The current source is being built and tested in [run 41612177418](https://github.com/MerlinWerlin/App-Projects/actions/runs/41612177418).
- New emulator flow exercises onboarding, the microphone prompt, actual recording/decoding, reverse playback, copy recording, score, save, Android share sheet, free-go accounting and persistence after process restart. A synthetic host microphone supplies the sound. A test script's presence is not a passing test result; read the run receipt.
- Preview package: `com.jared797.backspin.playtest`, embedded JS, OTA disabled, generated test signing key. **Do not upload the preview APK to Play.**
- Intended store package: `com.jared797.backspin`, AAB via `play-production`. A production signing key and signed store bundle are not yet established by this checkout.
- Original iOS release profile and RELEASE.json are unchanged. No Apple resubmission is part of this work.

## Confirmed submission blocker

The signed-in Astro Labs AU organization account at Play Console still shows identity, organization website and phone verification as **Action required**. Create app is disabled. A screenshot is retained locally at `apps/backspin/.expo/play-console-account-gates.png`; it contains account information and is not committed.

No Backspin Google Play app, purchase product, review submission or public release is claimed. Complete Google's account gates before creating the app. The registration payment does not establish verification approval.

## Remaining release evidence

1. Finish account verification and create Backspin with the stable production package.
2. Establish durable protected upload signing, produce the production AAB, and verify its final manifest, SDK level, native alignment and embedded assets. Keep keys and passwords outside Git and public artifacts.
3. Configure the one-time Backspin Plus product (`com.jared797.backspin.plus`) at the authorized A$1.99 tier, then test actual Play Billing purchase/cancellation/restore using a Play-installed build. Native store guards prohibit a simulated paid unlock in a standalone build.
4. Use the actual final build's phone screenshots; prepare the 512px icon and 1024×500 feature graphic, full listing, app access, content rating, ads, target audience and Data safety declarations from the final binary/SDK behavior. Do not copy Apple's declarations without checking Android's embedded-only build.
5. Submit only after the main gameplay run and these store gates are verified. Human voice quality, physical microphone/audio routes and interruptions, and a 16 KB runtime remain separate from the API35 synthetic-microphone emulator result.

The user has no Android phone or paid testers. Do not invent device or billing success, or purchase tester services. Organization-account eligibility is visible; no personal-account testing rule is assumed.
