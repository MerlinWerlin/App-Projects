// T16: the guarded expo-iap adapter, driven by fake modules (release standard §2 purchase rules).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bracketCodes, createStore, PLUS_KEY, PLUS_SKU } from './store.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { m, get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v) };
};
const fast = { pollMs: 5, recheckTries: 10, timeoutMs: 2000 };

test('product id is exactly com.jared797.satchel.plus', () => {
  assert.equal(PLUS_SKU, 'com.jared797.satchel.plus');
});

test('no expo-iap in the binary: a stub that never crashes and never pretends to buy', async () => {
  const st = mem();
  const s = createStore(st, null);
  assert.equal(s.kind, 'stub');
  assert.equal(await s.price(), null);
  assert.equal((await s.buy()).status, 'unavailable');
  assert.equal((await s.restore()).status, 'unavailable');
  assert.equal(await s.owned(), false);
  assert.equal(st.m.has(PLUS_KEY), false);
});

test('without a Metro bundle the lazy require fails safely to the stub', () => {
  assert.equal(createStore(mem()).kind, 'stub');
});

test('store purchase, price, cancel and restore', async () => {
  let owned: { productId: string }[] = [];
  let request: unknown;
  const fake = {
    initConnection: async () => true,
    getAvailablePurchases: async () => owned,
    fetchProducts: async () => [{ id: PLUS_SKU, displayPrice: 'A$7.99' }],
    requestPurchase: async (r: unknown) => {
      request = r;
      owned = [{ productId: PLUS_SKU }];
      return [{ productId: PLUS_SKU }];
    },
    finishTransaction: async () => true,
  };
  const st = mem();
  const s = createStore(st, fake, fast);
  assert.equal(s.kind, 'store');
  assert.equal(await s.price(), 'A$7.99');
  assert.equal(await s.owned(), false);
  assert.equal((await s.buy()).status, 'owned');
  assert.deepEqual(request, {
    request: { ios: { sku: PLUS_SKU }, android: { skus: [PLUS_SKU] }, apple: { sku: PLUS_SKU }, google: { skus: [PLUS_SKU] } },
    type: 'in-app',
  });
  assert.equal(await createStore(st, fake, fast).owned(), true, 'cached on the phone');
  const cancelling = createStore(mem(), { ...fake, getAvailablePurchases: async () => [], requestPurchase: async () => { throw Object.assign(new Error('User cancelled'), { code: 'E_USER_CANCELLED' }); } }, fast);
  assert.equal((await cancelling.buy()).status, 'cancelled');
  assert.deepEqual(await createStore(mem(), fake, fast).restore(), { status: 'owned' });
  assert.deepEqual(await createStore(mem(), { ...fake, getAvailablePurchases: async () => [] }, fast).restore(), { status: 'none' });
});

test('a failure re-checks getAvailablePurchases ~10 times, then reports the store error code', async () => {
  let checks = 0;
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => { checks++; return []; },
    requestPurchase: async () => { throw Object.assign(new Error('Item unavailable'), { code: 'E_ITEM_UNAVAILABLE' }); },
  }, fast);
  const r = await s.buy();
  assert.equal(r.status, 'failed');
  assert.deepEqual(r.status === 'failed' && r.codes, ['E_ITEM_UNAVAILABLE']);
  assert.ok(checks >= 10, `re-checked ${checks} times`);
  assert.equal(bracketCodes(['E_ITEM_UNAVAILABLE']), '[E_ITEM_UNAVAILABLE]');
  assert.equal(bracketCodes(['E_A', '', 'E_B']), '[E_A] [E_B]');
});

test('an empty result with no listener recovers a late transaction during the re-check', async () => {
  let n = 0;
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => (++n >= 4 ? [{ productId: PLUS_SKU }] : []),
    requestPurchase: async () => undefined,
  }, fast);
  assert.equal((await s.buy()).status, 'owned');
});

