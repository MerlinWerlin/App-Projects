import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalc, cleanName, createJob, deleteJob, jobToText, parseJobs, removeCalc, renameJob, setNotes, type JobsDoc } from './jobs.ts';

const empty: JobsDoc = { version: 1, jobs: [] };

test('create, add, remove, rename, delete', () => {
  const { doc, job } = createJob(empty, '  Smith   reno ', 1000);
  assert.equal(job.name, 'Smith reno');
  let d = addCalc(doc, job.id, { kind: 'offset', title: 'Offset', lines: ['Marks 200 mm apart'], steps: [] }, 2000);
  assert.equal(d.jobs[0]!.items.length, 1);
  const calcId = d.jobs[0]!.items[0]!.id;
  d = renameJob(d, job.id, 'Smith kitchen', 3000);
  assert.equal(d.jobs[0]!.name, 'Smith kitchen');
  assert.equal(renameJob(d, job.id, '   ').jobs[0]!.name, 'Smith kitchen');
  d = setNotes(d, job.id, 'Gate code 1234');
  assert.equal(d.jobs[0]!.notes, 'Gate code 1234');
  d = removeCalc(d, job.id, calcId);
  assert.equal(d.jobs[0]!.items.length, 0);
  d = deleteJob(d, job.id);
  assert.equal(d.jobs.length, 0);
});

test('adding a calc moves the job to the top; unknown job is a no-op', () => {
  const a = createJob(empty, 'A', 1);
  const b = createJob(a.doc, 'B', 2);
  assert.deepEqual(b.doc.jobs.map(j => j.name), ['B', 'A']);
  const d = addCalc(b.doc, a.job.id, { kind: 'ohm', title: 'Ohm', lines: ['10 A'], steps: [] }, 3);
  assert.deepEqual(d.jobs.map(j => j.name), ['A', 'B']);
  assert.equal(addCalc(d, 'missing', { kind: 'ohm', title: 'x', lines: [], steps: [] }), d);
});

test('parseJobs survives corrupt or foreign data', () => {
  assert.deepEqual(parseJobs(null), empty);
  assert.deepEqual(parseJobs('not json'), empty);
  assert.deepEqual(parseJobs('{"version":2,"jobs":[]}'), empty);
  const parsed = parseJobs(JSON.stringify({ version: 1, jobs: [{ id: 'x', name: 'Ok', items: [{ id: 'i', lines: ['a'] }, null] }, { nope: true }] }));
  assert.equal(parsed.jobs.length, 1);
  assert.equal(parsed.jobs[0]!.items.length, 1);
  assert.equal(parsed.jobs[0]!.notes, '');
});

test('names are trimmed and capped; text export ends with the disclaimer', () => {
  assert.equal(cleanName('x'.repeat(100)).length, 60);
  const { doc, job } = createJob(empty, '', 1);
  assert.equal(job.name, 'Untitled job');
  const d = addCalc(doc, job.id, { kind: 'vdrop', title: 'Voltage drop', lines: ['4.7 %'], steps: [] }, 5);
  const text = jobToText(d.jobs[0]!, 'Estimate only.');
  assert.ok(text.includes('Voltage drop') && text.endsWith('Estimate only.'));
});
