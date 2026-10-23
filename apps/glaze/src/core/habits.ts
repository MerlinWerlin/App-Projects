// Habit tracker state for the widget catalogue (T72; docs/WIDGETS.md "Habit trackers").
//
// Four manual trackers: water (millilitres, +150 ml a tap since T73), sleep (hours, +1 h a tap), steps (typed in, never read from a health
// or fitness store) and mood (1–5). Each keeps today's value, a goal and a history keyed by local
// day. Every function is pure and takes `now` (and optionally a fixed UTC offset in minutes):
// nothing reads the clock, so rollover at local midnight is testable and the widget extension's
// App Intent (T73) can apply the same rules with its own clock.
//
// Stored in the App Group under HABITS_KEY, separate from the widget-set payload, because the
// extension writes it (button taps) while the app writes the widget specs.

import { addDays, daysBetween, isDayKey, localDayKey, type DayKey } from './calendarMaths.ts';

export const HABIT_KINDS = Object.freeze(['water', 'mood', 'sleep', 'steps'] as const);
export type HabitKind = (typeof HABIT_KINDS)[number];

export const HABITS_KEY = 'glaze.habits.v1';
export const HABITS_VERSION = 1;
/** Past days kept per tracker (a little over a year, enough for a year of dots). */
export const HABIT_HISTORY_DAYS = 400;

export type HabitDef = {
  kind: HabitKind;
  /** count: add up towards a goal. scale: pick a level (mood); 0 means "not logged yet". */
  mode: 'count' | 'scale';
  /** i18n key for the unit (resolved by the UI / extension). */
  unitKey: string;
  step: number;
  min: number;
  max: number;
  defaultGoal: number | null;
  /** Decimal places worth showing. */
  decimals: number;
};

export const HABIT_DEFS: Readonly<Record<HabitKind, HabitDef>> = Object.freeze({
  // T73: water counts millilitres (one tap = 150 ml), sleep adds a whole hour per tap (half hours
  // can still be set from the app). Nothing had written glaze.habits.v1 before T73, so there is no
  // stored "glasses" data to migrate.
  water: { kind: 'water', mode: 'count', unitKey: 'widgets.unit.ml', step: 150, min: 0, max: 10_000, defaultGoal: 2000, decimals: 0 },
  sleep: { kind: 'sleep', mode: 'count', unitKey: 'widgets.unit.hours', step: 1, min: 0, max: 24, defaultGoal: 8, decimals: 1 },
  steps: { kind: 'steps', mode: 'count', unitKey: 'widgets.unit.steps', step: 500, min: 0, max: 200_000, defaultGoal: 8000, decimals: 0 },
  mood: { kind: 'mood', mode: 'scale', unitKey: 'widgets.unit.mood', step: 1, min: 1, max: 5, defaultGoal: null, decimals: 0 },
} as Record<HabitKind, HabitDef>);

export const habitNameKey = (kind: HabitKind): string => `widgets.habit.${kind}`;
/** i18n key for a mood level 1–5 (accessibility label for the face glyph). */
export const moodLevelKey = (level: number): string => `widgets.mood.${level}`;

export type HabitState = {
  v: 1;
  kind: HabitKind;
  /** Count trackers only; null for mood. */
  goal: number | null;
  /** Amount one tap adds (count trackers). */
  step: number;
  /** Local day `value` belongs to. */
  day: DayKey;
  value: number;
  /** Earlier days: day key → that day's final value (0-value days are not stored). */
  history: Record<DayKey, number>;
};

export function isHabitKind(v: unknown): v is HabitKind {
  return typeof v === 'string' && (HABIT_KINDS as readonly string[]).includes(v);
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function clampValue(def: HabitDef, v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (def.mode === 'scale') {
    const r = Math.round(v);
    return r < def.min ? 0 : Math.min(def.max, r);
  }
  return round2(Math.min(def.max, Math.max(def.min, v)));
}

function cleanGoal(def: HabitDef, g: unknown): number | null {
  if (def.mode === 'scale') return null;
  if (typeof g !== 'number' || !Number.isFinite(g) || g <= 0) return def.defaultGoal;
  return round2(Math.min(def.max, g));
}

function cleanStep(def: HabitDef, s: unknown): number {
  if (def.mode === 'scale') return 1;
  if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) return def.step;
  return round2(Math.min(def.max, s));
}

export function createHabit(kind: HabitKind, now: Date, opts: { goal?: number; step?: number; utcOffsetMinutes?: number } = {}): HabitState {
  const def = HABIT_DEFS[kind];
  return { v: 1, kind, goal: cleanGoal(def, opts.goal), step: cleanStep(def, opts.step), day: localDayKey(now, opts.utcOffsetMinutes), value: 0, history: {} };
}

