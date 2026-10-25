# Couch release checklist (App Factory release standard)

Measured against App-Projects `docs/RELEASE_STANDARD.md` (owner, 25 Oct 2026) in run 80 (oversight D142-2).
`tests/release-standard.test.ts` keeps the code-side items from regressing. Status: **done**, **n/a** (with reason),
**gap** (backlog task) or **owner** (only the owner can do it).

## 1. First launch
| Item | Status | Where |
|---|---|---|
| App follows the phone's language; first-session "Language: <name> · Change" line that opens the picker | done | owner #92 (d4c6003): src/core/languageHint.ts, src/ui/LanguageHint.tsx on the Remote screen |
| Language at the top of Settings | done | owner #92, app/settings.tsx |
| No blocking prompts before the app works (no sign-up, no paywall first) | done | No account; the start-up animation is a short non-blocking overlay; demo mode needs no setup. Local Network permission is asked by iOS only when a scan starts |
| Filters start off | done | src/core/appVisibility.ts DEFAULT_VISIBILITY.favouritesOnly = false; nothing hidden by default |
| A filtered list that comes out empty says why and offers one-tap "Show all" | done | owner #92, app/(tabs)/apps.tsx |

## 2. Purchases (expo-iap)
Couch 1.0 sells nothing: `PLUS_FOR_SALE = false` (src/core/forSale.ts), the purchase provider is a stub, expo-iap is not a
dependency and store/listing.json lists no in-app purchase. Settings hides the Plus card, Themes hides "Get Couch Plus",
the Plus screen says "coming in a later update" with no Buy / Restore / tips.

| Item | Status |
|---|---|
| No "test build" / "purchases aren't available" text reachable in a store build | done (all such strings sit behind `plusForSale()`) |
| Paywall promises only features in this build | done for 1.0 (no paywall; the Plus screen frames its list as a later update) |
| Pin expo-iap exactly; both request key shapes; listener + returned value; re-check getAvailablePurchases ~10 s; failure alert says nothing was charged + store codes; Restore beside Unlock; finishTransaction non-consumable; trial as a person-started non-consumable; sandbox-buy on TestFlight | n/a in 1.0, **gap T100** for the version that sells Couch Plus (held on the owner's price decision G-price-1018 and a native build; the test fails if PLUS_FOR_SALE turns true without an exact expo-iap pin) |

## 3. App Store Connect
| Item | Status |
|---|---|
| Listing: en-AU primary, unique name, subtitle, description, keywords, promo text, URLs, category, age rating, copyright, content rights, availability, 6.9" screenshots | done (owner's store kit, store/listing.json, App-Projects #67-#72) |
| Purchases with a review screenshot | n/a in 1.0 (nothing sold) |
| Review notes answer Apple's new-developer questions | done (owner #78, store/listing.json reviewNotes) |
| App Privacy answered and published ("Data Not Collected") | owner |
| App Review contact (name, phone, email) | owner |
| Screen recording on a physical iPhone, latest iOS: launch and the main flow (no paid flow in 1.0) | owner |
| Paid Apps Agreement, bank and tax | done (account, 23 Oct 2026) |

## 4. While in review
Over-the-air updates reach the reviewer's copy: during review the build runs ship only fixes the reviewer needs.
Recorded as a standing rule in ops/DECISIONS.md (run 80).
