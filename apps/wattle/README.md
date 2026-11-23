# Wattle: Sparky Calculator

Job-site calculator for licensed electricians (Australia first, metric with an imperial toggle).
Expo SDK 58 / expo-router, iPhone only, bundle `com.jared797.wattle`. Started 23 Nov 2026.

## What's in it
| Tab | What | Free? |
|---|---|---|
| Bend | Offset (free), 3-pt saddle, 4-pt saddle, kick, 90° stub-up, with a diagram and numbered marks | Offset free |
| V-Drop | mV/A·m method (user-entered, AS/NZS 3008 style) or physics estimate from size, 1φ/3φ, min size | Paid |
| Fill | Mixed cables in one conduit vs 53/31/40 % guide, max count, jam ratio | Paid |
| Power | Ohm's law; single/three-phase kW, kVA, kvar, amps | Free |
| Tools | Cable runs & drums (cut plan), converter (free), jobs (paid), settings, Full Unlock, safety & sources | — |

Every result shows its working and the disclaimer. Formulas and sources are cited at the top of each file in
`src/core/` and on the in-app Safety & sources screen. No AS/NZS table values are stored.

## Money
- `com.jared797.wattle.unlock`: non-consumable Full Unlock, A$4.99.
- `com.jared797.wattle.trial7`: free non-consumable "7-day Trial", user-started (Guideline 3.1.1).
- Purchase code is Cue's tested expo-iap provider (`src/plus/purchases.ts`).

## Commands
- `npm test` — 39 node tests (worked examples, edge cases, invalid input, purchases).
- `npx tsc --noEmit` — typecheck.
- `npx expo start --web` — quick look in a browser (fonts differ from iOS).
- `.github/workflows/wattle-store-capture.yml` — iOS simulator: functional pass of the store build plus App Store
  captures from a capture build (`EXPO_PUBLIC_WATTLE_CAPTURE=1`, example inputs, everything open).

## Store
`store/listing.json` (applied by `scripts/asc/asc.py` via `store/ASC_REQUEST.json`), screenshots in
`store/screenshots/6.9`, pages in `docs/wattle/`. App Privacy: Data Not Collected.
