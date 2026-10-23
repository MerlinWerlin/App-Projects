import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MIX,
  MIX_PRESETS,
  clampMix,
  compareLayers,
  isSnapshot,
  mixLabel,
  nudgeMix,
  toggleCompareMode,
} from './compare.ts';

test('clampMix keeps 0..1 and handles bad numbers', () => {
  assert.equal(clampMix(0.3), 0.3);
  assert.equal(clampMix(-2), 0);
  assert.equal(clampMix(5), 1);
  assert.equal(clampMix(Number.NaN), DEFAULT_MIX);
  assert.equal(clampMix(Infinity), 1);
  assert.equal(clampMix(-Infinity), 0);
});

test('nudgeMix steps without float drift and clamps', () => {
  assert.equal(nudgeMix(0.2, 0.1), 0.3);
  assert.equal(nudgeMix(0.7, 0.1), 0.8);
  assert.equal(nudgeMix(0.95, 0.1), 1);
  assert.equal(nudgeMix(0.05, -0.1), 0);
  assert.equal(nudgeMix(0.4, Number.NaN), 0.4);
});

test('compareLayers: drawing only, both, reference only', () => {
  assert.deepEqual(compareLayers(0), { photo: 1, overlay: 0 });
  const mid = compareLayers(0.5);
  assert.equal(mid.overlay, 0.5);
  assert.ok(mid.photo > 0.5 && mid.photo < 1);
  const ref = compareLayers(1);
  assert.equal(ref.overlay, 1);
  assert.ok(ref.photo > 0 && ref.photo < 0.3, 'paper stays faintly visible');
});

test('compareLayers is monotonic', () => {
  let prev = compareLayers(0);
  for (let m = 0.1; m <= 1.0001; m += 0.1) {
    const cur = compareLayers(m);
    assert.ok(cur.photo <= prev.photo);
    assert.ok(cur.overlay >= prev.overlay);
    prev = cur;
  }
});

test('mixLabel names the ends and shows a percentage between', () => {
  assert.equal(mixLabel(0), 'Your drawing');
  assert.equal(mixLabel(1), 'Reference');
  assert.equal(mixLabel(0.42), 'Reference 42%');
});

test('presets cover drawing, both and reference', () => {
  assert.deepEqual(
    MIX_PRESETS.map((p) => p.mix),
    [0, 0.5, 1],
  );
  for (const p of MIX_PRESETS) assert.ok(p.label.length > 0);
});

test('toggleCompareMode flips overlay and side', () => {
  assert.equal(toggleCompareMode('overlay'), 'side');
  assert.equal(toggleCompareMode('side'), 'overlay');
});

test('isSnapshot accepts a capture with a uri only', () => {
  assert.equal(isSnapshot({ uri: 'file:///cache/Camera/a.jpg', width: 10, height: 20 }), true);
  assert.equal(isSnapshot({ uri: '' }), false);
  assert.equal(isSnapshot(undefined), false);
  assert.equal(isSnapshot(null), false);
  assert.equal(isSnapshot({ width: 1 }), false);
});
