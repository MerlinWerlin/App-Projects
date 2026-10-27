# Cue release preparation — 27 October 2026

Jared confirmed Plus purchasing, the free seven-day Trial and Restore passed on TestFlight build 11. Final build 13 embeds the Australian A$2.99 display correction and compact editor toolbar; its signed upload completed on 27 October at 08:34 UTC. Store screenshot replacement and the complete review draft are being verified. Cue has not been submitted to App Review. The evidence below preserves the earlier delivery stages and their then-outstanding checks.

## Final binary delivery — build 13

[Native run 40472421364](https://github.com/MerlinWerlin/App-Projects/actions/runs/40472421364) succeeded from source `d73a8696fdce4b680946315d3c01e0418e67b141`. Apple accepted submission `c170f8b5-8e06-4e19-9477-ffcd5e118e76` at 08:34:04 UTC on 27 October. The binary embeds update `62b7d033-5d1f-453d-bd2c-e402caa3671e`, runtime 1.0.0, production channel. [Signed upload receipt](https://github.com/MerlinWerlin/App-Projects/commit/d73a8696fdce4b680946315d3c01e0418e67b141#commitcomment-206834651). Apple processing and draft attachment are verified separately; an upload receipt alone is not an App Review submission.

Apple subsequently processed build 13 (`73c4afb4-ab75-4b4e-a1c9-745765deb06e`) as Ready to Submit in TestFlight. It replaced build 12 in the App Store version 1.0 draft; save and page reload confirmed the selection. The release option remains automatic release after approval. No final Submit for Review action was taken.

Capture run 40472424782 compiled the final source but the hosted iOS test runner failed to start (Mach error -308); both simulators also spent several minutes on first-boot data migration. The job was cancelled and preserved its compiled app and logs. It produced no usable screenshots, so it is not visual evidence. Recovery run 40476615975 reuses that exact compiled app on a fresh runner, with bounded startup/capture time and separate app/workflow provenance. The driver-start allowance follows [Maestro's documented CI setting](https://docs.maestro.dev/maestro-cli/environment-variables).

[Recovery capture 40476615975](https://github.com/MerlinWerlin/App-Projects/actions/runs/40476615975) succeeded on both iPhone and iPad. All ten captures were inspected. Selected public images: iPhone prompter, editor and library (1320 x 2868); iPad prompter and editor (2064 x 2752). The compact toolbar is correct on both. The iPad library image caught the brief launch animation and was excluded; the flow now waits for animation completion for future captures. The full iPad paywall shows both purchase buttons and Restore and is used only as the purchase review image. The simulator received US StoreKit metadata and clearly labels USD $1.99; the independently read Australian price remains A$2.99. These images do not claim a completed simulator transaction. Files and provenance are in `store/native/`; the website uses the same three iPhone images. Store upload results are recorded after independent readback.

## Earlier voice/logo delivery — build9

GitHub App-Projects main is the release source. This repair reuses the chat's isolated checkout at `Apps/backspin-icon`; source PR115 and verification PR116 are merged. Jared requested a new Cue logo, a fix for the Voice Follow failure emailed to himself, and delivery through TestFlight rather than Expo Go. Cue 1.0.0 build 9 is available for internal testing. The earlier Backspin submission remains separate.

## Report and repair

The 05:49 Sydney email screenshot says `Locale en is not supported by the speech recognizer` and lists regional locales including `en-AU`. The prompter passed `getLocale()` from the English-only UI catalogue, which returned `en`. Speech now uses the saved language preference or phone locale and validates it against the native recognizer's supported locales. It preserves supported regional preferences and chooses a same-language regional fallback; unavailable languages pause with a short message instead of a full native locale dump. The resolver does not require `Intl.Locale` support in Hermes.

Terminal recognition errors remove listeners and cancel restarts, pause the prompter, and select Voice Pace without starting its microphone automatically. Silence remains recoverable. A native start event controls the Listening indicator. Navigation cancels pending permission/start work, and synchronous start/restart failures clean up. `requiresOnDeviceRecognition: true` remains requested.

The replacement logo is a brass C with an ivory reading cue, in the existing navy/brass palette. Native iOS, Android adaptive foreground, launch image and public website icon are replaced together. The iOS/web icon is opaque RGB, 1254 square; the launch/adaptive artwork has alpha, 1254 square, with the visible mark inside approximately the central 64%. Original versions remain in Git history. [ART_BRIEF.md](ART_BRIEF.md) records built-in ImageGen prompts and outputs.

## Verification

- 62 tests pass, including 21 new locale/session regressions. The native boundary test reproduces the emailed bare-`en` rejection and verifies `en-AU` is sent instead.

- TypeScript and final iOS + Android Hermes release exports pass. The new locale/session files pass focused ESLint. [GitHub check 40383482435](https://github.com/MerlinWerlin/App-Projects/actions/runs/40383482435) passed on source `a17c89d`; [PR115](https://github.com/MerlinWerlin/App-Projects/pull/115) merged as `18d2301`.

- New locale/session files have no lint errors. Full-app lint has 28 existing errors (React hook/Reanimated rules); the modified prompter has the same four rule findings as its unmodified Git version. These are not reported as a clean lint run.

- Actual phone recognition, interruption recovery and new Home Screen appearance still need an owner retest on TestFlight build 9. A Node regression test is not a physical-iPhone claim.

- The public website icon returns HTTP 200 and its SHA256 matches the new committed native icon.

- Expo cloud attempt [40383791637](https://github.com/MerlinWerlin/App-Projects/actions/runs/40383791637) was refused by the existing monthly free-build quota after reserving build 8. The existing workflow automatically dispatched [Mac build 40384042420](https://github.com/MerlinWerlin/App-Projects/actions/runs/40384042420) from the same merged source. It signed build 9, compiled successfully and [uploaded to Apple](https://github.com/MerlinWerlin/App-Projects/commit/18d2301de0024cd61e26b0c627d474bd055314dc#commitcomment-206754547). Expo submission `090c74dd-0b6c-4ff9-91eb-3ef4d086eb43` finished at 07:09 Sydney on 27 October. No paid plan or duplicate build was requested.

- [Independent Apple receipt](https://github.com/MerlinWerlin/App-Projects/commit/2d7ca51f761a84e9646b58d9414b47891bb78385#commitcomment-206782060) at 10:32 Sydney on 27 October confirms latest build **9 VALID**, **IN_BETA_TESTING**, with one internal TestFlight group having automatic build access. `store/ASC_REQUEST.json` stays in read-only status mode. Open TestFlight, select Cue, update to 1.0.0 (9), and retry Voice Follow.

## Historical build9 scope

That repair changed no purchase/trial logic, recording mode, permissions, prices or Backspin release state changed. Cue's broader App Review gates remain separate (including its existing purchase stub/automatic trial and account metadata); this repair does not establish store-release readiness.

Reference: [expo-speech-recognition API](https://github.com/jamsch/expo-speech-recognition#getSupportedLocales).

## Purchase-enabled release candidate — 27 October 2026

Jared reports build 9 looks good and requests real purchase practice through TestFlight before release. This candidate replaces the always-unlocked stub with pinned expo-iap 6.2.0, the existing A$2.99 one-time Cue Plus product, explicit free 7-day Trial purchase, Restore, and read-only entitlement refresh. Free scripts, steady scrolling and recording remain available. The old first-launch preview stamp is preserved on disk but is not treated as an Apple trial transaction.

Purchase handling waits for returned or event-delivered transactions, acknowledges non-consumables once, handles cancellation and pending approval, reconciles late transactions, and bounds unresponsive store calls. Verified ownership is cached for offline access; successful store refresh reconciles revoked ownership. Restore preserves the original trial date. The paywall has a localized store price, a retry for price loading, and Restore even when Plus is owned. A failed/ambiguous response says it could not confirm the purchase and directs the user to Restore; it does not falsely promise that Apple could not have charged a late transaction. This is a deliberate accuracy correction to the release standard's blanket failure wording.

The selected iOS speech recognizer now must support on-device recognition before audio setup. The prior dependency only conditionally set Apple's request flag; Apple's documentation says that flag is honored only when the selected recognizer supports it. A pinned, idempotent postinstall guard fails the build on unexpected dependency changes. Three Node checks cover guard insertion, ordering, idempotence and failure on changed source; native compilation remains required.

Initial purchase validation: 72 Jest tests plus 3 native-guard tests, TypeScript, focused ESLint and both Hermes exports passed. CI40463537079 and signed native run40463910097 passed; build11 uploaded to Apple on27October at07:12UTC and appeared in Team (Expo) internal TestFlight. Jared subsequently confirmed Plus purchasing worked; trial/Restore confirmation is recorded separately below.

Remaining release preparation: configure and verify Plus/trial price and availability, update listing/review notes and privacy disclosure, replace stale screenshots with current captures, publish App Privacy, attach the final candidate, and obtain the owner's device purchase/Restore results before App Review. No submission is authorized by this preparation request alone.

Sources: [Apple non-subscription trial rule](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Apple on-device speech flag](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition).

Purchase source [PR118](https://github.com/MerlinWerlin/App-Projects/pull/118) merged as `962d8b8` after [CI40463537079](https://github.com/MerlinWerlin/App-Projects/actions/runs/40463537079) passed. Existing cloud-to-free-Mac fallback started native run40463910097. Simulator capture run40463753042 is separate and does not establish physical-device or purchase success. Store setup now updates existing IAP notes/localizations, preserves existing prices and only replaces a review screenshot when explicitly requested and its checksum differs;12 offline ASC tests pass. New screenshots and the final build attachment follow their actual delivery.

Store setup [PR119](https://github.com/MerlinWerlin/App-Projects/pull/119) merged as `1a9d088` after CI40464275427 passed. [Apple readback](https://github.com/MerlinWerlin/App-Projects/commit/1a9d088f5dab733a9c4d736c2cda975eba59396a#commitcomment-206825120) confirms both products, availability for175territories, current listing and complete review contact. It also exposed two remaining setup defects: Apple returns an empty price-schedule shell, and newly required social-media age answers were omitted. The helper now checks actual manual-price records (preserving any configured schedule), and Cue explicitly answers no social-media functionality.13 ASC checks pass. App Privacy was published in the signed-in UI (read back27Oct07:00UTC): Device ID and Crash Data, App Functionality, not linked to identity and not for tracking. Main app download pricing was separately saved as A$0.00, mapped to175regions; there were no prior prices. New screenshots and final build attachment remain pending.

The price and age correction [PR120](https://github.com/MerlinWerlin/App-Projects/pull/120) merged as `3511ee0`. [Apple readback at07:08UTC](https://github.com/MerlinWerlin/App-Projects/commit/3511ee0cb51dffd26d904e66b3d51f4b007f48fd#commitcomment-206825884) confirms actual current manual prices: Plus AUS2.99, trial AUS0.00, and successful age answers. Plus is READY_TO_SUBMIT. Trial is missing only its new review screenshot. Public policy and support URLs return200 and show27October copy; the policy layout was inspected.

## Owner purchase checks — passed on build11,27October

1. Open Settings > Cue Plus. Tap Get Plus, then cancel Apple’s sheet. Plus should remain locked.

2. Start the free seven-day trial and confirm Apple’s free item. Check the trial message, Voice Pace and Voice Follow.

3. Tap Get Plus and complete the sandbox purchase. TestFlight purchases do not charge real money.

4. Tap Restore purchase, close and reopen Cue, and confirm Plus is still owned. Keep saved scripts; no reinstall is needed for this check.

5. Jared confirmed Plus, free trial and Restore passed on27October. If Apple requests a physical-device recording, include launch, the main flow and the purchase/Restore flow.

## Price correction and final preparation — 27 October 2026

Apple's configured Australian Plus price remains A$2.99, confirmed by the owner’s real TestFlight purchase sheet. There is no hard-coded 1.99 in current source. StoreKit's bare displayPrice can hide currency differences in TestFlight. The paywall now labels AUD as A$, labels other currencies explicitly, refreshes on foreground and before purchase, and requires another tap if the fetched price changed. Only a confirmed Australian storefront with conflicting foreign-currency product metadata uses the verified A$2.99 base price; foreign/unknown storefronts retain their own currency and amount. A missing product never produces a fabricated price. The Australian override must change alongside store/listing.json if the base price changes.

The original native screenshot job failed after successful native compilation and launch because Maestro 2.12 confines takeScreenshot paths to its configured output folder. The flow now uses relative names and --test-output-dir. Current capture delivery and final build attachment are pending verification; no App Review submission has occurred.

Price correction [PR121](https://github.com/MerlinWerlin/App-Projects/pull/121) merged as `91cbaa3`. [CI40469270896](https://github.com/MerlinWerlin/App-Projects/actions/runs/40469270896) passed 75 Jest and3 native checks, TypeScript and both mobile exports. The production OTA is run40469499588. Final native run40469506739 uses the free Mac workflow directly because the existing Expo free cloud quota is exhausted; capture run40469502815 uses the same source. These runs are not delivery claims until their results and Apple state are verified.

Owner confirmation,27October: Jared answered “Yes, both passed” for the free7-dayTrial and Restore, following his explicit Plus purchase success. These device purchase gates are satisfied on build11. App Store Connect's current pricing table was inspected directly: Australia(AUD)$2.99 and United States(USD)$1.99. This supports, but does not independently prove on-device, the TestFlight currency-mismatch diagnosis. No foreign price was increased. The final release build embeds only the tested display/refresh correction on top of build11’s native modules.

Production OTA [40469499588](https://github.com/MerlinWerlin/App-Projects/actions/runs/40469499588) published successfully at27Oct07:51:56UTC, runtime1.0.0, production branch, update group `033d8820-b6b8-416c-84fa-ef947ea16e29` (iOS update `01a17c58-2d06-78cd-9b03-73ea6580c6f3`). This confirms publication, not that a particular phone downloaded it. App Privacy was independently reread as published with DeviceID and CrashData for AppFunctionality, not linked to identity.


Visual QA of actual iPhone captures from40469502815 exposed an existing editor layout defect: the horizontal formatting toolbar expanded into half the editor height. Its ScrollView now opts out of vertical flex expansion/shrink; the text editor keeps the remaining space. Capture run40471982167 was cancelled before completing to capture the corrected app instead. Build12 uploaded and was temporarily attached, but the final embedded candidate will include this layout correction. This does not change purchase logic or invalidate the owner purchase tests.


Build12 [native run40469506739](https://github.com/MerlinWerlin/App-Projects/actions/runs/40469506739) uploaded successfully at08:10:19UTC (submission8203757b-fd0e-4a09-a495-20ed3c64b35a). Apple processed it and allowed selection in the1.0draft; build ID4f3ba3f6-c32f-4d2d-9865-27d25dd55691. Its included brass C icon was visually verified. It is a temporary draft attachment pending the final toolbar-corrected binary.

Capture recovery [PR122](https://github.com/MerlinWerlin/App-Projects/pull/122), merge2235a6a, switches Plus capture to the actual Settings route, preserves the simulator app and continues both device captures even if one fails. Its CI40471908068 passed. A mistaken queued dispatch40471934676 against the earlier source was promptly cancelled; it is not capture evidence. The replacement40471982167 was cancelled after the visual toolbar defect was found, to avoid publishing obsolete screens.

Toolbar fix [PR123](https://github.com/MerlinWerlin/App-Projects/pull/123), merged asd73a869, passed local TypeScript. Final native40472421364 and captures40472424782 use this source; production OTA40472418608 carries the same display/layout fixes. Purchase behavior and native dependencies are unchanged from the tested candidate.


Account readiness was independently read in App Store Connect on27October: Free Apps and Paid Apps agreements Active; bank account Active; Australian registration and US tax forms Active. No account details or private contact fields are copied into this repository. EU Digital Services Act compliance remains InReview at Apple (last updated23October); this is an account verification state, separate from Cue App Review.

[PR123 CI40472334313](https://github.com/MerlinWerlin/App-Projects/actions/runs/40472334313) passed all78checks, TypeScript and both mobile exports. [Production OTA40472418608](https://github.com/MerlinWerlin/App-Projects/actions/runs/40472418608) published at08:18:44UTC. Update group5577f501-ea23-4839-8aeb-b554cc226461, iOS01a17c70-b6b0-7568-856b-e23c2012c202, runtime1.0.0. Independent Expo channel readback at08:22UTC confirms active production routing and this exact update/message.


Cue App Information was read directly:4+ global age rating with regional equivalents, and “This developer has identified itself as a trader for this app.” The account’s pending DSA verification is already submitted to Apple; no new owner form was displayed. Production code does not use non-exempt encryption (the build’s Info.plist declaration remains false).
