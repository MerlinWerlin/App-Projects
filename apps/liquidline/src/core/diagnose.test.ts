import { test } from 'node:test';
import assert from 'node:assert/strict';
import { band, PATTERNS, systemCheck } from './diagnose.ts';
import { satPressure } from './pt.ts';

const p = { pressure: 'kPa' as const, temp: 'C' as const, gauge: true, atmKpa: 101.325 };
const g = (id: string, t: number, ph: 'bubble' | 'dew') => satPressure(id, t, ph)! - 101.325;
const base = (sh: number, sc: number) => ({
  refrigerant: 'R32', suctionReading: g('R32', 7, 'dew'), suctionLineTemp: 7 + sh,
  liquidReading: g('R32', 45, 'bubble'), liquidLineTemp: 45 - sc, targetShK: 6, targetScK: 5,
});

test('band classification', () => {
  assert.equal(band(3, 6, 2), 'low');
  assert.equal(band(6, 6, 2), 'ok');
  assert.equal(band(8.5, 6, 2), 'high');
});

test('every cell of the nine-box pattern is reachable from readings', () => {
  const cases: [number, number, string][] = [
    [2, 1, 'overfeed'], [2, 5, 'low-airflow'], [2, 10, 'overcharge'],
    [6, 1, 'slight-under'], [6, 5, 'normal'], [6, 10, 'high-head'],
    [14, 1, 'undercharge'], [14, 5, 'starved'], [14, 10, 'restriction'],
  ];
  for (const [sh, sc, id] of cases) {
    const r = systemCheck(base(sh, sc), p);
    assert.ok(r.ok, `${sh}/${sc}`);
    if (r.ok) {
      assert.equal(r.pattern.id, id, `SH ${sh} SC ${sc}`);
      assert.ok(Math.abs(r.shK - sh) < 0.05 && Math.abs(r.scK - sc) < 0.05);
      assert.ok(Math.abs(r.evapC - 7) < 0.05 && Math.abs(r.condC - 45) < 0.05);
    }
  }
  const ids = new Set(Object.values(PATTERNS).flatMap((row) => Object.values(row).map((x) => x.id)));
  assert.equal(ids.size, 9);
});

test('zeotrope uses dew on the low side and bubble on the high side', () => {
  const r = systemCheck({ refrigerant: 'R407C', suctionReading: g('R407C', 5, 'dew'), suctionLineTemp: 11, liquidReading: g('R407C', 45, 'bubble'), liquidLineTemp: 40, targetShK: 6, targetScK: 5 }, p);
  assert.ok(r.ok && Math.abs(r.evapC - 5) < 0.05 && Math.abs(r.condC - 45) < 0.05 && r.pattern.id === 'normal');
});

test('swapped hoses and bad input explain themselves', () => {
  const swapped = systemCheck({ ...base(6, 5), suctionReading: g('R32', 45, 'bubble'), liquidReading: g('R32', 7, 'dew') }, p);
  assert.ok(!swapped.ok);
  const bad = systemCheck({ ...base(6, 5), liquidReading: Number.NaN }, p);
  assert.ok(!bad.ok && /High side/.test(bad.error));
  const noTarget = systemCheck({ ...base(6, 5), targetShK: Number.NaN }, p);
  assert.ok(!noTarget.ok);
});
