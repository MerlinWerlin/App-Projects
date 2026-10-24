# Backspin: plan

**What it is.** A party game for the viral reverse-singing challenge. Record a line, hear it backwards, copy the backwards sound, and Backspin flips your copy forwards. The closer it sounds to the original, the higher the score. Started 24 Oct 2026 from the App Store scout's pick ("trend, easy, can make cash").

**Why it wins** (docs/MARKET.md): about 12 competitors, almost all cloned in Aug–Nov 2025. Nearly all of them use weekly subscriptions ($3–10 a week) and/or heavy ads, and reviewers hate both. Only one scores your attempt, and none has a daily challenge or streak. Backspin gives you:
- unlimited free rounds, no ads, no account, no tracking;
- a real closeness score (sound, rhythm and length) with stars and a verdict;
- Party mode for 2–8 players, with **Copy it** (scored) and **Guess it** (decode the backwards line);
- a daily challenge with streaks and Wordle-style share text;
- 986 original or public-domain challenge lines in 7 packs (no copyrighted lyrics);
- a one-time Backspin Plus purchase instead of a subscription.

## Screens
- **Play**: today's challenge with the streak, Quick play, Freestyle, Challenge a friend, how it works, your rank title.
- **Round** (one screen, 4 steps): say it → hear it backwards (loop, slow) → copy it → the flip (animated score, the 4 parts, Play all four, voice effects, share clip, save, try the copy again, next line).
- **Packs**: 7 packs, with a difficulty filter and a random line.
- **Party**: players, rounds, Copy it / Guess it, handoff screens, scoreboard, a forfeit for last place.
- **Takes**: saved rounds. Replay any part, share, delete.
- **Settings**: haptics, hold or tap to record, countdown, autoplay, calm motion, appearance, 14 languages, Plus and restore, feedback, the intro again.
- **Plus** (modal) and the **Intro** (3 cards, then a plain-words microphone screen).

## How the sound works (all JavaScript, runs in Expo Go)
- iOS records 16-bit mono WAV (`src/native/audio.ts`). `src/core/wav.ts` reads any chunk layout, including the FLLR padding chunk iOS adds.
- `src/core/dsp.ts` handles trim, normalise, fade, reverse, effects (chipmunk, giant, robot, echo, alien), waveform peaks, and the 4-part share clip with chirps between the parts.
- `src/core/score.ts` brings audio down to 8 kHz, extracts 20 mel-like log bands per 32 ms frame with mean removal, aligns the two clips with DTW, and scores 0–100. Sound gates rhythm and length.
- **Audio route lesson:** iOS plays through the earpiece while recording is allowed, so every playback switches the session to playback first.
- **Android:** its recorder can't write WAV, so Backspin can't reverse on Android in Expo Go yet and says so. The store build needs a small native PCM recorder (backlog B10).

## Money (Jared, 24 Oct 2026: "10 free goes and then it's 2 lifetime")
- **10 free goes** with everything switched on (every pack, effect, party size, save). Each scored round counts as a go; a party that starts inside the free goes always finishes. The home screen shows how many are left.
- After that, new rounds need **Backspin Plus**, a one-time lifetime unlock (non-consumable `com.jared797.backspin.plus`) at **A$1.99**, the App Store price nearest "$2". Set it in App Store Connect when the app is created. Saved takes still play and share without it.
- No ads, no subscription, no tracking SDKs, and recordings are never uploaded. App Privacy: Data Not Collected.
- The store copy (store/listing.draft.json) still describes the earlier free-core model and needs rewording before submission.

## Rules (from the App Factory starter standard)
Same Expo SDK 57 as the other apps, Expo Go first, native-only features behind guarded adapters, no "index" flash, FlatList with fixed rows, calm motion and haptics settings, real error messages on save and share, plain-words permission screen, dark mode, accessibility labels, every string in `src/i18n/en.ts` with 13 Luna translations, no competitor names outside docs/MARKET.md, original art only, never claim a feature works on a real phone until Jared confirms it.

## Next (backlog)
- B1 Jared's first Expo Go test (docs/TRIAL.md), then tune scoring from his takes.
- B2 Face-cam video share (1080x1920, 4 labelled parts and score) needs a native module, so it ships in a store build. This is the biggest viral lever.
- B3 TestFlight: create the App Store Connect app, add `RELEASE.json` with `ascAppId`, and the first build goes through auto-ship.
- B4 GPT-made icon, mascot and store-shot backgrounds (art brief in docs/ART_BRIEF.md).
- B5 Song-challenge mode with original melodies (hum-along), and more packs from Luna.
- B6 Challenge links (send a backwards clip to beat your score); needs a small backend, so later.
- B10 Android native PCM recorder.
