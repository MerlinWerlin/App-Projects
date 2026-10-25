# Conventions

- Expo SDK 58 (moved from 57 on 25 Oct for the owner's Expo Go; see ops/DECISIONS.md), TypeScript strict, Expo Router (tabs + stack). npm with a committed lockfile once the registry is reachable. Follow docs/STARTER_STANDARD.md.
- **Expo Go compatible until the TRIAL milestone:** only the libraries in `docs/PLAN.md` §6 plus pure-JS packages. Native features (MapLibre offline map, share extension, Wallet, widgets, iCloud) sit behind adapters in `src/native/` that never crash Expo Go.
- `src/core/` is pure TypeScript with no React Native or Expo imports, written so Node runs it directly (type annotations only; relative imports end in `.ts`). Tests sit next to the code as `*.test.ts` with `node:test` + `node:assert/strict`, so `npm test` works offline.
- Times belong to the item's own IANA zone. Date/time pickers show and return that wall clock as phone-local fields (`src/core/wallpicker.ts`); never convert through the phone's zone or pass the picker a time-zone prop. Zone choice goes through the searchable list (`src/core/tzsearch.ts`, `src/ui/ZonePicker.tsx`).
- UI follows `docs/PLAN.md` §5: tokens in `src/theme/tokens.ts` (light + dark), no raw colours in screens, touch targets of 48 pt or more, haptics with a setting, an accessibility label on every control, strings in a catalogue.
- Tickets, emergency card, documents, packing, low-battery mode and one offline city per trip are free forever. Only `src/plus/` and the screens listed in `src/plus/entitlement.test.ts` may read the Plus entitlement.
- No analytics, ads, tracking SDKs, accounts or servers of ours. Location is a single check on request, never background. Documents and medical notes never leave the device unless the user turns on iCloud sync.
- OpenStreetMap data: show attribution wherever map or POI data appears; record sources and licences in docs/THIRD_PARTY.md.
- Never use competitor names in code, copy or assets. Small commits per task, message `T04: ticket view` etc.
