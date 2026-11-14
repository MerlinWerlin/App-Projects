// T172: the seeded randomness the numbers quiz uses (moved from the removed travel games).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newSeed, rng, seedFrom, shuffle } from './seeded.ts';

test('same seed, same run; the input list is never changed', () => {
  assert.equal(seedFrom('abc'), seedFrom('abc'));
  assert.notEqual(seedFrom('abc'), seedFrom('abd'));
  const a = rng(42);
  const b = rng(42);
  for (let i = 0; i < 5; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  const list = [1, 2, 3, 4, 5, 6];
  const s = shuffle(list, 7);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...s].sort(), list);
  assert.deepEqual(shuffle(list, 7), s);
  assert.equal(newSeed(1000), newSeed(1000));
});
