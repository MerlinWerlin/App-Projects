/**
 * Saved TVs: name + room, last known IP (`host`), MAC (for Wake-on-LAN), pairing token, last seen,
 * the last-used TV and pinned apps per TV. Persisted as one versioned JSON document over an injected
 * async key-value store (AsyncStorage-shaped; the app passes src/native/kv.ts). Pure TS; an in-memory
 * KV is exported for tests and as the fallback when no storage module loads.
 */
import type { Tv } from './types';

export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** In-memory KV (tests, fallback). Data is lost when the app restarts. */
export class MemoryKv implements KvStore {
  readonly data = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
}

export const STORE_KEY = 'couch.savedTvs';
export const STORE_VERSION = 1;

/** A saved TV. `host` is the last known IP address. */
export interface SavedTv extends Tv {
  addedAt: number;
}

export interface StoreDoc {
  version: typeof STORE_VERSION;
  tvs: SavedTv[];
  lastUsedId: string | null;
  pinsByTv: Record<string, string[]>;
}

export function emptyDoc(): StoreDoc {
  return { version: STORE_VERSION, tvs: [], lastUsedId: null, pinsByTv: {} };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validTv(v: unknown): v is SavedTv {
  if (!isObj(v)) return false;
  return (
    typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    typeof v['model'] === 'string' &&
    typeof v['platform'] === 'string' &&
    typeof v['host'] === 'string'
  );
}

/** Normalises a stored TV: addedAt defaults to 0; IR fields of the wrong type are dropped. */
function cleanTv(t: SavedTv): SavedTv {
  const out: SavedTv = { ...t, addedAt: typeof t.addedAt === 'number' ? t.addedAt : 0 };
  if (out.irBrand !== undefined && typeof out.irBrand !== 'string') delete out.irBrand;
  if (out.irSet !== undefined && (typeof out.irSet !== 'number' || !Number.isInteger(out.irSet))) delete out.irSet;
  return out;
}

/** Parses a stored document. Unknown versions or corrupt JSON yield an empty document (never throws). */
export function parseDoc(raw: string | null): StoreDoc {
  if (raw === null) return emptyDoc();
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return emptyDoc();
  }
  if (!isObj(j) || j['version'] !== STORE_VERSION) return emptyDoc();
  const tvs = Array.isArray(j['tvs']) ? j['tvs'].filter(validTv).map(cleanTv) : [];
  const ids = new Set(tvs.map((t) => t.id));
  const lastUsedId = typeof j['lastUsedId'] === 'string' && ids.has(j['lastUsedId']) ? j['lastUsedId'] : null;
  const pinsByTv: Record<string, string[]> = {};
  const rawPins = j['pinsByTv'];
  if (isObj(rawPins)) {
    for (const [id, list] of Object.entries(rawPins)) {
      if (ids.has(id) && Array.isArray(list)) pinsByTv[id] = list.filter((x): x is string => typeof x === 'string');
    }
  }
  return { version: STORE_VERSION, tvs, lastUsedId, pinsByTv };
}

export type SavedTvPatch = Partial<Omit<SavedTv, 'id' | 'addedAt'>>;

export class SavedTvStore {
  private doc: StoreDoc | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly kv: KvStore,
    private readonly now: () => number = () => Date.now(),
    private readonly key: string = STORE_KEY,
  ) {}

  private async load(): Promise<StoreDoc> {
    if (!this.doc) this.doc = parseDoc(await this.kv.getItem(this.key));
    return this.doc;
  }

  /** Serialises read-modify-write so concurrent calls never lose updates. */
  private mutate<T>(fn: (doc: StoreDoc) => T): Promise<T> {
    const run = async (): Promise<T> => {
      const doc = await this.load();
      const out = fn(doc);
      await this.kv.setItem(this.key, JSON.stringify(doc));
      return out;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  async list(): Promise<SavedTv[]> {
    await this.queue;
    return (await this.load()).tvs.map((t) => ({ ...t }));
  }

  async get(id: string): Promise<SavedTv | null> {
    const t = (await this.list()).find((x) => x.id === id);
    return t ?? null;
  }

  /** Adds a TV (or replaces one with the same id). Returns the saved record. */
  add(tv: Tv): Promise<SavedTv> {
    return this.mutate((doc) => {
      const saved: SavedTv = { ...tv, addedAt: this.now(), lastSeen: tv.lastSeen ?? this.now() };
      const i = doc.tvs.findIndex((t) => t.id === tv.id);
      if (i >= 0) {
        saved.addedAt = doc.tvs[i]!.addedAt;
        doc.tvs[i] = saved;
      } else doc.tvs.push(saved);
      return { ...saved };
    });
  }

  /** Merges `patch` into a saved TV. Returns null when the id is unknown. */
  update(id: string, patch: SavedTvPatch): Promise<SavedTv | null> {
    return this.mutate((doc) => {
      const i = doc.tvs.findIndex((t) => t.id === id);
      if (i < 0) return null;
      const next: SavedTv = { ...doc.tvs[i]!, ...patch, id, addedAt: doc.tvs[i]!.addedAt };
      doc.tvs[i] = next;
      return { ...next };
    });
  }

  /** Records that the TV answered at `ip` (and optionally its MAC) just now. */
  markSeen(id: string, info: { ip?: string; mac?: string } = {}): Promise<SavedTv | null> {
    const patch: SavedTvPatch = { lastSeen: this.now() };
    if (info.ip) patch.host = info.ip;
    if (info.mac) patch.mac = info.mac;
    return this.update(id, patch);
  }

  remove(id: string): Promise<boolean> {
    return this.mutate((doc) => {
      const before = doc.tvs.length;
      doc.tvs = doc.tvs.filter((t) => t.id !== id);
      delete doc.pinsByTv[id];
      if (doc.lastUsedId === id) doc.lastUsedId = null;
      return doc.tvs.length !== before;
    });
  }

  setLastUsed(id: string | null): Promise<void> {
    return this.mutate((doc) => {
      if (id === null || doc.tvs.some((t) => t.id === id)) doc.lastUsedId = id;
    });
  }

  async lastUsedId(): Promise<string | null> {
    await this.queue;
    return (await this.load()).lastUsedId;
  }

  setPins(id: string, appIds: readonly string[]): Promise<void> {
    return this.mutate((doc) => {
      if (doc.tvs.some((t) => t.id === id)) doc.pinsByTv[id] = [...appIds];
    });
  }

  async pins(id: string): Promise<string[]> {
    await this.queue;
    return [...((await this.load()).pinsByTv[id] ?? [])];
  }

  /** Saved pins for a TV, or null when none were ever saved (the UI then uses its default pins). */
  async savedPins(id: string): Promise<string[] | null> {
    await this.queue;
    const list = (await this.load()).pinsByTv[id];
    return list ? [...list] : null;
  }
}
