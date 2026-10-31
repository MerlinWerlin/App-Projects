// Widget Studio drafts (T59), kept on this phone with AsyncStorage: one entry per theme under
// STUDIO_STORAGE_KEY. Parsing/validation lives in src/core/widgetStudio.ts (tested in Node).
// Photos referenced here are our own documents-folder copies; nothing leaves the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetSet } from '../core/widgetSets';
import { referencedPhotoUris } from '../core/background';
import {
  STUDIO_STORAGE_KEY,
  orphanedStudioPhotos,
  parseStudioState,
  parseStudioStore,
  serialiseStudioState,
  type StudioState,
} from '../core/widgetStudio';
import { loadBackgrounds, removePhotoCopy } from './background';

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
      const prev = { ...all };
      all[state.themeId] = JSON.parse(serialiseStudioState(state)) as unknown;
      await AsyncStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(all));
      await cleanUpPhotos(prev, all);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * T80: delete studio photo copies the new state no longer uses (after it is written, never while
 * in use). Photos a wallpaper background points at are always kept. Best effort, never throws.
 */
async function cleanUpPhotos(prev: Record<string, unknown>, next: Record<string, unknown>): Promise<void> {
  try {
    const orphans = orphanedStudioPhotos(prev, next);
    if (orphans.length === 0) return;
    const keep = referencedPhotoUris(await loadBackgrounds());
    for (const uri of orphans) if (!keep.has(uri)) await removePhotoCopy(uri);
  } catch {
    // Best effort: a stray copy only costs a little storage.
  }
}
