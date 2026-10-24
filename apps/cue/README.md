# Cue: teleprompter that waits for you

App Factory app #5 (Expo SDK 57, Expo Router, TypeScript). Built from the App Factory starter standard.

**Status (2026-10-24):** first build. Runs in Expo Go. Not yet on TestFlight (no `RELEASE.json` until the owner has tried it in Expo Go).

## Try it on the phone
On the PC: double-click `START_TRIAL.cmd` (first time) or `RUN.cmd` (port 8094), then scan the QR code with Expo Go.

## What's in it
- Script library: search, pin, duplicate, share, import .txt/.md (free) and .docx (Plus). Welcome script teaches the markup.
- Editor with a live preview that matches the prompter, markup toolbar (`# section`, `*bold*`, `[pause]`, `[[private note]]`, `---`), read time, WPM, **fit to 30 s / 60 s / 90 s / 2 m / 3 m**, autosave.
- Prompter: UI-thread scrolling (Reanimated), countdown, speed nudges, mirror + vertical flip (beam splitter), reading-line band and marker, jump to section, resume where you left off, timer, landscape, screen kept awake, tap / drag / pinch.
- **Voice Pace** (works in Expo Go): words move only while you talk, wait when you stop (mic level, nothing recorded or uploaded). 3 free reads, unlimited with Plus.
- **Voice Follow** (word tracking): alignment engine written and tested (`src/core/follow.ts`); needs the dev/TestFlight build with `expo-speech-recognition` (see `src/native/speech.ts`).
- Record: script over the camera near the lens, each take saved to Photos, no watermark, **record one section at a time** (stops at the section end).
- Plus (one-time): Voice Pace/Follow unlimited, caption export (.srt/.vtt timed to your WPM), prompter colours, Word import, rehearsal stats.
- Standard kit: no index flash, haptics setting, reduce motion, dark mode, accessibility labels, all text in `src/i18n/en.ts`, plain-words permission screen, real error messages, no ads/tracking/account.

## Layout
- `src/core/` pure TS, tested (`npm test`, or `bun test src`).
- `src/native/` guarded adapters (storage, speech seam, import, haptics, updates).
- `app/` screens. `docs/STORE.md` listing copy. `docs/FEATURES.md` competitor scan and the feature map.
- `.github/workflows/check.yml` installs, aligns Expo versions, typechecks, tests and bundles on every branch push.
