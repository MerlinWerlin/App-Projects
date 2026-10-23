// Grid geometry: interior line counts and positions, presets, custom size validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRID_PRESETS, clampGridSize, gridLines, gridPreset, isValidGridSize, nextGridPreset } from './grid.ts';

const rect = { x: 10, y: 20, width: 300, height: 600 };

test('3×3 grid has 2 vertical + 2 horizontal interior lines at thirds', () => {
  const lines = gridLines(rect, 3, 3);
  assert.equal(lines.length, 4);
  assert.deepEqual(lines, [
    { x1: 110, y1: 20, x2: 110, y2: 620 },
    { x1: 210, y1: 20, x2: 210, y2: 620 },
    { x1: 10, y1: 220, x2: 310, y2: 220 },
    { x1: 10, y1: 420, x2: 310, y2: 420 },
  ]);
});

test('4×4 grid has 6 interior lines at quarters', () => {
  const lines = gridLines({ x: 0, y: 0, width: 400, height: 800 }, 4, 4);
  assert.equal(lines.length, 6);
  assert.deepEqual(lines.slice(0, 3).map((l) => l.x1), [100, 200, 300]);
  assert.deepEqual(lines.slice(3).map((l) => l.y1), [200, 400, 600]);
  for (const l of lines.slice(0, 3)) assert.equal(l.x1, l.x2);
  for (const l of lines.slice(3)) assert.equal(l.y1, l.y2);
});

test('custom non-square grid: cols-1 vertical, rows-1 horizontal, all inside the rect', () => {
  for (const [c, r] of [[2, 5], [12, 1], [7, 9], [1, 1]] as const) {
    const lines = gridLines(rect, c, r);
    assert.equal(lines.length, c - 1 + r - 1, `${c}×${r}`);
    const vertical = lines.filter((l) => l.x1 === l.x2);
    const horizontal = lines.filter((l) => l.y1 === l.y2);
    assert.equal(vertical.length, c - 1);
    assert.equal(horizontal.length, r - 1);
    for (const l of lines) {
      for (const px of [l.x1, l.x2]) assert.ok(px >= rect.x && px <= rect.x + rect.width);
      for (const py of [l.y1, l.y2]) assert.ok(py >= rect.y && py <= rect.y + rect.height);
    }
  }
});

test('custom sizes are validated to integers 1..12 and clamped in gridLines', () => {
  assert.ok(isValidGridSize(1));
  assert.ok(isValidGridSize(12));
  assert.ok(!isValidGridSize(0));
  assert.ok(!isValidGridSize(13));
  assert.ok(!isValidGridSize(2.5));
  assert.ok(!isValidGridSize(NaN));
  assert.equal(clampGridSize(0), 1);
  assert.equal(clampGridSize(40), 12);
  assert.equal(clampGridSize(3.4), 3);
  assert.equal(clampGridSize(NaN), 1);
  assert.equal(gridLines(rect, 99, 99).length, 22);
  assert.equal(gridLines(rect, -5, NaN).length, 0);
});

test('degenerate rects produce no lines', () => {
  assert.deepEqual(gridLines({ x: 0, y: 0, width: 0, height: 100 }, 3, 3), []);
  assert.deepEqual(gridLines({ x: 0, y: NaN, width: 100, height: 100 }, 3, 3), []);
});

test('presets: off, 3x3, 4x4; off draws nothing', () => {
  assert.deepEqual(GRID_PRESETS.map((p) => p.id), ['off', '3x3', '4x4']);
  assert.deepEqual(gridPreset('3x3'), { id: '3x3', cols: 3, rows: 3 });
  assert.deepEqual(gridPreset('4x4'), { id: '4x4', cols: 4, rows: 4 });
  const off = gridPreset('off');
  assert.equal(gridLines(rect, off.cols, off.rows).length, 0);
  assert.equal(gridPreset('nope').id, 'off');
});

test('nextGridPreset cycles off → 3x3 → 4x4 → off', () => {
  assert.equal(nextGridPreset('off').id, '3x3');
  assert.equal(nextGridPreset('3x3').id, '4x4');
  assert.equal(nextGridPreset('4x4').id, 'off');
  assert.equal(nextGridPreset('garbage').id, '3x3');
});
