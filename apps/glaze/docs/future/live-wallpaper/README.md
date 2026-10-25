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
   loop (Apple Support 120734). And for Live Photos made by apps, even that often fails (see
   "Live Photo as wallpaper (25 Oct 2026)" below). Glaze ships "Make a Live Photo" as a Live
   Photo that moves in Photos, with no wallpaper-motion promise.
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

## Live Photo as wallpaper (25 Oct 2026)

**Update T153 (run 120):** the export now follows the community wallpaper recipe (1080 x 1920, HEVC, 30 fps, 1-3 s, HEIC still at >= 0.5 s, still-image-time -1 at 600 timescale, identity still-image-transform, cdsc reference). One reported requirement is still missing: the per-frame `live-photo-info` track with real camera values. See docs/LIVEPHOTO.md "Wallpaper recipe (run 120)". Not verified on a device; the status below stands until the owner's next test.

Status: **blocked** (T147, owner feedback fb-1025 C).

- **What happened:** on the TestFlight build, "Make a Live Photo" saved a Live Photo that plays in
  Photos, but set as the Lock Screen wallpaper it did not move (owner answered No).
- **Why it is blocked:** Apple's DTS engineer says Live Photos created by apps, not captured by the
  Camera, have **undocumented requirements** to be usable as Live Wallpapers, and recommends against
  reverse-engineering them (<https://developer.apple.com/forums/thread/798044>). Other developers
  report "Motion not available" for app-made Live Photos since iOS 16/17
  (<https://developer.apple.com/forums/thread/768984>). `modules/glaze-livephoto` already does the
  standard pairing (MakerApple key 17, QuickTime content identifier, still-image-time track, one
  `PHAssetCreationRequest` with `.photo` + `.pairedVideo`), so there is no documented step left to
  add. We do not guess at private metadata: an undocumented trick could break in any iOS update and
  would put a promise in the app that we cannot keep.
- **What ships instead:** the maker stays as an extra. The copy says it moves when pressed in Photos,
  that the user can try it as a wallpaper, that iPhone often keeps app-made Live Photos still or says
  "Motion not available" (an Apple limit), and points to the still wallpaper packs as the reliable
  wallpaper. Guard: `src/core/fb1025Live.test.ts`.
- **Trigger to watch:** a **public API for creating wallpaper-eligible Live Photos** (for example a
  Photos / PhotoKit or AVFoundation option, or documented metadata requirements, that marks an
  app-made Live Photo as usable for Live Wallpaper). The DTS engineer suggested filing a Feedback
  Assistant request for exactly that; the owner can file one (Developer Tools / Photos framework)
  and link it here. Check WWDC sessions and the PhotoKit / AVFoundation release notes at every
  iOS x.0 and x.y.
- **What to do when it lands:**
  1. Read Apple's requirements; implement them in
     `modules/glaze-livephoto/ios/GlazeLivePhotoModule.swift` (behind an iOS version check if the API
     is new) and extend the Swift source guards in `src/core/t127LiveLock.test.ts`.
  2. Owner device test on the newest iOS: save, Photos > Share > Use as Wallpaper, Live Photo on,
     lock and wake. Record the result and iOS version in the feedback log; never claim it from code.
  3. Only after a passing device test: bring back the wallpaper wording by iOS version
     (`liveUi.guide.*`, `liveUi.hero.*`, the Live tips, `src/core/liveSteps.ts`), all 11 locales,
     and relax `src/core/fb1025Live.test.ts` for those versions only.
  4. Update `docs/LIVEPHOTO.md`, `docs/REVIEW_NOTES.md` and `docs/STORE.md` (shot 7 may then show the
     Lock Screen again).

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
