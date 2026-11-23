import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, FULL_PRODUCT_ID, TRIAL_PRODUCT_ID, accessMessage, parseAccess, trialStartFromPurchase, trialState, unlocked } from './entitlement.ts';
import { accessFromPurchases, createPurchaseProvider, type IapApi, type StorePurchase } from './purchases.ts';

const NOW = Date.UTC(2026, 10, 23, 1, 0, 0);

function fakeIap(opts: { owned?: StorePurchase[]; result?: StorePurchase | null; error?: unknown; products?: string[]; connect?: boolean } = {}) {
  const owned = [...(opts.owned ?? [])];
  const finished: StorePurchase[] = [];
  const api: IapApi = {
    initConnection: async () => opts.connect ?? true,
    getStorefront: async () => 'AUS',
    fetchProducts: async () => (opts.products ?? [FULL_PRODUCT_ID, TRIAL_PRODUCT_ID]).map(id => ({ id, displayPrice: '$4.99', currency: 'AUD' })),
    requestPurchase: async () => {
      if (opts.error) throw opts.error;
      if (opts.result) owned.push(opts.result);
      return opts.result ?? null;
    },
    getAvailablePurchases: async () => owned,
    restorePurchases: async () => undefined,
    finishTransaction: async ({ purchase }) => { finished.push(purchase); },
    purchaseUpdatedListener: () => ({ remove() {} }),
    purchaseErrorListener: () => ({ remove() {} }),
  };
  return { api, finished };
}

test('trial lasts seven days and never starts by itself', () => {
  assert.equal(trialState(null, NOW).active, false);
  assert.equal(trialState(NOW, NOW).daysLeft, 7);
  assert.equal(trialState(NOW, NOW + 6.5 * DAY_MS).daysLeft, 1);
  assert.equal(trialState(NOW, NOW + 7 * DAY_MS).active, false);
  // winding the clock back does not reopen it
  assert.equal(trialState(NOW, NOW - 3 * DAY_MS).active, false);
  assert.equal(unlocked({ full: false, trialStart: null }, NOW), false);
  assert.equal(unlocked({ full: true, trialStart: null }, NOW), true);
});

test('trial date comes from the original transaction', () => {
  assert.equal(trialStartFromPurchase({ originalTransactionDateIOS: NOW }, NOW), NOW);
  assert.equal(trialStartFromPurchase({ transactionDate: NOW / 1000 }, NOW), NOW);
  assert.equal(trialStartFromPurchase({}, NOW), null);
  assert.equal(trialStartFromPurchase({ transactionDate: NOW + 5 * DAY_MS }, NOW), null);
});

test('stored access survives corrupt data as locked', () => {
  assert.deepEqual(parseAccess('{bad'), { full: false, trialStart: null });
  assert.deepEqual(parseAccess(JSON.stringify({ full: true, trialStart: 5 })), { full: true, trialStart: 5 });
  assert.deepEqual(parseAccess(JSON.stringify({ full: 'yes' })), { full: false, trialStart: null });
});

test('access from purchases', () => {
  const a = accessFromPurchases([{ productId: TRIAL_PRODUCT_ID, transactionDate: NOW }, { productId: FULL_PRODUCT_ID, purchaseState: 'pending' }], NOW);
  assert.deepEqual(a, { full: false, trialStart: NOW });
});

test('buying Full Unlock succeeds and finishes the transaction', async () => {
  const { api, finished } = fakeIap({ result: { productId: FULL_PRODUCT_ID, purchaseState: 'purchased', transactionDate: NOW } });
  const r = await createPurchaseProvider(api, () => NOW).buy();
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.access.full, true);
  await new Promise(res => setTimeout(res, 5));
  assert.equal(finished.length, 1);
});

test('a cancelled purchase says nothing was charged', async () => {
  const { api } = fakeIap({ error: { code: 'E_USER_CANCELLED' } });
  const r = await createPurchaseProvider(api, () => NOW).buy();
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.reason === 'cancelled' && r.message.includes('Nothing was charged'));
});

test('no store means no access', async () => {
  const r = await createPurchaseProvider(null, () => NOW).buy();
  assert.ok(!r.ok && r.reason === 'unavailable');
  assert.equal(await createPurchaseProvider(null, () => NOW).refresh(), null);
  const missing = fakeIap({ products: [] });
  const r2 = await createPurchaseProvider(missing.api, () => NOW).buy();
  assert.ok(!r2.ok && r2.reason === 'unavailable');
});

test('restore finds an earlier purchase, or says there is none', async () => {
  const has = fakeIap({ owned: [{ productId: FULL_PRODUCT_ID, purchaseState: 'purchased' }] });
  const r = await createPurchaseProvider(has.api, () => NOW).restore();
  assert.ok(r.ok && r.access.full);
  const none = fakeIap();
  const r2 = await createPurchaseProvider(none.api, () => NOW).restore();
  assert.ok(!r2.ok && r2.reason === 'empty');
});

test('starting the trial uses the store date', async () => {
  const { api } = fakeIap({ result: { productId: TRIAL_PRODUCT_ID, purchaseState: 'purchased', originalTransactionDateIOS: NOW - DAY_MS } });
  const r = await createPurchaseProvider(api, () => NOW).startTrial();
  assert.ok(r.ok && r.access.trialStart === NOW - DAY_MS && !r.access.full);
});

test('price shows A$ for the Australian store', async () => {
  const { api } = fakeIap();
  assert.equal(await createPurchaseProvider(api, () => NOW).price(), 'A$4.99');
});

test('restore and trial messages follow what the store returned', () => {
  assert.equal(accessMessage({ full: true, trialStart: null }, NOW).title, 'Unlocked');
  assert.ok(accessMessage({ full: false, trialStart: NOW - 2 * DAY_MS }, NOW).body.includes('5 more days'));
  assert.equal(accessMessage({ full: false, trialStart: NOW - 9 * DAY_MS }, NOW).title, 'Trial ended');
  assert.equal(accessMessage({ full: false, trialStart: null }, NOW).title, 'Nothing to restore');
});

test('a purchase approved later (Ask to Buy) unlocks through the long-lived listener', async () => {
  let fire: ((p: StorePurchase) => void) | null = null;
  const owned: StorePurchase[] = [];
  const finished: StorePurchase[] = [];
  const api = { ...fakeIap().api,
    getAvailablePurchases: async () => owned,
    finishTransaction: async ({ purchase }: { purchase: StorePurchase }) => { finished.push(purchase); },
    purchaseUpdatedListener: (fn: (p: StorePurchase) => void) => { fire = fn; return { remove() { fire = null; } }; },
  } as IapApi;
  const got: unknown[] = [];
  const stop = createPurchaseProvider(api, () => NOW).watch(a => got.push(a));
  await new Promise(r => setTimeout(r, 5));
  const approved = { productId: FULL_PRODUCT_ID, purchaseState: 'purchased' };
  owned.push(approved);
  fire!(approved);
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(got, [{ full: true, trialStart: null }]);
  assert.equal(finished.length, 1);
  stop();
  assert.equal(fire, null);
});
