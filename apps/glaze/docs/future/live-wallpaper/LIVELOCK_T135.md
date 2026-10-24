# Live Lock Screen: continuous loop (T10, fixed in T135)

**Status: not yet tested on a device.** T135 fixed the code against Apple's documentation. The
owner's TestFlight run of the T10 version is the only device feedback so far: it showed a small
static player.

> **History.** T10 built a Now Playing loop. On the owner's TestFlight build it showed only a small
> player over the normal wallpaper, and tapping it did nothing. T127 removed it from the UI and made
> "Save as Live Photo" the flow. The owner still wanted the continuous loop, so T135 brought it back
> with the root cause fixed (below). The Live Photo export and guide stay as the fallback below
> iOS 26 and as a secondary option on iOS 26 (docs/LIVEPHOTO.md).

## Root cause of "small player, not the loop"

Apple, "Providing animated artwork for media items" (MediaPlayer, iOS 26): *"If you return a preview
image with an incorrect aspect ratio ... the system will ignore your animated artwork and display your
static artwork."* The video must also match the aspect ratio of the key it is registered under.

T10 registered the loop under `MPNowPlayingInfoProperty3x4AnimatedArtwork` (tall, 3:4) but exported it
at the **screen aspect** (`exportSettings(deviceForScreen(...))`, about 9:19.5), with a preview at the
same aspect. iOS ignored the animated artwork and showed the static artwork in the normal small
Now Playing player.

**Fix (T135):** the loop is exported at **1080 x 1440 (exactly 3:4)**. The preview image and the
static `MPMediaItemArtwork` both come from the first frame of that same 3:4 file. The native side also
refuses to register animated artwork when the preview isn't 3:4, and reports `artwork: "static"`
instead, so the app can tell the user honestly.

## What the user sees (iOS 26+ full build)

Loop editor (`app/live/[id].tsx`) and Live tab (`app/(tabs)/live.tsx`, for the most recently edited
loop) show `src/ui/LiveLockCard.tsx`:

1. **Start on Lock Screen** (primary pill). It saves pending edits, then calls `livelock.start([project])`.
   While the loop exports, the card shows "Preparing your loop…".
2. **Running**: a status line and three numbered steps:
   1. Lock your iPhone (side button).
   2. Wake it: your loop plays full screen behind the clock.
   3. If you see a small player, tap the artwork to make it full screen. (User reports say tapping
      expands it. This is a hint, not a guarantee.)
3. **Stop** (`livelock.stop()`).
4. Notices from the native state (`onState`): paused by another app or a call, paused from the Lock
   Screen, stopped for Low Power Mode, failed to start, and `artwork: "static"` → "This iPhone shows a
   still picture instead of the moving loop."
5. Notes that are always visible: needs iOS 26 or later; small playback controls show over the loop;
   it stops if another app plays sound or a call comes in; Low Power Mode, Reduce Motion or Auto-Play
   Animated Images off show a still; it uses a little battery while it runs.

Below the card, "Or save it as a Live Photo" keeps the Live Photo button (tinted, secondary) and the
3-step guide.

Decisions and English copy: `src/core/liveLockView.ts` (`liveLockView`, `LOOP_TEXT`), with tests in
`src/core/liveLockView.test.ts`. The strings are in `liveUi.loop.*` in every locale.

## Availability and fallbacks

| Where | `livelock.isAvailable()` | What the user sees |
| --- | --- | --- |
| Android | `android` | Android live wallpaper button (no card) |
| Expo Go | `expo-go` | Live Photo guide (its own "needs the TestFlight app" notice) |
| iOS < 26 | `ios-version` | "Continuous loop needs iOS 26 — here's the Live Photo way." + Live Photo button and guide |
| Build without the module, pre-iOS 26 SDK, or no `audio` background mode in Info.plist | `not-built` | "This build of Glaze doesn't include the continuous loop — here's the Live Photo way." + guide |
| iOS 26+ build with the module | available | LiveLockCard (Start / Stop) + the Live Photo option below |

The app only reaches the module through `src/native/livelock.ts` (`requireOptionalNativeModule`, never
throws), so Expo Go and Android never load it.

## How it works

```
app/live/[id].tsx, app/(tabs)/live.tsx
  └─ src/ui/LiveLockCard.tsx          the card; the only UI that calls livelock.start / stop
       └─ src/native/livelock.ts      adapter (isAvailable / start / stop / getState / addStateListener)
            ├─ src/core/livelockPayload.ts   payload: 3:4 export + 3:4 crop rects (tested)
            └─ modules/glaze-livelock (Swift, iOS)
                 ├─ GlazeLivelockModule.swift    isSupported / start(json) / stop / next / getState, event onState
                 ├─ LivelockPayload.swift        Decodable mirror; rejects a non-3:4 export or > 60 fps
                 ├─ LoopExporter.swift           crop + trim + speed → 1080x1440 .mov (no audio) + first-frame preview
                 └─ NowPlayingController.swift   audio session, silent loop, Now Playing info, remote commands
```

1. **Payload** (`buildLivelockPayload`). `export` = `artworkExport()`: 1080 x 1440, 30 fps (Apple's
   limit is 60), HEVC (H.264 when asked), no audio, at most 15 s, bitrate from `exportBitrate`. Each
   project's `cropRect` = `artworkCropRect(source, userCrop)`. The user frames the loop at the screen
   aspect in the editor, and the artwork crop keeps the same centre. It is the 3:4 rect that covers
   the user's crop height (and width) when the source allows, otherwise the largest 3:4 rect inside
   the source. It is clamped inside the source, with sides 6k x 8k, so it is exactly 3:4 and even.
   Version stays 1, so an older native binary that gets this JS also renders 3:4.
