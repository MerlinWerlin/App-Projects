# Conventions

- Expo SDK 57 pins exactly as package.json (same set as apps/crochet). Never bump the SDK in a build run.
- TypeScript strict. `src/core/` is pure TS (no React Native/Expo imports, relative imports end in `.ts`) with `*.test.ts` next to the code; `npm test` runs offline.
- Offline checks every run: `npm test` and `tsc -p scripts/tsc-stubs/tsconfig.json`. A new expo/RN API used in UI code needs its stub in `scripts/tsc-stubs/modules/roamlings.d.ts` in the same commit.
- Every UI string in `src/i18n/en.ts` (src/app.test.ts fails on a missing literal key).
- Tokens from `src/theme/tokens.ts` (light + dark), touch targets 48 pt+, accessibility label on every control, haptics through `useHaptics` (setting respected), motion durations from `motion` (no springs).
- Lists use FlatList with stable keys; PetView is memoised.
- Native features (widgets, HealthKit, Live Activities) sit behind adapters in `src/native/` that fail soft.
- Original art only; new species = data in `src/core/species.ts` + text in `speciesText`.
- Never create or change RELEASE.json or SHIP_BASE.txt (auto-ship owns them).
- Commit messages: `R07: home widget` etc., ending with the Co-Authored-By footer.
