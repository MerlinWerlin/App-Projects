# modules-off (owner TestFlight fix, 24 Oct 2026)

Glaze's own native modules live in `../modules/` (Live Lock Screen, Live Photo, widget bridge, Android).
They have never been compiled, so the first TestFlight build links none of them:
`package.json` > `expo.autolinking.nativeModulesDir` points here (an empty folder) and the
`production` EAS profile sets `GLAZE_NATIVE=0` (no widget target / entitlements). The JS adapters in
`src/native/` use `requireOptionalNativeModule`, so the app behaves exactly like the Expo Go build the
owner tested.

Native linking now follows the build profile (D128-2, T120): `scripts/native-link.mjs` runs as the
`eas-build-pre-install` hook and sets `nativeModulesDir` from the profile's `GLAZE_NATIVE`
(`development`, `preview` and `production-native` link `./modules`; `production` links none). No hand
edit is needed. For a local prebuild: `npm run native:on`, then `npx expo prebuild`, then `npm run native:off`
before committing. Still to do for the native milestone (T17): install `@bacons/apple-targets`.
