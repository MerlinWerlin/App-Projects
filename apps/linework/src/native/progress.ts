// Local drawing progress (T69), stored in AsyncStorage. Pure logic lives in src/core/progress.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseProgress, recordSession, type Progress } from '../core/progress';

export { dayKey, summary, type Progress, type ProgressSummary } from '../core/progress';

export const PROGRESS_KEY = 'linework.progress';

// Serialise read-modify-write updates so two quick sessions never lose a write.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export async function loadProgress(): Promise<Progress> {
  try {
    return parseProgress(await AsyncStorage.getItem(PROGRESS_KEY));
  } catch {
    return parseProgress(null);
  }
}

export async function saveProgress(p: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // ignore: progress is a nicety, never worth an error
  }
}

/** Records one trace session (focus → blur). Short sessions are ignored by the core. */
export function recordTraceSession(startMs: number, endMs: number): Promise<Progress> {
  return serial(async () => {
    const current = await loadProgress();
    const next = recordSession(current, startMs, endMs, Date.now());
    if (next !== current) await saveProgress(next);
    return next;
  });
}
