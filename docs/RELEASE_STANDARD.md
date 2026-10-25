# App Factory release standard

Every app meets this before it is submitted to App Review. Written 25 Oct 2026 from the Linework 1.0 launch.
Check items off in the app's `docs/RELEASE_CHECKLIST.md` (or its PR) and say which were not applicable.

## 1. First launch
- **Language:** the app follows the phone's language. On first launch, the Home/welcome screen shows a small
  non-blocking line "Language: <current> · Change" that opens the picker; it disappears once tapped or after the
  first session. Language also stays at the top of Settings. English-only apps: not applicable until translated.
- **No blocking prompts** before the person sees the app working (no forced sign-up, no paywall first).
- **Filters start off.** Favourites, "Saved only" and similar filters are never on by default. A filtered list
  that comes out empty says why and offers a one-tap "Show all". (Linework: favourites on by default looked like
  every template had been deleted.)

## 2. Purchases (expo-iap)
- **Pin expo-iap** to an exact version in package.json. `"*"` let a newer version with renamed request keys into
  the build, and Unlock failed with no Apple sheet.
- Each request sends both key styles: `request: { ios: { sku }, android: { skus }, apple: { sku }, google: { skus } }`,
  `type: 'in-app'`.
- Wait for the result from both the returned value and `purchaseUpdatedListener`. A listener error must not end the
  purchase while another request shape is still being tried.
- After a failure or an empty result, check `getAvailablePurchases()` again (for up to ~10 s) before saying it failed.
- A failure alert never fails silently: it says nothing was charged and shows the store's error code(s) in brackets.
- Restore purchases sits on the same screen as Unlock.
- `finishTransaction({ isConsumable: false })` for non-consumables.
- **Free trial** of a non-subscription app = a free non-consumable named "XX-day Trial" that the person starts
  (guideline 3.1.1); never start it automatically.
- **Before submitting:** on TestFlight, buy every paid item (sandbox, nothing charged), start the trial, and
  Restore, on a real iPhone.
- The paywall promises only features that are in this build. No "test build" or "purchases aren't available" text
  in a store build.

## 3. App Store Connect (scripts/asc/asc.py does most of this; the owner does the starred items)
- Listing: primary locale en-AU, unique name (Apple rejects names used by any developer in that locale),
  subtitle, description, keywords, promo text, support / marketing / privacy URLs (GitHub Pages under docs/<app>/),
  category, age rating, copyright, content rights, availability, screenshots (iPhone 6.9"), purchases with a
  review screenshot.
- Review notes answer Apple's new-developer questions up front: purpose and audience; setup and login (or none);
  external services; regional differences; regulated or third-party material.
- \* App Privacy answered and published.
- \* App Review contact (name, phone, email).
- \* A screen recording on a physical iPhone, latest iOS: launch, the main flow, and the paid flow (trial, Unlock with
  the Apple sheet, Restore). Attach it to the reply when Apple asks.
- \* Paid Apps Agreement, bank and tax forms Active (done for the account, 23 Oct 2026).

## 4. While an app is in review
- Over-the-air updates reach the reviewer's copy. During review ship only fixes the reviewer needs (e.g. a broken
  purchase); everything else waits for the next version.
