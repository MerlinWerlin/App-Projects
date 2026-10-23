import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseInterpolation, collapseProgress, isCollapsed, LARGE_TITLE, titleFontSize, titleScale } from './largeTitle.ts';

test('collapseProgress clamps to 0..1 over 52 pt', () => {
  assert.equal(LARGE_TITLE.distance, 52);
  assert.equal(collapseProgress(0), 0);
  assert.equal(collapseProgress(-40), 0);
  assert.equal(collapseProgress(26), 0.5);
  assert.equal(collapseProgress(52), 1);
  assert.equal(collapseProgress(500), 1);
  assert.equal(collapseProgress(Number.NaN), 0);
  assert.equal(collapseProgress(10, 0), 0);
});

test('title font interpolates 34 → 17', () => {
  assert.equal(titleFontSize(0), 34);
  assert.equal(titleFontSize(1), 17);
  assert.equal(titleFontSize(0.5), 25.5);
  assert.equal(titleFontSize(2), 17);
  assert.equal(titleFontSize(-1), 34);
  assert.equal(titleScale(0), 1);
  assert.equal(titleScale(1), 0.5);
});

test('isCollapsed only at the full distance', () => {
  assert.equal(isCollapsed(51), false);
  assert.equal(isCollapsed(52), true);
});

const monotonic = (a: number[]) => a.every((v, i) => i === 0 || v >= a[i - 1]);

test('interpolation configs are valid (monotonic input, matching lengths)', () => {
  for (const reduce of [false, true]) {
    const c = collapseInterpolation(reduce);
    for (const k of ['largeScale', 'largeOpacity', 'barOpacity'] as const) {
      assert.ok(monotonic(c[k].inputRange), `${k} input monotonic`);
      assert.equal(c[k].inputRange.length, c[k].outputRange.length);
      assert.equal(c[k].inputRange.at(-1), 52);
    }
  }
});

test('normal motion scales to 0.5 and fades the bar in', () => {
  const c = collapseInterpolation(false);
  assert.deepEqual(c.largeScale.outputRange, [1, 0.5]);
  assert.equal(c.barOpacity.outputRange[0], 0);
  assert.equal(c.barOpacity.outputRange.at(-1), 1);
});

test('reduce motion: no scaling, a 1 pt swap at the end', () => {
  const c = collapseInterpolation(true);
  assert.deepEqual(c.largeScale.outputRange, [1, 1]);
  assert.deepEqual(c.barOpacity.inputRange, [51, 52]);
  assert.deepEqual(c.largeOpacity.outputRange, [1, 0]);
});
