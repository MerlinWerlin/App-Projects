import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  finishActions,
  finishHaptic,
  finishReduce,
  initialFinishState,
  shouldOpenFinish,
  showTimelapseNote,
  sparkleDelays,
  timelapseExists,
} from './finish.ts';

test('finished tap always opens the sheet when closed', () => {
  assert.equal(shouldOpenFinish('done', initialFinishState), true);
  const s = finishReduce(finishReduce(initialFinishState, 'saved'), 'close');
  assert.equal(shouldOpenFinish('done', s), true);
});

test('a save opens the sheet once per snapshot', () => {
  const a = finishReduce(initialFinishState, 'saved');
  assert.deepEqual(a, { open: true, saved: true, shownAfterSave: true });
  const b = finishReduce(a, 'close');
  assert.equal(b.open, false);
  assert.equal(b.saved, true);
  assert.equal(shouldOpenFinish('saved', b), false);
  assert.deepEqual(finishReduce(b, 'saved'), b);
});

test('saving from inside the open sheet keeps it open and marks saved', () => {
  const open = finishReduce(initialFinishState, 'done');
  assert.deepEqual(open, { open: true, saved: false, shownAfterSave: false });
  assert.equal(shouldOpenFinish('saved', open), false);
  const saved = finishReduce(open, 'saved');
  assert.equal(saved.open, true);
  assert.equal(saved.saved, true);
});

test('success haptic only for the finished tap (a save already buzzed)', () => {
  assert.equal(finishHaptic('done'), 'success');
  assert.equal(finishHaptic('saved'), 'none');
});

test('actions: save first and primary until saved', () => {
  const a = finishActions({ saved: false, canSave: true });
  assert.deepEqual(a.map((x) => x.id), ['save', 'viewDrawings', 'traceAgain', 'close']);
  assert.equal(a[0].variant, 'primary');
  const b = finishActions({ saved: true, canSave: true });
  assert.deepEqual(b.map((x) => x.id), ['viewDrawings', 'traceAgain', 'close']);
  assert.equal(b[0].variant, 'primary');
  const c = finishActions({ saved: false, canSave: false });
  assert.equal(c.some((x) => x.id === 'save'), false);
  for (const list of [a, b, c]) assert.equal(list.filter((x) => x.variant === 'primary').length, 1);
});

test('time-lapse note only when no clip exists', () => {
  for (const p of ['idle', 'recording', 'stopping', undefined] as const) {
    assert.equal(timelapseExists(p), false);
    assert.equal(showTimelapseNote(p), true);
  }
  for (const p of ['review', 'saving', 'saved', 'denied', 'error'] as const) {
    assert.equal(timelapseExists(p), true);
    assert.equal(showTimelapseNote(p), false);
  }
});

test('sparkle delays stagger, or none with Reduce Motion', () => {
  assert.deepEqual(sparkleDelays(4, false), [0, 70, 140, 210]);
  assert.deepEqual(sparkleDelays(3, true), [0, 0, 0]);
  assert.deepEqual(sparkleDelays(-1, false), []);
});
