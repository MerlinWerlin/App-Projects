import test from 'node:test';
import assert from 'node:assert/strict';
import { accessFromPurchases, createPurchaseProvider, type IapApi, type StorePurchase } from './purchases.ts';
import { UNLOCK_PRODUCT_ID as FULL, canUse, parseEntitlement } from './entitlement.ts';
import { DAY_MS, TRIAL_PRODUCT_ID as TRIAL, trialStartFromPurchase, trialState } from './trial.ts';

const NOW = Date.UTC(2026, 10, 23);

function fake() {
  let updated: (p: StorePurchase) => void = () => undefined;
  let list: StorePurchase[] = [];
  const calls: string[] = [];
  const api: IapApi = {
    initConnection: async () => true,
    fetchProducts: async () => [{ id: FULL, displayPrice: '$4.99', currency: 'AUD' }, { id: TRIAL, displayPrice: 'Free', currency: 'AUD' }],
    getAvailablePurchases: async () => list,
    restorePurchases: async () => undefined,
    requestPurchase: async args => {
      calls.push(args.request.ios.sku);
      return undefined;
    },
    finishTransaction: async () => { calls.push('finish'); },
    purchaseUpdatedListener: fn => { updated = fn; return { remove() {} }; },
    purchaseErrorListener: () => ({ remove() {} }),
  };
  return { api, calls, update: (p: StorePurchase) => updated(p), setOwned: (p: StorePurchase[]) => { list = p; } };
}

test('entitlement parsing and gating', () => {
  assert.equal(parseEntitlement(null).tier, 'free');
  assert.equal(parseEntitlement('garbage').tier, 'free');
  assert.equal(parseEntitlement(JSON.stringify({ version: 1, tier: 'full', source: 'none', updatedAt: 1 })).tier, 'free');
  assert.equal(parseEntitlement(JSON.stringify({ version: 1, tier: 'full', source: 'purchase', updatedAt: 1 })).tier, 'full');
  assert.equal(canUse(false, 'power'), true);
  assert.equal(canUse(false, 'convert'), true);
  assert.equal(canUse(false, 'vdrop'), false);
  assert.equal(canUse(true, 'bend'), true);
});

test('trial lasts seven days from the store transaction date and never starts by itself', () => {
  assert.equal(trialState(null, NOW).active, false);
  const s = trialState(NOW, NOW + 2 * DAY_MS);
  assert.equal(s.active, true);
  assert.equal(s.daysLeft, 5);
  assert.equal(trialState(NOW, NOW + 7 * DAY_MS).active, false);
  // A clock set far before the start does not grant time.
  assert.equal(trialState(NOW, NOW - 3 * DAY_MS).active, false);
  assert.equal(trialStartFromPurchase({ transactionDate: NOW / 1000 }, NOW), NOW);
  assert.equal(trialStartFromPurchase({}, NOW), null);
});

test('access from owned purchases', () => {
  const a = accessFromPurchases([{ productId: FULL, purchaseState: 'purchased' }], NOW);
  assert.deepEqual(a, { plus: true, trialStart: null });
  const b = accessFromPurchases([{ productId: TRIAL, purchaseState: 'purchased', transactionDate: NOW }], NOW);
  assert.deepEqual(b, { plus: false, trialStart: NOW });
  const c = accessFromPurchases([{ productId: FULL, purchaseState: 'pending' }], NOW);
  assert.equal(c.plus, false);
});

test('buy settles from the purchase listener and finishes the transaction', async () => {
  const f = fake();
  const store = createPurchaseProvider(f.api, () => NOW);
  const p = store.buy();
  await new Promise(r => setTimeout(r, 10));
  f.update({ productId: FULL, purchaseState: 'purchased' });
  const r = await p;
  assert.ok(r.ok && r.access.plus);
  await new Promise(r2 => setTimeout(r2, 10));
  assert.deepEqual(f.calls, [FULL, 'finish']);
});

test('restore finds nothing, then finds the unlock; missing store is unavailable', async () => {
  const f = fake();
  const store = createPurchaseProvider(f.api, () => NOW);
  const none = await store.restore();
  assert.ok(!none.ok && none.reason === 'empty');
  f.setOwned([{ productId: FULL, purchaseState: 'purchased' }]);
  const yes = await store.restore();
  assert.ok(yes.ok && yes.access.plus);
  const offline = await createPurchaseProvider(null).buy();
  assert.ok(!offline.ok && offline.reason === 'unavailable' && offline.message.includes('nothing was charged'));
  assert.equal(await createPurchaseProvider(null).refresh(), null);
});

test('price shows A$ for the Australian store', async () => {
  const f = fake();
  assert.equal(await createPurchaseProvider(f.api, () => NOW).price(), 'A$4.99');
});
