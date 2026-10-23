# Linework release checklist (R5 / T59)

What has to happen, in order, to get Linework 1.0 from this repo into TestFlight and then the App Store (and Google Play). Owner steps are marked **Owner**; everything else is already done in the repo.

**Honest status: nothing in this repo has been tested on a real device or a simulator.** Every check below is a static code review done in the cloud (no device, no simulator, npm registry unreachable, so no `npm install` either). The first real run is the owner's TestFlight / Expo Go trial.

---

## E2E pass 19 Oct (static review of every screen and control)

Checked on every screen: (1) every touchable has `accessibilityLabel` + `accessibilityRole` (+ `accessibilityState` for tabs, radios, switches, checkboxes) and a target of at least 44–48 pt (`sizeV2.touch`, or `hitSlop` on the camera glass pills); (2) camera / photo / media-library permission paths; (3) dark mode (no raw colours outside `src/theme` on themed screens); (4) no hard-coded English outside the i18n catalogues, all 11 catalogues complete (`src/i18n/scan.test.ts`, `src/i18n/catalogs.test.ts`); (5) RTL (start/end styles, mirrored chevrons, physical `left` only inside never-mirrored LTR layers marked `rtl-physical-ok`); (6) no network calls or analytics, tracing tools never gated by Plus (`src/core/traceState.test.ts`, `src/core/sketchSteps.test.ts`, `src/plus/entitlement.test.ts`).

