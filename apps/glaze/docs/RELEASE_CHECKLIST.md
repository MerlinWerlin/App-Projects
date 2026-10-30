# Glaze — release checklist (App Factory release standard)

Checked against App-Projects `docs/RELEASE_STANDARD.md` (owner, 25 Oct 2026, #88). Written by the cloud build run 112
(oversight D142-3). "Owner" items need the owner's iPhone or his App Store Connect login; nothing here was tried on a
device from the cloud.

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
the plain `production` profile keep the honest mock. App Store Connect steps: `docs/IAP_SANDBOX.md`. Not yet compiled.
- [x] No npm package added; local Expo module, adapter `src/native/store.ts` never throws (`requireOptionalNativeModule`)
- [x] `Product.products(for:)` + `product.purchase()`; verified transactions `finish()`ed; `Transaction.updates` listener
- [x] After a failure, re-checks `Transaction.currentEntitlements` before showing the failure (`buyPlus`, src/core/plusStoreKit.ts)
- [x] Failure line says nothing was charged and shows the store code; cancel is silent; Ask to Buy says it is waiting
- [x] Restore purchases on the same sheet as Unlock (`AppStore.sync()` then entitlements)
- [x] Shows the App Store's localised price once loaded (fallback A$2.99)
- [n/a] Free trial — Glaze is a one-time unlock with a generous free tier; no trial planned
- [x] Paywall promises only built features (#91 removed "Theme clips for Live Photos"); tip jar hidden outside dev builds (#91)
- [x] No "can't buy in this test version" text in a native build with the store module (only the mock path says it)
- [ ] Owner: create the In-App Purchase in App Store Connect (`docs/IAP_SANDBOX.md`)
- [ ] Owner: on TestFlight (`production-native` build), buy Plus (sandbox) and Restore on a real iPhone
- [ ] Android: Google Play Billing not built (Android keeps the mock)

## 3. App Store Connect
- [x] Store copy drafted in `docs/STORE.md` (no competitor names, no live-wallpaper promise); privacy page `docs/privacy.html`
- [x] Review notes `docs/REVIEW_NOTES.md`: no background audio, Live Photo maker, Shortcuts install, Guideline 5.5 note on the profile route
- [x] Review notes answer Apple's new-developer questions (purpose/audience, no login, no external services, no regional
      differences, no regulated material) — `docs/REVIEW_NOTES.md` "App Review information" (T141)
- [ ] Listing fields via `scripts/asc/asc.py` in App-Projects (en-AU, unique name check, 6.9" screenshots, IAP review screenshot)
- [ ] Owner: App Privacy ("Data Not Collected"), review contact, screen recording on a physical iPhone (launch → theme → icons → widget → Plus Unlock/Restore)
- [x] Paid Apps Agreement, bank and tax active (account, 23 Oct)

## 3b. Theme packs on GitHub Releases (owner-1030 A, T169, 30 Oct)
- [x] Pack build + flat release-asset scripts written and tested offline (`scripts/packs/`, T159, T169); app lists and downloads hosted packs (T160)
- [x] App points at the release: production `glaze-packs-v1`, staging `glaze-packs-staging` on `MerlinWerlin/App-Projects` (`src/config/packs.ts`). Until the release exists the app behaves as offline
- [ ] Place `scripts/packs/publish-packs.yml` as `.github/workflows/glaze-publish-packs.yml` in App-Projects and run it: staging (dry-run, then real), then production (`docs/PACK_HOSTING.md`). No account or secrets needed; nothing for Jared to set up
- [ ] Owner: on TestFlight, download a free pack and a Plus pack, then turn on Airplane mode and check the themes still show
- [ ] Privacy page + App Privacy: pack downloads come from GitHub (github.com / objects.githubusercontent.com see the phone's IP address like any website, and Glaze sends no personal data). "Data Not Collected" still holds; add one sentence to the privacy page
- [ ] Decide the theme tiers (`scripts/packs/tiers.json`, plan in `docs/R2_SETUP.md` "Plan for the ~87 themes"); app download stays under ~40 MB

## 3c. Look and feel (owner-1030 B/C, 30 Oct)
- [x] Smoother lists (virtualised Themes/Widgets/Wallpapers, cached downscaled images) and one design token set (T162, T163)
- [ ] Owner: TestFlight check in `docs/TRIAL.md` "New since your last test (30 Oct, owner-1030)"
- [ ] Design critique screenshots + agreed points (`docs/design_review_1030/README.md`, `docs/DESIGN_CRITIQUE_1030.md`)
- [ ] Store screenshots retaken after the critique changes

## 3d. SDK 57 pins (D203-1, 30 Oct)
- [x] `expo-image` ships as `~57.0.5` on SDK 57 (App-Projects `apps/glaze`), never the cloud's `~3.0.0`; full table in `docs/SDK57_PINS.md`
- [ ] PC: full `npm install` + `tsc` + `expo export` on the SDK 57 copy after run 179 (T162 virtualised lists, expo-image) before the next TestFlight build

## 4. While in review
- Ship only reviewer-needed fixes over the air; everything else waits for the next version.

## Before submitting, also
- Reword `NSPhotoLibraryUsageDescription` in app.json ("lock screen loops" → "Live Photos") with the next native change (T140).
- Set `src/config/install.ts PROFILE_INSTALL_ENABLED` to false for the App Store build (Guideline 5.5).
