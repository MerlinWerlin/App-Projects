// Purchases, trial and what stays free.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryKv } from '../core/kv.ts';
import { canUse, parseEntitlement, UNLOCK_PRODUCT_ID as UNLOCK } from './entitlement.ts';
import { accessFromPurchases, createPurchaseProvider, type IapApi, type StorePurchase } from './purchases.ts';
import { DAY_MS, TRIAL_PRODUCT_ID as TRIAL, readStoredTrial, saveStoredTrial, trialStartFromPurchase, trialState } from './trial.ts';

const NOW = Date.UTC(2026, 10, 23);

function fakeStore(opts: { owned?: StorePurchase[]; buy?: (sku: string) => StorePurchase | null; fail?: string } = {}) {
  let owned = opts.owned ?? [];
  let onUpdate: (p: StorePurchase) => void = () => undefined;
  let onError: (e: unknown) => void = () => undefined;
  const finished: string[] = [];
  const api: IapApi = {
    initConnection: async () => true,
    fetchProducts: async () => [{ id: UNLOCK, displayPrice: 'A$4.99', currency: 'AUD' }, { id: TRIAL, displayPrice: 'Free', currency: 'AUD' }],
    getAvailablePurchases: async () => owned,
    restorePurchases: async () => undefined,
    requestPurchase: async ({ request }) => {
      if (opts.fail) { onError({ code: opts.fail }); return undefined; }
      const p = opts.buy?.(request.ios.sku) ?? null;
      if (p) { owned = [...owned, p]; setTimeout(() => onUpdate(p), 5); }
      return undefined;
    },
    finishTransaction: async ({ purchase }) => { finished.push(String(purchase.productId)); },
    purchaseUpdatedListener: fn => { onUpdate = fn; return { remove() {} }; },
    purchaseErrorListener: fn => { onError = fn; return { remove() {} }; },
  };
  return { api, finished };
}

test('free tools stay free; everything else needs the unlock or an active trial', () => {
  for (const f of ['weight', 'frame', 'bend', 'pcd'] as const) assert.equal(canUse(f, false), true);
  for (const f of ['saddle', 'lobster', 'cutlist', 'weld', 'pdf', 'saveJobs'] as const) {
    assert.equal(canUse(f, false), false);
    assert.equal(canUse(f, true), true);
  }
  assert.equal(parseEntitlement('{"version":1,"unlocked":true,"updatedAt":1}').unlocked, true);
  assert.equal(parseEntitlement('garbage').unlocked, false);
  assert.equal(parseEntitlement(null).unlocked, false);
});

test('buying the unlock: listener result, then the transaction is finished', async () => {
  const s = fakeStore({ buy: sku => ({ productId: sku, purchaseState: 'purchased', transactionDate: NOW }) });
  const store = createPurchaseProvider(s.api, () => NOW);
  assert.equal(await store.price(), 'A$4.99');
  const r = await store.buy();
  assert.equal(r.ok, true);
  assert.ok(r.ok && r.access.plus);
  await new Promise(res => setTimeout(res, 10));
  assert.deepEqual(s.finished, [UNLOCK]);
});

test('cancel says nothing was charged; restore with nothing owned says so', async () => {
  const s = fakeStore({ fail: 'E_USER_CANCELLED' });
  const store = createPurchaseProvider(s.api, () => NOW);
  const r = await store.buy();
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.reason === 'cancelled' && /Nothing was charged/.test(r.message));
  const empty = await createPurchaseProvider(fakeStore().api, () => NOW).restore();
  assert.ok(!empty.ok && empty.reason === 'empty');
});

test('no store module never grants access', async () => {
  const store = createPurchaseProvider(null, () => NOW);
  const r = await store.buy();
  assert.ok(!r.ok && r.reason === 'unavailable');
  assert.equal(await store.refresh(), null);
});

test('trial runs seven days from the original transaction and survives restore', async () => {
  const start = NOW - 2 * DAY_MS;
  const owned = [{ productId: TRIAL, purchaseState: 'purchased', originalTransactionDateIOS: start }];
  const access = accessFromPurchases(owned, NOW);
  assert.equal(access.trialStart, start);
  assert.equal(access.plus, false);
  const st = trialState(start, NOW);
  assert.deepEqual([st.active, st.daysLeft], [true, 5]);
  assert.equal(trialState(start, start + 7 * DAY_MS).active, false);
  assert.equal(trialState(null, NOW).started, false);
  assert.equal(trialStartFromPurchase({ transactionDate: '2026-11-20T00:00:00Z' }, NOW), Date.UTC(2026, 10, 20));
  assert.equal(trialStartFromPurchase({}, NOW), null); // never restart from a missing date
  const kv = new MemoryKv(), secure = new MemoryKv();
  assert.equal(await readStoredTrial(kv, secure), null); // fresh install: no trial until the person starts it
  await saveStoredTrial(kv, secure, start);
  await kv.setItem('rootpass.storeTrial.v1', String(start + DAY_MS)); // a later stamp never extends it
  assert.equal(await readStoredTrial(kv, secure), start);
});
