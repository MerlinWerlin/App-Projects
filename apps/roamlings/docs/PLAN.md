# Roamlings plan

Full concept (owner-facing): https://claude.ai/artifact/RhrtGb8BAep9D3UCJGDnBa . This file is the build's working summary.

## Product in one line
Do something good (walk, focus, care) → earn Spark → hatch eggs → raise pets that grow differently depending on what you did → collect every colourway → (later) trade safely with friends.

## Rules that never change
- Effort, not money, makes pets. Eggs, hatches, Spark, odds and evolutions are never sold (Australian classification rates paid loot boxes M and simulated gambling R18+; kids are a target audience).
- Kid-safe by design: no free chat, no strangers, no precise location (country/region only), no ads or tracking.
- Original creatures only. No resemblance to existing franchises, no competitor names anywhere.
- Smooth timed motion, no bouncy springs; Reduce Motion respected.
- TestFlight is the only test channel (never Expo Go).

## Architecture
- Expo SDK 57, expo-router (tabs: Home, Pets, Dex, Settings; modals: hatch, focus, pet/[id]).
- `src/core/` pure TS, tested with node --test: seeded RNG, species catalogue (12 species, 4 colourways + 2 rare part mods each = 8 variants), hatch/rarity with pity, Spark (daily cap 300, egg = 100), growth (stages at 400/1600 XP, branch = most-earned activity), care (happiness decay, cooldowns, streak), regions (country → region), the whole game state as pure functions.
- `src/ui/PetView.tsx` draws every pet from parts + palette + stage + branch as SVG (no image files per pet).
- `src/store/game.ts` keeps state in AsyncStorage; `src/native/steps.ts` reads steps via expo-sensors Pedometer (iOS: today since midnight; Android: live while open).

## Phases (from the concept doc)
1. Hatch loop (local): steps/focus/care → Spark → eggs → hatching → growth/evolution → Dex; **home-screen widgets** (next).
2. Server + accounts: age gate, server-side hatch rolls and pet ledger, Spark caps, sync. Needs Jared's OK for a free backend account (Supabase or Cloudflare).
3. Friends + trading: QR/bump add, bump and remote trades, gifts, preset reactions, block/report.
4. Family: parent account + dashboard, parent quests, approvals.
5. World: regional species, World Dex map, visitors, weather/time odds, events, community goals.
6. Depth: pairing, habitats, expeditions, races/shows, Live Activities, more widgets.
7. Launch prep: Plus / Family Plus, cosmetics shop, privacy review, store listing, Watch.
