/** Key-value storage over AsyncStorage, with an in-memory fallback so the app always boots. */
export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export class MemoryKv implements KvStore {
  readonly data = new Map<string, string>();
  async getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  async setItem(k: string, v: string) { this.data.set(k, v); }
  async removeItem(k: string) { this.data.delete(k); }
}

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
