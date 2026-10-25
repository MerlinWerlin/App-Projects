# App Review notes

Text to paste into App Store Connect > App Review Information > Notes, one section per feature.
Keep each section true to the build being submitted. Background and sources are in `docs/MARKET.md`
("Risk found").

## App Review information (Apple's new-developer questions)

Paste after the feature sections (release standard §3; same pattern as the other App Factory apps).

1. Screen recording: supplied with the reply (physical iPhone, latest iOS): launch, pick a theme, make and install an icon with Shortcuts, add a Glaze widget, save a wallpaper, Plus Unlock and Restore.
2. Purpose and audience: a home-screen customisation app for anyone who wants a matching look. It offers original themes with matching icons, themed widgets and wallpaper packs, plus a Live Photo maker from the user's own clip.
3. Setup: no account, login or sample files needed; every theme is bundled. Icons are installed one app at a time with Apple's Shortcuts app, guided step by step in Glaze.
4. External services: none for core functionality. Only Apple In-App Purchase (StoreKit) for the one-time Glaze Plus unlock. No server, accounts, analytics, ads or AI; photos and videos never leave the device.
5. Regional differences: none; works the same in all regions (only the purchase price is localised).
6. Regulated industry / third-party material: not applicable. All icons, themes and art are original or licensed (licences in the app's records); no brand logos or third-party characters.

## Icon install

Since T138 (24 Oct) the guided Shortcuts method is the default and Recommended in every build; Bulk install (profile served to Safari) is an optional second card labelled beta, shown only while `PROFILE_INSTALL_ENABLED` is true. The owner's device test found the profile never reached Settings (Files route); the Safari route is unverified on a device. Advice for the first App Store submission: set the switch to false (Guideline 5.5).

Pick the version that matches `PROFILE_INSTALL_ENABLED` in `src/config/install.ts` for this build.

**Switch OFF (recommended for the first App Store submission):**

> Glaze makes themed icons on the device. It can't change another app's icon, and it doesn't try to.
> To add an icon, the user makes a shortcut in Apple's Shortcuts app with the "Open URL" or "Open App"
> action and picks the Glaze image from Photos as the shortcut's icon. Glaze saves the images to a
> "Glaze icons" album, shows the steps for each app and offers a link to copy. It doesn't install
> anything, change system settings or use device management. The install screen also explains how to
> remove the shortcuts and bring back the original icons. There are no accounts and no network calls,
> and photos stay on the device.

**Switch ON (TestFlight, or if the owner chooses to submit with it):**

> Besides the Shortcuts method above, Glaze offers an optional "Bulk install". The app builds a
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
> doesn't set the wallpaper itself. The app shows the steps (Photos > Share > Use as Wallpaper, with the
> Live Photo button on) and says that the photo moves when the iPhone wakes or the Lock Screen is
> pressed, and that it is not a constant loop. This build has no background audio and doesn't declare
> `UIBackgroundModes`. Everything stays on the device. This feature is free.

Facts behind the note (check before each submission):
- Live Photo export: `modules/glaze-livephoto/ios/GlazeLivePhotoModule.swift`. Adapter: `src/native/livephoto.ts`.
- Android: a real looping live wallpaper (`modules/glaze-android`, `GlazeVideoWallpaperService`); Play has
  no equivalent of 2.5.4 for this.
- This text describes the code, not a device test.
