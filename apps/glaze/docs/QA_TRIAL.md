# QA walk-through before the Expo Go trial (T09 part B)

Date: 12 Oct 2026. **Nothing here has run on a device or in Metro.** The npm registry is
unreachable in the build environment, so there is no `node_modules`: no `expo start`, no
`expo export` and no real `tsc` over the UI. This is a code read of every file under `app/`,
`src/ui`, `src/render`, `src/store` and `src/native`, plus the `src/core` APIs they call.

## How it was checked

- **Read-through** of every screen and component, following each flow below.
- **Offline compile with stand-in types.** Throwaway ambient declarations (not committed)
  approximated `@types/react` 19, `react-native` 0.81 and the Expo SDK 54 packages, including
  the exact list of 287 Feather glyph names. `tsc --strict --jsx react-jsx` then checked all 56
  UI files together with the real `src/core` sources. Result: **0 errors**, before and after the
  fixes. A deliberate-error file confirmed the setup catches bad props, bad Feather names, bad
  accessibility roles, `'50'` widths and ref misuse. Limits: the stand-ins are looser than the
  real package types in places (expo-router screen options, react-native-svg props), so
  `npx tsc --noEmit` on the PC is still the real check.
- **Scripted checks:** every `Pressable` has `accessibilityRole` and `accessibilityLabel`, and
  every hit area is at least 48 pt (26 found). The glyph list in `src/core/glyphnames.ts` matches
  Feather 4.29 exactly. No competitor names appear in code or copy (the only hit is the guard
  test's own regex). Nothing imports `src/plus`, `expo-modules-core` or reanimated directly.
- `npm test`: 138/138 pass. `sh ops/typecheck-core.sh`: clean.

## Fixes made

1. **The Haptics setting was ignored almost everywhere.** 11 files called `expo-haptics`
   directly, so turning Haptics off in Settings only affected the Settings screen. They now all
   use `haptic()` from `src/ui/haptics.ts`: selection and impact become `'select'`, Success
   becomes `'success'`, and Warning or Error become `'warning'`. Only `src/ui/haptics.ts`
   imports `expo-haptics` now.
2. **Theme detail → Apply opened a second copy of the tab bar.** Steps 2 ("Use this icon
   style") and 4 ("Make a loop") called `router.push('/icons')` and `router.push('/live')`. In
   expo-router 6, `push` always adds a screen, so the root stack got a second `(tabs)` navigator
   with no back button. Both now use `router.navigate`, which returns to the existing tabs and
   switches tab. The Install step still pushes `/install`, which is correct for a stack screen.
3. **Icon Studio "Show labels" toggle was a bare 31 pt `Switch`.** It now uses the shared
   `SwitchRow`, so the whole row (at least 48 pt) is the target and it has switch semantics.
4. **Wallpaper maker style/pattern segments were 42 pt tall.** They now have `hitSlop={3}`, which
   gives a 48 pt target.

## Flow by flow

### Themes → theme detail → Apply
- Checked: the tips load and dismiss (storage errors are caught); the 2-column grid width maths;
  `ThemeCard` → `HomeMock` (`specs`, `width`, `maxIcons`, `dockCount=0`, `background`) works
  with an empty dock; `/theme/${id}` matches `app/theme/[id].tsx`, which is registered in the
  root Stack; a missing theme shows "Theme not found" and no hooks run conditionally; the Home
  and Lock previews (`LockMock` props); the palette chips; the 4-step walk. "Save wallpaper"
  uses `useWallpaperSaver`, which never throws and has a denied state with Open Settings.
  `setStudioStyle(style, themeId, averageColour)` matches the store signature, and Icon Studio
  reloads it on focus.
- Fixed: #2 above, plus haptics.
- Needs the iPhone: whether the off-screen full-size wallpaper capture comes out correct and not
  blank (see risks); the Photos "Add only" permission prompt; the saved image size.

### Wallpaper maker (`/wallpaper`)
- Checked: `?theme=` param handling, falling back to the first theme; style, pattern, angle,
  grain and colour controls; size rows; the save statuses (saved / denied + Open Settings /
  error); the 4 s auto-hide timer cleans up.
- Fixed: #4, plus haptics.
- Needs the iPhone: capture timing (3 frames after mount) at full resolution with grain; how
  smoothly the SVG preview redraws.

### Icon Studio + override sheet
- Checked: hooks run before the loading return; picker search and categories (including "My
  apps"); toggling and removing apps; custom app validation (result union narrowing); style
  controls (`Segmented`/`Swatches` generics, `makeBackground`/`backgroundBase`); contrast
  warnings map to labels; the Install CTA pushes `/install`. Override sheet: fields reset when it
  opens for another app; the photo picker handles denied, cancelled and error states and copies
  the photo into documents (`keepIconImage`); the old copy is deleted; glyph search is capped at
  48; reset removes the photo copy.
- Fixed: #3, plus haptics.
- Needs the iPhone: keyboard covering the label field inside the bottom sheet (RN `Modal`, no
  keyboard avoidance); scrolling in the sheet with many glyph cells.

### Install: bulk profile + Shortcuts
- Checked: hooks run before the early returns; the empty set links to `/icons` with `navigate`;
  `OffscreenIconRenderer` is mounted before `renderAll` is called; the progress phases; the
  profile is written to `cacheDirectory` with `expo-file-system/legacy`; `shareAsync` uses the
  MIME type and no UTI, as `docs/SPIKE_PROFILE.md` decided; "share again" checks the file still
  exists; the step cards and checklist persist (`useInstallState`). Shortcuts: Photos access, an
  album that falls back to Recents, base64 PNG → `createAssetAsync`, copying the link to the
  clipboard, `shortcuts://` failing with a message. Every async path is guarded by `alive` or
  try/catch.
- Fixed: haptics.
- Needs the iPhone: off-screen icon capture (blank or correct pixels, user photos loading within
  the 150 ms settle time); "Save to Files" showing for a `.mobileconfig` from Expo Go; Files →
  "Profile Downloaded" → Settings install; creating the album with Limited Photos access.

### Live: list + editor + unavailable sheet
- Checked: reload on focus; the picker (videos + images, `Current` representation so GIFs stay
  animated); still photos are rejected; a private copy of the source; `newProject` → `upsertProject` →
  push `/live/[id]` (registered in the root Stack, no clash with tab `/live`); delete removes the
  copy; playlist add/move/remove. Editor: loading and missing states; `useVideoPlayer` is only
  mounted for videos with a real URI; intervals are cleared and player access is wrapped in
  try/catch after release; pan/pinch run on JS (`runOnJS(true)`) under the root
  `GestureHandlerRootView`; scrolling is disabled while dragging; edits save on a 400 ms debounce
  and when leaving. "Set on Lock Screen" → `livelock.isAvailable()` reports `expo-go` in Expo Go
  → explainer sheet with the Live Photo steps; it never throws.
- Fixed: haptics.
- Needs the iPhone: pinch/pan feel; trim handle drags inside the ScrollView; looping the trimmed
  range with the 40 ms poll; GIF thumbnails.

### Settings
- Checked: default style edits detach the theme (`themeId: null`), as in Icon Studio; the
  Haptics switch updates the cached setting synchronously, so `haptic()` respects it straight
  away (now app-wide, fix #1); reduce motion feeds the toast animation; "Show tips again" plus a
  toast; the "How icons work" sheet uses `removeGuide()`; the version comes from
  `expo-constants`; "Data Not Collected".
- Needs the iPhone: nothing specific beyond a visual pass in light and dark mode.

### App shell
- `app/index.tsx` redirects to `/themes`; tab names match the files; the root Stack registers
  `(tabs)`, `theme/[id]`, `install`, `wallpaper`, `live/[id]`. The root `ErrorBoundary` export
  matches expo-router's `ErrorBoundaryProps` and hides the splash screen. Fonts, including the
  Feather glyph font for capture, block the first render until loaded or failed. Order of
  providers: GestureHandlerRootView > SafeAreaProvider > ToastProvider > Stack.

## Still to confirm on the PC (registry reachable)

1. `npx expo install --fix`, then `npx tsc --noEmit`. Expected trouble spots, if any:
   expo-router `screenOptions` keys (`sceneStyle`, `tabBarItemStyle`), react-native-svg prop
   types, the `react-native-view-shot` ref parameter type, and `expo-file-system/legacy`
   resolution under `expo/tsconfig.base`.
2. `npx expo export --platform ios`, to check the Metro bundle resolves every import
   (`requireOptionalNativeModule` from `expo`, `expo-file-system/legacy`).

## Remaining risks for the iPhone trial

- **Off-screen capture on iOS.** Icon and wallpaper capture render at `left: -10000` and use
  view-shot's default `drawViewHierarchyInRect`. If the PNGs come out blank, move the off-screen
  host on screen at `opacity: 0` behind content, or pass `useRenderInContext: true`.
- **Profile delivery from Expo Go** (Save to Files → install) is still unproven on a device. The
  fallbacks are in `docs/SPIKE_PROFILE.md`.
- Feather glyphs are a font drawn as an overlay. Capture relies on the font preloading in the
  root layout.
- Gesture callbacks rely on `runOnJS(true)` with the worklets Babel plugin that
  babel-preset-expo adds automatically. Not exercised.

## TRIAL2 integrated QA (T31, 12 Oct 2026)

Answers owner review §10E ("test the full flow together"). **Still no device, Metro or
`node_modules`:** this is a code walk-through of the merged T23–T30 work plus core tests.
Nothing below has run on an iPhone.

### Cloud-checked

- **Routes:** every push target exists and is registered in `app/_layout.tsx` (`/wallpaper`,
  `/theme/[id]`, `/add-app`, `/tips`, `/feedback`, `/install`, `/live/[id]`); `/live?new=1` is the
  Live Lock tab reading `new`. Copy says "Live Lock" for the tab everywhere.
- **State interplay (core, `src/core/trial2.test.ts`, 9 tests):** applying a theme bakes in the
  shape chosen for it and keeps its artwork; a theme override and an "all themes" override both
  reach the exported specs with the theme shape; the theme's own override wins in its theme and
  stays out of other themes; restore goes back to the artwork and keeps images in My images;
  `iconFor` agrees with `studioSpecs`; an uploaded image for a user-added app lands in the bulk
  profile plan, and an app without a URL scheme goes to Photos + Shortcuts.
- `npm test`: 317/317 pass. `bash ops/typecheck-core.sh`: clean.

### Bugs found and fixed

1. **Lost updates between screens.** The theme page, its "Override an icon" row and other
   panels each held their own copy of the Icon Studio state; saving one copy overwrote edits made
   through another (e.g. pick a shape, then upload an override: the shape choice was lost).
   `useStudio` now re-applies each change to the latest saved state and tells the other mounted
   screens (`src/store/studio.ts`).
2. **Override row previewed the wrong shape.** It drew the theme's default shape, not the one
   the user picked (`src/ui/ThemeOverrideRow.tsx`).
3. **Legacy theme ids.** If the applied theme was stored under an old id, overrides made from
   the theme page or `/add-app` went under the new id and never reached the export. Both now use
   the stored key, as the theme page and Your look already did.
4. **Missing override image file** (deleted, or not restored with a backup) would export a blank
   icon. `/install` now checks each image exists and falls back to the theme artwork with a note
   (`withoutMissingImages` in `src/core/install.ts`).
5. **Missing background photo** showed a blank preview; `loadBackground` now falls back to the
   theme design when the photo copy is gone.
6. IconOverrideSheet's "360 × 360 px" now comes from `PHOTO_ICON_SIZE`.

### Graceful paths confirmed by reading

Photos permission denied (wallpaper, theme Apply, add-app sample, override upload: each explains
and offers Open Settings); unsupported or unreadable picked file (error text, no crash); small
image (sharpness warning); profile file cleared from cache (asks to generate again); any render
crash (root ErrorBoundary with Try again and **Report a problem**). The Icons tab keeps its old
inline add-app form and also links to `/add-app` ("Missing an app?").

### Needs the owner's iPhone

- The whole checklist in `docs/TRIAL.md` ("What to try", TRIAL2), in order.
- Shape + artwork + override image in the captured PNGs (not blank), in both install paths.
- Two screens open at once (theme page + override row): shape and override both stick after
  leaving and coming back.
- Photo background crop and save at the phone's real size; Live Lock save-to-Photos sheet.
- Profile install from Expo Go (still unproven on a device).
