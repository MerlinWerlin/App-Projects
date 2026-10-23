// Widgets bridge adapter (docs/WIDGETS.md, PLAN §3). The native module `GlazeWidgetBridge`
// (modules/glaze-widget-bridge) exists only in an iOS development/production build. Everywhere
// else, including Expo Go and Android, every call is a no-op returning { available: false }.
// Never throws.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { serializeWidgetTheme, type WidgetTheme } from '../core/widgetTheme';
import { syncHabitStore, type HabitSyncResult } from '../core/habitLog';
import { syncHabitStoreWithGoals, type HabitGoals } from '../core/habitGoals';
import type { HabitKind, HabitState } from '../core/habits';
import { logHabitTapInStore, logHabitUndoInStore } from '../core/habitTap';
import { migrateLocalHabitsInStore } from '../core/habitMigrate';

export type WidgetsReason = 'expo-go' | 'android' | 'not-built' | 'failed' | null;
export type WidgetsResult = { available: boolean; ok: boolean; reason: WidgetsReason };
/** T73: trackers after folding in the taps made on the interactive habit widgets. */
export type HabitsSyncResult = WidgetsResult & {
  habits: HabitState[];
  appliedCount: number;
  /** T95: false when the App Group read threw; `habits` is then empty and must not replace a cache. */
  read?: boolean;
};

export interface WidgetsAdapter {
  isAvailable(): Promise<{ available: boolean; reason: WidgetsReason }>;
  /** Write the active theme to the App Group and reload widget timelines. */
  setTheme(theme: WidgetTheme): Promise<WidgetsResult>;
  /** Copy a local image (file:// URI) into the App Group for the Photo widget. */
  setPhoto(uri: string): Promise<WidgetsResult>;
  clearPhoto(): Promise<WidgetsResult>;
  /**
   * T59: write a widget-set payload (src/core/widgetStudio.ts `studioPayload`) to App Group key
   * `glaze.widgets.v2` and reload timelines. A build whose bridge predates T59 reports
   * { available: false, reason: 'not-built' }.
   */
  setWidgetSet(json: string): Promise<WidgetsResult>;
  /**
   * T73: read the habit trackers and the widget tap log from the App Group, fold new taps in
   * (src/core/habitLog.ts syncHabitStore) and write the trackers back when they changed.
   * Expo Go / Android / a build whose bridge predates T73: { available: false, habits: [] }.
   * T86: with `goals` (src/core/habitGoals.ts), every tracker's daily goal is written too, which is
   * where the widget extension reads it.
   */
  syncHabits(now?: Date, goals?: HabitGoals): Promise<HabitsSyncResult>;
  /**
   * T89: log one tap made in the app (Widgets tab habit card). Same read as syncHabits, then the
   * tap is added to the app's trackers (src/core/habitTap.ts logHabitTapInStore) and only
   * glaze.habits.v1 is written; the extension's tap log is never touched (one writer per key).
   * Expo Go / Android / older bridge: { available: false, habits: [] } and nothing is written.
   * T94: `undo` takes one step off instead (src/core/habitTap.ts logHabitUndoInStore).
   */
  logHabit(kind: HabitKind, now?: Date, goals?: HabitGoals, undo?: boolean): Promise<HabitsSyncResult>;
  /**
   * T96: copy the app-only trackers (HABITS_LOCAL_KEY JSON, src/core/habitMigrate.ts) into the App
   * Group once; never lowers a value. Expo Go / Android / older bridge: { available: false }.
   */
  migrateLocalHabits(localRaw: string | null, now?: Date, goals?: HabitGoals): Promise<HabitsSyncResult>;
}

/** Shape exposed by modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift. */
type NativeBridge = {
  setTheme(json: string): Promise<boolean>;
  setPhoto(uri: string): Promise<boolean>;
  clearPhoto?(): Promise<boolean>;
  setWidgetSet?(json: string): Promise<boolean>;
  getHabits?(): Promise<{ habits?: string | null; log?: string | null } | null>;
  setHabits?(json: string): Promise<boolean>;
};

function isExpoGo(): boolean {
  try {
    return (
      String(Constants.executionEnvironment) === 'storeClient' ||
      String((Constants as { appOwnership?: unknown }).appOwnership) === 'expo'
    );
  } catch {
    return false;
  }
}

let cached: NativeBridge | null | undefined;

