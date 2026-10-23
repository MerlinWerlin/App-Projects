// T89: log a habit by hand in the app (tap the value under a habit card on the Widgets tab).
//
// One tap = one step of the tracker: water +150 ml, sleep +1 h, steps +500 (each tracker's own
// `step`, else the HABIT_DEFS default), mood moves to the next face and wraps from Great back to
// Awful (an unlogged mood starts at Awful, as the widget's "raise mood" button does).
//
// Single writer per key (docs/WIDGETS.md "Interactive habit widgets"): the app is the only writer
// of `glaze.habits.v1`, the widget extension the only writer of `glaze.habitLog.v1`. A tap in the
// app therefore goes straight into the app's trackers, never into the extension's log:
// `logHabitTapInStore` first folds in the widget taps exactly like a normal sync (so the `applied`
// mark only moves over taps it has applied), then adds the in-app tap, and returns the
// glaze.habits.v1 JSON to write. Widget taps logged after the read keep a higher seq and are
// applied on the next sync, so nothing is lost or counted twice.
//
// Where the App Group is missing (Expo Go, Android, a build without the T73 bridge) the app keeps
// the same document in AsyncStorage under HABITS_LOCAL_KEY instead (src/store/widgetHabits.ts).
// Pure: every function takes `now`.

import { HABIT_DEFS, applyHabitIntent, habitValueOn, rolloverHabit, WIDGET_INTENTS, type HabitKind, type HabitState, type WidgetIntent } from './habits.ts';
import { parseHabitsDoc, serialiseHabitsDoc, type HabitSyncResult } from './habitLog.ts';
import { applyHabitGoals, syncHabitStoreWithGoals, type HabitGoals } from './habitGoals.ts';

/** App-only copy of the trackers when there is no App Group (same format as HABITS_KEY). */
export const HABITS_LOCAL_KEY = 'glaze.habits.local.v1';

/** The amount one tap adds to a count tracker (its own step, else the default); 1 level for mood. */
export function habitTapStep(states: readonly HabitState[], kind: HabitKind): number {
  const def = HABIT_DEFS[kind];
  if (def.mode === 'scale') return 1;
  const s = states.find((x) => x.kind === kind);
  return s && Number.isFinite(s.step) && s.step > 0 ? s.step : def.step;
}

/** Today's value for a tracker (0 when it has never been logged or the stored day is stale). */
export function habitTodayFrom(states: readonly HabitState[], kind: HabitKind, now: Date, utcOffsetMinutes?: number): number {
  const s = states.find((x) => x.kind === kind);
  return s ? habitValueOn(s, now, utcOffsetMinutes) : 0;
}

/**
 * Today's value after one tap. Count trackers add one step and stop at the tracker's maximum;
 * mood goes 0 → 1 → … → 5 → 1.
 */
export function nextHabitTapValue(states: readonly HabitState[], kind: HabitKind, now: Date, utcOffsetMinutes?: number): number {
  const def = HABIT_DEFS[kind];
  const value = habitTodayFrom(states, kind, now, utcOffsetMinutes);
  if (def.mode === 'scale') return value >= def.max || value < def.min ? def.min : value + 1;
  const next = Math.round((value + habitTapStep(states, kind)) * 100) / 100;
  return Math.min(def.max, next);
}

/** False when a tap would change nothing (a count tracker already at its maximum). */
export function canTapHabit(states: readonly HabitState[], kind: HabitKind, now: Date, utcOffsetMinutes?: number): boolean {
  return nextHabitTapValue(states, kind, now, utcOffsetMinutes) !== habitTodayFrom(states, kind, now, utcOffsetMinutes);
}

/** The habit intent one tap stands for (the same intents the widget buttons carry). */
export function habitTapIntent(states: readonly HabitState[], kind: HabitKind, now: Date, utcOffsetMinutes?: number): WidgetIntent {
  if (HABIT_DEFS[kind].mode === 'scale') {
    return { intent: WIDGET_INTENTS.habitSet, params: { habit: kind, value: nextHabitTapValue(states, kind, now, utcOffsetMinutes) } };
  }
  return { intent: WIDGET_INTENTS.habitIncrement, params: { habit: kind, by: habitTapStep(states, kind) } };
}

/**
 * The trackers after one tap (creating the tracker on first use, every tracker rolled over to
 * `now`). With `goals`, a tracker created here gets the person's goal.
 */
export function applyHabitTap(states: readonly HabitState[], kind: HabitKind, now: Date, goals?: HabitGoals, utcOffsetMinutes?: number): HabitState[] {
  const tapped = applyHabitIntent(states, habitTapIntent(states, kind, now, utcOffsetMinutes), now, utcOffsetMinutes).map((s) => rolloverHabit(s, now, utcOffsetMinutes));
  return goals ? applyHabitGoals(tapped, goals, now, utcOffsetMinutes) : tapped;
}

/**
 * Full-build path: both raw App Group strings in (glaze.habits.v1, glaze.habitLog.v1), widget taps
 * folded in, the in-app tap added, and the glaze.habits.v1 JSON to write back. The extension's log
 * is never written. `json` is null only when the tap changed nothing (tracker at its maximum) and
 * the sync had nothing to write either.
 */
