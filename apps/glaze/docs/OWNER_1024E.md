# Owner test 24 Oct 2026 evening (fb-1024e) — native TestFlight build

Owner: "none of the features are currently working as of yet." Startup and Save to Photos work. Tag fb-1024e outranks everything.

**Owner decision 24 Oct 21:03:** finish Glaze to "good enough to ship" and move on — themes, icons, widgets and wallpaper packs are the pitch. Run 104 applied it: the continuous Lock Screen loop is **parked** (C below), the guided Shortcuts install is the default (B), and the copy says what the app does. Everything here needs the next TestFlight build (auto-ship sends it with the production-native profile). Nothing was compiled in Xcode or tried on a device: the owner tests on his iPhone.

| Part | Status (run 104) | Tasks |
|---|---|---|
| A. Widgets follow the theme, no theme name | done in run 101/103; checked again run 104 (every provider's placeholder/snapshot reads the App Group theme, Glaze default never white, no name rendered) | T125, T136 |
| B. Icon install | Shortcuts guided path is the default + Recommended; Bulk via Safari kept as a "beta" second card behind `PROFILE_INSTALL_ENABLED` | T126, T138 |
| C. Lock Screen | **Make a Live Photo** only (moves on wake/press, not a constant loop); continuous loop parked in `docs/future/live-wallpaper/`; no background audio in the build | T127, T137, T139 |
| D. Trial questions | `docs/TRIAL.md` "New since your last test" rewritten | T128 |

## A. Widgets follow the chosen theme (T125)

**Why they were white:** the app wrote the theme to the App Group (`group.com.jared797.glaze`, key `glaze.theme.v1`) only when you tapped "Use style" or saved in Widget Studio. Saving a wallpaper or applying a look wrote nothing, so the widgets fell back to the near-white Porcelain default; the gallery placeholders always used that default.

**Fix:**
- Every provider's `placeholder()` and `getSnapshot()` (gallery preview) now read the active theme; the fallback is a plum-to-coral Glaze default (TS `DEFAULT_WIDGET_THEME` and Swift `WidgetTheme` kept identical, tested), never white.
- Pale themes mix their second background colour toward the accent so e.g. Strawberry dessert reads pink, not white.
- No widget renders the theme name any more (source guard).
- The app writes the theme on every apply path (theme screen wallpaper save, Use style, apply steps, widgets row; Wallpaper screen save; Widget Studio save) through `src/store/widgetTheme.ts applyWidgetTheme`, and once at launch (`syncWidgetThemeAtLaunch`) so a theme picked earlier reaches the widgets. The bridge also writes `theme.json` into the App Group and calls `WidgetCenter.reloadAllTimelines()`; the extension reads UserDefaults, then the file, then the default.
- Clock, Little Line and Photo also come in the large size.

**To check on the phone:** gallery and Home Screen widgets in theme colours; no theme name; large layouts.

## B. Icon install (T126, then T138 in run 104)

**Run 104 (bounded, per the owner's brief):** no Apple or Expo document confirms that a profile served
from inside an app reaches Settings reliably (Apple's DTS only says "open a URL to it in Safari"; the
in-app loopback server is a community route with pitfalls). So the **guided Shortcuts method is now the
default and badged Recommended in every build** (`src/core/installMethods.ts`), with the progress bar,
"Next: <app>" line and auto-advance from T126. The Safari profile route stays as a second card titled
"Bulk install (beta)" ("it may not reach Settings on every iPhone; Shortcuts always works"), shown only
while `src/config/install.ts PROFILE_INSTALL_ENABLED` is true (on for TestFlight so you can try it; set it
to false for the App Store, Guideline 5.5, `docs/REVIEW_NOTES.md`).

### Earlier (run 101): profile served to Safari

Owner report: after "Bulk install", Settings > General > VPN & Device Management showed no
downloaded profile.

### Cause

The profile reached iOS the wrong way. `app/install.tsx` wrote the `.mobileconfig` to the cache
and opened the share sheet (`expo-sharing`), and the step cards said "Save to Files, then open it in
Files". Saving to Files only stores a file. iOS registers a profile as "Profile Downloaded" when it is
downloaded from a website (Safari) or opened from Mail (AirDrop also works). Opening a copy from
Files often doesn't hand it to the profile installer, so Settings had nothing to show. The T06
spike (`docs/SPIKE_PROFILE.md`, row A) had already flagged this as "needs on-device confirmation". The
owner's report is that confirmation, and it came out negative.

The file itself looked correct, so it's unlikely to be the cause. It's a well-formed plist with a
`Configuration` wrapper, unique upper-case v4 `PayloadUUID`s, a unique `PayloadIdentifier` per
payload, one `com.apple.webClip.managed` payload per app (`URL`, `Label`, base64 PNG `Icon`,
`IsRemovable` true, `FullScreen` false, `Precomposed` true), `PayloadRemovalDisallowed` false, and
each part kept under 2.5 MB (180 px icons). New tests now check this too.

Sources:
- Apple Support, "Install a configuration profile on your iPhone": https://support.apple.com/en-au/102400
  (download "from a website or an email message", then Settings > Profile Downloaded; deleted if not
  installed within 8 minutes; only one downloaded profile waits at a time)
- Apple Developer Forums 70696 (DTS): there's no API to install a profile. You open a URL to the profile
  in Safari, which hands it to the profile ingestion subsystem. Serving it from inside the app is
  possible but has multitasking pitfalls: https://developer.apple.com/forums/thread/70696
- Apple Developer Forums 103337: installing through SFSafariViewController worked for some people
  around iOS 11.3. A later post says nothing outside Safari opened a profile, and that a local server
  sending `x-apple-aspen-config` is the in-app route people used: https://developer.apple.com/forums/thread/103337
- A third-party browser bug report: that browser saved the profile to Files, where it couldn't be
  installed. Opening it in Safari did install it: https://orionfeedback.org/d/10346-handle-installation-of-mobileconfig-profiles

On the "SFSafariViewController can't install profiles" claim: Apple doesn't document it as an install
route, and reports conflict (it worked at some point around 11.3, and later reports say it doesn't).
So it isn't a dependable route. The app opens the real Safari with `Linking.openURL` and never uses
`expo-web-browser`.

### What changed

- **New native module `modules/glaze-profile-server`** (apple only, like the other Glaze modules:
  `expo-module.config.json`, `ios/GlazeProfileServer.podspec`, `ios/GlazeProfileServerModule.swift`,
  `index.ts`):
  - It's a small HTTP/1.1 server built on `NWListener` from Apple's Network framework. It listens
    only on 127.0.0.1 (`requiredLocalEndpoint`), on a random port from 49152 to 65000, and retries
    up to 5 times.
  - `GET /` returns a small landing page in the app's language with one Install button.
    `GET /glaze.mobileconfig` returns the profile with `Content-Type: application/x-apple-aspen-config`,
    `Content-Disposition: attachment`, `Cache-Control: no-store` and `Connection: close`. Any other
    path returns 404, and any method other than GET or HEAD returns 405.
  - It keeps serving in the background through `UIApplication.beginBackgroundTask`. It stops at
    whichever comes first: the 90 s timeout, iOS ending the background time (usually about 30 s,
    sometimes more), 20 s after Safari fetched the profile (Safari can fetch again after Allow), or
    `stop()` (also called when you leave the screen).
  - No entitlements, no ATS exception, and no Local Network prompt are needed. Safari does the
    fetching, and loopback isn't the local network.
- **Linking:** the module sits in `./modules`, which `scripts/native-link.mjs` links for every EAS
  profile with `GLAZE_NATIVE=1` (currently all of them, production included). Expo Go and `modules-off`
  builds don't have it. No `app.config.ts` or plugin change was needed.
- **Adapter `src/native/profileServer.ts`:** uses `requireOptionalNativeModule`. `status()` is
  synchronous and `serveAndOpen(fileUri, pageText)` returns a result (opened, unavailable or failed)
  instead of throwing. It reports "unavailable" in Expo Go, on Android and in builds without the
  module. It opens Safari with `Linking.openURL`.
- **Pure logic `src/core/profileServer.ts`:** constants shared with the Swift code, a check that the
  URLs from native are loopback-only, the landing page JSON, and `profileRoute()`.
- **Method choice (`src/core/installMethods.ts`):**
  - `src/config/install.ts` `PROFILE_INSTALL_ENABLED` is still the one switch. With it off, only
    Shortcuts is shown, whatever the server status.
  - With the server, Bulk comes first, is badged Recommended and is the default.
  - Without the server, Shortcuts comes first, is Recommended and is the default. Bulk stays
    available through the share sheet, with a warning that Files often won't install it and that
    Mail or AirDrop works.
  - A method you tap is remembered (`choiceExplicit` in the install checklist; older saved state
    loads unchanged).
- **Install screen (`app/install.tsx`):**
  - Generate profile now draws the icons, builds the profile, saves it, starts the server and opens
    Safari.
  - Each file row has an "Open in Safari again" action and a Share action.
  - There's an "Open in Safari again" button, a note that Safari has about a minute, and a "Share the
    file instead" fallback.
  - Split sets open one part at a time, because iOS holds only one downloaded profile.
- **Guided Shortcuts path:**
  - A progress bar and a "Next: <app>" line with Show the steps.
  - Ticking an app off opens the steps for the next app.
  - An "all done" line at the end, and a one-icon-at-a-time explainer.
- **New step illustrations** in `src/ui/StepCard.tsx`: `safari-page`, `allow-dialog`, `home-icons`.
- **i18n:** new `install.safari.*` and `install.guided.*` keys in all 11 locales (machine
  translations, like the rest of the non-English install strings).
- **`docs/REVIEW_NOTES.md`:** the "switch ON" note and the facts list now describe the Safari delivery.
- **Tests:** `src/core/profileServer.test.ts` (18 tests) covers the content type and path matching
  between JS and Swift, the loopback-only URL checks, the adapter source guards (optional module,
  try/catch in every entry point, real Safari, no in-app browser, no `src/plus`), the switch still
  governing visibility, the default and recommended method with and without the server, the exact
  Safari steps, plist well-formedness, unique UUIDs and identifiers, and web clip keys.

### Exact on-screen steps (Safari route)

1. Tap Install in Safari.
2. Safari asks to allow a configuration profile download: tap Allow, then Close.
3. Open Settings: tap "Profile Downloaded" near the top (or General > VPN & Device Management), tap
   Install, enter your passcode, Install.
4. Your icons appear on the Home Screen.

After these, the screen shows the existing "Why Not Verified?", "Hide the old icons" and "To remove
later" cards.

### Not verified (needs the device)

None of this has been compiled or run on a device. The Swift code was written to be conservative, and
the lines we couldn't check are marked `// VERIFY`.

- Whether the Swift compiles under SDK 54 / ExpoModulesCore. In particular: `AsyncFunction` with a
  trailing `Promise`, and `NWListener(using:)` with `requiredLocalEndpoint` binding to 127.0.0.1.
- Whether Safari shows the "allow configuration profile download" prompt for
  `http://127.0.0.1:<port>`, and whether "Profile Downloaded" then appears in Settings.
- Whether the background time lasts long enough for the user to tap Install in Safari. If Safari says
  it can't connect, the screen tells the user to come back and tap "Open in Safari again".
- Whether Safari fetches again after Allow while the server is still up (there's a 20 s grace
  period).
- Whether web clips with app URL schemes (for example `music:`) open the apps (unchanged from before).
- The machine translations of the new strings.

### App Review 5.5

The delivery change doesn't change what the profile is: a configuration profile with web clips only.
The Guideline 5.5 risk recorded in `src/config/install.ts` and `docs/MARKET.md` is the same as before.
Keep `PROFILE_INSTALL_ENABLED` on for TestFlight. For the first App Store submission, the advice is
unchanged: switch it off unless the owner accepts the risk. When it's off, the server is never started,
because the Bulk card isn't shown.

The server listens on loopback only, serves one file for at most 90 s, and makes no network calls of
its own. Say so in the review notes (`docs/REVIEW_NOTES.md`, "Switch ON", now updated) if the switch
stays on.

## C. Lock Screen: Make a Live Photo (T137 + T139, run 104 — owner decision 21:03)

iOS gives apps no way to set a continuously looping wallpaper. The only route (iOS 26 Now Playing
animated artwork) needs a silent audio player with visible controls, carries App Review 2.5.4 risk, and
the owner dislikes it. So:

- **Removed from the app and the native build:** the Start/Stop loop card, the silent audio player,
  remote commands and `UIBackgroundModes: audio` (`native-plugins/livelock.json` gone). The module
  `modules/glaze-livelock`, its adapter, `LiveLockCard`, the payload/view core and the T135 tests moved
  to `docs/future/live-wallpaper/code/` — not autolinked, not compiled. A guard test fails if any
  `UIBackgroundModes` or Now Playing artwork code appears in `app/`, `src/`, `modules/`, `targets/`,
  `native-plugins/` or `app.config.ts`.
- **Kept and polished:** the Live tab turns a clip (bundled or your own video) into a ~3 s Live Photo,
  saves it to Photos, then shows the steps Photos › Share › Use as Wallpaper. Copy in 11 languages now
  says plainly: it moves when you wake or press the Lock Screen; it is not a constant loop on iPhone.
  Android keeps the true looping live wallpaper (`GlazeVideoWallpaperService`).
- **Repositioned:** tab "Live" (was "Live Lock"), tips, Plus list, settings, store title "Glaze: Icon
  Themes & Widgets", screenshot 1 "Themes, icons and widgets that match", screenshot 7 "Turn a clip into
  a Live Photo" (re-rendered).
- **Parked plan:** `docs/future/live-wallpaper/README.md` (what you want, why it's blocked, triggers
  to watch, the ready-to-go plan, the parked code), linked from `docs/PLAN.md` §10.

## C (superseded, run 103). Live Lock Screen = continuous loop on iOS 26 (T135) — parked, not shipped


Owner, 24 Oct 19:29: "nah wanted this continuous loop, what you had was not working." Oversight D133-1 agrees. Run 103 rebuilt the loop; the run 101 Live Photo work below stays as the iOS < 26 fallback.

**Why it showed only a small player:** Apple's "Providing animated artwork for media items" (https://developer.apple.com/documentation/mediaplayer/providing-animated-artwork-for-media-items) says the preview image and the video must match the key's aspect ratio, or "the system will ignore your animated artwork and display your static artwork". The old export used the screen's shape (about 9:19.5) under the 3:4 key, so iOS dropped the moving artwork and showed the static Now Playing player.

**Fix (needs the next TestFlight build):**
- The loop is exported at exactly 3:4 (1080x1440, 30 fps), cropped around the centre of your crop (`src/core/livelockPayload.ts artworkCropRect`). The preview and still artwork come from the first frame of that 3:4 file.
- `MPMediaItemAnimatedArtwork` under `MPNowPlayingInfoProperty3x4AnimatedArtwork`, only when the key is in `supportedAnimatedArtworkKeys`; otherwise the app says honestly that this iPhone shows a still picture.
- Silent looping audio (`.playback`, not mixable) keeps Glaze the Now Playing app; title is the loop name, artist Glaze; play / pause / toggle remote commands work; interruptions pause it; Low Power Mode stops it.
- Background audio mode is back in `native-plugins/livelock.json`, applied only in native builds (GLAZE_NATIVE=1). If it is removed (e.g. after an App Review rejection), the module reports "not built" and the app falls back to Live Photo by itself.
- New `src/ui/LiveLockCard.tsx` on the loop editor and the Live tab: **Start on Lock Screen** → Running → steps (lock the iPhone; wake it; tap the artwork if it's small) → **Stop**. Honest notes: iOS 26+, small controls over it, stops if another app plays sound, Low Power Mode / Reduce Motion / Auto-Play Animated Images off show a still, uses a little battery. iOS < 26 shows "Continuous loop needs iOS 26 — here's the Live Photo way".
- App Review 2.5.4 (background audio for non-audio purposes) is written up in `docs/REVIEW_NOTES.md` with mitigations and the fallback.
- Tests: `src/core/t135LiveLoop.test.ts`, `src/core/liveLockView.test.ts`, updated `t127LiveLock.test.ts` and payload tests.

**Not verified (no device, no Xcode here):** whether iOS 26 shows the 3:4 loop full screen on the owner's iPhone, and whether tapping a small player expands it (a forum report, not Apple docs). The animated-artwork Swift calls are the same shape that compiled on EAS before.

## C (run 101). Live Photo maker (T127) — what ships, details

The owner reported that "Live Lock Screen" showed a Now Playing media player on the Lock Screen, over
the normal wallpaper, and tapping it did nothing. That approach is gone. Live Lock Screen now means
**Save as Live Photo** plus a 3-step guide with pictures.

### What iOS allows (and doesn't)

- **No app can set the wallpaper**, still or animated. No app can play a video or a GIF as the Lock
  Screen either. The user always sets the wallpaper in Settings or in Photos.
- **A Live Photo can be a Lock Screen wallpaper on iOS 17 or later.** Apple's support article
  says: Settings › Wallpaper › Add New Wallpaper › Photos › Live Photo, pick it, "make sure the play
  control is on", then Add. Set this way, it plays "whenever you wake up your device". Apple gives
  no other trigger. (iOS 16 dropped Live Photo wallpaper motion; iOS 17 brought it back.)
- **It doesn't loop.** It plays once, briefly, when the iPhone wakes, then rests on the key photo.
- **Photos › Share › Use as Wallpaper** reaches the same editor. That is the guide's main path. The
  Settings path is listed as an alternative.
- **When it won't move:** Low Power Mode, Reduce Motion, the Live Photo control switched off, or
  iOS saying "Motion not available" / "Motion from this Live Photo is not supported as a
  wallpaper".
- **Apple's requirements for generated Live Photos are undocumented.** Developers report that Live
  Photos they build in code (paired JPEG/HEIC + MOV, content identifier, still-image-time, 1.5–3 s,
  H.264, 30 fps, portrait) save and play in Photos but sometimes show "Motion not available" as
  wallpaper on iOS 17+. An Apple DTS engineer replied that "there are undocumented requirements"
  and advised against reverse engineering them. **So Glaze can't promise that every Live Photo it
  saves will move as a wallpaper.** The UI says so: "if iOS says Motion not available, it stays a
  still picture."

Sources (fetched 24 Oct 2026):
- Apple Support, "Set a Live Photo as your Lock Screen wallpaper on your iPhone":
  https://support.apple.com/120734 (iOS 17 or later, play control, plays on wake)
- Apple Developer Forums 798044, "Live Photos created with PHLivePhoto API show 'Motion not
  available' when setting as wallpaper" (DTS reply: undocumented requirements):
  https://developer.apple.com/forums/thread/798044
- Apple Developer Forums 768984, 745694, 737704, 731781 (the same symptom, no fix posted):
  https://developer.apple.com/forums/thread/768984, https://developer.apple.com/forums/thread/745694
- DroidWin, "iOS 17 Live Photo Motion not available: how to fix" (Low Power Mode, Reduce Motion,
  the Live Photo control, unsupported photos):
  https://droidwin.com/ios-17-live-photo-motion-not-available-how-to-fix/

### What changed

- **Editor (`app/live/[id].tsx`):** "Set on Lock Screen" (Now Playing), "Add to playlist", the
  running card and the unavailable sheet are gone. **Save as Live Photo** is now the primary
  (filled) pill and flushes pending edits first. The new `LivePhotoGuide` sits under it, and
  "Save to Photos" (still frame / clip) stays as the Expo Go-friendly fallback.
- **Live tab (`app/(tabs)/live.tsx`):** the playlist section, the per-row "add to playlist" button
  and "Set playlist on Lock Screen" are gone. The guide card replaces the old collapsible steps
  card. Stored playlists in `src/store/loops` are left alone (unused, harmless).
- **New `src/ui/LivePhotoGuide.tsx`:**
  - It starts with one honest sentence: iOS doesn't let apps set wallpapers or play video on the
    Lock Screen, so Glaze saves a Live Photo and you set it yourself.
  - A notice appears when Glaze can't save here: Expo Go → "needs the Glaze TestFlight app"; a
    full build without the module → "install the latest TestFlight build"; a GIF → "pick a video".
  - Three steps, each with an original react-native-svg picture: a photo grid with the newest item
    marked, a share sheet with the "Use as Wallpaper" row highlighted, and a Lock Screen editor
    with the live button on and an Add pill.
  - Notes follow the steps: it moves for a moment on wake and doesn't loop forever; iOS 17+, Low
    Power Mode, Reduce Motion, "Motion not available"; on iOS 16 it stays still; the Settings
    path.
  - It renders nothing on Android. The only native call is `livephoto.isAvailable()`, which never
    throws.
- **`src/ui/LivePhotoSheet.tsx`:**
  - The "saved" sheet shows the same three illustrated steps.
  - Expo Go / not-built reasons now say that Live Photo saving needs the TestFlight app.
  - The camera stopgap steps are kept.
- **Removed:** `src/ui/LiveStepsCard.tsx` and `src/ui/LiveUnavailableSheet.tsx` (`setOnLockScreen`
  and the Now Playing UI). `src/native/livelock.ts` and `modules/glaze-livelock` are still in the
  repo. They're harmless and no screen calls them. `liveContext` still imports `isExpoGo` from the
  adapter.
- **`src/core/liveSteps.ts`:**
  - `applyInstructions` and `LOOP_MIN_IOS` are replaced by `livePhotoGuide()`, `GUIDE_STEPS`,
    `GUIDE_TEXT` and `LIVE_PHOTO_WALLPAPER_MIN_IOS = 17`.
  - `saveOptions` has no "Looping Lock Screen" any more.
  - `heroSubline` says Live Photo for every full build.
- **i18n:** `liveUi.guide.*` (16 keys) and `liveUi.hero.subLive` were added in all 12 languages. The
  old `liveUi.instr.*` / `liveUi.lock.*` keys are unused now but left in place, so the catalogues
  stay in step.
- **Background audio removed:** `native-plugins/livelock.json` (`UIBackgroundModes: ["audio"]`) is
  deleted, because the default flow no longer plays audio. Declaring an unused audio background mode
  is an App Review risk. `docs/REVIEW_NOTES.md` has a new "Live Lock Screen (Live Photo)" section.
  `docs/LIVELOCK.md` is marked retired from the UI. `app.config.ts` is unchanged: it merges whatever
  JSON files exist.
- **Free:** nothing here reads Plus. A test checks that these files don't touch `src/plus` or the
  entitlement.

### Live Photo export check (`modules/glaze-livephoto/ios/GlazeLivePhotoModule.swift`)

| Requirement | Status |
|---|---|
| Still JPEG with MakerApple (`kCGImagePropertyMakerAppleDictionary`) key `"17"` = identifier | already right |
| MOV top-level `mdta` `com.apple.quicktime.content.identifier` = same identifier | already right |
| Timed metadata track `mdta/com.apple.quicktime.still-image-time`, int8, short range at the still time | track already right; **value changed from -1 to 0** as the brief asked |
| H.264, `.mov`, no audio, even portrait output size from `exportSettings` | already right |
| Still grabbed at the same `stillTime` the metadata points at (middle of the clip) | already right; comment clarified |
| `PHAssetCreationRequest` with `.photo` + `.pairedVideo`, add-only permission | already right |
| Length 0.5–3 s (JS clamp `LIVE_PHOTO_MAX_MS = 3000`; Swift `maxDuration` 3 s) | already right |

There's a pairing checklist at the top of the Swift file, and `src/core/t127LiveLock.test.ts` checks
each item at the source level.

### Tests

`src/core/t127LiveLock.test.ts` checks:
- No app or `src/ui` file calls `livelock.start/next` or `setOnLockScreen`, or imports the livelock
  adapter object.
- Both Live screens show `<LivePhotoGuide>`.
- Save as Live Photo is the primary pill.
- No `UIBackgroundModes` remains in `native-plugins`, and the review note says "no background
  audio".
- These files don't use Plus.
- The guide always has 3 steps (photos, share, lock) and the right notice for each build, kind and
  module state.
- The English copy matches `liveUi.guide`, and other languages aren't English.
- The Swift export has the content identifier in both files, the still-image-time track (int8 0),
  `.photo` + `.pairedVideo`, and the 3 s limit.

`liveSteps.test.ts` was updated (the loop-mode tests are removed).

### Not verified (no device, no Xcode here)

- Nothing was run on a device or compiled with Xcode. The Swift change is one literal (`Int8(0)`)
  plus comments.
- Whether Glaze's generated Live Photos animate as a wallpaper or hit "Motion not available".
  Apple says the requirements are undocumented. If they don't move, things to try on a device:
  HEIC still instead of JPEG; a `com.apple.quicktime.live-photo-info` metadata track; a 60 fps or
  1080×1920 export; a shorter clip (~1.5–2 s); the still at a different time. All of these are
  guesses from community reports, not Apple guidance.
- That Photos' share sheet still says exactly "Use as Wallpaper" on iOS 26, and that the editor's
  Live Photo control is at the bottom-left on every version. Apple's article only describes the
  Settings path and a "play control".
- The translations are brief machine translations and have no native-speaker review.
- The guide's layout and pictures were checked only by reading the code: typecheck passes, but no
  screenshot was taken.

## D. Trial questions (T128, rewritten run 104)

docs/TRIAL.md "New since your last test" asks yes/no for A-C (C = Make a Live Photo) and has the plain-words note on what iOS allows.
