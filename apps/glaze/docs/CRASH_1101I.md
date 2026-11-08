# Crash hardening, owner-1101i #2 (T264)

The owner hit another TestFlight crash on build 20 (no stack trace yet). Rather than wait for one,
T264 hardens every path the crash could plausibly come from, so the app catches and recovers
instead of closing. Guarded by `src/core/crashGuard1101i.test.ts`.

## Per-screen error boundaries

`src/ui/ScreenBoundary.tsx` (`withScreenBoundary(Screen, name)`) wraps each tab screen (Themes,
Widgets, Icons, Wallpapers, Settings) and the theme detail (`app/theme/[id].tsx`). A render error
inside one of them now shows a calm card in place of that screen: "Something went wrong", one line
saying nothing on the phone was lost, and a **Retry** button. Retry clears the boundary and
remounts the screen with a new key, so its state starts fresh. The other tabs keep working, and the
root boundary in `app/_layout.tsx` stays as the last resort. Strings are `ui.error.screenTitle`,
`ui.error.screenBody` and `ui.error.retry` in all 11 locales. Nothing is sent off the phone.

## Theme apply ("Use this theme")

- `putInUse` in the theme detail had `try/finally` with no `catch`, and was called as
  `void putInUse()`. An apply that threw became an unhandled promise rejection. It now catches,
  shows the existing "couldn't apply" note, and the callers add `.catch`.
- `applyThemeEverywhere` (`src/store/activeTheme.ts`) now try-wraps `rememberWidgetTheme`, each
  theme listener (one listener throwing, for example a screen unmounting, no longer stops the
  others or the deferred queue) and the deferred-step requests.
- The deferred queue (`src/core/deferredWork.ts`) no longer starts a drain with a bare
  `void drain()`. It uses `.catch`, so a failed drain can never surface as an unhandled rejection.
- The focus reads in the theme detail (`wasWallpaperSaved`, `loadBackground`) and the pack download
  now catch too.

## Return to the app (AppState 'active')

All three AppState listeners are try-wrapped, and their async work has a `.catch`:
`src/ui/PhoneFrame.tsx` (`useActiveScreen`), `src/store/widgetHabits.ts` (habit refresh) and
`src/native/useRemoteCatalog.ts` (catalogue re-check). Subscribing and removing the listeners are
guarded as well.

## Themes tab (category browse)

- List keys never throw. A row or theme with no key or id falls back to its index.
- Rails and card rows skip undefined or id-less themes. A catalogue that makes `browseThemes` throw
  falls back to the bundled starters.
- The window size is clamped to a finite, positive value before any geometry is worked out, and the
  rail width, header height and the rest follow from it.
- Opening a theme ignores an empty id and try-wraps `router.push`.
- Pull to refresh does not call setState after the tab unmounts, and its promise never rejects
  unhandled.
- `useRemoteCatalog`: a malformed catalogue (missing `packs` or ids) lists nothing instead of
  throwing. A malformed downloaded manifest falls back to "not downloaded".

## Widget art

- `WidgetArtLibraryList`: the library read is try-wrapped, with no setState after unmount, and it
  checks the bridge result's shape. Remove, delete selected and clear all catch bridge failures.
  Button handlers use `.catch` instead of `void`.
- `ThemeWidgetArt` "Use on my widget" and the Widgets tab theme pick and habit taps use `.catch`
  instead of `void`.

## Native Swift

There is no `try!`, `fatalError(` or `as!` anywhere in `modules/*/ios` or `targets/`, and no force
unwraps were found. `GlazeWidgetBridgeModule.swift` now refuses NaN or infinite crops in
`composeSeamlessImage`. `composeArtImage` clamps the canvas to at least 1 x 1 px and draws only
the base colour for art with a zero size, instead of passing NaN to `UIGraphicsImageRenderer`.
`downscale` never asks for a zero-size canvas. The array indexing in `targets/widget` was checked,
and every index access is behind a count or shape guard.