export function logHabitTapInStore(
  habitsRaw: string | null,
  logRaw: string | null,
  goals: HabitGoals,
  kind: HabitKind,
  now: Date,
  utcOffsetMinutes?: number,
): HabitSyncResult {
  const base = syncHabitStoreWithGoals(habitsRaw, logRaw, goals, now, utcOffsetMinutes);
  const habits = applyHabitTap(base.habits, kind, now, goals, utcOffsetMinutes);
  const json = serialiseHabitsDoc({ habits, applied: base.applied });
  const before = serialiseHabitsDoc(parseHabitsDoc(habitsRaw));
  return { habits, applied: base.applied, json: json === before ? null : json, appliedCount: base.appliedCount };
}

/** Expo Go / Android path: the app-only document under HABITS_LOCAL_KEY after one tap. */
export function logHabitTapLocal(localRaw: string | null, goals: HabitGoals, kind: HabitKind, now: Date, utcOffsetMinutes?: number): { habits: HabitState[]; json: string } {
  const doc = parseHabitsDoc(localRaw);
  const habits = applyHabitTap(doc.habits, kind, now, goals, utcOffsetMinutes);
  return { habits, json: serialiseHabitsDoc({ habits, applied: null }) };
}

/** The app-only trackers, rolled over to today. Never throws. */
export function readLocalHabits(localRaw: string | null, now: Date, utcOffsetMinutes?: number): HabitState[] {
  return parseHabitsDoc(localRaw).habits.map((s) => rolloverHabit(s, now, utcOffsetMinutes));
}

// ------------------------------------------------------------------------------------- undo (T94)
// Long-press (or the VoiceOver "decrement" action) on the log button takes one step off: count
// trackers lose one step (never below 0), mood moves back one face and Awful clears it. Undo is a
// new write like a tap, so the single-writer rule holds: only glaze.habits.v1 (or the app-only
// copy) changes; widget taps are folded in first exactly as for a tap.

/** False when there is nothing to take off today (value 0 / mood not logged). */
export function canUndoHabitTap(states: readonly HabitState[], kind: HabitKind, now: Date, utcOffsetMinutes?: number): boolean {
  return habitTodayFrom(states, kind, now, utcOffsetMinutes) > 0;
}

/** Today's value after one undo: count trackers minus one step (floor 0); mood one face down (1 → 0). */
export function previousHabitTapValue(states: readonly HabitState[], kind: HabitKind, now: Date, utcOffsetMinutes?: number): number {
  const def = HABIT_DEFS[kind];
  const value = habitTodayFrom(states, kind, now, utcOffsetMinutes);
  if (def.mode === 'scale') return value <= def.min ? 0 : value - 1;
  return Math.max(0, Math.round((value - habitTapStep(states, kind)) * 100) / 100);
}

/** The trackers after one undo; unchanged (but rolled over) when there is nothing to undo. */
export function applyHabitUndo(states: readonly HabitState[], kind: HabitKind, now: Date, goals?: HabitGoals, utcOffsetMinutes?: number): HabitState[] {
  const rolled = states.map((s) => rolloverHabit(s, now, utcOffsetMinutes));
  if (!canUndoHabitTap(rolled, kind, now, utcOffsetMinutes)) return goals ? applyHabitGoals(rolled, goals, now, utcOffsetMinutes) : rolled;
  const intent: WidgetIntent = { intent: WIDGET_INTENTS.habitSet, params: { habit: kind, value: previousHabitTapValue(rolled, kind, now, utcOffsetMinutes) } };
  const next = applyHabitIntent(rolled, intent, now, utcOffsetMinutes).map((s) => rolloverHabit(s, now, utcOffsetMinutes));
  return goals ? applyHabitGoals(next, goals, now, utcOffsetMinutes) : next;
}

/** Full-build path for an undo (see logHabitTapInStore). */
export function logHabitUndoInStore(
  habitsRaw: string | null,
  logRaw: string | null,
  goals: HabitGoals,
  kind: HabitKind,
  now: Date,
  utcOffsetMinutes?: number,
): HabitSyncResult {
  const base = syncHabitStoreWithGoals(habitsRaw, logRaw, goals, now, utcOffsetMinutes);
  const habits = applyHabitUndo(base.habits, kind, now, goals, utcOffsetMinutes);
  const json = serialiseHabitsDoc({ habits, applied: base.applied });
  const before = serialiseHabitsDoc(parseHabitsDoc(habitsRaw));
  return { habits, applied: base.applied, json: json === before ? null : json, appliedCount: base.appliedCount };
}

/** Expo Go / Android path for an undo (see logHabitTapLocal). */
export function logHabitUndoLocal(localRaw: string | null, goals: HabitGoals, kind: HabitKind, now: Date, utcOffsetMinutes?: number): { habits: HabitState[]; json: string } {
  const doc = parseHabitsDoc(localRaw);
  const habits = applyHabitUndo(doc.habits, kind, now, goals, utcOffsetMinutes);
  return { habits, json: serialiseHabitsDoc({ habits, applied: null }) };
}
