# Google Play release preparation

## Current Linework checkpoint, 4 November 2026

The Android camera-session repair is now **native verified**. Signed version6 from source4d48e7b/build41709948524 is 68,938,669bytes, SHA256 `d9043d7a1ac1abc00045ba19e312b524dd648756aa2d0f52ae9626c761ddec1c`. Local keytool independently matches the dedicated upload certificate; package `com.jared797.linework`, target36, 52 native ELF libraries and production/OTA-off configuration pass. The actual manifest excludes microphone, overlay and modern broad media reads; legacy storage is limited to maxSDK32. No Google upload occurred.

| Exact version6 test | Guest | Result | New native MP4 |
|---|---|---|---|
| 41709948524 parent | API35 /4096-byte pages | All9 checks PASS | 577,270bytes /5.716seconds |
| 41712907067 | API36 /4096-byte pages | All9 checks PASS | 533,605bytes /4.300seconds |
| 41712914951 | API36 /16384-byte pages | All9 checks PASS | 555,187bytes /4.708seconds |

These runs exercise actual onboarding, camera-denial/Lightbox fallback, template lock/unlock/reset/exit, onboarding and exact14day local-trial persistence, real virtual-camera recording/Stop, Saved to Photos and one new nonempty MediaStore video. Both API36 ready/saved screenshots were visually reviewed. The binary source is4d48e7b; reusable API36 harness is4d5072a, separate receipts. Evidence is `apk-output/linework-production-v6-20261104/` and `linework-v6-{parent,4kb,16kb}-qa-20261104/`.

**Duration-display correction pending:** screenshot review found the app reports10/11seconds for native4.300/4.708second clips because Android video preparation was counted. The passing recording/save evidence remains valid; version6 is retained as superseded for final release. Immutable affected-result receipt: `apk-output/LINEWORK_DURATION_DISPLAY_ISSUE_20261104.json`. Source66fb6a0 starts Android's clip clock immediately before native capture, preserving the Apple start path. Fourteen state-machine tests and TypeScript pass. Duration-only build [41714298917](https://github.com/MerlinWerlin/App-Projects/actions/runs/41714298917) was cancelled as superseded before completion, not counted as PASS. The replacement also removes the unused SDK described below. Its integration test additionally compares displayed length with the new MediaStore video's duration within two seconds; camera preparation cannot satisfy that check. Full suite's first attempt passes816/817, failing the unchanged one-second catalogue-import timing threshold (2163ms); the isolated same test passes482ms. All817 tests PASS with two workers (143.4seconds; catalogue510ms); the first failure is retained and the threshold/catalogue code are unchanged.

**Retained earlier candidates and failures:** version1/run41620740958/source6ffa5e3 (68,941,134bytes/SHA7572bebc) passes static checks and eight older UI checks, but uses SDK57's root media-library function that deliberately throws. Cue repair f572a10 is credited; Linework b9119db switches to `/legacy`, preserving write-only access. Its source-bound receipt is `LINEWORK_MEDIA_SAVE_ISSUE_20261104.json`; that root error was not reproduced through Linework UI. Version3/run41698988030/sourceb9119db (68,938,624bytes/SHA7532cb36) includes the media fix. Its parent image ZIP extraction failed before emulator start; API35/4KB reuse41702292922 loses ADB during media restart, not an app recording result. API36/16KB41702299205 passes eight core checks then stays at camera-starting after one bounded retry. Source200c019 requests Android video mode first and still requires native readiness before capture; version6 above confirms this repair. Old freezes/artifacts/failures stay intact.

API35/16KB earlier failures were a guest-memory kill, then a PackageManager/system-server ClassCastException/reboot with4GB; they are not app page-size failures or passes. Current qualification uses API36 regular/16KB images with4GB, actual guest API/page receipts, supported SwiftShader/no-Vulkan/two-core setup, fresh continuous-screen UIAutomator2 hierarchies and full runtime native logs. Camera controls are woken before observation/tap. One warm-up retry is permitted only after the explicit camera-starting message. Clip timing waits for the recording notice; no fake unlock/save is used.

