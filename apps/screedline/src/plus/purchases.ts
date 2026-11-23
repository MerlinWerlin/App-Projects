/**
 * Real non-consumable purchases through expo-iap (pinned 6.2.0, App Factory release standard §2).
 * Adapted from Cue's tested provider. A missing store never grants access.
 */
import { type Access, FULL_AUSTRALIA_PRICE, FULL_PRODUCT_ID, TRIAL_PRODUCT_ID, trialStartFromPurchase } from './entitlement.ts';

export type PurchaseResult =
  | { ok: true; access: Access }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' | 'empty' | 'pending'; message: string };
export type StorePurchase = { productId?: string; purchaseState?: string } & Record<string, unknown>;
type StoreProduct = { id?: string; productId?: string; displayPrice?: string; currency?: string };
type Subscription = { remove(): void };
export interface IapApi {
  initConnection(): Promise<boolean>;
  getStorefront?(): Promise<string>;
  fetchProducts(args: { skus: string[]; type: 'in-app' }): Promise<StoreProduct[]>;
  requestPurchase(args: { request: { ios: { sku: string }; apple: { sku: string }; android: { skus: string[] }; google: { skus: string[] } }; type: 'in-app' }): Promise<StorePurchase | StorePurchase[] | null | undefined | void>;
  getAvailablePurchases(): Promise<StorePurchase[]>;
  restorePurchases(): Promise<unknown>;
  finishTransaction(args: { purchase: StorePurchase; isConsumable: false }): Promise<unknown>;
  purchaseUpdatedListener(fn: (purchase: StorePurchase) => void): Subscription;
  purchaseErrorListener(fn: (error: unknown) => void): Subscription;
}
export interface PurchaseProvider {
  price(): Promise<string | null>;
  buy(): Promise<PurchaseResult>;
  startTrial(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
  /** null means the store could not be read: keep the last verified access. */
  refresh(): Promise<Access | null>;
  /** Long-lived listener: purchases approved later (Ask to Buy) or finished outside a buy() call. Returns unsubscribe. */
  watch(onAccess: (a: Access) => void): () => void;
}

export const MESSAGES = {
  unavailable: 'The App Store isn’t available right now. Nothing was charged. Check your connection and try again.',
  cancelled: 'Cancelled. Nothing was charged.',
  pending: 'Waiting for approval (for example Ask to Buy). It unlocks as soon as it’s approved.',
  nothing: 'No purchases found for this Apple ID.',
  failed: (code: string) => `The purchase didn’t go through. Nothing was charged. [${code}]`,
};

declare const require: (id: string) => unknown;
function loadIap(): IapApi | null {
  try {
    const api = require('expo-iap') as IapApi;
    return typeof api.initConnection === 'function' ? api : null;
  } catch { return null; }
}
function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject({ code: 'E_STORE_TIMEOUT' }), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}
const SKUS = [FULL_PRODUCT_ID, TRIAL_PRODUCT_ID];
const matches = (p: StorePurchase, sku: string) => p.productId === sku && (!p.purchaseState || p.purchaseState === 'purchased');
const codeOf = (e: unknown) => String((e as { code?: unknown })?.code ?? 'E_STORE').slice(0, 100);
const failure = (code: string): PurchaseResult => ({ ok: false, reason: 'failed', message: MESSAGES.failed(code) });
const unavailable = (): PurchaseResult => ({ ok: false, reason: 'unavailable', message: MESSAGES.unavailable });

export function accessFromPurchases(list: StorePurchase[], now: number): Access {
  const dates = list.filter(p => matches(p, TRIAL_PRODUCT_ID)).map(p => trialStartFromPurchase(p, now)).filter((x): x is number => x !== null);
  return { full: list.some(p => matches(p, FULL_PRODUCT_ID)), trialStart: dates.length ? Math.min(...dates) : null };
}

