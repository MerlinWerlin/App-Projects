## Screedline 1.0.0: concrete and landscape calculator (first TestFlight build)

New App Factory app for concreters and landscapers. Merging ships **one** TestFlight build (RELEASE.json, ascAppId 6838129072) and applies the App Store listing, both in-app purchases and screenshots (store/ASC_REQUEST.json `apply`). Nothing is submitted for App Review.

### What it does
- **Country first:** asks where you work (device region preselected, changeable in Settings). AU, NZ, UK, IE, US and CA get sourced local products (bag sizes with maker yields, mesh sheets, bar designations, pavers, wall blocks, bulk materials), units, ready-mix steps, standards, falls and stair rules. Unverified catalogues fall back to generic sizes and say so. Anywhere else: metric, generic sizes.
- **Concrete:** slab (edge beam), footings, piers, steps, odd shapes, truck order, bagged concrete, site mix.
- **Steel & forms:** mesh + chairs (both orientations), bars + laps + weight, trench mesh, formwork + pegs.
- **Ground:** falls with peg heights, pavers + bedding + base, bulk materials, weight ↔ volume, retaining walls.
- **Pour day:** evaporation / cracking risk (Uno, ACI 305R), pour and curing checklist per job.
- Every answer: live result slab, **Show the working**, field-level errors, supplier/engineer note. Jobs on the phone with shareable job sheets. Light, dark and Sun (max contrast) themes; 56 pt targets.

### Since the first draft
- **18 verified review findings fixed** (GPT-6.2 Sol review, checked by Claude): truck loads never over capacity (NZ 12.75 m³ → 3 × 4.25), NZS 3101 mesh laps, edge-beam fields required, no "low risk" without an estimate, notes in saved/shared sheets, Ask to Buy unlocks live, restore messages from the returned access, nibbed block paving, US tons, privacy link, wall caveat always, Versawall caps, thousands separators, invalid text flagged, NCC 18 risers and AD K 42° pitch, VoiceOver announcements, A$ fallback price only in AU.
- **Locked tools show a blurred live preview** of the user's own answer with an unlock card (simulator screenshots: `maestro-locked` in the capture artifact).
- Status-bar backdrop on tab screens; paving falls by default; 120 fps flag.

### Money
Free core (slab, truck order, bags, falls, weight ↔ volume, checklist, one job). Full Unlock `com.jared797.screedline.full` A$4.99 one-time; free user-started `com.jared797.screedline.trial7` 7-day Trial. No subscription, ads, tracking or account; App Privacy: Data Not Collected (published).

### Checks
- 65 unit tests (`npm test`): worked examples for every formula, invalid input, every tool × every country × every choice, catalogue sanity against sources, no retailer/maker names in UI text, break-ui worst cases.
- check workflow (typecheck, tests, iOS + Android bundle) green; iOS 27 launch check (Xcode 27) passed → SCENE_LIFECYCLE_OK.
- Simulator captures (light/dark, iPhone SE, largest text) from `.github/workflows/screedline-capture.yml`.
- Design skills used: impeccable (main: PRODUCT.md, craft floor, native audit 16/20), apple-design, emil-design-eng, animate-expo, break-ui, gestures, mobile-native (web pages), mobile-app-design:ios-screens and ios-review. taste-skill loaded: it targets marketing websites, so it was not applied to the native screens.
- Simulator: Release build launches (LAUNCH OK), store flows light/dark, iPhone SE (US units) and largest text all captured (run 45107571855).

### App Store Connect (done on the web)
Bundle ID registered, app record created (en-AU, SKU screedline), App Privacy published, China mainland compliance (Security Assessment: No; AIGC: No).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
