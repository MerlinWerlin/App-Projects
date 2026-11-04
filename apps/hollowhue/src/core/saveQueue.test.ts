import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSaveQueue } from './saveQueue.ts';

test('flush waits for an in-flight save and a newer edit; old data cannot win', async () => {
  const writes: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const q = createSaveQueue(async (_key, value) => { if (value === 'old') await gate; writes.push(value); }, 60_000);
  q.put('scene', 'old');
  const first = q.flush();
  await Promise.resolve();
  await Promise.resolve();
  q.put('scene', 'latest');
  let done = false;
  const second = q.flush().then(() => { done = true; });
  await Promise.resolve();
  assert.equal(done, false);
  release(); await Promise.all([first, second]);
  assert.deepEqual(writes, ['old', 'latest']);
});
test('a failed save rejects flush and stays dirty for a successful retry', async () => {
  let fail = true;
  const writes: string[] = [];
  const q = createSaveQueue(async (key, value) => { if (fail) throw new Error('disk full'); writes.push(`${key}:${value}`); }, 60_000);
  q.put('a', 'picture'); q.put('b', 'colours');
  await assert.rejects(q.flush(), /disk full/);
  fail = false; await q.flush();
  assert.deepEqual(writes, ['a:picture', 'b:colours']);
});
