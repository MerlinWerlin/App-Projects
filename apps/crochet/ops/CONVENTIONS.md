# Conventions (Rowlight)

- Expo SDK 57 (same pins as the other apps), Expo Router, TypeScript strict. **Expo Go safe**: only Expo Go
  modules plus pure JS. Native work (StoreKit, widgets, Live Activity, speech recognition) waits for the dev build
  and goes behind adapters that fall back cleanly.
- `src/core/` is pure TS, no React Native imports, relative imports end in `.ts`; tests next to it (`node:test`).
  `npm test` must pass before any push. `src/core/i18nKeys.test.ts` fails if a `t('key')` is missing from `en.ts`.
- Every user-facing string goes through `t()` (`src/i18n/en.ts`). Plurals: `"one|other"` with `{count}`.
- UI tokens in `src/theme/tokens.ts` (light + dark), Fraunces/Nunito, ≥ 48 pt targets, accessibility labels on
  every control, haptics via `src/ui/haptics.ts` (respects the setting), motion respects Reduce motion.
- Save every change locally (`src/store/data.ts`); no account, no analytics, no ads, no network calls.
- Only `src/plus/` decides Plus. The free list in `docs/PLAN.md` is never gated.
- Errors shown to people say what happened in plain words (see `files.*` strings).
- Commits: `Rowlight: <change>` or `R07: <change>` for backlog tasks. Don't touch other apps' folders.
