# Releasing Glaze

How Glaze gets from your PC to your iPhone through TestFlight, and how small fixes reach it later
without a new build. Everything here runs on your PC from the Glaze folder. Nothing in this page
has been tried on a real device yet; if a step behaves differently, paste the window's text into a
Glaze Build page comment.

## 1. First-time setup (once)

Open a Command Prompt in the Glaze folder (in File Explorer, type `cmd` in the address bar and press
Enter), then run these one at a time:

1. `npx eas-cli@latest init` – do this first. It links the folder to an Expo project (sign in with
   your free Expo account when asked) and writes the project id into the app config
   (`extra.eas.projectId`). Let it; don't type an id by hand.
2. `npx eas-cli@latest update:configure` – turns on EAS Update for the project and writes your
   project's update address into `app.json` (`updates.url`). The repo deliberately ships without
   one, so a build made before this step simply has over-the-air updates switched off (Settings
   says updates aren't set up) instead of checking a dead address.
3. `npm install` – fetches the app's packages (START_TRIAL.cmd also does this).
4. Check `app.json` now has `updates.url` starting `https://u.expo.dev/` followed by your project id.
5. `npx eas-cli@latest build -p ios --profile production` – builds the app in Expo's cloud
   (free tier is fine; it can queue for a while). It asks for your Apple Developer sign-in the first
   time and handles certificates for you.
6. `npx eas-cli@latest submit -p ios` – sends the finished build to App Store Connect. It shows up in
   TestFlight after Apple's processing (usually 10–30 minutes).

Commit the changes `eas init` and `eas update:configure` make to `app.json`, so the repo and your PC
copy stay the same.

(The commands in short form – `eas init`, `eas update:configure`, `eas build`, `eas submit` – are
the same thing; `npx eas-cli@latest` in front just means you don't need to install anything.)

## 2. Update or new build?

Each build listens on an update channel that matches its profile in `eas.json`
(development / preview / production). The TestFlight build is `production`.

**An over-the-air update is enough** when you only changed JavaScript and bundled files:

- screens, layout, colours and wording
- themes, icon styles and wallpapers bundled with the app
- app logic and bug fixes in `app/` or `src/`
- translations

**A new TestFlight build is needed** when you changed anything native:

- native code (`modules/`, `targets/`, the widget, `native-plugins/`)
- permissions or anything else in `ios.infoPlist` / entitlements
- the app icon or splash screen
- a new package that has native code (adding or upgrading an `expo-*` or `react-native-*` package
  usually counts)
- the app version

Why the version matters: `runtimeVersion` follows the app version (`"policy": "appVersion"` in
`app.json`). An update only reaches builds with the same runtime version. So when you bump
`version` in `app.json` (say 0.1.0 to 0.2.0) you must make a new build, and updates you push after
that go only to 0.2.0 builds. Leave the version alone for update-only fixes. (The build number goes
up by itself on each production build; that does not change the runtime version.)

## 3. Pushing an update

1. Make sure the folder has the changes you want (pull the latest code).
2. Double-click **PUSH_UPDATE.cmd**.
3. Type a short note, like `Fix theme picker crash`, and press Enter.
4. Wait for it to finish, then press any key to close the window.

Phones pick the update up the next time Glaze is opened: it downloads in the background and is used
on the following launch. To get it straight away, open Settings › About › **Check for updates**; if
one is found Glaze restarts into it. Expo Go never uses updates – the trial always runs the code
from your PC.

## 4. Rolling back

If an update makes things worse:

- **Republish the previous update:** run `npx eas-cli@latest update:list --branch production` to
  see recent updates, then `npx eas-cli@latest update:republish --group <id of the good one>`.
  Phones switch back on their next launch.
- **Or push the previous code:** go back to the last good commit (`git checkout <commit>` or revert
  the bad one), then double-click PUSH_UPDATE.cmd again.

If a bad update stops the app from opening at all, the safe fix is the same: republish the last good
update, then open Glaze twice.

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
