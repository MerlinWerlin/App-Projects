# ir-blaster (local Expo module) — UNVERIFIED

Android `ConsumerIrManager` for phones with an infrared emitter. JS API (`index.ts`, via
`requireOptionalNativeModule('IrBlaster')`, null when not compiled in):

- `hasIrEmitter(): boolean`
- `getCarrierFrequencies(): { min, max }[]`
- `transmit(frequency: number, pattern: number[]): Promise<void>` — alternating on/off microseconds,
  starting with on (patterns come from `src/core/ir/protocols.ts`).

No iOS implementation (iPhones have no IR emitter); `expo-module.config.json` lists Android only.
`android/src/main/AndroidManifest.xml` declares `TRANSMIT_IR` and an optional
`android.hardware.consumerir` feature (the app plugin `plugins/withLanAccess.js` adds them too).

The app only reaches this module through the guarded loader `src/native/ir.ts`
(`loadIrTransmitter()` → null in Expo Go, on iOS and in tests).

**Status: written without a build machine or an IR phone. Not compiled, not run.**
Check on the first dev build: the `expo-module-gradle-plugin` id, `List<Int>` argument conversion,
and that a Xiaomi/Redmi/POCO phone actually changes a TV's volume in the setup flow.

Note: the repo `.gitignore` ignores every `android/` directory, so files under `android/` here
were added with `git add -f`. Keep doing that when editing them.
