// Linework Plus entitlement (PLAN §2.2, §6). Pure TypeScript, no React Native imports, so Node can test it.
// CONVENTIONS: only src/plus may read the Plus entitlement, and Plus never gates a tracing tool.
// The real store (in-app purchase) arrives in a dev build (R2); until then a local mock store stands in.
// No network, no analytics, no accounts: state lives only in on-device storage.

export type PlusSource = 'none' | 'mock' | 'store';

export type PlusState = { owned: boolean; source: PlusSource; since?: number };

export type TipAmountId = 'small' | 'medium' | 'large';

export interface PlusStore {
  getState(): Promise<PlusState>;
  purchase(): Promise<PlusState>;
  restore(): Promise<PlusState>;
  tip(amountId: TipAmountId): Promise<{ ok: boolean }>;
}

export interface PlusStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const PLUS_STORAGE_KEY = 'linework.plus.v1';

/** Shown price (until the store provides a localized one). The UI wraps it in a translated "{price} one-time". */
export const PLUS_PRICE = 'A$2.99';
/** English price line (fallback copy; the UI translates via 'plus.price'). */
export const PLUS_PRICE_LABEL = `${PLUS_PRICE} one-time`;

export const NOT_OWNED: PlusState = { owned: false, source: 'none' };

/** Ids let the UI translate each line ('plus.feature.<id>'); labels are the English fallback. */
export type PlusFeatureId = 'library' | 'outline';

/** What Plus keeps after the 14-day trial (owner decision 22 Oct 2026, src/plus/access.ts). */
export const PLUS_FEATURE_ITEMS: readonly { id: PlusFeatureId; label: string }[] = [
  { id: 'library', label: 'Every template: 350+ drawings in all categories' },
  { id: 'outline', label: 'Outline mode for your photos' },
];
export const PLUS_FEATURES: readonly string[] = PLUS_FEATURE_ITEMS.map((f) => f.label);

/** Number of starter templates promised free in FREE_FOREVER. */
export const STARTER_TEMPLATE_COUNT = 24;

export type FreeToolId =
  | 'camera'
  | 'opacity'
  | 'scaleRotate'
  | 'lock'
  | 'flashlight'
  | 'grid'
  | 'mirror'
  | 'touchLock'
  | 'lightbox'
  | 'ownPhotos'
  | 'starters';

/** Free forever, also after the trial. Plus must never gate anything on this list. ('plus.free.<id>' in the UI.) */
export const FREE_FOREVER_ITEMS: readonly { id: FreeToolId; label: string }[] = [
  { id: 'camera', label: 'Camera tracing' },
  { id: 'opacity', label: 'Opacity' },
  { id: 'scaleRotate', label: 'Scale and rotate' },
  { id: 'lock', label: 'Lock' },
  { id: 'flashlight', label: 'Flashlight' },
  { id: 'grid', label: 'Grid' },
  { id: 'mirror', label: 'Mirror' },
  { id: 'touchLock', label: 'Touch-lock' },
  { id: 'lightbox', label: 'Lightbox' },
  { id: 'ownPhotos', label: 'Your own photos' },
  { id: 'starters', label: `${STARTER_TEMPLATE_COUNT} starter templates` },
];
export const FREE_FOREVER: readonly string[] = FREE_FOREVER_ITEMS.map((f) => f.label);

export const TIP_OPTIONS: readonly { id: TipAmountId; label: string }[] = [
  { id: 'small', label: 'Small tip' },
  { id: 'medium', label: 'Medium tip' },
  { id: 'large', label: 'Large tip' },
];

export type TemplatePack = { id: string; name: string; count: number; locked: boolean };

/** Upcoming packs. Content is intentionally empty for now: art will be original, made in this repo. */
export const PACKS: readonly TemplatePack[] = [
  { id: 'botanical', name: 'Botanical studies', count: 0, locked: true },
  { id: 'creatures', name: 'Creatures and critters', count: 0, locked: true },
  { id: 'patterns', name: 'Patterns and mandalas II', count: 0, locked: true },
  { id: 'lettering-plus', name: 'Lettering styles', count: 0, locked: true },
];

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

/** Local mock store for Expo Go and tests. `now` is injectable for deterministic tests. */
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
    async tip(amountId) {
      return { ok: amountId === 'small' || amountId === 'medium' || amountId === 'large' };
    },
  };
}

/** Test builds only: clear the mock purchase. */
export async function resetMockPurchase(storage: PlusStorage): Promise<PlusState> {
  try {
    await storage.set(PLUS_STORAGE_KEY, JSON.stringify(NOT_OWNED));
  } catch {
    // ignore
  }
  return { ...NOT_OWNED };
}
