// T265 (owner-1101i #1): the guided "Use this theme" flow. Pure step model: three steps
// (Wallpaper, Icons, Widgets) with progress dots, Next / Skip, tappable dots, Done at the end, and
// the per-theme record of finished steps (persisted by src/store/themeSetup.ts). No strings here:
// the UI (src/ui/ThemeSetupFlow.tsx) translates everything.

export const SETUP_STEPS = ['wallpaper', 'icons', 'widgets'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** AsyncStorage key for the finished steps, per theme id. */
export const SETUP_STORE_KEY = 'glaze.themeSetup.v1';

/** Most themes remembered; the oldest entries drop off first (the record never grows without bound). */
export const SETUP_MAX_THEMES = 200;

/** Finished steps per theme id, in insertion order (oldest first). */
export type SetupProgress = Readonly<Record<string, readonly SetupStep[]>>;

export type FlowState = {
  /** The step on screen. */
  step: SetupStep;
  /** True once Done (or Next / Skip on the last step) closes the flow. */
  finished: boolean;
};

export function isSetupStep(x: unknown): x is SetupStep {
  return typeof x === 'string' && (SETUP_STEPS as readonly string[]).includes(x);
}

/** A route param or stored value as a step; anything else is the fallback. */
export function setupStepOf(x: unknown, fallback: SetupStep = 'wallpaper'): SetupStep {
  return isSetupStep(x) ? x : fallback;
}

export function stepIndex(step: SetupStep): number {
  return SETUP_STEPS.indexOf(step);
}

/** 1-based number shown on the dots ("1", "2", "3"). */
export function stepNumber(step: SetupStep): number {
  return stepIndex(step) + 1;
}

export function isLastStep(step: SetupStep): boolean {
  return stepIndex(step) === SETUP_STEPS.length - 1;
}

export function startFlow(at: SetupStep = 'wallpaper'): FlowState {
  return { step: setupStepOf(at), finished: false };
}

/** Next and Skip both move on; on the last step they finish the flow. */
export function advance(state: FlowState): FlowState {
  if (state.finished) return state;
  const i = stepIndex(state.step);
  if (i >= SETUP_STEPS.length - 1) return { step: state.step, finished: true };
  return { step: SETUP_STEPS[i + 1], finished: false };
}

/** A tapped dot jumps straight to that step. */
export function goTo(state: FlowState, step: SetupStep): FlowState {
  if (!isSetupStep(step)) return state;
  return { step, finished: false };
}

/** What Next does: the current step counts as done, then the flow moves on. */
export function onNext(state: FlowState, progress: SetupProgress, themeId: string): { state: FlowState; progress: SetupProgress } {
  return { state: advance(state), progress: markDone(progress, themeId, state.step) };
}

/** What Skip does: move on without ticking the step. */
export function onSkip(state: FlowState): FlowState {
  return advance(state);
}

export function doneSteps(progress: SetupProgress, themeId: string): ReadonlySet<SetupStep> {
  const list = Object.prototype.hasOwnProperty.call(progress, themeId) ? progress[themeId] : undefined;
  return new Set(Array.isArray(list) ? list.filter(isSetupStep) : []);
}

export function isDone(progress: SetupProgress, themeId: string, step: SetupStep): boolean {
  return doneSteps(progress, themeId).has(step);
}

export function allDone(progress: SetupProgress, themeId: string): boolean {
  const done = doneSteps(progress, themeId);
  return SETUP_STEPS.every((s) => done.has(s));
}

/** Ticks one step for one theme (idempotent). The theme moves to the newest end; old themes drop off past the cap. */
export function markDone(progress: SetupProgress, themeId: string, step: SetupStep): SetupProgress {
  if (!themeId || !isSetupStep(step)) return progress;
  const done = doneSteps(progress, themeId);
  if (done.has(step)) return progress;
  const merged = SETUP_STEPS.filter((s) => done.has(s) || s === step);
  const rest = Object.entries(progress).filter(([k]) => k !== themeId);
  const kept = rest.slice(Math.max(0, rest.length - (SETUP_MAX_THEMES - 1)));
  const out: Record<string, readonly SetupStep[]> = {};
  for (const [k, v] of kept) out[k] = v;
  out[themeId] = merged;
  return out;
}

/** Where the flow opens when no step is asked for: the first step not done yet (all done: the first). */
export function firstOpenStep(progress: SetupProgress, themeId: string): SetupStep {
  const done = doneSteps(progress, themeId);
  return SETUP_STEPS.find((s) => !done.has(s)) ?? SETUP_STEPS[0];
}

export type DotView = { step: SetupStep; number: number; current: boolean; done: boolean };

/** The three progress dots: which one is current and which are ticked. */
export function dots(state: FlowState, done: ReadonlySet<SetupStep>): DotView[] {
  return SETUP_STEPS.map((s) => ({ step: s, number: stepNumber(s), current: s === state.step, done: done.has(s) }));
}

/** Reads the stored record; anything unreadable is an empty record (never throws). */
export function parseProgress(raw: string | null | undefined): SetupProgress {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: Record<string, readonly SetupStep[]> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (!k || !Array.isArray(v)) continue;
    const steps = SETUP_STEPS.filter((s) => v.includes(s));
    if (steps.length > 0) out[k] = steps;
  }
  return out;
}

export function serialiseProgress(progress: SetupProgress): string {
  return JSON.stringify(progress);
}

// ---------------------------------------------------------------------------
// System links (T265): tried in order, each guarded by the caller.

/** Opens the Photos app (Step 1). Not in LSApplicationQueriesSchemes (that list is full), so open it directly. */
export const PHOTOS_URL = 'photos-redirect://';

/** Opens the Settings app itself (Step 2); Linking.openSettings() would open Glaze's own page, so it is the fallback. */
export const SETTINGS_APP_URL = 'App-prefs:';