**Remaining release gates:** real Play Billing licence-test purchase/pending/cancel/acknowledge/restore, physical-camera/photo-import verification and final SDK/Data safety/listing review. Google identity/phone verification remains with Lane2; current approval is not asserted here. A signed bundle ready for Play testing is not a production approval. Main remains release authority; PR106 is a draft and has merge conflicts, so its seven-app preparation must not be blindly merged. A fresh main comparison on4Nov found only Linework SHIP_BASE bookkeeping changes, no missed Linework runtime patch. No paid EAS build, new upload key or Apple release action.

### Unused Android barcode SDK exclusion

The actual version6 bundle includes ML Kit's initializer and barcode native library although Linework has no barcode feature. Its API36/16KB full runtime log shows Linework PID2804 making a request to firebaselogging.googleapis.com and receiving200; launch/process receipts bind that PID to the app. The request payload was not captured and image transmission is not asserted. Immutable source/evidence record: `apk-output/LINEWORK_UNUSED_BARCODE_SDK_ISSUE_20261104.json`. [Google's ML Kit disclosure](https://developers.google.com/ml-kit/android-data-disclosure) documents diagnostic/usage data handling by that SDK.

The Android-only overlay now sets Expo Camera's supported barcodeScannerEnabled=false. The base/iOS plugin configuration is unchanged. All38 configuration/version checks PASS. The signed workflow saves the resolved release runtime dependency graph; its verifier now requires absent ML Kit runtime dependencies, absent ML Kit initializer and absent barhopper native libraries. This is a concrete packaging gate; source configuration alone does not prove the removal. No store no-data declaration or live privacy publication has been made.

### Source-build correction after the static rejection

Run41715649830/source8472cd9 built signed version10 (68,938,698bytes/SHA256 `956d1143b85272d44d57cd4331e621f1b9eddaadcaa07bfe78da4c9f9365b517`) but the actual-bundle verifier **FAILS** because the ML Kit initializer remains. No native integration tests ran. The config flag was false and local Expo introspection produces the correct false Gradle property. The first removal configuration omitted source-building: the resolver chose Expo Camera's default-option precompiled AAR, whose runtime dependency graph still contains the barcode SDK. This is documented Expo behavior, not a new upstream bug. Evidence and failure log remain under `apk-output/linework-production-v10-20261104/`, `linework-v10-static-qa-20261104/` and `LINEWORK_PRECOMPILED_CAMERA_ISSUE_20261104.json`.

Source4828362 uses the supported package.json Android-only autolinking buildFromSource selection for expo-camera; other modules and Apple configuration stay as before. A Play-only manifest merger directive removes the camera library's unconditional barcode model-download hint. Local actual Expo introspection confirms the false native flag and remove directive; the actual autolinking resolver confirms the camera source selection. All38 configuration checks and Python/workflow syntax checks pass. The resolved release runtime graph is now verified **before** expensive native compilation, requiring the camera source project and no barcode runtime dependencies. Final AAB checks separately require no initializer, barcode native libraries or download hint.

[Replacement signed run41720065293](https://github.com/MerlinWerlin/App-Projects/actions/runs/41720065293), source4828362, is running and remains unqualified until static and native gates pass. Its current harness also imports one owned PNG through the real Android system picker, generates an outline and opens camera tracing. That added native import path is not counted as passed yet. No new upload key, store upload, declaration or Apple release action occurred. [Expo's precompiled-module guidance](https://docs.expo.dev/guides/prebuilt-expo-modules/) explains why native dependency flags require a source build.

### Privacy draft reconciliation, 4 November

Both existing privacy HTML copies now distinguish Android embedded-only updates from iOS Expo updates, disclose OS-managed backup/device transfers permitted by the actual Android manifest, and avoid promising that uninstall deletes separately saved Photos or system backups. Legal operator and Astro Labs AU public developer name are stated. These are **draft branch edits**, not a live-policy publication or a completed Data safety form. The app binary is unchanged by this documentation edit.

The actual manifest has allowBackup=true. Android documents default backup eligibility and user-controlled backup conditions ([Android Auto Backup](https://developer.android.com/identity/data/autobackup)). Google requires declarations to include SDK handling and says exclusively internal-test apps are exempt from the Data safety section ([Play Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469)). Final declarations still need actual SDK/store behavior review; a broad no-data declaration was not submitted. Public policy fetch via the research browser failed, so live publication is not inferred from these local files.

## Linework signed-bundle continuation, 3 November 2026

Jared authorised emulator repair and production bundle preparation while Lane 2 handles Google account verification. Stay in `android-prep` / PR106; no duplicate account or Apple submission work.

The supported `swiftshader` renderer, disabled Vulkan and bounded two-core guest replace deprecated `swiftshader_indirect` **for Linework only**. ADB commands now retain time/exit/stderr receipts and failed runs retain emulator/host health. Renderer diagnostic run41619201961 had zero ADB failures and a live guest but exposed a test race: `am start -W` returns before the JavaScript Home route finishes initialising. Waiting for the visible Home screen before the Plus link fixes that race without weakening the trial assertion. [Run41620097638](https://github.com/MerlinWerlin/App-Projects/actions/runs/41620097638) **PASS**: eight feature checks, 96 ADB commands / zero failures, exact14day status before and after force-stop/relaunch, both screenshots visually inspected. It reuses original APK41614075351/SHA0a83d69b; this is not yet the new production binary. Receipt: `apk-output/linework-20261103-emulator-fix-validation.json`. Earlier failures remain retained.

A dedicated RSA3072 upload key now exists outside Git under the owner's private Windows credentials folder, with owner/SYSTEM-only NTFS access and a DPAPI-encrypted password. Its CI copy is encrypted in the `linework-play-signing` GitHub environment, restricted to branch `codex/google-play-prep`; existing Apple/Expo secrets remain untouched. Public certificate SHA256: `C14D6F9FBC94F241C9AE0703C5453787EE879438A24F673315705EE4B60F0797`. Public certificate/metadata are under ignored `apk-output/linework-upload-certificate.pem` and `linework-production-signing-public.json`; no private key or password is committed, logged or included in artifacts. This is an upload key, not a Google-managed app-signing key, and Google has not registered it yet. Preserve this key for later uploads; future version codes must increase from this first candidate's1.

The production workflow builds Gradle `bundleRelease` with explicit upload signing, validates with checksum-pinned official bundletool1.18.3, verifies the actual signer/package/target/permissions/nativeELF alignment, derives a signed universal APK and tests that APK on the disposable emulator. No EAS quota/payment or store submission is used. It supports `artifactRun` to retest the exact existing signed candidate without recompilation; original source and new harness revisions remain separate receipts. Run41619719115 was cancelled as superseded before completion so the final candidate includes Google Play purchase wording and local-trial error copy. [Replacement41620740958](https://github.com/MerlinWerlin/App-Projects/actions/runs/41620740958), source6ffa5e3, is pending and must not be counted as a pass.

The Android-only overlay now blocks modern broad audio/image/video/selected-media reads and system overlays; original Apple configuration is unchanged. Installed media-library code confirms write-only saving excludes modern read permissions, while photo import uses the system picker.36variant tests and current TypeScript pass. The actual AAB manifest and production-derived APK must independently confirm these changes. Legacy storage remains bounded to older Android; real photo/timelapse, physical-device,16KB runtime and Play Billing tests plus final privacy/listing review remain release gates. A structurally valid signed AAB does not imply store approval or real purchase validation.

## Linework Android trial update, 3 November 2026

Source `6ce7e66` separates the Android 14-day evaluation from Apple's free trial product. Android starts the trial only on an explicit tap, saves its original start before granting access and does not restart an existing expired trial. This is device-local evaluation, not a reinstall-proof store-account entitlement. Android requests only the lifetime Plus product; pending, unknown or missing purchase states cannot grant permanent Plus. Existing Apple product behavior and owner prices remain unchanged.

All **815 Node tests** and TypeScript pass, including **35 targeted entitlement/billing checks**. Raw logs are `apk-output/linework-20261103-trial-full-suite.txt`, `linework-play-billing-20261103.txt` and `linework-play-typecheck-final-20261103.txt`. Native build/emulator run [41614075351](https://github.com/MerlinWerlin/App-Projects/actions/runs/41614075351) tests this runtime change and trial persistence; its result must be inspected before claiming native success.

Fresh signed-in checks confirm the website is **already verified** in Search Console and associated with Astro Labs AU. Play now shows identity-document approval and subsequent phone verification as the account requirements; Create app remains disabled. Lane 2 is independently searching original registration email/documents, so this checkout does not duplicate that account process. Current identity is the sole trader JARED JAMES BRADLEY, not the cancelled historical business-name registration.

Real Play purchase, pending-payment, cancellation, acknowledgement and restore tests remain blocked on an app/product record. Production upload signing and AAB also remain outstanding: the generated test key must not become the upload identity. The existing `play-production` EAS profile is configuration only; no paid EAS build or store upload has been performed. See [Android signing requirements](https://developer.android.com/studio/publish/app-signing).

Production JavaScript/Hermes export **PASS** on Linux [41616007639](https://github.com/MerlinWerlin/App-Projects/actions/runs/41616007639), source `126a203`. Verified production package `com.jared797.linework`, OTA disabled, 83 metadata references and 87 downloaded files hashed. Hermes bundle is 13,416,277 bytes; this is not installed-app size or a signed AAB. Evidence: `apk-output/linework-production-export-validation-20261103.json`. The initial Windows attempt was interrupted after a host shell failure; bounded-worker retry failed inside Windows `hermesc.exe` with exit3765269347. Both raw logs are retained; the Linux pass does not erase them or establish their root cause. The isolated export workflow uses no signing secrets or paid EAS builds. Android store-specific copy, photo/timelapse and 16KB runtime QA still require review.

Fresh APK build `41614075351` compiled source `6ce7e66`: 101,509,839 bytes, SHA256 `0a83d69bb3caeefaaed5d73f75a6e081cf2d39fc235f9e65106b77468ccb3fce`. Signature, embedded bundle, target36 and 52 native-library alignment checks passed; local hash matches. Its emulator run installed/opened the app and passed six prior feature checks, then **failed** to locate the trial status because one upward swipe left that line off-screen. Failure screenshot/XML/JSON and logs remain in `apk-output/linework-20261103-trial-functional/` and `linework-20261103-trial-native-failure.txt`. Harness `3f9090d` now scrolls upward until the same exact 14-day status is visible; [retest41617431535](https://github.com/MerlinWerlin/App-Projects/actions/runs/41617431535) reuses this exact APK. Do not count its trial/persistence check as passed until the retest completes.

The fresh binary still declares `READ_MEDIA_AUDIO`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, selected-media access and `SYSTEM_ALERT_WINDOW`, plus legacy storage permissions. Photo import uses the system picker and saving uses the media-library adapter; final least-permission/SDK/Data safety review remains an explicit release blocker. This evidence does not justify a “no permissions/data collection” declaration or a store upload.

Native continuation results: `41617431535` visibly reached **Free trial: 14 days left** (saved screenshot/XML) but failed with `adb: device offline` at the post-restart check. `41618154747` installed/launched the same APK but exited255 while dumping initial logcat, before functional tests; no functional PASS or JSON exists for that attempt. Emulator37.2.13.0 is recorded; one earlier log contains `bad color buffer handle153`, but no root cause is established. Retries stopped with both failures retained under `apk-output/linework-20261103-trial-retest-functional/` and `linework-20261103-trial-final-functional/` and their native-failure logs. Trial **start** is native-observed; trial **persistence** is not verified. Restartable prerequisite: obtain stable API35 emulator/ADB execution with command stderr/exit diagnostics, then reuse APK41614075351 and harness703f866 to require the exact14day status before and after force-stop/relaunch, including separate screenshots. Do not rebuild the app or relax the assertion to conceal this blocker. No paid build, production key, AAB or Play transaction was performed.

## Linework continuation, 3 November 2026

Jared selected Linework for Android simulation and Google Play release preparation. Astro Labs AU now exists as a Google Play **organisation** account, but the signed-in Console disables Create app pending identity/organisation documents, Search Console website ownership and subsequent phone verification. No app listing, store upload or production rollout was performed.

Linework validation at `43aef36`:

- All **808 Node tests pass**, run with `node --test --test-concurrency=1` across the four existing test globs. Full TypeScript check passes. Earlier failed logs are retained under ignored `apk-output/`; CRLF-sensitive assertions were corrected in three test files. The one-second catalogue-import requirement was kept and passed; no app feature or threshold was changed to make it pass.
- [Expanded Android emulator run 41611634188](https://github.com/MerlinWerlin/App-Projects/actions/runs/41611634188) **PASS**, test-harness commit `378c899`. Actual APK UI checks cover onboarding dismissal, native camera-permission denial, a Sitting Cat template in the Lightbox fallback, lock/unlock/reset/exit, onboarding dismissal after process restart and recoverable empty-Lightbox handling. Captured screenshots and XML are in `apk-output/linework-20261103-functional/`.
- This reused the exact original APK from run `40282931115`, compiled from `fd6fe4134dc6847f196d995cfb11d4f9b7532f13`, SHA256 `0123990b455d4a9cce23262c562d1d48b45f73d323c6e5b321b5f69e3bb85d92`. It is package `com.jared797.linework.playtest`, target SDK36, signed with the generated **test key**. It is not a production bundle. Compared with that source, current Linework has a type-only keyboard-event annotation, test portability corrections and run-log text; no additional runtime feature is claimed tested.
- Earlier current-day launch-only run `41610801703` passed. Run `41611554565` was accidentally dispatched after a commit failed for missing author configuration; it was cancelled rather than counted as new validation. Commit author was supplied per command, without changing global Git configuration.

**Still required:** a Google-compatible 14-day trial/lifetime-purchase implementation and real Play Billing purchase/cancel/pending/restore/acknowledgement tests; photo-picker/outline/timelapse/interruption validation; 16KB runtime testing; stable production upload signing and AAB; final permissions/SDK/Data safety audit and Android listing assets. The existing free Apple trial SKU must not be assumed to work on Google Play. Account verification and remaining binary/feature checks must pass before submission. Existing Apple submissions and pricing decisions are preserved.

Evidence index: `apk-output/linework-20261103-validation.json`.

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
| Backspin | [40282927783](https://github.com/MerlinWerlin/App-Projects/actions/runs/40282927783), 60.6 MB | [40285337978](https://github.com/MerlinWerlin/App-Projects/actions/runs/40285337978): install/launch and 2 native audio tests passed (AAC conversion/reuse, corrupt-file cleanup) |

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
| Backspin | New local Android MediaCodec module converts recorder AAC to 16-bit PCM WAV before a take reaches the reverse engine. Guard requires native module availability; Expo Go stays unavailable. Added missing lockfile; native APK and 2 decoder instrumentation tests pass | Still need a microphone-recorded gameplay round, interruptions, route changes, save/share and Play Billing. Codec instrumentation does not exercise the full recorder/UI/bridge gameplay path. |

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
