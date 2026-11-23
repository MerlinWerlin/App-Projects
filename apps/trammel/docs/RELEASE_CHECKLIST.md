# Trammel 1.0.0 release checklist (docs/RELEASE_STANDARD.md)

## 1. First launch
- [x] One question first: "Where do you build?" with the phone's region pre-selected; no paywall, account or permission.
- [x] Language line: not applicable (English only, spelling and trade words follow the country).
- [x] No filters on by default; empty Jobs list explains itself and offers the next step.

## 2. Purchases (StoreKit 2 module copied from Satchel, not expo-iap)
- [x] Free trial = free non-consumable `com.jared797.trammel.trial7` the person starts (3.1.1); unlock `com.jared797.trammel.unlock` A$4.99.
- [x] Price from StoreKit displayPrice only; no product = no buy button and Try again.
- [x] Restore purchases and privacy policy on the paywall; failures say nothing was charged and show the code.
- [ ] On TestFlight, on a real iPhone: start the trial, buy the unlock (sandbox), Restore. (Owner)

## 3. App Store Connect
- [x] App record 6838128372, bundle com.jared797.trammel, en-AU primary, name Trammel: Carpentry Calculator.
- [x] App Privacy: Data Not Collected (publish after the privacy URL is set by the listing sync).
- [x] China mainland: Security Assessment No, AIGC No.
- [ ] Listing, age rating, categories, price, availability, IAPs and screenshots synced by `store/ASC_REQUEST.json` apply.
- [ ] First IAPs added to the version on the website with the review screenshot.
- [ ] Submit for review: owner's decision.

## 4. Correctness
- [x] Every formula cites its source in `src/core/*.ts`; 60 unit tests with worked examples, edge cases and every country path.
- [x] Stair limits per country read from the official text (AU NCC 2022, NZ D1/AS1, England ADK, Ireland TGD K, US IRC/IBC 2024, Canada NBC 2020); anywhere else no code is claimed.
- [x] Timber catalogues per country read from local chains' listings (sources in `src/core/materials.ts`), custom entry always available.
