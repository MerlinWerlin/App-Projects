# Meow Manager

**Current build:** the first iOS-targeted 3D motion pass is implemented. The default screen has an articulated kitty, nap/chips openings, idle/wave/listening/speaking and menu interaction. Start with [the animation build record](docs/ANIMATION_BUILD.md) and [the experience brief](docs/IOS_CHARACTER_EXPERIENCE.md). The earlier planner is preserved at `/planner-reference`. The procedural character is a motion rig; concept-art-quality fur and real iPhone performance remain outstanding. No TestFlight build has been delivered.

A little cat personal assistant that helps organise a day, remember things and take the next step. Started for Jared on 4 November 2026. This is a real Expo app in the existing App Factory release repository, with an original vector cat called Mochi. Codex owns this first implementation. It serves the **Meow Manager** row of `C:/BTB/_ATLAS/MASTER_ROADMAP.md`, the only project roadmap.

## Run and check

Use Node 22.18+ (or Node 24) and the existing Expo SDK 57 environment:

```sh
npm ci
npm test
npm run typecheck
npx expo install --check
npx expo start --port 8102
```

For a browser: `npm run web -- --port 8102`. For an export: `npm run export`. Web previews cannot receive phone reminders or read the phone calendar. The native adapters need a compatible Expo Go/development/native build; actual device verification is tracked separately.

- [Product and capability record](docs/PRODUCT.md)
- [Build process and verification](docs/BUILD_PROCESS.md)
- [First-use trial](docs/TRIAL.md)
- [Infrastructure and integration details](docs/ARCHITECTURE.md)
- [Current machine-readable status](ops/status.json)

The owned development checkout is `C:/Users/jared/Documents/ChatGPT/Apps/meow-manager`, branch `codex/meow-manager-20261104`, based on App-Projects `main` at `4444889`. GitHub `MerlinWerlin/App-Projects` remains the release authority. This is separate from the refresh-managed Desktop test copies and the existing Glaze checkout. Nothing is installed into another app.
