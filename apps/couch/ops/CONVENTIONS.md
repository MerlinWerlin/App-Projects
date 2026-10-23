# Conventions

- Expo (latest stable SDK at T01 time), TypeScript strict, Expo Router. Package manager: npm with a committed lockfile.
- `src/core/` is pure TypeScript with no React Native imports; it is unit-tested with Jest (jest-expo preset for UI, plain ts-jest or babel for core). `npm test` runs everything; `npx tsc --noEmit` must be clean.
- Transport is injected: drivers receive `{ fetch, ws, tcp, udp }` adapters so tests run in Node with fakes and recorded fixtures under `src/core/drivers/__fixtures__/`.
- UI matches `prototype/index.html`: same tokens (copy the `:root` values into `src/theme/tokens.ts`), copy, flows and accessibility labels. Fonts: Sora (display), Manrope (body), JetBrains Mono (numbers) via expo-font / @expo-google-fonts.
- Every TV control is free. Only `src/plus/` may check the Couch Plus entitlement, and a test asserts no file under `src/core` or `app/(tabs)/remote` imports it.
- No analytics, ads or tracking SDKs. No network calls outside the local network.
- Brand names never appear in the app name, icon or screenshots' headline; protocol and driver code may name platforms.
- Small commits per task; message `T05: Roku ECP driver` etc.
