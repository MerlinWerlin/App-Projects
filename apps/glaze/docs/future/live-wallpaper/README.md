# Parked: a true live Lock Screen wallpaper on iPhone

Status: **parked** (owner decision, 24 Oct 2026 21:03 Sydney). Glaze ships around themes, matching
icons, themed widgets and wallpaper packs; the Live Photo maker is an extra. This folder is the plan
to **hammer it hard if it becomes available**.

## What the owner wants

A Lock Screen wallpaper that is always animating, GIF-like, for as long as the screen is on — made
from a bundled loop pack or the user's own clip. No media player, no playback controls, no audio
session tricks. Set once and it just moves.

## Why it is blocked today (24 Oct 2026, iOS 26)

1. **No public API sets a wallpaper**, still or video. The user always sets the wallpaper in Settings
   or Photos. No PosterKit/WallpaperKit-style extension is open to third parties (Apple's own
   posters — Weather, Astronomy, Emoji, Photo Shuffle — are system-only).
2. **Live Photo wallpaper only animates on wake / press**, then rests on the key photo. It does not
   loop (Apple Support 120734). That is what Glaze ships now ("Make a Live Photo").
3. **iOS 26 animated Now Playing artwork** (`MPMediaItemAnimatedArtwork`,
   `MPNowPlayingInfoProperty3x4AnimatedArtwork`) can fill the Lock Screen with a looping video, but
   only while the app is the Now Playing app: it needs a (silent) audio player, shows playback
   controls over the loop, stops when other audio plays, and relies on `UIBackgroundModes: audio`
   for a non-audio purpose — App Review guideline 2.5.4 risk. Built as T135 (run 103), never shipped,
   removed in T137 (run 104). The owner dislikes the visible player.

## Triggers to watch (check at every WWDC and every iOS x.0 / x.y release notes)

- A WWDC session or iOS release that adds **video / animated wallpaper APIs** or a
  **third-party Lock Screen poster extension** (PosterKit / "WallpaperKit" / `PRPoster…` going
  public, a new extension point in Xcode's target list).
- **Animated artwork without visible controls**, or a Now Playing presentation that hides the
  transport controls.
- **Apple loosening 2.5.4** (background modes) or publishing guidance that explicitly allows
  artwork-only Now Playing items.
- Live Photo wallpapers gaining a **loop / bounce mode** (Photos already has Loop and Bounce effects;
  if those become wallpaper-capable, Glaze can export them).
- Competitor apps shipping a control-free loop and staying in the store across two review cycles
  (precedent, not proof).

Who checks: the App Factory overseer adds a line to its cycle review after each Apple release.

## Ready-to-go plan when a trigger hits

### Feature spec
- "Live wallpaper" mode on the Live tab: pick a loop (bundled pack or own clip/GIF), trim (≤ 15 s),
  crop to screen, speed, optional playlist; "Set as live wallpaper" through whatever the new API is.
- Free with your own clip (hard rule); Plus = theme loop packs and playlists.
- Each theme can carry an optional matching loop (themes' `art` already has room for it).

### UI flow
Live tab → New → pick → trim/crop (existing editor `app/live/[id].tsx`) → preview on a Lock Screen
mock → **Set live wallpaper** → system sheet / extension handoff → "Done" with how to switch back.
Keep "Make a Live Photo" as the fallback for older iOS.

### Native module outline
- Start from `code/glaze-livelock/` (Expo module, Swift): `LoopExporter.swift` (AVAssetExportSession,
  crop + scale + loop seam, H.264/HEVC, no audio), `LivelockPayload.swift` (JSON payload, tested
  pair in `code/src/core/livelockPayload.ts`), `NowPlayingController.swift` (only for the Now
  Playing route — drop it if the new API is a real wallpaper API).
- New: an extension target (via the existing `targets/` + `eas-build-post-install` widget-tool
  path) if Apple's API is extension-based; App Group `group.com.jared797.glaze` hands it the loop
  file.
- Adapter in `src/native/` with `requireOptionalNativeModule`, never crashing Expo Go
  (`code/src/native/livelock.ts` is the pattern).

### Loop export specs (starting point; replace with Apple's numbers)
Portrait at device resolution (or the API's required aspect — T135 learned the hard way that the
Now Playing artwork is ignored unless the video is exactly 3:4, 1080x1440), 30 fps, HEVC with H.264
fallback, no audio track, ≤ 15 s, seamless loop (crossfade the last 0.3 s into the first frame),
bitrate from `exportBitrate()` in `src/core/loop.ts`.

### Pack content plan
Original loops only (no brand logos, characters or competitor material): 3 free (rain on glass,
drifting clouds, glaze drip), 12 Plus matching the art themes (Starry night shimmer, Sunset dunes
heat haze, Deep sea bubbles, seasonal loops). Licences recorded in `docs/LICENSES.md`.

### Store pitch
"The first theme app with real live wallpapers" — only if true on launch day; check the store first.
Screenshot: a theme's Home Screen next to its moving Lock Screen.

### Review notes
Describe the public API used, that nothing plays audio, that the user sets it, and that clips stay
on the device. If the route is still Now Playing, reuse the 2.5.4 write-up in `LIVELOCK_T135.md`.

### Test plan
Device tests by the owner on his iPhone: sets and keeps looping after lock/unlock, after reboot,
Low Power Mode, Reduce Motion, battery over 1 hour, memory with a 15 s 4K source, switching themes.
Cloud: core tests for crop/trim/export maths (`code/src/core/*.test.ts` can move back to
`src/core/`).

## Parked code (reference only; not linked, not compiled, not tested)

- `code/glaze-livelock/` — the Expo module (Swift) as of T135, moved out of `modules/` so autolinking
  never includes it.
- `code/src/native/livelock.ts` — app adapter. `code/src/ui/LiveLockCard.tsx` — Start/Stop card.
- `code/src/core/livelockPayload.ts`, `liveLockView.ts` and their tests (`t135LiveLoop.test.ts`).
- `code/native-plugins-livelock.json` — the `UIBackgroundModes: audio` plist fragment (do not put it
  back in `native-plugins/` unless a trigger above makes it necessary; a source guard forbids it).
- `LIVELOCK_T135.md` — design notes and sources for the Now Playing route.

To revive: move `code/glaze-livelock` back to `modules/`, the `src/` files back to their folders,
restore the UI from git (`git show 2561be5`), and update the guard in `src/core/t127LiveLock.test.ts`.
