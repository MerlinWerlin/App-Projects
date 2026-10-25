// The store adapter with a fake expo-iap module (the real one only exists in a store build). Guideline 3.1.1: the
// free "14-day Trial" non-consumable is bought (free) or restored, and its transaction date is the trial start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLUS_SKU, TRIAL_SKU, createIapStore, lastPurchaseError } from './iapStore.ts';
import { PLUS_STORAGE_KEY, type PlusStorage } from './entitlement.ts';
import { TRIAL_KEY, accessFor, parseTrialStart } from './access.ts';

const DAY = 86_400_000;
const NOW = 20_000 * DAY;

function memoryStorage(initial: Record<string, string> = {}): PlusStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (k) => (data.has(k) ? (data.get(k) as string) : null),
    set: async (k, v) => {
      data.set(k, v);
    },
  };
}

type Call = { fn: string; arg?: unknown };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeIap(opts: { owned?: any[]; buy?: (sku: string) => any; connect?: boolean; offered?: string[] } = {}) {
  const calls: Call[] = [];
  const mod = {
    calls,
    initConnection: async () => {
      calls.push({ fn: 'initConnection' });
      if (opts.connect === false) throw new Error('no store');
      return true;
    },
    fetchProducts: async (a: { skus: string[] }) => {
      calls.push({ fn: 'fetchProducts', arg: a });
      return (opts.offered ?? [PLUS_SKU, TRIAL_SKU]).filter((s) => a.skus.includes(s)).map((id) => ({ id, displayPrice: id === PLUS_SKU ? 'A$2.99' : 'Free' }));
    },
    getAvailablePurchases: async () => {
      calls.push({ fn: 'getAvailablePurchases' });
      return opts.owned ?? [];
    },
    requestPurchase: async (a: { request: { ios?: { sku: string } } }) => {
      const sku = a.request.ios?.sku ?? '';
      calls.push({ fn: 'requestPurchase', arg: sku });
      return opts.buy ? opts.buy(sku) : { productId: sku, transactionDate: NOW };
    },
    finishTransaction: async (a: unknown) => {
      calls.push({ fn: 'finishTransaction', arg: a });
    },
  };
  return mod;
}

test('without the native module (Expo Go, Node) the adapter is null and the app uses the mock store', () => {
  assert.equal(createIapStore(memoryStorage()), null);
  assert.equal(createIapStore(memoryStorage(), () => NOW, null), null);
});

test('product ids: Plus and the free 14-day Trial, both fetched together', async () => {
  assert.equal(PLUS_SKU, 'com.jared797.linework.plus');
  assert.equal(TRIAL_SKU, 'com.jared797.linework.trial14');
  const iap = fakeIap();
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  assert.equal(await store.price(), 'A$2.99');
  const f = iap.calls.find((c) => c.fn === 'fetchProducts')!;
  assert.deepEqual((f.arg as { skus: string[] }).skus, [PLUS_SKU, TRIAL_SKU]);
});

test('Start free trial buys the free item; the start is the transaction date, saved to TRIAL_KEY', async () => {
  const t0 = NOW - 60_000;
  const iap = fakeIap({ buy: (sku) => ({ productId: sku, id: 'tx1', transactionDate: t0 }) });
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, iap)!;
  assert.deepEqual(await store.startTrial(), { status: 'started', start: t0 });
  assert.equal(storage.data.get(TRIAL_KEY), String(t0));
  assert.deepEqual(iap.calls.filter((c) => c.fn === 'requestPurchase').map((c) => c.arg), [TRIAL_SKU]);
  const fin = iap.calls.find((c) => c.fn === 'finishTransaction')!.arg as { isConsumable: boolean };
  assert.equal(fin.isConsumable, false);
  // The trial never makes Plus owned.
  assert.equal((await store.getState()).owned, false);
  assert.equal(accessFor(false, parseTrialStart(storage.data.get(TRIAL_KEY)!, NOW).start, NOW).reason, 'trial');
});

test('no transaction date from the adapter: the trial starts now', async () => {
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, fakeIap({ buy: (sku) => ({ productId: sku }) }))!;
  assert.deepEqual(await store.startTrial(), { status: 'started', start: NOW });
});

test('reinstall: the trial already owned comes back with its original date and is never restarted', async () => {
  const old = NOW - 30 * DAY;
  const iap = fakeIap({ owned: [{ productId: TRIAL_SKU, transactionDate: NOW - DAY, originalTransactionDateIOS: old }] });
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, iap)!;
  assert.deepEqual(await store.startTrial(), { status: 'restored', start: old });
  assert.equal(iap.calls.some((c) => c.fn === 'requestPurchase'), false);
  assert.equal(accessFor(false, Number(storage.data.get(TRIAL_KEY)), NOW).reason, 'expired');
});

