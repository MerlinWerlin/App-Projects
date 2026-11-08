/**
 * The store adapter with a fake expo-iap module (the real one only exists in a store build), ported from Linework's
 * tests (apps/linework/src/plus/iapStore.test.ts). Guideline 3.1.1: the free "7-day Trial" non-consumable is bought
 * (free) or restored, and its transaction date is the trial start.
 */
import { PLUS_SKU, TRIAL_SKU, createIapStore, lastPurchaseError } from './iapStore';
import { PLUS_STORAGE_KEY, type PlusStorage } from './entitlement';
import { TRIAL_KEY, accessFor, parseTrialStart } from './access';

/** Access from a trial start alone (not owned, not grandfathered). */
const trial = (start: number | null, now: number) => accessFor({ owned: false, grandfathered: false, trialStart: start, now });

const DAY = 86_400_000;
const NOW = 20_000 * DAY;

it('Play trial starts on explicit request without connecting to a store or buying an Apple trial', async () => {
  const storage = memoryStorage();
  const iap = fakeIap({ connect: false });
  const store = createIapStore(storage, () => NOW, iap, 'android')!;
  expect(storage.data.has(TRIAL_KEY)).toBe(false);
  expect(await store.startTrial()).toEqual({ status: 'started', start: NOW });
  expect(storage.data.get(TRIAL_KEY)).toBe(String(NOW));
  expect(iap.calls).toEqual([]);
  expect(trial(NOW, NOW + 7 * DAY).full).toBe(false);
});

it('Play trial retains its original start across adapter recreation and cannot restart after expiry', async () => {
  const storage = memoryStorage({ [TRIAL_KEY]: String(NOW - 15 * DAY) });
  const store = createIapStore(storage, () => NOW, fakeIap(), 'android')!;
  expect(await store.startTrial()).toEqual({ status: 'restored', start: NOW - 15 * DAY });
  expect(storage.data.get(TRIAL_KEY)).toBe(String(NOW - 15 * DAY));
});

it('Play trial fails closed if persistence fails', async () => {
  const storage: PlusStorage = { get: async () => null, set: async () => { throw new Error('disk full'); } };
  const store = createIapStore(storage, () => NOW, fakeIap(), 'android')!;
  expect(await store.startTrial()).toEqual({ status: 'failed', start: null });
});

it('Play only fetches the lifetime SKU', async () => {
  const iap = fakeIap();
  const store = createIapStore(memoryStorage(), () => NOW, iap, 'android')!;
  expect(await store.price()).toBe('A$3.99');
  expect(iap.calls.find(c => c.fn === 'fetchProducts')?.arg).toEqual({ skus: [PLUS_SKU], type: 'in-app' });
});

it('Play restore never grants Plus for pending, unknown or missing purchase state', async () => {
  for (const purchaseState of ['pending', 'unknown', undefined]) {
    const storage = memoryStorage();
    const iap = fakeIap({ owned: [{ productId: PLUS_SKU, purchaseState }] });
    const store = createIapStore(storage, () => NOW, iap, 'android')!;
    expect((await store.restore()).owned).toBe(false);
    expect(storage.data.has(PLUS_STORAGE_KEY)).toBe(false);
  }
});

it('Play restores a completed purchase and ignores an Apple trial product', async () => {
  const storage = memoryStorage();
  const iap = fakeIap({ owned: [{ productId: PLUS_SKU, purchaseState: 'purchased' }, { productId: TRIAL_SKU, transactionDate: NOW }] });
  const store = createIapStore(storage, () => NOW, iap, 'android')!;
  expect((await store.restore()).owned).toBe(true);
  expect(storage.data.has(TRIAL_KEY)).toBe(false);
});

it('Play completed purchase requests the lifetime SKU and acknowledges non-consumable ownership', async () => {
  const iap = fakeIap({ buy: sku => ({ productId: sku, purchaseState: 'purchased', purchaseToken: 'fixture-token' }) });
  const store = createIapStore(memoryStorage(), () => NOW, iap, 'android')!;
  expect((await store.purchase()).owned).toBe(true);
  expect(iap.calls.find(c => c.fn === 'requestPurchase')?.arg).toBe(PLUS_SKU);
  const finish = iap.calls.find(c => c.fn === 'finishTransaction')?.arg as { isConsumable: boolean };
  expect(finish.isConsumable).toBe(false);
});

