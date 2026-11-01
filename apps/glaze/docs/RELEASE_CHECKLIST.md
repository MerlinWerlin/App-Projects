# Glaze — release checklist (App Factory release standard)

Checked against App-Projects `docs/RELEASE_STANDARD.md` (owner, 25 Oct 2026, #88). Written by the cloud build run 112
(oversight D142-3); brought to "done except owner steps" for the first App Store release by T266 (owner-1101i #3,
1 Nov 2026). "Owner" items need the owner's iPhone or his App Store Connect login; nothing here was tried on a device
from the cloud. No store submission is made from the cloud.

## 0. Version decision (T266)

- [x] **Release as `1.0.1`**, the version already on TestFlight (build 20), with build numbers that keep rising.
  - App Store Connect groups builds into version "trains" by marketing version. The App Store version you create must
    match the train of the build you attach, and a train can't go backwards once Apple approves something, so "1.0.0"
    would mean a fresh upload under a lower number for no gain. Keeping 1.0.1 lets you submit a build you already
    tested.
  - `runtimeVersion.policy` is `appVersion`, so the App Store build and the TestFlight builds share runtime `1.0.1`
    and the same over-the-air fixes reach both. A 1.0.0 build would split them.
  - Build numbers: `eas.json` uses `appVersionSource: remote` with `autoIncrement`, so EAS gives every build the next
    number (21, 22, …); `ios.buildNumber` "1" in `app.json` is ignored. Nothing to change.
  - Next release: raise `expo.version` to `1.0.2` (or `1.1.0` for a feature release). That also starts a new
    runtime, so it needs a new native build.
- [x] `app.json` stays `1.0.1`; `RELEASE.json` does not exist in this repo (nothing to change there).
- [x] App Store build profile: **`production-native`** (StoreKit, profile server, widgets, home scan). The plain
      `production` profile stays native-free (`GLAZE_NATIVE=0`) for quick JS-only checks and must not be submitted.
- [ ] Owner: in App Store Connect create the App Store version **1.0.1** (Apps > Glaze > iOS App > "+" next to iOS
      App, or the version already shown) and pick the newest `production-native` build that passed your TestFlight
      check.

## 1. First launch
- [x] Follows the phone's language (11 locales, `src/i18n`).
- [x] First-session line "Language: <native name> · Change" on Themes, opens the picker, hidden once tapped or after a
      choice (owner #91, `src/core/languageHint.ts`, tests). Language also at the top of Settings.
- [x] No blocking prompts: no sign-up, no paywall at launch (the Plus sheet opens only when something Plus is tapped).
- [x] Filters start off: Themes and Wallpapers open on "All"; empty Liked/New lists say why and offer "Show all" (#91).

## 2. Purchases
T152 (owner, 25 Oct; supersedes T140): Glaze Plus is a real **StoreKit 2** purchase through Glaze's own local module
`modules/glaze-store` (no npm package; expo-iap is not used). Product id `com.jared797.glaze.plus`, non-consumable,
A$2.99 one-time. It is linked only in native builds (`production-native`, `development`, `preview`); Expo Go, Android and
the plain `production` profile keep the honest mock. App Store Connect steps: `docs/IAP_SANDBOX.md`.
- [x] No npm package added; local Expo module, adapter `src/native/store.ts` never throws (`requireOptionalNativeModule`)
- [x] `Product.products(for:)` + `product.purchase()`; verified transactions `finish()`ed; `Transaction.updates` listener
- [x] After a failure, re-checks `Transaction.currentEntitlements` before showing the failure (`buyPlus`, src/core/plusStoreKit.ts)
- [x] Failure line says nothing was charged and shows the store code; cancel is silent; Ask to Buy says it is waiting
- [x] Restore purchases on the same sheet as Unlock (`AppStore.sync()` then entitlements)
- [x] Shows the App Store's localised price once loaded (fallback A$2.99)
- [n/a] Free trial — Glaze is a one-time unlock with a generous free tier; no trial planned
- [x] Paywall promises only built features (#91 removed "Theme clips for Live Photos"); tip jar hidden outside dev builds (#91)
- [x] No "can't buy in this test version" text in a native build with the store module (only the mock path says it)
- [ ] Owner: create the In-App Purchase in App Store Connect (`docs/IAP_SANDBOX.md`), add its review screenshot (the
      Plus sheet) and tick it under the 1.0.1 version's "In-App Purchases and Subscriptions" so it is reviewed with the app
- [ ] Owner: on TestFlight (`production-native` build), buy Plus (sandbox) and Restore on a real iPhone
- [ ] Android: Google Play Billing not built (Android keeps the mock)

## 2b. Free vs Plus today, and the Plus content decision (T266; oversight D211-1: owner decides)

What the code does today (1 Nov 2026, b874c2d). Nothing was changed by T266: no pack is marked `plus: true`, the
price is unchanged.

| Feature | Free | Plus | Where it is decided |
|---|---|---|---|
| All gallery themes: 95 remote packs (`glaze-packs-v1`, all `plus: false`) + 3 bundled starters | yes | — | `scripts/packs/tiers.json` (`"plus": []`), catalogue `plus` flag, `src/plus/usePackAccess.ts` |
| Wallpapers, Lock + Home pairs, wallpaper maker for gallery themes | yes | — | `app/wallpaper.tsx` locks only `theme.plus` themes |
| Widgets and Widget Studio for gallery themes | yes | — | `app/widget-studio.tsx` locks only `theme.plus` themes |
| Make-your-own icons, "Install all at once" and Shortcuts install | yes | — | `ops/CONVENTIONS.md` (always free; test-guarded) |
| Live Photo maker, Scan my Home Screen, 282 symbols ("All symbols") | yes | — | `src/core/t127LiveLock.test.ts`, `src/core/glyphsets.ts` |
| Re-download of downloaded packs (Settings › Storage) | free packs yes | Plus packs | `src/plus/usePackAccess.ts` (no Plus packs exist) |
| 32 older Plus themes (Aurora, Story & Play and earlier Plus sets) | — | yes | `src/core/plusThemes.ts`; **not in the gallery since T177**, reachable only if applied before |
| "Moods & Moments" symbol set | — | yes | `src/core/glyphsets.ts` `plus: true`; **no screen shows it** |

So a new App Store user can't find anything Glaze Plus unlocks, while the Plus sheet lists "More Plus themes are on the
way", "Extra widget styles" and "Curated symbol sets". That is a review risk (Guideline 3.1.1 / 2.1: an IAP must unlock
something the reviewer can reach) and a release-standard §2 problem (the paywall promises only built features).

Options for the owner:

| | Option | What changes | Pros | Cons |
|---|---|---|---|---|
| **A (recommended)** | **Plus tier of remote packs.** Mark about 20-25 of the 95 packs `plus: true` in `scripts/packs/tiers.json` and republish the catalogue; keep A$2.99 one-time. Lead trims the Plus sheet rows to what exists ("N extra themes"). | Catalogue data only (no new build); one small JS copy fix. | Review sees real Plus content; still ~70 free themes + 3 starters, so caption 1 "One price. No weekly subscription." stays honest; revenue from day one. | Pick which themes; anyone who already downloaded a now-Plus pack keeps using it (cached). |
| B | **Ship 1.0.1 free, Plus in 1.1.** Hide Unlock/Plus UI for 1.0.1 and don't attach the IAP. | A small JS change to hide Plus; IAP waits. | Smoothest review (no 3.1.1 question); builds ratings first. | No revenue at launch; a later update adds a paywall to an app people know as free. |
| C | **Early access.** New packs are Plus for their first 30 days, then free. | `addedAt`-based rule in the catalogue tooling or app. | Everything ends up free; Plus feels like a supporter pass. | More code; review still needs at least one Plus pack live at review time. |

- [ ] Owner: pick A, B or C for Glaze Plus content (and, for A, roughly how many and which packs are Plus). Workboard need `glaze-plus-content`.

## 3. App Store Connect
- [x] Final listing in `docs/STORE.md`: name `Glaze: Icon Themes & Widgets` (28), subtitle `Aesthetic Home Screen
      Makeover` (30), keywords (95), promotional text (163), description (1,588), support and privacy URLs, copyright,
      category **Lifestyle** (secondary Utilities, reasons in STORE.md). No competitor names, no live-wallpaper promise,
      no invented counts (limits guarded by `src/core/t266Release.test.ts`)
- [x] Review notes `docs/REVIEW_NOTES.md` "Notes to paste for version 1.0.1": what the app does, no login, reviewer
      test steps, icon install (profile with web clips from 127.0.0.1, Shortcuts alternative), IAP, network calls,
      no background audio; risk table for 5.5 / 4.x / 2.x / 3.1.1 with the `src/config/install.ts` switch as mitigation
- [x] Review notes answer Apple's new-developer questions (purpose/audience, no login, no external services, no regional
      differences, no regulated material) — `docs/REVIEW_NOTES.md` "App Review information" (T141)
- [x] EAS Update check (T174, run 192): expo-updates sends a random per-install client ID (Expo docs: "not derived from any hardware or account identifier", pseudonymous) to `u.expo.dev` only to pick the right update; no tracking, no ads, nothing linked to the person. "Data Not Collected" is the intended answer; the cautious alternative, if Apple ever queries it, is Identifiers > Device ID · App Functionality · Not linked · Not tracking. Privacy page and REVIEW_NOTES item 4 now say this
- [x] Paid Apps Agreement, bank and tax active (account, 23 Oct)
- [ ] Owner: paste the listing fields from `docs/STORE.md` into the 1.0.1 version page (en-AU), set the category to
      Lifestyle / Utilities, price Free
- [ ] Owner: paste the review notes block from `docs/REVIEW_NOTES.md`, turn "Sign-in required" off, add your contact
      name, phone and email under App Review Information
- [ ] Owner: record the screen recording on a physical iPhone (launch → theme → Use this theme → icons → widget →
      Plus Unlock/Restore) and attach it to the review notes
- [ ] Listing fields via `scripts/asc/asc.py` in App-Projects (en-AU, unique name check, 6.9" screenshots, IAP review
      screenshot) — optional instead of pasting by hand; App Factory chat

## 3a. App Privacy (T266)
Answer in App Store Connect > Apps > Glaze > App Privacy > Get Started: **"No, we do not collect data from this app"**
→ label **Data Not Collected**. Why it is honest, call by call (all in `docs/privacy.html`):

| Network call | What is sent | Why it is not "collection" |
|---|---|---|
| Theme packs from GitHub Releases | Plain file requests (catalogue, manifests, PNGs) | No identifier or personal data; GitHub sees an IP like any download. Files SHA-256 checked |
| Expo updates (`u.expo.dev`) | App version, runtime, channel, a random per-install client ID | Not derived from device or account, not linked to a person, not used for tracking (Expo docs) |
| App Store category lookup (`itunes.apple.com`, owner-1101f T231) | Only the name of an app Glaze doesn't recognise + store country code | No identifier; public search; answer cached on the phone |
| Older Space themes (`cdn.esawebb.org`) | One image request, only if such a theme is opened | No identifier; not in the gallery since T177 |
| StoreKit (Apple) | Purchase and restore, handled by Apple | Apple's data, not the developer's |
| Send Feedback | Opens the user's own Mail app | Nothing is sent unless the user presses Send; optional user-initiated email is not collection |

- [x] Answers and reasons written (this table, `docs/privacy.html`, `docs/site/privacy.html`)
- [ ] Owner: App Privacy > "No, we do not collect data" > Publish; Privacy Policy URL from §6

## 4. Age rating (T266)
App Store Connect > App Information > Age Rating > Edit. Answers:

| Question group | Answer |
|---|---|
| Cartoon or fantasy violence, realistic violence, prolonged graphic violence | None |
| Profanity or crude humour, mature or suggestive themes, sexual content or nudity | None |
| Horror or fear themes | None (a few Halloween-style themes are cute pumpkins and bats, no horror) |
| Alcohol, tobacco or drug use or references; medical or treatment information; health or wellness topics | None / No |
| Simulated gambling; contests; loot boxes | None / No |
| Unrestricted web access | **No**. The app opens Safari only to a page it serves itself on 127.0.0.1 (the icon profile) and to fixed links (licences, Apple's Shortcuts app); it has no in-app browser or free web navigation |
| User-generated content, messaging or chat, social features | **No**. Nothing a user makes is shared with anyone; no accounts, no chat |
| Advertising | No |
| Parental controls, age assurance | No / Not applicable |
| Made for Kids | No (general audience) |

Result: **4+**.
- [x] Answers written
- [ ] Owner: enter the age rating answers above (all None / No) and confirm the result is 4+

## 5. Export compliance (T266)
- [x] `app.json` `ios.config.usesNonExemptEncryption: false` (Expo's documented key; the build writes
      `ITSAppUsesNonExemptEncryption = NO` into Info.plist), guarded by `src/core/release.test.ts` and
      `src/core/t266Release.test.ts`. Glaze uses only Apple's HTTPS (URLSession) and SHA-256 integrity checks, which
      are exempt; no custom or proprietary encryption. With the key set, App Store Connect does not ask the export
      question per build, and no French declaration or annual self-classification report is needed
- [x] Regular `production` profile stays native-free (no change to `eas.json`)

## 6. Support and privacy pages (T266)
- [x] `docs/site/index.html` (support: what Glaze is, use a theme, wallpaper, install icons all at once, Shortcuts route,
      remove the profile, widgets, Plus restore, Live Photo note, contact) and `docs/site/privacy.html` (byte copy of
      `docs/privacy.html`, test-guarded). Self-contained: inline CSS, no scripts, fonts or images
- [x] Proposed URLs (Glaze lives at `apps/glaze` in the public `MerlinWerlin/App-Projects` repo):
      support `https://merlinwerlin.github.io/App-Projects/apps/glaze/docs/site/`,
      privacy `https://merlinwerlin.github.io/App-Projects/apps/glaze/docs/site/privacy.html`.
      This repo copy has no Pages workflow or `.nojekyll`; Pages settings can't be read from the cloud
- [ ] Owner: replace the text `SUPPORT_EMAIL` (twice) in `apps/glaze/docs/site/index.html` with the support email
      address you want public (a dedicated address is better than your personal one; `src/config/feedback.ts` still
      sends in-app feedback to your personal address, "TODO before store release")
- [ ] Owner: enable GitHub Pages on App-Projects: github.com/MerlinWerlin/App-Projects > Settings > Pages > Source
      "Deploy from a branch" > Branch `main`, folder `/ (root)` > Save; then open the support URL above on your phone
      and check it loads
- [ ] Owner: put the two URLs into App Store Connect (Support URL on the version page; Privacy Policy URL under App
      Privacy)

## 7. Screenshots (T266 plan, T267 renders)
- [x] Plan in `docs/STORE.md` "Screenshots": 6 shots (home hook, Themes gallery, Use this theme steps, icons install,
      widgets, wallpapers), captions with counts, caption 1 "Themes, icons and widgets that match. One price. No weekly
      subscription."; sizes 6.9" 1320 x 2868 and 6.5" 1284 x 2778; renders on the build page under `store-screens/`
- [x] T267: both sets rendered (store/screenshots/render.mjs; JPEG, no alpha) and published on the build page under `store-screens/6.9/` and `store-screens/6.5/` (compositions from app code/assets, not device captures: check against the real app)
- [ ] Owner: download and upload `store-screens/6.9/01-06 *.jpg` to the 6.9" slot and `store-screens/6.5/01-06 *.jpg` to the 6.5" slot
      of the 1.0.1 version page, in order

## 3b. Theme packs on GitHub Releases (owner-1030 A, T169, 30 Oct)
- [x] Pack build + flat release-asset scripts written and tested offline (`scripts/packs/`, T159, T169); app lists and downloads hosted packs (T160)
- [x] App points at the release: production `glaze-packs-v1`, staging `glaze-packs-staging` on `MerlinWerlin/App-Projects` (`src/config/packs.ts`)
- [x] Release is live: `catalog.json` on `glaze-packs-v1` returns 95 packs (generated 2026-11-01T06:42Z, checked by T266)
- [ ] Owner: on TestFlight, download a pack, then turn on Airplane mode and check the theme still shows
- [x] Privacy page + App Privacy: pack downloads come from GitHub (github.com / objects.githubusercontent.com see the phone's IP address like any website, and Glaze sends no personal data). "Data Not Collected" still holds; sentence added to `docs/privacy.html`, Settings › Privacy and `docs/REVIEW_NOTES.md` (T174)
- [ ] Decide the theme tiers (`scripts/packs/tiers.json`) — now part of the Plus decision in §2b; app download stays under ~40 MB

## 3c. Look and feel (owner-1030 B/C, 30 Oct)
- [x] Smoother lists (virtualised Themes/Widgets/Wallpapers, cached downscaled images) and one design token set (T162, T163)
- [ ] Owner: TestFlight check in `docs/TRIAL.md` "New since your last test"
- [ ] Design critique screenshots + agreed points (`docs/design_review_1030/README.md`, `docs/DESIGN_CRITIQUE_1030.md`)
- [ ] Store screenshots retaken after the critique changes (now T267, §7)

## 3d. SDK 57 pins (D203-1, 30 Oct)
- [x] `expo-image` ships as `~57.0.5` on SDK 57 (App-Projects `apps/glaze`), never the cloud's `~3.0.0`; full table in `docs/SDK57_PINS.md`
- [ ] PC: full `npm install` + `tsc` + `expo export` on the SDK 57 copy before the build that is submitted

## 8. While in review
- Ship only reviewer-needed fixes over the air; everything else waits for the next version.
- If App Review rejects the profile install under 5.5: set `PROFILE_INSTALL_ENABLED` to `false` in
  `src/config/install.ts`, ship that (OTA or new build), reply with the "Switch OFF" text from `docs/REVIEW_NOTES.md`.

## Before submitting, also
- [x] `NSPhotoLibraryUsageDescription` in app.json says "Live Photos" (no "lock screen loops"; T140 done).
- [x] `src/config/install.ts PROFILE_INSTALL_ENABLED` stays **true** for the App Store build: the owner chose the
      profile as the main method (T202, 1 Nov); the review notes describe it and the switch is the fallback (§8).
- [ ] Owner: Submit for Review (App Store Connect > version 1.0.1 > Add for Review > Submit) once every Owner item
      above is ticked. Choose "Manually release this version" if you want to pick the launch day.
