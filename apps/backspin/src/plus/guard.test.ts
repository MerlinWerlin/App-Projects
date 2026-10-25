import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guardTestStore } from './guard.ts';
import { createStore, PLUS_KEY } from './store.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { m, get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v) };
};

test('Expo Go keeps the labelled test store', () => {
  const st = mem();
  assert.equal(guardTestStore(createStore(st, null), st, true).kind, 'test');
});

test('a store build without expo-iap never shows test mode or gives Plus away', async () => {
  const st = mem();
  const s = guardTestStore(createStore(st, null), st, false);
  assert.equal(s.kind, 'store');
  assert.equal((await s.buy()).status, 'unavailable');
  assert.equal(await s.owned(), false);
  assert.equal(await s.restore(), false);
  st.m.set(PLUS_KEY, '1');
  assert.equal(await s.owned(), true);
});

test('a real store passes through untouched', () => {
  const st = mem();
  const real = createStore(st, { initConnection: async () => true, requestPurchase: async () => [] });
  assert.equal(guardTestStore(real, st, false), real);
});
