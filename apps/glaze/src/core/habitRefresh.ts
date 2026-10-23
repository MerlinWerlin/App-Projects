// T95: what the in-app habit cache becomes after one App Group sync (src/store/widgetHabits.ts
// refreshWidgetHabits). Pure, no React Native imports.
//
// The bug this fixes: when the native read threw, the adapter answered
// { available: true, ok: false, habits: [] } and the store replaced the cached trackers with that
// empty list, so values the person had just logged vanished from the cards until the next good
// read. Now the adapter says whether the App Group was actually read (`read`), and a failed read
// keeps whatever the cache already shows.

import type { HabitState } from './habits.ts';

/** The parts of a native sync result this decision needs (src/native/widgets.ts HabitsSyncResult). */
export type HabitSyncOutcome = {
  available: boolean;
  /** False when the App Group could not be read (the native call threw). Absent = read. */
  read?: boolean;
  habits: readonly HabitState[];
};

/**
 * - not available (Expo Go, Android, older bridge): use the app-only trackers ('local');
 * - available but the read failed: keep the cached trackers;
 * - available and read: the trackers that were read (even when writing them back failed, the read
 *   values are still the truth).
 */
export function habitsAfterSync(
  cached: readonly HabitState[],
  r: HabitSyncOutcome,
): { source: 'local' } | { source: 'native' | 'cache'; habits: HabitState[] } {
  if (!r.available) return { source: 'local' };
  if (r.read === false) return { source: 'cache', habits: [...cached] };
  return { source: 'native', habits: [...r.habits] };
}