test('an empty result that never turns into a transaction fails with a code', async () => {
  const s = createStore(mem(), { initConnection: async () => true, getAvailablePurchases: async () => [], requestPurchase: async () => [] }, fast);
  const r = await s.buy();
  assert.deepEqual(r.status === 'failed' && r.codes, ['E_NO_TRANSACTION']);
});

test('event-only purchase: purchaseUpdatedListener, finishTransaction isConsumable false once, listeners removed', async () => {
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
    requestPurchase: async () => { requestSent(); },
    finishTransaction: async ({ isConsumable }: { isConsumable: boolean }) => { assert.equal(isConsumable, false); acknowledged++; },
  }, { ...fast, recheckTries: 1000 });
  const buying = s.buy();
  await sent;
  updated({ productId: 'unrelated.item' });
  updated({ productId: PLUS_SKU });
  updated({ productId: PLUS_SKU });
  assert.equal((await buying).status, 'owned');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(acknowledged, 1);
  assert.equal(removed, 2);
  assert.equal(await s.owned(), true);
});

test('a listener error does not end the attempt: the request still returns the transaction', async () => {
  let error!: (e: unknown) => void;
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [],
    purchaseErrorListener: (f: typeof error) => { error = f; return { remove() {} }; },
    requestPurchase: async () => { error(Object.assign(new Error('temporary'), { code: 'E_SERVICE_ERROR' })); return { productId: PLUS_SKU }; },
  }, fast);
  assert.equal((await s.buy()).status, 'owned');
});

test('a rejected request still recovers a transaction from StoreKit', async () => {
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [{ productId: PLUS_SKU }],
    requestPurchase: async () => { throw new Error('response interrupted'); },
  }, fast);
  assert.equal((await s.buy()).status, 'owned');
});

test('cancellation from the error listener clears the subscriptions', async () => {
  let cancel!: (e: unknown) => void;
  let removed = 0;
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [],
    purchaseErrorListener: (f: typeof cancel) => { cancel = f; return { remove: () => removed++ }; },
    requestPurchase: async () => { cancel({ code: 'E_USER_CANCELLED' }); },
  }, fast);
  assert.equal((await s.buy()).status, 'cancelled');
  assert.equal(removed, 1);
});

test('App Store unreachable: unavailable with a code, no charge path taken, retry reconnects', async () => {
  let tries = 0;
  let bought = false;
  const s = createStore(mem(), {
    initConnection: async () => { if (++tries === 1) throw Object.assign(new Error('offline'), { code: 'E_NETWORK_ERROR' }); return true; },
    getAvailablePurchases: async () => (bought ? [{ productId: PLUS_SKU }] : []),
    requestPurchase: async () => { bought = true; return { productId: PLUS_SKU }; },
  }, fast);
  assert.deepEqual(await s.buy(), { status: 'unavailable', codes: ['E_NETWORK_ERROR'] });
  assert.equal(bought, false);
  assert.equal((await s.buy()).status, 'owned');
});

test('a void request with a live listener keeps waiting past the ~10 s re-check (sheet still open)', async () => {
  let updated!: (p: { productId: string }) => void;
  let checks = 0;
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => { checks++; return []; },
    purchaseUpdatedListener: (f: typeof updated) => { updated = f; return { remove() {} }; },
    requestPurchase: async () => undefined,
  }, fast);
  const buying = s.buy();
  while (checks < 15) await new Promise((r) => setTimeout(r, 5));
  updated({ productId: PLUS_SKU });
  assert.equal((await buying).status, 'owned');
});

test('a listener error followed by nothing fails after the re-check with the code in the result', async () => {
  let error!: (e: unknown) => void;
  const s = createStore(mem(), {
    initConnection: async () => true,
    getAvailablePurchases: async () => [],
    purchaseUpdatedListener: () => ({ remove() {} }),
    purchaseErrorListener: (f: typeof error) => { error = f; return { remove() {} }; },
    requestPurchase: async () => { error(Object.assign(new Error('declined'), { code: 'E_SERVICE_ERROR' })); },
  }, fast);
  const r = await s.buy();
  assert.deepEqual(r.status === 'failed' && r.codes, ['E_SERVICE_ERROR']);
});
