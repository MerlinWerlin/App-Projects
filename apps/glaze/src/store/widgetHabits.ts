// T73: today's habit values logged with the interactive habit widgets (docs/WIDGETS.md
// "Interactive habit widgets"). Reads the App Group through src/native/widgets.ts `syncHabits`
// when a screen mounts and whenever the app comes back to the foreground, so taps made on the
// Home Screen show up in the in-app previews. In Expo Go, on Android and in builds without the
// T73 bridge it reports `available: false` and no values; previews then show 0.
//
// T86: also the person's daily goals (Habit goals screen, app/habit-goals.tsx). Goals live in
// AsyncStorage (HABIT_GOALS_KEY) so they work everywhere, including Expo Go; every sync copies them
// into the App Group trackers, where the widget extension reads them.
//
// T89: `logWidgetHabit` logs one tap made in the app (the value button under a Widgets tab habit
// card). Full iOS build: the tap goes into the app's own App Group trackers (glaze.habits.v1)
// through widgets.logHabit; the extension's tap log is never written (one writer per key). Expo Go,
// Android and builds without the bridge keep the same trackers in AsyncStorage (HABITS_LOCAL_KEY),
// so hand-logged values show on the cards there too. Native reads and writes run one at a time.
//
// T96: the first sync in a build with the bridge copies those app-only values into the App Group
// once (src/core/habitMigrate.ts), so nothing logged before the bridge existed is lost.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { habitValueOn, type HabitKind, type HabitState } from '../core/habits';
import {
  HABITS_LOCAL_KEY,
  applyHabitTap,
  applyHabitUndo,
  canTapHabit,
  canUndoHabitTap,
  logHabitTapLocal,
  logHabitUndoLocal,
  readLocalHabits,
} from '../core/habitTap';
import {
  HABIT_GOALS_KEY,
  habitGoalFor,
  isGoalHabitKind,
  parseHabitGoals,
  serialiseHabitGoals,
  withHabitGoal,
  type GoalHabitKind,
  type HabitGoals,
} from '../core/habitGoals';
import { habitsAfterSync } from '../core/habitRefresh';
import { HABITS_MIGRATED_KEY, hasLocalHabitValues } from '../core/habitMigrate';
import { widgets } from '../native/widgets';

export type WidgetHabits = {
  /** null while the first read is in flight. */
  available: boolean | null;
  habits: HabitState[];
  /** The person's own goals (only the ones they changed). */
  goals: HabitGoals;
  /** False until the stored goals have been read. */
  goalsLoaded: boolean;
};

let cache: WidgetHabits = { available: null, habits: [], goals: {}, goalsLoaded: false };
let inFlight: Promise<WidgetHabits> | null = null;
/** A goal changed while a sync was running: run one more so the App Group gets the new goal. */
let again = false;
let goalsRead: Promise<HabitGoals> | null = null;
const listeners = new Set<(v: WidgetHabits) => void>();
/** T89: the app-only trackers (no App Group), read once per launch. */
let localRead: Promise<string | null> | null = null;
/** T89: native sync / log calls run one after another so a write never overwrites a newer one. */
let queue: Promise<unknown> = Promise.resolve();
/** T89: in-app taps not written yet; results that arrive meanwhile don't undo the shown value. */
let pendingTaps = 0;

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p;
}

function readLocalRaw(): Promise<string | null> {
  if (!localRead) localRead = AsyncStorage.getItem(HABITS_LOCAL_KEY).catch((): string | null => null);
  return localRead;
}

async function localHabits(): Promise<HabitState[]> {
  return readLocalHabits(await readLocalRaw(), new Date());
}

function publish(next: WidgetHabits): void {
  cache = next;
  for (const l of listeners) l(next);
}

/** Read the stored goals once per launch. Never throws; unreadable storage means "defaults". */
function loadGoals(): Promise<HabitGoals> {
  if (!goalsRead) {
    goalsRead = AsyncStorage.getItem(HABIT_GOALS_KEY)
      .then((raw: string | null) => parseHabitGoals(raw))
      .catch((): HabitGoals => ({}))
      .then((goals) => {
        // A goal set before the read finished wins over the stored one.
        const merged: HabitGoals = cache.goalsLoaded ? cache.goals : goals;
        publish({ ...cache, goals: merged, goalsLoaded: true });
        return merged;
      });
  }
  return goalsRead;
}

/** T96: the one-time copy of the app-only trackers into the App Group, at most once per launch. */
let migration: Promise<void> | null = null;

/**
 * T96: on the first launch of a build with the App Group bridge, copy values logged by hand while
 * there was no App Group (HABITS_LOCAL_KEY) into it, once (HABITS_MIGRATED_KEY). Expo Go, Android
 * and older builds do nothing here and try again next launch. Never throws.
 */
function migrateLocalOnce(): Promise<void> {
  if (!migration) {
    migration = (async () => {
      try {
        if ((await AsyncStorage.getItem(HABITS_MIGRATED_KEY)) === '1') return;
        const status = await widgets.isAvailable();
        if (!status.available) return;
        const raw = await readLocalRaw();
        if (hasLocalHabitValues(raw)) {
          const r = await serial(() => widgets.migrateLocalHabits(raw, new Date(), cache.goals));
          if (!r.available || !r.ok) return;
        }
        await AsyncStorage.setItem(HABITS_MIGRATED_KEY, '1');
      } catch {
        // Try again next launch.
      }
    })();
  }
  return migration;
}

