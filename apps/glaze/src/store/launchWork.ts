// T250 (owner-1101h #1): everything that used to run at launch (pack restore at module load, the
// widget theme re-write at 1.5 s, the installed-apps check at 2.5 s) and the heavy follow-ups of
// "Use this theme" now run as named steps of the deferred queue (src/store/deferredWork.ts):
// after the first screen has drawn, after interactions, one at a time, each in try/catch, and a
// step the app was killed in the middle of runs again on the next launch.
// Every step is registered here at module load, before the queue starts, so a pending step left by
// a crash is always found. app/_layout.tsx only calls startLaunchWork().
import { DEFERRED_STEPS } from '../core/deferredWork';
import type { ProbeReason } from '../core/installedProbe';
import { whenFirstScreen } from '../core/startupHandoff';
import { restoreDownloadedPacks, runPackUpdates, setPackUpdateScheduler } from '../native/packs';
// Registers the 'themeArt' step (it lives next to applyThemeEverywhere, which requests it).
import './activeTheme';
import { registerDeferred, requestDeferred, startDeferred, yieldToUi } from './deferredWork';
import { runInstalledProbeStep } from './installedProbe';
import { pushStoredWidgetTheme } from './widgetTheme';

/** Wait after the first screen laid out (the intro fade) before the first step. */
const AFTER_FIRST_SCREEN_MS = 900;
/** If the first screen never reports (an error screen), start anyway after this long. */
const FIRST_SCREEN_CAP_MS = 8000;

/** The probe's reason from its request: a resumed run (killed after an apply / install) always probes. */
function probeReasonOf(arg: unknown, resumed: boolean): ProbeReason {
  if (arg === 'install') return 'install';
  if (arg === 'apply' || resumed) return 'apply';
  return 'launch';
}

registerDeferred(DEFERRED_STEPS.packRestore, {
  priority: 10,
  // Memoised per launch and awaited by the studio store itself: nothing to resume.
  persist: false,
  budgetMs: 400,
  run: () => restoreDownloadedPacks(),
});

registerDeferred(DEFERRED_STEPS.widgetTheme, {
  priority: 20,
  // App Group write + reloadAllTimelines (no-op in Expo Go / Android). Idempotent.
  run: async () => {
    await pushStoredWidgetTheme();
  },
});

registerDeferred(DEFERRED_STEPS.installedProbe, {
  priority: 50,
  budgetMs: 600,
  // A resumed run (killed after a theme apply / install) always probes; a launch is throttled.
  run: (arg, ctx) => runInstalledProbeStep(probeReasonOf(arg, ctx.resumed)),
});

registerDeferred(DEFERRED_STEPS.packUpdates, {
  priority: 80,
  // Rebuilt from the catalogue on every catalogue load: nothing to resume.
  persist: false,
  budgetMs: 2000,
  run: () => runPackUpdates(),
});

// T222 pack updates (due after a catalogue load, e.g. on foreground) go through the queue too.
setPackUpdateScheduler(() => requestDeferred(DEFERRED_STEPS.packUpdates));

let begun = false;

/**
 * Once per app run (app/_layout.tsx): queue the launch steps and start the queue after the first
 * screen has laid out + AFTER_FIRST_SCREEN_MS + interactions. Returns at once; never throws.
 */
export function startLaunchWork(): void {
  if (begun) return;
  begun = true;
  try {
    requestDeferred(DEFERRED_STEPS.packRestore);
    requestDeferred(DEFERRED_STEPS.widgetTheme);
    const reason: ProbeReason = 'launch';
    requestDeferred(DEFERRED_STEPS.installedProbe, reason);
    whenFirstScreen(() => {
      setTimeout(() => {
        void yieldToUi().then(startDeferred, startDeferred);
      }, AFTER_FIRST_SCREEN_MS);
    }, FIRST_SCREEN_CAP_MS);
  } catch {
    // Never break the launch; the next launch tries again.
  }
}
