import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SKETCH_STEPS,
  STEP_COUNT,
  clampStep,
  getStep,
  isFirstStep,
  isLastStep,
  nextStep,
  pathBounds,
  pathExtent,
  prevStep,
  revealCount,
  revealPaths,
  stepCacheKey,
  stepLabel,
  stepOutlineOptions,
} from './sketchSteps.ts';
import { TEMPLATES } from './templates.ts';

test('four steps from coarse to fine', () => {
  assert.equal(STEP_COUNT, 4);
  for (let i = 1; i < STEP_COUNT; i++) {
    assert.ok(SKETCH_STEPS[i].detail > SKETCH_STEPS[i - 1].detail, 'detail rises');
    assert.ok(SKETCH_STEPS[i].thickness <= SKETCH_STEPS[i - 1].thickness, 'lines get finer');
  }
  for (const s of SKETCH_STEPS) {
    assert.ok(s.detail >= 0 && s.detail <= 1);
    assert.ok(s.thickness >= 0.5 && s.thickness <= 8);
    assert.ok(s.smooth >= 0 && s.smooth <= 1);
  }
  assert.ok(SKETCH_STEPS[0].smooth > SKETCH_STEPS[STEP_COUNT - 1].smooth);
  assert.equal(new Set(SKETCH_STEPS.map((s) => s.id)).size, STEP_COUNT, 'step ids are unique (catalogue keys)');
});

test('clamp / next / prev stay in range', () => {
  assert.equal(clampStep(-1), 0);
  assert.equal(clampStep(9), 3);
  assert.equal(clampStep(1.7), 1);
  assert.equal(clampStep(Number.NaN), 0);
  assert.equal(clampStep(Infinity), 3);
  assert.equal(nextStep(0), 1);
  assert.equal(nextStep(3), 3);
  assert.equal(prevStep(0), 0);
  assert.equal(prevStep(2), 1);
  assert.equal(nextStep(1, 2), 1);
  assert.equal(clampStep(5, 0), 0);
  assert.ok(isFirstStep(0) && !isFirstStep(1));
  assert.ok(isLastStep(3) && !isLastStep(2));
  assert.equal(getStep(99), SKETCH_STEPS[3]);
});

test('stepLabel reads "Step k of n — name"', () => {
  assert.equal(stepLabel(0), 'Step 1 of 4 — big shapes');
  assert.equal(stepLabel(1), 'Step 2 of 4 — main shapes');
  assert.equal(stepLabel(7), 'Step 4 of 4 — fine lines');
});

test('stepOutlineOptions carries the step params and the prepared rotation / invert', () => {
  const o = stepOutlineOptions(2, { invert: true, rotateTurns: 5 });
  assert.deepEqual(o, { detail: 0.6, thickness: 1.5, smooth: 0, invert: true, rotateTurns: 1, kind: 'auto', background: 'soft', style: 'classic' });
  assert.equal(stepOutlineOptions(0).rotateTurns, 0);
  assert.equal(stepOutlineOptions(0, { rotateTurns: -1 }).rotateTurns, 3);
  assert.equal(stepOutlineOptions(0, { rotateTurns: Number.NaN }).rotateTurns, 0);
  assert.equal(stepOutlineOptions(0).invert, false);
});

test('stepCacheKey differs by step, rotation and invert', () => {
  const a = stepCacheKey('file:///a.jpg', 0);
  assert.equal(a, stepCacheKey('file:///a.jpg', 0, { rotateTurns: 4 }));
  assert.notEqual(a, stepCacheKey('file:///a.jpg', 1));
  assert.notEqual(a, stepCacheKey('file:///a.jpg', 0, { rotateTurns: 1 }));
  assert.notEqual(a, stepCacheKey('file:///a.jpg', 0, { invert: true }));
  assert.notEqual(a, stepCacheKey('file:///b.jpg', 0));
  assert.notEqual(a, stepCacheKey('file:///a.jpg', 0, { kind: 'portrait' }));
  assert.notEqual(a, stepCacheKey('file:///a.jpg', 0, { background: 'subject' }));
});