function trimHistory(history: Record<DayKey, number>, today: DayKey): Record<DayKey, number> {
  const out: Record<DayKey, number> = {};
  for (const k of Object.keys(history).sort()) {
    const age = daysBetween(k, today);
    // One day ahead is kept too: a clock or time-zone change can step back a day and forward again.
    if (age !== 0 && age >= -1 && age <= HABIT_HISTORY_DAYS) out[k] = history[k];
  }
  return out;
}

/**
 * Move to the local day of `now`. When the day has changed, today's value is filed under its day
 * and the new day starts at 0 (or at the value already filed for it, if the clock went back).
 * Returns the same object when nothing changes.
 */
export function rolloverHabit(state: HabitState, now: Date, utcOffsetMinutes?: number): HabitState {
  const today = localDayKey(now, utcOffsetMinutes);
  if (state.day === today) return state;
  const history = { ...state.history };
  if (state.value > 0) history[state.day] = state.value;
  else delete history[state.day];
  const value = history[today] ?? 0;
  delete history[today];
  return { ...state, day: today, value, history: trimHistory(history, today) };
}

/** Add `by` (default: the tracker's step) to today's value. Mood steps up a level (from unset → 1). */
export function incrementHabit(state: HabitState, now: Date, by?: number, utcOffsetMinutes?: number): HabitState {
  const s = rolloverHabit(state, now, utcOffsetMinutes);
  const def = HABIT_DEFS[s.kind];
  const amount = typeof by === 'number' && Number.isFinite(by) && by > 0 ? by : s.step;
  const value = def.mode === 'scale' ? (s.value === 0 ? def.min : clampValue(def, s.value + 1)) : clampValue(def, s.value + amount);
  return { ...s, value };
}

/** Take `by` (default: the step) off today's value, never below 0. Mood steps down; below 1 clears it. */
export function decrementHabit(state: HabitState, now: Date, by?: number, utcOffsetMinutes?: number): HabitState {
  const s = rolloverHabit(state, now, utcOffsetMinutes);
  const def = HABIT_DEFS[s.kind];
  const amount = typeof by === 'number' && Number.isFinite(by) && by > 0 ? by : s.step;
  const value = def.mode === 'scale' ? clampValue(def, s.value - 1) : clampValue(def, s.value - amount);
  return { ...s, value };
}

/** Set today's value (clamped; mood rounds to 1–5, anything below 1 clears it). */
export function setHabitValue(state: HabitState, now: Date, value: number, utcOffsetMinutes?: number): HabitState {
  const s = rolloverHabit(state, now, utcOffsetMinutes);
  return { ...s, value: clampValue(HABIT_DEFS[s.kind], value) };
}

/** Change the goal (count trackers; ignored for mood). Invalid goals reset to the default. */
export function setHabitGoal(state: HabitState, goal: number | null): HabitState {
  return { ...state, goal: cleanGoal(HABIT_DEFS[state.kind], goal) };
}

/** Today's value seen from `now` (0 when the stored day is stale). */
export function habitValueOn(state: HabitState, now: Date, utcOffsetMinutes?: number): number {
  return rolloverHabit(state, now, utcOffsetMinutes).value;
}

export type HabitProgress = { value: number; goal: number | null; fraction: number; done: boolean; logged: boolean };

/** Ring / bar level for today. Mood: fraction of the scale, done once logged. */
export function habitProgress(state: HabitState, now: Date, utcOffsetMinutes?: number): HabitProgress {
  const s = rolloverHabit(state, now, utcOffsetMinutes);
  const def = HABIT_DEFS[s.kind];
  if (def.mode === 'scale') {
    return { value: s.value, goal: null, fraction: s.value / def.max, done: s.value > 0, logged: s.value > 0 };
  }
  const goal = s.goal ?? def.defaultGoal ?? 1;
  return { value: s.value, goal, fraction: Math.min(1, s.value / goal), done: s.value >= goal, logged: s.value > 0 };
}

function metOn(state: HabitState, def: HabitDef, v: number | undefined): boolean {
  if (!v) return false;
  return def.mode === 'scale' ? v > 0 : v >= (state.goal ?? def.defaultGoal ?? 1);
}

