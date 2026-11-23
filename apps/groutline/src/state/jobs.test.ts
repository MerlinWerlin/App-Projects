import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobText, parseJobs, type Job } from './jobs.ts';

const job: Job = { id: 'a', name: 'Smith ensuite', tool: 'tiles', inputs: { l: '3000' }, summary: ['26 tiles', '7 cartons'], country: 'AU', createdAt: 1, updatedAt: 2 };

test('saved jobs survive a round trip and junk is dropped', () => {
  assert.deepEqual(parseJobs(JSON.stringify([job])), [job]);
  assert.deepEqual(parseJobs(null), []);
  assert.deepEqual(parseJobs('not json'), []);
  assert.deepEqual(parseJobs(JSON.stringify({ a: 1 })), []);
  assert.deepEqual(parseJobs(JSON.stringify([{ ...job, tool: 'laser' }, { id: 1 }, job])), [job]);
});

test('job share text has the answer and the working', () => {
  const t = jobText(job, 'Tiles', [{ label: 'Area', working: '3 × 2.8', result: '8.4 m²' }]);
  assert.match(t, /Smith ensuite \(Tiles\)/);
  assert.match(t, /26 tiles/);
  assert.match(t, /• Area: 3 × 2.8 = 8.4 m²/);
});
