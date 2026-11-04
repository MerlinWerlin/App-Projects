# Release checklist

The owner's steps to put Satchel in the App Store and Google Play. Plain and in order; tick each one. Steps marked **(build run)** are done by the build runs or auto-ship, not by you. Refreshed 1 Nov 2026 (T159).

Fixed values:
- Bundle id / package: `com.jared797.satchel`; App Store Connect Apple ID `6826958413`
- In-app purchase id: `com.jared797.satchel.plus` (non-consumable, one-time, "Satchel Plus", about A$7.99, your choice)
- Expo owner: `jared797`; version `0.1.0`; update channel `production`
- Name: "Satchel" is a working title: check App Store and trademark availability first (docs/PLAN.md)

## Done

- [x] App Store Connect app record created (26 Oct, Apple ID 6826958413); auto-ship onboarded Satchel into App-Projects.
- [x] TestFlight build pipeline: the hourly App Factory auto-ship builds a new TestFlight build when native code or app.json changes and sends an over-the-air update otherwise (docs/STARTER_STANDARD.md). Jared has tested TestFlight builds.
- [x] Satchel Plus built (T16): guarded expo-iap 6.2.0 adapter, Unlock and Restore purchases in Settings > Satchel Plus (docs/PLUS.md). Still to prove with a sandbox purchase: step 19.
- [x] Backup and restore (T17): one `.satchelbackup` file through the share sheet; restore on the new phone (docs/BACKUP.md). Trip files (`.satchel`) and Open in / Save to Satchel (T14) also done.
- [x] Offline city maps (T47 / T153) with toilets and places, downloaded from the `satchel-maps-v1` GitHub release.
- [x] Privacy and support pages refreshed against the code (T159): `docs/privacy.html`, `docs/support.html`. App Privacy and Data safety answers with reasons: `docs/APP_PRIVACY.md`. A test (src/core/privacyhosts.test.ts) fails if the code gains an online host the privacy page doesn't name.
- [x] iOS permission purpose strings checked against what each feature does and fixed in app.json (T159; see "Next native build" below).
- [x] Store text: `docs/STORE.md`. Paid Apps agreement, bank and tax: Active for the account (23 Oct).

## Yours to decide (1-3 and 5 before App Store submission; 4 before any Google Play build)

1. **Final name** (Before anything, step 1).
2. **Support email** (step 2). Until then both pages show a `SUPPORT_EMAIL` marker.
3. **iPad: keep or drop `supportsTablet`** (decision A).
4. **Android map key** (decision B), only before a Google Play build.
5. **Create the in-app purchase `com.jared797.satchel.plus` in App Store Connect** (step 11; docs/PLUS.md has the exact fields).

## Before anything

1. Pick the final name. Search the App Store, Google Play and your country's trademark register for it.
2. Pick a support email address. Replace every `SUPPORT_EMAIL` marker in `docs/privacy.html` and `docs/support.html` with it (build run can do this once you say the address).

## Two decisions before the first store build

These are lettered so the numbered steps below keep their numbers.

A. **iPad: keep or drop `supportsTablet`.** app.json has `ios.supportsTablet: true` today, so Satchel installs as a full iPad app, App Store Connect requires 13" iPad screenshots (docs/SCREENSHOTS.md), and App Review tests it on an iPad. Satchel is designed for one-handed phone use and nobody has tried it on an iPad yet.
   - **Drop it (suggested for the first release):** say so and a build run sets `supportsTablet: false`. iPads can still run the iPhone version in its compatibility window, and no iPad screenshots are needed.
   - **Keep it:** try every tab on an iPad (or the iPad simulator) in both orientations first, then capture the six shots at 2064 x 2752 as well.
   - Changing it later needs a new build (TestFlight), not an over-the-air update. Note: once a version has shipped with iPad support, Apple does not let a later version remove it, so decide before the first submission.

