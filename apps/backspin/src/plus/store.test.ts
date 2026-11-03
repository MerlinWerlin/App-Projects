import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore, PLUS_KEY, PLUS_SKU, testStore } from './store.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v) };
};

test('Expo Go (no expo-iap) gets the labelled test store', async () => {
  const s = createStore(mem(), null);
  assert.equal(s.kind, 'test');
  assert.equal(await s.owned(), false);
  assert.equal((await s.buy()).status, 'owned');
  assert.equal(await s.owned(), true);
});

test('store purchase, cancel and restore', async () => {
  let owned: { productId: string }[] = [];
  const fake = {
    initConnection: async () => true,
    getAvailablePurchases: async () => owned,
    fetchProducts: async () => [{ id: PLUS_SKU, displayPrice: 'A$3.99' }],
    requestPurchase: async () => {
      owned = [{ productId: PLUS_SKU }];
      return [{ productId: PLUS_SKU }];
    },
    finishTransaction: async () => true,
  };
  const st = mem();
  const s = createStore(st, fake);
  assert.equal(s.kind, 'store');
  assert.equal(await s.price(), 'A$3.99');
  assert.equal(await s.owned(), false);
  assert.equal((await s.buy()).status, 'owned');
  assert.equal(await createStore(st, fake).owned(), true);
  const cancelling = createStore(mem(), { ...fake, getAvailablePurchases: async () => [], requestPurchase: async () => { throw Object.assign(new Error('User cancelled'), { code: 'E_USER_CANCELLED' }); } });
  assert.equal((await cancelling.buy()).status, 'cancelled');
  const fresh = createStore(mem(), fake);
  assert.equal(await fresh.restore(), true);
  assert.equal((await testStore(mem()).restore()), false);
});

test('a failed purchase reports the store error code', async () => {
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [],
    requestPurchase: async () => {
      throw Object.assign(new Error('Item unavailable'), { code: 'E_ITEM_UNAVAILABLE' });
    },
  });
  const r = await s.buy();
  assert.equal(r.status, 'failed');
  assert.equal(r.status === 'failed' && r.detail, 'E_ITEM_UNAVAILABLE: Item unavailable');
});

test('event-only purchase waits for StoreKit, acknowledges once, and removes listeners', async () => {
  let updated!: (p: { productId: string }) => void;
  let acknowledged = 0;
  let removed = 0;
  let requestSent!: () => void;
  const sent = new Promise<void>((r) => { requestSent = r; });
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [],
    purchaseUpdatedListener: (f: typeof updated) => { updated = f; return { remove: () => removed++ }; },
    purchaseErrorListener: () => ({ remove: () => removed++ }),
    requestPurchase: async (request: { request: { apple: { sku: string }; ios: { sku: string } } }) => {
      assert.equal(request.request.apple.sku, PLUS_SKU);
      assert.equal(request.request.ios.sku, PLUS_SKU);
      requestSent();
    },
    finishTransaction: async ({ isConsumable }: { isConsumable: boolean }) => { assert.equal(isConsumable, false); acknowledged++; },
  });
  const buying = s.buy();
  await sent;
  updated({ productId: 'unrelated.item' });
  updated({ productId: PLUS_SKU });
  updated({ productId: PLUS_SKU });
  assert.equal((await buying).status, 'owned');
  assert.equal(acknowledged, 1);
  assert.equal(removed, 2);
  assert.equal(await s.owned(), true);
});

test('listener error cannot override the successful request transaction', async () => {
  let error!: (e: unknown) => void;
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [],
    purchaseErrorListener: (f: typeof error) => { error = f; return { remove() {} }; },
    requestPurchase: async () => { error(new Error('temporary error')); return { productId: PLUS_SKU }; },
  });
  assert.equal((await s.buy()).status, 'owned');
});

test('a rejected request still recovers a transaction from StoreKit', async () => {
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [{ productId: PLUS_SKU }],
    requestPurchase: async () => { throw new Error('response interrupted'); },
  });
  assert.equal((await s.buy()).status, 'owned');
});

test('StoreKit cancellation event clears the pending purchase and subscriptions', async () => {
  let cancel!: (e: unknown) => void;
  let removed = 0;
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [],
    purchaseErrorListener: (f: typeof cancel) => { cancel = f; return { remove: () => removed++ }; },
    requestPurchase: async () => { cancel({ code: 'E_USER_CANCELLED' }); },
  });
  assert.equal((await s.buy()).status, 'cancelled');
  assert.equal(removed, 1);
});