/** Consecutive days the goal was met (mood: logged), counting today only once it is met. */
export function habitStreak(state: HabitState, now: Date, utcOffsetMinutes?: number): number {
  const s = rolloverHabit(state, now, utcOffsetMinutes);
  const def = HABIT_DEFS[s.kind];
  let n = metOn(s, def, s.value) ? 1 : 0;
  let day = addDays(s.day, -1);
  while (n <= HABIT_HISTORY_DAYS && metOn(s, def, s.history[day])) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** The last `days` days ending today, oldest first, with 0 for days without a value. */
export function habitHistory(state: HabitState, now: Date, days: number, utcOffsetMinutes?: number): { day: DayKey; value: number }[] {
  const s = rolloverHabit(state, now, utcOffsetMinutes);
  const n = Math.max(1, Math.min(HABIT_HISTORY_DAYS + 1, Math.floor(days)));
  const out: { day: DayKey; value: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDays(s.day, -i);
    out.push({ day, value: i === 0 ? s.value : s.history[day] ?? 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------------- intents

/** App Intent ids carried by widget buttons (the native buttons themselves are T73). */
export const WIDGET_INTENTS = Object.freeze({
  habitIncrement: 'glaze.habit.increment',
  habitDecrement: 'glaze.habit.decrement',
  habitSet: 'glaze.habit.set',
  albumNext: 'glaze.album.next',
  open: 'glaze.open',
} as const);
export type WidgetIntentId = (typeof WIDGET_INTENTS)[keyof typeof WIDGET_INTENTS];

export type WidgetIntent = { intent: WidgetIntentId; params: { habit?: HabitKind; by?: number; value?: number } };

/**
 * Apply a habit intent to the stored trackers (creating the tracker on first use). Unknown or
 * non-habit intents return the list unchanged. Pure.
 */
export function applyHabitIntent(states: readonly HabitState[], action: WidgetIntent, now: Date, utcOffsetMinutes?: number): HabitState[] {
  const kind = action?.params?.habit;
  const isHabit = action && (action.intent === WIDGET_INTENTS.habitIncrement || action.intent === WIDGET_INTENTS.habitDecrement || action.intent === WIDGET_INTENTS.habitSet);
  if (!isHabit || !isHabitKind(kind)) return [...states];
  const current = states.find((s) => s.kind === kind) ?? createHabit(kind, now, { utcOffsetMinutes });
  let next: HabitState;
  if (action.intent === WIDGET_INTENTS.habitIncrement) next = incrementHabit(current, now, action.params.by, utcOffsetMinutes);
  else if (action.intent === WIDGET_INTENTS.habitDecrement) next = decrementHabit(current, now, action.params.by, utcOffsetMinutes);
  else next = setHabitValue(current, now, typeof action.params.value === 'number' ? action.params.value : 0, utcOffsetMinutes);
  const out = states.filter((s) => s.kind !== kind);
  out.push(next);
  return sortHabits(out);
}

function sortHabits(list: HabitState[]): HabitState[] {
  return list.sort((a, b) => HABIT_KINDS.indexOf(a.kind) - HABIT_KINDS.indexOf(b.kind));
}

// ---------------------------------------------------------------------------------- payload

export function serialiseHabits(states: readonly HabitState[]): string {
  return JSON.stringify({
    v: HABITS_VERSION,
    habits: sortHabits([...states]).map((s) => ({ v: 1, kind: s.kind, goal: s.goal, step: s.step, day: s.day, value: s.value, history: s.history })),
  });
}

/** Tolerant parse of one tracker; null when the kind or day is unusable. */
export function parseHabitState(raw: unknown): HabitState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!isHabitKind(o.kind) || !isDayKey(o.day)) return null;
  const def = HABIT_DEFS[o.kind];
  const history: Record<DayKey, number> = {};
  if (o.history && typeof o.history === 'object' && !Array.isArray(o.history)) {
    for (const [k, v] of Object.entries(o.history as Record<string, unknown>)) {
      if (!isDayKey(k) || typeof v !== 'number') continue;
      const c = clampValue(def, v);
      if (c > 0) history[k] = c;
    }
  }
  return {
    v: 1,
    kind: o.kind,
    goal: cleanGoal(def, o.goal),
    step: cleanStep(def, o.step),
    day: o.day,
    value: clampValue(def, typeof o.value === 'number' ? o.value : 0),
    history: trimHistory(history, o.day),
  };
}

/** Tolerant parse of the HABITS_KEY payload: bad entries dropped, one tracker per kind. Never throws. */
export function parseHabits(input: unknown): HabitState[] {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return [];
    }
  }
  if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).v !== HABITS_VERSION) return [];
  const list = (raw as Record<string, unknown>).habits;
  if (!Array.isArray(list)) return [];
  const byKind = new Map<HabitKind, HabitState>();
  for (const item of list) {
    const s = parseHabitState(item);
    if (s && !byKind.has(s.kind)) byKind.set(s.kind, s);
  }
  return sortHabits([...byKind.values()]);
}
