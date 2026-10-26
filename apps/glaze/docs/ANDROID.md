# Android: video live wallpaper + pinned shortcuts (T13)

**26 October Android preparation:** the native module now compiles in the standalone `.playtest` APK (GitHub run 40281924740). Signature, embedded JS and 16 KB native/ZIP alignment checks pass. Launcher and wallpaper behavior still need device checks; compilation is not feature verification. See the repository's `docs/GOOGLE_PLAY.md` for the current install/launch evidence. Spots marked `// VERIFY` still need a real device.

## Pieces

| Piece | Where |
| --- | --- |
| Native module `GlazeAndroid` (Kotlin, Expo Modules API) | `modules/glaze-android/android/src/main/java/app/glaze/androidmodule/GlazeAndroidModule.kt` |
| Wallpaper service | `modules/glaze-android/android/src/main/java/app/glaze/androidmodule/GlazeVideoWallpaperService.kt` |
| Service declaration + wallpaper metadata | `modules/glaze-android/android/src/main/AndroidManifest.xml`, `res/xml/glaze_wallpaper.xml` |
| Typed wrapper (not imported by app code) | `modules/glaze-android/index.ts` |
| Adapter (the only thing app code uses) | `src/native/android.ts` |
| Payload helpers + tests (pure TS) | `src/core/androidPayload.ts`, `src/core/androidPayload.test.ts` |
| UI | "Set as live wallpaper" in `app/live/[id].tsx`; "Android: add each icon with Pin to Home Screen" in `app/install.tsx` (both Android-only) |

The module lives in `modules/`, which Expo autolinking scans by default, so a development build picks it up with no `package.json` entry. Its library manifest merges into the app manifest, so no config plugin or `native-plugins/*.json` file is needed (no extra permission either: the picker intent doesn't need `SET_WALLPAPER`).

Kotlin package / Gradle namespace is `app.glaze.androidmodule`, not `app.glaze.native`: `native` is a reserved Java word, and autolinking generates Java (`ExpoModulesPackageList.java`) that imports the module class.

## Live wallpaper

1. The loop editor's **Set as live wallpaper** calls `androidNative.setVideoWallpaperWithFeedback(project)`.
2. The adapter builds `{ uri, trim: { startMs, endMs }, speed }` with `wallpaperJson()` (GIFs are refused: `MediaPlayer` plays video files only; `endMs: 0` means "play to the end").
3. `setVideoWallpaper(json)` copies the source video into `filesDir/glaze-wallpaper.mp4` (picker grants and cache files don't last), rewrites `uri` to that file and saves the JSON in SharedPreferences `glaze.wallpaper` / key `config`.
4. If Glaze Live is already the active wallpaper, the running service hears the preference change and reloads. Otherwise the module opens `WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER` with `EXTRA_LIVE_WALLPAPER_COMPONENT` pointing at the service, falling back to `ACTION_LIVE_WALLPAPER_CHOOSER`. The user confirms in the system screen (home, lock or both is the system's choice).

The service (`WallpaperService` + `Engine`):

- `android.media.MediaPlayer` drawing to the engine's surface, volume 0.
- Trim: seeks to `startMs` when prepared; a main-thread `Handler` checks every 50 ms and seeks back to `startMs` once playback passes `endMs`; completion also returns to `startMs`. Full-length loops use `MediaPlayer` looping.
- Speed: `PlaybackParams.setSpeed` (API 23+), applied only while playing (setting it on a paused player starts playback).
- Centre-crop: `VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING` fills the screen and crops the overflow. The editor's pan/zoom crop is not applied yet (VERIFY / follow-up).
- Battery: `onVisibilityChanged(false)` pauses the player and stops the trim poll; `true` resumes. The player is released when the surface or engine is destroyed.

## Pinned shortcuts (icons)

- **Pin icons to Home Screen** on `/install` (Android builds only) renders each icon to a 360 px PNG with the existing offscreen renderer, then pins them one at a time: Glaze asks "Pin <name>?" (Pin / Skip / Stop), then the launcher shows its own confirmation.
- `pinShortcut(json)` uses `android.content.pm.ShortcutManager` directly (API 26+, no androidx dependency): `ShortcutInfo` with `id` (`glaze-<appId>`, ≤ 64 chars), short label ≤ 10 chars, long label ≤ 25, `Icon.createWithBitmap(png)` and `Intent(ACTION_VIEW, Uri.parse(url))`, then `requestPinShortcut`.
- Icons carry the Glaze theme's shape and colours in the bitmap itself. Android 13 "themed icons" (monochrome) apply to app icons, not shortcut bitmaps (VERIFY on a Pixel).
- Android destinations are now separate from the iPhone catalogue (`src/core/androidShortcut.ts`). Phone, Messages, Mail and Maps use standard Android intents; Spotify, YouTube, Instagram, WhatsApp, Chrome and Gmail use their launchable packages. HTTP(S) links may open a browser or verified app link. Unsupported entries are skipped. Native code checks that a destination resolves before requesting the pin and explains missing apps. The manifest declares only these targeted package/intent queries, without an installed-app inventory permission. Broader catalogue support remains work to validate.

## Android screen and permissions

Android's install screen shows the launcher flow without Safari, configuration profiles or Apple Shortcuts instructions. Image/video selection uses the system picker without requesting broad library access first. Saving owned images on Android 10+ avoids a library permission prompt; older versions keep the write-only permission path. The compiled Play APK contains no READ_MEDIA_IMAGES/VIDEO/AUDIO, microphone or overlay permission. Legacy storage, camera and wake-lock entries still need the final release audit. Picker/save flows and wallpaper pause/reboot behavior remain device QA gates.

## Fallbacks (adapter)

`androidStatus()` / `isAvailable()` return `{ available, reason }` with `reason` one of `expo-go`, `ios`, `not-built` or `null`. The adapter never throws; results are `requested`, `unsupported`, `unavailable`, `not-playable`, `no-link` or `error:<reason>`. In Expo Go on Android both buttons explain that the feature arrives with the full build; on iOS neither appears.

## Test steps on a development build (owner, on the PC + an Android phone)

1. `GLAZE_NATIVE=1 npx expo prebuild -p android` - check `android/app/build.gradle` builds and the merged manifest lists `app.glaze.androidmodule.GlazeVideoWallpaperService`.
2. `npx expo run:android` with a phone connected (USB debugging on), or an emulator with Google APIs.
3. Live tab → new loop from a video → trim to a few seconds, speed 1.5× → **Set as live wallpaper** → the system preview shows the loop → Set wallpaper.
4. Check: loop restarts at the trim start; no sound; fills the screen (cropped, not stretched); lock the phone / open another app and confirm playback pauses (e.g. `adb shell dumpsys media.player` or battery stats); returns on unlock.
5. Set a different loop while Glaze Live is active → wallpaper switches without the picker.
6. Reboot → wallpaper still plays (file in `filesDir`).
7. Icons tab → build a set → Install → **Pin icons to Home Screen** → confirm a few → icons appear with the right labels and open the apps (or note which links don't resolve on Android).
8. Try a launcher without pin support (or Android 7) → "Not supported here" message, no crash.
9. Expo Go on Android → both buttons show the "full build" explanation.
