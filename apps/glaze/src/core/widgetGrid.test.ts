import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WIDGET_GRID_COLUMNS, gridRows, rowExtras, slotFor } from './widgetGrid.ts';

test('rows of two, last row may be short; bad column counts fall back to one', () => {
  assert.equal(WIDGET_GRID_COLUMNS, 2);
  assert.deepEqual(gridRows([1, 2, 3, 4, 5]), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(gridRows([]), []);
  assert.deepEqual(gridRows(['a', 'b', 'c'], 3), [['a', 'b', 'c']]);
  assert.deepEqual(gridRows([1, 2], 0), [[1], [2]]);
  assert.deepEqual(gridRows([1, 2], Number.NaN), [[1], [2]]);
});

test('a card next to one with a goal chip reserves the chip row (and the log row)', () => {
  // Water (log + goal) next to mood (log only).
  const row = rowExtras([
    { log: true, goal: true },
    { log: true, goal: false },
  ]);
  assert.deepEqual(row, { log: true, goal: true });
  assert.equal(slotFor(true, row.goal), 'button');
  assert.equal(slotFor(false, row.goal), 'spacer');
  // A clock next to a habit card reserves both rows.
  const mixed = rowExtras([{ log: false, goal: false }, { log: true, goal: true }]);
  assert.equal(slotFor(false, mixed.log), 'spacer');
  assert.equal(slotFor(false, mixed.goal), 'spacer');
  // Two plain cards: no extra rows at all.
  const plain = rowExtras([{ log: false, goal: false }, { log: false, goal: false }]);
  assert.equal(slotFor(false, plain.log), null);
  assert.equal(slotFor(false, plain.goal), null);
});

test('static guard: the Widgets tab draws its grid in rows that stretch, not a wrapping grid', () => {
  const src = readFileSync(new URL('../../app/(tabs)/widgets.tsx', import.meta.url), 'utf8');
  // T162: the rows are the items of a virtualised list (one memoised WidgetRow each).
  // T173: split per widget family first (familyRows uses gridRows inside each family).
  assert.match(src, /const rows = useMemo\(\(\) => familyRows\(cards, WIDGET_GRID_COLUMNS\), \[cards\]\)/);
  assert.match(src, /data=\{rows\}\s+renderItem=\{renderRow\}/);
  assert.match(src, /row: \{ flexDirection: 'row', alignItems: 'stretch'/);
  assert.match(src, /rowExtras\(/);
  assert.ok(!/flexWrap: 'wrap'/.test(src), 'no wrapping grid: rows keep neighbours level');
  // Empty slots, the log button and the goal chip share one minimum height (≥ 48 pt).
  assert.match(src, /slot: \{ minHeight: sizeV2\.touch \}/);
  assert.match(src, /style=\{styles\.slot\}/);
});
