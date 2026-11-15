// 1.0.0: gradient stops carry alpha in stopOpacity, never inside an rgba() stopColor (it drew as a solid block).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { stopOf } from './svgstop.ts';

test('stopOf splits rgba into colour and opacity', () => {
  assert.deepEqual(stopOf('rgba(12, 20, 40, 0.5)'), { stopColor: 'rgb(12,20,40)', stopOpacity: 0.5 });
  assert.deepEqual(stopOf('rgba(4, 8, 20, 0)'), { stopColor: 'rgb(4,8,20)', stopOpacity: 0 });
  assert.deepEqual(stopOf('rgb(1,2,3)'), { stopColor: 'rgb(1,2,3)', stopOpacity: 1 });
  assert.deepEqual(stopOf('#14213D'), { stopColor: '#14213D', stopOpacity: 1 });
});

test('no gradient stop in the UI passes an rgba() token straight to stopColor', () => {
  for (const f of ['src/ui/TripCover.tsx']) {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /stopColor=\{(s|scrim)\.(from|mid|to)\}/, f);
    assert.match(src, /stopOf\(s\.mid\)/, f);
  }
});
