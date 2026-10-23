# Releasing Couch (plain-words guide)

This is for building Couch on your Windows PC with EAS Build, putting it on your iPhone through TestFlight, and pushing small updates afterwards. All commands run in a Command Prompt opened in the Couch folder. Nothing here has been tried on a real build yet; if a step looks different on screen, follow what the screen says and leave a comment.

Identity already set in `app.json`: iOS bundle ID and Android package are both **`com.jared797.couch`**, app name **Couch**.

---

## (a) One-time setup

1. Sign in to Expo (free account):
   `npx eas-cli@latest login`
2. Link this folder to an Expo project. This adds `extra.eas.projectId` to `app.json`:
   `npx eas-cli@latest init`
3. Turn on EAS Update. This adds `updates.url` to `app.json` (it is deliberately missing until you run this):
   `npx eas-cli@latest update:configure`
4. Create the app record in App Store Connect (appstoreconnect.apple.com → Apps → "+" → New App): platform iOS, name Couch (or a variant if the name is taken), bundle ID **com.jared797.couch** (pick it from the list; if it is not there yet, the first `eas build` registers it for you, then come back), SKU anything, e.g. `couch`.
5. Commit the `app.json` changes those commands made.

---

## (b) Building for TestFlight

1. Build in the cloud (EAS handles certificates and provisioning; say yes when it offers to):
   `npx eas-cli@latest build --platform ios --profile production`
2. When the build finishes, send it to App Store Connect / TestFlight:
   `npx eas-cli@latest submit --platform ios --latest`
3. After Apple finishes processing (usually minutes to an hour), it appears in the TestFlight app on your iPhone.

The `production` profile also bumps the build number automatically (`autoIncrement`).

**The three build profiles in `eas.json`:**

| Profile | What it is for | Update channel |
|---|---|---|
| `development` | A dev build of Couch you run with `npx expo start --dev-client`. Includes the native modules Expo Go lacks (UDP discovery, zeroconf), so it is the closest thing to the real app while still live-reloading code. Installed directly (internal distribution), not via TestFlight. | `development` |
| `preview` | A normal-looking build to install directly on registered devices (internal distribution) for a quick check without going through TestFlight. | `preview` |
| `production` | The build that goes to TestFlight and later the App Store. | `production` |

---

## (c) OTA update or new TestFlight build?

**Push an update (fast, no Apple review):** double-click **`PUSH_UPDATE.cmd`** and type a short note when asked. Use it for changes to:
- app screens and logic (JavaScript / TypeScript),
- text and translations,
- images bundled with the app.

Phones get it quietly in the background the next time Couch is opened, and use it from the time after that (a full close and reopen, a "cold start"). Couch never restarts itself mid-use for an update.

**Make a new TestFlight build (section b) when you change:**
- a native module (adding or upgrading a package with native code),
- permission text or other native config in `app.json` (Info.plist keys, Bonjour services, entitlements, plugins),
- the icon or splash screen,
- the Expo SDK version,
- the app version.

**Version rule.** `runtimeVersion` uses the `appVersion` policy, so an update only reaches builds with the **same `"version"` in `app.json`**. Whenever you make a new native build, bump `"version"` first (e.g. 1.0.0 → 1.0.1). Updates published afterwards then go to that new build only; phones still on the old build keep what they have until they install the new one.

**Channels.** `PUSH_UPDATE.cmd` publishes to the `production` channel, which only `production` builds (TestFlight / App Store) listen to. `preview` and `development` builds listen to their own channels; to update those, run `npx eas-cli@latest update --channel preview --message "note"` (or `development`).

Expo Go ignores all of this: it always runs the code from your PC.

---

## (d) Multicast networking entitlement (required before a TestFlight build can find TVs)

**Why.** Since iOS 14, an app may not send multicast traffic on the local network unless Apple has granted it the `com.apple.developer.networking.multicast` entitlement. Couch finds Roku, Samsung, LG, Sony and other TVs with SSDP, which is multicast. Without the entitlement, a TestFlight build will not discover those TVs automatically. Expo Go has its own entitlement, so discovery working in Expo Go does **not** prove your own build will work.

**Steps:**

1. Sign in at **developer.apple.com** with your Apple Developer account.
2. Open the request form: **https://developer.apple.com/contact/request/networking-multicast**
   *(Apple moves these pages sometimes. If the link does not work, search the web for "multicast networking entitlement request".)*
3. Fill it in: Bundle ID **com.jared797.couch**, App name **Couch**, and paste the description and address list from **`docs/multicast-request.md`**.
4. Wait for Apple's email. It typically takes a few days to a couple of weeks.
5. After approval: developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **com.jared797.couch** → Additional Capabilities. If Apple added **Multicast Networking** there, tick it and save.
6. Build with the environment variable **`COUCH_MULTICAST_ENTITLEMENT=1`**. The config plugin `plugins/withLanAccess.js` then adds the entitlement. Either:
   - add it to the `production` profile in `eas.json`:
     ```json
     "production": {
       "autoIncrement": true,
       "channel": "production",
       "env": { "COUCH_MULTICAST_ENTITLEMENT": "1" }
     }
     ```
     (keep whatever else is already in that profile), **or**
   - set it as an EAS environment variable for the production environment on expo.dev (project → Environment variables).
7. Make a new build (section b). This is a native change, so an OTA update is not enough. Do **not** set the variable before Apple approves: the build would fail signing.

**Until then:** TestFlight builds still work with TVs by typing the TV's IP address (Add a TV → enter IP) or letting Couch probe the local subnet; it is just slower than automatic discovery. Bonjour-based TVs (Android TV / Google TV, Fire TV, Vizio) use `NSBonjourServices` and do not need this entitlement.

---

## (e) Android

The Android package is `com.jared797.couch`. `npx eas-cli@latest build --platform android --profile preview` produces an Android build for internal testing. Google Play submission is not set up yet.
