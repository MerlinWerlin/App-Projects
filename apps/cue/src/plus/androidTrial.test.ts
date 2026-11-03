import { MemoryKv } from '../core/library';
import { createAndroidPurchaseProvider } from './androidTrial';
import { ENTITLEMENT_KEY, PLUS_PRODUCT_ID } from './entitlement';
import { createPurchaseProvider, type IapApi, type PurchaseProvider } from './purchases';
import { DAY_MS, TRIAL_KEY, trialState } from './trial';

const NOW = 1_790_000_000_000;
function base(): PurchaseProvider {
  return {
    price: jest.fn(async () => null),
    buy: jest.fn(async () => ({ ok: true as const, access: { plus: true, trialStart: null } })),
    restore: jest.fn(async () => ({ ok: false as const, reason: 'empty' as const, message: 'Empty' })),
    refresh: jest.fn(async () => ({ plus: false, trialStart: null })),
    startTrial: jest.fn(async () => { throw new Error('Android must not request the Apple trial SKU'); }),
  };
}
test('explicit local start works without store price and persists across provider restart', async () => {
  const kv = new MemoryKv(), secure = new MemoryKv(), store = base();
  const first = createAndroidPurchaseProvider(store, kv, secure, () => NOW);
  expect(await first.startTrial()).toEqual({ ok: true, access: { plus: false, trialStart: NOW } });
  expect(kv.data.get(TRIAL_KEY)).toBe(String(NOW));
  expect(secure.data.get(TRIAL_KEY)).toBe(String(NOW));
  const restarted = createAndroidPurchaseProvider(store, kv, secure, () => NOW + DAY_MS);
  expect(await restarted.startTrial()).toEqual({ ok: true, access: { plus: false, trialStart: NOW } });
  expect(await restarted.refresh()).toEqual({ plus: false, trialStart: NOW });
  expect(store.startTrial).not.toHaveBeenCalled();
  expect(store.price).not.toHaveBeenCalled();
});
test('expired trial cannot restart or become permanent Plus', async () => {
  const kv = new MemoryKv(); await kv.setItem(TRIAL_KEY, String(NOW - 8 * DAY_MS));
  const provider = createAndroidPurchaseProvider(base(), kv, null, () => NOW);
  const result = await provider.startTrial();
  expect(result).toEqual({ ok: true, access: { plus: false, trialStart: NOW - 8 * DAY_MS } });
  if (result.ok) expect(trialState(result.access.trialStart, NOW).active).toBe(false);
});
test('earliest storage date wins, and store refresh/revocation cannot erase or renew it', async () => {
  const kv = new MemoryKv(), secure = new MemoryKv(), store = base();
  await kv.setItem(TRIAL_KEY, String(NOW));
  await secure.setItem(TRIAL_KEY, String(NOW - 3 * DAY_MS));
  const provider = createAndroidPurchaseProvider(store, kv, secure, () => NOW);
  expect(await provider.refresh()).toEqual({ plus: false, trialStart: NOW - 3 * DAY_MS });
  expect(await provider.buy()).toEqual({ ok: true, access: { plus: true, trialStart: NOW - 3 * DAY_MS } });
  expect(await provider.refresh()).toEqual({ plus: false, trialStart: NOW - 3 * DAY_MS });
});
test('concurrent starts share one timestamp and existing paid access is retained', async () => {
  const kv = new MemoryKv();
  await kv.setItem(ENTITLEMENT_KEY, JSON.stringify({ version: 1, tier: 'plus', source: 'restore', updatedAt: NOW }));
  let clock = NOW;
  const provider = createAndroidPurchaseProvider(base(), kv, null, () => ++clock);
  const results = await Promise.all([provider.startTrial(), provider.startTrial()]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0]).toEqual({ ok: true, access: { plus: true, trialStart: NOW + 1 } });
});
test('unreadable, corrupt or unpersisted storage never grants a new trial', async () => {
  const corrupt = new MemoryKv(); await corrupt.setItem(TRIAL_KEY, 'broken');
  const unreadable = { getItem: async () => { throw new Error('offline'); }, setItem: async () => undefined };
  const unwritable = { getItem: async () => null, setItem: async () => { throw new Error('disk full'); } };
  for (const kv of [corrupt, unreadable, unwritable]) {
    expect(await createAndroidPurchaseProvider(base(), kv, null, () => NOW).startTrial())
      .toMatchObject({ ok: false, reason: 'failed', message: expect.stringContaining('E_TRIAL_STORAGE') });
  }
});
test('store outage preserves last verified state and restore errors are not fabricated success', async () => {
  const kv = new MemoryKv(), store = base(); await kv.setItem(TRIAL_KEY, String(NOW));
  store.refresh = async () => null;
  const provider = createAndroidPurchaseProvider(store, kv, null, () => NOW);
  expect(await provider.refresh()).toBeNull();
  expect(await provider.restore()).toMatchObject({ ok: false, reason: 'empty' });
});
test('Android product query contains Plus only and never requests Apple trial', async () => {
  const api = {
    initConnection: async () => true,
    fetchProducts: jest.fn(async () => [{ id: PLUS_PRODUCT_ID, displayPrice: 'A$2.99', currency: 'AUD' }]),
    getAvailablePurchases: async () => [],
    requestPurchase: jest.fn(),
  } as unknown as IapApi;
  const store = createPurchaseProvider(api, () => NOW, [PLUS_PRODUCT_ID]);
  expect(await store.price()).toBe('A$2.99');
  expect(api.fetchProducts).toHaveBeenCalledWith({ skus: [PLUS_PRODUCT_ID], type: 'in-app' });
  expect(await store.startTrial()).toMatchObject({ ok: false, reason: 'unavailable' });
  expect(api.requestPurchase).not.toHaveBeenCalled();
});
