// Real App Store / Play purchases through expo-iap (owner decision 22 Oct 2026): Linework Plus (A$2.99) and the free
// "14-day Trial" (App Store Review Guideline 3.1.1, docs/OWNER_1024.md). Works only in a store build (TestFlight /
// App Store); in Expo Go the native module is missing, this returns null and the app falls back to the local mock
// store. Loaded with a guarded require so Expo Go never crashes.
// Written defensively against the expo-iap API (function names and purchase fields changed between major versions);
// only a TestFlight sandbox purchase proves it end to end (docs/RELEASE_CHECKLIST.md). Imports carry `.ts` so Node
// tests can run it with a fake store module (src/plus/iapStore.test.ts).
import { NOT_OWNED, PLUS_STORAGE_KEY, type PlusState, type PlusStorage, type PlusStore } from './entitlement.ts';
import { TRIAL_KEY, trialStartFromPurchase } from './access.ts';

/** Product id to create in App Store Connect (non-consumable, A$2.99). */
export const PLUS_SKU = 'com.jared797.linework.plus';
/** The free trial (non-consumable, price Free, reference and display name "14-day Trial"; guideline 3.1.1). */
export const TRIAL_SKU = 'com.jared797.linework.trial14';
const SKUS = [PLUS_SKU, TRIAL_SKU];

declare const require: (id: string) => unknown;

