/** Minimal async key-value store (AsyncStorage on the phone, MemoryKv in tests). */
export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export class MemoryKv implements KvStore {
  readonly data = new Map<string, string>();
  async getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  async setItem(key: string, value: string) { this.data.set(key, value); }
}
