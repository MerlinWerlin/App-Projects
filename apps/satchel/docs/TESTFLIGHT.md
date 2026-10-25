# Satchel to TestFlight: what's ready, what's left

Owner brief, 25 Oct 2026: ship Satchel straight to TestFlight instead of testing in Expo Go first. This page lists what the build run has already prepared and the exact steps still to do, in order. Nothing here creates store records, submits or costs money.

## Ready now (build run, commit in ops/RUNLOG.md run 17)

- `app.json`: name Satchel, bundle id / package `com.jared797.satchel`, Expo owner `jared797`, version 0.1.0, update channel `production`, runtime version follows the app version, `ITSAppUsesNonExemptEncryption` false (no export-compliance question per build).
- Purpose strings for every iOS permission the linked modules can touch: location (when in use only, never background), photo library, camera (added this run: expo-image-picker links camera code, and an upload without a camera purpose string is rejected by App Store Connect), Face ID, contacts.
- Privacy manifest (`ios.privacyManifests`): no tracking, no collected data, and the standard required-reason API entries React Native apps need (user defaults, file timestamps, boot time, disk space).
- `eas.json`: `production` (store build, build number auto-increments on EAS) and `production-native`; `submit.production.ios` is in place and only needs the App Store Connect id.
- `ops/onboarding/RELEASE.draft.json`: the values auto-ship needs for App-Projects (`ascAppId` is `null` until step 1 is done). `ops/onboarding/marketing-entry.draft.json`: the `marketing/apps.json` entry.
- Tests (`src/release.test.ts`) fail if any of the above goes missing.
- Not needed for TestFlight but needed before App Store submission: Satchel Plus purchase (T16), screenshots, iPad decision, final name (docs/RELEASE_CHECKLIST.md).

## Your one step (only you can do this)

1. **Create the app in App Store Connect** (no cost beyond the Apple Developer membership you already have):
   - developer.apple.com > Certificates, Identifiers & Profiles > Identifiers: check `com.jared797.satchel` is listed; if not, "+" > App IDs > App, description Satchel, explicit bundle id `com.jared797.satchel`, tick In-App Purchase.
   - appstoreconnect.apple.com > Apps > "+" > New App: iOS, name (Satchel is a working title; the name must be unique on the App Store, you can change it until the first review), primary language English (Australia), bundle id `com.jared797.satchel`, SKU `satchel`, full access.
   - App Information > General > **Apple ID** (a 10-digit number). Send that number to Claude (any App Factory chat or a comment on the Satchel Build page).

## Then automatic (build run + auto-ship)

2. The build run puts the number in `ops/onboarding/RELEASE.draft.json` and `eas.json` (`submit.production.ios.ascAppId`), runs the tests and publishes.
3. App Factory auto-ship onboards Satchel into App-Projects (folder `apps/travel`, the overseer's name for it, or `apps/satchel`, whichever the onboarding picks; the same layout as Backspin and Cue), adds RELEASE.json with the id, adds the `marketing/apps.json` entry, and lets `check.yml` install, align Expo 58 versions (`expo install --fix`), typecheck, test and bundle.
4. The first iOS build. Expo's free cloud iOS builds are used up until 1 Nov 2026, so before then it goes through `ship-mac.yml` (local build on a free GitHub macOS runner, Expo-held signing, then `eas submit`). The first build creates the EAS project (`extra.eas.projectId` and `updates.url` get filled in then) and the signing certificate and profile on Expo's side.
5. App Store Connect processes the build (usually 10-30 minutes; you get an email). TestFlight > Internal Testing > add yourself > install TestFlight on your iPhone and open Satchel.

## Expo Go preview link (optional, before TestFlight)

A preview link like Rowlight's needs Satchel inside App-Projects (a `preview.yml` run publishes an EAS Update and posts a QR link), so it becomes possible at step 3, not before. Until then the trial kit on the Satchel Build page (START_TRIAL.cmd on your PC) is the way to see it in Expo Go.

## Known risks for the first build

- Versions: the build runs cannot reach npm, so the exact Expo 58 versions are aligned by `expo install --fix` in `check.yml` (or task T34 on your PC). The first check may change a few version numbers; that is expected.
- `react-native-maps` uses Apple Maps on iPhone (no key needed). Android builds wait for decision B in docs/RELEASE_CHECKLIST.md.
- Nothing has been tried on a real phone yet. TestFlight is the first real-device run, so treat the first build as the trial: docs/TRIAL.md questions still apply.
