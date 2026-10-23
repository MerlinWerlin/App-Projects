# modules-off (owner TestFlight fix, 24 Oct 2026)

Glaze's own native modules live in `../modules/` (Live Lock Screen, Live Photo, widget bridge, Android).
They have never been compiled, so the first TestFlight build links none of them:
`package.json` > `expo.autolinking.nativeModulesDir` points here (an empty folder) and the
`production` EAS profile sets `GLAZE_NATIVE=0` (no widget target / entitlements). The JS adapters in
`src/native/` use `requireOptionalNativeModule`, so the app behaves exactly like the Expo Go build the
owner tested.

To turn the native milestone on (first dev build, T17): set `nativeModulesDir` back to `./modules`,
install `@bacons/apple-targets`, and build with the `production-native` (or `development`) profile.
