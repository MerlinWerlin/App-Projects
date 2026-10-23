# Offline strict-tsc stub harness (`npm run typecheck:ui`)

The cloud build box cannot reach the npm registry, so `react`, `react-native`, `expo-*` and the other native
libraries are never installed there and `npx tsc --noEmit` cannot run. This folder lets the cloud still typecheck
**all of `app/` and `src/`** (tests included) in strict mode:

```
npm run typecheck:ui      # = tsc -p scripts/tsc-stubs/tsconfig.json
```

It runs fully offline with the global `tsc`, and uses `@types/node` from `node_modules/@types` or, failing that,
`/opt/npm-tools/node_modules/@types` (preinstalled on the cloud box).

## What is in here

| File | Stands in for |
| --- | --- |
| `react/index.d.ts`, `react/jsx-runtime.d.ts` | `@types/react` ~19.1 (components, hooks, refs, `JSX`) |
| `react-native.d.ts` | `react-native` 0.81 (components, style types, Animated, platform modules, `__DEV__`) |
| `modules/expo.d.ts` | expo-router, expo-status-bar, expo-splash-screen, expo-constants, expo-file-system/legacy, expo-camera, expo-keep-awake, expo-image-picker, expo-image-manipulator, expo-media-library, expo-haptics, expo-blur, expo-localization (SDK 57) |
| `modules/libs.d.ts` | react-native-gesture-handler, react-native-safe-area-context, react-native-svg, @expo/vector-icons, @expo-google-fonts/*, async-storage, jpeg-js |
| `tsconfig.json` | strict, `jsx: react-jsx`, `noEmit`, `paths` pointing react / react-native at the stubs |

`upng-js` already has a project declaration in `src/types/upng-js.d.ts`. The root `tsconfig.json` excludes this
folder, so the PC's real typecheck never sees the stubs.

The stubs are hand-written from each package's published `.d.ts` for the members Linework actually uses. They are
typed precisely enough to catch wrong prop names, misspelt style keys, bad enum strings, wrong argument counts and
nullable refs; where a real type was uncertain they are deliberately **permissive** (no false errors). Known gaps:
icon `name` is any string (typo'd glyph names are not caught), `LibraryManagedAttributes` ignores `defaultProps`,
and members Linework does not use are mostly absent.

## This is an approximation

The PC's real `npx tsc --noEmit` (VERIFY.cmd) against installed packages is **authoritative**. A clean
`typecheck:ui` does not prove the PC typecheck passes, and an error here is not automatically a bug.

## Classifying an error: stub-only or real?

1. Read the message. If it names a member, prop or overload that the stub lacks or types differently from the real
   package (e.g. "Property 'x' does not exist on type 'CameraView'", a prop missing from `*Props`, an enum value
   the stub left out), check the real API (package docs / `.d.ts` for the SDK version in `package.json`).
   - Real package has it → **stub-only**: fix the stub (add the member, widen the type). Do not change app code.
   - Real package does not have it → **real bug**: fix the code.
2. If the error is about Linework's own types, logic or nullability (possibly-undefined, wrong argument to our own
   function, missing case) it is **real** regardless of stubs.
3. If you cannot tell, prefer making the stub more permissive and note the error as "stub-only (unverified)" in the
   RUNLOG entry so the PC run can confirm.

Record any errors you leave in place as stub-only in that run's `ops/RUNLOG.md` entry.
