# Backspin native adapters

App-owned Expo modules for the APPS Google Play preparation stage. `backspin-pcm` converts Android recorder output into real PCM WAV files for the existing reversing engine. Android-only autolinking keeps iOS and Expo Go unchanged; callers use the guarded adapter in `src/native/pcm.ts`. Native compilation and emulator evidence are recorded in the repository's `docs/GOOGLE_PLAY.md`.