it('Play launch and restore retry an interrupted acknowledgement without charging again', async () => {
  const purchase = { productId: PLUS_SKU, purchaseState: 'purchased', purchaseToken: 'recovered', isAcknowledgedAndroid: false };
  const iap = fakeIap({ owned: [purchase] });
  const storage = memoryStorage();
  let attempts = 0;
  iap.finishTransaction = async (arg: unknown) => {
    iap.calls.push({ fn: 'finishTransaction', arg });
    if (++attempts === 1) throw new Error('connection interrupted');
    purchase.isAcknowledgedAndroid = true;
  };
  expect((await createIapStore(storage, () => NOW, iap, 'android')!.getState()).owned).toBe(true);
  const restarted = createIapStore(storage, () => NOW, iap, 'android')!;
  expect((await restarted.getState()).owned).toBe(true);
  expect((await restarted.restore()).owned).toBe(true);
  expect(attempts).toBe(2);
  expect(iap.calls.some(c => c.fn === 'requestPurchase')).toBe(false);
});

it('Play already acknowledged ownership restores without finishing the transaction again', async () => {
  const iap = fakeIap({ owned: [{ productId: PLUS_SKU, purchaseState: 'purchased', isAcknowledgedAndroid: true }] });
  expect((await createIapStore(memoryStorage(), () => NOW, iap, 'android')!.restore()).owned).toBe(true);
  expect(iap.calls.some(c => c.fn === 'finishTransaction')).toBe(false);
});

it('Play pending or unknown ownership is never acknowledged by refresh', async () => {
  for (const purchaseState of ['pending', 'unknown', undefined]) {
    const iap = fakeIap({ owned: [{ productId: PLUS_SKU, purchaseState, isAcknowledgedAndroid: false }] });
    expect((await createIapStore(memoryStorage(), () => NOW, iap, 'android')!.getState()).owned).toBe(false);
    expect(iap.calls.some(c => c.fn === 'finishTransaction')).toBe(false);
  }
});

it('Play late completed purchase after a failed request is acknowledged before recovery', async () => {
  const purchase = { productId: PLUS_SKU, purchaseState: 'purchased', purchaseToken: 'late' };
  const iap = fakeIap({ owned: [purchase], buy: () => { throw new Error('store request failed'); } });
  expect((await createIapStore(memoryStorage(), () => NOW, iap, 'android')!.purchase()).owned).toBe(true);
  const finish = iap.calls.find(c => c.fn === 'finishTransaction')?.arg;
  expect(finish).toEqual({ purchase, isConsumable: false });
});

it('Play successful empty query removes cached ownership after refund or revocation', async () => {
  const storage = memoryStorage({ [PLUS_STORAGE_KEY]: JSON.stringify({ owned: true, source: 'store', since: NOW }) });
  const store = createIapStore(storage, () => NOW, fakeIap({ owned: [] }), 'android')!;
  expect((await store.getState()).owned).toBe(false);
  expect(JSON.parse(storage.data.get(PLUS_STORAGE_KEY)!).owned).toBe(false);
});

it('Play unavailable connection or failed ownership query preserves the cached offline unlock', async () => {
  for (const disconnect of [true, false]) {
    const storage = memoryStorage({ [PLUS_STORAGE_KEY]: JSON.stringify({ owned: true, source: 'store', since: NOW }) });
    const iap = fakeIap({ connect: !disconnect });
    if (!disconnect) iap.getAvailablePurchases = async () => { throw new Error('offline'); };
    expect((await createIapStore(storage, () => NOW, iap, 'android')!.getState()).owned).toBe(true);
    expect(JSON.parse(storage.data.get(PLUS_STORAGE_KEY)!).owned).toBe(true);
  }
});

