import { FITTINGS, MIN_GRADES, PIPES, pipeById, pipeId } from './reference';
import { takeoff, validFitting } from './cut';

test('AS 1432 sizes: DN15 is 12.70 OD and DN18 is 15.88 OD (Type B bores 10.88 and 13.84)', () => {
  expect(pipeById('cuB-15')!.od_mm).toBe(12.7);
  expect(pipeId(pipeById('cuB-15')!)).toBeCloseTo(10.88, 9);
  expect(pipeId(pipeById('cuB-18')!)).toBeCloseTo(13.84, 9);
  expect(pipeId(pipeById('cuA-100')!)).toBeCloseTo(97.54, 9);
});

test('every pipe has a sensible bore and a unique id', () => {
  const ids = new Set<string>();
  for (const p of PIPES) {
    expect(ids.has(p.id)).toBe(false); ids.add(p.id);
    expect(pipeId(p)).toBeGreaterThan(0);
    expect(pipeId(p)).toBeLessThan(p.od_mm);
    expect(Math.abs(pipeId(p) - p.id_mm)).toBeLessThan(0.01);
  }
});

test('every fitting is valid, with a positive take-off and a unique id', () => {
  const ids = new Set<string>();
  for (const f of FITTINGS) {
    expect(ids.has(f.id)).toBe(false); ids.add(f.id);
    expect(validFitting(f)).toBeNull();
    expect(takeoff(f)).toBeGreaterThan(0);
    expect(f.source.length).toBeGreaterThan(10);
  }
});

test('PVC DN100 88° bend take-off is 80 mm (131 − 51) and 45° junction branch is 137 mm', () => {
  expect(takeoff(FITTINGS.find(f => f.id === 'pvc-100-88bend')!)).toBe(80);
  expect(takeoff(FITTINGS.find(f => f.id === 'pvc-100-45junctionbranch')!)).toBe(137);
});

test('minimum grades: ratio matches the percentage within rounding', () => {
  for (const g of MIN_GRADES) expect(Math.abs(Number(g.ratio.split(':')[1]) - 100 / g.pct) / (100 / g.pct)).toBeLessThan(0.02);
});
