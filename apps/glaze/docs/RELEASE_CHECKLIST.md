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
Glaze has **no real purchase code yet**: Plus is an on-device mock (`src/plus/entitlement.ts`) — non-dev builds answer
"Glaze Plus arrives with the store release". Real purchases are task **T140** (was release task R2), held for the
next native build because adding expo-iap is a package.json/native change (D130-2: one native change per TestFlight
build). T140 must cover every line below.
- [ ] expo-iap pinned to an exact version — T140
- [ ] Request sends both key styles (`ios/android/apple/google`), `type: 'in-app'` — T140
- [ ] Waits on the returned value and `purchaseUpdatedListener`; a listener error never ends a still-running attempt — T140
- [ ] After a failure/empty result, re-checks `getAvailablePurchases()` for up to ~10 s — T140
- [ ] Failure alert says nothing was charged and shows the store error code(s) — T140 (the mock already never fails silently)
- [x] Restore purchases on the same sheet as Unlock (`PlusLockSheet`, `RestorePurchases`)
- [ ] `finishTransaction({ isConsumable: false })` — T140
- [n/a] Free trial — Glaze is a one-time unlock with a generous free tier; no trial planned
- [x] Paywall promises only built features (#91 removed "Theme clips for Live Photos"); tip jar hidden outside dev builds (#91)
- [ ] No "arrives with the store release" text in a store build — T140 replaces the mock before submission
- [ ] Owner: on TestFlight, buy Plus (sandbox) and Restore on a real iPhone

## 3. App Store Connect
- [x] Store copy drafted in `docs/STORE.md` (no competitor names, no live-wallpaper promise); privacy page `docs/privacy.html`
- [x] Review notes `docs/REVIEW_NOTES.md`: no background audio, Live Photo maker, Shortcuts install, Guideline 5.5 note on the profile route
- [x] Review notes answer Apple's new-developer questions (purpose/audience, no login, no external services, no regional
      differences, no regulated material) — `docs/REVIEW_NOTES.md` "App Review information" (T141)
- [ ] Listing fields via `scripts/asc/asc.py` in App-Projects (en-AU, unique name check, 6.9" screenshots, IAP review screenshot)
- [ ] Owner: App Privacy ("Data Not Collected"), review contact, screen recording on a physical iPhone (launch → theme → icons → widget → Plus Unlock/Restore)
- [x] Paid Apps Agreement, bank and tax active (account, 23 Oct)

## 4. While in review
- Ship only reviewer-needed fixes over the air; everything else waits for the next version.

## Before submitting, also
- Reword `NSPhotoLibraryUsageDescription` in app.json ("lock screen loops" → "Live Photos") with the next native change (T140).
- Set `src/config/install.ts PROFILE_INSTALL_ENABLED` to false for the App Store build (Guideline 5.5).