test('T54: steps use the Prepare outline style and cache per style', () => {
  for (const style of ['classic', 'sketch', 'lineart', 'bold'] as const) {
    for (let i = 0; i < STEP_COUNT; i++) assert.equal(stepOutlineOptions(i, { style }).style, style);
  }
  assert.equal(stepOutlineOptions(1).style, 'classic');
  // Bold stays bold at the fine steps; other styles keep the step thickness.
  for (let i = 0; i < STEP_COUNT; i++) {
    assert.ok(stepOutlineOptions(i, { style: 'bold' }).thickness >= 3);
    assert.equal(stepOutlineOptions(i, { style: 'sketch' }).thickness, SKETCH_STEPS[i].thickness);
  }
  const a = stepCacheKey('file:///a.jpg', 2);
  assert.equal(a, stepCacheKey('file:///a.jpg', 2, { style: 'classic' }));
  assert.notEqual(a, stepCacheKey('file:///a.jpg', 2, { style: 'sketch' }));
  assert.notEqual(stepCacheKey('file:///a.jpg', 2, { style: 'lineart' }), stepCacheKey('file:///a.jpg', 2, { style: 'bold' }));
});

test('pathBounds handles M L H V C Q A Z', () => {
  assert.deepEqual(pathBounds('M 10 20 L 30 40 Z'), { minX: 10, minY: 20, maxX: 30, maxY: 40 });
  assert.deepEqual(pathBounds('M 0 0 H 50 V 25'), { minX: 0, minY: 0, maxX: 50, maxY: 25 });
  // Arc: radii, rotation and flags must not count as points; only the end point does.
  assert.deepEqual(pathBounds('M 100 100 A 300 300 0 1 0 120 100'), { minX: 100, minY: 100, maxX: 120, maxY: 100 });
  assert.deepEqual(pathBounds('M 0 0 C 1 2 3 4 5 6 Q -1 -2 7 8'), { minX: -1, minY: -2, maxX: 7, maxY: 8 });
  assert.equal(pathBounds(''), null);
  assert.equal(pathBounds('Z'), null);
  assert.equal(pathExtent('M 0 0 L 3 4'), 5);
  assert.equal(pathExtent(''), 0);
});

test('revealCount grows to all items and is at least 1', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => revealCount(10, i)), [3, 5, 8, 10]);
  assert.deepEqual([0, 1, 2, 3].map((i) => revealCount(1, i)), [1, 1, 1, 1]);
  assert.equal(revealCount(0, 2), 0);
  assert.equal(revealCount(5, 99), 5);
  assert.equal(revealCount(Number.NaN, 1), 0);
});

test('revealPaths shows the biggest paths first, in original order', () => {
  const small = 'M 0 0 L 1 1';
  const big = 'M 0 0 L 300 300';
  const mid = 'M 0 0 L 50 50';
  const tiny = 'M 0 0 L 0.5 0';
  const paths = [small, big, tiny, mid];
  assert.deepEqual(revealPaths(paths, 0), [big]);
  assert.deepEqual(revealPaths(paths, 1), [big, mid]);
  assert.deepEqual(revealPaths(paths, 2), [small, big, mid]);
  assert.deepEqual(revealPaths(paths, 3), paths);
  assert.notEqual(revealPaths(paths, 3), paths, 'returns a copy');
  assert.deepEqual(revealPaths([], 0), []);
});

test('every bundled template reveals progressively and ends complete', () => {
  for (const t of TEMPLATES) {
    let prev = 0;
    for (let i = 0; i < STEP_COUNT; i++) {
      const shown = revealPaths(t.paths, i);
      assert.ok(shown.length >= prev, `${t.id} step ${i} grows`);
      assert.ok(shown.length >= 1, `${t.id} step ${i} shows something`);
      for (const d of shown) assert.ok(t.paths.includes(d));
      prev = shown.length;
    }
    assert.deepEqual(revealPaths(t.paths, STEP_COUNT - 1), t.paths);
    for (const d of t.paths) assert.ok(pathExtent(d) > 0, `${t.id} path has extent`);
  }
});

test('sketch steps and compare stay free: no Plus imports', () => {
  for (const f of ['./sketchSteps.ts', './compare.ts']) {
    const text = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/from\s*['"][^'"]*\/plus/.test(text), `${f} imports plus`);
  }
});
