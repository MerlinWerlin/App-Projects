/**
 * iOS Keychain / Android Keystore as a tiny KvStore via expo-secure-store. Used for the Plus trial's
 * first-launch stamp because Keychain items survive deleting the app on iOS (see src/plus/trial.ts).
 * Guarded require like the other adapters: if the module is missing (old Expo Go, web) or throws,
 * this returns null and the caller falls back to the normal kv store. Never crashes.
 */
import type { KvStore } from '../core/library';

declare const require: (id: string) => unknown;

interface SecureStoreLike {
  getItemAsync?: (key: string, options?: Record<string, unknown>) => Promise<string | null>;
  setItemAsync?: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
  AFTER_FIRST_UNLOCK?: unknown;
}

export function loadSecureStore(): KvStore | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-secure-store') as (SecureStoreLike & { default?: SecureStoreLike }) | null;
    const m = mod && typeof mod.getItemAsync === 'function' ? mod : (mod?.default ?? null);
    if (!m || typeof m.getItemAsync !== 'function' || typeof m.setItemAsync !== 'function') return null;
    const get = m.getItemAsync.bind(m);
    const set = m.setItemAsync.bind(m);
    // Readable after the first unlock since boot, so a launch from the background still finds it.
    const options = m.AFTER_FIRST_UNLOCK !== undefined ? { keychainAccessible: m.AFTER_FIRST_UNLOCK } : undefined;
    return {
      getItem: (key) => get(key, options),
      setItem: (key, value) => set(key, value, options),
    };
  } catch {
    return null;
  }
}
