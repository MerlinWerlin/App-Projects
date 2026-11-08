// T265: which guided setup steps (Wallpaper, Icons, Widgets) are done, per theme
// (AsyncStorage glaze.themeSetup.v1). Pure rules live in src/core/themeSetupFlow.ts. Every read and
// write is guarded: storage trouble means "nothing ticked yet", never a crash.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SETUP_STORE_KEY,
  markDone,
  parseProgress,
  serialiseProgress,
  type SetupProgress,
  type SetupStep,
} from '../core/themeSetupFlow';

let cache: SetupProgress | null = null;

export async function loadSetupProgress(): Promise<SetupProgress> {
  if (cache) return cache;
  try {
    cache = parseProgress(await AsyncStorage.getItem(SETUP_STORE_KEY));
  } catch {
    cache = {};
  }
  return cache;
}

/** Ticks one step for one theme and saves it; returns the new record (in memory even if saving fails). */
export async function markSetupDone(themeId: string, step: SetupStep): Promise<SetupProgress> {
  const before = await loadSetupProgress();
  const next = markDone(before, themeId, step);
  if (next === before) return before;
  cache = next;
  try {
    await AsyncStorage.setItem(SETUP_STORE_KEY, serialiseProgress(next));
  } catch {
    // Kept for this session only.
  }
  return next;
}