export function createPurchaseProvider(module?: IapApi | null, now: () => number = Date.now): PurchaseProvider {
  const iap = module === undefined ? loadIap() : module;
  let connection: Promise<boolean> | null = null;
  let busy = false;
  const connect = (): Promise<boolean> => {
    if (!iap) return Promise.resolve(false);
    connection ??= Promise.resolve().then(() => bounded(iap.initConnection(), 20_000)).then(ok => {
      if (!ok) connection = null;
      return ok;
    }).catch(() => { connection = null; return false; });
    return connection;
  };
  const owned = async (): Promise<StorePurchase[] | null> => {
    try {
      const list = await bounded(iap!.getAvailablePurchases(), 10_000);
      return Array.isArray(list) ? list : null;
    } catch { return null; }
  };
  const exclusive = async (action: () => Promise<PurchaseResult>): Promise<PurchaseResult> => {
    if (busy) return failure('E_PURCHASE_IN_PROGRESS');
    busy = true;
    try { return await action(); } catch (e) { return failure(codeOf(e)); } finally { busy = false; }
  };
  const buy = async (sku: string): Promise<PurchaseResult> => {
    if (!(await connect()) || !iap) return unavailable();
    const prior = await owned();
    if (prior?.some(p => matches(p, sku))) {
      const access = accessFromPurchases(prior, now());
      return sku === TRIAL_PRODUCT_ID && access.trialStart === null ? failure('E_TRIAL_DATE') : { ok: true, access };
    }
    const products = await bounded(iap.fetchProducts({ skus: [...SKUS], type: 'in-app' }), 15_000);
    if (!products.some(p => p.id === sku || p.productId === sku)) return unavailable();
    return new Promise<PurchaseResult>(resolve => {
      let done = false, pendingRequest = true, polling = false, failureChecks = 0;
      let error: string | null = null;
      const subs: Subscription[] = [];
      const finish = (result: PurchaseResult) => {
        if (done) return;
        done = true;
        clearTimeout(timeout); clearInterval(poll);
        subs.forEach(sub => { try { sub.remove(); } catch { /* cleanup must not hide ownership */ } });
        resolve(result);
      };
      const accept = (purchase: StorePurchase) => {
        if (!done && purchase.productId === sku && purchase.purchaseState === 'pending') {
          finish({ ok: false, reason: 'pending', message: MESSAGES.pending });
          return;
        }
        if (done || !matches(purchase, sku)) return;
        const access = accessFromPurchases([...(prior ?? []), purchase], now());
        if (sku === TRIAL_PRODUCT_ID && access.trialStart === null) { error = 'E_TRIAL_DATE'; return; }
        finish({ ok: true, access });
        void Promise.resolve().then(() => iap.finishTransaction({ purchase, isConsumable: false })).catch(() => undefined);
      };
      const onError = (e: unknown) => {
        if (/cancel/i.test(codeOf(e))) return finish({ ok: false, reason: 'cancelled', message: MESSAGES.cancelled });
        if (/deferred|pending/i.test(codeOf(e))) return finish({ ok: false, reason: 'pending', message: MESSAGES.pending });
        error = codeOf(e); // a listener error may come before a successful return
      };
      const reconcile = async () => {
        if (done || pendingRequest || polling) return;
        polling = true;
        const list = await owned();
        polling = false;
        if (done) return;
        const purchase = list?.find(p => matches(p, sku));
        if (purchase) accept(purchase);
        if (error && ++failureChecks >= 10) finish(failure(error));
      };
      const timeout = setTimeout(() => finish(failure(error ?? 'E_PURCHASE_TIMEOUT')), 180_000);
      const poll = setInterval(() => void reconcile(), 1000);
      try {
        subs.push(iap.purchaseUpdatedListener(accept));
        subs.push(iap.purchaseErrorListener(onError));
      } catch (e) { error = codeOf(e); }
      void (async () => {
        try {
          const result = await iap.requestPurchase({ request: { ios: { sku }, apple: { sku }, android: { skus: [sku] }, google: { skus: [sku] } }, type: 'in-app' });
          for (const purchase of Array.isArray(result) ? result : result ? [result] : []) {
            if (purchase.productId === sku && purchase.purchaseState === 'pending') onError({ code: 'pending' });
            else accept(purchase);
          }
        } catch (e) { onError(e); }
        finally { pendingRequest = false; void reconcile(); }
      })();
    });
  };
  return {
    async price() {
      if (!(await connect()) || !iap) return null;
      try {
        const [products, storefront] = await Promise.all([
          bounded(iap.fetchProducts({ skus: [...SKUS], type: 'in-app' }), 15_000),
          iap.getStorefront ? bounded(iap.getStorefront(), 5000).catch(() => null) : null,
        ]);
        const product = products.find(p => p.id === FULL_PRODUCT_ID || p.productId === FULL_PRODUCT_ID);
        if (!product?.displayPrice?.trim()) return null;
        const currency = product.currency?.toUpperCase();
        // TestFlight can return USD metadata while its sheet uses the Australian store.
        if (['AU', 'AUS'].includes(storefront?.trim().toUpperCase() ?? '') && currency && currency !== 'AUD') return FULL_AUSTRALIA_PRICE;
        if (currency === 'AUD') return product.displayPrice.replace(/^\$/, 'A$');
        return currency && !product.displayPrice.includes(currency) ? `${currency} ${product.displayPrice}` : product.displayPrice;
      } catch { return null; }
    },
    buy: () => exclusive(() => buy(FULL_PRODUCT_ID)),
    startTrial: () => exclusive(() => buy(TRIAL_PRODUCT_ID)),
    restore: () => exclusive(async () => {
      if (!(await connect()) || !iap) return unavailable();
      await bounded(iap.restorePurchases(), 20_000).catch(() => undefined);
      const list = await owned();
      if (list === null) return failure('E_RESTORE_UNAVAILABLE');
      const access = accessFromPurchases(list, now());
      if (!access.full && access.trialStart === null) return { ok: false, reason: 'empty', message: MESSAGES.nothing };
      return { ok: true, access };
    }),
    watch(onAccess) {
      let sub: Subscription | null = null;
      let stopped = false;
      void connect().then(ok => {
        if (!ok || !iap || stopped) return;
        try {
          sub = iap.purchaseUpdatedListener(purchase => {
            if (!SKUS.some(sku => matches(purchase, sku))) return;
            void Promise.resolve().then(() => iap.finishTransaction({ purchase, isConsumable: false })).catch(() => undefined);
            void owned().then(list => onAccess(accessFromPurchases(list && list.length ? list : [purchase], now())));
          });
        } catch { /* listener unavailable: refresh on foreground still applies access */ }
      });
      return () => { stopped = true; try { sub?.remove(); } catch { /* ignore */ } };
    },
    async refresh() {
      if (busy || !(await connect())) return null;
      const list = await owned();
      return list === null || busy ? null : accessFromPurchases(list, now());
    },
  };
}
