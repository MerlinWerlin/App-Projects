import { KEYS } from '../core/keys';
import { MemoryKv } from '../core/store';
import {
  ENTITLEMENT_KEY,
  EntitlementStore,
  PLUS_FEATURES,
  PLUS_FEATURE_COPY,
  plusPromise,
  isPlusFeature,
  parseEntitlement,
  tierCanUse,
} from './entitlement';
import {
  StubPurchaseProvider,
  unavailableMessage,
  UNAVAILABLE_REASON,
  applyPurchase,
  type PurchaseProvider,
  type PurchaseResult,
} from './purchases';
import { TIP_TIERS, tipJarCopy, tipTier } from './tipJar';

describe('PlusFeature', () => {
  it('is exactly the extras Plus may gate', () => {
    expect([...PLUS_FEATURES]).toEqual(['widgets', 'watch', 'liveActivity', 'controls', 'themes', 'macros']);
    for (const f of PLUS_FEATURES) expect(PLUS_FEATURE_COPY[f].title.length).toBeGreaterThan(0);
  });

  it('never includes a TV key', () => {
    for (const k of KEYS) {
      expect(isPlusFeature(k)).toBe(false);
      expect(isPlusFeature(k.toLowerCase())).toBe(false);
    }
    for (const k of ['power', 'volume', 'dpad', 'touchpad', 'keyboard', 'apps', 'tvs']) expect(isPlusFeature(k)).toBe(false);
  });

  it('has the promise line', () => {
    expect(plusPromise()).toBe('Every button on the remote stays free. Plus adds extras, never takes controls away.');
  });
});

describe('parseEntitlement', () => {
  it('is free for missing, corrupt or unknown data', () => {
    for (const raw of [null, '', 'nope', '[]', '{}', '{"version":2,"tier":"plus"}', '{"version":1,"tier":"gold"}']) {
      expect(parseEntitlement(raw).tier).toBe('free');
    }
  });
  it('reads a stored plus doc', () => {
    const d = parseEntitlement(JSON.stringify({ version: 1, tier: 'plus', source: 'restore', updatedAt: 5 }));
    expect(d).toEqual({ version: 1, tier: 'plus', source: 'restore', updatedAt: 5 });
  });
});

describe('tierCanUse', () => {
  it('free uses no Plus feature, plus uses all', () => {
    for (const f of PLUS_FEATURES) {
      expect(tierCanUse('free', f)).toBe(false);
      expect(tierCanUse('plus', f)).toBe(true);
    }
  });
});

describe('EntitlementStore', () => {
  it('starts free and persists a grant through the KvStore', async () => {
    const kv = new MemoryKv();
    const s = new EntitlementStore(kv, () => 42);
    await s.load();
    expect(s.tier()).toBe('free');
    expect(s.canUse('widgets')).toBe(false);
    let calls = 0;
    s.subscribe(() => calls++);
    await s.grant('purchase');
    expect(s.canUse('widgets')).toBe(true);
    expect(s.getSnapshot()).toEqual({ tier: 'plus', loaded: true });
    expect(calls).toBeGreaterThan(0);
    expect(JSON.parse(kv.data.get(ENTITLEMENT_KEY)!)).toEqual({ version: 1, tier: 'plus', source: 'purchase', updatedAt: 42 });

    const again = new EntitlementStore(kv);
    await again.load();
    expect(again.tier()).toBe('plus');
    await again.revoke();
    expect(again.canUse('macros')).toBe(false);
    expect(parseEntitlement(kv.data.get(ENTITLEMENT_KEY)!).tier).toBe('free');
  });

  it('falls back to free when storage fails', async () => {
    const s = new EntitlementStore({
      getItem: () => Promise.reject(new Error('boom')),
      setItem: () => Promise.resolve(),
    });
    await s.load();
    expect(s.getSnapshot()).toEqual({ tier: 'free', loaded: true });
  });
});

describe('StubPurchaseProvider', () => {
  it('never charges and reports not available', async () => {
    const p = new StubPurchaseProvider();
    expect(p.available).toBe(false);
    expect(await p.plusPrice()).toBeNull();
    for (const r of [await p.buyPlus(), await p.restore(), await p.tip('tip.small')]) {
      expect(r).toEqual({ ok: false, reason: UNAVAILABLE_REASON, message: unavailableMessage() });
    }
    expect(UNAVAILABLE_REASON).toBe('not available in this build');
    expect(unavailableMessage()).toContain("Purchases aren't available in this test build");
  });

  it('applyPurchase with the stub leaves the user free', async () => {
    const s = new EntitlementStore(new MemoryKv());
    const r = await applyPurchase(s, new StubPurchaseProvider());
    expect(r.ok).toBe(false);
    expect(s.tier()).toBe('free');
  });

  it('applyPurchase grants only on provider success', async () => {
    const ok: PurchaseResult = { ok: true, kind: 'plus' };
    const fake: PurchaseProvider = {
      available: true,
      plusPrice: async () => '$4.99',
      buyPlus: async () => ok,
      restore: async () => ok,
      tip: async () => ({ ok: true, kind: 'tip' }),
    };
    const s = new EntitlementStore(new MemoryKv());
    await applyPurchase(s, fake, 'restore');
    expect(s.tier()).toBe('plus');

    const throwing: PurchaseProvider = { ...fake, buyPlus: () => Promise.reject(new Error('x')) };
    const s2 = new EntitlementStore(new MemoryKv());
    const r = await applyPurchase(s2, throwing);
    expect(r.ok).toBe(false);
    expect(s2.tier()).toBe('free');
  });
});

describe('tip jar', () => {
  it('is data only with unique ids and positive prices', () => {
    expect(TIP_TIERS.length).toBeGreaterThan(0);
    expect(new Set(TIP_TIERS.map((t) => t.id)).size).toBe(TIP_TIERS.length);
    for (const t of TIP_TIERS) expect(t.usd).toBeGreaterThan(0);
    expect(tipTier('tip.small')?.label).toBe('Small tip');
    expect(tipTier('nope')).toBeUndefined();
    expect(tipJarCopy()).toContain('unlock nothing');
  });
});
