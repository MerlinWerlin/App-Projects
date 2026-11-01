# Conventions

- Expo (latest stable SDK), TypeScript strict, Expo Router (tabs + stack). npm with a committed lockfile once the registry is reachable.
- **Expo Go compatible until the TRIAL milestone:** only the libraries listed in `docs/PLAN.md` §6 plus pure-JS packages. Native work (T10+) lives in `modules/` and `targets/`, reached only through `src/native/*` adapters that fall back cleanly when the module is missing (Expo Go, Android, iOS < 26).
- `src/core/` is pure TypeScript with no React Native or Expo imports, written so Node runs it directly (type annotations only: no enums, no namespaces, no parameter properties; relative imports end in `.ts`, with `allowImportingTsExtensions` in tsconfig). Tests live next to the code as `*.test.ts` using `node:test` + `node:assert/strict`, so `node --test src/core` works offline with zero dependencies. `npm test` runs the same.
- UI follows `docs/PLAN.md` §4–5: tokens in `src/theme/tokensV2.ts` only (light + dark, docs/DESIGN_V2.md; raw colours / font sizes / radii in screens are ratcheted by src/core/designGuard.test.ts), system font for chrome (Unbounded/Manrope via `artFontsV2` for artwork only), ≥ 48 pt touch targets, haptics, accessibility labels on every control.
- Make-your-own icons, both install methods and Live Lock Screen with your own video are free. Only `src/plus/` may read the Plus entitlement; a test asserts nothing under `src/core`, `app/install*` or `app/(tabs)/icons*` imports it.
- No analytics, ads, tracking SDKs, accounts or network calls (exceptions, all recorded in docs/privacy.html: theme-pack downloads, Expo updates, and the owner-1101f App Store category lookup for unrecognised app names, T231). Photos and videos never leave the device.
- Icons, glyphs, themes and wallpapers are original or from MIT/Apache icon sets with licences recorded in `docs/LICENSES.md`. No brand logos, no copied wallpapers.
- Never use competitor names (Themify, Icon Themer, MyScreen, ScreenKit, Widgetsmith, intoLive, Loopy, Lockio) in code, copy or assets.
- Small commits per task; message `T04: Icon Studio` etc.
