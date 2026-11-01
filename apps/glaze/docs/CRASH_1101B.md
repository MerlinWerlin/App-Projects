# Freeze, slow start, then crash after a theme swap: TestFlight 1.0.1 (19) (T250)

**Report (owner-1101h, 1 Nov 2026):** after applying a new theme (Firefly Grove) and coming back into Glaze, the app was frozen. Then it took a long time to start, and then it crashed.

**Crash log:** none in the repo. The cause below comes from reading the code. It has **not** been confirmed on a device.

## Suspected cause

Too much work on the JS thread at launch, when the app comes back to the foreground, and right after "Use this theme". The likely end is the iOS watchdog, or memory pressure. This is the work that ran:

1. **Re-hashing a downloaded remote art pack on first read.** `remoteArtOnDevice` (used by `useAnyTheme` / `useRemoteArtTheme`) read every file of the pack into JS: the multi-MB wallpaper, the heroes and the widget art. Each file was read as base64, decoded in JS, and then run through SHA-256 in pure JS, which is synchronous. After Firefly Grove was applied it became the theme in use. So on every launch, the Themes, Icons and Widgets screens that look up the theme in use set off this full re-verify. That means seconds of blocked JS thread, plus large base64 strings held in memory. **This is the main suspect.**
2. **T222 pack updates on foreground.** On foreground the catalogue refresh ran `runPackUpdates()` straight away. That downloads updated packs and hashes each one in JS.
3. **The launch timers.** These all ran on fixed timers during the intro and the first screen, whatever else was happening:
   - the pack-motif restore at module load (every downloaded pack read, with its art assets hashed)
   - the App Group widget theme write at 1.5 s
   - the installed-app probe at 2.5 s (50 `canOpenURL` calls at once, on every launch)
4. **The work after "Use this theme".** The probe started, the App Group write ran, and then the widget-art index read, edit and write ran (file prune + `reloadAllTimelines`). All of this ran in line with the apply, before it returned.

## What changed

- **One deferred-work queue** (`src/core/deferredWork.ts`, pure and tested; wrapper in `src/store/deferredWork.ts`):
  - Steps are named and registered up front (`src/store/launchWork.ts`, plus `themeArt` in `src/store/activeTheme.ts`).
  - It starts only after the first screen has laid out, plus 900 ms and any running interactions. After that it runs one step at a time, yielding between steps (`InteractionManager.runAfterInteractions` + `setTimeout 0`, capped at 400 ms).
  - Every step runs in try/catch, with a 20 s timeout so a native call that never answers cannot hold the queue.
  - Duplicate requests are coalesced, and the latest argument wins. A request that comes in while the step is running runs it once more afterwards.
  - Before a step runs, it is saved as pending in AsyncStorage (`glaze.deferredWork.v1`) with an attempt count. If the app is killed mid-step, or the step fails, it runs again on the next launch. After 3 launches it is skipped, so a step that crashes the app cannot cause a crash loop.
  - The last 20 run times are kept against each step's budget. `deferredDiagnostics()` gives a "Slowest: …" line, and over-budget or failed runs are logged with `console.log` in `__DEV__` only. Nothing is sent anywhere.
- **`app/_layout.tsx`** does nothing heavy at module load. It calls `startLaunchWork()`, which queues `packRestore`, `widgetTheme` and `installedProbe('launch')`.
- **`applyThemeEverywhere`** returns once the essential state is written: the icon style, the remembered widget theme (AsyncStorage only, via `rememberWidgetTheme`), the theme in use, and the listeners. It then queues `widgetTheme` (App Group write + reload), `themeArt` (`replaceThemeArt`) and `installedProbe('apply')`. Each step works from stored state, so a run resumed on the next launch does the same thing.
- **Installed-app probe:**
  - On launch it runs at most once per 24 h (`probeDue`, `glaze.installedProbe.lastRun.v1`).
  - It always runs after a theme apply ("Use this theme" and "Use style") and after an icon install (profiles saved).
  - It asks 10 schemes per tick, yielding between chunks.
- **Remote art packs on first read:** `loadRemoteArtQuick` checks that each file exists with exactly the size in the manifest, via `fs.getInfoAsync`, without reading the bytes into JS. Every file's SHA-256 is still checked when it is downloaded or updated. A truncated, missing or grown file still fails, and the pack then offers the download again. The full re-hash (`loadRemoteArt`) is still there and still tested.
- **Pack restore** yields between packs. It is no longer started at module load. `src/store/studio.ts` still awaits the same memoised promise before it parses a saved style, so a pack-only motif still survives a restart (T50).
- **T222 pack updates** are requested through the queue (`setPackUpdateScheduler`). They no longer start directly when the catalogue loads on foreground.
- **Crop editor re-check (T228, docs/CRASH_1101.md):**
  - Every gesture callback still catches its own errors (`workletGuard`).
  - The one remaining UI-thread updater without a try/catch, the photo `useAnimatedStyle`, now has one, with an identity-transform fallback. A guard test asserts this.
- **Guards:**
  - `src/core/launchBudgetGuard.test.ts`: the layout and `applyThemeEverywhere` contain no heavy call; all of it goes through the queue; the steps are registered before start; the probe is throttled and chunked; foreground handlers start nothing heavy.
  - `src/core/deferredWork.test.ts`: ordering, coalescing, retry after a crash, the crash-loop cut-off, timeout, and budget accounting.

## Not device-confirmed

- That this was the cause. There is no crash log, and the watchdog or memory theory is inferred from the code.
- Timings on a real iPhone: how long the old re-hash took, and how much the new launch budget saves.
- That `InteractionManager` behaves the same in the owner's React Native build. The yield is capped at 400 ms either way.
- Widget behaviour when the App Group write happens about 1 s later than before, after "Use this theme".

## Still open

The full SHA-256 still runs in JS during a pack download or update. That work is user-started or queued, but each file is hashed in one synchronous block. Moving hashing to native, or chunking it, would remove the last long JS block.