B. **Android map key and terms, before any Play build.** On iPhone the map is Apple Maps and needs no key. On Android, react-native-maps uses the Google Maps SDK, which needs a Maps SDK for Android API key (a Google Cloud project with billing turned on) and comes with Google's Maps Platform terms, including limits on caching or storing map data and attribution rules. Expo Go has its own key, so the map works there, but a store build does not.
   - **No Play build (step 26) until you decide:** (1) create a key restricted to the package `com.jared797.satchel` and its signing certificate, which a build run then adds to app.json (`android.config.googleMaps.apiKey`) and records in docs/THIRD_PARTY.md; or (2) ship Android without the online map until the offline OpenStreetMap map (T12) replaces it.
   - Either way, re-check the Play **Data safety** answers (step 27) against what the Google Maps SDK declares, and do not cache Google map tiles for offline use.

## Release standard check (T36, 26 Oct 2026)

Line-by-line pass against App-Projects `docs/RELEASE_STANDARD.md` (25 Oct 2026, from the Linework 1.0 launch). Each gap has a backlog task tagged `release-std`. Starred items are yours.

### 1. First launch
| Standard line | Satchel | Status |
|---|---|---|
| Follows the phone's language; non-blocking "Language: <current> · Change" line on first launch, gone once tapped or after the first session | `LanguageHintSlot` on the Trips tab; hides when tapped and after one session (T35, 5bbbf96) | met (English only ships until T21) |
| Language stays at the top of Settings | Language is the first section of Settings | met |
| No blocking prompts before the app is seen working | No sign-up, paywall, rating or tracking prompt; location only on "where am I"; vault asks for Face ID only when opened; demo trip on first launch | met |
| Filters start off | Map: all 8 offered categories are on at first open; trips and documents have no filters | met. T13 must keep every offered category on at first open (the content file marks embassy, tourist info, supermarket, luggage storage and Wi-Fi `default_on: false`) |
| An empty filtered list says why and offers a one-tap "Show all" | Map "Nearby" list: says all categories are hidden (or none in the ones that are on) and now has a "Show all categories" button | met (T39, this run) |

### 2. Purchases (expo-iap)
Satchel Plus is built (T16, run 108; docs/PLUS.md). Still to prove on a real iPhone: step 19.
| Standard line | Status |
|---|---|
| expo-iap pinned to an exact version | met (T16): `"expo-iap": "6.2.0"` |
| Request sends both key styles (`ios`/`android`/`apple`/`google`), `type: 'in-app'` | met (T16): src/plus/store.ts, tested |
| Result taken from both the return value and `purchaseUpdatedListener`; a listener error does not end the purchase while another shape is tried | met (T16), tested |
| After a failure or empty result, re-check `getAvailablePurchases()` for up to ~10 s | met (T16): 10 checks, 1 s apart |
| Failure alert says nothing was charged and shows the store's error code(s) in brackets | met (T16): plus.failBody / plus.unavailableBody |
| Restore purchases on the same screen as Unlock | met (T16): Settings > Satchel Plus |
| `finishTransaction({ isConsumable: false })` | met (T16), tested |
| Free trial = a free non-consumable "XX-day Trial" the person starts | not applicable: no trial planned (the free core is the trial) |
| \* On TestFlight buy, (trial,) Restore on a real iPhone before submitting | yours, step 19 below |
| Paywall promises only features in this build; no "test build" / "purchases aren't available" text in a store build | met (T16): lists only extra offline cities; src/plus/entitlement.test.ts checks the wording |

