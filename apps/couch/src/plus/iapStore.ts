/**
 * Real App Store purchases through expo-iap (owner decision 7 Nov 2026), the same adapter as Linework
 * (apps/linework/src/plus/iapStore.ts): Couch Plus (A$3.99, non-consumable) and the free "7-day Trial" non-consumable
 * on Apple (App Store Review Guideline 3.1.1); Android uses an explicitly started local 7-day evaluation period that
 * persists on this device and is not backed by a store-account trial.
 * Works only in a store build (TestFlight / App Store). In Expo Go the native module is missing and this returns null
 * (src/plus/accessStore.ts then says purchases are unavailable, or uses the mock store in development). Loaded with a
 * guarded require so Expo Go never crashes. Written defensively against the expo-iap API (function names and purchase
 * fields changed between major versions); only a TestFlight sandbox purchase proves it end to end.
 * Tested with a fake store module (src/plus/iapStore.test.ts).
 */
import { NOT_OWNED, PLUS_STORAGE_KEY, type PlusState, type PlusStorage, type PlusStore } from './entitlement';
import { TRIAL_KEY, parseTrialStart, trialStartFromPurchase } from './access';
import type { AppTransactionLike } from './grandfather';

/** Product id in App Store Connect (non-consumable, A$3.99, "Couch Plus"). */
export const PLUS_SKU = 'com.jared797.couch.plus';
/** The free trial (non-consumable, price Free, reference and display name "7-day Trial"; guideline 3.1.1). */
export const TRIAL_SKU = 'com.jared797.couch.trial7';
const SKUS = [PLUS_SKU, TRIAL_SKU];

declare const require: (id: string) => unknown;

type Purchase = { productId?: string; id?: string; transactionId?: string } & Record<string, unknown>;
type Product = { id?: string; productId?: string; displayPrice?: string; localizedPrice?: string };
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
  /** Buys (free) the "7-day Trial" item, or finds the one already owned; saves the start to TRIAL_KEY. */
  startTrial(): Promise<TrialResult>;
  /** iOS AppTransaction (originalAppVersion, environment) for grandfathering; null when unavailable. Never throws. */
  appTransaction(): Promise<AppTransactionLike | null>;
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

let errors: string[] = [];
/** The store's codes/messages from the last failed purchase, first attempt first (shown in the failure alert). */
export function lastPurchaseError(): string | null {
  return errors.length ? errors.join(' / ') : null;
}
const note = (e: unknown) => {
  const d = describe(e);
  if (!errors.includes(d)) errors.push(d);
};
const describe = (e: unknown): string => {
  const o = e as { code?: unknown; message?: unknown } | null;
  return [o?.code, o?.message].filter((x) => x !== undefined && x !== null && String(x) !== '').map(String).join(': ').slice(0, 160) || String(e).slice(0, 160);
};

