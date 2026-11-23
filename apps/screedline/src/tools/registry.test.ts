import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, TOOLS, toolById, visible, type Values } from './registry.ts';
import { line, show } from './present.ts';
import { addItem, jobSheet, makeJob, parseJobs, removeItem, updateJob } from '../core/jobs.ts';

const runnable = TOOLS.filter(t => t.run);

test('every tool has a unique id and an icon', () => {
  assert.equal(new Set(TOOLS.map(t => t.id)).size, TOOLS.length);
  for (const t of TOOLS) assert.ok(t.icon && t.title && t.blurb, t.id);
  assert.ok(TOOLS.some(t => t.free) && TOOLS.some(t => !t.free));
});

test('every tool works out of the box with its defaults', () => {
  for (const t of runnable) {
    const r = t.run!(defaults(t));
    assert.equal(r.ok, true, `${t.id}: ${JSON.stringify(!r.ok && r.errors)}`);
    if (r.ok) {
      assert.ok(Number.isFinite(r.headline.value), t.id);
      assert.ok(r.steps.length > 0, `${t.id} shows working`);
    }
  }
});

test('every visible required number, when cleared, shows an error on that field', () => {
  for (const t of runnable) {
    const base = defaults(t);
    // also try each choice value so conditional fields are covered
    const variants: Values[] = [base];
    for (const f of t.fields) if (f.type === 'choice') for (const o of f.options) variants.push({ ...base, [f.key]: o.value, ...(f.apply ? f.apply(o.value) : {}) });
    for (const v of variants) {
      for (const f of t.fields) {
        if (f.type !== 'num' || f.optional || !visible(f, v)) continue;
        const r = t.run!({ ...v, [f.key]: null });
        assert.equal(r.ok, false, `${t.id}.${f.key} empty should fail`);
        if (!r.ok) assert.ok(r.errors[f.key], `${t.id}.${f.key} error lands on the field: ${JSON.stringify(r.errors)}`);
      }
      const ok = t.run!(v);
      assert.equal(ok.ok, true, `${t.id} variant ${JSON.stringify(v)}: ${JSON.stringify(!ok.ok && ok.errors)}`);
    }
  }
});

test('volume tools hand their total to the truck order', () => {
  const r = toolById('slab')!.run!(defaults(toolById('slab')!));
  assert.ok(r.ok && r.next?.tool === 'order');
  if (r.ok && r.next) {
    const order = toolById('order')!.run!(defaults(toolById('order')!, r.next.values));
    assert.ok(order.ok && Math.abs(order.headline.value - 2.6) < 1e-9); // 2.52 → 2.6 m³
  }
});

test('store-screenshot demo jobs are worked out by the real tools', async () => {
  const { demoJobs } = await import('../state/capture.ts');
  const jobs = demoJobs(1_800_000_000_000);
  const slab = jobs[0]!.items.find(i => i.toolId === 'slab')!;
  // 9.5 × 5.2 × 0.125 = 6.175; edge ring 49.4 − 8.9 × 4.6 = 8.46 m² × 0.175 = 1.4805; × 1.05 = 8.038 m³
  assert.equal(slab.lines[0], 'Concrete to order: 8.04 m³ (includes 5 % waste)');
  const order = jobs[0]!.items.find(i => i.toolId === 'order')!;
  assert.equal(order.lines[0], 'Order: 8.2 m³ (2 trucks)');
});

test('custom formwork reports bad sides on the list', () => {
  const t = toolById('formwork')!;
  const r = t.run!(defaults(t, { outline: 'custom', sides: [6, null, 4] }));
  assert.ok(!r.ok && r.errors.sides);
});

test('results read correctly in both unit systems', () => {
  assert.deepEqual(show('vol', 2.52, 'metric'), { value: '2.52', unit: 'm³' });
  assert.deepEqual(show('vol', 0.764554857984, 'imperial'), { value: '1.00', unit: 'yd³' });
  assert.deepEqual(show('mm', 0.1, 'metric'), { value: '100', unit: 'mm' });
  assert.deepEqual(show('mm', 0.0254, 'imperial'), { value: '1.00', unit: 'in' });
  assert.deepEqual(show('kg', 1250, 'metric'), { value: '1.25', unit: 't' });
  assert.deepEqual(show('t', 0.90718474, 'imperial'), { value: '1.00', unit: 'US tons' });
  assert.equal(line({ label: 'Bags', value: 11, kind: 'count' }, 'metric'), 'Bags: 11');
});

test('jobs: save, remove, rename, survive bad storage, and print a sheet', () => {
  const now = 1_800_000_000_000;
  let jobs = [makeJob('  Smith   driveway ', now, 'a')];
  assert.equal(jobs[0]!.name, 'Smith driveway');
  jobs = addItem(jobs, 'a', { id: 'i1', toolId: 'slab', title: 'Slab', values: { length: 6 }, lines: ['Concrete to order: 2.52 m³'], savedAt: now }, now + 1);
  jobs = updateJob(jobs, 'a', { notes: '12 Example St', name: '   ' }, now + 2);
  assert.equal(jobs[0]!.name, 'Smith driveway');
  const sheet = jobSheet(jobs[0]!, () => '23 Nov');
  assert.ok(sheet.includes('SMITH DRIVEWAY') && sheet.includes('Concrete to order: 2.52 m³') && sheet.includes('Confirm with your supplier'));
  const back = parseJobs(JSON.stringify(jobs));
  assert.deepEqual(back, jobs);
  assert.equal(removeItem(jobs, 'a', 'i1', now + 3)[0]!.items.length, 0);
  assert.deepEqual(parseJobs('not json'), []);
  assert.deepEqual(parseJobs(JSON.stringify([{ id: 1 }, null, { id: 'x', name: 'ok', items: [{ bad: true }] }])).map(j => j.items.length), [0]);
});
