import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCalc, createJob, deleteJob, jobText, parseJobs, removeCalc, renameJob } from './jobs.ts';

test('jobs round-trip through JSON and drop anything malformed', () => {
  let { jobs, job } = createJob([], '  Smith deck  ', 1000, () => 0.5);
  assert.equal(job.name, 'Smith deck');
  jobs = addCalc(jobs, job.id, { id: 'c1', tool: 'decking', title: 'Deck boards', summary: '33 boards', inputs: { width: '3000' }, savedAt: 1 });
  const back = parseJobs(JSON.stringify(jobs));
  assert.deepEqual(back, jobs);
  const messy = JSON.stringify([null, 5, { id: 'x' }, { id: 'y', name: 'ok', calcs: [{ id: 'a', tool: 'nope' }, { id: 'b', tool: 'stairs', inputs: { rise: '2700', bad: 7 } }] }]);
  const p = parseJobs(messy);
  assert.equal(p.length, 1);
  assert.equal(p[0].calcs.length, 1);
  assert.deepEqual(p[0].calcs[0].inputs, { rise: '2700' });
  assert.deepEqual(parseJobs('not json'), []);
  assert.deepEqual(parseJobs(null), []);
});

test('rename, remove, delete and share text', () => {
  let { jobs, job } = createJob([], '', 1000, () => 0.1);
  assert.equal(job.name, 'Untitled job');
  jobs = renameJob(jobs, job.id, 'Garage');
  jobs = renameJob(jobs, job.id, '   ');
  assert.equal(jobs[0].name, 'Garage');
  jobs = addCalc(jobs, job.id, { id: 'c1', tool: 'stairs', title: 'Stairs', summary: '15 risers at 180 mm', inputs: {}, savedAt: 1 });
  assert.match(jobText(jobs[0]), /Garage[\s\S]*15 risers[\s\S]*Verify against the plans/);
  jobs = removeCalc(jobs, job.id, 'c1');
  assert.equal(jobs[0].calcs.length, 0);
  assert.deepEqual(deleteJob(jobs, job.id), []);
});