### 3. App Store Connect
| Standard line | Status |
|---|---|
| Primary locale en-AU | step 9 now says English (Australia), matching docs/TESTFLIGHT.md |
| Unique name | open: "Satchel" is a working title (Before anything, step 1) |
| Subtitle, description, keywords, promo text | met: docs/STORE.md |
| Support / marketing / privacy URLs on GitHub Pages under docs/<app>/ | docs/privacy.html and docs/support.html exist; URLs confirmed when auto-ship onboards Satchel to App-Projects (steps 3-5) |
| Category, age rating, copyright, content rights, availability | steps 13-14; copyright and content rights: answer at submission (no third-party content except OpenStreetMap data once T12 ships) |
| Screenshots (iPhone 6.9"), purchase review screenshot | docs/SCREENSHOTS.md; purchase review screenshot: Settings > Satchel Plus from a TestFlight build (T16 built) |
| Review notes answer purpose/audience, setup/login, external services, regional differences, regulated or third-party material | met: step 21 below |
| \* App Privacy answered and published | yours, step 12 |
| \* App Review contact | yours, step 21 |
| \* Screen recording on a physical iPhone: launch, main flow, paid flow | yours, step 19 (T16 is built) |
| \* Paid Apps Agreement, bank and tax Active | done for the account 23 Oct 2026 (step 7) |

### 4. While in review
| Standard line | Status |
|---|---|
| During review, ship over-the-air only the fixes the reviewer needs | rule for build runs: no OTA update to the production channel while a version is in review except a reviewer-needed fix |

## Next native build (app.json changed in T159)

T159 rewrote the iOS purpose strings so each one matches what the app really does. This change is in app.json, so it reaches phones only with the next TestFlight build (an over-the-air update can't change Info.plist); auto-ship makes that build. Details and the old wording: docs/APP_PRIVACY.md.

- Location: was "checks your location once, only when you tap Where am I? ... stays on your phone". Now covers near-me searches, day plan, sharing where you are and Find my way back (which follows you while that screen is open), and says a near-me search outside downloaded city maps sends that spot to OpenStreetMap.
- Photos and camera: now cover documents, receipts, cards, trip covers, journal, rental car and lost bag photos, not only tickets (this replaces the wording that was queued here for T64 / T68 / T72 / T88 / T92). `microphonePermission` stays `false`.
- Face ID: also names hidden hotel door / key box codes. Contacts: also names help cards and trusted contacts.
- After the build: check Settings > Satchel on the phone shows the new text when each permission is asked.

## Privacy and support pages (GitHub Pages)

3. In the GitHub repo MerlinWerlin/App-Projects, Settings > Pages: publish from the main branch (root or `/docs`, whichever the other apps use).
4. Check that these open on your phone, in light and dark mode (exact path **to confirm** once Pages is on):
   - `https://merlinwerlin.github.io/App-Projects/apps/satchel/docs/privacy.html`
   - `https://merlinwerlin.github.io/App-Projects/apps/satchel/docs/support.html`
5. Keep both URLs for steps 13 and 27.

## Apple

6. Apple Developer Program membership is active (developer.apple.com > Account). Renew if needed.
7. App Store Connect > Business: sign the **Paid Apps agreement**, then add banking and tax forms. In-app purchases cannot go on sale until this shows "Active".
8. Certificates, Identifiers & Profiles: confirm the App ID `com.jared797.satchel` exists with **In-App Purchase** enabled. (EAS normally creates it on the first build.)
9. ~~App Store Connect > Apps > "+" New App~~ **Done 26 Oct** (primary language English (Australia), bundle id `com.jared797.satchel`, SKU `satchel`). Change the name here once you pick the final one.
10. ~~Send the Apple ID to the build run~~ **Done**: `6826958413` is in eas.json and RELEASE.json.
11. App Store Connect > the app > Monetization > In-App Purchases > "+":
    - Type **Non-Consumable**, reference name "Satchel Plus", product id `com.jared797.satchel.plus`.
    - Price: pick the tier (about A$7.99).
    - Display name and description (for example "Satchel Plus: one-time upgrade").
    - **Review screenshot:** a screenshot of Settings > Satchel Plus from a TestFlight build (docs/PLUS.md).
    - Add it to the first app version when you submit (step 22).
12. App Privacy: answer **"No, we do not collect data from this app"**, which shows **Data Not Collected**. The reasons per Apple data type, and what would change the answer, are in `docs/APP_PRIVACY.md`. Tracking: No.
13. App Information: privacy policy URL (step 4); category Travel, secondary Productivity. Version page: support URL (step 4).
14. Age rating questionnaire: answer "None" to everything; expected rating **4+**.
15. Export compliance: the app uses only standard iOS encryption; `ITSAppUsesNonExemptEncryption` is already `false` in app.json, so App Store Connect should not ask each build. If asked: "No" to non-exempt encryption.
16. Store listing: paste name, subtitle, keywords, promotional text, description and What's New from `docs/STORE.md`. Re-read it against the build first.
17. Screenshots: upload the six shots in each required size (`docs/SCREENSHOTS.md`). iPad shots are needed only if you kept `supportsTablet` (decision A).
18. **(build run)** TestFlight builds: auto-ship builds and submits them (already running). The build you submit for review must include the T159 app.json purpose strings.
19. TestFlight > Internal Testing: add yourself, install, and check the Plus purchase in the sandbox (buy, delete app, reinstall, Restore purchases).
20. Try the build with flight mode on, using the trial questions in docs/TRIAL.md.
21. App Review information: your contact details (name, phone, email), no demo login. Review notes (release standard §3), paste and adjust:
    - Purpose and audience: an offline travel wallet for adult travellers: bookings, tickets, documents, an emergency card and a map of the trip, all usable in flight mode.
    - Setup and login: none. No account. A demo trip (Sydney, Tokyo, Kyoto) appears on first launch.
    - External services: Apple Maps for the map; MET Norway (api.met.no) for trip weather, using the trip's hotel coordinates; OpenStreetMap Overpass for toilets / help near a spot no downloaded city covers; offline city maps downloaded from GitHub. No server of ours, no account, no analytics, no ads. Data stays on the phone.
    - Regional differences: none. Emergency numbers are shown with "verify locally" and a source.
    - Regulated or third-party material: none; map data is Apple's, and offline city maps and nearby places are OpenStreetMap data (attribution in Settings > Licences).
    - Purchases: Satchel Plus is a one-time non-consumable; Unlock and Restore purchases are in Settings.
22. Version page: select the build, add the `com.jared797.satchel.plus` purchase, choose manual or automatic release, **Submit for Review**.

## Google Play

23. Google Play Console developer account (one-time fee) with identity verification done.
24. Payments profile and merchant account set up (Setup > Payments profile), needed to sell the in-app product.
25. Create app: name, default language English, App (not game), Free, accept the declarations.
26. **(build run)** `eas build -p android --profile production` (an `.aab`) and upload to Internal testing. **Not before decision B above** (the Android map key and terms; docs/THIRD_PARTY.md §3).
27. App content:
    - Privacy policy URL (step 4).
    - Ads: **No ads**.
    - App access: all functions available without special access.
    - Content rating (IARC questionnaire): no objectionable content; expected "Everyone" / PEGI 3.
    - Target audience: 18+ (or 13+); not designed for children.
    - **Data safety:** "No data collected" and "No data shared" (reasons in `docs/APP_PRIVACY.md`); location is used on device only, foreground, on request. Re-check what the Android map SDK declares before answering.
    - Location permission: foreground only (background location is blocked in app.json).
28. Monetize > In-app products: create managed product `com.jared797.satchel.plus` (one-time), price, activate. Needs an uploaded build that includes billing (T16).
29. Main store listing: app name, short description, full description (`docs/STORE.md` Google Play section), app icon 512 x 512, feature graphic 1024 x 500, phone screenshots.
30. Testing: new personal developer accounts must run a closed test with a minimum number of testers for a minimum time before production access (check the current rule in Play Console; it has been 12 testers for 14 days). Start this early.
31. Apply for production access, then roll out to Production.

## After launch

32. Answer review feedback and comments; keep `docs/support.html` current.
33. Offline maps have shipped: check the store description carries the OpenStreetMap attribution and that `docs/STORE.md` "Add when shipped" items are moved in (T158).
34. If sync or any online feature is added: update `docs/privacy.html` and `docs/APP_PRIVACY.md` before release and re-check both store answers. The privacy hosts test will flag a new host.
