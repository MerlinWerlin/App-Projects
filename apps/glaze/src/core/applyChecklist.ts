// T61 (docs/MARKET.md L2): the theme detail's 3-in-1 apply checklist. A theme is one look, and
// applying it is three tickable steps in order: Wallpaper (the Lock + Home pair counts as one
// step) > Icons (load the style, then install) > Widgets. A Live loop is an optional extra row
// that never counts towards progress. Pure and Node-tested; src/store/applyChecklist.ts keeps one
// record per theme in AsyncStorage.
//
// Honesty rule: home-screen widgets need the full build (the WidgetKit extension). In Expo Go or
// on Android the widgets step is "preview saved" (Widget Studio drafts the widgets in-app) and the
// screen must say so; it never claims a widget was added to the Home Screen.

export const CHECKLIST_STORAGE_KEY = 'glaze.applyChecklist.v1';
export const CHECKLIST_VERSION = 1;
/** Oldest records beyond this many themes are dropped on save, so the store stays small. */
export const CHECKLIST_MAX_THEMES = 40;

/** The three steps that make up the look, in order. */
export const CHECKLIST_STEPS = ['wallpaper', 'icons', 'widgets'] as const;
export type ChecklistStep = (typeof CHECKLIST_STEPS)[number];
/** Rows shown: the three steps plus the optional loop. */
export type ChecklistRow = ChecklistStep | 'loop';
export const CHECKLIST_ROWS: readonly ChecklistRow[] = Object.freeze([...CHECKLIST_STEPS, 'loop'] as ChecklistRow[]);

/** Things the user can tick. Icons needs both the style and the install. */
export const CHECKLIST_TASKS = ['wallpaper', 'iconStyle', 'iconInstall', 'widgets', 'loop'] as const;
export type ChecklistTask = (typeof CHECKLIST_TASKS)[number];

export type ChecklistTicks = Record<ChecklistTask, boolean>;

export type ChecklistState = {
  v: typeof CHECKLIST_VERSION;
  themeId: string;
  ticks: ChecklistTicks;
  /** True once the success moment has played for the current completion. */
  celebrated: boolean;
  /** ms since epoch of the last change (used to trim the store). */
  updatedAt: number;
};

/** How the widgets step reads: 'add' in a full build with the widget bridge, else 'preview'. */
export type WidgetsStepMode = 'add' | 'preview';

export function widgetsStepMode(bridgeAvailable: boolean): WidgetsStepMode {
  return bridgeAvailable ? 'add' : 'preview';
}

function noTicks(): ChecklistTicks {
  return { wallpaper: false, iconStyle: false, iconInstall: false, widgets: false, loop: false };
}

export function freshChecklist(themeId: string, now = 0): ChecklistState {
  return { v: CHECKLIST_VERSION, themeId, ticks: noTicks(), celebrated: false, updatedAt: now };
}

/** The state for `themeId`: the given one when it belongs to that theme, else a fresh one. */
export function checklistFor(state: ChecklistState | null | undefined, themeId: string): ChecklistState {
  return state && state.themeId === themeId ? state : freshChecklist(themeId);
}

/** Tick a task. Idempotent; returns the same object when nothing changes. */
export function tickTask(state: ChecklistState, task: ChecklistTask, now = 0): ChecklistState {
  if (!(CHECKLIST_TASKS as readonly string[]).includes(task) || state.ticks[task]) return state;
  return { ...state, ticks: { ...state.ticks, [task]: true }, updatedAt: now };
}

/** Start the look again: every tick cleared, success moment re-armed. */
export function resetChecklist(state: ChecklistState, now = 0): ChecklistState {
  return freshChecklist(state.themeId, now);
}

export function rowDone(state: ChecklistState, row: ChecklistRow): boolean {
  const k = state.ticks;
  switch (row) {
    case 'wallpaper':
      return k.wallpaper;
    case 'icons':
      return k.iconStyle && k.iconInstall;
    case 'widgets':
      return k.widgets;
    case 'loop':
      return k.loop;
    default:
      return false;
  }
}

/** Ticked parts of a row out of its parts (icons has two; the rest one). */
export function rowParts(state: ChecklistState, row: ChecklistRow): { done: number; total: number } {
  if (row === 'icons') return { done: Number(state.ticks.iconStyle) + Number(state.ticks.iconInstall), total: 2 };
  return { done: rowDone(state, row) ? 1 : 0, total: 1 };
}

export type ChecklistProgress = {
  /** Whole steps done (0..3). */
  done: number;
  total: number;
  /** 0..1, counting half an icons step for each of its two parts. Loop never counts. */
  fraction: number;
};

export function checklistProgress(state: ChecklistState): ChecklistProgress {
  let done = 0;
  let parts = 0;
  for (const s of CHECKLIST_STEPS) {
    if (rowDone(state, s)) done++;
    const p = rowParts(state, s);
    parts += p.done / p.total;
  }
  const total = CHECKLIST_STEPS.length;
  return { done, total, fraction: Math.round((parts / total) * 1000) / 1000 };
}