type Purchase = { productId?: string; id?: string; transactionId?: string } & Record<string, unknown>;
type Product = { id?: string; productId?: string; displayPrice?: string; localizedPrice?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Iap = Record<string, any>;

/**
 * 'started': the free trial transaction went through now. 'restored': the store already had one (reinstall or an
 * earlier start), so `start` is its original date and may be long past. 'cancelled': the person closed the sheet.
 * 'unavailable': no store connection or the product isn't on sale. 'failed': the store answered with an error.
 */
export type TrialStatus = 'started' | 'restored' | 'cancelled' | 'unavailable' | 'failed';
export type TrialResult = { status: TrialStatus; start: number | null };

export type IapStore = PlusStore & {
  price(): Promise<string | null>;
  /** Buys (free) the "14-day Trial" item, or finds the one already owned; saves the start to TRIAL_KEY. */
  startTrial(): Promise<TrialResult>;
};

function loadIap(): Iap | null {
  try {
    const m = require('expo-iap') as Iap | null;
    return m && typeof m.initConnection === 'function' && typeof m.requestPurchase === 'function' ? m : null;
  } catch {
    return null;
  }
}

const isSku = (sku: string) => (p: Purchase | null | undefined) => !!p && (p.productId === sku || p.id === sku);
const isPlus = isSku(PLUS_SKU);
const isTrial = isSku(TRIAL_SKU);
const cancelled = (e: unknown) => /cancel/i.test(String((e as { code?: string; message?: string })?.code ?? '') + String((e as Error)?.message ?? ''));

type Bought = { status: 'bought'; purchase: Purchase } | { status: 'cancelled' | 'failed' };

let lastError: string | null = null;
/** The store's code/message from the last failed purchase (shown in the failure alert so a sandbox problem is readable). */
export function lastPurchaseError(): string | null {
  return lastError;
}
const describe = (e: unknown): string => {
  const o = e as { code?: unknown; message?: unknown } | null;
  return [o?.code, o?.message].filter((x) => x !== undefined && x !== null && String(x) !== '').map(String).join(': ').slice(0, 160) || String(e).slice(0, 160);
};

/** `module` is for tests (a fake expo-iap); the app passes nothing and gets the guarded require. */
export function createIapStore(storage: PlusStorage, now: () => number = () => Date.now(), module?: Iap | null): IapStore | null {
  const iap = module === undefined ? loadIap() : module;
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
  const saveTrial = async (p: Purchase): Promise<number> => {
    const start = trialStartFromPurchase(p, now());
    try {
      await storage.set(TRIAL_KEY, String(start));
    } catch {
      // the store brings it back on the next restore
    }
    return start;
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
    if (typeof iap.fetchProducts === 'function') tries.push(() => iap.fetchProducts({ skus: SKUS, type: 'in-app' }));
    if (typeof iap.requestProducts === 'function') tries.push(() => iap.requestProducts({ skus: SKUS, type: 'inapp' }));
    if (typeof iap.getProducts === 'function') tries.push(() => iap.getProducts(SKUS));
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
  const owned = async (): Promise<Purchase[] | null> => {
    try {
      const list = (await iap.getAvailablePurchases()) as Purchase[] | null;
      return Array.isArray(list) ? list : null;
    } catch {
      return null;
    }
  };
  /** The trial transaction among `list`, earliest first if the store lists it more than once. */
  const trialIn = (list: Purchase[]): Purchase | null => {
    const all = list.filter(isTrial);
    if (all.length === 0) return null;
    const t = now();
    return all.reduce((a, b) => (trialStartFromPurchase(b, t) < trialStartFromPurchase(a, t) ? b : a));
  };

  /** One non-consumable purchase (Plus or the free trial). Resolves once; never hangs the button. */
  const buy = async (sku: string, matches: (p: Purchase | null | undefined) => boolean): Promise<Bought> => {
    await products(); // StoreKit needs the product loaded first
    lastError = null;
    return new Promise<Bought>((resolve) => {
      let done = false;
      // While a request shape is still being tried, a listener error must not end the purchase before the next shape
      // gets its turn (the same error is also thrown by requestPurchase and handled there).
      let pending = true;
      let late: ReturnType<typeof setTimeout> | null = null;
      const subs: { remove?: () => void }[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (r: Bought) => {
        if (done) return;
        done = true;
        for (const sub of subs) sub?.remove?.();
        if (timer) clearTimeout(timer);
        if (late) clearTimeout(late);
        resolve(r);
      };
      const onPurchase = async (p: Purchase) => {
        if (!matches(p) || done) return;
        try {
          await iap.finishTransaction({ purchase: p, isConsumable: false });
        } catch {
          // Apple re-delivers unfinished transactions; the purchase still counts
        }
        finish({ status: 'bought', purchase: p });
      };
      try {
        if (typeof iap.purchaseUpdatedListener === 'function') subs.push(iap.purchaseUpdatedListener((p: Purchase) => void onPurchase(p)));
        if (typeof iap.purchaseErrorListener === 'function')
          subs.push(
            iap.purchaseErrorListener((e: unknown) => {
              if (cancelled(e)) return finish({ status: 'cancelled' });
              lastError = describe(e);
              if (!pending) return finish({ status: 'failed' });
              late ??= setTimeout(() => finish({ status: 'failed' }), 4_000);
            }),
          );
      } catch {
        // listeners optional
      }
      const shapes = [
        () => iap.requestPurchase({ request: { ios: { sku }, android: { skus: [sku] } }, type: 'in-app' }),
        () => iap.requestPurchase({ request: { sku, skus: [sku] }, type: 'inapp' }),
      ];
      const attempt = async (i: number): Promise<void> => {
        try {
          const r = (await shapes[i]!()) as Purchase | Purchase[] | null | undefined;
          pending = false;
          const got = Array.isArray(r) ? r.find(matches) : r;
          if (got && matches(got)) await onPurchase(got);
          else if (lastError) finish({ status: 'failed' });
        } catch (e) {
          if (cancelled(e)) return finish({ status: 'cancelled' });
          lastError = describe(e);
          if (late) {
            clearTimeout(late);
            late = null;
          }
          if (i + 1 < shapes.length) return attempt(i + 1);
          pending = false;
          finish({ status: 'failed' });
        }
      };
      void attempt(0);
      // Never hang the button: give up waiting after 3 minutes (a late purchase is found by Restore).
      timer = setTimeout(() => finish({ status: 'failed' }), 180_000);
    });
  };

  const restore = async (): Promise<PlusState> => {
    if (!(await connect())) return readSaved();
    const list = await owned();
    if (list) {
      const trial = trialIn(list);
      if (trial) await saveTrial(trial);
      if (list.some(isPlus)) return saveOwned();
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
      const r = await buy(PLUS_SKU, isPlus);
      if (r.status === 'bought') return saveOwned();
      // A failed request can still mean it's owned already (bought before, or delivered late): check the store.
      if (r.status === 'failed') {
        const list = await owned();
        if (list?.some(isPlus)) return saveOwned();
      }
      return saved;
    },
    async startTrial() {
      if (!(await connect())) return { status: 'unavailable', start: null };
      // Already owned (reinstall, second phone on the same Apple ID): keep the original date, never restart.
      const list = await owned();
      const existing = list ? trialIn(list) : null;
      if (existing) return { status: 'restored', start: await saveTrial(existing) };
      const r = await buy(TRIAL_SKU, isTrial);
      if (r.status === 'bought') return { status: 'started', start: await saveTrial(r.purchase) };
      if (r.status === 'cancelled') return { status: 'cancelled', start: null };
      // Tell "the store doesn't offer the trial" apart from a one-off error, for the alert text.
      const offered = (await products()).some((x) => x.id === TRIAL_SKU || x.productId === TRIAL_SKU);
      return { status: offered ? 'failed' : 'unavailable', start: null };
    },
    async tip() {
      return { ok: false };
    },
  };
}