const paidAndroid = { productId: PLUS_SKU, purchaseState: 'purchased', purchaseToken: 'synthetic-test-token' };

test('Android pending, unknown and incomplete purchases never grant or acknowledge Plus', async () => {
  for (const purchase of [
    { ...paidAndroid, purchaseState: 'pending' },
    { ...paidAndroid, purchaseState: 'unknown' },
    { ...paidAndroid, purchaseState: undefined },
    { ...paidAndroid, purchaseToken: null },
    { ...paidAndroid, productId: 'another.product' },
    { id: PLUS_SKU, purchaseState: 'purchased', purchaseToken: 'token' },
  ]) {
    let acknowledgements = 0;
    const storage = mem();
    const store = createStore(storage, {
      initConnection: async () => true,
      getAvailablePurchases: async () => [purchase],
      finishTransaction: async () => acknowledgements++,
    }, 'android');
    assert.equal(await store.owned(), false);
    assert.equal(await store.restore(), false);
    assert.equal(await storage.get(PLUS_KEY), '0');
    assert.equal(acknowledgements, 0);
  }
});

test('Android pending listener and request wait for the completed payment event', async () => {
  let updated!: (purchase: object) => void;
  let acknowledge = 0;
  let sent!: () => void;
  const requested = new Promise<void>((resolve) => { sent = resolve; });
  const storage = mem();
  const pending = { ...paidAndroid, purchaseState: 'pending' };
  const store = createStore(storage, {
    initConnection: async () => true,
    getAvailablePurchases: async () => [pending],
    purchaseUpdatedListener: (callback: typeof updated) => { updated = callback; return { remove() {} }; },
    requestPurchase: async () => { updated(pending); sent(); return pending; },
    finishTransaction: async () => { acknowledge++; },
  }, 'android');
  let resolved = false;
  const buying = store.buy().then((r) => { resolved = true; return r; });
  await requested;
  await new Promise<void>((r) => setImmediate(r));
  assert.equal(resolved, false);
  assert.equal(acknowledge, 0);
  assert.notEqual(await storage.get(PLUS_KEY), '1');
  updated(paidAndroid);
  assert.equal((await buying).status, 'owned');
  assert.equal(acknowledge, 1);
  assert.equal(await storage.get(PLUS_KEY), '1');
});

test('Android failed acknowledgement is retried even with locally cached ownership', async () => {
  const storage = mem();
  let tries = 0;
  const store = createStore(storage, {
    initConnection: async () => true,
    getAvailablePurchases: async () => [paidAndroid],
    requestPurchase: async () => paidAndroid,
    finishTransaction: async () => { if (++tries === 1) throw new Error('temporary connection loss'); },
  }, 'android');
  assert.equal((await store.buy()).status, 'owned');
  await new Promise<void>((r) => setImmediate(r));
  assert.equal(tries, 1);
  assert.equal(await store.owned(), true);
  assert.equal(tries, 2);
  assert.equal(await store.restore(), true);
  assert.equal(tries, 2);
});

test('Android startup acknowledges completed unacknowledged payments without another purchase', async () => {
  let tries = 0;
  const storage = mem();
  await storage.set(PLUS_KEY, '1');
  const store = createStore(storage, {
    initConnection: async () => true,
    getAvailablePurchases: async () => [paidAndroid],
    finishTransaction: async ({ isConsumable }: { isConsumable: boolean }) => { assert.equal(isConsumable, false); tries++; },
  }, 'android');
  assert.equal(await store.owned(), true);
  assert.equal(tries, 1);
});

test('Android trusts successful current ownership queries and preserves paid access during outages', async () => {
  const storage = mem();
  await storage.set(PLUS_KEY, '1');
  let unavailable = true;
  const store = createStore(storage, {
    initConnection: async () => true,
    getAvailablePurchases: async () => { if (unavailable) throw new Error('offline'); return []; },
  }, 'android');
  assert.equal(await store.owned(), true);
  assert.equal(await storage.get(PLUS_KEY), '1');
  unavailable = false;
  assert.equal(await store.owned(), false);
  assert.equal(await storage.get(PLUS_KEY), '0');
});

test('Android restore skips payments Google already acknowledged', async () => {
  const store = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [{ ...paidAndroid, isAcknowledgedAndroid: true }],
    finishTransaction: async () => assert.fail('already acknowledged'),
  }, 'android');
  assert.equal(await store.restore(), true);
});
