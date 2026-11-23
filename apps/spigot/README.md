# Spigot: Plumber's Calculator

iPhone calculator for plumbers on site (Expo SDK 58, expo-router). Metric first with an inch toggle, glove-sized keypad,
big high-contrast results and "Show working" on every answer.

| Tool | Free? | Maths (sources in the code comments) |
|---|---|---|
| Offset | Free | travel = offset ÷ sin θ, run = offset ÷ tan θ (`src/calc/offset.ts`) |
| Rolling offset | Full Unlock | true offset = √(rise² + roll²), then as above; roll the fitting atan(roll ÷ rise) |
| Cut length | Full Unlock | cut = measured − take-offs (centre) + socket depths (face); take-off = C–E − socket (`src/calc/cut.ts`) |
| Fall | Free | drop = length ÷ N for 1:N; % = 100 ÷ N; finish level (`src/calc/fall.ts`) |
| Volume & flow | Full Unlock | V = π/4·d²·L, Q = v·A, Hazen–Williams loss (`src/calc/flow.ts`) |
| Cut list | Full Unlock | exact branch-and-bound bin packing for ≤ 24 pieces, else FFD/BFD (`src/calc/cutlist.ts`) |
| Jobs, Reference | Free | on-device only (`src/state`) and sourced tables (`src/calc/reference.ts`, `docs/DATA_SOURCES.md`) |

Purchases follow Cue's pattern (`src/plus`, expo-iap 6.2.0 pinned): `com.jared797.spigot.unlock` (A$4.99 non-consumable)
and `com.jared797.spigot.trial7` (free, user-started 7-day Trial). No expo-updates (Guideline 5.6).

- Tests: `npm test` (calculators with worked examples, invalid input, reference data, purchases, trial, storage).
- Screenshots and iOS 27 launch check: `.github/workflows/spigot-capture.yml` (Maestro, `scripts/capture-flow.yaml`).
- Store: `store/listing.json` (applied by `scripts/asc/asc.py` via `store/ASC_REQUEST.json`), App Store id 6838128661.
- Ship: `RELEASE.json` mode build, merged to main -> ship -> ship-mac (Xcode 27).
