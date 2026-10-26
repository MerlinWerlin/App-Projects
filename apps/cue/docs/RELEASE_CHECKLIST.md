# Cue voice and logo repair — 27 October 2026

GitHub App-Projects main is the release source. This repair reuses the chat's isolated checkout at `Apps/backspin-icon`, on `codex/cue-voice-logo-20261027`; the earlier Backspin submission is complete. Jared requested a new Cue logo and a fix for the Voice Follow failure emailed to himself. This is a TestFlight repair, not an App Review submission.

## Report and repair

The 05:49 Sydney email screenshot says `Locale en is not supported by the speech recognizer` and lists regional locales including `en-AU`. The prompter passed `getLocale()` from the English-only UI catalogue, which returned `en`. Speech now uses the saved language preference or phone locale and validates it against the native recognizer's supported locales. It preserves supported regional preferences and chooses a same-language regional fallback; unavailable languages pause with a short message instead of a full native locale dump. The resolver does not require `Intl.Locale` support in Hermes.

Terminal recognition errors remove listeners and cancel restarts, pause the prompter, and select Voice Pace without starting its microphone automatically. Silence remains recoverable. A native start event controls the Listening indicator. Navigation cancels pending permission/start work, and synchronous start/restart failures clean up. `requiresOnDeviceRecognition: true` remains requested.

The replacement logo is a brass C with an ivory reading cue, in the existing navy/brass palette. Native iOS, Android adaptive foreground, launch image and public website icon are replaced together. The iOS/web icon is opaque RGB, 1254 square; the launch/adaptive artwork has alpha, 1254 square, with the visible mark inside approximately the central 64%. Original versions remain in Git history. [ART_BRIEF.md](ART_BRIEF.md) records built-in ImageGen prompts and outputs.

## Verification

- 62 tests pass, including 21 new locale/session regressions. The native boundary test reproduces the emailed bare-`en` rejection and verifies `en-AU` is sent instead.
- TypeScript and final iOS + Android Hermes release exports pass. The new locale/session files pass focused ESLint. GitHub CI readback is pending.
- New locale/session files have no lint errors. Full-app lint has 28 existing errors (React hook/Reanimated rules); the modified prompter has the same four rule findings as its unmodified Git version. These are not reported as a clean lint run.
- Actual phone recognition, interruption recovery and new Home Screen appearance still need an owner retest after the native build reaches TestFlight. A Node regression test is not a physical-iPhone claim.
- Native build/upload pending. The existing release workflow falls back to the free GitHub Mac runner when Expo's monthly cloud build quota is exhausted.

## Scope

No purchase/trial logic, recording mode, permissions, prices or Backspin release state changed. Cue's broader App Review gates remain separate (including its existing purchase stub/automatic trial and account metadata); this repair does not establish store-release readiness.

Reference: [expo-speech-recognition API](https://github.com/jamsch/expo-speech-recognition#getSupportedLocales).
