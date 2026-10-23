/**
 * Persistent KvStore over @react-native-async-storage/async-storage (bundled in Expo Go, so saved TVs,
 * pins and prefs survive restarts there too). Loaded by a guarded require inside a function (D4-1):
 * where the package or its native module is missing (tests, web without storage) this returns null
 * and callers fall back to an in-memory KV. Never throws.
 */
import type { KvStore } from '../core/store';

/** Minimal slice of the AsyncStorage API that we use. */
interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

declare const require: (id: string) => unknown;

function loadModule(): AsyncStorageLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage') as
      | ({ default?: AsyncStorageLike | null } & Partial<AsyncStorageLike>)
      | null;
    const m = mod?.default ?? (mod && typeof mod.getItem === 'function' ? (mod as AsyncStorageLike) : null);
    return m && typeof m.getItem === 'function' && typeof m.setItem === 'function' ? m : null;
  } catch {
    return null;
  }
}

/** A KvStore backed by AsyncStorage, or null when it is unavailable. */
export function loadPersistentKv(): KvStore | null {
  const m = loadModule();
  if (!m) return null;
  return {
    getItem: (key) => m.getItem(key),
    setItem: (key, value) => m.setItem(key, value),
  };
}

export function hasPersistentKv(): boolean {
  return loadModule() !== null;
}
