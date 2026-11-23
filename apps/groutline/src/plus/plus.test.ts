import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessFromPurchases, createPurchaseProvider, type IapApi, type StorePurchase } from './purchases.ts';
import { UNLOCK_PRODUCT_ID as UNLOCK, isFree } from './entitlement.ts';
import { DAY_MS, TRIAL_PRODUCT_ID as TRIAL, readStoredTrial, saveStoredTrial, trialStartFromPurchase, trialState } from './trial.ts';
import { MemoryKv } from '../core/kv.ts';

const NOW = Date.UTC(2026, 10, 23);

function fake(opts: { owned?: StorePurchase[]; onRequest?: (sku: string, api: { update(p: StorePurchase): void; error(e: unknown): void }) => void } = {}) {
  let updated: (p: StorePurchase) => void = () => undefined;
  let errored: (e: unknown) => void = () => undefined;
  let owned = opts.owned ?? [];
  const calls: string[] = [];
  const api: IapApi = {
    initConnection: async () => true,
    fetchProducts: async () => [{ id: UNLOCK, displayPrice: 'A$4.99', currency: 'AUD' }, { id: TRIAL, displayPrice: 'Free', currency: 'AUD' }],
    getAvailablePurchases: async () => owned,
    restorePurchases: async () => undefined,
    requestPurchase: async (args) => { const sku = args.request.ios.sku; calls.push(sku); opts.onRequest?.(sku, { update: p => { owned = [...owned, p]; updated(p); }, error: e => errored(e) }); },
    finishTransaction: async () => undefined,
    purchaseUpdatedListener: fn => { updated = fn; return { remove() {} }; },
    purchaseErrorListener: fn => { errored = fn; return { remove() {} }; },
  };
  return { api, calls };
}

test('only the Tiles calculator is free', () => {
  assert.equal(isFree('tiles'), true);
  for (const t of ['setout', 'materials', 'falls', 'trim', 'stairs'] as const) assert.equal(isFree(t), false);
});

test('fresh install has no trial and nothing is stored', async () => {
  const kv = new MemoryKv();
  assert.equal(await readStoredTrial(kv, null), null);
  assert.deepEqual(trialState(null, NOW), { active: false, daysLeft: 0, endsAt: 0, started: false });
  assert.equal(kv.data.size, 0);
});

test('trial runs seven days from the original transaction date', async () => {
  const start = NOW - 2 * DAY_MS;
  const s = trialState(start, NOW);
  assert.equal(s.active, true);
  assert.equal(s.daysLeft, 5);
  assert.equal(trialState(NOW - 7 * DAY_MS, NOW).active, false);
  assert.equal(trialStartFromPurchase({ originalTransactionDateIOS: start }, NOW), start);
  assert.equal(trialStartFromPurchase({ transactionDate: start / 1000 }, NOW), start); // seconds are converted
  assert.equal(trialStartFromPurchase({}, NOW), null); // no date never restarts a trial
  const kv = new MemoryKv();
  await saveStoredTrial(kv, null, start);
  assert.equal(await readStoredTrial(kv, null), start);
});

test('owned purchases map to access', () => {
  assert.deepEqual(accessFromPurchases([{ productId: UNLOCK, purchaseState: 'purchased' }], NOW), { plus: true, trialStart: null });
  assert.deepEqual(accessFromPurchases([{ productId: TRIAL, originalTransactionDateIOS: NOW - DAY_MS }], NOW), { plus: false, trialStart: NOW - DAY_MS });
  assert.deepEqual(accessFromPurchases([{ productId: UNLOCK, purchaseState: 'pending' }], NOW), { plus: false, trialStart: null });
});

test('buying Full Unlock resolves from the purchase listener', async () => {
  const f = fake({ onRequest: (sku, api) => setTimeout(() => api.update({ productId: sku, purchaseState: 'purchased', transactionDate: NOW }), 5) });
  const store = createPurchaseProvider(f.api, () => NOW);
  const r = await store.buy();
  assert.equal(r.ok, true);
  assert.ok(r.ok && r.access.plus);
  assert.deepEqual(f.calls, [UNLOCK]);
  assert.equal(await store.price(), 'A$4.99');
});

test('a cancelled purchase says nothing was charged', async () => {
  const f = fake({ onRequest: (_sku, api) => setTimeout(() => api.error({ code: 'user-cancelled' }), 5) });
  const r = await createPurchaseProvider(f.api, () => NOW).buy();
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.reason === 'cancelled' && /Nothing was charged/.test(r.message));
});

test('restore with nothing owned reports it; with a trial it restores the trial', async () => {
  const empty = await createPurchaseProvider(fake().api, () => NOW).restore();
  assert.ok(!empty.ok && empty.reason === 'empty');
  const withTrial = await createPurchaseProvider(fake({ owned: [{ productId: TRIAL, originalTransactionDateIOS: NOW - DAY_MS }] }).api, () => NOW).restore();
  assert.ok(withTrial.ok && withTrial.access.trialStart === NOW - DAY_MS);
});

test('no store module means unavailable, never access', async () => {
  const store = createPurchaseProvider(null, () => NOW);
  const r = await store.buy();
  assert.ok(!r.ok && r.reason === 'unavailable');
  assert.equal(await store.refresh(), null);
  assert.equal(await store.price(), null);
});
