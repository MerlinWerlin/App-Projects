# Worker brief, run 203 (owner-1101)

You are one parallel worker on Glaze (Expo / React Native, iOS + Android icon theme + widget + wallpaper app). You run in your own git worktree of the repo. Read first: `docs/OWNER_1101.md` (the owner's brief + decisions), `ops/CONVENTIONS.md`, `docs/PLAN.md` (skim). Your task is the one named in your prompt; stay inside it.

Environment facts:
- The npm registry is UNREACHABLE (no node_modules). Green check is: `node --test "src/core/**/*.test.ts"` (all must pass; ~85 s) plus the core typecheck if `tsc` exists: `tsc --ignoreConfig --noEmit --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions $(ls src/core/*.ts | grep -v '\.test\.ts$')` (drop `--ignoreConfig` on tsc < 6). There may also be a stub UI typecheck script; check `package.json` scripts / `ops/typecheck-core.sh` and run what works offline.
- UI code can't be compiled or run here: keep it conservative (well-known APIs of the libraries already imported in the repo). Never add npm dependencies.
- Many existing tests are source guards (they read .tsx / i18n files as text and assert things). If you change a screen, run the full core suite and fix or update guards honestly (update a guard only when the owner's brief changes the behaviour it protected; say which in your commit message).

Hard rules (never break):
- Everything the owner tests in Expo Go must still run there: native features only through `src/native/*` adapters that fall back cleanly and never crash Expo Go.
- Original art only: no brand logos, famous characters or competitor names (Themify, Icon Themer, MyScreen, ScreenKit, Widgetsmith, intoLive, Loopy, Lockio). App names are plain labels.
- Never invent download counts, ranks or badges. Never claim anything was tested on a real device.
- Keep the regular `production` EAS profile native-free; do not add `@bacons/apple-targets` or `expo-dev-client` to package.json; never change RELEASE.json fields `profile`, `skipCapabilitySync`, `ascAppId`. No UIBackgroundModes audio.
- Make-your-own icons, both install methods and the Live Photo maker stay free (only `src/plus/` reads the Plus entitlement).
- Tokens from `src/theme/tokensV2.ts` only in screens (designGuard ratchets raw colours/sizes). Motion is calm: no bounce/springs (there is a no-bounce guard, T151). ≥ 48 pt touch targets, accessibility labels on every control.
- New user-facing strings go through the i18n catalogue the screen already uses (`src/i18n/ns/...`); English required; add the other locales where the existing completeness tests require them (follow what those tests demand; a plain English copy as placeholder is acceptable only if the tests allow it — otherwise write real short translations).
- No network calls added to the app beyond what exists; no analytics.
- Write files with the Write/Edit tools; keep shell commands simple. Do not touch other apps, the owner's PC, or any artifact. Do not push anywhere.

Deliver: commit on your worktree branch (message `T1xx: <summary>` + blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), with the full core suite green. Keep your changes to the files your task needs (other workers are editing in parallel: tabs layout/Wallpapers = T186, theme page + apply = T184/T185, widgets/pack v2 = T187, install/catalogue = T183, pets = T188, mascot/startup = T190, extra catalogue data = T189). Final reply (short): branch name, commit hash, what changed in plain words, what the owner should check on TestFlight (1-3 yes/no questions), whether it needs a new native build, anything left undone.
Time limit: about 45 minutes. If you run short, commit a smaller but complete, green slice and say what remains.