it('Apple cached read and restore retain their existing transaction behaviour', async () => {
  const iap = fakeIap({ owned: [{ productId: PLUS_SKU }] });
  const store = createIapStore(memoryStorage(), () => NOW, iap, 'ios')!;
  expect((await store.getState()).owned).toBe(false);
  expect(iap.calls.length).toBe(0);
  expect((await store.restore()).owned).toBe(true);
  expect(iap.calls.some(c => c.fn === 'finishTransaction')).toBe(false);
});

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
      return (opts.offered ?? [PLUS_SKU, TRIAL_SKU]).filter((s) => a.skus.includes(s)).map((id) => ({ id, displayPrice: id === PLUS_SKU ? 'A$3.99' : 'Free' }));
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

it('without the native module (Expo Go) the adapter is null', () => {
  expect(createIapStore(memoryStorage(), () => NOW, null)).toBe(null);
});

it('product ids: Plus and the free 7-day Trial, both fetched together', async () => {
  expect(PLUS_SKU).toBe('com.jared797.couch.plus');
  expect(TRIAL_SKU).toBe('com.jared797.couch.trial7');
  const iap = fakeIap();
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  expect(await store.price()).toBe('A$3.99');
  const f = iap.calls.find((c) => c.fn === 'fetchProducts')!;
  expect((f.arg as { skus: string[] }).skus).toEqual([PLUS_SKU, TRIAL_SKU]);
});

it('Start free trial buys the free item; the start is the transaction date, saved to TRIAL_KEY', async () => {
  const t0 = NOW - 60_000;
  const iap = fakeIap({ buy: (sku) => ({ productId: sku, id: 'tx1', transactionDate: t0 }) });
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, iap)!;
  expect(await store.startTrial()).toEqual({ status: 'started', start: t0 });
  expect(storage.data.get(TRIAL_KEY)).toBe(String(t0));
  expect(iap.calls.filter((c) => c.fn === 'requestPurchase').map((c) => c.arg)).toEqual([TRIAL_SKU]);
  const fin = iap.calls.find((c) => c.fn === 'finishTransaction')!.arg as { isConsumable: boolean };
  expect(fin.isConsumable).toBe(false);
  // The trial never makes Plus owned.
  expect((await store.getState()).owned).toBe(false);
  expect(trial(parseTrialStart(storage.data.get(TRIAL_KEY)!, NOW).start, NOW).reason).toBe('trial');
});

it('no transaction date from the adapter: the trial starts now', async () => {
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, fakeIap({ buy: (sku) => ({ productId: sku }) }))!;
  expect(await store.startTrial()).toEqual({ status: 'started', start: NOW });
});

it('reinstall: the trial already owned comes back with its original date and is never restarted', async () => {
  const old = NOW - 30 * DAY;
  const iap = fakeIap({ owned: [{ productId: TRIAL_SKU, transactionDate: NOW - DAY, originalTransactionDateIOS: old }] });
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, iap)!;
  expect(await store.startTrial()).toEqual({ status: 'restored', start: old });
  expect(iap.calls.some((c) => c.fn === 'requestPurchase')).toBe(false);
  expect(trial(Number(storage.data.get(TRIAL_KEY)), NOW).reason).toBe('expired');
});

it('Restore purchases finds both Plus and the trial', async () => {
  const t0 = NOW - 3 * DAY;
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, fakeIap({ owned: [{ productId: TRIAL_SKU, transactionDate: t0 }, { productId: PLUS_SKU }] }))!;
  const s = await store.restore();
  expect(s.owned).toBe(true);
  expect(storage.data.get(TRIAL_KEY)).toBe(String(t0));
  expect(storage.data.has(PLUS_STORAGE_KEY)).toBeTruthy();
  // Trial only: Plus stays not owned, the trial date is restored.
  const s2 = memoryStorage();
  const only = createIapStore(s2, () => NOW, fakeIap({ owned: [{ productId: TRIAL_SKU, transactionDate: t0 }] }))!;
  expect((await only.restore()).owned).toBe(false);
  expect(s2.data.get(TRIAL_KEY)).toBe(String(t0));
});

