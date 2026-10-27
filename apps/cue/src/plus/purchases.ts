/** Real non-consumable purchases. A missing store never grants access. */
import { t } from '../i18n';
import { PLUS_PRODUCT_ID } from './entitlement';
import { TRIAL_PRODUCT_ID, trialStartFromPurchase } from './trial';
export type StoreAccess = { plus: boolean; trialStart: number | null };
export type PurchaseResult = { ok: true; access: StoreAccess } | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' | 'empty' | 'pending'; message: string };
export type StorePurchase = { productId?: string; purchaseState?: string } & Record<string, unknown>;
type StoreProduct = { id?: string; productId?: string; displayPrice?: string };
type Subscription = { remove(): void };
export interface IapApi {
  initConnection(): Promise<boolean>;
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
  /** null means store unreadable: keep the last verified offline access. */
  refresh(): Promise<StoreAccess | null>;
}
function loadIap(): IapApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('expo-iap') as IapApi;
    return typeof api.initConnection === 'function' ? api : null;
  } catch { return null; }
}
function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject({ code: 'E_STORE_TIMEOUT' }), milliseconds);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
const SKUS = [PLUS_PRODUCT_ID, TRIAL_PRODUCT_ID];
const matches = (p: StorePurchase, sku: string) => p.productId === sku && (!p.purchaseState || p.purchaseState === 'purchased');
const codeOf = (e: unknown) => String((e as { code?: unknown })?.code ?? 'E_STORE').slice(0, 100);
const failure = (code: string): PurchaseResult => ({ ok: false, reason: 'failed', message: t('plus.failed', { code }) });
const unavailable = (): PurchaseResult => ({ ok: false, reason: 'unavailable', message: t('plus.unavailable') });
export function accessFromPurchases(list: StorePurchase[], now: number): StoreAccess {
  const dates = list.filter(p => matches(p, TRIAL_PRODUCT_ID)).map(p => trialStartFromPurchase(p, now)).filter((x): x is number => x !== null);
  return { plus: list.some(p => matches(p, PLUS_PRODUCT_ID)), trialStart: dates.length ? Math.min(...dates) : null };
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
    try { const list = await bounded(iap!.getAvailablePurchases(), 10_000); return Array.isArray(list) ? list : null; } catch { return null; }
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
    const products = await bounded(iap.fetchProducts({ skus: SKUS, type: 'in-app' }), 15_000);
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
        if (done || !matches(purchase, sku)) return;
        const access = accessFromPurchases([...(prior ?? []), purchase], now());
        if (sku === TRIAL_PRODUCT_ID && access.trialStart === null) { error = 'E_TRIAL_DATE'; return; }
        // Settle once before acknowledgement: event and return may be the same transaction.
        finish({ ok: true, access });
        void Promise.resolve().then(() => iap.finishTransaction({ purchase, isConsumable: false })).catch(() => undefined);
      };
      const onError = (e: unknown) => {
        if (/cancel/i.test(codeOf(e))) return finish({ ok: false, reason: 'cancelled', message: t('plus.cancelled') });
        if (/deferred|pending/i.test(codeOf(e))) return finish({ ok: false, reason: 'pending', message: t('plus.pending') });
        error = codeOf(e); // A listener error may precede the successful request return.
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
        const product = (await bounded(iap.fetchProducts({ skus: SKUS, type: 'in-app' }), 15_000)).find(p => p.id === PLUS_PRODUCT_ID || p.productId === PLUS_PRODUCT_ID);
        return product?.displayPrice ?? null;
      } catch { return null; }
    },
    buy: () => exclusive(() => buy(PLUS_PRODUCT_ID)),
    startTrial: () => exclusive(() => buy(TRIAL_PRODUCT_ID)),
    restore: () => exclusive(async () => {
      if (!(await connect()) || !iap) return unavailable();
      await bounded(iap.restorePurchases(), 20_000);
      const list = await owned();
      if (list === null) return failure('E_RESTORE_UNAVAILABLE');
      const access = accessFromPurchases(list, now());
      if (!access.plus && access.trialStart === null) return { ok: false, reason: 'empty', message: t('plus.nothingToRestore') };
      return { ok: true, access };
    }),
    async refresh() {
      if (busy || !(await connect())) return null;
      const list = await owned();
      return list === null || busy ? null : accessFromPurchases(list, now());
    },
  };
}
