// Daily goals for the habit trackers (T86; docs/WIDGETS.md "Interactive habit widgets").
//
// The person picks a daily goal per count tracker (water, sleep, steps; mood has none) on the
// Habit goals screen (app/habit-goals.tsx). Goals are the app's own setting, kept in AsyncStorage
// under HABIT_GOALS_KEY so they also work in Expo Go and on Android, where there is no App Group.
// In a full iOS build the app copies them into the trackers it writes to glaze.habits.v1
// (`syncHabitStoreWithGoals`), which is where the widget extension reads a tracker's goal
// (targets/widget/HabitStore.swift `goal`). The app stays the only writer of that key.
//
// Pure: nothing here reads the clock or storage.

import { HABIT_DEFS, HABIT_KINDS, createHabit, setHabitGoal, type HabitKind, type HabitState } from './habits.ts';
import { parseHabitsDoc, serialiseHabitsDoc, syncHabitStore, type HabitSyncResult, type HabitsDoc } from './habitLog.ts';

export const HABIT_GOALS_KEY = 'glaze.habitGoals.v1';
export const HABIT_GOALS_VERSION = 1;

/** Trackers that count towards a goal. */
export type GoalHabitKind = Exclude<HabitKind, 'mood'>;
export const GOAL_HABIT_KINDS: readonly GoalHabitKind[] = Object.freeze(
  HABIT_KINDS.filter((k): k is GoalHabitKind => HABIT_DEFS[k].mode === 'count'),
);

export type HabitGoalRange = { min: number; max: number; step: number };

/**
 * What the goal stepper offers. Wide enough for real routines, narrow enough that a goal can't be
 * set to something the widget meter can never show (0, or more than a tracker can hold).
 */
export const HABIT_GOAL_RANGES: Readonly<Record<GoalHabitKind, HabitGoalRange>> = Object.freeze({
  water: { min: 250, max: 6000, step: 250 },
  sleep: { min: 4, max: 14, step: 0.5 },
  steps: { min: 1000, max: 50_000, step: 500 },
});

/** Only goals the person changed are stored; a missing kind means "use the default". */
export type HabitGoals = Partial<Record<GoalHabitKind, number>>;

export function isGoalHabitKind(v: unknown): v is GoalHabitKind {
  return typeof v === 'string' && (GOAL_HABIT_KINDS as readonly string[]).includes(v);
}

export function defaultHabitGoal(kind: GoalHabitKind): number {
  return HABIT_DEFS[kind].defaultGoal ?? HABIT_GOAL_RANGES[kind].min;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Clamp into the kind's range and snap to its step. Non-numbers give the default. */
export function snapHabitGoal(kind: GoalHabitKind, value: number): number {
  const r = HABIT_GOAL_RANGES[kind];
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultHabitGoal(kind);
  const snapped = r.min + Math.round((value - r.min) / r.step) * r.step;
  return round2(Math.min(r.max, Math.max(r.min, snapped)));
}

export type HabitGoalCheck =
  | { ok: true; goal: number }
  | { ok: false; reason: 'notNumber' | 'tooLow' | 'tooHigh' };

/**
 * Validate a goal before it is stored. Out-of-range values are refused (the screen never sends
 * them: its stepper stops at the ends), in-range values are snapped to the step.
 */
export function checkHabitGoal(kind: GoalHabitKind, value: unknown): HabitGoalCheck {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, reason: 'notNumber' };
  const r = HABIT_GOAL_RANGES[kind];
  if (value < r.min) return { ok: false, reason: 'tooLow' };
  if (value > r.max) return { ok: false, reason: 'tooHigh' };
  return { ok: true, goal: snapHabitGoal(kind, value) };
}

/** The goal in force for a tracker: the person's own, else the default. */
export function habitGoalFor(goals: HabitGoals | null | undefined, kind: GoalHabitKind): number {
  const g = goals ? goals[kind] : undefined;
  return typeof g === 'number' && checkHabitGoal(kind, g).ok ? snapHabitGoal(kind, g) : defaultHabitGoal(kind);
}

/** One stepper press: the next goal up (+1) or down (-1), held at the ends of the range. */
export function stepHabitGoal(kind: GoalHabitKind, current: number, direction: 1 | -1): number {
  const r = HABIT_GOAL_RANGES[kind];
  const base = snapHabitGoal(kind, current);
  return snapHabitGoal(kind, base + (direction > 0 ? r.step : -r.step));
}

