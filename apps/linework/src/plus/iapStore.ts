// Real App Store / Play purchase of Linework Plus through expo-iap (owner decision 22 Oct 2026). Works only in a
// store build (TestFlight / App Store); in Expo Go the native module is missing, this returns null and the app falls
// back to the local mock store. Loaded with a guarded require so Expo Go never crashes.
// Written defensively against the expo-iap API (function names changed between major versions); only a TestFlight
// sandbox purchase proves it end to end (docs/RELEASE_CHECKLIST.md).
import { NOT_OWNED, PLUS_STORAGE_KEY, type PlusState, type PlusStorage, type PlusStore } from './entitlement';

/** Product id to create in App Store Connect (non-consumable, A$2.99). */
export const PLUS_SKU = 'com.jared797.linework.plus';

declare const require: (id: string) => unknown;

type Purchase = { productId?: string; id?: string; transactionId?: string };
type Product = { id?: string; productId?: string; displayPrice?: string; localizedPrice?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Iap = Record<string, any>;

function loadIap(): Iap | null {
  try {
    const m = require('expo-iap') as Iap | null;
    return m && typeof m.initConnection === 'function' && typeof m.requestPurchase === 'function' ? m : null;
  } catch {
    return null;
  }
}

const isPlus = (p: Purchase | null | undefined) => !!p && (p.productId === PLUS_SKU || p.id === PLUS_SKU);
const cancelled = (e: unknown) => /cancel/i.test(String((e as { code?: string; message?: string })?.code ?? '') + String((e as Error)?.message ?? ''));

export function createIapStore(storage: PlusStorage, now: () => number = () => Date.now()): (PlusStore & { price(): Promise<string | null> }) | null {
  const iap = loadIap();
  if (!iap) return null;
  let connected: Promise<boolean> | null = null;
  const connect = () => {
    connected ??= Promise.resolve()
      .then(() => iap.initConnection())
      .then(() => true)
      .catch(() => {
        connected = null;
        return false;
      });
    return connected;
  };
  const saveOwned = async (): Promise<PlusState> => {
    const s: PlusState = { owned: true, source: 'store', since: now() };
    try {
      await storage.set(PLUS_STORAGE_KEY, JSON.stringify(s));
    } catch {
      // still owned this session
    }
    return s;
  };
  const readSaved = async (): Promise<PlusState> => {
    try {
      const raw = await storage.get(PLUS_STORAGE_KEY);
      const j = raw ? (JSON.parse(raw) as PlusState) : null;
      return j && j.owned === true && j.source === 'store' ? j : { ...NOT_OWNED };
    } catch {
      return { ...NOT_OWNED };
    }
  };
  const products = async (): Promise<Product[]> => {
    const tries: (() => Promise<unknown>)[] = [];
    if (typeof iap.fetchProducts === 'function') tries.push(() => iap.fetchProducts({ skus: [PLUS_SKU], type: 'in-app' }));
    if (typeof iap.requestProducts === 'function') tries.push(() => iap.requestProducts({ skus: [PLUS_SKU], type: 'inapp' }));
    if (typeof iap.getProducts === 'function') tries.push(() => iap.getProducts([PLUS_SKU]));
    for (const f of tries) {
      try {
        const r = await f();
        if (Array.isArray(r)) return r as Product[];
      } catch {
        // next shape
      }
    }
    return [];
  };
  const restore = async (): Promise<PlusState> => {
    if (!(await connect())) return readSaved();
    try {
      const list = (await iap.getAvailablePurchases()) as Purchase[] | null;
      if (Array.isArray(list) && list.some(isPlus)) return saveOwned();
    } catch {
      // fall back to what this phone remembers
    }
    return readSaved();
  };

  return {
    getState: readSaved,
    restore,
    async price() {
      if (!(await connect())) return null;
      const p = (await products()).find((x) => x.id === PLUS_SKU || x.productId === PLUS_SKU);
      return p?.displayPrice ?? p?.localizedPrice ?? null;
    },
    async purchase() {
      const saved = await readSaved();
      if (saved.owned) return saved;
      if (!(await connect())) return saved;
      await products(); // StoreKit needs the product loaded first
      return new Promise<PlusState>((resolve) => {
        let done = false;
        const subs: { remove?: () => void }[] = [];
        const finish = (s: PlusState) => {
          if (done) return;
          done = true;
          for (const sub of subs) sub?.remove?.();
          resolve(s);
        };
        const onPurchase = async (p: Purchase) => {
          if (!isPlus(p)) return;
          try {
            await iap.finishTransaction({ purchase: p, isConsumable: false });
          } catch {
            // Apple re-delivers unfinished transactions; ownership still counts
          }
          finish(await saveOwned());
        };
        try {
          if (typeof iap.purchaseUpdatedListener === 'function') subs.push(iap.purchaseUpdatedListener((p: Purchase) => void onPurchase(p)));
          if (typeof iap.purchaseErrorListener === 'function') subs.push(iap.purchaseErrorListener(() => finish(saved)));
        } catch {
          // listeners optional
        }
        const shapes = [
          () => iap.requestPurchase({ request: { ios: { sku: PLUS_SKU }, android: { skus: [PLUS_SKU] } }, type: 'in-app' }),
          () => iap.requestPurchase({ request: { sku: PLUS_SKU, skus: [PLUS_SKU] }, type: 'inapp' }),
        ];
        const attempt = async (i: number): Promise<void> => {
          try {
            const r = (await shapes[i]!()) as Purchase | Purchase[] | null | undefined;
            const got = Array.isArray(r) ? r.find(isPlus) : r;
            if (got && isPlus(got)) await onPurchase(got);
          } catch (e) {
            if (cancelled(e)) return finish(saved);
            if (i + 1 < shapes.length) return attempt(i + 1);
            finish(saved);
          }
        };
        void attempt(0);
        // Never hang the button: give up waiting after 3 minutes (a late purchase is found by Restore).
        setTimeout(() => finish(saved), 180_000);
      });
    },
    async tip() {
      return { ok: false };
    },
  };
}