it('cancelled, no store, not offered, failed: nothing saved, and the status says which', async () => {
  const cancel = memoryStorage();
  const c = createIapStore(cancel, () => NOW, fakeIap({ buy: () => Promise.reject({ code: 'E_USER_CANCELLED' }) }))!;
  expect(await c.startTrial()).toEqual({ status: 'cancelled', start: null });
  expect(cancel.data.has(TRIAL_KEY)).toBe(false);

  const off = createIapStore(memoryStorage(), () => NOW, fakeIap({ connect: false }))!;
  expect(await off.startTrial()).toEqual({ status: 'unavailable', start: null });

  const missing = createIapStore(memoryStorage(), () => NOW, fakeIap({ offered: [PLUS_SKU], buy: () => Promise.reject(new Error('no product')) }))!;
  expect(await missing.startTrial()).toEqual({ status: 'unavailable', start: null });

  const broken = createIapStore(memoryStorage(), () => NOW, fakeIap({ buy: () => Promise.reject(new Error('network')) }))!;
  expect(await broken.startTrial()).toEqual({ status: 'failed', start: null });
});

it('buying Plus still works and ignores a trial transaction', async () => {
  const storage = memoryStorage();
  const store = createIapStore(storage, () => NOW, fakeIap())!;
  const s = await store.purchase();
  expect(s).toEqual({ owned: true, source: 'store', since: NOW });
  expect(storage.data.has(TRIAL_KEY)).toBe(false);
  // A failed Plus request leaves Plus not owned.
  const wrong = createIapStore(memoryStorage(), () => NOW, fakeIap({ buy: () => Promise.reject(new Error('x')) }))!;
  expect((await wrong.purchase()).owned).toBe(false);
});

it('Plus: a failed request that the store lists as owned still unlocks; the error code is kept for the alert', async () => {
  const iap = fakeIap({
    owned: [{ productId: PLUS_SKU, id: 'old' }],
    buy: () => {
      throw Object.assign(new Error('Item already owned'), { code: 'already-owned' });
    },
  });
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  expect((await store.purchase()).owned).toBe(true);
  expect(lastPurchaseError()).toBe('already-owned: Item already owned');
});

it('Plus: an error from the listener does not stop the second request shape from being tried', async () => {
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
  expect((await store.purchase()).owned).toBe(true);
  expect(n).toBe(2);
});

it('Plus: a real failure reports the store error code', async () => {
  const iap = fakeIap({
    buy: () => {
      throw Object.assign(new Error('Unable to purchase'), { code: 'purchase-error' });
    },
  });
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  expect((await store.purchase()).owned).toBe(false);
  expect(lastPurchaseError()).toBe('purchase-error: Unable to purchase');
});

it('Plus: when the ios request shape is rejected, the apple/google shape (newer expo-iap) buys it', async () => {
  const seen: string[] = [];
  const iap = {
    ...fakeIap(),
    requestPurchase: async (a: any) => {
      seen.push(Object.keys(a.request).join(','));
      if (a.request.apple?.sku) return { productId: a.request.apple.sku, id: 'tx3' };
      throw Object.assign(new Error('sku is required'), { code: 'developer-error' });
    },
  };
  const store = createIapStore(memoryStorage(), () => NOW, iap)!;
  expect((await store.purchase()).owned).toBe(true);
  expect(seen).toEqual(['ios,android', 'apple,google']);
});

it('AppTransaction (grandfathering): read from getAppTransactionIOS, null when missing, failing or on Android', async () => {
  const tx = { originalAppVersion: '14', environment: 'Production' };
  const ios = createIapStore(memoryStorage(), () => NOW, { ...fakeIap(), getAppTransactionIOS: async () => tx })!;
  expect(await ios.appTransaction()).toEqual(tx);
  expect(await createIapStore(memoryStorage(), () => NOW, fakeIap())!.appTransaction()).toBe(null);
  const failing = createIapStore(memoryStorage(), () => NOW, { ...fakeIap(), getAppTransactionIOS: async () => { throw new Error('iOS 15'); } })!;
  expect(await failing.appTransaction()).toBe(null);
  const offline = createIapStore(memoryStorage(), () => NOW, { ...fakeIap({ connect: false }), getAppTransactionIOS: async () => tx })!;
  expect(await offline.appTransaction()).toBe(null);
  const android = createIapStore(memoryStorage(), () => NOW, { ...fakeIap(), getAppTransactionIOS: async () => tx }, 'android')!;
  expect(await android.appTransaction()).toBe(null);
});
