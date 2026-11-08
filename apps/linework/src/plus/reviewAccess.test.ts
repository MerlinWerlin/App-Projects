import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createReviewAccess } from './reviewAccess.ts';

const code = '0123456789ABCDEF0123456789ABCDEF';
const digest = createHash('sha256').update(code).digest('hex');

test('reusable review code survives reopening and does not write a purchase', async () => {
  const entries = new Map<string, string>();
  const storage = {
    get: async (key: string) => entries.get(key) ?? null,
    set: async (key: string, value: string) => { entries.set(key, value); },
  };
  const review = createReviewAccess(storage, digest);
  assert.equal(await review.isActive(), false);
  assert.equal(await review.activate('0'.repeat(32)), false);
  assert.equal(entries.size, 0);
  assert.equal(await review.activate(`  ${code.toLowerCase()}  `), true);
  assert.equal(await createReviewAccess(storage, digest).isActive(), true);
  assert.deepEqual([...entries.keys()], ['linework.playReview.v1']);
});

test('failed persistence cannot grant reviewer access', async () => {
  const review = createReviewAccess({
    get: async () => null,
    set: async () => { throw new Error('storage unavailable'); },
  }, digest);
  assert.equal(await review.activate(code), false);
  assert.equal(await review.isActive(), false);
});
