# App Review notes

Text to paste into App Store Connect > App Review Information > Notes, one section per feature.
Keep each section true to the build being submitted. Background and sources are in `docs/MARKET.md`
("Risk found").

Glaze has no Live Activities and no Dynamic Island content: the Island pets feature and `NSSupportsLiveActivities` were removed on 1 Nov 2026 (T198). Do not describe pets in review notes.

## App Review information (Apple's new-developer questions)

Paste after the feature sections (release standard §3; same pattern as the other App Factory apps).

1. Screen recording: supplied with the reply (physical iPhone, latest iOS): launch, pick a theme, make and install an icon with Shortcuts, add a Glaze widget, save a wallpaper, Plus Unlock and Restore.
2. Purpose and audience: a home-screen customisation app for anyone who wants a matching look. It offers original themes with matching icons, themed widgets and wallpaper packs, plus a Live Photo maker from the user's own clip.
3. Setup: no account, login or sample files needed; the starter themes are bundled and further theme packs download on demand (item 4). Icons are installed all at once with a web clip profile the user installs in Settings (or, with the switch off or as a fallback, one app at a time with Apple's Shortcuts app), guided step by step in Glaze.
4. External services: none for core functionality. Only Apple In-App Purchase (StoreKit) for the one-time Glaze Plus unlock (non-consumable `com.jared797.glaze.plus`; Restore purchases is on the Plus sheet and in Settings). No server of our own, accounts, analytics, ads or AI; app fixes arrive through Expo's update service (EAS Update, `u.expo.dev`), whose library sends the app version and a random per-install ID (not a device or account identifier, not used for tracking); photos and videos never leave the device. The theme-pack catalogue and art packs are downloaded from GitHub (public GitHub Releases on `MerlinWerlin/App-Projects`) as plain files over HTTPS; no personal data, account or identifier is sent with these requests, each file is checked against the SHA-256 in its pack manifest, and without a connection the app keeps working with its bundled and already downloaded themes.
5. Regional differences: none; works the same in all regions (only the purchase price is localised).
6. Regulated industry / third-party material: not applicable. All icons, themes and art are original or licensed (licences in the app's records); no brand logos or third-party characters.

## Installed-app check (LSApplicationQueriesSchemes, T229)

Native builds only (`native-plugins/queryschemes.json`, merged when `GLAZE_NATIVE=1`; the plain `production` profile has none, and then the check finds nothing and does nothing).

> Glaze declares 50 URL schemes of popular apps in LSApplicationQueriesSchemes (Apple's limit is 50;
> the list is generated from `src/core/installedProbe.ts`). It calls `canOpenURL` on these exact schemes only
> to pre-select matching icons for those apps in the icon editor, so the user doesn't have to find them; the
> user can untick any app and it is not added again. The answers are not stored beyond that selection, are not
> used for anything else, and nothing leaves the phone (no network call, analytics or tracking).

## App category lookup (T231)
When Scan my Home Screen finds an app that isn't in Glaze's catalogue, Glaze may look up that app's name in Apple's public App Store search (itunes.apple.com) to choose a symbol for its kind of app, such as Finance or Food. Only the app name and your store's country code are sent, and only for apps Glaze doesn't already recognise. No screenshots, photos, other app names, identifiers or account details are sent, no sign-in or account is used, and answers are cached on the phone. Without a connection, Glaze picks the symbol on the phone from the app's name, and nothing is sent. (Read-only public search; no account, no tracking.)

## Icon install

Since T202 (owner-1101d #5, supersedes T183) **"Install all at once"** (web clip profile served to Safari) is the main method whenever `PROFILE_INSTALL_ENABLED` is true; the guided Shortcuts method with the **"Open App"** action is only a small "Prefer Shortcuts? One icon at a time" link, and covers apps a profile can't open. The install screen says plainly, counted from the set, how many apps open via a quick Safari tap ("Open in <app>?"; web clips hold only a URL and Apple's WebClip payload has no key to launch an app by bundle id). Guideline 5.5: with the switch false the screen is Shortcuts-only and uses no profile at all, so a rejection costs one flag.

Pick the version that matches `PROFILE_INSTALL_ENABLED` in `src/config/install.ts` for this build.

**Switch OFF (recommended for the first App Store submission):**

> Glaze makes themed icons on the device. It can't change another app's icon, and it doesn't try to.
> To add an icon, the user makes a shortcut in Apple's Shortcuts app with the "Open App" action
> (choosing the app from the list) and picks the Glaze image from Photos as the shortcut's icon. Glaze
> saves the images to a "Glaze icons" album and shows the steps for each app, one at a time. It doesn't install
> anything, change system settings or use device management. The install screen also explains how to
> remove the shortcuts and bring back the original icons. There are no accounts, the icon flow makes no network
> calls, and photos stay on the device.

**Switch ON (TestFlight, and the owner's choice for submission since T202):**

> Glaze's main install method is "Install all at once" (the Shortcuts method above stays as a fallback). The app builds a
> standard configuration profile on the device. It contains only Home Screen web clips
> (`com.apple.webClip.managed`), one per selected app, and each one opens that app's public URL
> scheme. Glaze doesn't install the profile itself. It opens the file in Safari from a short-lived
> server on the device's loopback address (127.0.0.1, nothing leaves the iPhone; older builds use the
> iOS share sheet instead). The user allows the download in Safari and installs it manually in
> Settings, where iOS labels it "Not Verified" because it isn't signed. The profile has no MDM, VPN, certificate, restriction or account payloads. Each web clip is
> removable, the profile can be removed in Settings, and the app shows how to remove it. Glaze isn't an
> MDM app and doesn't manage the device. If App Review considers this out of bounds under 5.5, we can
> turn the method off: the Shortcuts method stays.

Facts behind the notes (check before each submission):
- Payload builder: `src/core/mobileconfig.ts` (`IsRemovable` true, `PayloadRemovalDisallowed` false,
  `FullScreen` false). Delivery (T126): served to Safari from 127.0.0.1 by `modules/glaze-profile-server` through `src/native/profileServer.ts`; share sheet fallback when the module is absent (`app/install.tsx`, `docs/OWNER_1024E.md (part B)`).
- T194: every profile from one Glaze install has the same PayloadIdentifier (`com.jared797.glaze.icons.<installId>`, a random id made on the device and stored only locally, `src/store/installId.ts`) and stable web clip ids, so a new theme's profile replaces the previous Glaze profile instead of adding another; the id is not sent anywhere except inside the profile the user installs. T202: the top-level PayloadUUID is stable per install too, and each web clip's PayloadIdentifier / PayloadUUID (name-based v5 UUID) derive only from the install id + the app id (not the theme, position or time), so the clips are updated in place.
- The method switch lives in `src/config/install.ts`. Availability logic is in
  `src/core/installMethods.ts`, with tests.
- This text describes the code, not a device test. The flow hasn't been checked on a device for this
  note.

## Live Photo maker (formerly "Live Lock Screen")

Decision 24 Oct 2026 (owner, 21:03 Sydney): the iOS 26 continuous loop through Now Playing animated
artwork (T135) is **not shipped**. It needed a silent audio player, visible playback controls and
`UIBackgroundModes: audio` for a non-audio purpose (guideline 2.5.4 risk). The code is parked in
`docs/future/live-wallpaper/` (not linked into any build). Builds no longer declare any background mode;
`src/core/t127LiveLock.test.ts` guards that `UIBackgroundModes` is absent from `app/`, `src/`, `modules/`,
`targets/`, `native-plugins/` and `app.config.ts`.

Note to paste:

> Glaze can turn a short clip the user picks (their own video or a bundled loop) into a Live Photo and
> save it to their photo library (add-only Photos permission; Glaze never reads the library). Glaze
> doesn't set the wallpaper itself and doesn't promise a moving wallpaper. The app says the Live Photo
> moves when it is pressed in Photos. It shows how the user can try it as a wallpaper (Photos > Share >
> Use as Wallpaper) and says plainly that iPhone often shows Live Photos made by apps as a still or
> says "Motion not available", and that the still wallpapers are the reliable choice. This build has
> no background audio and doesn't declare `UIBackgroundModes`. Everything stays on the device. This
> feature is free.

Decision 25 Oct 2026 (T147, owner feedback fb-1025 C): the owner's TestFlight test saved the Live Photo,
but it did not move as his Lock Screen wallpaper. Apple's DTS engineer says Live Photos created by apps
(not the Camera) have "undocumented requirements" to be usable as Live Wallpapers and recommends against
reverse-engineering them (<https://developer.apple.com/forums/thread/798044>); other developers report
"Motion not available" for app-made Live Photos since iOS 16/17
(<https://developer.apple.com/forums/thread/768984>). Our export already does the standard pairing
(MakerApple key 17, QuickTime content identifier, still-image-time track, one `PHAssetCreationRequest`).
Owner direction: good enough to ship; the maker stays as an extra, and no screen, tip or store text may
promise that it moves as an iPhone wallpaper (`src/core/fb1025Live.test.ts`).

Facts behind the note (check before each submission):
- Live Photo export: `modules/glaze-livephoto/ios/GlazeLivePhotoModule.swift`. Adapter: `src/native/livephoto.ts`.
- Copy: `src/core/liveSteps.ts` (English source) and `liveUi.*` in `src/i18n/ns/liveUi/`.
- Android: a real looping live wallpaper (`modules/glaze-android`, `GlazeVideoWallpaperService`); Play has
  no equivalent of 2.5.4 for this.
- This text describes the code, not a device test.

## Scan my Home Screen (T171, native build only)

iOS gives apps no list of installed apps, so this feature asks the user for screenshots instead. It is
only in builds made with `GLAZE_NATIVE=1` (`production-native`); the plain `production` build links no
Glaze native module and shows the manual app list instead.

Note to paste:

> "Scan my Home Screen" helps the user find the apps they want icons for. The user takes screenshots of
> their own Home Screen pages and picks them with the system photo picker (read-only; Glaze never
> browses or changes the photo library). Apple's Vision framework reads the app names on the device
> (`VNRecognizeTextRequest`), Glaze matches the names to its built-in list, and the user confirms the
> list before anything is added. The screenshots and the text read from them are never uploaded: there
> is no server, no network call and no analytics. Nothing about other apps is detected or stored beyond
> the names the user confirms. This feature is free.

Facts behind the note (check before each submission):
- Native module: `modules/glaze-home-scan/ios/GlazeHomeScanModule.swift` (Vision, `recognitionLevel .accurate`,
  `usesLanguageCorrection false`; no networking, no Photos framework). Adapter: `src/native/homeScan.ts`.
- Matching: `src/core/homeScan.ts`, tests in `src/core/homeScan.test.ts`. Screen: `app/home-scan.tsx`.
- Photo access is the system picker (`expo-image-picker`); `NSPhotoLibraryUsageDescription` is already in
  `app.json` ("They never leave your phone").
- This text describes the code, not a device test.
