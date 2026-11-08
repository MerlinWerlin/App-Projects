// T250 (owner-1101h #1): the app's one deferred-work queue (src/core/deferredWork.ts) on the phone:
// AsyncStorage for the pending flags + timings, and a yield that waits for running interactions
// (InteractionManager) and then a macrotask, capped so nothing can stall it forever.
// Steps are registered in src/store/launchWork.ts (all of them, before start, so a step left
// pending by a crash is found on the next launch). Screens and stores only request them by name.
// Nothing here throws; nothing is sent anywhere (timings stay on the phone, logged in __DEV__ only).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import { DEFERRED_KEY, createDeferredQueue, diagnosticsLine, type StepDef, type StepTiming } from '../core/deferredWork';

export { DEFERRED_STEPS } from '../core/deferredWork';

/** Longest a yield waits for interactions (an endless animation must not stall the queue). */
const YIELD_CAP_MS = 400;

/** Resolve after current interactions (touches, transitions) finished and one macrotask, capped. */
export function yieldToUi(): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const cap = setTimeout(finish, YIELD_CAP_MS);
    const after = () => {
      setTimeout(() => {
        clearTimeout(cap);
        finish();
      }, 0);
    };
    try {
      if (InteractionManager && typeof InteractionManager.runAfterInteractions === 'function') {
        InteractionManager.runAfterInteractions(after);
      } else after();
    } catch {
      after();
    }
  });
}

const queue = createDeferredQueue({
  now: () => Date.now(),
  yieldTurn: yieldToUi,
  load: async () => {
    try {
      return await AsyncStorage.getItem(DEFERRED_KEY);
    } catch {
      return null;
    }
  },
  save: async (raw) => {
    try {
      await AsyncStorage.setItem(DEFERRED_KEY, raw);
    } catch {
      // Storage unavailable: the work still runs this session.
    }
  },
  log: (t: StepTiming) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && (t.overBudget || !t.ok)) {
      console.log(`[deferred] ${t.name} ${t.ms} ms${t.overBudget ? ` (budget ${t.budgetMs})` : ''}${t.ok ? '' : ' failed'}`);
    }
  },
});

/** Register a step (src/store/launchWork.ts does this for every step at module load). */
export function registerDeferred(name: string, def: StepDef): void {
  queue.register(name, def);
}

/**
 * Queue a named step (coalesced; latest `arg` wins). Never runs on the caller's stack and never
 * before the first screen drew; returns at once. Never throws.
 */
export function requestDeferred(name: string, ...arg: unknown[]): void {
  try {
    if (arg.length > 0) queue.request(name, arg[0]);
    else queue.request(name);
  } catch {
    // Never break the caller.
  }
}

/** Start draining (src/store/launchWork.ts, after the first screen). Idempotent; never rejects. */
export function startDeferred(): Promise<void> {
  return queue.start().catch(() => undefined);
}

/** Resolves once nothing is waiting or running (e.g. a screen that wants the result). Never rejects. */
export function deferredIdle(): Promise<void> {
  return queue.idle().catch(() => undefined);
}

/**
 * T257: the recorded timings (this launch's runs plus the persisted ones once the queue started),
 * for the Settings › About "Startup" line (src/core/startupDiagnostics.ts). [] on any error.
 */
export function deferredTimings(): StepTiming[] {
  try {
    return queue.timings();
  } catch {
    return [];
  }
}

/** One line for Settings diagnostics ("Slowest: probe 420 ms, ..."); '' when nothing ran yet. */
export function deferredDiagnostics(): string {
  try {
    return diagnosticsLine(queue.timings());
  } catch {
    return '';
  }
}
