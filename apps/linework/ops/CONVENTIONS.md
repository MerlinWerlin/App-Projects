# Conventions

- Expo (latest stable SDK), TypeScript strict, Expo Router (root stack + the `app/(tabs)` bottom tab group, T81). npm with a committed lockfile once the registry is reachable.
- **Expo Go compatible until the TRIAL milestone:** only the libraries listed in `docs/PLAN.md` §5 plus pure-JS packages. No config plugins that need a dev build, no custom native modules.
- `src/core/` is pure TypeScript with no React Native or Expo imports, written so Node runs it directly (type annotations only: no enums, no namespaces, no parameter properties; relative imports end in `.ts`, with `allowImportingTsExtensions` in tsconfig). Tests live next to the code as `*.test.ts` using `node:test` + `node:assert/strict`, so `node --test src/core` works offline with zero dependencies. `npm test` runs the same.
- UI follows `docs/PLAN.md` §3–4: tokens in `src/theme/tokens.ts` (light + dark), Fraunces/Inter, glass pill controls on the camera, ≥ 48 pt touch targets, haptics, accessibility labels on every control.
- Camera tracing tools are free for everyone (owner decision 22 Oct 2026: after the 14-day trial, outline mode and the full template library need Linework Plus; docs/OWNER_1022D.md). Only `src/plus/` and the screens listed in src/plus/entitlement.test.ts may read the Plus entitlement; nothing under `src/core` or `app/trace*` imports it.
- No analytics, ads, tracking SDKs, accounts or network calls. Images never leave the device.
- Templates are original SVG line art made in this repo; never copy or trace existing artwork.
- Never use competitor names (AR Drawing, Artrace, PicTrace, SketchAR) in code, copy or assets.
- Small commits per task; message `T04: Trace screen` etc.
