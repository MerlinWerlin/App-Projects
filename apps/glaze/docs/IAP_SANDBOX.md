# Glaze Plus: buying it in TestFlight (sandbox)

T152. Glaze Plus is one **non-consumable** in-app purchase, **A$2.99 one-time**, bought with StoreKit 2
through Glaze's own native module (`modules/glaze-store`). No npm package, no server, no analytics.

**Product ID (type it exactly):** `com.jared797.glaze.plus`

It is defined once in code (`PLUS_SKU` in `src/core/iapFlow.ts`, re-exported as `PLUS_PRODUCT_ID` from
`src/plus/entitlement.ts`); the Swift module receives it from JS. A test (`src/core/t152Iap.test.ts`) checks this
file uses the same id.

## Which builds can buy

| Build | Unlock does |
|---|---|
| `production-native` profile (TestFlight), `development`, `preview` on iPhone | Opens Apple's purchase sheet (sandbox: nothing is charged) |
| Plain `production` profile, Expo Go, Android | Mock: says it can't be bought in this test version, nothing charged |

The store module is only linked when the profile sets `GLAZE_NATIVE=1` (`scripts/native-link.mjs`). So the
TestFlight build that sells Plus must be built with **`eas build -p ios --profile production-native`**.

This has **not been compiled or tried on a device yet** (the cloud cannot run Xcode). If the native build
fails in `GlazeStoreModule.swift`, remove the `modules/glaze-store` folder and rebuild: the app falls back to
the mock automatically.

## Jared's steps in App Store Connect (browser or phone)

Do these once, in order. Changes can take **up to 1 hour** to reach the sandbox.

1. **Accept the Paid Applications Agreement.** App Store Connect > **Business** (called "Agreements, Tax, and
   Banking" in older layouts) > Paid Applications > accept, then fill in **bank account** and **tax forms**.
   It must show **Active** (`docs/RELEASE_CHECKLIST.md` records it as active on 23 Oct; just check it still
   says Active and nothing new is waiting to be accepted). Without it no in-app purchase loads, even in the sandbox (the app then shows
   "The purchase didn't go through and nothing was charged. Store code: product-not-found.").
2. **Create the purchase.** Apps > Glaze > sidebar **Monetization > In-App Purchases** > **+**.
   - Type: **Non-Consumable**
   - Reference Name: **Glaze Plus**
   - Product ID: **com.jared797.glaze.plus**
   - Click **Create**.
3. **Price.** On the purchase's page, Price Schedule > add pricing. Choose **Australia** as the base country and
   pick the **A$2.99** price point (if A$2.99 isn't in the list, pick the closest and tell the build loop; check
   in App Store Connect). Let Apple fill the other countries.
4. **Localisation.** Add one localisation (English (Australia) or English (U.S.)):
   - Display Name: **Glaze Plus**
   - Description: **All Plus themes, extra widget styles and symbol sets. One-time.**
5. **Review information** (needed later, not for sandbox): a **screenshot** of the Glaze Plus sheet and a short
   note. Apple reviews the first in-app purchase together with a new app version, so add it to the version you
   submit (check in App Store Connect when submitting).
6. **Availability**: leave all countries on (the default).
7. Check the App ID has the **In-App Purchase** capability (developer.apple.com > Certificates, Identifiers &
   Profiles > Identifiers > com.jared797.glaze). It is normally on by default; check if the sheet never appears.

## Trying it in TestFlight

1. Install the `production-native` build from TestFlight (signed in with your normal Apple Account).
2. Open a Plus theme (or Settings > What's in Glaze Plus). The sheet shows the price from the App Store and
   **Unlock for A$2.99**.
3. Tap it. Apple's own sheet appears and says it is a sandbox / TestFlight purchase. **Nothing is charged**:
   TestFlight apps always use the sandbox.
4. Confirm. The sheet closes and Plus is unlocked; it stays unlocked after restarting.
5. Delete and reinstall, then tap **Restore purchases** on the same sheet: Plus comes back.
   - Cancel on Apple's sheet: nothing happens and nothing is charged.
   - A failure shows "nothing was charged" plus a store code (`product-not-found` almost always means steps 1-4
     aren't finished or haven't reached the sandbox yet).
   - "Waiting for approval" means Ask to Buy; Plus unlocks by itself when approved.

Optional, for repeat testing: a **Sandbox Apple Account** (App Store Connect > Users and Access > Sandbox) lets
you clear purchase history and buy again. Using it in a TestFlight app means signing out of Media & Purchases
first; Apple suggests a spare test device for that.

## Sources

- Testing In-App Purchases with sandbox (TestFlight apps always use sandbox; no charges; Paid Applications
  Agreement and product with reference name, product ID, localised name and price needed first):
  https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox
- Overview for configuring In-App Purchases (Account Holder accepts the Paid Apps Agreement in the Business
  section and adds banking and tax; "The agreement must be Active to test In-App Purchases in the sandbox";
  up to 1 hour for metadata to reach sandbox; first purchase is submitted with a new app version):
  https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases
- Create consumable or non-consumable In-App Purchases (Monetization > In-App Purchases > +, Type, Reference
  Name, Product ID, Create):
  https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases

Not verified against Apple docs here: the exact price-point list for A$2.99, the exact wording on Apple's
sandbox sheet, and the review screenshot fields. Check those in App Store Connect.
