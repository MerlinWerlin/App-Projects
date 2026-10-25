import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore, PLUS_SKU, testStore } from './store.ts';

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
