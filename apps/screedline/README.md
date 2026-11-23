# Screedline: concrete and landscape calculator

App Factory app for Australian concreters and landscapers (Expo SDK 58, Expo Router, TypeScript). Started 23 Nov 2026.

## What it does
- **Concrete:** slab (with optional thickened edge beam), strip and pad footings, round piers, solid steps, odd shapes
  (rectangles + triangles + circles, minus cut-outs), all with a waste allowance.
- **Ordering:** truck order in the plant's step (default 0.2 m³) split into loads; premix bag count by bag size;
  site-mix cement, sand and aggregate.
- **Steel and forms:** SL mesh sheets with laps (both orientations tried) and bar chairs; N-bar stock bars, laps and
  weight; trench mesh with end and junction laps; form boards, joints and pegs.
- **Ground:** falls as %, 1 : n, mm and mm/m with string-line peg heights; pavers with bedding sand and road base;
  gravel/soil/sand m³ and tonnes by density; tonnes ↔ m³; segmental retaining wall blocks, caps, drainage, pad, ag pipe.
- **Pour day:** evaporation rate and cracking risk (Uno/ACI 305R) and a pour and curing checklist (per job).
- Every answer has **Show the working**, plain-words errors on the exact field, and a "confirm with your supplier and
  engineer" note. Metric first, imperial toggle. Light, dark and **Sun** (maximum contrast) themes. 56 pt targets.
- **Jobs** saved on the phone only, with a shareable job sheet.

## Money
Free: slab, truck order, premix bags, falls, tonnes ↔ m³, checklist and one job. **Full Unlock** (one-time
non-consumable `com.jared797.screedline.full`, A$4.99) opens everything else; a free user-started **7-day Trial**
non-consumable (`com.jared797.screedline.trial7`) opens it all for seven days from Apple's original transaction date.
No subscription, ads, account, analytics or network calls of its own (App Privacy: Data Not Collected).

## Layout
- `src/core/` pure TypeScript calculators. Each file starts with its sources. Tests: `npm test` (node --test).
- `src/tools/registry.ts` every tool as data (fields, defaults, outputs); `registry.test.ts` runs every tool's defaults
  and checks that clearing any required field puts an error on that field.
- `src/plus/` entitlement, trial and the expo-iap provider (from Cue's tested provider, expo-iap pinned to 6.2.0).
- `src/ui/ToolView.tsx` the one calculator screen; `app/` routes.
- `store/` listing, capture flows (`.github/workflows/screedline-capture.yml`), screenshots. `docs/screedline/` web pages.
- `assets/meta.json` records the ChatGPT image prompts.
