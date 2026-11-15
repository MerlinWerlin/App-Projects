# Releasing Glaze

How Glaze gets from the repo to your iPhone through TestFlight and the App Store.

## 1. Builds only, no over-the-air updates

Since 1.0.42 Glaze has **no over-the-air updates**: `expo-updates` is not installed, and `app.json`
has no `updates` block or `runtimeVersion` (Apple Guideline 5.6, as for Backspin, Couch, Cue,
Linework and Satchel). Every change, JavaScript or native, reaches phones only as a new build that
goes through TestFlight and App Store review. Don't add `expo-updates`, `eas update:configure` or an
update script back; `src/core/releasing.test.ts` fails if any of them return.

## 2. Making a build

Builds run on GitHub (ship.yml / ship-mac.yml) when `RELEASE.json` changes on main with mode
`build`; they upload to App Store Connect and appear in TestFlight after Apple's processing (usually
10–30 minutes). Mode `update` is refused for Glaze because it has no expo-updates.

To build by hand on a PC instead: `npx eas-cli@latest init` once (links the Expo project and writes
`extra.eas.projectId`), then `npx eas-cli@latest build -p ios --profile production` and
`npx eas-cli@latest submit -p ios`. TESTFLIGHT_GLAZE.cmd runs those steps.

## 3. Versions

Bump `version` in `app.json` for each App Store release. Build numbers rise by themselves
(`eas.json` uses `appVersionSource: remote` with `autoIncrement`), so `ios.buildNumber` stays "1".

## 4. Rolling back

There is nothing to republish: a bad build is replaced by a new build with the fix (or with the
previous good code), submitted the same way.

## 5. First dev build checks (widgets)

The Swift in `targets/widget/` (the GlazeWidgets extension) and `modules/glaze-widget-bridge/` has
**never been compiled**: the cloud has no Xcode and Windows has no `xcodebuild`. The first EAS
development build (`npx eas-cli@latest build -p ios --profile development`, which sets
`GLAZE_NATIVE=1`) is the first compile. Widget problems show up in one place, the EAS build log.

**Where to look.** Open the build on expo.dev, then the **Run fastlane** (or "Build") step. Use the
log's search box for each item below.

1. **Target exists.** Search `GlazeWidgets`. You should see it compiled as its own target
   (`Compiling ... GlazeWidgets`, `Ld ... GlazeWidgets.appex`). If it never appears, prebuild did
   not add the target: check the "Prebuild" step for `@bacons/apple-targets` errors (the plugin is
   listed in `native-plugins/widgets.json` and installed by T17's steps).
2. **Habit widget files.** Search `HabitIntents.swift`, `HabitWidget.swift` and `HabitStore.swift`.
   Any line with `error:` next to these names is a Swift compile error. Typical first-build ones:
   App Intent titles that are not constants, `@available` mismatches (the target's floor is
   iOS 17.0, set in `targets/widget/expo-target.config.js`), or `String(localized:)` overloads.
3. **Other widget files.** Same search for `ClockWidget`, `DateWidget`, `PhotoWidget`,
   `QuoteWidget`, `LockAccessoryWidget`, `Providers`, `ThemeStore`, `GlazeWidgetsBundle`.
4. **App Group id.** Search `application-groups`. Both the app and the GlazeWidgets extension must
   list exactly `group.com.jared797.glaze`. The same id is hard-coded in three places, which must
   match: `targets/widget/ThemeStore.swift` (`GlazeShared.appGroup`),
   `modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift` (`appGroup`) and
   `native-plugins/widgets.json`. A mismatch builds fine but the widgets stay on the fallback look
   and habit taps never reach the app. A `provisioning profile ... does not support the App Groups
   capability` error means the App Group must be ticked for both bundle ids in the Apple Developer
   portal (EAS usually does this when it manages credentials).
5. **Localised strings.** Search `Localizable.strings`. You should see 11 copies (en, es, fr, de,
   it, pt-BR, ja, ko, zh-Hans, hi, ar) copied into `GlazeWidgets.appex`. None means the widget
   gallery will show English keys or defaults only.
6. **Signing.** Search `GlazeWidgets` near `Signing` / `provisioning`. The extension's bundle id
   should be `com.jared797.glaze.widget`.

**If the build fails or any check above looks wrong:** on the build page click **Download logs**
(or copy the log from the first `error:` line to about 40 lines below it), then paste it into a
comment on the Glaze build page with the words "dev build log". The next build run turns each error
into a fix, one file per commit. Do not edit the Swift by hand on the PC; the build run is the only
writer of this repo.

**If the build succeeds,** install it on the iPhone, long-press the Home Screen, tap **+**, search
"Glaze", and check: the widgets are listed, a water widget's "+150 ml" button updates the number,
and opening Glaze shows the same number on the Widgets tab. Say in a comment what you saw. Nothing
in the widget extension has been tested on a real device until you do this.

## 6. Notes

- Updates are free on Expo's free plan for a small number of users; Glaze sends no other data.
- The project id lives in `app.json` under `extra.eas.projectId` once `eas init` has run; this repo
  deliberately has no made-up id.

## 7. Native pieces (switch one off without the others)

One `production-native` TestFlight build carries every native piece. If the EAS log shows a Swift
`error:` in one piece, switch **only that piece** off for the next build and keep the rest. Each
piece is reached from JS through an adapter in `src/native/` that uses `requireOptionalNativeModule`,
so a piece that isn't in the build behaves like Expo Go (no crash, the screen falls back).
Audit of every Swift file: `docs/NATIVE_AUDIT_1024.md`.

| Piece | Lives in | Switch off for one build | What the app does without it |
| --- | --- | --- | --- |
| Widget extension (GlazeWidgets, A) | `targets/widget/`, registered by `native-plugins/widgets.json` | Rename `native-plugins/widgets.json` to `widgets.json.off` (app.config.ts only reads `*.json`). That also drops the App Group entitlement from the app. | No Glaze widgets in the gallery; the bridge calls still succeed or no-op. |
| Widget bridge module (A) | `modules/glaze-widget-bridge` | Move the folder out of `modules/` (for example to `modules-parked/glaze-widget-bridge`; nothing links that folder). | `widgets.*` returns `{ available: false }`; widgets keep showing the Glaze default theme. |
| Profile server module (B) | `modules/glaze-profile-server` | Move the folder out of `modules/` (for example to `modules-parked/glaze-profile-server`). | `profileServer.status()` is "not-built": Shortcuts is the default method, Bulk uses the share sheet. |
| App Store purchases (T152) | `modules/glaze-store` | Move the folder out of `modules/` (for example to `modules-parked/glaze-store`). | `glazeStore.available()` is false: Glaze Plus falls back to the mock ("can't buy in this test version"). See `docs/IAP_SANDBOX.md`. |
| Live Photo / Live Lock (C) | `modules/glaze-livephoto`, `modules/glaze-livelock` | Same: move the folder out of `modules/`. | The adapters report unavailable. |

Notes:
- Do **not** move a module into `modules-off/`: that folder is what the plain `production` profile
  links (it must stay empty).
- `"platforms": []` in a module's `expo-module.config.json` should also stop autolinking (Expo
  skips a module whose platform list doesn't include the one being built), but moving the folder
  is the certain switch.
- The source-guard tests read the parked Swift by its `modules/...` path, so a parked piece makes
  those tests fail on purpose: move it back (or update the paths) once the compile error is fixed.
- `PROFILE_INSTALL_ENABLED` in `src/config/install.ts` stays the one switch for showing the profile
  method at all; it is separate from whether the server module is built.
