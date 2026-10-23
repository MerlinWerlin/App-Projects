// Widget Studio drafts (T59), kept on this phone with AsyncStorage: one entry per theme under
// STUDIO_STORAGE_KEY. Parsing/validation lives in src/core/widgetStudio.ts (tested in Node).
// Photos referenced here are our own documents-folder copies; nothing leaves the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetSet } from '../core/widgetSets';
import {
  STUDIO_STORAGE_KEY,
  parseStudioState,
  parseStudioStore,
  serialiseStudioState,
  type StudioState,
} from '../core/widgetStudio';

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<Record<string, unknown>> {
  try {
    return parseStudioStore(await AsyncStorage.getItem(STUDIO_STORAGE_KEY));
  } catch {
    return {};
  }
}

/** The saved studio for a theme's set, or a fresh one. Never throws. */
export function loadStudio(set: WidgetSet): Promise<StudioState> {
  return serial(async () => {
    const all = await readAll();
    return parseStudioState(all[set.themeId] ?? null, set);
  });
}

/** Save a theme's studio. Best effort: a failed write keeps the in-memory draft. */
export function saveStudio(state: StudioState): Promise<boolean> {
  return serial(async () => {
    try {
      const all = await readAll();
      all[state.themeId] = JSON.parse(serialiseStudioState(state)) as unknown;
      await AsyncStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(all));
      return true;
    } catch {
      return false;
    }
  });
}