/** The first step still to do, in order; null when all three are ticked. */
export function nextStep(state: ChecklistState): ChecklistStep | null {
  for (const s of CHECKLIST_STEPS) if (!rowDone(state, s)) return s;
  return null;
}

export function isComplete(state: ChecklistState): boolean {
  return nextStep(state) === null;
}

/** True when the three steps are done and the success moment hasn't played yet. */
export function celebrationDue(state: ChecklistState): boolean {
  return isComplete(state) && !state.celebrated;
}

export function markCelebrated(state: ChecklistState, now = 0): ChecklistState {
  return state.celebrated ? state : { ...state, celebrated: true, updatedAt: now };
}

/** The row to open by default: the next step, or the optional loop once the look is done. */
export function defaultOpenRow(state: ChecklistState): ChecklistRow {
  return nextStep(state) ?? 'loop';
}

// ---- persistence ----------------------------------------------------------------------------

/** Parse one stored record for `themeId`. Anything malformed gives a fresh checklist. */
export function parseChecklist(input: unknown, themeId: string): ChecklistState {
  const fresh = freshChecklist(themeId);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fresh;
  const o = input as Record<string, unknown>;
  if (o.v !== CHECKLIST_VERSION || o.themeId !== themeId) return fresh;
  const rawTicks = o.ticks && typeof o.ticks === 'object' && !Array.isArray(o.ticks) ? (o.ticks as Record<string, unknown>) : {};
  const ticks = noTicks();
  for (const t of CHECKLIST_TASKS) ticks[t] = rawTicks[t] === true;
  const updatedAt = typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) && o.updatedAt >= 0 ? o.updatedAt : 0;
  const state: ChecklistState = { v: CHECKLIST_VERSION, themeId, ticks, celebrated: o.celebrated === true, updatedAt };
  // A stored "celebrated" without a complete look (e.g. hand-edited) re-arms the moment.
  if (state.celebrated && !isComplete(state)) state.celebrated = false;
  return state;
}

/** Parse the whole store (theme id -> raw record). Never throws. */
export function parseChecklistStore(input: unknown): Record<string, unknown> {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k && k !== '__proto__' && v && typeof v === 'object') out[k] = v;
  }
  return out;
}

/** Put `state` into the store and keep only the most recent CHECKLIST_MAX_THEMES records. */
export function storeWith(store: Record<string, unknown>, state: ChecklistState): Record<string, unknown> {
  const next: Record<string, unknown> = { ...store, [state.themeId]: { ...state, ticks: { ...state.ticks } } };
  const keys = Object.keys(next);
  if (keys.length <= CHECKLIST_MAX_THEMES) return next;
  const age = (k: string): number => {
    const r = next[k] as { updatedAt?: unknown } | undefined;
    return r && typeof r.updatedAt === 'number' ? r.updatedAt : 0;
  };
  const keep = new Set(
    keys
      .filter((k) => k !== state.themeId)
      .sort((a, b) => age(b) - age(a))
      .slice(0, CHECKLIST_MAX_THEMES - 1),
  );
  keep.add(state.themeId);
  const trimmed: Record<string, unknown> = {};
  for (const k of keys) if (keep.has(k)) trimmed[k] = next[k];
  return trimmed;
}

// ---- ticks from other screens (T81) ---------------------------------------------------------
// The wallpaper maker and Widget Studio tick their step in the stored record of the theme they
// were opened for; the theme detail merges the stored record back in when it regains focus.

/** `base` with every task `extra` has ticked also ticked (a union: never clears a tick). */
export function mergeTicks(base: ChecklistState, extra: ChecklistState, now = 0): ChecklistState {
  if (base.themeId !== extra.themeId) return base;
  return CHECKLIST_TASKS.reduce(
    (acc: ChecklistState, k: ChecklistTask) => (extra.ticks[k] ? tickTask(acc, k, now) : acc),
    base,
  );
}

/** Tick `task` in the stored record for `themeId`. Returns the same store when nothing changes. */
export function tickInStore(
  store: Record<string, unknown>,
  themeId: string,
  task: ChecklistTask,
  now = 0,
): Record<string, unknown> {
  if (!themeId) return store;
  const before = parseChecklist(store[themeId] ?? null, themeId);
  const after = tickTask(before, task, now);
  return after === before ? store : storeWith(store, after);
}

/** How a Lock + Home pair save on the wallpaper maker ended. */
export type PairSaveOutcome = 'saved' | 'lockFailed' | 'homeFailed';

/** The pair ticks the wallpaper step, and only once both halves are saved to Photos. */
export function pairSaveTicksWallpaper(outcome: PairSaveOutcome): boolean {
  return outcome === 'saved';
}

/** How "Add widget" in Widget Studio ended (the studio's result card). */
export type StudioSaveOutcome = 'saved' | 'preview' | 'failed' | 'photoFailed';

/**
 * The widgets step ticks only when the studio saves: 'saved' (added in a full build) or 'preview'
 * (the design saved on this phone where widgets can only be previewed). Opening the studio, or a
 * failed add, never ticks it.
 */
export function studioSaveTicksWidgets(outcome: StudioSaveOutcome | null): boolean {
  return outcome === 'saved' || outcome === 'preview';
}
