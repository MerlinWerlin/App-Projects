# QA trial: Expo SDK 54 API audit (D3-2)

Static audit of every import and API call in `app/*.tsx`, `src/ui`, `src/native`, `src/plus` and `src/theme`, checked against the Expo SDK 54 API surface from memory (the npm registry was not reachable, so nothing was installed or type-checked against real `.d.ts` files). `src/core` was not changed.

**Result: no definite bugs, no code changes.** Every package that gets imported is listed in `package.json`. `react-native-reanimated` is not imported anywhere, so it doesn't need to be a dependency: all gestures use `.runOnJS(true)` with RN state, and the toast uses RN `Animated`. Expo Router's `Link` is also never imported (all navigation goes through `useRouter`).

How to read the table: **ok** = I'm confident this matches SDK 54. **uncertain** = probably fine, but check it on the trial. The "If wrong" column says what the owner would see in Expo Go or in the trial log.

## Dependencies vs imports

| Import | In package.json | Note |
|---|---|---|
| expo-camera, -media-library, -router, -file-system, -image-manipulator, -image-picker, -keep-awake, -haptics, -constants, -splash-screen, -status-bar | yes (SDK 54 `~` ranges) | |
| react-native-gesture-handler ~2.28, -safe-area-context ~5.6, -svg 15.12.1, (-screens ~4.16, needed by the router) | yes | All bundled in Expo Go 54 |
| @expo/vector-icons ^15, @expo-google-fonts/fraunces + inter ^0.4 | yes | |
| @react-native-async-storage/async-storage 2.2.0 | yes | Bundled in Expo Go |
| jpeg-js, upng-js | yes | Pure JS. `upng-js` gets its types from `src/types/upng-js.d.ts` |
| react-native-reanimated | no, and not used | ok |

## expo-camera 17 (`app/trace.tsx`, `src/ui/useTimelapse.ts`, `src/ui/usePaperCheck.ts`)

| API used | Conf. | Note | If wrong |
|---|---|---|---|
| `CameraView`, `useCameraPermissions()` returning `[permission, request]` | ok | Current SDK 54 API (the old `Camera` component is gone) | — |
| props `facing="back"`, `enableTorch`, `mode`, `mute`, `onCameraReady`, `ref` | ok | All valid `CameraViewProps` | Prop ignored silently (a TS error only if you type-check) |
| `ref.takePictureAsync({ quality: 0.5 })` returning `{ uri, width, height }` | ok | Result is guarded by `isSnapshot` | Toast "Camera isn't ready yet" / compare view never opens |
| `ref.recordAsync({ maxDuration })` then `stopRecording()` | ok | Needs `mode="video"` first. The code switches mode and waits for `onCameraReady` or a timeout | Toast "Recording stopped unexpectedly" |
| Recording with `mute` and no microphone permission | uncertain | iOS Expo Go's Info.plist already has a mic string. On Android, `recordAudioAndroid:false` / `blockedPermissions` only apply to dev/prod builds, not Expo Go | Recording fails at once on one platform: the "Recording stopped unexpectedly" toast |
| Re-firing `onCameraReady` after a mode change | uncertain | The code already has a timeout fallback | First clip starts late, or an empty clip |

## expo-media-library 18 (`src/native/mediaLibrary.ts`)

| API used | Conf. | Note | If wrong |
|---|---|---|---|
| `getPermissionsAsync(true)` / `requestPermissionsAsync(true)` (writeOnly) | ok | Signature is `(writeOnly?, granularPermissions?)` | — |
| `saveToLibraryAsync(uri)` | ok | Accepts video files | Toast "Couldn't save the video to Photos (…)" |
| Android Expo Go media library access | uncertain | In SDK 54, Expo Go on Android warns that it can't give full media-library access. Write-only save should still work, but check it | Yellow-box warning about Expo Go media library, or a "denied" result |
| `usePermissions` / `createAssetAsync` | not used | — | — |

## expo-router 6 (all `app/` screens, `src/ui/useSketchSteps.ts`, `src/ui/useTimelapse.ts`)

| API used | Conf. | Note | If wrong |
|---|---|---|---|
| `Stack`, `Stack.Screen` with `options` (`title`, `headerShown`, `animation: 'fade'`) | ok | | — |
| `export function ErrorBoundary`, `type ErrorBoundaryProps` (`error`, `retry`) | ok | | Red screen instead of the app's own error screen |
| `useRouter()`: `push` (string and `{pathname, params}`), `replace`, `back`, `canGoBack` | ok | `typedRoutes: false`, so string paths are fine | — |
| `useLocalSearchParams<T>()` | ok | Values can be `string | string[]`, and `templates.tsx` handles arrays | — |
| `useFocusEffect(useCallback(...))` | ok | | — |
| `main: "expo-router/entry"`, `expo-router` plugin, `scheme` | ok | | "No routes found" |

## expo-file-system 19 (`src/native/storage.ts`, `src/native/outlineDeps.ts`, `src/ui/useTimelapse.ts`, `src/ui/usePaperCheck.ts`)

| API used | Conf. | Note | If wrong |
|---|---|---|---|
| `import * as FileSystem from 'expo-file-system/legacy'` | ok | Valid in SDK 54. The root import is now the new `File`/`Directory`/`Paths` API, and its legacy functions throw. The code uses `/legacy` throughout, which is correct | Throws "Method getInfoAsync imported from expo-file-system is deprecated" (only if the root import were used) |
| `documentDirectory`, `cacheDirectory`, `getInfoAsync`, `makeDirectoryAsync({intermediates})`, `copyAsync`, `deleteAsync({idempotent})`, `readDirectoryAsync`, `writeAsStringAsync` + `EncodingType.Base64` | ok | All present in legacy | — |
| `/legacy` removed in a future SDK | uncertain (future) | Expected to be dropped in a later SDK. Migrate to `File`/`Directory` before SDK 55/56 | Module not found at bundle time after an SDK bump |

