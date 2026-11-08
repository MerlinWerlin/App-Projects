/**
 * The app-wide access state behind the gate (src/plus/gate.tsx): grandfathering, the 7-day trial, Plus, loading.
 */
import { TRIAL_KEY } from './access';
import { AccessStore } from './accessStore';
import { PLUS_STORAGE_KEY, createMockStore, type PlusStorage } from './entitlement';
import { INSTALL_KEY } from './grandfather';
import { PLUS_SKU, TRIAL_SKU, createIapStore } from './iapStore';
import { REOPEN_MS, requestPaywall, resetPaywall, setPaywallOpener, setPaywallShown } from './paywall';

const DAY = 86_400_000;
const NOW = 20_000 * DAY;

function memory(initial: Record<string, string> = {}): PlusStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
}

function fakeIap(opts: { owned?: any[]; tx?: unknown; buyDate?: number } = {}) {
  return {
    initConnection: async () => true,
    fetchProducts: async (a: { skus: string[] }) => a.skus.map((id) => ({ id, displayPrice: id === PLUS_SKU ? 'A$3.99' : 'Free' })),
    getAvailablePurchases: async () => opts.owned ?? [],
    requestPurchase: async (a: { request: { ios?: { sku: string } } }) => ({ productId: a.request.ios?.sku, transactionDate: opts.buyDate ?? NOW }),
    finishTransaction: async () => undefined,
    getAppTransactionIOS: async () => opts.tx ?? null,
  };
}

function storeWith(storage: ReturnType<typeof memory>, iapOpts?: Parameters<typeof fakeIap>[0], now = NOW): AccessStore {
  return new AccessStore({ storage, iap: createIapStore(storage, () => now, fakeIap(iapOpts)), fallback: null, now: () => now });
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('AccessStore', () => {
  it('before storage is read: allowed (no paywall flash)', () => {
    const s = storeWith(memory());
    expect(s.access().reason).toBe('loading');
    expect(s.access().full).toBe(true);
  });

  it('fresh install: locked until the trial starts or Plus is bought', async () => {
    const storage = memory();
    const s = storeWith(storage);
    await s.start();
    expect(storage.data.get(INSTALL_KEY)).toBe('fresh');
    expect(s.access()).toEqual({ full: false, reason: 'none', daysLeft: 0 });
  });

  it('update from the free Couch 1.0.3 (saved TVs or prefs already stored): grandfathered for good', async () => {
    const storage = memory({ 'couch.savedTvs': '{"version":1,"tvs":[]}' });
    const s = storeWith(storage);
    await s.start();
    expect(s.access().reason).toBe('grandfathered');
    expect(s.access(NOW + 5000 * DAY).full).toBe(true);
    // Next launch: still grandfathered from the saved marker.
    const again = storeWith(memory({ [INSTALL_KEY]: 'legacy' }));
    await again.start();
    expect(again.access().reason).toBe('grandfathered');
  });

  it('App Store AppTransaction from the free era upgrades a fresh install to grandfathered', async () => {
    const storage = memory();
    const s = storeWith(storage, { tx: { originalAppVersion: '12', environment: 'Production' } });
    await s.start();
    await settle();
    await settle();
    expect(s.access().reason).toBe('grandfathered');
    expect(storage.data.get(INSTALL_KEY)).toBe('legacy');
  });

  it('a TestFlight / sandbox AppTransaction ("1.0") changes nothing', async () => {
    const storage = memory();
    const s = storeWith(storage, { tx: { originalAppVersion: '1.0', environment: 'Sandbox' } });
    await s.start();
    await settle();
    await settle();
    expect(s.access().reason).toBe('none');
    expect(storage.data.get(INSTALL_KEY)).toBe('fresh');
  });

  it('Start 7-day free trial: unlocked with 7 days left, then locked after 7 days', async () => {
    const storage = memory();
    const s = storeWith(storage);
    await s.start();
    let changes = 0;
    s.subscribe(() => changes++);
    const r = await s.startTrial();
    expect(r).toEqual({ status: 'started', start: NOW });
    expect(changes).toBeGreaterThan(0);
    expect(storage.data.get(TRIAL_KEY)).toBe(String(NOW));
    expect(s.access()).toEqual({ full: true, reason: 'trial', daysLeft: 7 });
    expect(s.access(NOW + 7 * DAY).reason).toBe('expired');
  });

  it('a trial already used on this Apple ID comes back with its first date and is not restarted', async () => {
    const storage = memory();
    const s = storeWith(storage, { owned: [{ productId: TRIAL_SKU, originalTransactionDateIOS: NOW - 20 * DAY }] });
    await s.start();
    expect(await s.startTrial()).toEqual({ status: 'restored', start: NOW - 20 * DAY });
    expect(s.access().reason).toBe('expired');
  });

  it('Buy unlocks for good; Restore finds an earlier purchase', async () => {
    const s = storeWith(memory());
    await s.start();
    expect(await s.purchase()).toBe('owned');
    expect(s.access().reason).toBe('owned');

    const r = storeWith(memory(), { owned: [{ productId: PLUS_SKU }] });
    await r.start();
    expect(r.access().reason).toBe('none');
    expect(await r.restore()).toBe('owned');
    expect(r.access().reason).toBe('owned');
  });

  it('Restore with only a trial brings back the trial date', async () => {
    const storage = memory();
    const s = storeWith(storage, { owned: [{ productId: TRIAL_SKU, transactionDate: NOW - 2 * DAY }] });
    await s.start();
    expect(await s.restore()).toBe('notOwned');
    expect(s.access()).toEqual({ full: true, reason: 'trial', daysLeft: 5 });
  });

  it('the store price replaces the A$3.99 fallback once the store answers', async () => {
    const s = storeWith(memory());
    await s.start();
    await settle();
    expect(s.getSnapshot().price).toBe('A$3.99');
  });

  it('no store (store build without the module): Buy and the trial say unavailable, never grant', async () => {
    const s = new AccessStore({ storage: memory(), iap: null, fallback: null, now: () => NOW });
    await s.start();
    expect(s.getSnapshot().canBuy).toBe(false);
    expect(await s.purchase()).toBe('unavailable');
    expect(await s.startTrial()).toEqual({ status: 'unavailable', start: null });
    expect(s.access().full).toBe(false);
  });

  it('a Plus bought earlier on this phone is read at start', async () => {
    const storage = memory({ [PLUS_STORAGE_KEY]: JSON.stringify({ owned: true, source: 'mock', since: 1 }) });
    const s = new AccessStore({ storage, iap: null, fallback: createMockStore(storage), now: () => NOW });
    await s.start();
    expect(s.access().reason).toBe('owned');
  });
});

describe('paywall opener', () => {
  afterEach(() => resetPaywall());

  it('opens once, not again while it is showing or within REOPEN_MS', () => {
    let opened = 0;
    setPaywallOpener(() => opened++);
    expect(requestPaywall(1000)).toBe('opened');
    expect(requestPaywall(1001)).toBe('skipped');
    setPaywallShown(true);
    expect(requestPaywall(1000 + REOPEN_MS + 1)).toBe('skipped');
    setPaywallShown(false);
    expect(requestPaywall(1000 + REOPEN_MS + 2)).toBe('opened');
    expect(opened).toBe(2);
  });

  it('says when it could not open, so the gate shows a toast instead of failing silently', () => {
    expect(requestPaywall(5000)).toBe('failed');
    setPaywallOpener(() => {
      throw new Error('navigator not ready');
    });
    expect(requestPaywall(5000 + REOPEN_MS + 1)).toBe('failed');
  });
});
