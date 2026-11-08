/**
 * Couch Plus entitlement (owner decision 7 Nov 2026). Pure TypeScript, no React Native imports, so Node can test it.
 *
 * Couch Plus is one one-time purchase (A$3.99, non-consumable, no subscription) that unlocks the paid part of Couch:
 * the TV remote and casting (src/plus/access.ts says who has access; src/plus/gate.tsx is the single place controls
 * are stopped). Adding and finding TVs, the TVs list, settings and themes stay free.
 * Only src/plus reads the entitlement. No accounts, no analytics: state lives on the phone and in the App Store.
 */

export type PlusSource = 'none' | 'mock' | 'store';

export type PlusState = { owned: boolean; source: PlusSource; since?: number };

export interface PlusStore {
  getState(): Promise<PlusState>;
  purchase(): Promise<PlusState>;
  restore(): Promise<PlusState>;
}

export interface PlusStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const PLUS_STORAGE_KEY = 'couch.plus.v1';

/** Shown price until the App Store answers with the localised one. */
export const PLUS_PRICE = 'A$3.99';

export const NOT_OWNED: PlusState = { owned: false, source: 'none' };

/** What Couch Plus unlocks, for the paywall (translated as core.plus.feature.<id>.title / .hint). */
export const PLUS_FEATURES = ['remote', 'cast'] as const;
export type PlusFeature = (typeof PLUS_FEATURES)[number];

/** Tolerates any stored garbage: anything unexpected reads as "not owned". */
export function parsePlusState(text: string | null): PlusState {
  if (!text) return { ...NOT_OWNED };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ...NOT_OWNED };
  }
  if (!raw || typeof raw !== 'object') return { ...NOT_OWNED };
  const r = raw as Record<string, unknown>;
  if (r.owned !== true) return { ...NOT_OWNED };
  const source: PlusSource = r.source === 'store' ? 'store' : r.source === 'mock' ? 'mock' : 'none';
  if (source === 'none') return { ...NOT_OWNED };
  const out: PlusState = { owned: true, source };
  if (typeof r.since === 'number' && Number.isFinite(r.since) && r.since > 0) out.since = r.since;
  return out;
}

/**
 * Local mock store for development (Expo Go has no store module) and tests. Never used in a store build:
 * src/plus/accessStore.ts only falls back to it when __DEV__ is true.
 */
export function createMockStore(storage: PlusStorage, now: () => number = () => Date.now()): PlusStore {
  const read = async (): Promise<PlusState> => {
    try {
      return parsePlusState(await storage.get(PLUS_STORAGE_KEY));
    } catch {
      return { ...NOT_OWNED };
    }
  };
  return {
    getState: read,
    async purchase() {
      const current = await read();
      if (current.owned) return current;
      const next: PlusState = { owned: true, source: 'mock', since: now() };
      try {
        await storage.set(PLUS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable: the purchase still counts for this session
      }
      return next;
    },
    // A mock restore can only find what this device already stored.
    restore: read,
  };
}

/** Development only: clear the mock purchase. */
export async function resetMockPurchase(storage: PlusStorage): Promise<PlusState> {
  try {
    await storage.set(PLUS_STORAGE_KEY, JSON.stringify(NOT_OWNED));
  } catch {
    // ignore
  }
  return { ...NOT_OWNED };
}
