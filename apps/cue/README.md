# Cue: teleprompter that waits for you

App Factory app #5 (Expo SDK 58, Expo Router, TypeScript). Built from the App Factory starter standard.

**Status (2026-10-27):** Prepared for submission. Apple has build 13, Cue Plus and the free seven-day Trial together in one Ready for Review draft with Submit for Review enabled. It has not been sent to Apple review. Jared confirmed Plus, Trial and Restore passed on build 11. The Australian A$2.99 display correction is published, current iPhone/iPad screenshots are complete, and the final binary's brass C icon is verified. See [release evidence](docs/RELEASE_CHECKLIST.md) for receipts and the separate pending EU trader verification.

## Try it on the phone
Use TestFlight on your iPhone. The release candidate includes real Apple sandbox purchases: Settings > Cue Plus > Start free 7-day trial, Get Plus, and Restore purchase. TestFlight transactions do not charge you. See docs/RELEASE_CHECKLIST.md for the build receipt and passed phone checks.

## What's in it
- Script library: search, pin, duplicate, share, import .txt/.md (free) and .docx (Plus). Welcome script teaches the markup.
- Editor with a live preview that matches the prompter, markup toolbar (`# section`, `*bold*`, `[pause]`, `[[private note]]`, `---`), read time, WPM, **fit to 30 s / 60 s / 90 s / 2 m / 3 m**, autosave.
- Prompter: UI-thread scrolling (Reanimated), countdown, speed nudges, mirror + vertical flip (beam splitter), reading-line band and marker, jump to section, resume where you left off, timer, landscape, screen kept awake, tap / drag / pinch.
- **Voice Pace** (works in Expo Go): words move only while you talk, wait when you stop (mic level, nothing recorded or uploaded). Part of Plus (free during the 7-day trial).
- **Voice Follow** (word tracking): native on-device recognition in supported device languages, with tested alignment (`src/core/follow.ts`) and regional-locale recovery (`src/native/speech.ts`). Included in the TestFlight/release build.
- Record: script over the camera near the lens, each take saved to Photos, no watermark, **record one section at a time** (stops at the section end).
- Plus (one-time, A$2.99): Voice Pace/Follow, caption export (.srt/.vtt timed to your WPM), prompter colours, Word import, rehearsal stats. **7-day free trial of every Plus feature**, started explicitly through Apple's free `7-day Trial` non-consumable. Its original transaction date is restored across reinstalls; the earlier automatic testing preview does not grant store access (`src/plus/trial.ts`).
- Launch intro: "Cue" rolls up like prompter text with a light sweep (~1.3 s, tap to skip, off with Reduce Motion).
- Standard kit: no index flash, haptics setting, reduce motion, dark mode, accessibility labels, all text in `src/i18n/en.ts`, plain-words permission screen, real error messages, no ads/tracking/account.

## Layout
- `src/core/` pure TS, tested (`npm test`, or `bun test src`).
- `src/native/` guarded adapters (storage, Keychain/secure store, speech seam, import, haptics, updates).
- `app/` screens. `docs/STORE.md` listing copy. `docs/FEATURES.md` competitor scan and the feature map.
- `.github/workflows/check.yml` installs, aligns Expo versions, typechecks, tests and bundles on every branch push.
