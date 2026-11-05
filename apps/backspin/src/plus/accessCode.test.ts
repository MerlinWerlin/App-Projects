import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessCodeDigest, createCodeAccess } from './accessCode.ts';
import { freeGoesLeft, hasAccess } from '../core/game.ts';

test('a valid code grants local unlimited access across restart and can be removed', async () => {
  const data = new Map<string, string>();
  const storage = {
    get: async (key: string) => data.get(key) || null,
    set: async (key: string, value: string) => { data.set(key, value); },
  };
  const digest = accessCodeDigest('TEST-ACCESS');
  const access = createCodeAccess(storage, digest);
  assert.equal(await access.read(), false);
  assert.equal(await access.activate('wrong'), false);
  assert.equal(data.size, 0);
  assert.equal(await access.activate(' test-access '), true);
  const restarted = createCodeAccess(storage, digest);
  const active = await restarted.read();
  assert.equal(active, true);
  assert.equal(hasAccess(active, 10), true);
  assert.equal(freeGoesLeft(active, 10), null);
  assert.equal(await restarted.remove(), true);
  assert.equal(hasAccess(await restarted.read(), 10), false);
  assert.equal(await createCodeAccess(storage, digest).read(), false);
});

test('failed storage operations do not report activation or removal', async () => {
  const storage = {
    get: async () => null,
    set: async () => { throw new Error('storage unavailable'); },
  };
  const access = createCodeAccess(storage, accessCodeDigest('TEST-ACCESS'));
  assert.equal(await access.activate('TEST-ACCESS'), false);
  assert.equal(await access.read(), false);
  assert.equal(await access.remove(), false);
});