| Screen | Checked | Gaps found | Fixed in commit |
|---|---|---|---|
| Home `app/(tabs)/index.tsx` | 1–6; Trace a photo (system photo picker, no library permission needed on iOS 14+ / Android 13+), Take a photo (camera permission), camera-denied card with Open Settings, recent tiles, settings button, progress / drawings rows | Camera-denied card stayed on screen after the person switched camera access on in Settings and came back | `63cf8ac` (re-reads the status on return to the app) |
| Templates `app/(tabs)/templates.tsx` | 1–6; search field (labelled, hint), category tabs (`tab` + selected state), cards (favourite heart 48 pt with selected state, long-press Quick trace exposed as an accessibility action), detail sheet | none | — |
| My drawings `app/(tabs)/drawings.tsx` | 1–6; tiles, empty state, compare view | none | — |
| Settings `app/(tabs)/settings.tsx` | 1–6; inset rows (the row is the accessible switch, the inner Switch is hidden so it is not read twice), language picker, privacy text ("Data Not Collected") | none | — |
| Prepare `app/prepare.tsx` | 1–6; outline / sketch-steps controls, sliders (`adjustable` with increment / decrement and value text), Trace / Lightbox buttons | none | — |
| Trace `app/trace.tsx` (camera, intentionally dark glass) | 1, 2, 4, 5, 6; permission loading / ask (Allow, Use Lightbox, Back) / denied (Open Settings via `Linking.openSettings`, Use Lightbox, Back); lock, grid, opacity slider, torch, record (muted, no microphone permission), paper check, finish sheet | Camera-off screen stayed after the person allowed camera in Settings and returned (`useCameraPermissions` only reads the status on mount) | `63cf8ac` (AppState listener calls the hook's `getPermission()` while access is missing) |
| Timelapse save (`src/ui/Timelapse.tsx`, `src/native/mediaLibrary.ts`) | 2; write-only ("add photos") media-library permission, ask → save, denied → explain + Open Settings, errors come back as a result, never throw | none | — |
| Lightbox `app/lightbox.tsx` (white backlight by design) | 1, 4, 5, 6; no-image state, lock, controls | none (white / black are the point of the screen) | — |
| Plus `app/plus.tsx` | 1–6; Buy says "coming soon" until T60, restore, no tracing tool behind it | none | — |
| Shared controls (`src/ui`, `src/ui/v2`) | 1, 3, 5; Button, PillButton, CameraButton, LockButton, Segmented, PillSegmented, Chips, TabBarV2, sliders, TouchLock | none | — |
| Guard rails | — | Gap classes above were only checked by hand | `ef53eff`: `node ops/ui-check.mjs` now fails on a touchable without label / role, a tab / radio / switch / checkbox without state, or a raw colour on a themed screen |

Left / not checkable without a device (see the table at the end): real contrast in dark mode, VoiceOver / TalkBack reading order, Dynamic Type at the largest sizes, how Expo Go on Android behaves with write-only media-library access, Arabic RTL reload. The camera-permission "loading" moment is a plain black screen with a spoken label (it lasts a fraction of a second; left as is).

---

## Owner actions, in order (updated 22 Oct 2026 night, decisions in docs/OWNER_1022D.md)

Decided: store name **Linework: Trace & Sketch** (home screen shows "Linework"), subtitle **Trace photos onto real paper**, **14-day free trial of everything, then Linework Plus A$2.99 one-time** (keeps the full template library and outline mode; own-photo tracing with every tracing tool and 24 starter templates stay free), support email **jaredbradley272@gmail.com** (can change later), screenshot style **(a) serif on pastel**.

### 1. Accounts and money (Owner, App Store Connect, once)
- Apple Developer Program: already active (Linework went to TestFlight before).
- App Store Connect → Business: sign the **Paid Apps agreement** and fill in **bank account and tax forms**. Apple will not sell anything (even A$2.99) until these show "Active"; it can take a day or two.

### 2. The app record and the purchase (Owner, App Store Connect)
- My Apps → Linework → App Information: name **Linework: Trace & Sketch**, subtitle **Trace photos onto real paper**, category Graphics & Design (secondary Education).
- Monetization → In-App Purchases → **+** → **Non-Consumable**, Reference name "Linework Plus", Product ID **com.jared797.linework.plus**, price **A$2.99**, display name "Linework Plus", description "Unlocks every template and outline mode", any screenshot of the Plus screen for review. Leave it "Ready to Submit"; it is submitted with the 1.0 build.

### 3. Privacy and support pages (Owner, 5 minutes)
- docs/privacy.html and docs/support.html already carry the support email. They need public URLs for the listing: the simplest free option is a GitHub account → new public repo → upload the two files → Settings → Pages. Put the two URLs into App Information (Privacy Policy URL) and the version page (Support URL).

### 4. Build and test on the phone (Owner, PC)
- First double-click **TESTFLIGHT_PRECHECK.cmd** in the same folder (install, `npx tsc --noEmit`, `npx expo export --platform ios`; a few minutes). If it says it failed, paste **testflight-precheck.txt** into a comment on the Linework Build page and wait for the fix instead of building.
- Double-click **TESTFLIGHT_LINEWORK.cmd** in Desktop\Apps\linework (logins typed by you). It installs expo-iap, builds and uploads. About 10–30 min later the build is in TestFlight.
- In TestFlight: everything unlocked (trial). Settings on the iPhone → App Store → Sandbox Account: sign in with a sandbox tester (App Store Connect → Users and Access → Sandbox → add one). Then in Linework → Plus → **Unlock for A$2.99** (sandbox, no real money) → Templates show no locks; **Restore purchases** finds it after reinstalling.
- Expo Go cannot buy (no store there): use the test links on the Plus screen ("End trial now", "Simulate purchase") to see the locks.

### 5. Store listing (Owner, App Store Connect, copy-paste from docs/STORE.md)
- Promotional text, description, keywords, What's New, support/privacy URLs.
- Screenshots: style (a), from store/ in the trial kit (6.9" set).
- App Privacy: **Data Not Collected**, Tracking: No. Age rating 4+. In-App Purchases: Yes. Price: Free.

### 6. Submit (Owner)
- Version 1.0 → pick the TestFlight build → tick the Linework Plus in-app purchase under "In-App Purchases and Subscriptions" → Submit for Review. Review usually takes 1–3 days.

## Verified in cloud vs needs device

"Verified in cloud" means a static review or an automated test in this repo; none of it ran on a phone.

| Area | Verified in cloud (static / tests) | Needs device |
|---|---|---|
| Builds at all | `npm test` (481), `sh ops/typecheck-core.sh`, `npm run typecheck:ui` against hand-written stubs, `node ops/ui-check.mjs` (syntax, imports, Hermes Intl, a11y props, raw colours) | A real `eas build`; real TypeScript against installed `.d.ts` files (registry unreachable, never run) |
| Camera permission | All three states render a screen with Allow / Open Settings / Use Lightbox / Back; re-read on return from Settings | The system prompt text, the actual Settings round trip, Expo Go vs TestFlight differences |
| Photos | System picker (no library permission), camera-capture permission, HEIC → JPEG, error kinds become friendly messages | Picking HEIC / huge / cloud photos on a real phone |
| Timelapse save | Write-only permission flow, never throws | Recording itself, muted video on Android Expo Go, saving into Photos |
| Accessibility | Every touchable has label + role (+ state); sliders are `adjustable`; 44–48 pt targets in code | VoiceOver / TalkBack order and wording, Dynamic Type at max sizes |
| Dark mode | Themed screens use tokens only (ui-check enforces it) | Actual contrast and look in both modes |
| Languages / RTL | 11 complete catalogues, no hard-coded strings (tests), start/end styles | Arabic reload into RTL, German / French wrapping, CJK / Devanagari line heights |
| Privacy | No network, analytics, ads or accounts (dependency guard test) | — (only EAS Update's own launch check talks to the network) |
| Plus never gates tracing | Tests under `src/core` and `src/plus` | Real purchase / restore (T60, needs App Store Connect + dev build) |
| Native extras | — | T53 subject cut-out, T60 in-app purchases: only possible in a development build |
