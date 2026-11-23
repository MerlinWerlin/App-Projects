import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartRows, glideAt, hasGlide, limits, satPressure, satTemp } from './pt.ts';
import { PT_FIXTURE } from './ptFixture.ts';
import { PT_TABLES } from '../data/ptTables.ts';
import { REFRIGERANTS } from './refrigerants.ts';

// Independent reference: NIST Chemistry WebBook, "Thermophysical Properties of Fluid Systems", saturation
// pressure (kPa abs) by temperature, default reference state, fetched 23 Nov 2026 (webbook.nist.gov/chemistry/fluid/).
const NIST: Record<string, [number, number][]> = {
  R32: [[-40, 177.411], [-20, 405.752], [0, 813.1], [20, 1474.56], [40, 2478.31]],
  R134a: [[-40, 51.2089], [-20, 132.735], [0, 292.803], [20, 571.706], [40, 1016.59]],
  R290: [[-40, 111.121], [-20, 244.518], [0, 474.457], [20, 836.46], [40, 1369.42]],
  R22: [[-40, 105.231], [-20, 245.311], [0, 497.985], [20, 910.013], [40, 1533.57]],
  R744: [[-40, 1004.5], [-20, 1969.63], [0, 3485.14], [20, 5729.05]],
  R717: [[-40, 71.6333], [-20, 190.026], [0, 429.248], [20, 857.04], [40, 1554.53]],
  R600a: [[-40, 28.7024], [-20, 72.4772], [0, 156.956], [20, 302.22], [40, 531.207]],
};

const rel = (a: number, b: number) => Math.abs(a - b) / b;

// Independent reference for blends: refrigerant makers' published tables (bubble, dew; kPa abs). Full citations in
// docs/SOURCES.md. Daikin Chemicals wet-vapour tables (REFPROP 10, MPa to 3 figures) for R410A, R404A and R448A;
// Arkema Forane 407C SI table; Chemours Opteon XL41 (R454B, psia converted), XP40 (R449A) and XP10 (R513A) SI tables.
const PUBLISHED: [string, number, number, number][] = [
  ['R410A', 0, 801, 798], ['R410A', 40, 2426, 2419],
  ['R404A', 0, 610, 600], ['R404A', 40, 1829, 1815],
  ['R407C', 0, 567.9, 460.7], ['R407C', 40, 1749.0, 1541.3],
  ['R454B', 0, 759.9, 729.4], ['R454B', 40, 2295.7, 2225.2],
  ['R448A', 0, 622, 516], ['R448A', 40, 1880, 1672],
  ['R449A', 0, 615.942, 512.986], ['R449A', 40, 1861.299, 1659.303],
  ['R513A', 0, 321.926, 321.68], ['R513A', 40, 1068.622, 1068.536],
];
// Arkema Forane PT wall chart (REFPROP 10, 2025), psig, single column = bubble for R410A; dual for blends.
const PUBLISHED_PSIG: [string, number, number, number | null][] = [
  ['R410A', 32, 101.4, 101.1], ['R410A', 100, 318.6, 317.6],
  ['R454B', 100, 300.8, 290.9], ['R407C', 100, 225.5, 196.1],
  ['R448A', 100, 243.7, 214.3], ['R449A', 32, 74.0, 59.9], ['R449A', 100, 240.1, 213.1],
  ['R404A', 100, 236.8, null],
];

test('blends match the makers’ published bubble and dew points within 0.3 %', () => {
  for (const [id, t, b, d] of PUBLISHED) {
    assert.ok(rel(satPressure(id, t, 'bubble')!, b) < 0.003, `${id} bubble ${t} °C: ${satPressure(id, t, 'bubble')} vs ${b}`);
    assert.ok(rel(satPressure(id, t, 'dew')!, d) < 0.003, `${id} dew ${t} °C: ${satPressure(id, t, 'dew')} vs ${d}`);
  }
});

test('gauge psig at 32 °F and 100 °F match the published PT chart within 0.5 % (charts of different vintages differ by ~0.3 %)', () => {
  const PSI = 6.894757293168361;
  for (const [id, f, b, d] of PUBLISHED_PSIG) {
    const c = ((f - 32) * 5) / 9;
    const g = (kpa: number) => (kpa - 101.325) / PSI;
    const tol = (psig: number) => Math.max(0.75, 0.005 * (psig + 14.696)); // the R449A chart sits 0.64 psi below the same maker’s SI table at 32 °F;
    assert.ok(Math.abs(g(satPressure(id, c, 'bubble')!) - b) < tol(b), `${id} bubble ${f} °F: ${g(satPressure(id, c, 'bubble')!)} vs ${b}`);
    if (d != null) assert.ok(Math.abs(g(satPressure(id, c, 'dew')!) - d) < tol(d), `${id} dew ${f} °F: ${g(satPressure(id, c, 'dew')!)} vs ${d}`);
  }
});

