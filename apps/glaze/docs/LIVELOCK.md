# Live Lock Screen (T10)

**Status: Not yet tested on a device.** The Swift code was written and reviewed offline (no Xcode,
no iOS 26 SDK available when it was written). Treat everything below as the intended behaviour
until the device test steps at the end have been run and signed off.

## What it does

The user picks a video or GIF, crops / trims / sets speed in the loop editor (`app/live/[id].tsx`),
then taps **Set on Lock Screen** (or **Set playlist on Lock Screen** on the Live tab). On iOS 26+
the loop plays as the animated artwork of a muted Now Playing item, so it fills the Lock Screen
every time the iPhone wakes. Playlists step with the Lock Screen's next / previous buttons.

## How it works

```
app/live/[id].tsx, app/(tabs)/live.tsx
  └─ src/ui/LiveUnavailableSheet.tsx   setOnLockScreen / stopLockScreen / useLivelockState / LivelockRunningCard
       └─ src/native/livelock.ts       adapter: requireOptionalNativeModule('GlazeLivelock'), never throws when unavailable
            ├─ src/core/livelockPayload.ts   pure payload builder + validator (tested with node:test)
            └─ modules/glaze-livelock         local Expo module (Swift, iOS only)
                 ├─ GlazeLivelockModule.swift    isSupported / start(json) / stop / next / getState, event onState
                 ├─ LivelockPayload.swift        Decodable mirror of the JS payload
                 ├─ LoopExporter.swift           crop + trim + speed -> portrait .mov, no audio, in Caches/GlazeLivelock
                 └─ NowPlayingController.swift   audio session, silent loop, Now Playing info, remote commands
```

1. **Payload.** The adapter builds `{ version: 1, export, projects[] }` with
   `buildLivelockPayload(projects, deviceForScreen(screen))`. `export` is
   `exportSettings(device)` from `src/core/loop.ts`: native portrait pixel size, 30 fps,
   HEVC, no audio, ≤ 15 s. Each project carries its source URI (local `file://` only), trim,
   speed and a pixel `cropRect` at the Lock Screen aspect (`cropRect()` from loop.ts).
   Invalid, remote and duplicate projects are skipped; the playlist is capped at 12.
2. **Export.** `LoopExporter` builds an `AVMutableComposition` with the video track only (no
   audio track is ever added), inserts the trimmed range, scales it for speed, and renders it
   through an `AVMutableVideoComposition` (preferred transform → crop → aspect-fill into the
   export size) with `AVAssetExportSession` (HEVC preset when available, else H.264). GIFs are
   decoded with ImageIO and written frame-by-frame with `AVAssetWriter` at the payload bitrate.
   Output goes to `Caches/GlazeLivelock/loop-<hash>.mov`, keyed by every input, so restarting the
   same playlist does not re-encode; loops no longer in use are pruned after each start.
3. **Now Playing.** `NowPlayingController` sets `AVAudioSession` to `.playback` without
   `.mixWithOthers` (a mixable session cannot become the Now Playing app), and loops a silent
   16-bit PCM WAV that is generated in code at runtime (no bundled audio asset).
   `MPNowPlayingInfoCenter.nowPlayingInfo` gets title = loop name, artist = "Glaze", a still
   artwork (first frame), `IsLiveStream` (no fake scrubber), queue index / count and, on iOS 26+,
   the animated artwork built from the exported video (`makeAnimatedArtwork`).
4. **Controls.** `MPRemoteCommandCenter`: play, pause, toggle play/pause, next / previous track
   (enabled only for playlists of 2+). Seek and skip commands are disabled.
5. **Robustness.** Audio interruptions (calls, Siri, other apps) pause and resume when the system
   says `shouldResume`; route changes refresh Now Playing (the audio is silent, so nothing audible
   changes); a media-services reset rebuilds the player; Low Power Mode stops the feature.
6. **Stop.** `stop()` stops the player, removes remote command targets and observers, clears
   `nowPlayingInfo` and deactivates the session with `.notifyOthersOnDeactivation`, so the
   user's music app can resume. A stop while still exporting cancels that start.
7. **Background.** `native-plugins/livelock.json` adds `UIBackgroundModes: ["audio"]`; app.config.ts
   merges it only when `GLAZE_NATIVE=1`, so Expo Go never sees it.

## Availability and fallbacks

`livelock.isAvailable()` returns, in order:

| Where | Result | What the user sees |
| --- | --- | --- |
| Android | `android` | Explainer sheet (iPhone feature) |
| Expo Go | `expo-go` | Explainer sheet + Live Photo steps |
| iOS < 26 | `ios-version` | Explainer sheet + Live Photo steps |
| Native build without the module, or built with a pre-iOS 26 SDK | `not-built` | Explainer sheet |
| iOS 26+ dev/production build | available | Starts; running card with Stop |