function loadNative(): NativeBridge | null {
  if (cached !== undefined) return cached;
  let found: NativeBridge | null = null;
  try {
    const mod =
      typeof requireOptionalNativeModule === 'function'
        ? requireOptionalNativeModule<NativeBridge>('GlazeWidgetBridge')
        : null;
    found = mod && typeof mod.setTheme === 'function' && typeof mod.setPhoto === 'function' ? mod : null;
  } catch {
    found = null;
  }
  cached = found;
  return found;
}

async function isAvailable(): Promise<{ available: boolean; reason: WidgetsReason }> {
  try {
    if (Platform.OS !== 'ios') return { available: false, reason: 'android' };
    if (isExpoGo()) return { available: false, reason: 'expo-go' };
    if (!loadNative()) return { available: false, reason: 'not-built' };
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'not-built' };
  }
}

async function run(call: (mod: NativeBridge) => Promise<boolean> | undefined): Promise<WidgetsResult> {
  try {
    const status = await isAvailable();
    const mod = status.available ? loadNative() : null;
    if (!mod) return { available: false, ok: false, reason: status.reason };
    const ok = (await call(mod)) === true;
    return { available: true, ok, reason: ok ? null : 'failed' };
  } catch {
    return { available: true, ok: false, reason: 'failed' };
  }
}

/**
 * One read-compute-write round on the App Group habit keys. `compute` gets both raw strings and
 * returns the trackers plus the glaze.habits.v1 JSON to write (null = nothing to write).
 */
async function habitStoreRound(compute: (habitsRaw: string | null, logRaw: string | null) => HabitSyncResult): Promise<HabitsSyncResult> {
  const none = (reason: WidgetsReason, available = false): HabitsSyncResult => ({ available, ok: false, reason, habits: [], appliedCount: 0 });
  try {
    const status = await isAvailable();
    const mod = status.available ? loadNative() : null;
    if (!mod) return none(status.reason);
    if (typeof mod.getHabits !== 'function' || typeof mod.setHabits !== 'function') return none('not-built');
    const raw = await mod.getHabits();
    const habitsRaw = raw && typeof raw.habits === 'string' ? raw.habits : null;
    const logRaw = raw && typeof raw.log === 'string' ? raw.log : null;
    const result = compute(habitsRaw, logRaw);
    const ok = result.json === null ? true : (await mod.setHabits(result.json)) === true;
    return { available: true, ok, reason: ok ? null : 'failed', habits: result.habits, appliedCount: result.appliedCount };
  } catch {
    // T95: nothing trustworthy was read; callers keep what they already show.
    return { ...none('failed', true), read: false };
  }
}

function syncHabits(now: Date = new Date(), goals?: HabitGoals): Promise<HabitsSyncResult> {
  return habitStoreRound((habitsRaw, logRaw) =>
    goals ? syncHabitStoreWithGoals(habitsRaw, logRaw, goals, now) : syncHabitStore(habitsRaw, logRaw, now),
  );
}

function logHabit(kind: HabitKind, now: Date = new Date(), goals: HabitGoals = {}, undo = false): Promise<HabitsSyncResult> {
  return habitStoreRound((habitsRaw, logRaw) =>
    undo ? logHabitUndoInStore(habitsRaw, logRaw, goals, kind, now) : logHabitTapInStore(habitsRaw, logRaw, goals, kind, now),
  );
}

function migrateLocalHabits(localRaw: string | null, now: Date = new Date(), goals: HabitGoals = {}): Promise<HabitsSyncResult> {
  return habitStoreRound((habitsRaw, logRaw) => migrateLocalHabitsInStore(habitsRaw, logRaw, localRaw, goals, now));
}

export const widgets: WidgetsAdapter = {
  isAvailable,
  setTheme: (theme) => run((mod) => mod.setTheme(serializeWidgetTheme(theme))),
  setPhoto: (uri) => run((mod) => mod.setPhoto(uri)),
  clearPhoto: () => run((mod) => mod.clearPhoto?.()),
  setWidgetSet: async (json) => {
    const mod = (await isAvailable()).available ? loadNative() : null;
    if (mod && typeof mod.setWidgetSet !== 'function') return { available: false, ok: false, reason: 'not-built' };
    return run((m) => m.setWidgetSet?.(json));
  },
  syncHabits,
  logHabit,
  migrateLocalHabits,
};
