# Cue voice and logo repair — 27 October 2026

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

## Scope

No purchase/trial logic, recording mode, permissions, prices or Backspin release state changed. Cue's broader App Review gates remain separate (including its existing purchase stub/automatic trial and account metadata); this repair does not establish store-release readiness.

Reference: [expo-speech-recognition API](https://github.com/jamsch/expo-speech-recognition#getSupportedLocales).


## Purchase-enabled release candidate — 27 October 2026

Jared reports build 9 looks good and requests real purchase practice through TestFlight before release. This candidate replaces the always-unlocked stub with pinned expo-iap 6.2.0, the existing A$2.99 one-time Cue Plus product, explicit free 7-day Trial purchase, Restore, and read-only entitlement refresh. Free scripts, steady scrolling and recording remain available. The old first-launch preview stamp is preserved on disk but is not treated as an Apple trial transaction.

Purchase handling waits for returned or event-delivered transactions, acknowledges non-consumables once, handles cancellation and pending approval, reconciles late transactions, and bounds unresponsive store calls. Verified ownership is cached for offline access; successful store refresh reconciles revoked ownership. Restore preserves the original trial date. The paywall has a localized store price, a retry for price loading, and Restore even when Plus is owned. A failed/ambiguous response says it could not confirm the purchase and directs the user to Restore; it does not falsely promise that Apple could not have charged a late transaction. This is a deliberate accuracy correction to the release standard's blanket failure wording.

The selected iOS speech recognizer now must support on-device recognition before audio setup. The prior dependency only conditionally set Apple's request flag; Apple's documentation says that flag is honored only when the selected recognizer supports it. A pinned, idempotent postinstall guard fails the build on unexpected dependency changes. Three Node checks cover guard insertion, ordering, idempotence and failure on changed source; native compilation remains required.

Local validation: 72 Jest tests plus 3 native-guard tests pass; TypeScript, focused ESLint (purchase/trial/provider/paywall/settings), and both Hermes mobile exports pass. Remote CI and signed TestFlight delivery remain pending. Physical iPhone purchase, cancellation, trial and Restore tests remain pending on the new candidate. Build 9's earlier confirmation is not purchase validation.

Remaining release preparation: configure and verify Plus/trial price and availability, update listing/review notes and privacy disclosure, replace stale screenshots with current captures, publish App Privacy, attach the final candidate, and obtain the owner's device purchase/Restore results before App Review. No submission is authorized by this preparation request alone.

Sources: [Apple non-subscription trial rule](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Apple on-device speech flag](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition).

Purchase source [PR118](https://github.com/MerlinWerlin/App-Projects/pull/118) merged as `962d8b8` after [CI40463537079](https://github.com/MerlinWerlin/App-Projects/actions/runs/40463537079) passed. Existing cloud-to-free-Mac fallback started native run40463910097. Simulator capture run40463753042 is separate and does not establish physical-device or purchase success. Store setup now updates existing IAP notes/localizations, preserves existing prices and only replaces a review screenshot when explicitly requested and its checksum differs;12 offline ASC tests pass. New screenshots and the final build attachment follow their actual delivery.
