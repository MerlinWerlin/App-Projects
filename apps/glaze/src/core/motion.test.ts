import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MS,
  STAGGER_MAX,
  clamp,
  durations,
  fitDelays,
  parallaxAt,
  rippleDelays,
  rubberBand,
  rubberClamp,
  staggerDelay,
} from './motion.ts';

test('durations match the polish brief and stay under the cap', () => {
  assert.deepEqual({ ...durations }, { fast: 120, base: 200, slow: 320 });
  for (const v of Object.values(durations)) assert.ok(v <= MAX_MS);
});

test('staggerDelay is 30 ms per item and caps at 8 items', () => {
  assert.equal(staggerDelay(0), 0);
  assert.equal(staggerDelay(1), 30);
  assert.equal(staggerDelay(7), 210);
  assert.equal(staggerDelay(50), (STAGGER_MAX - 1) * 30);
  assert.equal(staggerDelay(-3), 0);
  assert.equal(staggerDelay(Number.NaN), 0);
});

test('clamp handles NaN', () => {
  assert.equal(clamp(Number.NaN, 0, 1), 0);
  assert.equal(clamp(5, 0, 1), 1);
});

test('rubberBand resists and keeps sign', () => {
  assert.equal(rubberBand(0, 100), 0);
  const a = rubberBand(50, 100);
  const b = rubberBand(200, 100);
  assert.ok(a > 0 && a < 50);
  assert.ok(b > a && b < 100);
  assert.ok(rubberBand(-50, 100) < 0);
  assert.equal(rubberBand(10, 0), 0);
});

test('rubberClamp passes through inside the range and stretches outside', () => {
  assert.equal(rubberClamp(5, 0, 10, 100), 5);
  const v = rubberClamp(30, 0, 10, 100);
  assert.ok(v > 10 && v < 30);
  const w = rubberClamp(-30, 0, 10, 100);
  assert.ok(w < 0 && w > -30);
});

test('parallaxAt is largest at the centre and drifts against scroll', () => {
  const c = parallaxAt(0);
  assert.equal(c.translateY, -0);
  assert.ok(c.scale > 1);
  assert.ok(parallaxAt(1).translateY < 0);
  assert.ok(parallaxAt(-1).translateY > 0);
  assert.equal(parallaxAt(5).scale, 1);
});

test('rippleDelays grow with distance and fitDelays respects the budget', () => {
  const d = rippleDelays(8, 4, 40);
  assert.equal(d.length, 8);
  assert.equal(d[0], 0);
  assert.ok(d[3] > d[1]);
  assert.ok(d[5] > d[4] || d[5] > d[0]);
  const fitted = fitDelays(rippleDelays(28, 4, 40), 300);
  assert.ok(Math.max(...fitted) <= 300);
  assert.deepEqual(fitDelays([0, 10], 300), [0, 10]);
  assert.deepEqual(rippleDelays(0, 4), []);
});
