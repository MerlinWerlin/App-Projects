/** Minimal key-value store interface so logic can be tested without AsyncStorage. */
export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export class MemoryKv implements KvStore {
  data = new Map<string, string>();
  async getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  async setItem(key: string, value: string) { this.data.set(key, value); }
  async removeItem(key: string) { this.data.delete(key); }
}
