// T96: copy hand-logged values from the app-only trackers (HABITS_LOCAL_KEY, used in Expo Go, on
// Android and in builds without the T73 bridge) into the App Group trackers (glaze.habits.v1) once,
// the first time a build with the bridge syncs. After that the App Group is the only store on iOS.
//
// Note: Expo Go and an installed build are different apps with separate storage, so values logged
// in Expo Go itself only carry over when both run in the same app (an older build of Glaze without
// the bridge updated to one with it). The copy is still safe to run everywhere: it never lowers a
// value and never runs twice (HABITS_MIGRATED_KEY).
//
// Merge rule, per tracker and per day: keep the higher value (mood: the App Group's face wins when
// both logged one). Trackers only in the local copy are added. Pure: every function takes `now`.

import { rolloverHabit, type HabitState } from './habits.ts';
import { parseHabitsDoc, serialiseHabitsDoc, type HabitSyncResult } from './habitLog.ts';
import { applyHabitGoals, syncHabitStoreWithGoals, type HabitGoals } from './habitGoals.ts';

/** Set (in AsyncStorage) once the local trackers have been copied into the App Group. */
export const HABITS_MIGRATED_KEY = 'glaze.habits.local.migrated.v1';

function mergeOne(a: HabitState, b: HabitState, mode: 'max' | 'keepA'): HabitState {
  const history: Record<string, number> = { ...b.history };
  for (const [day, v] of Object.entries(a.history)) {
    const other = history[day];
    history[day] = other === undefined || mode === 'keepA' ? v : Math.max(v, other);
  }
  const value = mode === 'keepA' && a.value > 0 ? a.value : Math.max(a.value, b.value);
  return { ...a, value, history };
}

/**
 * Native trackers + local trackers → merged, both rolled over to `now` first so they share a day.
 * Native settings (goal, step) win; local only fills what native lacks.
 */
export function mergeLocalHabits(native: readonly HabitState[], local: readonly HabitState[], now: Date, utcOffsetMinutes?: number): HabitState[] {
  const out: HabitState[] = native.map((s) => rolloverHabit(s, now, utcOffsetMinutes));
  for (const raw of local) {
    const l = rolloverHabit(raw, now, utcOffsetMinutes);
    const i = out.findIndex((s) => s.kind === l.kind);
    if (i < 0) out.push(l);
    else out[i] = mergeOne(out[i], l, l.kind === 'mood' ? 'keepA' : 'max');
  }
  return out;
}

/** True when the local copy holds anything worth copying (any value today or in history). */
export function hasLocalHabitValues(localRaw: string | null): boolean {
  return parseHabitsDoc(localRaw).habits.some((s) => s.value > 0 || Object.keys(s.history).length > 0);
}

/**
 * Full-build path: the App Group strings and the local copy in, widget taps folded in as a normal
 * sync, local values merged, and the glaze.habits.v1 JSON to write. `json` is null when nothing
 * changes (empty local copy and nothing to sync).
 */
export function migrateLocalHabitsInStore(
  habitsRaw: string | null,
  logRaw: string | null,
  localRaw: string | null,
  goals: HabitGoals,
  now: Date,
  utcOffsetMinutes?: number,
): HabitSyncResult {
  const base = syncHabitStoreWithGoals(habitsRaw, logRaw, goals, now, utcOffsetMinutes);
  const local = parseHabitsDoc(localRaw).habits;
  if (local.length === 0) return base;
  const habits = applyHabitGoals(mergeLocalHabits(base.habits, local, now, utcOffsetMinutes), goals, now, utcOffsetMinutes);
  const json = serialiseHabitsDoc({ habits, applied: base.applied });
  const before = serialiseHabitsDoc(parseHabitsDoc(habitsRaw));
  return { habits, applied: base.applied, json: json === before ? null : json, appliedCount: base.appliedCount };
}