2. **Export** (`LoopExporter`). An `AVMutableComposition` with the video track only, the trimmed range
   and a speed scale, rendered through an `AVMutableVideoComposition` (preferred transform → crop →
   aspect-fill into 1080 x 1440) with `AVAssetExportSession`. GIFs go through ImageIO → `AVAssetWriter`.
   The output is `Caches/GlazeLivelock/loop-<hash>.mov`, where the hash covers every input (cache key
   `v2-3x4`, so no T10 screen-aspect file is reused). The preview is `AVAssetImageGenerator` at time
   zero with zero tolerance on that file, so it is the first frame at 1080 x 1440.
3. **Now Playing** (`NowPlayingController`). It refuses to start in Low Power Mode (`error`,
   reason `low-power`). Otherwise it uses `AVAudioSession` `.playback` without `.mixWithOthers` (a
   mixable session can't become the Now Playing app) and an `AVAudioPlayer` with `numberOfLoops = -1`
   on a silent 8 kHz mono WAV generated at runtime. `nowPlayingInfo` is kept minimal: title = loop
   name (or "Live Lock Screen"), artist "Glaze", `IsLiveStream`, playback rate, and the static artwork
   (3:4 first frame). On iOS 26, when `MPNowPlayingInfoCenter.supportedAnimatedArtworkKeys` contains
   `MPNowPlayingInfoProperty3x4AnimatedArtwork` and the preview is 3:4, it adds
   `MPMediaItemAnimatedArtwork(artworkID: <file name>, previewImageRequestHandler: { _ in preview },
   videoAssetFileURLRequestHandler: { _ in url })`. The snapshot reports `artwork`: `animated-3x4` or
   `static`. The square key (`animated-1x1`) is not used, because a square export would need a second
   encode. If a device lists only the 1x1 key, the app shows the "still picture" message.
4. **URL lifetime.** Old exports are pruned only after the new item has replaced them in
   `nowPlayingInfo`, so the artwork's URL stays valid while it is shown.
5. **Controls.** `MPRemoteCommandCenter` play, pause and toggle update only the playback rate in the
   existing `nowPlayingInfo`, so the Lock Screen button flips without reloading the artwork. Next and
   previous are enabled only for playlists of 2 or more (the UI starts one loop). Seek and skip are
   disabled.
6. **Interruptions.** Another app's audio, a call or Siri pause the loop (`paused`, reason
   `interrupted`). That app becomes Now Playing, so the loop leaves the Lock Screen until the user
   taps play. If the system says `shouldResume`, it resumes. A media-services reset rebuilds the
   player. Low Power Mode turning on stops it (`stopped`, reason `low-power`).
7. **Stop.** It stops the player, removes command targets and observers, clears `nowPlayingInfo` and
   deactivates the session with `.notifyOthersOnDeactivation`. A stop while still preparing cancels
   that start.
8. **Background audio.** `native-plugins/livelock.json` = `{"infoPlist": {"UIBackgroundModes": ["audio"]}}`.
   `app.config.ts` merges it only when `GLAZE_NATIVE=1`, so Expo Go and the plain config never see it,
   and `app.json` declares no background mode. `isSupported()` also checks Info.plist for `audio`.

## What the system decides (Apple)

- The system shows only the preview (a still) in Low Power Mode, Low Data Mode, at a high thermal
  state, with Reduce Motion on, or with Settings › Accessibility › Motion › Auto-Play Animated Images
  off. The card says so.
- Keys that aren't in `supportedAnimatedArtworkKeys` are ignored.
- The video must be a local file URL that AVPlayerLayer can play, at most 60 fps, ideally a short
  seamless loop (under 30 s; we cap at 15 s).

## Battery and the off switch

- Cost: an active audio session, plus the system decoding the artwork video while the Lock Screen is
  visible. The silent track is 8 kHz mono and loops every 10 s. Encoding happens once per edit
  (cached).
- Off switches: **Stop** in the app, pause on the Lock Screen, Low Power Mode, and another app's
  audio or a call. It never starts on its own and doesn't restart after the app is killed.
- Measure on a device before release (test step 9) and write the numbers here.

## App Review (guideline 2.5.4)

See docs/REVIEW_NOTES.md › Live Lock Screen. Background audio for a non-audio purpose is a real
rejection risk. Fallback: delete `native-plugins/livelock.json` and ship the Live Photo path only
(the module then reports `not-built`).

## Test steps on a development / TestFlight build (not yet run)

1. `GLAZE_NATIVE=1 npx expo prebuild --clean`. Check that `ios/*/Info.plist` has
   `UIBackgroundModes = [audio]` and that `Podfile.lock` lists `GlazeLivelock`.
2. Install on an iPhone with iOS 26+. In the Live tab, make a loop from a portrait video (~5 s, 1×)
   and tap **Start on Lock Screen**. The card shows Preparing, then Running with the 3 steps.
3. Lock and wake the iPhone. The loop should play full screen behind the clock. If a small player
   shows, tap the artwork. Note what happens.
4. If the card says "still picture", check Low Power Mode, Reduce Motion and Auto-Play Animated Images.
5. Pause and play from the Lock Screen. The button flips and the card follows.
6. Play music in another app. The loop pauses and the card says why. Take a call.
7. Turn on Low Power Mode. It stops, and Start explains Low Power Mode.
8. **Stop** clears the Lock Screen player, and music apps can play.
9. Battery: 1 hour locked, woken every 5 min, with and without the loop.
10. GIF source, a landscape video, a 4K HEVC video, a 60 s video (only 15 s exported).
11. iOS 18 device: the card shows "Continuous loop needs iOS 26 — here's the Live Photo way." and the
    Live Photo button and guide work. Expo Go and Android: nothing crashes.

Not yet tested on a device.
