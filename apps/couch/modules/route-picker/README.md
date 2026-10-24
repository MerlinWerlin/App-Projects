# route-picker (local Expo module) — UNVERIFIED

Opens the system AirPlay route picker (the sheet behind the AirPlay button in Control Centre) from a
plain JS call, for the "AirPlay / Screen Mirroring" shortcut on the Cast tab (T92, cast-1024 phase B).
iOS only. There is no native view to place.

**Status: written without a build machine. It has not been compiled, and it has not been tested on
a device or with a real TV.** Only text checks cover it (`tests/route-picker.test.ts`). Treat it as
unverified until a dev build on the PC (`npx expo prebuild` then `expo run:ios`) succeeds and the
sheet opens.

## Layout

- `expo-module.config.json` — registers `RoutePickerModule` on Apple only (`"platforms": ["apple"]`).
- `index.ts` — JS API via `requireOptionalNativeModule('RoutePicker')` (null when not compiled in):
  - `show(): Promise<boolean>` — true when the picker's button was found and tapped, false otherwise.
    Never rejects.
  - `isAvailable(): boolean` — true whenever the module is compiled in.
- `ios/RoutePickerModule.swift`, `ios/RoutePicker.podspec` — the module.

The app never imports this module directly: `src/native/routePicker.ts` loads it through a guarded
`require` inside a function (Expo Go, Android, web and tests get `false`), and the button falls back
to a one-screen guide (`app/airplay.tsx`).

## How `show` works

There is no public API that opens the route picker directly. On the main queue, `show`:

1. finds the key window of the foreground `UIWindowScene` (not the deprecated
   `UIApplication.keyWindow`);
2. adds a 1 x 1 pt `AVRoutePickerView` (AVKit) at the bottom centre, `alpha = 0.01`
   (not `isHidden`, which can stop the sheet from presenting), `prioritizesVideoDevices = true`;
3. finds its internal `UIButton` and calls `sendActions(for: .touchUpInside)`;
4. resolves `true`, or removes the view and resolves `false` when no button is found.

On iPhone the view is removed one second later (the sheet is already up). On iPad the sheet is a
popover anchored to the view, so the view stays until the next `show` or until the module is destroyed.

This relies on AVRoutePickerView keeping a `UIButton` subview, which is an implementation detail:
if a future iOS changes it, `show` resolves `false` and the app shows the guide instead.
