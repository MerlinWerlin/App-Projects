import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import {
  FREE_FOREVER,
  PACKS,
  PLUS_FEATURES,
  PLUS_PRICE_LABEL,
  PLUS_STORAGE_KEY,
  createMockStore,
  parsePlusState,
  resetMockPurchase,
  type PlusStorage,
} from './entitlement.ts';

function memoryStorage(initial: Record<string, string> = {}): PlusStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(k) {
      return data.has(k) ? (data.get(k) as string) : null;
    },
    async set(k, v) {
      data.set(k, v);
    },
  };
}

test('fresh store is not owned', async () => {
  const store = createMockStore(memoryStorage());
  assert.deepEqual(await store.getState(), { owned: false, source: 'none' });
});

test('mock purchase persists and restore finds it', async () => {
  const storage = memoryStorage();
  const store = createMockStore(storage, () => 1234);
  const bought = await store.purchase();
  assert.deepEqual(bought, { owned: true, source: 'mock', since: 1234 });
  assert.ok(storage.data.has(PLUS_STORAGE_KEY));

  const again = createMockStore(storage, () => 9999);
  assert.deepEqual(await again.restore(), { owned: true, source: 'mock', since: 1234 });
  assert.deepEqual(await again.getState(), { owned: true, source: 'mock', since: 1234 });
  // Buying twice keeps the original date.
  assert.equal((await again.purchase()).since, 1234);

  assert.deepEqual(await resetMockPurchase(storage), { owned: false, source: 'none' });
  assert.equal((await again.getState()).owned, false);
});

test('garbage storage is tolerated', async () => {
  for (const bad of ['not json', '42', 'null', '[]', '{"owned":"yes"}', '{"owned":true}', '{"owned":true,"source":"hack"}']) {
    const store = createMockStore(memoryStorage({ [PLUS_STORAGE_KEY]: bad }));
    assert.deepEqual(await store.getState(), { owned: false, source: 'none' }, bad);
  }
  assert.deepEqual(parsePlusState('{"owned":true,"source":"store","since":"x"}'), { owned: true, source: 'store' });
  const throwing: PlusStorage = {
    get: () => Promise.reject(new Error('boom')),
    set: () => Promise.reject(new Error('boom')),
  };
  const store = createMockStore(throwing, () => 5);
  assert.equal((await store.getState()).owned, false);
  assert.deepEqual(await store.purchase(), { owned: true, source: 'mock', since: 5 });
});

test('tip returns ok without changing ownership', async () => {
  const storage = memoryStorage();
  const store = createMockStore(storage);
  for (const id of ['small', 'medium', 'large'] as const) {
    assert.deepEqual(await store.tip(id), { ok: true });
  }
  assert.equal((await store.getState()).owned, false);
  assert.equal(storage.data.size, 0);
});

test('FREE_FOREVER lists every tracing tool', () => {
  const text = FREE_FOREVER.join(' | ').toLowerCase();
  for (const tool of [
    'camera tracing',
    'opacity',
    'scale',
    'rotate',
    'lock',
    'flashlight',
    'grid',
    'mirror',
    'touch-lock',
    'lightbox',
    'own photos',
    '24 starter templates',
  ]) {
    assert.ok(text.includes(tool), `FREE_FOREVER missing ${tool}`);
  }
  // Plus never lists a camera tracing tool (outline mode moved to Plus by owner decision 22 Oct 2026).
  const plus = PLUS_FEATURES.join(' ').toLowerCase();
  for (const tool of ['opacity', 'flashlight', 'mirror', 'lightbox', 'camera']) {
    assert.ok(!plus.includes(tool), `PLUS_FEATURES mentions ${tool}`);
  }
});

test('price label and packs', () => {
  assert.equal(PLUS_PRICE_LABEL, 'A$2.99 one-time');
  assert.ok(PACKS.length >= 3 && PACKS.length <= 4);
  assert.equal(new Set(PACKS.map((p) => p.id)).size, PACKS.length);
  for (const p of PACKS) {
    assert.ok(p.name.length > 0);
    assert.equal(p.count, 0);
    assert.equal(p.locked, true);
  }
});

// CONVENTIONS: only src/plus may read the Plus entitlement.
test('only the Plus, Settings, Templates, Home and Prepare screens and src/plus import src/plus', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  // Templates, Home and Prepare read `access` for the post-trial locks (owner decision 22 Oct 2026); Trace never does.
  const allowed = new Set(['app/plus.tsx', 'app/(tabs)/settings.tsx', 'app/(tabs)/templates.tsx', 'app/(tabs)/index.tsx', 'app/prepare.tsx']);
  const files: string[] = [];
  for (const top of ['app', 'src']) {
    for (const f of readdirSync(join(root, top), { recursive: true }) as string[]) {
      if (/\.tsx?$/.test(f)) files.push(join(root, top, f));
    }
  }
  assert.ok(files.length > 10);
  const offenders: string[] = [];
  for (const f of files) {
    const rel = relative(root, f).split(sep).join('/');
    if (allowed.has(rel) || rel.startsWith('src/plus/')) continue;
    const text = readFileSync(f, 'utf8');
    if (
      /(from|import)\s*\(?\s*['"][^'"]*\/plus(\/[^'"]*)?['"]/.test(text) ||
      /require\(\s*['"][^'"]*\/plus(\/[^'"]*)?['"]/.test(text)
    ) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, []);
});
