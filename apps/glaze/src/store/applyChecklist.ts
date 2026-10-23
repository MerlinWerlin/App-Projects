// T61: the theme detail's apply checklist, kept on this phone with AsyncStorage: one record per
// theme under CHECKLIST_STORAGE_KEY. Parsing and tick logic live in src/core/applyChecklist.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHECKLIST_STORAGE_KEY,
  parseChecklist,
  parseChecklistStore,
  storeWith,
  tickInStore,
  type ChecklistState,
  type ChecklistTask,
} from '../core/applyChecklist';

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<Record<string, unknown>> {
  try {
    return parseChecklistStore(await AsyncStorage.getItem(CHECKLIST_STORAGE_KEY));
  } catch {
    return {};
  }
}

/** The saved checklist for a theme, or a fresh one. Never throws. */
export function loadChecklist(themeId: string): Promise<ChecklistState> {
  return serial(async () => parseChecklist((await readAll())[themeId] ?? null, themeId));
}

/**
 * T81: tick one task in a theme's stored checklist from another screen (the wallpaper maker's
 * Lock + Home pair, Widget Studio's save). Best effort, never throws; true when the tick is stored.
 */
export function tickStoredChecklist(themeId: string, task: ChecklistTask): Promise<boolean> {
  return serial(async () => {
    try {
      const store = await readAll();
      const next = tickInStore(store, themeId, task, Date.now());
      if (next !== store) await AsyncStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  });
}

/** Save a theme's checklist. Best effort: a failed write keeps the in-memory state. */
export function saveChecklist(state: ChecklistState): Promise<boolean> {
  return serial(async () => {
    try {
      await AsyncStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(storeWith(await readAll(), state)));
      return true;
    } catch {
      return false;
    }
  });
}
