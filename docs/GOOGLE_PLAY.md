# Google Play release preparation

Updated 26 October 2026 in `codex/google-play-prep`, based on main `5a6185f`, draft PR #106. This is the Android implementation and release reference; the master roadmap remains the only work queue. Existing iOS upgrades remain on main. Standalone test APKs now exist. No Play application, production credentials, price, purchase product or store release was created.

**Rowlight APK delivered:** local file `apk-output/rowlight/crochet-play-test.apk`, 79,002,357 bytes, package `com.jared797.rowlight.playtest`, version 0.1.0. [Native build 40281240062](https://github.com/MerlinWerlin/App-Projects/actions/runs/40281240062) produced it from `5584b2589549ba8853a7e82c3cbbd1378629ac5f`. SHA-256: `facba8ed50ef9284484f45b4c634aabbfdfe9cd5d5c663dc2e757ed80643e733`. [Emulator run 40284137704](https://github.com/MerlinWerlin/App-Projects/actions/runs/40284137704) installed this same APK, opened it, created Little Sprout, incremented to row 3, force-stopped the process, reopened it and verified row 3 persisted. Screenshot/XML and receipt are in `apk-output/rowlight-tested/`. Real-phone, TalkBack, import/share and Play Billing tests remain outstanding.

## Separate Android variants

Each app retains its source and existing iOS profiles. Its self-contained `ops/play-variant.cjs` overlays configuration only when `PLAY_VARIANT` is explicit:

| Profile | Output | Identity | Distribution |
|---|---|---|---|
| `play-preview` | APK | Existing Android package + `.playtest`, name ends `Play Test` | Installable test build, separate app data |
| `play-production` | AAB | Existing Android package, unchanged | Candidate bundle for later Play testing |

Channels are `play-preview` / `play-production`; runtime ends `-play-v1`. Initial Play builds disable OTA updates and use embedded code until the Android update path is tested. EAS environments are explicit. Existing Expo project IDs, signing identities, iOS profiles and RELEASE.json files are untouched. A preview cannot overwrite a future production install; its data is separate. Production here describes the packaging format, **not release readiness**. There is no Play submit profile or automatic upload. No duplicate public app listings are proposed.

From an app folder, after normal dependency installation:

```text
npx eas-cli build --platform android --profile play-preview
npx eas-cli build --platform android --profile play-production
```

These commands require account/credentials and may consume build quota; they were not run in this preparation. EAS can generate a keystore during authorised setup. Keep the final package name stable once the first artifact is registered. First Play upload must be performed manually before EAS Submit can use the Play API. Never commit keystores or service-account credentials.

### Standalone test APK builds

The manual GitHub workflow `Android test APK` uses Node 24, JDK 17, Expo prebuild and Gradle `assembleRelease` for arm64 phones and x86_64 emulators. JavaScript/assets are embedded and OTA is disabled: no Metro/Expo Go connection is required. It uses Expo's generated **test key**, not a Google Play upload key. These APKs are for sideloading, not store submission. EAS builds signed with a different key cannot upgrade these test installs; agree the durable test/upload signing setup before collecting real user data.

```text
gh workflow run play-apk.yml --ref codex/google-play-prep -f app=crochet -f smoke=true
gh run download <build-run-id> -n crochet-play-test-apk -D apk-output/rowlight
```

The workflow saves package/SDK metadata, certificate verification, embedded-bundle checks, every native ELF's 16 KB load alignment, ZIP alignment and SHA-256. `artifactRun` can reuse the exact verified APK for emulator testing without rebuilding. The emulator tests API 35 with ordinary pages; it does not establish 16 KB runtime behavior. Initial native jobs failed only after uploading their verified APKs because of test-runner SDK/AVD setup; successful follow-up evidence is tracked separately. Native build and test scripts never submit a store release.

| App | Verified native APK build | API 35 emulator evidence |
|---|---|---|
| Rowlight | [40281240062](https://github.com/MerlinWerlin/App-Projects/actions/runs/40281240062), 79.0 MB | [40284137704](https://github.com/MerlinWerlin/App-Projects/actions/runs/40284137704): install, launch and counter persistence passed |
| Glaze | [40281924740](https://github.com/MerlinWerlin/App-Projects/actions/runs/40281924740), 86.4 MB | [40285042679](https://github.com/MerlinWerlin/App-Projects/actions/runs/40285042679): install/launch passed; earlier process check failed without a captured log, not reproduced in this run |
| Couch | [40282081928](https://github.com/MerlinWerlin/App-Projects/actions/runs/40282081928), 67.4 MB | [40285046214](https://github.com/MerlinWerlin/App-Projects/actions/runs/40285046214): install/launch passed; demo remote only |
| Cue | [40282085577](https://github.com/MerlinWerlin/App-Projects/actions/runs/40282085577), 72.7 MB | [40284505390](https://github.com/MerlinWerlin/App-Projects/actions/runs/40284505390): install/launch passed |
| Satchel | [40282088782](https://github.com/MerlinWerlin/App-Projects/actions/runs/40282088782), 58.7 MB | [40284508906](https://github.com/MerlinWerlin/App-Projects/actions/runs/40284508906): install/launch passed |
| Linework | [40282931115](https://github.com/MerlinWerlin/App-Projects/actions/runs/40282931115), 101.5 MB | [40284611021](https://github.com/MerlinWerlin/App-Projects/actions/runs/40284611021): install/launch passed |
| Backspin | [40282927783](https://github.com/MerlinWerlin/App-Projects/actions/runs/40282927783), 60.6 MB | Installed/opened in 40284896130; animated screen prevented XML capture. Native audio test [40285337978](https://github.com/MerlinWerlin/App-Projects/actions/runs/40285337978) pending |

All seven local APK hashes match their build receipts. Each targets API 36 and contains arm64-v8a plus x86_64 binaries; APKs and evidence live in ignored `apk-output/`. Open `apk-output/README.md` for direct local download links. Existing source dependency declarations, original iOS build profiles and RELEASE.json files remain unchanged. Backspin's new Android module also passes an iOS bundle-export regression check. These APKs do not include later changes from a different source commit; the receipt identifies each exact build.

## Platform scope and actual blockers

| App | Android-specific preparation | Evidence still needed before Play testing/release |
|---|---|---|
| Rowlight (`crochet`) | First validation candidate: counters, pasted patterns, photos, tools and backup; separate APK/AAB configs | PDF reading still falls back to another app; in-app PDF ruler is not available. Plus adapter is a development mock. No paid listing until billing exists. Validate process-death persistence, TalkBack, back gesture and file sharing. |
| Cue | Camera/mic and on-device speech hooks already exist; separate build path | Voice Follow must work with downloaded on-device recognition or show a truthful fallback. Test video/audio interruptions, save permissions and Play Billing. |
| Linework | Clean-install blocker fixed: lockfile now includes the already-declared expo-iap dependency. Keyboard event types corrected; 25 focused checks and full typecheck pass | Current free-trial SKU was designed for Apple's non-consumable rules; do not copy that flow to Play unchanged. Verify billing/trial policy, image picking, outlines, timelapse and denial recovery. Full suite initially 802/808; one Windows newline test fixed, other catalogue/listing/stroke/performance failures remain outside this Android change. |
| Couch | Android LAN, media server and IR native modules compile in test APK | Test discovery, pairing, reconnect, cleartext LAN and casting on actual TVs. IR only on supported phones. Apple route picker is not Android Cast. |
| Glaze | Native module compiles; Android install UI excludes Safari/profiles; system pickers avoid broad access prompts; targeted Android destinations replace unsupported iPhone shortcuts; modern broad media/microphone/overlay permissions absent in APK | Verify wallpaper pause/resume, reboot, cropping and launcher confirmations. Expand tested destination catalogue. No promise of bulk profile install, WidgetKit or Live Photos on Android. Play Billing remains separate from StoreKit. |
| Satchel | Existing trip/files/location sources get isolated profiles | Android document viewer, biometric vault, backups and offline map availability require verification. Do not advertise iCloud sync or unbuilt offline maps. |
| Backspin | New local Android MediaCodec module converts recorder AAC to 16-bit PCM WAV before a take reaches the reverse engine. Guard requires native module availability; Expo Go stays unavailable. Added missing lockfile; native APK compiles | AAC/corrupt-file emulator instrumentation pending. Still need a microphone-recorded gameplay round, interruptions, route changes, save/share and Play Billing. Implementation alone does not close the gameplay gate. |

`apps/<app>/store/play-listing.json` holds English drafts, exclusions and source-grounded blockers. These are not uploaded metadata. Screenshots must come from the actual Android build; iPhone frames and mock previews cannot prove Android support. Names and prices retain their existing owner decisions; no new pricing has been set.

## Store requirements checked on 26 October 2026

- New phone/tablet submissions must target API 36 or higher. Expo SDK 57 documents compile/target 36, but inspect the **generated manifest and final AAB**, including native dependencies. See [Google target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878) and [Expo SDK table](https://docs.expo.dev/versions/v58.0.0/).
- Native libraries must support 16 KB pages. Validate the final libraries/bundle and run on a 16 KB emulator/device; a successful JavaScript export proves none of this. [Android guidance](https://developer.android.com/guide/practices/page-sizes).
- Audit merged permissions and SDK behaviour before completing Data safety. Prefer system photo pickers where sufficient; do not copy Apple's privacy declarations. Explicit share/export actions, LAN requests, speech providers, updates and purchase SDKs need their actual behaviour checked. [Google permissions guidance](https://support.google.com/googleplay/android-developer/answer/16935362).
- Create/verify the developer account, app record, Play App Signing and upload key; finish privacy-policy URL, support contact, content rating, target audience, ads/app-access declarations and listing assets. Use billing test accounts for purchase, pending payment, cancellation, acknowledgement, reinstall and restore before offering paid extras.
- If the account is a personal developer account created after 13 November 2023, production access requires a closed test with at least 12 opted-in testers continuously for 14 days, followed by an application for access. Account type/date have not been checked. [Google testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465).
- [Expo variants](https://docs.expo.dev/build-reference/variants/) and [Android submission prerequisites](https://docs.expo.dev/submit/android/) describe the separate IDs and first manual upload.

## Verification scope

Run `node --test scripts/play/variants.test.cjs` at the repository root, then app-specific tests/typechecks, Android export and prebuild. Inspect the resulting package, permissions, native registrations and target SDK before a signed build. Current verification results are recorded in the PR and the master roadmap. No signed AAB, installed APK, device QA, Play purchase or store review is implied by configuration checks.

### Local results, 26 October 2026

| Check | Result |
|---|---|
| Seven-app configuration / listing checks | 36 passed; original EAS profile values preserved |
| Rowlight | 24 tests passed; full typecheck, Android JS export and Android prebuild passed |
| Glaze | 55 focused tests passed; full app + Node typecheck; native APK compilation and static binary checks passed |
| Generated Android identity | Both use `.playtest`; OTA disabled; React Native target/compile SDK defaults resolve to 36 |
| Glaze autolinking | Resolver finds `glaze-android` and `GlazeAndroidModule`; native module now compiled in APK |
| Backspin source | 29 tests, typecheck, Expo version check and Android prebuild/autolinking pass; native checks tracked separately |
| Linework source | Full typecheck and 25 focused keyboard/update/billing checks pass; six initial full-suite failures documented above |
| iOS/release protection | Existing app.json, package dependency declarations, original EAS profiles and RELEASE.json untouched. Added Backspin lockfile and repaired Linework lockfile; platform-specific changes and type-only fixes recorded in PR |

APK inspection confirms Glaze no longer requests microphone, broad modern media or overlay permissions. Legacy storage/camera/wake-lock entries still require review; Rowlight still includes legacy storage/overlay permissions. Review merged release manifests and actual calls before completing Data safety. The generated projects warn that the old edge-to-edge toggle is ignored on Android 16 and automatic system UI styling needs `expo-system-ui`; these remain follow-up integration work.

Validation also exposed two existing test/type issues in Glaze. Its tab icon now accepts React Native `ColorValue`, and its test helpers use a Windows-safe file URL and avoid duplicating the English dictionary. Package changes made automatically by prebuild were reverted after checking their exact scope; generated native folders stay untracked. The Windows PC has Java 8 and no configured Android SDK, so native builds and emulators run on GitHub's standard Linux runner. No paid EAS build, production credential or submission operation was performed.
