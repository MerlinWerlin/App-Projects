# Spigot 1.0.0 release checklist (docs/RELEASE_STANDARD.md)

## 1. First launch
- [x] English only for 1.0 (language picker not applicable until translated).
- [x] No blocking prompts: the Tools screen works straight away; the welcome card is inline and dismissible.
- [x] No filters on by default.

## 2. Purchases (expo-iap 6.2.0 pinned, code from Cue's reviewed pattern)
- [x] Both request key styles, listener + returned value, 10 s re-check, error codes in brackets, "Nothing was charged".
- [x] Restore purchases on the same screen as Unlock.
- [x] Free trial = free non-consumable "7-day Trial", started by the person, never automatically.
- [ ] On TestFlight with a real iPhone: start the trial, buy Full Unlock (sandbox), Restore. (Jared, before submitting.)
- [x] Paywall promises only tools in this build.

## 3. App Store Connect
- [x] App record 6838128661, bundle com.jared797.spigot, primary language English (Australia), SKU spigot-ios.
- [x] App Privacy: Data Not Collected, published; privacy policy URL set.
- [x] China mainland compliance: Security Assessment No, AI-generated content No.
- [ ] Listing, age rating, categories, price (free), availability, IAPs, review notes, screenshots: store/listing.json via ASC_REQUEST apply.
- [ ] First in-app purchases: select both on the version page when submitting (Apple requires the first IAPs to go with a version).
- [ ] Submit for App Review: Jared's decision only.

## 4. Build
- [x] No expo-updates (Guideline 5.6). usesNonExemptEncryption false. No permissions requested.
- [x] UIScene (Expo 58): iOS 27 simulator launch check passed in the Spigot capture workflow (still running after 30 s).
- [x] Tests: calculators with worked examples and invalid input, reference data, purchases, trial, storage.
