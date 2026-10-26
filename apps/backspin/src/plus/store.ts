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
/** Store error code first (release standard §2: the failure alert shows the code), then the message. */
const errDetail = (e: unknown) => {
  const code = (e as { code?: unknown })?.code;
  const msg = e instanceof Error ? e.message : String(e);
  return code != null && code !== '' && !msg.includes(String(code)) ? `${String(code)}: ${msg}` : msg;
};

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
      const result = await new Promise<BuyResult>((resolve) => {
        let done = false;
        let pending = true;
        let polling = false;
        let checks = 0;
        let failureChecks = 0;
        let error: string | undefined;
        let listens = false;
        const subs: { remove?: () => void }[] = [];
        const finish = (r: BuyResult) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          clearInterval(poll);
          for (const sub of subs) {
            try { sub?.remove?.(); } catch { /* cleanup cannot hide a purchase */ }
          }
          resolve(r);
        };
        const accept = (purchase: Purchase | undefined) => {
          if (done || !isPlus(purchase)) return;
          // Ownership does not depend on acknowledgement succeeding; StoreKit redelivers it if needed.
          void Promise.resolve().then(() => iap.finishTransaction?.({ purchase, isConsumable: false })).catch(() => {});
          finish({ status: 'owned' });
        };
        const onError = (e: unknown) => {
          if (isCancel(e)) return finish({ status: 'cancelled' });
          error = errDetail(e);
          // A listener error can precede the request's successful return. Reconcile before failing.
        };
        const reconcile = async () => {
          if (done || pending || polling) return;
          polling = true;
          const got = (await ownedList()).find(isPlus);
          polling = false;
          if (done) return;
          if (got) return accept(got);
          checks++;
          if (error) failureChecks++;
          if (failureChecks >= 10 || (!listens && checks >= 10)) {
            finish({ status: 'failed', detail: error ?? 'E_NO_TRANSACTION: no transaction' });
          }
        };
        // A native purchase sheet may stay open while someone authenticates. A void request result is
        // not a failed purchase: keep the transaction listener alive, with a bounded wait and Restore.
        const timeout = setTimeout(() => finish({ status: 'failed', detail: error ?? 'E_PURCHASE_TIMEOUT' }), 180_000);
        const poll = setInterval(() => void reconcile(), 1000);
        try {
          if (typeof iap.purchaseUpdatedListener === 'function') {
            subs.push(iap.purchaseUpdatedListener(accept));
            listens = true;
          }
          if (typeof iap.purchaseErrorListener === 'function') subs.push(iap.purchaseErrorListener(onError));
        } catch { /* older modules can still return the transaction or expose it through Restore */ }
        void (async () => {
          try {
            // Load the StoreKit product even when the user taps Unlock before the price finishes loading.
            try { await iap.fetchProducts?.({ skus: [PLUS_SKU], type: 'in-app' }); } catch { /* request reports the error */ }
            if (done) return;
            const r = await iap.requestPurchase({
              request: { ios: { sku: PLUS_SKU }, android: { skus: [PLUS_SKU] }, apple: { sku: PLUS_SKU }, google: { skus: [PLUS_SKU] } },
              type: 'in-app',
            });
            accept((Array.isArray(r) ? r : r ? [r] : []).find(isPlus));
          } catch (e) {
            onError(e);
          } finally {
            pending = false;
            void reconcile();
          }
        })();
      });
      if (result.status === 'owned') await remember(storage, true);
      return result;
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
