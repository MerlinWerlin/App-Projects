# Trammel: carpentry calculator for chippies

Expo SDK 58, Expo Router, TypeScript. App Store Connect app 6838128372, bundle `com.jared797.trammel`.
Started 23 Nov 2026 (trade-apps batch: plumbers, carpenters, welders, electricians, concreters).

## Tools
- **Stairs**: riser count and height, going, 2R+G, total going, pitch, step, pitch line, stringer throat, with the
  NCC 2022 limits (Housing Provisions 11.2.2 / Table 11.2.2a; Volume One D3D14 public and private). Fit to a run.
- **Common rafter**: run, rise, length heel to ridge, eave, plumb/seat cuts, birdsmouth (plumb height, notch depth,
  height above plate, one-third check).
- **Hip & valley** (regular hips): hip run, pitch, length, creeper step and every creeper length, cheek cuts.
- **Roof pitch**: degrees, rise per 1000, x in 12, grade, ratio.
- **Mitre**: any corner (inside or outside) and polygons. **Cornice & compound**: bevel and mitre for any spring angle
  and corner, plus the nested setting.
- **Stud & joist layout**: count, every mark (edge or centre) from the end, noggin lengths.
- **Decking**: boards across, rip or gap adjust, linear metres, lengths to buy, joists, screws.
- **Cut list**: best-fit cutting plan from stock lengths with kerf and end trim, drawn to scale, shareable.
- **Square check**: diagonal, 3-4-5 marks, corner angle from measured diagonals. **Arch & radius**: trammel radius,
  arc length, offsets. **Fractions <-> mm**.
- Jobs: save calculations to named jobs on the phone, share a job sheet.

## Money
7-day free trial (free non-consumable `com.jared797.trammel.trial7`) then one-time Full Unlock A$4.99
(`com.jared797.trammel.unlock`). Free for good: converter, square check, mitre, roof pitch. See `store/IAP.md`.
StoreKit 2 module copied from Satchel (`modules/trammel-store`).

## Layout
- `src/core/` pure TypeScript maths, each formula with its source in the header comment; `npm test` (node --test).
- `app/` screens; `src/ui/kit.tsx` the Blade design system (tape-measure yellow results, 56 pt controls).
- `store/listing.json` App Store listing (synced by `scripts/asc/asc.py`), `store/capture/compose.py` store shots
  from `.github/workflows/trammel-store-capture.yml`.
- `assets/brand/make_icon.py` the icon (concept generated in ChatGPT, redrawn as exact geometry).
- Public pages: `docs/trammel/privacy.html`, `docs/trammel/support.html`.

## Check it
`npm test`, `npx tsc --noEmit`, `npx expo start --web` for a quick look in a browser.
