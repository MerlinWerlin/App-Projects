# Conventions

- Expo SDK 57 pins exactly as package.json (same set as apps/roamlings). Never bump the SDK in a build run.
- TypeScript strict. `src/core/` and `src/scenes/` are pure TS (no React Native imports, relative imports end in `.ts`)
  with `*.test.ts` next to the code; `npm test` runs offline.
- Offline checks every run: `npm test` and `npm run typecheck:ui`. A new expo/RN API used in UI code needs its stub
  in `scripts/tsc-stubs/modules/` in the same commit.
- Every UI string in `src/i18n/en.ts` (src/app.test.ts fails on a missing key or hard-coded Text).
- Scene art: author with `LevelArt` helpers in `src/core/build.ts`; the first region of a level covers it; regions
  must be at least 25 square units; never rename region ids of a shipped scene without bumping its `version`.
  Check art with scripts/preview.py before committing.
- Tokens from `src/theme/tokens.ts`; the artwork itself is never themed (white paper, dark ink).
- Touch targets 48 pt+, accessibility label on every control, haptics through `useHaptics`.
- Commit messages end with the Co-Authored-By footer.
