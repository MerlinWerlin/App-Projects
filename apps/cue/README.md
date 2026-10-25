# Cue: teleprompter that waits for you

App Factory app #5 (Expo SDK 57, Expo Router, TypeScript). Built from the App Factory starter standard.

**Status (2026-10-24):** first build. Runs in Expo Go. Not yet on TestFlight (no `RELEASE.json` until the owner has tried it in Expo Go).

## Try it on the phone
On the PC: double-click `START_TRIAL.cmd` (first time) or `RUN.cmd` (port 8094), then scan the QR code with Expo Go.

## What's in it
- Script library: search, pin, duplicate, share, import .txt/.md (free) and .docx (Plus). Welcome script teaches the markup.
- Editor with a live preview that matches the prompter, markup toolbar (`# section`, `*bold*`, `[pause]`, `[[private note]]`, `---`), read time, WPM, **fit to 30 s / 60 s / 90 s / 2 m / 3 m**, autosave.
- Prompter: UI-thread scrolling (Reanimated), countdown, speed nudges, mirror + vertical flip (beam splitter), reading-line band and marker, jump to section, resume where you left off, timer, landscape, screen kept awake, tap / drag / pinch.
- **Voice Pace** (works in Expo Go): words move only while you talk, wait when you stop (mic level, nothing recorded or uploaded). Part of Plus (free during the 7-day trial).
- **Voice Follow** (word tracking): alignment engine written and tested (`src/core/follow.ts`); needs the dev/TestFlight build with `expo-speech-recognition` (see `src/native/speech.ts`).
- Record: script over the camera near the lens, each take saved to Photos, no watermark, **record one section at a time** (stops at the section end).
- Plus (one-time, A$2.99): Voice Pace/Follow, caption export (.srt/.vtt timed to your WPM), prompter colours, Word import, rehearsal stats. **7-day free trial of every Plus feature** from first launch; the start date is also kept in the iOS Keychain (`expo-secure-store`) so delete-and-reinstall doesn't reset it (`src/plus/trial.ts`).
- Launch intro: "Cue" rolls up like prompter text with a light sweep (~1.3 s, tap to skip, off with Reduce Motion).
- Standard kit: no index flash, haptics setting, reduce motion, dark mode, accessibility labels, all text in `src/i18n/en.ts`, plain-words permission screen, real error messages, no ads/tracking/account.

## Layout
- `src/core/` pure TS, tested (`npm test`, or `bun test src`).
- `src/native/` guarded adapters (storage, Keychain/secure store, speech seam, import, haptics, updates).
- `app/` screens. `docs/STORE.md` listing copy. `docs/FEATURES.md` competitor scan and the feature map.
- `.github/workflows/check.yml` installs, aligns Expo versions, typechecks, tests and bundles on every branch push.
