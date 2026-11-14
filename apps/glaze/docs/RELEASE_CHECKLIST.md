# Glaze — release checklist (App Factory release standard)

Checked against App-Projects `docs/RELEASE_STANDARD.md` (owner, 25 Oct 2026, #88). Written by the cloud build run 112
(oversight D142-3); brought to "done except owner steps" for the first App Store release by T266 (owner-1101i #3,
1 Nov 2026). "Owner" items need the owner's iPhone or his App Store Connect login; nothing here was tried on a device
from the cloud. No store submission is made from the cloud.

## 0. Version decision (T266)

**14 November 2026 TestFlight feedback: `1.0.35`.** Owner in chat, 14 Nov: no Lock Screen tab (later), Medium / Large say Coming soon, one icon shape (no blob / circle / square / rounded pickers; studio.ts ONE_ICON_SHAPE), future list in docs/FUTURE.md. Owner TestFlight notes 03:58-04:03 UTC on 1.0.33: Small Widgets grid "they all need to go" (Small = My widget art only; it and the family-header fix missed #303's merge); corner Watch how "highlighted and glowing" (filled tint pill) on Install icons / Widget Studio and now also in the top-right of the Icons, Widgets and Wallpapers tabs; Wallpapers "should have downloaded wall papers as well" (Theme wallpapers grid, useDownloadedThemeWallpapers, tap = Save to Photos via saveFileToPhotos or Open the theme); Install icons "menus confusing" (a theme's flow opens /install on AddChooser: Icons continues into the install, Widgets opens the Widgets tab; Icons tab / auto skip it). Strings in 11 languages.

**14 November 2026 TestFlight widgets clean-up: `1.0.34`.** Owner 2026-11-14 ("remove the medium large lock screen... just show the medium and large clocks... straw berry dessert etc needs to go... the top right middle right bottom right... remove it... watch now... looks whack in dark mode"): Widgets tab without theme or look chips, showing the theme in use: Small = My widget art (Artwork 1-5) only (TestFlight 04:00 "they all need to go"), Medium / Large / Lock = the clocks only (tabNav WIDGET_TAB_SET_KINDS / WIDGET_TAB_CATALOGUE_KINDS: ClockWidget S/M/L, AnalogClockWidget S/L/Lock circular); theme page SeamlessCard (Home Screen spot + nudge) removed for the add-a-widget steps + Watch how; Watch how: corner = filled tint pill ("highlighted"), full width = `soft` pill (fill + tint, tint/fill in the contrast audit). No widget kind, name, Artwork slot, icon profile or purchase change; the native widgets are untouched.

**14 November 2026 TestFlight design polish: `1.0.33`.** Design review (ios-review, ui-review, ui-compare, accessibility-review, ux-copy) on simulator captures (glaze-design-capture.yml): number-free live art in the widget art menu draws a sample date / 25:00 / time in its liveFrame (LiveArtSample); Themes "See all" sits on the section title (PillButton's alignSelf overrode the row); ContextTip leads keep a title's own ? / ! (tipLead); Theme / Widget Studio "Theme not found" is a centred empty state. No purchase, icon profile, widget kind / name or Artwork slot change.

**14 November 2026 TestFlight hotfix: `1.0.32`.** Widget Studio failed to open in 1.0.31: `useHowTo('widgets')` was called in the route wrapper while `how` was read inside `WidgetStudio` (a type error no PR check caught). The hook now lives in `WidgetStudio` (guarded in howToClips.test.ts), and every Glaze PR runs `npm run typecheck` and `npm test` (glaze-widget-art-options.yml, job typecheck-and-tests).

**15 November 2026 TestFlight big how-to videos: `1.0.31`.** Owner on 1.0.30: "the vids are so small in the app and i was confused where to see them, the first time a widget is select a vid should come up and watching the vid should be an easy access button". HowToSheet: a page sheet with title, a caption spelling the steps out, the recording at the largest size that fits, Got it + Watch again, tap to pause; opens on its own once per category (wallpaper / icons / widgets, AsyncStorage glaze.howTo.seen.v1.*) on the Set it up steps, icons walkthrough, install screen, Widget Studio and the first wallpaper save; Watch how button on each. Inline players removed.

**14 November 2026 TestFlight how-to clips: `1.0.30`.** Owner approved the three screen recordings (wallpaper 18 s, icons 29 s, widgets 25 s; H.264 590×1278, no audio, 1.7-2.1 MB each, ~5.8 MB with posters). Bundled in assets/video, played by src/ui/HowToClip.tsx (expo-video, muted, looping, inline, poster until ready, Reduce Motion = poster + play, paused off-screen / in background) on the icons walkthrough card and the Wallpaper / Icons / Widgets steps of the Set it up flow. IPA grows ~5.8 MB (35.8 → ~41.6 MB).

**14 November 2026 additions to `1.0.29`.** Owner on 1.0.28: a theme with no artwork (every one of the 63 built-in themes; all 141 packs have 2-5) showed a blank grey Artwork tile; now ThemedFallbackArt, a scene in the theme's colours per slot. My widget art: 64 pt number and 132 pt artwork side by side; the separate art picker left the Widgets tab. Use everything opens icon setup every time (walkthrough first, then /install).

**13 November 2026 TestFlight pure Artwork + icons walkthrough: `1.0.29`.** Owner on 1.0.27 (Aurora): My widget art's Artwork 1 was the date picture while the Home Screen Artwork 1 was the mushroom, and Artwork 5 showed a static date picture saying October. One ordered `artwork` list in index.json (pure illustrations: small, option kind `art`, no live value), written by commitThemeArt and read by both the app and the widget; widget art recovery v6 rebuilds once. Owner on Use everything ("scary... scammy... so much information"): a four-card first-time icons walkthrough (app/icons-intro.tsx, demo-video slot), then a one-line Set up icons / How it works row on the theme page.

**13 November 2026 TestFlight icon profile id: `1.0.28`.** Owner: after a theme change the icon profile ADDED a second set instead of replacing (regression of the T194 / #146 fix). The install id behind every profile and web clip identifier lived only in AsyncStorage, wiped by the 12 Nov delete + reinstall. It now also lives in the Keychain (GlazeWidgetBridge stableValueGet / Set, this device only), chosen Keychain → existing AsyncStorage id → fixed `glazeicons` (never random), seeded after the first screen at launch. Install screen note: remove the older profile in Settings › General › VPN & Device Management.

**13 November 2026 TestFlight Artwork list: `1.0.27`.** Owner TestFlight feedback (07:33 UTC): "Large photos are still in the widget store but the galaxy thing is working now. ... the numbers need to be larger and more clear and there needs to be no remove options just the native art works to the theme". My widget art (WidgetArtLibraryList) now lists only the current theme's Artwork 1-5 in slot order, each with a 48 pt number in the slot colour; no Remove / Manage, no other sizes, photos or older pieces.

**13 November 2026 TestFlight Artwork first: `1.0.26`.** Owner TestFlight screenshot (build 74, after delete + reinstall): My widget art had one small art piece (Alpine copper eclipse, all five badges on it) plus the designs; the pack has five. Theme art sync made designs and other sizes before the small art, and saved only after 2 / every 6 pieces, so leaving the app early left Artwork 1-5 on one piece. Now composeOrder puts the Artwork pieces first and the index is saved as soon as they are all made. Badges moved under the name (they covered the title).

**13 November 2026 TestFlight fresh Artwork kinds: `1.0.25`.** Owner on build 74: the gallery tiles "do not correspsone". The code drew the coloured numbered tiles, but iOS kept its stored gallery previews for GlazeThemeArt1-6. Artwork 1-5 are now fresh kinds GlazeArtwork1-5 (no stored preview, so iOS draws the current tiles; the tiles never read the theme, so they cannot go stale). GlazeThemeArt1-6 stay registered in GlazeLegacyArtBundle for placed widgets, out of the Home Screen gallery.

**12 November 2026 TestFlight Artwork slots: `1.0.24`.** Owner: "art work 1 art work 2 ... just be all small arts". The six theme art kinds are "Artwork 1"-"Artwork 6" (1-5 in the gallery), small only. Artwork n = the current theme's n-th small plain art piece (no live pictures, no designs), cycling when the theme has fewer; audit of 141 published packs: every theme has 2-5 small art pieces (Aurora: 2). Owner "colour code them": one fixed colour per slot (coral, amber, mint, blue, violet, rose; src/core/artworkSlots.ts = ArtworkSlotColour in Swift); the generic gallery tile is that colour with a big number, and My widget art badges each piece with its slot colour and number. Placed medium / large Art widgets are no longer supported by these kinds.

**11 November 2026 TestFlight generic gallery: `1.0.23`.** Owner: "make it generic - variations". iOS keeps Add Widget gallery previews after a swap (no API refreshes them), so every gallery preview (isPreview snapshot and placeholder) draws a fixed GallerySample: six palettes, drawn art scenes per Art slot, generic Clock / Battery / Calendar faces. No theme, art index, saved design or photo is read for the gallery. Home Screen widgets unchanged.

**10 November 2026 TestFlight art colour: `1.0.22`.** Owner (Home Screen screenshot): the moon and planet art widgets sat on a lighter frosted panel with a bright rim while the Clock kept its colour. The art was the widget's container background, which iOS may cover with its own glass; it is now drawn in the content like the Clock's face (full colour on tinted Home Screens, iOS 18+). Gallery previews unchanged.

**9 November 2026 TestFlight gallery previews: `1.0.21`.** Owner: the gallery still kept the old theme on 1.0.20; older builds "did and it didn't". iOS caches gallery previews and refreshes them on its own schedule (no API forces it). Every gallery render of art (live pieces and Seamless included) now uses a 360 px thumbnail so each refresh iOS attempts fits the extension memory limit; placed widgets unchanged.

**8 November 2026 TestFlight gallery follows a swap: `1.0.20`.** Owner: the whole Glaze gallery (Clock, Battery, Calendar and Art) stays on the old theme after a swap, even after a restart, while placed widgets swap. Since 1.0.18 the gallery drew 11 Art tiles each decoding its full image; gallery Art tiles now decode a 360 px thumbnail.

**8 November 2026 TestFlight gallery after a swap: `1.0.19`.** Owner: after a swap the gallery's Art pages stayed grey for 25 minutes. The pieces made so far are listed after 2, then every 6; the art build keeps background time when Glaze is left; the wallpaper is decoded once per apply; remote packs crop the wallpaper size this phone downloaded, and art falls back to the flat colour if its sky fails.

**8 November 2026 TestFlight sky and gallery: `1.0.18`.** Owner: art stars do not match and the background is muted; Aurora is missing the fox in its gallery. Art pieces are composed on the theme wallpaper crop (seamless) instead of a flat colour; pieces are planned art first and the gallery shows Art 1-5 in Small and Large.

**8 November 2026 TestFlight swap and blend fix: `1.0.17`.** Owner: "swapping themes is no longer swapping it across to widgets", copper moon still dodgy, grey tiles at the end of the gallery. Choosing a theme (any of the four actions) puts it on the widgets again and a declined wallpaper save no longer blocks it; dim coloured interior pixels are held opaque when art is keyed; the gallery shows Art 1-4 in Small and 1-3 in Large.

**8 November 2026 TestFlight hero copies: `1.0.16`.** Owner asked to ship duplicate removal: leaves out the 144 hero images that copy one of their theme's pieces (double-ups, and the damaged copper moon in Alpine). On top of 1.0.15.

**8 November 2026 TestFlight gallery art: `1.0.14`.** Claude's PR252 adds six theme Art widget kinds and authored-size filtering.

**8 November 2026 owner-directed follow-up, version `1.0.15`.** PR251 contains ordered A to B to A swaps, four separate theme actions and larger completion controls. Gallery and hero-size changes belong to Claude's separate 1.0.14 PR; rebase after it merges. Preserve all restored art UI, the original compositor and photos. Require retained-data Alpine and Aurora checks before TestFlight. Illustrated clock faces and duplicate removal remain excluded.

**7 November 2026 TestFlight art recovery, version 1.0.13.** Restores the art pipeline to 1a12b3b and rebuilds accumulated theme art while preserving personal photos. Later features return only in separately verified builds.

**6 November 2026 TestFlight widget and theme fix: `1.0.9`.** Restores automatic Seamless and art widget setup, orders theme selections and adds the three theme actions.

**6 November 2026 TestFlight clock delivery fix: `1.0.8`.** Download and verify a selected clock face independently of the wallpaper pack. The Widgets screen previews Clock, Battery and Calendar. The theme selects the Home Screen designs.

**6 November 2026 TestFlight pilot: `1.0.7`.** Eight downloadable theme packs add original illustrated clock plates. WidgetKit decodes the selected plate at the size it draws and overlays the live hands and marks.

**6 November 2026 TestFlight follow-up: `1.0.6`.** The three primary Home Screen widget names are Clock, Battery and Calendar. Legacy configurations remain registered and disfavored for the Home Screen.

**6 November 2026 TestFlight train: `1.0.5`.** The Home Screen gallery puts the selected theme's Clock, Battery and Calendar first. Existing widget kinds and configurations remain supported under Other. Alpine's clock uses the original artwork at the widget's rendered size.

**5 November 2026 TestFlight train: `1.0.4`.** The themed widget correction restores Alpine's original live dial and draws a full-size clock, illustrated battery gauge and calendar for each theme. The renderer and clock asset are in the native extension, so the appVersion runtime and native TestFlight binary change together.

**4 November 2026 TestFlight correction:** `1.0.3` adds designed functional clock, battery and month-calendar widgets for every theme, with capability 5 and a separate appVersion runtime. This owner-requested native update supersedes the historical 1.0.1 train guidance below. **Build 31 is delivered:** Apple VALID / IN_BETA_TESTING in the existing internal TestFlight group, observed 4 November at 09:02 UTC. Native render, full app integration, three-function save/restart and signed shared Group checks pass; [delivery receipt](DESIGNED_WIDGET_DELIVERY_20261104.json). Open Glaze once after updating. Public App Review submission remains owner-controlled and has not been requested here.

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
| Weather widget forecast (`api.open-meteo.com`, owner-1102b T281) | Latitude/longitude rounded to 2 decimals (~1 km), temperature unit; sent by the widget extension straight to Open-Meteo | The developer never receives or stores it (no server of ours in the path, no identifier, not linked, not tracking). Apple defines "collect" as transmitting data off the device in a way that lets the developer or its third-party partners access it for longer than needed to serve the request: Open-Meteo is a third-party API serving the request in real time. **Owner to confirm** this reading before publishing; the cautious alternative is Location > Coarse Location · App Functionality · Not linked to identity · Not used for tracking |
| Next event widget (EventKit, T280) | Nothing: events are read on the device by the widget extension | Never leaves the device, so not collected |

- [x] Answers and reasons written (this table, `docs/privacy.html`, `docs/site/privacy.html`)
- [ ] Owner: App Privacy > "No, we do not collect data" > Publish; Privacy Policy URL from §6
- [ ] Owner (owner-1102b): confirm the Open-Meteo row above (Data Not Collected vs. Coarse Location, App Functionality, not linked) and Open-Meteo's commercial-use terms (`docs/LICENSES.md` "Weather data")

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
