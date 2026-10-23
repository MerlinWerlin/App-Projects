import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_FLOW, clampStep, segmentFilled, stepLabelParams, stepStates } from './steps.ts';

test('photo flow is pick → outline → trace', () => {
  assert.deepEqual([...PHOTO_FLOW], ['pick', 'outline', 'trace']);
});

test('states per index', () => {
  assert.deepEqual(stepStates(3, 0), ['current', 'todo', 'todo']);
  assert.deepEqual(stepStates(3, 1), ['done', 'current', 'todo']);
  assert.deepEqual(stepStates(3, 2), ['done', 'done', 'current']);
});

test('out-of-range and invalid input is clamped', () => {
  assert.deepEqual(stepStates(3, 9), ['done', 'done', 'current']);
  assert.deepEqual(stepStates(3, -2), ['current', 'todo', 'todo']);
  assert.deepEqual(stepStates(3, Number.NaN), ['current', 'todo', 'todo']);
  assert.deepEqual(stepStates(0, 1), []);
  assert.equal(clampStep(1.6, 3), 2);
  assert.equal(clampStep(5, 0), 0);
});

test('connecting segments fill up to the current step', () => {
  assert.equal(segmentFilled(0, 1, 3), true);
  assert.equal(segmentFilled(1, 1, 3), false);
  assert.equal(segmentFilled(1, 2, 3), true);
  assert.equal(segmentFilled(2, 2, 3), false, 'no segment after the last step');
  assert.equal(segmentFilled(-1, 2, 3), false);
});

test('label params are 1-based', () => {
  assert.deepEqual(stepLabelParams(3, 1), { current: 2, total: 3, index: 1 });
  assert.deepEqual(stepLabelParams(3, 7), { current: 3, total: 3, index: 2 });
  assert.deepEqual(stepLabelParams(0, 0), { current: 0, total: 0, index: 0 });
});