/** `module` is for tests (a fake expo-iap); the app passes nothing and gets the guarded require. */
export function createIapStore(storage: PlusStorage, now: () => number = () => Date.now(), module?: Iap | null, platform: 'ios' | 'android' = 'ios'): IapStore | null {
  const iap = module === undefined ? loadIap() : module;
  if (!iap) return null;
  // Play sells the lifetime unlock. Its explicitly started local evaluation
  // period does not purchase Apple's free non-consumable trial product.
  const skus = platform === 'android' ? [PLUS_SKU] : SKUS;
  const purchasedPlus = (p: Purchase | null | undefined) =>
    isPlus(p) && (platform !== 'android' || p?.purchaseState === 'purchased');
  const acknowledgePlayPlus = async (p: Purchase): Promise<void> => {
    if (platform !== 'android' || p.isAcknowledgedAndroid === true) return;
    try {
      await iap.finishTransaction({ purchase: p, isConsumable: false });
    } catch {
      // Keep a completed purchase usable. A later refresh/restore retries the
      // acknowledgement, including after interruption or a pending payment.
    }
  };
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
    if (typeof iap.fetchProducts === 'function') tries.push(() => iap.fetchProducts({ skus, type: 'in-app' }));
    if (typeof iap.requestProducts === 'function') tries.push(() => iap.requestProducts({ skus, type: 'inapp' }));
    if (typeof iap.getProducts === 'function') tries.push(() => iap.getProducts(skus));
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
    if (platform === 'android') return null;
    const all = list.filter(isTrial);
    if (all.length === 0) return null;
    const t = now();
    return all.reduce((a, b) => (trialStartFromPurchase(b, t) < trialStartFromPurchase(a, t) ? b : a));
  };

  /** One non-consumable purchase (Plus or the free trial). Resolves once; never hangs the button. */
  const buy = async (sku: string, matches: (p: Purchase | null | undefined) => boolean): Promise<Bought> => {
    await products(); // StoreKit needs the product loaded first
    errors = [];
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
              note(e);
              if (!pending) return finish({ status: 'failed' });
              late ??= setTimeout(() => finish({ status: 'failed' }), 4_000);
            }),
          );
      } catch {
        // listeners optional
      }
      const shapes = [
        () => iap.requestPurchase({ request: { ios: { sku }, android: { skus: [sku] } }, type: 'in-app' }),
        // Newer expo-iap (OpenIAP): platform keys renamed ios -> apple, android -> google.
        () => iap.requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'in-app' }),
        () => iap.requestPurchase({ request: { sku, skus: [sku] }, type: 'inapp' }),
      ];
      const attempt = async (i: number): Promise<void> => {
        try {
          const r = (await shapes[i]!()) as Purchase | Purchase[] | null | undefined;
          pending = false;
          const got = Array.isArray(r) ? r.find(matches) : r;
          if (got && matches(got)) await onPurchase(got);
          else if (errors.length) finish({ status: 'failed' });
        } catch (e) {
          if (cancelled(e)) return finish({ status: 'cancelled' });
          note(e);
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
      const plus = list.find(purchasedPlus);
      if (plus) {
        await acknowledgePlayPlus(plus);
        return saveOwned();
      }
      // A successful Play query is authoritative after a refund/revocation.
      // A failed query still preserves the last known offline entitlement.
      if (platform === 'android') {
        if ((await readSaved()).owned) {
          try { await storage.set(PLUS_STORAGE_KEY, JSON.stringify(NOT_OWNED)); } catch { /* this session still locks */ }
        }
        return { ...NOT_OWNED };
      }
    }
    return readSaved();
  };

  return {
    getState: platform === 'android' ? restore : readSaved,
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
      const r = await buy(PLUS_SKU, purchasedPlus);
      if (r.status === 'bought') return saveOwned();
      // A failed request can still mean it's owned already (bought before, or delivered late): check the store.
      if (r.status === 'failed') {
        const list = await owned();
        const plus = list?.find(purchasedPlus);
        if (plus) {
          await acknowledgePlayPlus(plus);
          return saveOwned();
        }
      }
      return saved;
    },
    async startTrial() {
      if (platform === 'android') {
        // Persist before granting access; failing storage cannot silently start
        // an unrecorded trial. Reinstall can clear this local evaluation period:
        // this is not an account/server-backed entitlement.
        try {
          const t = now();
          const saved = parseTrialStart(await storage.get(TRIAL_KEY), t);
          const start = saved.start ?? t;
          if (saved.start === null || saved.fixed) await storage.set(TRIAL_KEY, String(start));
          return { status: saved.start === null ? 'started' : 'restored', start };
        } catch {
          return { status: 'failed', start: null };
        }
      }
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
    async appTransaction() {
      if (platform === 'android') return null;
      const f = typeof iap.getAppTransactionIOS === 'function' ? iap.getAppTransactionIOS : typeof iap.getAppTransaction === 'function' ? iap.getAppTransaction : null;
      if (!f) return null;
      try {
        if (!(await connect())) return null;
        const tx = (await f()) as AppTransactionLike | null | undefined;
        return tx && typeof tx === 'object' ? tx : null;
      } catch {
        return null;
      }
    },
  };
}
