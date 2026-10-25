# Release checklist (draft)

The owner's steps to put Satchel in the App Store and Google Play. Plain and in order; tick each one. Steps marked **(build run)** are done by the build runs or auto-ship, not by you. Not ready to submit until Satchel Plus (T16) is built and the trial questions in docs/TRIAL.md are answered "yes".

Fixed values:
- Bundle id / package: `com.jared797.satchel`
- In-app purchase id: `com.jared797.satchel.plus` (non-consumable, one-time, "Satchel Plus", about A$7.99, your choice)
- Expo owner: `jared797`; version `0.1.0`; update channel `production`
- Name: "Satchel" is a working title: check App Store and trademark availability first (docs/PLAN.md)

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

## Release standard check (oversight D142-1, 25 Oct 2026)

The owner added an App Factory release standard on 25 Oct (App-Projects `docs/RELEASE_STANDARD.md`, #88). Satchel is not in App-Projects yet and build runs cannot read that repo, so this check covers the four points the overseer named; a full line-by-line pass is task T36. Each gap is a backlog task tagged `release-std`.

| Point | Satchel today | Gap / task |
|---|---|---|
| First-launch language line | The app follows the phone's language (`src/i18n/core.ts`) and has no language line on first launch; only English ships until T21. | **T35**: one line on first launch naming the language in use, with a link to Settings to change it. |
| No blocking prompts | No sign-up, no rating or tracking prompt, no permission prompt at launch. Location is asked only when you tap the "where am I" button on the map; the vault asks for device authentication only when you open it. Confirmations appear only for destructive actions (discard, delete). | None found; re-check in T36. |
| Filters off by default | The map shows every category on first open (category toggles all on, i.e. nothing filtered out); trips and documents lists have no filters. | None found, assuming "filters off" means nothing hidden at first open; confirm in T36. |
| Purchase rules for the one-time Plus | Plus is not built yet (T16). Plan: one non-consumable `com.jared797.satchel.plus`, no subscription, tickets, emergency card, documents and the first offline city stay free, Restore purchases in Settings. | **T16** acceptance now includes the purchase rules (restore, no gating of the free core, everything unlocked while purchases are stubbed, honest price from the store, no countdowns or nags). |

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
9. App Store Connect > Apps > "+" New App: platform iOS, name, primary language English, bundle id `com.jared797.satchel`, SKU `satchel`.
10. Copy the app's **Apple ID** number (App Information > General, the "ascAppId"). Send it to the build run: auto-ship and the PC refresh need it to ship Satchel (docs/STARTER_STANDARD.md §1, task T23).
11. App Store Connect > the app > Monetization > In-App Purchases > "+":
    - Type **Non-Consumable**, reference name "Satchel Plus", product id `com.jared797.satchel.plus`.
    - Price: pick the tier (about A$7.99).
    - Display name and description (for example "Satchel Plus: one-time upgrade").
    - **Review screenshot:** a screenshot of the Satchel Plus purchase sheet from a TestFlight build (needs T16).
    - Add it to the first app version when you submit (step 22).
12. App Privacy: answer **"No, we do not collect data from this app"**, which shows **Data Not Collected**. (No analytics, no ads, no account, data stays on the phone. Apple Maps and Expo updates are platform/infrastructure calls that do not send user data; re-check if any SDK is added.)
13. App Information: privacy policy URL (step 4); category Travel, secondary Productivity. Version page: support URL (step 4).
14. Age rating questionnaire: answer "None" to everything; expected rating **4+**.
15. Export compliance: the app uses only standard iOS encryption; `ITSAppUsesNonExemptEncryption` is already `false` in app.json, so App Store Connect should not ask each build. If asked: "No" to non-exempt encryption.
16. Store listing: paste name, subtitle, keywords, promotional text, description and What's New from `docs/STORE.md`. Re-read it against the build first.
17. Screenshots: upload the six shots in each required size (`docs/SCREENSHOTS.md`). iPad shots are needed only if you kept `supportsTablet` (decision A).
18. **(build run)** `eas build -p ios --profile production` (or `production-native` once native modules land), then `eas submit -p ios`. Auto-ship does this once it has the ascAppId.
19. TestFlight > Internal Testing: add yourself, install, and check the Plus purchase in the sandbox (buy, delete app, reinstall, Restore purchases).
20. Try the build with flight mode on, using the trial questions in docs/TRIAL.md.
21. App Review information: contact details; notes such as "No account needed. A demo trip appears on first launch. Satchel Plus is a one-time non-consumable; Restore purchases is in Settings." No demo login needed.
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
    - **Data safety:** "No data collected" and "No data shared"; location is used on device only, foreground, on request. Re-check what the Android map SDK declares before answering.
    - Location permission: foreground only (background location is blocked in app.json).
28. Monetize > In-app products: create managed product `com.jared797.satchel.plus` (one-time), price, activate. Needs an uploaded build that includes billing (T16).
29. Main store listing: app name, short description, full description (`docs/STORE.md` Google Play section), app icon 512 x 512, feature graphic 1024 x 500, phone screenshots.
30. Testing: new personal developer accounts must run a closed test with a minimum number of testers for a minimum time before production access (check the current rule in Play Console; it has been 12 testers for 14 days). Start this early.
31. Apply for production access, then roll out to Production.

## After launch

32. Answer review feedback and comments; keep `docs/support.html` current.
33. When offline maps (T12/T13) ship: add OpenStreetMap attribution to the store description and the in-app licences screen, then update the store copy from the "Add when shipped" list in `docs/STORE.md`.
34. When iCloud sync (T17) ships: update `docs/privacy.html` before release, and re-check the privacy label (data in the user's own iCloud is still not collected by us).