/** One sync at a time; every mounted hook gets the result. Never throws. */
export function refreshWidgetHabits(): Promise<WidgetHabits> {
  if (inFlight) {
    again = true;
    return inFlight;
  }
  again = false;
  inFlight = loadGoals()
    .then(() => migrateLocalOnce())
    .then(() => serial(() => widgets.syncHabits(new Date(), cache.goals)))
    .then(
      async (r): Promise<Pick<WidgetHabits, 'available' | 'habits'>> => {
        // T95: a failed App Group read keeps what the cards already show (never an empty list).
        const next = habitsAfterSync(cache.habits, r);
        return next.source === 'local' ? { available: false, habits: await localHabits() } : { available: true, habits: next.habits };
      },
    )
    .catch((): Pick<WidgetHabits, 'available' | 'habits'> => ({ available: false, habits: cache.habits }))
    .then((part) => {
      inFlight = null;
      // A tap still being written keeps its value on screen; its own result publishes it.
      publish(pendingTaps > 0 ? { ...cache, available: part.available } : { ...cache, ...part });
      if (again) void refreshWidgetHabits();
      return cache;
    });
  return inFlight;
}

/**
 * T86: set one tracker's daily goal (null resets it to the default). Updates every screen straight
 * away, stores it, then syncs so the Home Screen widget shows it (full iOS build only).
 */
export async function setWidgetHabitGoal(kind: GoalHabitKind, goal: number | null): Promise<void> {
  await loadGoals();
  const goals = withHabitGoal(cache.goals, kind, goal);
  publish({ ...cache, goals, goalsLoaded: true });
  try {
    await AsyncStorage.setItem(HABIT_GOALS_KEY, serialiseHabitGoals(goals));
  } catch {
    // Storage unavailable: the goal holds for this session only.
  }
  void refreshWidgetHabits();
}

/**
 * T89: log one tap made in the app: water +150 ml, sleep +1 h, steps +500 (the tracker's step),
 * mood to the next face (src/core/habitTap.ts). The new value shows straight away. Resolves to
 * false when the tap changed nothing (tracker already at its maximum) or could not be saved, true
 * otherwise. Never throws. T94: with `undo`, one step comes off instead (undoWidgetHabit).
 */
export async function logWidgetHabit(kind: HabitKind, undo = false): Promise<boolean> {
  await loadGoals();
  const now = new Date();
  if (undo ? !canUndoHabitTap(cache.habits, kind, now) : !canTapHabit(cache.habits, kind, now)) return false;
  pendingTaps++;
  publish({ ...cache, habits: undo ? applyHabitUndo(cache.habits, kind, now, cache.goals) : applyHabitTap(cache.habits, kind, now, cache.goals) });
  let saved = false;
  try {
    saved = await serial(async (): Promise<boolean> => {
      const r = await widgets.logHabit(kind, now, cache.goals, undo);
      if (r.available) {
        if (r.ok && pendingTaps === 1) publish({ ...cache, available: true, habits: r.habits });
        return r.ok;
      }
      const localRaw = await readLocalRaw();
      const next = undo ? logHabitUndoLocal(localRaw, cache.goals, kind, now) : logHabitTapLocal(localRaw, cache.goals, kind, now);
      localRead = Promise.resolve(next.json);
      if (pendingTaps === 1) publish({ ...cache, available: false, habits: next.habits });
      try {
        await AsyncStorage.setItem(HABITS_LOCAL_KEY, next.json);
      } catch {
        // Storage unavailable: the value holds for this session only.
      }
      return true;
    });
  } catch {
    saved = false;
  } finally {
    pendingTaps--;
  }
  // Not saved: read back what is really stored so the card doesn't show a value that isn't.
  if (!saved && pendingTaps === 0) void refreshWidgetHabits();
  return saved;
}

/**
 * T94: take one step off (long-press on the Widgets tab log button): water −150 ml, sleep −1 h,
 * steps −500, mood one face back (Awful clears it). False when there was nothing to undo.
 */
export function undoWidgetHabit(kind: HabitKind): Promise<boolean> {
  return logWidgetHabit(kind, true);
}

export function useWidgetHabits(): WidgetHabits {
  const [state, setState] = useState<WidgetHabits>(cache);
  useEffect(() => {
    listeners.add(setState);
    setState(cache);
    refreshWidgetHabits().catch(() => undefined);
    // T264: the return-to-app handler is try-wrapped and its refresh can never reject unhandled.
    let sub: { remove: () => void } | null = null;
    try {
      sub = AppState.addEventListener('change', (s: AppStateStatus) => {
        try {
          if (s === 'active') refreshWidgetHabits().catch(() => undefined);
        } catch {
          // Never let a foreground refresh close the app.
        }
      });
    } catch {
      sub = null;
    }
    return () => {
      listeners.delete(setState);
      try {
        sub?.remove();
      } catch {
        // Already removed.
      }
    };
  }, []);
  return state;
}

/**
 * Today's value for one tracker, or undefined when nothing is logged yet. T89: in Expo Go and on
 * Android this is what was logged by hand in the app (HABITS_LOCAL_KEY).
 */
export function widgetHabitValue(state: WidgetHabits, kind: HabitKind | null | undefined, now: Date = new Date()): number | undefined {
  if (!kind) return undefined;
  const s = state.habits.find((h) => h.kind === kind);
  return s ? habitValueOn(s, now) : undefined;
}

/** T86: the daily goal in force for a tracker (the person's or the default); undefined for mood. */
export function widgetHabitGoal(state: WidgetHabits, kind: HabitKind | null | undefined): number | undefined {
  return kind && isGoalHabitKind(kind) ? habitGoalFor(state.goals, kind) : undefined;
}