test('every refrigerant in the list has a table, and every table a refrigerant', () => {
  for (const r of REFRIGERANTS) assert.ok(PT_TABLES[r.id], r.id);
  for (const id of Object.keys(PT_TABLES)) assert.ok(REFRIGERANTS.some((r) => r.id === id), id);
});

test('pure fluids match NIST WebBook saturation pressures within 0.1 %', () => {
  for (const [id, pts] of Object.entries(NIST)) {
    for (const [t, p] of pts) {
      const got = satPressure(id, t)!;
      assert.ok(rel(got, p) < 0.001, `${id} at ${t} °C: ${got} vs NIST ${p}`);
      const back = satTemp(id, p)!;
      assert.ok(Math.abs(back - t) < 0.05, `${id} ${p} kPa -> ${back} °C, want ${t}`);
    }
  }
});

test('interpolation between table rows matches direct CoolProp values within 0.05 %', () => {
  for (const [id, pts] of Object.entries(PT_FIXTURE)) {
    assert.ok(pts.length >= 3, id);
    for (const [t, b, d] of pts) {
      assert.ok(rel(satPressure(id, t, 'bubble')!, b) < 0.0005, `${id} bubble ${t}`);
      assert.ok(rel(satPressure(id, t, 'dew')!, d) < 0.0005, `${id} dew ${t}`);
      assert.ok(Math.abs(satTemp(id, d, 'dew')! - t) < 0.02, `${id} dew T ${t}`);
      assert.ok(Math.abs(satTemp(id, b, 'bubble')! - t) < 0.02, `${id} bubble T ${t}`);
    }
  }
});

test('tables rise monotonically and dew never exceeds bubble pressure', () => {
  for (const [id, t] of Object.entries(PT_TABLES)) {
    for (let i = 1; i < t.bubble.length; i++) assert.ok(t.bubble[i] > t.bubble[i - 1], `${id} bubble row ${i}`);
    if (t.dew) {
      assert.equal(t.dew.length, t.bubble.length, id);
      for (let i = 0; i < t.dew.length; i++) {
        if (i) assert.ok(t.dew[i] > t.dew[i - 1], `${id} dew row ${i}`);
        assert.ok(t.dew[i] <= t.bubble[i] + 1e-9, `${id} dew above bubble at row ${i}`);
      }
    }
  }
});

test('glide sizes fall in the published ranges for each blend type', () => {
  const at = (id: string, tC: number) => glideAt(id, satPressure(id, tC, 'dew')!)!;
  // Pure and azeotropes: none or tiny.
  for (const id of ['R32', 'R290', 'R134a', 'R22', 'R744']) assert.equal(at(id, 0), 0, id);
  assert.ok(at('R507A', 0) < 0.15, 'R507A azeotrope');
  assert.ok(at('R513A', 0) < 0.3, 'R513A azeotrope');
  // Near-azeotropes: under 1 K.
  assert.ok(at('R410A', 0) > 0.03 && at('R410A', 0) < 0.25, `R410A ${at('R410A', 0)}`);
  assert.ok(at('R404A', 0) > 0.3 && at('R404A', 0) < 1, `R404A ${at('R404A', 0)}`);
  // Zeotropes: R454B about 1–1.7 K, R407C about 5–7.5 K, R448A/R449A about 4–6.5 K.
  assert.ok(at('R454B', 0) > 0.9 && at('R454B', 0) < 1.8, `R454B ${at('R454B', 0)}`);
  assert.ok(at('R407C', 0) > 5 && at('R407C', 0) < 7.5, `R407C ${at('R407C', 0)}`);
  for (const id of ['R448A', 'R449A']) assert.ok(at(id, 0) > 4 && at(id, 0) < 6.5, `${id} ${at(id, 0)}`);
});

test('out-of-range and bad input return null, never a wrong number', () => {
  assert.equal(satPressure('R32', 200), null);
  assert.equal(satPressure('R32', -80), null);
  assert.equal(satPressure('R744', 31), null, 'CO2 above its critical point has no saturation pressure');
  assert.equal(satPressure('nope', 0), null);
  assert.equal(satPressure('R32', Number.NaN), null);
  assert.equal(satTemp('R32', 0), null);
  assert.equal(satTemp('R32', -5), null);
  assert.equal(satTemp('R32', 1e6), null);
  assert.equal(satTemp('R32', Number.NaN), null);
  // The exact table ends are inside.
  const l = limits('R32')!;
  assert.ok(satTemp('R32', l.pMin) != null && satTemp('R32', l.pMax) != null);
  assert.ok(Math.abs(satTemp('R32', l.pMin)! - l.tMin) < 1e-9);
});

test('hasGlide only for blends with a separate dew curve', () => {
  assert.equal(hasGlide('R32'), false);
  assert.equal(hasGlide('R407C'), true);
  assert.equal(hasGlide('R410A'), true);
});

test('chart rows run every 5 °C and include 0 °C', () => {
  const rows = chartRows('R32', 5);
  assert.ok(rows.some((r) => r.tC === 0));
  for (let i = 1; i < rows.length; i++) assert.equal(rows[i].tC - rows[i - 1].tC, 5);
});