## expo-image-manipulator 14 (`src/native/outlineDeps.ts`)

| API used | Conf. | Note | If wrong |
|---|---|---|---|
| `manipulateAsync(uri, actions, { compress, format, base64 })`, `SaveFormat`, `type Action` | ok / uncertain | Still exported in v14 but deprecated in favour of `ImageManipulator.manipulate(uri).resize().renderAsync()` then `saveAsync`. It works, but may log a deprecation warning | A yellow-box or Metro "manipulateAsync is deprecated" warning; no functional change |

## Other Expo modules

| File | API used | Conf. | Note / If wrong |
|---|---|---|---|
| `app/index.tsx` | `ImagePicker.launchImageLibraryAsync` / `launchCameraAsync({ mediaTypes: ['images'], quality: 1 })`, `requestCameraPermissionsAsync`, `result.canceled` / `assets` | ok | The array form of `mediaTypes` is the current one (`MediaTypeOptions` is deprecated). If wrong: a deprecation warning only |
| `app/trace.tsx` | `activateKeepAwakeAsync()` / `deactivateKeepAwake()` | ok | If wrong: the screen dims while tracing |
| `app/lightbox.tsx` | `useKeepAwake()` | ok | Same |
| `src/native/haptics.ts` | `impactAsync(ImpactFeedbackStyle.Light)`, `selectionAsync()` | ok | Errors are caught, so the worst case is no buzz |
| `app/_layout.tsx` | `SplashScreen.preventAutoHideAsync` / `hideAsync` | ok | If wrong: the splash screen stays up |
| `app/settings.tsx` | `Constants.expoConfig?.version` | ok | Falls back to '0.1.0' |
| `app/*`, `src/ui/*` | `StatusBar` from expo-status-bar | ok | |

## UI libraries

| File | API used | Conf. | Note / If wrong |
|---|---|---|---|
| `app/_layout.tsx` | `GestureHandlerRootView style={{flex:1}}` wraps `Stack` | ok | If missing: "GestureDetector must be used as a descendant of GestureHandlerRootView" |
| `app/trace.tsx`, `app/lightbox.tsx`, `src/ui/LabeledSlider.tsx`, `src/ui/VerticalSlider.tsx` | `Gesture.Pan/Pinch/Rotation/Tap/LongPress`, `.runOnJS(true)`, `.minDuration`, `.onStart/onUpdate/onEnd/onFinalize`, `Gesture.Race/Simultaneous`, `GestureDetector` | ok | `runOnJS(true)` means no worklets and no Reanimated dependency. If wrong: gestures do nothing, or a "worklet" error |
| `app/prepare.tsx`, `src/ui/GridOverlay.tsx`, `src/ui/TemplateSvg.tsx` | `Svg`, `Defs`, `Pattern`, `Rect`, `Line`, `Path` from react-native-svg | ok | |
| Many files | `Feather` icons: aperture, arrow-left, camera(-off), check(-circle), chevron-left/right, clock, columns, edit-3, grid, image, lock, maximize, plus, refresh-cw, rotate-ccw/cw, shield, sidebar, smartphone, sun, trending-up, x | ok | All exist in Feather. If wrong: a "?" glyph and a console warning |
| `app/_layout.tsx`, `src/theme/tokens.ts` | `useFonts`, `Fraunces_600SemiBold`, `Fraunces_700Bold`, `Inter_400Regular/500Medium/600SemiBold` | ok / uncertain | The names match the @expo-google-fonts naming. Fraunces 0.4.x export names weren't checked against the package. If wrong: Metro "… is not exported", or system font fallback |
| `src/ui/*` | `useSafeAreaInsets`, `SafeAreaView`, `SafeAreaProvider` | ok | |
| `src/native/settings.ts`, `src/native/storage.ts`, `src/plus/usePlus.ts`, `app/trace.tsx` | `AsyncStorage.getItem/setItem` | ok | |

## Uncertain items to watch on the device trial

1. Video recording without the microphone in Expo Go (mostly Android). Look for the toast "Recording stopped unexpectedly".
2. The Android Expo Go media-library warning, and whether write-only save to Photos still works.
3. `onCameraReady` re-firing after the switch to `mode="video"` (there's already a fallback timeout).
4. The `manipulateAsync` deprecation warning (cosmetic). Migrate to `ImageManipulator.manipulate` later.
5. `expo-file-system/legacy` is valid in SDK 54 but will be removed in a future SDK. Plan the migration. All four call sites now go through `src/native/fs.ts` (D5-1), so the migration touches that one file.
6. The Fraunces font export names (low risk).

## SDK 57 (fb-1017, 17 Oct 2026)
The owner's Expo Go and TestFlight builds use **Expo SDK 57**. package.json now pins `expo` and every `expo-*` package to `~57.0.0` (since SDK 55 all Expo packages share the SDK major version), adds `react-dom` (the web renderer peer the PC install added) and lists the `expo-splash-screen` / `expo-status-bar` config plugins as on the PC. React, React Native and the community libraries (gesture-handler, svg, screens, safe-area, async-storage) keep their old pins in the repo because the exact SDK 57 versions could not be looked up from the cloud (npm unreachable); START_TRIAL's `npx expo install --fix` sets them to the SDK 57 versions on the PC, and the PC copy already has them. Config tests accept the PC's own START_TRIAL.cmd (strict kit checks apply only to the kit's copy and start-trial.sh).
