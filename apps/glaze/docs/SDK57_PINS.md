# SDK 57 pins (what ships) vs the cloud package.json

The cloud build repo keeps the SDK 54-era ranges in `package.json` (Expo Go trial line; the registry is unreachable from the cloud, so it can't re-pin). What ships to TestFlight is **App-Projects `apps/glaze`**, which carries the **SDK 57 pins** set on the PC. The build run's App-Projects sync skips those pins on purpose (PC-only), so the PC / auto-ship copy must keep them.

**Rule (oversight D203-1, 30 Oct):** never let a cloud range such as `expo-image ~3.0.0` reach an SDK 57 build. When a cloud run adds a dependency, the PC copy uses the SDK 57 version from the table below (or `npx expo install <pkg>` on the PC).

- `expo-image` (new in run 179, T162): **`~57.0.5`** on SDK 57 (already in App-Projects `apps/glaze/package.json`; `apps/crochet` uses the same). Cloud range `~3.0.0` is the SDK 54 line.
- Native-module change → auto-ship picks a TestFlight `build` (not an OTA update). That's expected.

## App-Projects apps/glaze dependencies (read 30 Oct 2026, commit 0afce81)

| Package | SDK 57 pin |
|---|---|
| `@expo-google-fonts/manrope` | `^0.4.1` |
| `@expo-google-fonts/unbounded` | `^0.4.1` |
| `@expo/vector-icons` | `^15.0.2` |
| `@react-native-async-storage/async-storage` | `^2.2.0` |
| `expo` | `~57.0.31` |
| `expo-blur` | `~57.0.0` |
| `expo-clipboard` | `~57.0.2` |
| `expo-constants` | `~57.0.21` |
| `expo-crypto` | `~57.0.4` |
| `expo-file-system` | `~57.0.7` |
| `expo-font` | `~57.0.4` |
| `expo-haptics` | `~57.0.3` |
| `expo-image` | `~57.0.5` |
| `expo-image-picker` | `~57.0.20` |
| `expo-linear-gradient` | `~57.0.0` |
| `expo-linking` | `~57.0.13` |
| `expo-localization` | `~57.0.2` |
| `expo-mail-composer` | `~57.0.2` |
| `expo-media-library` | `~57.0.5` |
| `expo-router` | `~57.0.29` |
| `expo-sharing` | `~57.0.24` |
| `expo-splash-screen` | `~57.0.10` |
| `expo-status-bar` | `~57.0.1` |
| `expo-updates` | `~57.0.26` |
| `expo-video` | `~57.0.5` |
| `expo-web-browser` | `~57.0.3` |
| `react` | `19.2.3` |
| `react-dom` | `19.2.3` |
| `react-native` | `0.86.3` |
| `react-native-gesture-handler` | `~2.32.0` |
| `react-native-reanimated` | `4.5.1` |
| `react-native-safe-area-context` | `~5.7.0` |
| `react-native-screens` | `~4.26.0` |
| `react-native-svg` | `15.15.4` |
| `react-native-view-shot` | `5.1.0` |
| `react-native-worklets` | `0.10.1` |