/** Whether a stepper press would change anything (to disable − at the minimum, + at the maximum). */
export function canStepHabitGoal(kind: GoalHabitKind, current: number, direction: 1 | -1): boolean {
  return stepHabitGoal(kind, current, direction) !== snapHabitGoal(kind, current);
}

/**
 * Set (or with null, reset) one tracker's goal. A goal equal to the default is not stored, so a
 * later change of default reaches everyone who never picked their own. Invalid goals leave the
 * map unchanged. Returns a new object.
 */
export function withHabitGoal(goals: HabitGoals, kind: GoalHabitKind, value: number | null): HabitGoals {
  const out: HabitGoals = { ...goals };
  if (value === null) {
    delete out[kind];
    return out;
  }
  const check = checkHabitGoal(kind, value);
  if (!check.ok) return out;
  if (check.goal === defaultHabitGoal(kind)) delete out[kind];
  else out[kind] = check.goal;
  return out;
}

/** Whether every tracker uses its default goal. */
export function allDefaultGoals(goals: HabitGoals): boolean {
  return GOAL_HABIT_KINDS.every((k) => habitGoalFor(goals, k) === defaultHabitGoal(k));
}

// ---------------------------------------------------------------------------------- payload

export function serialiseHabitGoals(goals: HabitGoals): string {
  const out: Record<string, number> = {};
  for (const k of GOAL_HABIT_KINDS) {
    const g = goals[k];
    if (typeof g === 'number' && checkHabitGoal(k, g).ok) out[k] = snapHabitGoal(k, g);
  }
  return JSON.stringify({ v: HABIT_GOALS_VERSION, goals: out });
}

/** Tolerant parse of HABIT_GOALS_KEY: unknown kinds and out-of-range goals dropped. Never throws. */
export function parseHabitGoals(input: unknown): HabitGoals {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  if (o.v !== HABIT_GOALS_VERSION || !o.goals || typeof o.goals !== 'object' || Array.isArray(o.goals)) return {};
  let out: HabitGoals = {};
  for (const [k, v] of Object.entries(o.goals as Record<string, unknown>)) {
    if (isGoalHabitKind(k) && typeof v === 'number') out = withHabitGoal(out, k, v);
  }
  return out;
}

// ---------------------------------------------------------------------------------- trackers

/**
 * Copy the goals into the trackers the widget extension reads. Existing count trackers get the
 * goal in force (the person's or the default); a tracker that doesn't exist yet is created (value
 * 0, today) only when the person picked their own goal, so the widget shows it before the first tap.
 */
export function applyHabitGoals(states: readonly HabitState[], goals: HabitGoals, now: Date, utcOffsetMinutes?: number): HabitState[] {
  const out: HabitState[] = states.map((s) => (isGoalHabitKind(s.kind) ? setHabitGoal(s, habitGoalFor(goals, s.kind)) : s));
  for (const k of GOAL_HABIT_KINDS) {
    if (goals[k] === undefined || out.some((s) => s.kind === k)) continue;
    out.push(createHabit(k, now, { goal: habitGoalFor(goals, k), utcOffsetMinutes }));
  }
  return out.sort((a, b) => HABIT_KINDS.indexOf(a.kind) - HABIT_KINDS.indexOf(b.kind));
}

/**
 * `syncHabitStore` (habitLog.ts) plus the goals: fold in the widget taps, set every tracker's goal,
 * and return the HABITS_KEY JSON to write back (null when it would be identical to what's stored).
 */
export function syncHabitStoreWithGoals(
  habitsRaw: string | null,
  logRaw: string | null,
  goals: HabitGoals,
  now: Date,
  utcOffsetMinutes?: number,
): HabitSyncResult {
  const base = syncHabitStore(habitsRaw, logRaw, now, utcOffsetMinutes);
  const next: HabitsDoc = { habits: applyHabitGoals(base.habits, goals, now, utcOffsetMinutes), applied: base.applied };
  const json = serialiseHabitsDoc(next);
  const before = serialiseHabitsDoc(parseHabitsDoc(habitsRaw));
  return { ...next, json: json === before ? null : json, appliedCount: base.appliedCount };
}
