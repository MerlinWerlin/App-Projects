# Satchel 1.0.0: in-app purchases

Pricing (Jared, 15 Nov 2026): a free 7-day trial, then a one-time A$2.99 unlock. No subscription.
Guideline 3.1.1: a time-based free trial in a non-subscription app must be a non-consumable at price 0 that the
person starts, so there are two non-consumables. The master chat creates both in App Store Connect
(Satchel > Monetization > In-App Purchases); this file is the source for their exact ids and names.

| Product ID (exact, can't change later) | Type | Reference name | Price | Display name | Description |
|---|---|---|---|---|---|
| `com.jared797.satchel.trial7` | Non-Consumable | 7-Day Free Trial | Free (price 0, every country) | 7-Day Free Trial | Try every Satchel feature free for 7 days. |
| `com.jared797.satchel.unlock` | Non-Consumable | Satchel Full Unlock | A$2.99 base (Apple's equivalents elsewhere) | Satchel Full Unlock | One-time unlock. No subscription. |

Code: `src/core/access.ts` (`TRIAL_SKU`, `UNLOCK_SKU`, rules, tested in `src/core/access.test.ts`), the StoreKit 2
module `modules/satchel-store` (Swift receives the ids from JS), the paywall `src/ui/Paywall.tsx`, the gate
`src/ui/RequireUnlock.tsx`, Settings > Satchel Full Unlock.

## How it behaves

- **Starting the trial:** the person taps "Start 7-day free trial" (paywall on the first create/edit screen, or
  Settings > Satchel Full Unlock). Apple's sheet shows the free item; nothing is charged and nothing renews.
- **Trial length:** 7 minus whole days since the trial transaction's `purchaseDate`. Read from StoreKit
  (`Transaction.currentEntitlements`, then `Transaction.all`), so deleting and reinstalling never resets it.
- **During the trial and after the unlock:** everything works.
- **After the trial without the unlock (read-only, never locked out):** every trip, itinerary, ticket and document
  stays viewable; a received `.satchel` trip file always opens and imports; backups still work. Creating or
  editing trips and plans (trip, plan and booking forms, itinerary paste/import, Paste a booking, adding a shared
  file to a trip) and sharing out (Share itinerary, Send trip file) show the paywall.
- **Paywall:** StoreKit's localized `displayPrice` only. If the product hasn't loaded, no price and no buy button:
  "The App Store price couldn't be loaded" with Try again. Says "One-time purchase. No subscription.", has Restore
  purchases and a Privacy policy link.
- **Restore purchases** brings back both the trial (with its original start date) and the unlock.
- **Builds without the store module** (Expo Go, Android): nothing is limited.

## App Store Connect checklist (master chat)

1. Paid Apps Agreement active (done for the account, 23 Oct 2026).
2. Create both products above exactly; availability all countries; add the English (Australia) display name and
   description.
3. Review screenshot for each: Settings > Satchel Full Unlock from a TestFlight build of this commit.
4. Review notes for both: "Settings > Satchel Full Unlock (or tap + Add a trip). Start 7-day free trial starts a free
   non-consumable trial (Guideline 3.1.1); Unlock buys the one-time unlock; Restore purchases restores both. After
   the trial, existing trips stay viewable and received trip files still open; creating, editing and sharing ask
   for the unlock."
5. On the 1.0 version page, add both products under In-App Purchases before submitting (a first IAP goes to review
   with an app version).
6. TestFlight sandbox check on a real iPhone: start the trial, see "7 days left", buy the unlock, delete and
   reinstall, Restore purchases brings both back.
