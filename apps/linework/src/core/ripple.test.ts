import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evalKeys,
  ringDelays,
  ringOpacityKeys,
  ringPeak,
  ringScaleKeys,
  ripple,
  rippleOrigin,
  rippleRadius,
  rippleTotalMs,
} from './ripple.ts';

test('two staggered rings per tap', () => {
  assert.equal(ripple.rings, 2);
  assert.deepEqual(ringDelays(), [0, ripple.stagger]);
  assert.deepEqual(ringDelays(0), []);
  assert.equal(rippleTotalMs(), ripple.stagger + ripple.duration);
  assert.ok(rippleTotalMs() <= 700, 'a tap ripple stays short');
});

test('origin falls back to the centre and is clamped into the box', () => {
  assert.deepEqual(rippleOrigin(100, 50), { x: 50, y: 25 });
  assert.deepEqual(rippleOrigin(100, 50, Number.NaN, 10), { x: 50, y: 10 });
  assert.deepEqual(rippleOrigin(100, 50, -5, 80), { x: 0, y: 50 });
});

test('radius reaches the farthest corner', () => {
  assert.equal(rippleRadius(100, 50, 50, 25), Math.hypot(50, 25));
  assert.equal(rippleRadius(100, 50, 0, 0), Math.hypot(100, 50));
  assert.equal(rippleRadius(300, 50, 280, 10), Math.hypot(280, 40));
  assert.equal(rippleRadius(0, 0, 0, 0), 1, 'never zero');
});

test('scale grows from a dot to full size', () => {
  const k = ringScaleKeys();
  assert.equal(evalKeys(k, 0), ripple.startScale);
  assert.equal(evalKeys(k, 1), 1);
  assert.ok(evalKeys(k, 0.5) > ripple.startScale && evalKeys(k, 0.5) < 1);
});

test('opacity fades in, peaks, then out; later rings are fainter', () => {
  const k0 = ringOpacityKeys(0);
  assert.equal(evalKeys(k0, 0), 0);
  assert.equal(evalKeys(k0, 0.15), ripple.peakOpacity);
  assert.equal(evalKeys(k0, 1), 0);
  assert.ok(evalKeys(k0, 0.6) > 0 && evalKeys(k0, 0.6) < ripple.peakOpacity);
  assert.ok(ringPeak(1) < ringPeak(0));
  assert.ok(ringPeak(1) > 0);
  // keyframes are monotonic in input (Animated requires it)
  for (const k of [ringScaleKeys(), k0, ringOpacityKeys(1)]) {
    for (let i = 1; i < k.inputRange.length; i++) assert.ok(k.inputRange[i] > k.inputRange[i - 1]);
  }
});

test('evalKeys clamps outside the range', () => {
  const k = { inputRange: [0, 1], outputRange: [2, 4] };
  assert.equal(evalKeys(k, -1), 2);
  assert.equal(evalKeys(k, 3), 4);
  assert.equal(evalKeys(k, Number.NaN), 2);
  assert.equal(evalKeys(k, 0.25), 2.5);
});
