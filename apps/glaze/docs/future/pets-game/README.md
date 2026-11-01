# Parked: pets game

**Status: cut from Glaze.** Owner decision 1 Nov 2026 (brief owner-1101d item 1, task T198): remove pets entirely; maybe a separate game much later. Glaze stays focused on themes, matching icons, themed widgets and wallpapers.

## What existed

- **Three original pixel companions**: Mushy the cat, Pip the fox, Clover the bunny (16×16 grids, original art; see [sprites.md](sprites.md)).
- **A Pets tab** (T186) over one Pets screen (`app/pets.tsx`, T188): each pet's state, mood and caption, Feed / Play, tap to say hello; settings for which pet goes on the Island, Lock Screen / Island on-off, quiet hours and names (AsyncStorage `glaze.pets.v1`). An "Island pets" card at the top of the Widgets tab linked to it.
- **A day cycle** (`src/core/petLife.ts`, pure TS, deterministic): asleep in quiet hours, a 20-minute wake-up stretch, breakfast / lunch / dinner, and 30-minute blocks of sitting, wandering or playing picked by a per-pet hash of (pet, day, block). Moods: sleepy, hungry, playful, happy, content. Tap / Feed / Play reactions on top.
- **Live Activity / Dynamic Island**: one local ActivityKit session (native module `modules/glaze-island-pets`, widget-extension views `IslandPetActivity.swift` + `IslandPetSprites.swift`, shared `GlazePetAttributes.swift`, `NSSupportsLiveActivities` from `native-plugins/island-pets.json`). No push and no background work: while Glaze was open it sent a new content state only at petLife boundaries, with `staleDate = until` plus the following state so iOS could show one more change by itself. iOS ends an activity after at most 8 hours. `syncIslandPetOnOpen` in `app/_layout.tsx` resynced it on launch and foreground (T192).
- `scripts/island-pets-contract.mjs` checked the generated sprites, native labels and that the two `GlazePetAttributes.swift` copies were identical.

## Why it was cut

Owner, 1 Nov 2026: cut pets entirely; maybe a separate game much later. Practical reasons on top: a Live Activity only changes while the app feeds it (otherwise the pet "just sits there") and expires after 8 hours, and the feature carried a native module, the Live Activities entitlement and extra App Review surface for something that is not theming. If it returns, it should be its own small game, not a Glaze tab.

## Where the removed code lives

Everything was deleted in T198. The last commit with all of it is **`7927df4`** on `main` ("owner-1101d: import brief (T198-T204)"). Read a file with `git show 7927df4:<path>`, or restore it with `git checkout 7927df4 -- <path>`:

- `app/pets.tsx`, `app/(tabs)/pets.tsx`, the pets card in `app/(tabs)/widgets.tsx`, the open/foreground sync in `app/_layout.tsx`
- `src/core/petLife.ts` (+ test), `src/core/islandPets.ts` (+ test)
- `src/store/pets.ts`, `src/native/islandPets.ts`, `src/ui/IslandPetArt.tsx`, `src/i18n/pets.ts` (copy for all 11 locales) and `tabs.pets` in each locale
- `modules/glaze-island-pets/`
- `targets/widget/IslandPetActivity.swift`, `IslandPetSprites.swift`, `GlazePetAttributes.swift`, the `IslandPetActivity()` entry in `GlazeWidgetsBundle.swift`, the `ActivityKit` framework in `targets/widget/expo-target.config.js`, the `pet.*` strings in `targets/widget/*.lproj/Localizable.strings`
- `native-plugins/island-pets.json`, `scripts/island-pets-contract.mjs`

## Original design notes (moved from docs/WIDGETS.md)

### Island pets (26 October owner request)

Widgets > Island pets opens three original pixel companions: Mushy the cat, Pip the fox and Clover the bunny. Start/Switch/Stop controls create one local ActivityKit session; Cuddle/Play/Nap change its pose. The Lock Screen, compact/minimal/expanded Dynamic Island and app share the same generated sprite data and exact ActivityAttributes. Tap the activity to return through `glaze://pets`. No push server, background audio, network, purchase or account is involved. iOS controls visibility and ends activities after at most eight hours. There is no promise of continuous animation.

