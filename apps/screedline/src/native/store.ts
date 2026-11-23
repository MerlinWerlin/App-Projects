/**
 * On-device storage only: AsyncStorage for jobs and settings, Keychain (expo-secure-store) for the verified
 * trial date so a reinstall cannot restart the trial. Guarded requires: a missing module never crashes.
 */
import * as Haptics from 'expo-haptics';

export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

declare const require: (id: string) => unknown;

class MemoryKv implements KvStore {
  private m = new Map<string, string>();
  async getItem(k: string) { return this.m.get(k) ?? null; }
  async setItem(k: string, v: string) { this.m.set(k, v); }
}

export function loadKv(): KvStore {
  try {
    const mod = require('@react-native-async-storage/async-storage') as { default?: KvStore } & Partial<KvStore>;
    const m = mod?.default ?? (mod as KvStore);
    if (m && typeof m.getItem === 'function' && typeof m.setItem === 'function') return m;
  } catch { /* fall through */ }
  return new MemoryKv();
}

interface SecureStoreLike {
  getItemAsync?: (key: string, options?: Record<string, unknown>) => Promise<string | null>;
  setItemAsync?: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
  AFTER_FIRST_UNLOCK?: unknown;
}

export function loadSecureStore(): KvStore | null {
  try {
    const mod = require('expo-secure-store') as (SecureStoreLike & { default?: SecureStoreLike }) | null;
    const m = mod && typeof mod.getItemAsync === 'function' ? mod : (mod?.default ?? null);
    if (!m || typeof m.getItemAsync !== 'function' || typeof m.setItemAsync !== 'function') return null;
    const get = m.getItemAsync.bind(m);
    const set = m.setItemAsync.bind(m);
    const options = m.AFTER_FIRST_UNLOCK !== undefined ? { keychainAccessible: m.AFTER_FIRST_UNLOCK } : undefined;
    return { getItem: k => get(k, options), setItem: (k, v) => set(k, v, options) };
  } catch {
    return null;
  }
}

export const haptic = {
  tap(on: boolean) { if (on) Haptics.selectionAsync().catch(() => undefined); },
  thud(on: boolean) { if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); },
  success(on: boolean) { if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); },
};
