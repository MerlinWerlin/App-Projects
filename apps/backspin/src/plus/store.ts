// Backspin Plus: one non-consumable purchase (com.jared797.backspin.plus). Real App Store purchases through
// expo-iap in store builds (TestFlight / App Store), loaded with a guarded require so Expo Go never crashes.
// In Expo Go there is no store: a clearly labelled test unlock stands in, saved only on that phone.
// Same pattern as Linework's iapStore.ts, which passed sandbox purchase on TestFlight.

export const PLUS_SKU = 'com.jared797.backspin.plus';
export const PLUS_KEY = 'backspin.plus.v1';

export type Storage = { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> };
export type BuyResult = { status: 'owned' } | { status: 'cancelled' } | { status: 'unavailable' } | { status: 'failed'; detail?: string };
export type PlusStore = {
  kind: 'store' | 'test';
  owned(): Promise<boolean>;
  price(): Promise<string | null>;
  buy(): Promise<BuyResult>;
  restore(): Promise<boolean>;
};

declare const require: (id: string) => unknown;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Iap = Record<string, any>;
type Purchase = { productId?: string; id?: string } & Record<string, unknown>;

function loadIap(): Iap | null {
  try {
    const m = require('expo-iap') as Iap | null;
    return m && typeof m.initConnection === 'function' && typeof m.requestPurchase === 'function' ? m : null;
  } catch {
    return null;
  }
}

const isPlus = (p: Purchase | null | undefined) => !!p && (p.productId === PLUS_SKU || p.id === PLUS_SKU);
const isCancel = (e: unknown) => /cancel/i.test(String((e as { code?: string })?.code ?? '') + String((e as Error)?.message ?? ''));

async function remember(storage: Storage, on: boolean) {
  try {
    await storage.set(PLUS_KEY, on ? '1' : '0');
  } catch {
    // still owned this session
  }
}

export function createStore(storage: Storage, module?: Iap | null): PlusStore {
  const iap = module === undefined ? loadIap() : module;
  if (!iap) return testStore(storage);
  let connected: Promise<boolean> | null = null;
  const connect = () =>
    (connected ??= Promise.resolve()
      .then(() => iap.initConnection())
      .then(() => true)
      .catch(() => {
        connected = null;
        return false;
      }));
  const ownedList = async (): Promise<Purchase[]> => {
    try {
      const l = await iap.getAvailablePurchases();
      return Array.isArray(l) ? l : [];
    } catch {
      return [];
    }
  };
  return {
    kind: 'store',
    async owned() {
      if ((await storage.get(PLUS_KEY).catch(() => null)) === '1') return true;
      if (!(await connect())) return false;
      const yes = (await ownedList()).some(isPlus);
      if (yes) await remember(storage, true);
      return yes;
    },
    async price() {
      if (!(await connect())) return null;
      for (const f of [
        () => iap.fetchProducts?.({ skus: [PLUS_SKU], type: 'in-app' }),
        () => iap.requestProducts?.({ skus: [PLUS_SKU], type: 'inapp' }),
        () => iap.getProducts?.([PLUS_SKU]),
      ]) {
        try {
          const r = (await f()) as { displayPrice?: string; localizedPrice?: string }[] | undefined;
          const p = Array.isArray(r) ? r[0] : undefined;
          if (p) return p.displayPrice ?? p.localizedPrice ?? null;
        } catch {
          // next API shape
        }
      }
      return null;
    },
    async buy() {
      if (!(await connect())) return { status: 'unavailable' };
      try {
        const r = await iap.requestPurchase({
          request: { ios: { sku: PLUS_SKU }, android: { skus: [PLUS_SKU] }, apple: { sku: PLUS_SKU }, google: { skus: [PLUS_SKU] } },
          type: 'in-app',
        });
        const list: Purchase[] = Array.isArray(r) ? r : r ? [r] : [];
        const got = list.find(isPlus) ?? (await ownedList()).find(isPlus);
        if (!got) return { status: 'failed', detail: 'no transaction' };
        try {
          await iap.finishTransaction?.({ purchase: got, isConsumable: false });
        } catch {
          // the store will offer it again; ownership is already known
        }
        await remember(storage, true);
        return { status: 'owned' };
      } catch (e) {
        if (isCancel(e)) return { status: 'cancelled' };
        return { status: 'failed', detail: e instanceof Error ? e.message : String(e) };
      }
    },
    async restore() {
      if (!(await connect())) return false;
      try {
        await iap.restorePurchases?.();
      } catch {
        // fall through to the list
      }
      const yes = (await ownedList()).some(isPlus);
      if (yes) await remember(storage, true);
      return yes;
    },
  };
}

/** Expo Go stand-in. The UI says plainly that it is a test unlock. */
export function testStore(storage: Storage): PlusStore {
  return {
    kind: 'test',
    owned: async () => (await storage.get(PLUS_KEY).catch(() => null)) === '1',
    price: async () => null,
    buy: async () => {
      await remember(storage, true);
      return { status: 'owned' };
    },
    restore: async () => (await storage.get(PLUS_KEY).catch(() => null)) === '1',
  };
}
