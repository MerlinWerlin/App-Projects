# Trammel 1.0: in-app purchases

Pricing (house pattern from Jared's other apps): a free 7-day trial, then a one-time A$4.99 Full Unlock. No subscription.
Guideline 3.1.1: a time-based free trial in a non-subscription app must be a non-consumable at price 0 that the
person starts, so there are two non-consumables. `scripts/asc/asc.py apply trammel` creates both from
`store/listing.json`; the first purchase of a new app is sent for review from the App Store Connect website.

| Product ID (exact, can't change later) | Type | Reference name | Price | Display name | Description |
|---|---|---|---|---|---|
| `com.jared797.trammel.trial7` | Non-Consumable | 7-Day Free Trial | Free (price 0, every country) | 7-Day Free Trial | Try every Trammel tool free for 7 days. |
| `com.jared797.trammel.unlock` | Non-Consumable | Trammel Full Unlock | A$4.99 base (Apple's equivalents elsewhere) | Trammel Full Unlock | Every tool, forever. One-time, no subscription. |

Code: `src/core/access.ts` (ids and rules, tested in `src/core/access.test.ts`), the StoreKit 2 module
`modules/trammel-store` (Swift takes the ids from JS; copied from Satchel's reviewed module), `src/native/store.ts`,
`src/state/access.tsx`, the paywall `app/paywall.tsx`, Settings > Trammel Full Unlock.

## How it behaves
- Always free: Fractions <-> mm, Square check, Mitre (flat and polygon), Roof pitch, and opening saved jobs.
- Trial or unlock: Stairs, Common rafter, Hip & valley, Cornice & compound, Stud & joist layout, Decking, Cut list,
  Arch & radius, and saving calculations to jobs.
- The trial starts only when the person taps "Start 7-day free trial" (Apple's sheet shows the free item).
- Trial length: 7 minus whole days since the trial transaction's purchaseDate (survives reinstalling).
- Paywall: StoreKit's localized displayPrice only; no product loaded = no buy button, "Try again". Restore purchases
  and a privacy policy link on the same screen.
- Builds without the module (web preview, Android): nothing is limited.
