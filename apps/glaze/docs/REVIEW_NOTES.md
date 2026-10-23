# App Review notes

Text to paste into App Store Connect > App Review Information > Notes, one section per feature.
Keep each section true to the build being submitted. Background and sources are in `docs/MARKET.md`
("Risk found").

## Icon install

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
> scheme. Glaze doesn't install the profile itself. It shows the iOS share sheet, and the user saves
> the file and installs it manually in Settings, where iOS labels it "Not Verified" because it isn't
> signed. The profile has no MDM, VPN, certificate, restriction or account payloads. Each web clip is
> removable, the profile can be removed in Settings, and the app shows how to remove it. Glaze isn't an
> MDM app and doesn't manage the device. If App Review considers this out of bounds under 5.5, we can
> turn the method off: the Shortcuts method stays.

Facts behind the notes (check before each submission):
- Payload builder: `src/core/mobileconfig.ts` (`IsRemovable` true, `PayloadRemovalDisallowed` false,
  `FullScreen` false). Delivery: share sheet only (`app/install.tsx`, `docs/SPIKE_PROFILE.md`).
- The method switch lives in `src/config/install.ts`. Availability logic is in
  `src/core/installMethods.ts`, with tests.
- This text describes the code, not a device test. The flow hasn't been checked on a device for this
  note.
