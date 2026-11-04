// Satchel Plus (T16): one non-consumable purchase, product com.jared797.satchel.plus, through expo-iap 6.2.0
// (pinned exact). Same guarded adapter as Backspin / Cue / Linework (sandbox-tested on TestFlight): expo-iap is
// lazy-required, so a binary without the native module (Expo Go, or an over-the-air update landing on an older
// build) never crashes. In that case purchases are "stubbed" and, per the release standard, every Plus feature is
// unlocked (src/plus/entitlement.ts). No test-unlock button and no "test build" wording anywhere.
// Pure TypeScript with no React Native imports, so node tests drive it with a fake module.

export const PLUS_SKU = 'com.jared797.satchel.plus';
export const PLUS_KEY = 'satchel.plus.v1';

export type Storage = { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> };
export type BuyResult =
  | { status: 'owned' }
  | { status: 'cancelled' }
  | { status: 'unavailable'; codes: string[] }
  | { status: 'failed'; codes: string[]; detail: string };
export type RestoreResult = { status: 'owned' } | { status: 'none' } | { status: 'unavailable'; codes: string[] };
export type PlusStore = {
  /** 'store': expo-iap is in this binary. 'stub': it is not, so purchases can't run and Plus is unlocked. */
  kind: 'store' | 'stub';
  owned(): Promise<boolean>;
  price(): Promise<string | null>;
  buy(): Promise<BuyResult>;
  restore(): Promise<RestoreResult>;
};
export type StoreOptions = { pollMs?: number; recheckTries?: number; timeoutMs?: number };

declare const require: (id: string) => unknown;
// The real module's types are in scripts/tsc-stubs/modules/expo-iap.d.ts; the adapter tolerates older and newer
// API shapes, so it treats the module loosely and checks each function before calling it.
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
const codeOf = (e: unknown): string => {
  const c = (e as { code?: unknown } | null)?.code;
  return c == null ? '' : String(c);
};
const isCancel = (e: unknown) => /cancel/i.test(codeOf(e) + String((e as Error | null)?.message ?? ''));
const messageOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : String((e as { message?: unknown } | null)?.message ?? e));

async function remember(storage: Storage, on: boolean) {
  try {
    await storage.set(PLUS_KEY, on ? '1' : '0');
  } catch {
    // still owned this session
  }
}
const remembered = async (storage: Storage) => (await storage.get(PLUS_KEY).catch(() => null)) === '1';

export function createStore(storage: Storage, module?: Iap | null, opts: StoreOptions = {}): PlusStore {
  const iap = module === undefined ? loadIap() : module;
  if (!iap) return stubStore(storage);
  const pollMs = opts.pollMs ?? 1000;
  const tries = opts.recheckTries ?? 10; // ~10 s of getAvailablePurchases re-checks at 1 s
  const timeoutMs = opts.timeoutMs ?? 180_000;
  let connected: Promise<boolean> | null = null;
  let connectCode = '';
  const connect = () =>
    (connected ??= Promise.resolve()
      .then(() => iap.initConnection())
      .then(() => true)
      .catch((e: unknown) => {
        connectCode = codeOf(e) || 'E_NOT_CONNECTED';
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
      if (await remembered(storage)) return true;
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
      if (!(await connect())) return { status: 'unavailable', codes: [connectCode || 'E_NOT_CONNECTED'] };
      const result = await new Promise<BuyResult>((resolve) => {
        let done = false;
        let pending = true;
        let polling = false;
        let checks = 0;
        let failureChecks = 0;
        let listens = false;
        const codes: string[] = [];
        let detail = '';
        const subs: ({ remove?: () => void } | undefined)[] = [];
        const finish = (r: BuyResult) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          clearInterval(poll);
          for (const sub of subs) {
            try {
              sub?.remove?.();
            } catch {
              // cleanup cannot hide a purchase
            }
          }
          resolve(r);
        };
        const accept = (purchase: Purchase | undefined) => {
          if (done || !isPlus(purchase)) return;
          // Ownership does not depend on the acknowledgement succeeding; StoreKit redelivers it if needed.
          void Promise.resolve()
            .then(() => iap.finishTransaction?.({ purchase, isConsumable: false }))
            .catch(() => {});
          finish({ status: 'owned' });
        };
        const onError = (e: unknown) => {
          if (isCancel(e)) return finish({ status: 'cancelled' });
          const c = codeOf(e);
          if (c && !codes.includes(c)) codes.push(c);
          detail = messageOf(e);
          // A listener error can come before the request's successful return: keep going and reconcile.
        };
        const fail = (fallback: string) => finish({ status: 'failed', codes: codes.length ? codes : [fallback], detail });
        // After the request settles with no transaction (or an error), re-check owned purchases for ~10 s.
        const reconcile = async () => {
          if (done || pending || polling) return;
          polling = true;
          const got = (await ownedList()).find(isPlus);
          polling = false;
          if (done) return;
          if (got) return accept(got);
          checks++;
          if (codes.length || detail) failureChecks++;
          // With an error: ~10 s of re-checks, then fail. With no error and a live purchaseUpdatedListener the sheet
          // may still be open (Face ID, Ask to Buy), so keep listening until the bounded timeout.
          if (failureChecks >= tries || (!listens && checks >= tries)) fail('E_NO_TRANSACTION');
        };
        // The purchase sheet may stay open while someone authenticates: a bounded wait, then Restore covers it.
        const timeout = setTimeout(() => fail('E_PURCHASE_TIMEOUT'), timeoutMs);
        const poll = setInterval(() => void reconcile(), pollMs);
        try {
          if (typeof iap.purchaseUpdatedListener === 'function') {
            subs.push(iap.purchaseUpdatedListener(accept));
            listens = true;
          }
          if (typeof iap.purchaseErrorListener === 'function') subs.push(iap.purchaseErrorListener(onError));
        } catch {
          // older modules still return the transaction, or expose it through getAvailablePurchases
        }
        void (async () => {
          try {
            // Load the StoreKit product even when Unlock is tapped before the price has loaded.
            try {
              await iap.fetchProducts?.({ skus: [PLUS_SKU], type: 'in-app' });
            } catch {
              // the request reports the error
            }
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
      if (!(await connect())) return { status: 'unavailable', codes: [connectCode || 'E_NOT_CONNECTED'] };
      try {
        await iap.restorePurchases?.();
      } catch {
        // fall through to the list
      }
      const yes = (await ownedList()).some(isPlus);
      if (yes) await remember(storage, true);
      return yes ? { status: 'owned' } : { status: 'none' };
    },
  };
}

/** No expo-iap in this binary: nothing can be bought or restored, and entitlement.ts unlocks every Plus feature. */
export function stubStore(storage: Storage): PlusStore {
  return {
    kind: 'stub',
    owned: () => remembered(storage),
    price: async () => null,
    buy: async () => ({ status: 'unavailable', codes: ['E_IAP_NOT_AVAILABLE'] }),
    restore: async () => ({ status: 'unavailable', codes: ['E_IAP_NOT_AVAILABLE'] }),
  };
}

/** "[E_ITEM_UNAVAILABLE]" or "[E_A] [E_B]": the store's codes for the failure alert. */
export const bracketCodes = (codes: readonly string[]) => codes.filter(Boolean).map((c) => `[${c}]`).join(' ');
