# App Review notes

Text to paste into App Store Connect > App Review Information > Notes, one section per feature.
Keep each section true to the build being submitted. Background and sources are in `docs/MARKET.md`
("Risk found").

Glaze has no Live Activities and no Dynamic Island content: the Island pets feature and `NSSupportsLiveActivities` were removed on 1 Nov 2026 (T198). Do not describe pets in review notes.

## Notes to paste for version 1.0.1 (T266, first App Store release)

Paste the block below into App Store Connect > Apps > Glaze > version 1.0.1 > App Review Information > Notes
(limit 4,000 characters; this block is about 3,700). Sign-in required: **off** (no demo account). Attach the
screen recording (owner step). It matches a `production-native` build with `PROFILE_INSTALL_ENABLED = true`; if the
switch is false, replace paragraph 3 with the "Switch OFF" text under "Icon install" below.

```text
WHAT GLAZE DOES
Glaze is a Home Screen customisation app. Each theme has an original wallpaper, matching app icons and matching home-screen widgets. There is also a Widget Studio, a wallpaper maker and an extra Live Photo maker that turns the user's own clip into a Live Photo. No account, login or sign-in exists anywhere in the app; no demo account is needed.

HOW TO TEST (about 3 minutes)
1. Open Glaze. The Themes tab shows the theme gallery (themes download in a few seconds on first open; three are bundled).
2. Tap any theme, then tap "Use this theme". Glaze shows three guided steps with progress dots. Each step can be skipped.
3. Step 1 Wallpaper: tap "Save wallpaper to Photos" (asks for add-only Photos access). The step explains how to set it from Photos > Share > Use as Wallpaper.
4. Step 2 Icons: choose a few apps, tap "Install all icons". Safari opens and offers a profile download (Allow, then Close). In Settings tap "Profile Downloaded" (or "More for Your iPhone"; older iOS: General > VPN & Device Management) > Install. The themed icons appear on the Home Screen. Remove: Settings > General > VPN & Device Management > Glaze icons > Remove Profile.
5. Step 3 Widgets: long-press the Home Screen > Edit > Add Widget > Glaze, pick a size; long-press the widget > Edit Widget to choose its art.
6. Glaze Plus: Settings > Glaze Plus opens the Plus sheet with Unlock and Restore purchases (sandbox account).

HOW ICONS ARE INSTALLED
Glaze cannot change another app's icon and does not try to. "Install all icons" builds a standard configuration profile on the device that contains only Home Screen web clips (com.apple.webClip.managed), one per app the user chose; each opens that app's public URL scheme. Glaze serves the file to Safari from a short-lived server on the device's loopback address (127.0.0.1), so nothing leaves the iPhone. The user installs it manually in Settings (iOS shows "Not Verified" because it is unsigned). It has no MDM, VPN, certificate, restriction or account payloads, is removable, and the app explains how to remove it. Glaze is not an MDM app and does not manage the device. A second method, one icon at a time with Apple's Shortcuts app ("Open App" action), needs no profile at all. If App Review considers the profile route outside Guideline 5.5, we will switch it off and keep only the Shortcuts method; it is a single setting in the app.

IN-APP PURCHASE
Glaze Plus (com.jared797.glaze.plus) is a non-consumable, one-time unlock bought with StoreKit. There are no subscriptions. Restore purchases is on the Plus sheet and in Settings. Everything needed to review the app works without buying.

NETWORK AND PRIVACY
No accounts, analytics, ads or tracking; photos and videos never leave the device. Network use: theme packs are plain files from GitHub Releases (each checked against a SHA-256 in its manifest); app fixes come from Expo's update service (app version and a random per-install ID, not a device or account identifier); when "Scan my Home Screen" finds an app name Glaze doesn't know, only that app name and the store country code are sent to Apple's public App Store search to pick a symbol category. Without a connection the app still works with bundled and downloaded themes.

OTHER NOTES
- No background audio and no UIBackgroundModes; no Live Activities.
- The Live Photo maker saves a Live Photo to Photos (add-only access). The app does not promise it will move as a wallpaper and says so in the app.
- Glaze declares 50 app URL schemes in LSApplicationQueriesSchemes only to pre-select icons for apps the user has; the result never leaves the device.
- All themes, icons and art are original; no brand logos or third-party characters.
```

### App Review risk notes (not for pasting; owner and lead only)

| Guideline | Risk | Mitigation in this build |
|---|---|---|
| 5.5 Developer Code of Conduct (configuration profiles / MDM) | Medium. Public text says profile-offering apps must meet MDM rules; whether a web-clip-only profile counts is not stated. Similar apps ship profile routes, but rejections happen. | Web clips only, no MDM payloads, served from loopback, installed by the user, removable, explained in-app. One switch, `src/config/install.ts` `PROFILE_INSTALL_ENABLED`: set it to `false` and the install screen becomes Shortcuts-only with no profile code path (`src/core/installMethods.ts`). It is JS, so it can reach review as a new build or an over-the-air fix if Review asks. |
| 4.3 Spam / 4.2 Minimum functionality | Low-medium. Theme/icon apps are a crowded category. | Original art (95 remote + 3 bundled themes), real WidgetKit widgets, Widget Studio, guided set-up, Live Photo maker; not a re-skin of a template. |
| 4.1 Copycats / 5.2 IP | Low. | No brand logos, no famous characters; icon labels are generic. Licences in `docs/LICENSES.md`. |
| 2.3 Accurate metadata | Low. | Listing says no live-wallpaper motion, shows only built features, real theme count (`docs/STORE.md`). |
| 2.5.2 Downloaded code | Low. | Theme packs are data (PNG + JSON), SHA-256 checked. Expo updates change JS only, within the reviewed feature set (Apple allows interpreted code that doesn't change the app's purpose, 3.3.1(B)/2.5.2). Ship only reviewer-needed fixes over the air while in review. |
| 2.5.4 Background modes | None. | No `UIBackgroundModes` (guarded by `src/core/t127LiveLock.test.ts`). |
| 3.1.1 In-App Purchase | Medium until the owner decides Plus content. | If Plus unlocks nothing a reviewer can see, Review may reject the IAP as not delivering content. See `docs/RELEASE_CHECKLIST.md` §2b (owner decision). |
| 5.1.1 Data / 5.1.2 | Low. | Data Not Collected, explained per network call in `docs/privacy.html`. |

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

**Switch OFF (fallback: use this text only if `PROFILE_INSTALL_ENABLED` is false in the submitted build):**

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
