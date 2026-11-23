/** Worked examples for grout, adhesive and membrane, checked against makers' published numbers (docs/SOURCES.md). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcAdhesive, calcGrout, calcMembrane, perGalToPerLitre, wetAreaSurfaces } from './materials.ts';
import { IMPERIAL_NOTCHES, notchCoverage, NOTCHES, recommendNotch } from './notch.ts';
import { KG_PER_LB, M2_PER_SQFT } from './units.ts';

const close = (a: number, b: number, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const grout = (A: number, B: number, C: number, D: number, rho: number, area = 1, extra = 0, bag = 5) =>
  calcGrout({ areaM2: area, tileLengthMm: A, tileWidthMm: B, tileThicknessMm: C, jointMm: D, density: rho, bagKg: bag, extraPct: extra, system: 'metric' });

test('grout formula matches makers\' examples', () => {
  const g1 = grout(300, 300, 10, 3, 1.6); assert.ok(g1.ok); close(g1.value.kgPerM2, 0.32); // 600/90000 × 10 × 3 × 1.6
  const g2 = grout(600, 600, 10, 3, 1.6); assert.ok(g2.ok); close(g2.value.kgPerM2, 0.16);
  const g3 = grout(100, 100, 7, 2, 1.6); assert.ok(g3.ok); close(g3.value.kgPerM2, 0.448); // MAPEI table lists 0.4
  const g4 = grout(150, 150, 5, 3, 1.5); assert.ok(g4.ok); close(g4.value.kgPerM2, 0.3); // ARDEX-FLEX FS: 300×5×3×1.5÷150÷150 = 0.3
  const g5 = grout(150, 150, 5, 5, 1.75); assert.ok(g5.ok); close(g5.value.kgPerM2, 0.5833); // ARDEX-FLEX FL: 0.58
  const g6 = grout(300, 300, 10, 3, 1.9); assert.ok(g6.ok); close(g6.value.kgPerM2, 0.38); // Kerakoll Fugabella table 380 g/m²
});

test('grout: 20 m² of 300 × 300 with 10% extra -> 7.04 kg, two 5 kg bags', () => {
  const r = grout(300, 300, 10, 3, 1.6, 20, 10, 5);
  assert.ok(r.ok);
  close(r.value.kgWithExtra, 7.04);
  assert.equal(r.value.bags, 2);
  close(r.value.jointLengthM, 133.33, 0.01); // (600/90000) × 1000 × 20
});

test('grout: imperial 12 × 12 × 3/8 in, 1/8 in joint matches Custom\'s chart (348 sq ft per 25 lb)', () => {
  const r = calcGrout({ areaM2: 1, tileLengthMm: 304.8, tileWidthMm: 304.8, tileThicknessMm: 9.525, jointMm: 3.175, density: 1.6, bagKg: 25 * KG_PER_LB, extraPct: 10, system: 'imperial' });
  assert.ok(r.ok);
  const lbPerSqFt = (r.value.kgWithExtra / KG_PER_LB) * M2_PER_SQFT;
  const sqFtPer25lb = 25 / lbPerSqFt;
  assert.ok(Math.abs(sqFtPer25lb - 348) / 348 < 0.02, `${sqFtPer25lb}`); // within 2% of the chart
});

test('grout rejects bad input', () => {
  assert.equal(grout(300, 300, 0, 3, 1.6).ok, false);
  assert.equal(grout(300, 300, 10, 0, 1.6).ok, false);
  assert.equal(grout(300, 300, 10, 3, 5).ok, false);
  assert.equal(grout(0, 300, 10, 3, 1.6).ok, false);
  assert.equal(calcGrout({ areaM2: 0, tileLengthMm: 300, tileWidthMm: 300, tileThicknessMm: 10, jointMm: 3, density: 1.6, bagKg: 5, extraPct: 10, system: 'metric' }).ok, false);
});

test('adhesive: worked examples', () => {
  const six = NOTCHES.find(n => n.mm === 6)!, twelve = NOTCHES.find(n => n.mm === 12)!, ten = NOTCHES.find(n => n.mm === 10)!;
  close(notchCoverage(six), 2.7);
  const a1 = calcAdhesive({ areaM2: 10, kgPerM2: notchCoverage(six), notchLabel: '6 mm', backButterKgPerM2: 0, bagKg: 20, extraPct: 10, system: 'metric' });
  assert.ok(a1.ok); close(a1.value.kgWithExtra, 29.7); assert.equal(a1.value.bags, 2);
  const a2 = calcAdhesive({ areaM2: 10, kgPerM2: notchCoverage(twelve), notchLabel: '12 mm', backButterKgPerM2: 1.2, bagKg: 20, extraPct: 10, system: 'metric' });
  assert.ok(a2.ok); close(a2.value.kgWithExtra, 72.6); assert.equal(a2.value.bags, 4);
  const a3 = calcAdhesive({ areaM2: 10, kgPerM2: notchCoverage(ten, true), notchLabel: '10 mm', backButterKgPerM2: 0, bagKg: 15, extraPct: 0, system: 'metric' });
  assert.ok(a3.ok); close(a3.value.kg, 30); assert.equal(a3.value.bags, 2);
  // LATICRETE 254 check: a 50 lb (22.68 kg) bag with a 1/4 in notch at 0.45 kg/m²/mm covers 22.68 / 2.8575 = 7.94 m²
  // = 85 sq ft, inside the data sheet's 80–95 sq ft.
  const quarter = IMPERIAL_NOTCHES.find(n => n.label.startsWith('1/4 × 1/4'))!;
  const sqft = (50 * KG_PER_LB) / notchCoverage(quarter) / M2_PER_SQFT;
  assert.ok(sqft >= 80 && sqft <= 95, `${sqft}`);
  assert.equal(calcAdhesive({ areaM2: 10, kgPerM2: 0, notchLabel: 'x', backButterKgPerM2: 0, bagKg: 20, extraPct: 10, system: 'metric' }).ok, false);
});

test('notch suggestion by tile size', () => {
  assert.equal(recommendNotch(50).mm, 4);
  assert.equal(recommendNotch(100).mm, 4);
  assert.equal(recommendNotch(150).mm, 6);
  assert.equal(recommendNotch(300).mm, 10);
  assert.equal(recommendNotch(450).mm, 12);
  assert.deepEqual([recommendNotch(600).mm, recommendNotch(600).backButter], [12, true]);
  close(notchCoverage(NOTCHES.find(n => n.round)!), 6.5);
});

test('wet area: 2.4 × 1.8 m bathroom, 0.9 × 1.2 corner shower, 0.8 m door (AU heights)', () => {
  // Floor 4.32 + shower walls 2.1 × 1.8 = 3.78 + upturn (8.4 − 2.1 − 0.8) × 0.15 = 0.825 -> 8.925 m².
  // Tape: 7.6 m junction + 1 shower corner × 1.8 + 3 other corners × 0.15 = 9.85 m.
  const w = wetAreaSurfaces({ roomLengthMm: 2400, roomWidthMm: 1800, showerLengthMm: 1200, showerWidthMm: 900, showerWalls: 2, doorWidthMm: 800, showerWallHeightMm: 1800, upturnMm: 150, wholeFloor: true });
  assert.equal(w.problems.length, 0);
  close(w.surfaces.reduce((s, x) => s + x.areaM2, 0), 8.925);
  close(w.tapeMm, 9850, 0.01);
  // 1.5 L/m² system (Davco K10 Plus: 20 L covers 13.3 m² in 2 coats) = 0.75 L/m² per coat × 2 -> 13.39 L, one 20 L pail.
  const m = calcMembrane({ surfaces: w.surfaces, litresPerM2PerCoat: 0.75, coats: 2, packLitres: 20, primerM2PerLitre: null, primerPackLitres: null, tapeRunMm: w.tapeMm, tapeRollMm: 10000, system: 'metric' });
  assert.ok(m.ok);
  close(m.value.litres, 13.3875);
  assert.equal(m.value.packs, 1);
  assert.equal(m.value.tapeRolls, 1);
  assert.ok(wetAreaSurfaces({ roomLengthMm: 1000, roomWidthMm: 1000, showerLengthMm: 1200, showerWidthMm: 900, showerWalls: 2, doorWidthMm: 800, showerWallHeightMm: 1800, upturnMm: 150, wholeFloor: true }).problems.length > 0);
});

test('membrane: US gallon coverage converts to L/m²', () => {
  // RedGard: 55 sq ft per gallon for the finished 2-coat system -> 1 / ((55 × 0.0929) / 3.785) = 0.7408 L/m².
  close(perGalToPerLitre(55), 0.7408, 1e-3);
  // 100 sq ft shower at 55 sq ft/gal (one "coat" = the system) = 1.82 gal -> two 1-gal pails.
  const r = calcMembrane({ surfaces: [{ label: 'Shower', areaM2: 100 * M2_PER_SQFT }], litresPerM2PerCoat: perGalToPerLitre(55), coats: 1, packLitres: 3.785411784, primerM2PerLitre: null, primerPackLitres: null, tapeRunMm: 0, tapeRollMm: null, system: 'imperial' });
  assert.ok(r.ok);
  close(r.value.litres / 3.785411784, 100 / 55, 1e-6);
  assert.equal(r.value.packs, 2);
  assert.equal(calcMembrane({ surfaces: [], litresPerM2PerCoat: 1, coats: 2, packLitres: 4, primerM2PerLitre: null, primerPackLitres: null, tapeRunMm: 0, tapeRollMm: null, system: 'metric' }).ok, false);
  assert.equal(calcMembrane({ surfaces: [{ label: 'x', areaM2: 2 }], litresPerM2PerCoat: 1, coats: 1.5, packLitres: 4, primerM2PerLitre: null, primerPackLitres: null, tapeRunMm: 0, tapeRollMm: null, system: 'metric' }).ok, false);
});
