/**
 * Worked examples for every calculator, with edge cases and invalid input.
 * Run: npm test (node --test, type stripping).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtInches, parseNum, fmt, round } from './num.ts';
import { kick, multiplier, offset, saddle3, saddle4, shrinkPerUnit, stub90 } from './bending.ts';
import { METALS, resistancePerM, vdropMv, vdropPhysics } from './vdrop.ts';
import { conduitFill, fillLimit } from './fill.ts';
import { ohm, powerTriangle } from './power.ts';
import { planCuts } from './cutlist.ts';
import { ampsToKva, awgAreaMm2, awgDiameterMm, convert, kvaToAmps, mm2ToAwg } from './convert.ts';

const near = (a: number | undefined, b: number, tol = 0.01) => {
  assert.ok(a !== undefined && Math.abs(a - b) <= tol, `expected ${b} ± ${tol}, got ${a}`);
};
function ok<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`);
  return r.value;
}
const bad = (r: { ok: boolean }) => assert.equal(r.ok, false);

// ---------- numbers ----------
test('parseNum accepts trade-style input and rejects junk', () => {
  assert.equal(parseNum('1.5'), 1.5);
  assert.equal(parseNum('1,5'), 1.5);
  assert.equal(parseNum('1,000'), 1000);
  assert.equal(parseNum(' 12 '), 12);
  assert.equal(parseNum('.5'), 0.5);
  assert.equal(parseNum('12.'), 12);
  assert.equal(parseNum('-3'), -3);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('abc'), null);
  assert.equal(parseNum('1.2.3'), null);
  assert.equal(parseNum('12mm'), null);
  assert.equal(parseNum(undefined), null);
  assert.equal(parseNum(Number.NaN), null);
});

test('format helpers', () => {
  assert.equal(fmt(26.7949, 1), '26.8');
  assert.equal(fmt(2.0, 2), '2');
  assert.equal(round(-0.0001, 2), 0);
  assert.equal(fmtInches(12.53), '12 1/2"');
  assert.equal(fmtInches(3.0625), '3 1/16"');
  assert.equal(fmtInches(0.75), '3/4"');
  assert.equal(fmtInches(0.01), '0"');
});

// ---------- bending ----------
test('multipliers and shrink match published bender constants', () => {
  // Published multipliers: 10° ≈ 6 (exact 5.76), 22.5° 2.6, 30° 2.0, 45° 1.414, 60° 1.155.
  near(multiplier(30), 2, 1e-9);
  near(multiplier(45), 1.4142, 1e-4);
  near(multiplier(60), 1.1547, 1e-4);
  near(multiplier(22.5), 2.6131, 1e-4);
  // Published shrink per inch: 22.5° 3/16, 30° 1/4, 45° 3/8, 60° 1/2 (rounded tan(θ/2)).
  near(shrinkPerUnit(22.5), 3 / 16, 0.015);
  near(shrinkPerUnit(30), 1 / 4, 0.02);
  near(shrinkPerUnit(45), 3 / 8, 0.04);
  near(shrinkPerUnit(60), 1 / 2, 0.08);
});

test('offset: 100 mm rise at 30°, obstacle 1000 mm from the end', () => {
  const v = ok(offset({ rise: 100, angle: 30, toObstacle: 1000 }));
  near(v.distance, 200);
  near(v.shrink, 26.795);
  near(v.secondMark, 1026.795);
  near(v.firstMark, 826.795);
  // Geometry check: horizontal position of bend 2 = first mark + distance × cos θ = obstacle.
  near(v.firstMark! + v.distance * Math.cos(Math.PI / 6), 1000);
});

test('offset: 10" rise at 45° (imperial)', () => {
  const v = ok(offset({ rise: 10, angle: 45 }));
  near(v.distance, 14.142);
  near(v.shrink, 4.142);
});

test('offset: invalid input and warnings', () => {
  bad(offset({ rise: 0, angle: 30 }));
  bad(offset({ rise: null, angle: 30 }));
  bad(offset({ rise: 100, angle: 90 }));
  bad(offset({ rise: 100, angle: -5 }));
  bad(offset({ rise: 100, angle: Number.NaN }));
  bad(offset({ rise: 100, angle: 30, toObstacle: -1 }));
  const r = offset({ rise: 500, angle: 10, toObstacle: 100 });
  assert.ok(r.ok && r.warnings.some(w => w.includes('before the end')));
  const steep = offset({ rise: 100, angle: 75 });
  assert.ok(steep.ok && steep.warnings.length === 1);
});

test('3-point saddle 45°/22.5° over a 100 mm pipe', () => {
  const v = ok(saddle3({ height: 100, toCentre: 2000 }));
  assert.equal(v.sideAngle, 22.5);
  near(v.sideDistance, 261.31);
  near(v.shrink, 39.78);
  near(v.centreAdvance, 19.89);
  near(v.centreMark, 2019.89);
  near(v.firstMark, 2019.89 - 261.31);
  near(v.thirdMark, 2019.89 + 261.31);
  // Field rule: 3/16" per inch of height ≈ tan(11.25°).
  near(v.centreAdvance / 100, 3 / 16, 0.015);
});

test('3-point saddle 60°/30°', () => {
  const v = ok(saddle3({ height: 2, centreAngle: 60 }));
  near(v.sideDistance, 4, 1e-9); // multiplier 2
  near(v.centreAdvance, 2 * Math.tan(Math.PI / 12)); // ≈ 1/4" per inch
  bad(saddle3({ height: -1 }));
  bad(saddle3({ height: 50, centreAngle: 0 }));
  bad(saddle3({ height: 50, toCentre: -10 }));
});

test('4-point saddle: 100 mm high, 300 mm wide box, 1000 mm away, 45° offsets', () => {
  const v = ok(saddle4({ height: 100, width: 300, toObstacle: 1000, angle: 45 }));
  near(v.distance, 141.42);
  near(v.shrinkEach, 41.42);
  near(v.shrinkTotal, 82.84);
  near(v.marks[0], 900);
  near(v.marks[1], 1041.42);
  near(v.marks[2], 1341.42);
  near(v.marks[3], 1482.84);
  // Horizontal check: bend 2 lands on the near edge.
  near(v.marks[0] + v.distance * Math.SQRT1_2, 1000);
  bad(saddle4({ height: 100, width: -1, toObstacle: 1000, angle: 45 }));
  bad(saddle4({ height: 100, width: 300, toObstacle: null, angle: 45 }));
  const tight = saddle4({ height: 300, width: 100, toObstacle: 100, angle: 22.5 });
  assert.ok(tight.ok && tight.warnings.length === 1);
});

test('kick: from rise and run, and from rise and angle', () => {
  const a = ok(kick({ rise: 50, run: 50 }));
  near(a.angle, 45);
  near(a.travel, 70.71);
  const b = ok(kick({ rise: 50, angle: 30 }));
  near(b.travel, 100);
  near(b.run, 86.6);
  bad(kick({ rise: 50 }));
  bad(kick({ rise: 0, angle: 30 }));
});

test('90° stub-up: mark, developed length and gain', () => {
  const v = ok(stub90({ height: 300, takeUp: 125, radius: 100 }));
  assert.equal(v.mark, 175);
  near(v.developed, 157.08);
  near(v.gain, 42.92);
  bad(stub90({ height: 100, takeUp: 125 }));
  bad(stub90({ height: 100, takeUp: -1 }));
  bad(stub90({ height: 300, takeUp: 125, radius: 0 }));
});

// ---------- voltage drop ----------
test('vdrop mV/A·m: 18 mV/A·m, 20 A, 30 m single-phase', () => {
  const v = ok(vdropMv({ mvPerAm: 18, current: 20, length: 30, phase: 'single' }));
  near(v.vd, 10.8);
  near(v.pct, 4.696);
  assert.equal(v.pass, true);
  near(v.maxLength, 31.94);
  near(v.vEnd, 219.2);
});

test('vdrop mV/A·m: three-phase over the limit', () => {
  const v = ok(vdropMv({ mvPerAm: 3.08, current: 100, length: 80, phase: 'three' }));
  near(v.vd, 24.64);
  near(v.pct, 6.16);
  assert.equal(v.pass, false);
  const tight = ok(vdropMv({ mvPerAm: 18, current: 20, length: 30, phase: 'single', limitPct: 3 }));
  assert.equal(tight.pass, false);
});

test('vdrop: invalid input', () => {
  bad(vdropMv({ mvPerAm: 18, current: 0, length: 30, phase: 'single' }));
  bad(vdropMv({ mvPerAm: 18, current: 20, length: -1, phase: 'single' }));
  bad(vdropMv({ mvPerAm: null, current: 20, length: 30, phase: 'single' }));
  bad(vdropMv({ mvPerAm: 18, current: 20, length: 30, phase: 'single', limitPct: 0 }));
  bad(vdropMv({ mvPerAm: 18, current: 20, length: 30, phase: 'single', voltage: 0 }));
  bad(vdropPhysics({ metal: 'cu', area: 0, current: 20, length: 30, phase: 'single' }));
  bad(vdropPhysics({ metal: 'cu', area: 2.5, current: 20, length: 30, phase: 'single', pf: 1.2 }));
  bad(vdropPhysics({ metal: 'cu', area: 2.5, current: 20, length: 30, phase: 'single', pf: 0 }));
  bad(vdropPhysics({ metal: 'cu', area: 2.5, current: 20, length: 30, phase: 'single', tempC: 400 }));
  bad(vdropPhysics({ metal: 'cu', area: 2.5, current: 20, length: 30, phase: 'single', reactance: -1 }));
});

test('conductor resistance from resistivity', () => {
  near(resistancePerM('cu', 1, 20, false), 0.017241, 1e-6); // IEC 60028
  near(resistancePerM('al', 1, 20, false), 0.028264, 1e-6); // IEC 60889
  // 2.5 mm² stranded copper at 20 °C ≈ 7.4 Ω/km (class 2 maximum 7.41 Ω/km).
  near(resistancePerM('cu', 2.5, 20) * 1000, 7.36, 0.06);
  // Temperature correction: 75 °C is 21.6 % higher than 20 °C for copper.
  near(resistancePerM('cu', 2.5, 75) / resistancePerM('cu', 2.5, 20), 1 + METALS.cu.alpha20 * 55, 1e-12);
});

test('vdrop physics: 2.5 mm² copper, 20 A, 30 m, 75 °C, single-phase', () => {
  const v = ok(vdropPhysics({ metal: 'cu', area: 2.5, current: 20, length: 30, phase: 'single', tempC: 75 }));
  near(v.vd, 10.74, 0.02);
  near(v.pct, 4.67, 0.01);
  // Comparable with the ≈18 mV/A·m published for 2.5 mm² single-phase.
  assert.ok(v.mvPerAm > 17 && v.mvPerAm < 19, `mV/A·m ${v.mvPerAm}`);
});

test('vdrop physics: smallest size for 32 A over 50 m single-phase at 5 %', () => {
  const v = ok(vdropPhysics({ metal: 'cu', area: 6, current: 32, length: 50, phase: 'single' }));
  assert.equal(v.pass, false);
  assert.equal(v.minSize, 10);
  const al = ok(vdropPhysics({ metal: 'al', area: 16, current: 32, length: 50, phase: 'single' }));
  assert.equal(al.minSize, 16);
});

test('vdrop physics: three-phase with power factor and reactance', () => {
  const v = ok(vdropPhysics({ metal: 'cu', area: 35, current: 100, length: 100, phase: 'three', tempC: 75, pf: 0.8, reactance: 0.08 }));
  const R = resistancePerM('cu', 35, 75);
  const expected = Math.sqrt(3) * 100 * 100 * (R * 0.8 + 0.00008 * 0.6);
  near(v.vd, expected, 1e-9);
  near(v.pct, (expected / 400) * 100, 1e-9);
  const big = vdropPhysics({ metal: 'cu', area: 35, current: 100, length: 100, phase: 'three' });
  assert.ok(big.ok && big.warnings.some(w => w.includes('reactance')));
});

test('vdrop physics: impossible run reports no size', () => {
  const v = ok(vdropPhysics({ metal: 'cu', area: 630, current: 2000, length: 5000, phase: 'single' }));
  assert.equal(v.minSize, null);
});

// ---------- conduit fill ----------
test('fill: three 2.5 mm² singles in 20 mm PVC', () => {
  const v = ok(conduitFill({ conduitId: 16.9, lines: [{ od: 3.6, qty: 3 }] }));
  near(v.fillPct, 13.61, 0.02);
  assert.equal(v.limitPct, 40);
  assert.equal(v.pass, true);
  assert.equal(v.maxSame, 8);
});

test('fill: limits by count, mixed cables, jam ratio', () => {
  assert.equal(fillLimit(1), 53);
  assert.equal(fillLimit(2), 31);
  assert.equal(fillLimit(7), 40);
  const mixed = ok(conduitFill({ conduitId: 21.4, lines: [{ od: 4.9, qty: 4 }, { od: 6.2, qty: 2 }] }));
  near(mixed.fillPct, ((4 * 4.9 ** 2 + 2 * 6.2 ** 2) / 21.4 ** 2) * 100, 1e-9);
  assert.equal(mixed.maxSame, undefined);
  const jam = ok(conduitFill({ conduitId: 10.5, lines: [{ od: 3.5, qty: 3 }] }));
  assert.equal(jam.jamRisk, true);
  const over = ok(conduitFill({ conduitId: 16.9, lines: [{ od: 6.2, qty: 6 }] }));
  assert.equal(over.pass, false);
});

test('fill: invalid input', () => {
  bad(conduitFill({ conduitId: 0, lines: [{ od: 3, qty: 1 }] }));
  bad(conduitFill({ conduitId: 20, lines: [] }));
  bad(conduitFill({ conduitId: 20, lines: [{ od: 20, qty: 1 }] }));
  bad(conduitFill({ conduitId: 20, lines: [{ od: 3, qty: 1.5 }] }));
  bad(conduitFill({ conduitId: 20, lines: [{ od: 0, qty: 2 }] }));
  bad(conduitFill({ conduitId: 20, lines: [{ od: 3, qty: 2 }], limitPct: 120 }));
});

// ---------- Ohm's law and power ----------
test("Ohm's law from each pair", () => {
  const a = ok(ohm({ V: 230, P: 2300 }));
  near(a.I, 10); near(a.R, 23);
  const b = ok(ohm({ R: 10, P: 1000 }));
  near(b.I, 10); near(b.V, 100);
  const c = ok(ohm({ V: 12, I: 2 }));
  near(c.R, 6); near(c.P, 24);
  const d = ok(ohm({ I: 5, R: 46 }));
  near(d.V, 230); near(d.P, 1150);
  const e = ok(ohm({ I: 4, P: 960 }));
  near(e.V, 240); near(e.R, 60);
  const f = ok(ohm({ V: 230, R: 52.9 }));
  near(f.P, 1000);
  bad(ohm({ V: 230 }));
  bad(ohm({ V: 230, I: 10, R: 23 }));
  bad(ohm({ V: -230, I: 10 }));
  bad(ohm({ V: 0, I: 10 }));
});

test('power triangle: 15 kW three-phase motor at 0.85 pf on 400 V', () => {
  const v = ok(powerTriangle({ supply: 'three', voltage: 400, pf: 0.85, kw: 15 }));
  near(v.S / 1000, 17.647, 0.001);
  near(v.I, 25.47, 0.01);
  near(v.Q / 1000, 9.296, 0.001);
  near(Math.hypot(v.P, v.Q), v.S, 1e-6);
});

test('power triangle: single-phase from current and from kVA; invalid', () => {
  const a = ok(powerTriangle({ supply: 'single', voltage: 230, pf: 1, current: 10 }));
  near(a.S, 2300); near(a.Q, 0);
  const b = ok(powerTriangle({ supply: 'three', voltage: 400, pf: 0.9, kva: 100 }));
  near(b.I, 144.34);
  bad(powerTriangle({ supply: 'single', voltage: 230, pf: 1 }));
  bad(powerTriangle({ supply: 'single', voltage: 230, pf: 1, current: 10, kw: 2 }));
  bad(powerTriangle({ supply: 'single', voltage: 230, pf: 1.1, current: 10 }));
  bad(powerTriangle({ supply: 'single', voltage: 0, pf: 1, current: 10 }));
});

// ---------- cable runs ----------
test('cut list: best fit from two drums', () => {
  const v = ok(planCuts({
    runs: [{ id: 'a', label: 'Kitchen', length: 30, qty: 2 }, { id: 'b', label: 'Shed', length: 45, qty: 1 }, { id: 'c', label: 'Hall', length: 12, qty: 1 }],
    drums: [{ id: 'd1', label: 'Drum 1', length: 100 }, { id: 'd2', label: 'Drum 2', length: 50 }],
    allowance: 0.5,
    wastePct: 10,
  }));
  near(v.totalCut, 119);
  near(v.toOrder, 132.222, 0.001);
  const d1 = v.plans.find(p => p.drumId === 'd1')!;
  const d2 = v.plans.find(p => p.drumId === 'd2')!;
  assert.deepEqual(d2.cuts.map(c => c.length), [45.5]);
  near(d2.offcut, 4.5);
  assert.deepEqual(d1.cuts.map(c => c.length), [30.5, 30.5, 12.5]);
  near(d1.offcut, 26.5);
  assert.equal(v.unplaced.length, 0);
  near(v.leftover, 31);
});

test('cut list: run too long for any drum, and invalid input', () => {
  const r = planCuts({ runs: [{ id: 'a', label: 'Sub-main', length: 120, qty: 1 }], drums: [{ id: 'd', label: 'Drum', length: 100 }] });
  assert.ok(r.ok && r.value.unplaced.length === 1 && r.warnings.length === 1);
  const none = ok(planCuts({ runs: [{ id: 'a', label: 'A', length: 10, qty: 3 }], drums: [] }));
  near(none.toOrder, 30);
  bad(planCuts({ runs: [], drums: [] }));
  bad(planCuts({ runs: [{ id: 'a', label: 'A', length: 0, qty: 1 }], drums: [] }));
  bad(planCuts({ runs: [{ id: 'a', label: 'A', length: 5, qty: 0.5 }], drums: [] }));
  bad(planCuts({ runs: [{ id: 'a', label: 'A', length: 5, qty: 1 }], drums: [{ id: 'd', label: 'D', length: -5 }] }));
  bad(planCuts({ runs: [{ id: 'a', label: 'A', length: 5, qty: 1 }], drums: [], wastePct: 100 }));
  bad(planCuts({ runs: [{ id: 'a', label: 'A', length: 5, qty: 1 }], drums: [], allowance: -1 }));
});

// ---------- converter ----------
test('AWG per ASTM B258', () => {
  near(awgDiameterMm(10), 2.588, 0.001);
  near(awgAreaMm2(10), 5.261, 0.002);
  near(awgAreaMm2(-3), 107.2, 0.1); // 4/0
  near(awgAreaMm2(36), Math.PI * 0.127 ** 2 / 4, 1e-9);
  const v = ok(mm2ToAwg(2.5));
  assert.equal(v.nearest, 13);
  assert.equal(ok(mm2ToAwg(5.26)).nearestLabel, '10');
  assert.equal(ok(mm2ToAwg(107)).nearestLabel, '4/0');
  assert.ok(ok(mm2ToAwg(10_000)).nearest === -3);
  bad(mm2ToAwg(0));
});

test('unit conversions', () => {
  near(convert('length', 'm', 'ft', 1)!, 3.28084, 1e-5);
  near(convert('shortLength', 'in', 'mm', 1)!, 25.4, 1e-12);
  near(convert('temp', 'C', 'F', 100)!, 212, 1e-9);
  near(convert('temp', 'F', 'C', 32)!, 0, 1e-9);
  near(convert('power', 'hp', 'kW', 1)!, 0.7457, 1e-4);
  near(convert('area', 'kcmil', 'mm2', 250)!, 126.68, 0.01);
  assert.equal(convert('temp', 'C', 'F', -300), null);
  assert.equal(convert('length', 'm', 'ft', -1), null);
  assert.equal(convert('length', 'm', 'nope', 1), null);
  near(kvaToAmps(10, 400, 'three'), 14.43, 0.01);
  near(kvaToAmps(10, 230, 'single'), 43.48, 0.01);
  near(ampsToKva(14.4338, 400, 'three'), 10, 0.001);
});
