/**
 * Couch Plus entitlement (owner decision 7 Nov 2026): one one-time purchase unlocks the remote and casting.
 */
import {
  NOT_OWNED,
  PLUS_FEATURES,
  PLUS_PRICE,
  PLUS_STORAGE_KEY,
  createMockStore,
  parsePlusState,
  resetMockPurchase,
  type PlusStorage,
} from './entitlement';

function memory(initial: Record<string, string> = {}): PlusStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
}

describe('Couch Plus entitlement', () => {
  it('unlocks the remote and casting, for A$3.99 until the store answers', () => {
    expect([...PLUS_FEATURES]).toEqual(['remote', 'cast']);
    expect(PLUS_PRICE).toBe('A$3.99');
  });

  it('parsePlusState: anything unexpected is not owned', () => {
    for (const raw of [null, '', 'x', '[]', '{}', '{"owned":false}', '{"owned":true}', '{"owned":true,"source":"none"}', 'null']) {
      expect(parsePlusState(raw)).toEqual(NOT_OWNED);
    }
    expect(parsePlusState('{"owned":true,"source":"store","since":5}')).toEqual({ owned: true, source: 'store', since: 5 });
    expect(parsePlusState('{"owned":true,"source":"mock","since":-1}')).toEqual({ owned: true, source: 'mock' });
  });

  it('mock store (development only): buy, restore what this phone stored, reset', async () => {
    const s = memory();
    const store = createMockStore(s, () => 42);
    expect((await store.getState()).owned).toBe(false);
    expect(await store.purchase()).toEqual({ owned: true, source: 'mock', since: 42 });
    expect(JSON.parse(s.data.get(PLUS_STORAGE_KEY)!).owned).toBe(true);
    expect((await createMockStore(s).restore()).owned).toBe(true);
    expect(await resetMockPurchase(s)).toEqual(NOT_OWNED);
    expect((await store.getState()).owned).toBe(false);
  });

  it('a storage failure never throws; a development purchase still counts for this session', async () => {
    const broken: PlusStorage = { get: async () => Promise.reject(new Error('io')), set: async () => Promise.reject(new Error('io')) };
    const store = createMockStore(broken, () => 1);
    expect(await store.getState()).toEqual(NOT_OWNED);
    expect((await store.purchase()).owned).toBe(true);
  });
});
