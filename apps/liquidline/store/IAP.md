# Liquidline 1.0.0: in-app purchases

House pricing pattern: a free 7-day trial, then a one-time Full Unlock (A$4.99). No subscription.
Guideline 3.1.1: a time-based free trial in a non-subscription app is a free non-consumable the person starts.

| Product ID | Type | Reference name | Price | Display name | Description |
|---|---|---|---|---|---|
| `com.jared797.liquidline.trial7` | Non-Consumable | 7-Day Free Trial | Free | 7-Day Free Trial | Try every Liquidline tool free for 7 days. |
| `com.jared797.liquidline.unlock` | Non-Consumable | Liquidline Full Unlock | A$4.99 base | Liquidline Full Unlock | One-time unlock. No subscription. |

Code: `src/core/access.ts` (ids and rules, tested in `src/core/core.test.ts`), StoreKit 2 module
`modules/liquidline-store`, paywall `src/ui/Paywall.tsx`, gate `src/ui/Gate.tsx`.

## How it behaves
- Always free: PT lookup and PT chart, refrigerant facts, the converter, viewing saved jobs, Settings.
- The trial or the unlock opens: superheat, subcooling, extra charge, evacuation, line set planner, room load, flare
  torque, and saving readings to jobs.
- Trial length = 7 minus whole days since the trial transaction's purchaseDate (survives reinstall).
- Paywall shows StoreKit's localized price only; with no product, no buy button. Restore purchases and the privacy
  policy are on the same screen.
- Builds without the module (web preview, Expo Go) are not limited.