Below iOS 26 the fallback is a **Live Photo** (T11: pair a still and a MOV with a shared content
identifier and save to Photos; until T11 lands the sheet explains how to make one with Camera).
The Swift module also reports `isSupported() -> { supported: false, reason: "ios-version" }` below
iOS 26, and `start()` rejects there, so nothing runs even if JS checks were bypassed.

## Battery and the off switch

- Cost: an active audio session plus the system decoding the artwork video whenever the Lock
  Screen is visible. The silent track is 8 kHz mono, looping every 10 s, to keep audio work small.
  Encoding happens once per loop edit (cached), not on every start.
- **Off switch:** the running card in the loop editor has **Stop Live Lock Screen**; the Lock
  Screen's pause control pauses it; Low Power Mode switches it off automatically.
- It never starts on its own: only a tap on Set on Lock Screen starts it, and it does not
  restart after the app is killed or the phone restarts.
- Measure on a device before release (see test steps) and write the numbers here.

## App Review notes (guideline 2.5.4, background audio)

Points to make in the review notes, and to keep true in the code:

- Glaze is a legitimate Now Playing item: the user chooses to start it, it shows a titled item
  ("<loop name>" by "Glaze") with working play / pause (and next / previous for playlists).
- It is user-started only (button tap), visibly controllable on the Lock Screen, and stops on
  demand (Stop in the app, pause on the Lock Screen, Low Power Mode). Stopping clears the Now
  Playing item and hands audio back to other apps.
- The background audio mode is used only while the user has Live Lock Screen running; there is no
  other background work, no network, and the user's video never leaves the device.
- Starting it pauses other audio (that is how iOS chooses the Now Playing app). The start alert and
  this doc say so; the review notes should too.
- Similar Lock Screen loop apps exist on the store; that is precedent, not a guarantee.

## Things to verify on the PC / device

- **`makeAnimatedArtwork` in `NowPlayingController.swift`** (marked `// VERIFY against Apple docs
  (iOS 26 SDK)`): class `MPMediaItemAnimatedArtwork`, its initialiser
  `(artworkID:previewImageRequestHandler:videoAssetFileURLRequestHandler:)`, the keys
  `MPNowPlayingInfoProperty3x4AnimatedArtwork` / `MPNowPlayingInfoProperty1x1AnimatedArtwork`,
  `MPNowPlayingInfoCenter.supportedAnimatedArtworkKeys`, and whether the 3x4 artwork expects a
  3:4 video (we export at the screen aspect) or has size / duration / codec limits. Follow
  Apple's "Providing animated artwork for media items".
- `#if compiler(>=6.2)` assumes the iOS 26 SDK ships with Swift 6.2 (Xcode 26).
- ExpoModulesCore API: `Promise.reject(code, description)`, `promise.resolve(nil)`,
  `.runOnQueue(.main)`, `OnDestroy`.

## Test steps on a development build

1. On the PC (Mac with Xcode 26 for a local build, or EAS):
   `GLAZE_NATIVE=1 npx expo prebuild --clean` → check `ios/Glaze/Info.plist` has
   `UIBackgroundModes = [audio]` and `ios/Podfile.lock` lists `GlazeLivelock`.
2. `npx tsc --noEmit`, `npm test`.
3. `eas build --profile development --platform ios` (or `npx expo run:ios --device`), install on an
   iPhone with iOS 26+.
4. Live tab → New loop → pick a portrait video; crop, trim to ~5 s, speed 1×. Tap **Set on Lock
   Screen**: the running card shows "Preparing…", then the alert. Lock the phone: the loop should
   fill the Lock Screen and animate.
5. Pause from the Lock Screen → the card shows "Paused"; play resumes.
6. Add three loops to the playlist, tap **Set playlist on Lock Screen**; next / previous on the Lock
   Screen should step through them; **Next loop** in the app too.
7. Interruptions: play music in another app (Live Lock Screen pauses), take a call, use Siri;
   unplug headphones. Check it resumes or stays sensibly paused.
8. Turn on Low Power Mode → it stops; the card disappears.
9. **Stop Live Lock Screen** → Now Playing disappears from the Lock Screen; music apps can play.
10. GIF source, a landscape video, a 4K HEVC video, a 60 s video (only 15 s exported).
11. Battery: 1 hour with the phone locked and woken every 5 minutes, with and without Live Lock
    Screen; note the difference here.
12. Expo Go and Android: Set on Lock Screen still shows the explainer sheet, nothing crashes.

Not yet tested on a device.
