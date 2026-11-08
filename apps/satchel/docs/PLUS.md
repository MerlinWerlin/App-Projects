# Satchel Plus

Satchel Plus is a **one-time purchase** (non-consumable). There's no subscription, no account and no trial.

- **Product ID:** `com.jared797.satchel.plus`
- **What it adds in this build:** offline city maps beyond one per trip. Without Plus you get one free offline city for each trip in Satchel (and one before you add any trip). With Plus you can download as many cities as you like. Cities already on the phone always open and can always be deleted, with or without Plus.
- **Always free:** tickets, the emergency card, documents and the vault, packing, low-battery mode, toilets, trip covers (illustrated and your own photos), backup, and the first offline city per trip.
- **Where it lives:** Settings > Satchel Plus. Unlock (showing the App Store price) and Restore purchases are both on that screen. The Map tab only shows a small "See Satchel Plus" note in place of Download, on a city beyond the free allowance. No pop-ups, timers or repeat prompts.
- **Builds without the store module** (Expo Go, or an over-the-air update that lands on a build from before T16): purchases can't run there, so every Plus feature is switched on and Settings says "Everything in Satchel Plus is on in this version of Satchel."
- **Code:** `src/plus/store.ts` (guarded expo-iap 6.2.0 adapter), `src/plus/entitlement.ts` (the rules), `src/plus/entitlement.test.ts` (core never reads the entitlement; free features are never gated).

## What Jared does in App Store Connect

1. **Business > Agreements:** sign the **Paid Apps** agreement, then add your bank and tax details. Wait until it shows **Active**. Until then the purchase can't go on sale. Sandbox testing on TestFlight still works.
2. **Apps > Satchel > Monetization > In-App Purchases > "+":**
   - Type: **Non-Consumable**
   - Reference name: **Satchel Plus**
   - Product ID: **com.jared797.satchel.plus** (exactly this; it can't be changed later)
3. On the new purchase, set:
   - **Availability:** all countries (or the ones you want).
   - **Price:** your choice. The plan suggests about A$7.99, but it's up to you.
   - **App Store localization** (English): display name "Satchel Plus", description such as "One-time upgrade: more offline city maps for each trip."
4. **Review information:** upload a screenshot of **Settings > Satchel Plus** from a TestFlight build (the section with the Unlock button and price). Notes for the reviewer: "Settings > Satchel Plus. Unlock buys, Restore purchases restores. Plus adds offline city maps beyond one per trip (Map tab > Offline city maps)."
5. Save. The status should read **Ready to Submit**. When you submit the app version, add the purchase on the version page under **In-App Purchases** (docs/RELEASE_CHECKLIST.md step 22). A first in-app purchase has to go to review with an app version.

## Testing on TestFlight

TestFlight purchases use the sandbox and are never charged. In Settings > Satchel Plus, tap Unlock, confirm, and check that the Map tab lets you download a second city for a single trip. Then delete the app, reinstall it from TestFlight, and tap **Restore purchases**. Plus should come back.
