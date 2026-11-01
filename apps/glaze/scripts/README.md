# scripts/

## `npm run typecheck:ui` — cloud strict-tsc stub harness (D74-3, T52)

`tsc -p scripts/tsconfig.ui.json` type-checks everything under `app/` and `src/` (tests,
`targets/`, `native-plugins/` and `modules/` excluded) in strict mode **without `node_modules`**.
Every third-party module the app imports (React 19, React Native 0.81, Expo Router 6, Reanimated 4,
Gesture Handler, react-native-svg, safe-area-context, view-shot, worklets, AsyncStorage,
`@expo/vector-icons`, the Expo SDK 54 modules and the Google font packages) is declared by hand in
`scripts/tsc-stubs/*.d.ts` as ambient `declare module` blocks. Globals RN adds on top of
`lib.dom`/`lib.esnext` (`__DEV__`, `require`) are in `tsc-stubs/globals.d.ts`.

It is an **approximation for the cloud**, where the npm registry is unreachable. It is **not** a
substitute for the PC `TSC_REPORT.cmd` / `npm run typecheck` against the real `node_modules` types.

- The stubs follow the libraries' public APIs (real prop names and types), so wrong props, implicit
  `any`, missing imports and bad narrowing in our code are caught. Where the real types are huge or
  uncertain the stubs are deliberately permissive (`any` styles on animated components, string
  Ionicons names, index signatures on navigator options), so a clean run can still miss errors the
  real types would report, and a real-types run is the source of truth when they disagree.
- `tsc-stubs/feather-names.d.ts` is generated from `src/core/glyphnames.ts` (Feather 4.29 generic +
  brand names), so `<Feather name="…">` is checked against the real glyph list.
- Ambient module declarations only apply when the real package is absent, so run this in the cloud
  checkout; on the PC (with `node_modules`) use `npm run typecheck`.
- When a stub causes a false positive, fix the stub (not our code). When a new third-party import
  appears, add its module to the stubs or the run fails with TS2307.
- `src/core/tscHarnessGuard.test.ts` keeps the config, the stubs and the npm script in place.

## `node scripts/gen-query-schemes.mjs` (T229)

Writes `native-plugins/queryschemes.json` (Info.plist LSApplicationQueriesSchemes) from `src/core/installedProbe.ts`. Run it after changing that list; `src/core/installedProbe.test.ts` fails while they differ.