test('Restore purchases finds both Plus and the trial', async () => {
  const t0 = NOW - 3 * DAY;
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, fakeIap({ owned: [{ productId: TRIAL_SKU, transactionDate: t0 }, { productId: PLUS_SKU }] }))!;
  const s = await store.restore();
  assert.equal(s.owned, true);
  assert.equal(storage.data.get(TRIAL_KEY), String(t0));
  assert.ok(storage.data.has(PLUS_STORAGE_KEY));
  // Trial only: Plus stays not owned, the trial date is restored.
  const s2 = memoryStorage();
  const only = createIapStore(s2, () => NOW, fakeIap({ owned: [{ productId: TRIAL_SKU, transactionDate: t0 }] }))!;
  assert.equal((await only.restore()).owned, false);
  assert.equal(s2.data.get(TRIAL_KEY), String(t0));
});

test('cancelled, no store, not offered, failed: nothing saved, and the status says which', async () => {
  const cancel = memoryStorage();
  const c = createIapStore(cancel, () => NOW, fakeIap({ buy: () => Promise.reject({ code: 'E_USER_CANCELLED' }) }))!;
  assert.deepEqual(await c.startTrial(), { status: 'cancelled', start: null });
  assert.equal(cancel.data.has(TRIAL_KEY), false);

  const off = createIapStore(memoryStorage(), () => NOW, fakeIap({ connect: false }))!;
  assert.deepEqual(await off.startTrial(), { status: 'unavailable', start: null });

  const missing = createIapStore(memoryStorage(), () => NOW, fakeIap({ offered: [PLUS_SKU], buy: () => Promise.reject(new Error('no product')) }))!;
  assert.deepEqual(await missing.startTrial(), { status: 'unavailable', start: null });

  const broken = createIapStore(memoryStorage(), () => NOW, fakeIap({ buy: () => Promise.reject(new Error('network')) }))!;
  assert.deepEqual(await broken.startTrial(), { status: 'failed', start: null });
});

test('buying Plus still works and ignores a trial transaction', async () => {
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, fakeIap())!;
  const s = await store.purchase();
  assert.deepEqual(s, { owned: true, source: 'store', since: NOW });
  assert.equal(storage.data.has(TRIAL_KEY), false);
  // A failed Plus request leaves Plus not owned.
  const wrong = createIapStore(memoryStorage(), () => NOW, fakeIap({ buy: () => Promise.reject(new Error('x')) }))!;
  assert.equal((await wrong.purchase()).owned, false);
});

test('Plus: a failed request that the store lists as owned still unlocks; the error code is kept for the alert', async () => {
  const iap = fakeIap({
    owned: [{ productId: PLUS_SKU, id: 'old' }],
    buy: () => {
      throw Object.assign(new Error('Item already owned'), { code: 'already-owned' });
    },
  });
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  assert.equal((await store.purchase()).owned, true);
  assert.equal(lastPurchaseError(), 'already-owned: Item already owned');
});

test('Plus: an error from the listener does not stop the second request shape from being tried', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onErr: ((e: any) => void) | null = null;
  let n = 0;
  const iap = {
    ...fakeIap(),
    purchaseErrorListener: (f: (e: unknown) => void) => {
      onErr = f;
      return { remove: () => {} };
    },
    requestPurchase: async () => {
      n += 1;
      if (n === 1) {
        onErr?.({ code: 'unknown', message: 'first shape rejected' });
        throw new Error('first shape rejected');
      }
      return { productId: PLUS_SKU, id: 'tx2' };
    },
  };
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  assert.equal((await store.purchase()).owned, true);
  assert.equal(n, 2);
});

test('Plus: a real failure reports the store error code', async () => {
  const iap = fakeIap({
    buy: () => {
      throw Object.assign(new Error('Unable to purchase'), { code: 'purchase-error' });
    },
  });
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  assert.equal((await store.purchase()).owned, false);
  assert.equal(lastPurchaseError(), 'purchase-error: Unable to purchase');
});

test('Plus: when the ios request shape is rejected, the apple/google shape (newer expo-iap) buys it', async () => {
  const seen: string[] = [];
  const iap = {
    ...fakeIap(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestPurchase: async (a: any) => {
      seen.push(Object.keys(a.request).join(','));
      if (a.request.apple?.sku) return { productId: a.request.apple.sku, id: 'tx3' };
      throw Object.assign(new Error('sku is required'), { code: 'developer-error' });
    },
  };
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  assert.equal((await store.purchase()).owned, true);
  assert.deepEqual(seen, ['ios,android', 'apple,google']);
});
