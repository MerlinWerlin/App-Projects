# Releasing Linework

This page explains, in plain words, how Linework gets from your PC onto your iPhone through TestFlight, and how to send quick fixes without making a new build.

There are two ways to get changes to your phone:

1. **A quick update (over the air).** Double-click `PUSH_UPDATE.cmd`. Takes a few minutes, no Apple review, no new TestFlight build. Works for most changes.
2. **A new TestFlight build.** Needed when something "native" changes (list below). Takes longer and goes through TestFlight processing.

## The app's identity

- iPhone bundle ID and Android package: `com.jared797.linework` (set in `app.json`).
- `usesNonExemptEncryption` is `false`, so App Store Connect will not ask the export-compliance question for every build. Linework uses no custom encryption.

## One-time setup (on your PC)

You only do this once. Open a Command Prompt in the Linework folder (the folder with `START_TRIAL.cmd`), then:

1. **Log in to Expo:**
   ```
   npx eas-cli@latest login
   ```
   Use your free Expo account.
2. **Link the project to your Expo account:**
   ```
   npx eas-cli@latest init
   ```
   This creates the project on expo.dev and writes its **project ID** into `app.json`.
3. **Switch on over-the-air updates:**
   ```
   npx eas-cli@latest update:configure
   ```
   This fills in the update address (`updates.url`) in `app.json` using that project ID. The app is already set up for everything else; only your PC can create the project ID, so this step has to happen there. Commit or keep the changed `app.json`.
4. **Make the first TestFlight build:**
   ```
   npx eas-cli@latest build -p ios --profile production
   ```
   EAS asks to sign in with your Apple Developer account and sets up the certificates for you. Say yes to the defaults.
5. **Send it to TestFlight:**
   ```
   npx eas-cli@latest submit -p ios
   ```
   Pick the build you just made. After Apple finishes processing (usually 10 to 30 minutes), it shows up in the TestFlight app on your iPhone.

From now on, that TestFlight build listens for quick updates on the `production` channel.

## Everyday: quick update with PUSH_UPDATE.cmd

Use this for changes that are only JavaScript, which is most of the work:

- text and wording
- layout, colours, spacing
- screens and buttons
- templates
- translations

How:

1. Double-click `PUSH_UPDATE.cmd` in the Linework folder.
2. Type a short note (for example "Fix Settings wording") and press Enter. If you leave it empty it uses "Linework update".
3. Wait for "Done".
4. On your iPhone: **open Linework, close it fully (swipe it away), then open it again.** The first open downloads the update quietly in the background; the next open uses it. The app never restarts by itself in the middle of what you are doing.

## When you need a NEW TestFlight build instead

A quick update cannot change the app's native parts. Make a new build (steps 4 and 5 above) when any of these change:

- native code or native settings
- permissions, or the permission text iPhone shows (the camera / photos messages in `Info.plist`)
- the app icon or splash screen
- a new native package (for example adding `expo-dev-client`)
- an Expo SDK upgrade
- the app version: Linework uses the "appVersion" rule (`runtimeVersion` policy `appVersion`), so **bumping `"version"` in `app.json` always needs a new build**. Quick updates only reach builds with the same version number.

If in doubt, make a new build. It is never wrong, just slower.

## Build profiles and channels (`eas.json`)

There are three kinds of build. Each one listens for quick updates on the channel with the same name.

| Profile | What it is for | Channel |
| --- | --- | --- |
| `development` | A developer build with debugging tools. You will rarely need it. | `development` |
| `preview` | An internal test build you install straight onto a registered phone. | `preview` |
| `production` | The build that goes to **TestFlight** (and later the App Store). Its build number goes up by itself every time. | `production` |

**TestFlight uses `production`**, and `preview` is for quick internal installs. Those are the two you care about. `PUSH_UPDATE.cmd` sends to `production`. To update a preview build instead, run `npx eas-cli@latest update --channel preview --message "note"`.

The `development` profile needs one extra package first. It is left out on purpose so the Expo Go trial (`START_TRIAL.cmd`) keeps working. Only if you ever want a development build, run this once in the Linework folder before building (this is a native package, so it means a new build):

```
npx expo install expo-dev-client
```

## Expo Go still works

`START_TRIAL.cmd` is unchanged: it still opens Linework in Expo Go on your phone. Quick updates are simply switched off inside Expo Go and while developing, so nothing there changes or breaks.
