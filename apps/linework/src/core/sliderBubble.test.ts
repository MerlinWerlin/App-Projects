import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bubbleLayout, bubblePopKeys, sliderBubble } from './sliderBubble.ts';

test('bubble centres on the thumb in the middle of the track', () => {
  const b = bubbleLayout(150, 60, 300);
  assert.equal(b.start, 120);
  assert.equal(b.tail, 30);
});

test('bubble is clamped inside the track at both ends; the tail still points at the thumb', () => {
  const a = bubbleLayout(14, 60, 300);
  assert.equal(a.start, 0);
  assert.equal(a.tail, 14);
  const z = bubbleLayout(296, 60, 300);
  assert.equal(z.start, 240);
  assert.equal(z.tail, 60 - sliderBubble.tailInset, 'tail stays off the rounded corner');
  const far = bubbleLayout(-50, 60, 300);
  assert.equal(far.start, 0);
  assert.equal(far.tail, sliderBubble.tailInset);
});

test('bubble never leaves the track for any thumb position', () => {
  for (let c = -20; c <= 320; c += 7) {
    const { start, tail } = bubbleLayout(c, 72, 300);
    assert.ok(start >= 0 && start + 72 <= 300, `start ${start} for ${c}`);
    assert.ok(tail >= sliderBubble.tailInset && tail <= 72 - sliderBubble.tailInset);
  }
});

test('a bubble longer than the track is centred; invalid input is safe', () => {
  assert.deepEqual(bubbleLayout(10, 120, 100), { start: -10, tail: 20 });
  const n = bubbleLayout(Number.NaN, 40, 200);
  assert.equal(n.start, 80);
  const z = bubbleLayout(5, 0, 0);
  assert.deepEqual(z, { start: 0, tail: 0 });
});

test('pop keyframes: springs from smaller with a rise; Reduce Motion fades only', () => {
  const k = bubblePopKeys(false);
  assert.deepEqual(k.scale.outputRange, [sliderBubble.popFrom, 1]);
  assert.deepEqual(k.rise.outputRange, [sliderBubble.rise, 0]);
  assert.equal(k.opacity.outputRange[0], 0);
  const r = bubblePopKeys(true);
  assert.deepEqual(r.scale.outputRange, [1, 1]);
  assert.deepEqual(r.rise.outputRange, [0, 0]);
});
