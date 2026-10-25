import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PLUS_SKU,
  failureMessage,
  isCancelCode,
  purchasePlus,
  restorePlus,
  type IapClient,
  type IapError,
  type IapPurchase,
} from './iapFlow.ts';

type Mock = IapClient & {
  requests: unknown[];
  finished: { purchase: IapPurchase; isConsumable: false }[];
  emit(p: IapPurchase): void;
  fail(e: IapError): void;
};

function mock(opts: {
  ret?: () => Promise<unknown>;
  available?: IapPurchase[];
  initFails?: boolean;
} = {}): Mock {
  const ok = new Set<(p: IapPurchase) => void>();
  const err = new Set<(e: IapError) => void>();
  const m: Mock = {
    requests: [],
    finished: [],
    emit: (p) => ok.forEach((f) => f(p)),
    fail: (e) => err.forEach((f) => f(e)),
    async initConnection() {
      if (opts.initFails) throw { code: 'init-connection' };
      return true;
    },
    requestPurchase(args) {
      m.requests.push(args);
      return opts.ret ? opts.ret() : new Promise(() => {});
    },
    purchaseUpdatedListener(cb) {
      ok.add(cb);
      return { remove: () => ok.delete(cb) };
    },
    purchaseErrorListener(cb) {
      err.add(cb);
      return { remove: () => err.delete(cb) };
    },
    async getAvailablePurchases() {
      return opts.available ?? [];
    },
    async finishTransaction(a) {
      m.finished.push(a);
      return true;
    },
  };
  return m;
}

const fastSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms > 1000 ? 5 : ms));
const P: IapPurchase = { productId: PLUS_SKU, transactionId: 't1' };

test('sends both request key styles with type in-app', async () => {
  const m = mock({ ret: async () => P });
  await purchasePlus({ client: m, sleep: fastSleep });
  const r = m.requests[0] as { request: Record<string, unknown>; type: string };
  assert.equal(r.type, 'in-app');
  assert.deepEqual(Object.keys(r.request).sort(), ['android', 'apple', 'google', 'ios']);
  assert.deepEqual(r.request.ios, { sku: PLUS_SKU });
  assert.deepEqual(r.request.google, { skus: [PLUS_SKU] });
});

test('returned value unlocks and finishes as non-consumable', async () => {
  const m = mock({ ret: async () => [P] });
  const res = await purchasePlus({ client: m, sleep: fastSleep });
  assert.equal(res.kind, 'purchased');
  assert.equal(m.finished.length, 1);
  assert.equal(m.finished[0].isConsumable, false);
});

test('listener alone (returned value empty) unlocks', async () => {
  const m = mock({ ret: async () => null });
  const p = purchasePlus({ client: m, sleep: fastSleep, waitMs: 50 });
  setTimeout(() => m.emit({ productId: 'other' }), 1);
  setTimeout(() => m.emit(P), 2);
  const res = await p;
  assert.equal(res.kind, 'purchased');
});

test('cancel stays quiet and skips the re-check', async () => {
  const m = mock({ ret: () => Promise.reject({ code: 'user-cancelled' }), available: [P] });
  const res = await purchasePlus({ client: m, sleep: fastSleep });
  assert.deepEqual(res, { kind: 'cancelled' });
  assert.ok(isCancelCode('E_USER_CANCELLED'));
});

test('error then late delivery: re-check getAvailablePurchases unlocks', async () => {
  const m = mock({ ret: () => Promise.reject({ code: 'network-error' }), available: [P] });
  const res = await purchasePlus({ client: m, sleep: fastSleep });
  assert.equal(res.kind, 'purchased');
  assert.equal(m.finished.length, 1);
});

test('error with nothing owned reports the store code', async () => {
  const m = mock({ ret: () => Promise.reject({ code: 'E_SERVICE_ERROR' }) });
  const res = await purchasePlus({ client: m, sleep: fastSleep });
  assert.deepEqual(res, { kind: 'failed', code: 'E_SERVICE_ERROR' });
  assert.match(failureMessage('E_SERVICE_ERROR'), /nothing was charged.*E_SERVICE_ERROR/);
});

test('silence times out, re-checks, then fails with timeout', async () => {
  const m = mock();
  const res = await purchasePlus({ client: m, sleep: fastSleep, waitMs: 5 });
  assert.deepEqual(res, { kind: 'failed', code: 'timeout' });
});

test('error listener path and init failure', async () => {
  const m = mock();
  const p = purchasePlus({ client: m, sleep: fastSleep, waitMs: 50 });
  setTimeout(() => m.fail({ code: 'E_UNKNOWN' }), 1);
  assert.deepEqual(await p, { kind: 'failed', code: 'E_UNKNOWN' });
  const bad = await purchasePlus({ client: mock({ initFails: true }), sleep: fastSleep });
  assert.deepEqual(bad, { kind: 'failed', code: 'init-connection' });
});

test('restore finds the SKU by productId or id', async () => {
  assert.equal(await restorePlus({ client: mock({ available: [{ id: PLUS_SKU }] }) }), true);
  assert.equal(await restorePlus({ client: mock({ available: [{ productId: 'x' }] }) }), false);
});

test('D130-2: expo-iap is not a dependency yet and nothing imports it', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  assert.equal('expo-iap' in deps, false);
  const store = readFileSync(new URL('../plus/iapStore.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(store, /from ['"]expo-iap['"]|require\(['"]expo-iap['"]\)/);
  const ent = readFileSync(new URL('../plus/entitlement.ts', import.meta.url), 'utf8');
  assert.match(ent, /createMockPlusStore\(/);
});