The app restores status from ActivityKit on focus/foreground and never treats a failed response as stopped. Expired/dismissed activities are excluded, repeated starts do not reset a matching pet, and both JS and native layers serialize changes. Disabled Live Activities and unsupported/old builds show an honest fallback. All eleven languages include pet UI and native labels. Runtime version 1.0.1 separated this native module from the old 1.0.0 OTA runtime.

Validation: `node scripts/island-pets-contract.mjs` verified generated sprites, native labels and identical app/extension attributes; native CI typechecked both the widget extension and ActivityKit session controller. Actual iPhone presentation, dismissal, deep links and accessibility were never tested on a device.

#### Pet life (T188, owner-1101 #6)

The owner said the pets "just sit there". Each pet followed a day, computed by `src/core/petLife.ts` (pure TS, tested in `petLife.test.ts`):

- **Day plan** (local time, 5-minute grid): asleep in quiet hours (default 22:00-07:00, set on the Pets screen), a 20-minute wake-up stretch, breakfast 40 minutes after waking, lunch 12:30 and dinner 18:30 (30 minutes each, skipped when they fall in quiet hours), and the rest of the day in 30-minute blocks of sitting, wandering or playing. A per-pet hash of (pet, day, block) picks each block, so the same minute always gives the same answer; Mushy sits more, Pip moves more, Clover is in between.
- **Moods**: sleepy (asleep, waking, the hour before bed), hungry (the 30 minutes before a meal unless fed in the last 3 h), playful (wandering or playing), happy (for 2 h after a hello or a feed), otherwise content.
- **Interactions**: tapping a pet gives a 6-second happy reaction (at night only a sleepy stir; it never wakes up). Feed gives 10 minutes of eating, Play 15 minutes of playing. Feed and Play are off while a pet sleeps.
- **Output**: state, mood, caption key, frame set (`sleep`, `stretch`, `sit`, `eat`, `play`, `walk`, `cheer`), a spot (0-4) for wandering, `until` (the next change) and `next` (the state after it). A day has roughly 30-45 boundaries.

**Pets screen** (`app/pets.tsx`; T186's Pets tab re-exported it): the Island pet's preview, one card per pet (state, caption, mood, Feed, Play; tap the pet to say hello, with a light haptic), and settings: which pet goes on the Island, Show on Lock Screen and Island on/off, quiet hours (30-minute steps, 4-20 h long) and names (16 characters). Settings lived in AsyncStorage (`glaze.pets.v1`, `src/store/pets.ts`), so everything except the Live Activity also worked in Expo Go. In the app a pet breathed with a slow 1-pt rise and walked between spots with a 1.2 s ease (no spring or bounce; nothing moved with Reduce Motion on). The screen re-rendered on one timeout set to the earliest `until`, not on a polling timer.

**Live Activity, within Apple's rules.** No push, no background updates, no timers. While Glaze was open, `syncIslandPet` sent a new content state (`startLife` / `life` in the module, JSON from `activityStateFor`) only when petLife's state, mood, spot or next state changed, plus at most one tap-reaction update every 20 s. Each update set `staleDate = until` and carried `nextState`, `nextMood`, `nextSpot`. When the stale date passed, iOS re-rendered the activity with `isStale` and the view drew the next state, so one more change showed without the app. After that the activity stayed on that pose until Glaze was opened again. Between updates the only moving part was the system-drawn countdown to the next change (`Text(timerInterval:)`). Pose changes used short opacity / position transitions and `contentTransition(.symbolEffect(.replace))`. iOS still ends an activity after at most 8 hours on the Lock Screen.

Compatibility: the ContentState fields added for pet life were optional so activities from older builds still decoded; JS on an older native build fell back to `start` / `mood` with three poses (`legacyPose`).
