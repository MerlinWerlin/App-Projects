/**
 * Persistent KvStore over AsyncStorage (bundled in Expo Go). Guarded require: if the module is missing
 * we fall back to memory so the app still boots (starter-standard rule: nothing may crash Expo Go).
 */
import { MemoryKv, type KvStore } from '../core/library';

declare const require: (id: string) => unknown;

export function loadKv(): KvStore {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage') as { default?: KvStore } & Partial<KvStore>;
    const m = mod?.default ?? (mod as KvStore);
    if (m && typeof m.getItem === 'function' && typeof m.setItem === 'function') return m;
  } catch {
    /* fall through */
  }
  return new MemoryKv();
}
