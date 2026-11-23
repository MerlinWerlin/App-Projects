// Worked examples for every calculator. Expected values were worked out independently (Python math, and the
// published framing-square and mitre-saw charts quoted below), not copied from the code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arcFromChord } from './arc.ts';
import { optimiseCuts, type CutInput } from './cutlist.ts';
import { decking, layoutMembers } from './layout.ts';
import { compoundMitre, flatMitre, normaliseCorner, polygonMitre } from './mitre.ts';
import { commonRafter, pitchFromDegrees, pitchFromRiseRun, regularHip } from './roof.ts';
import { squareCheck } from './square.ts';
import { stairCodesFor, stairLimitsById } from './stairCodes.ts';
import { goingRangeFor, planStair } from './stairs.ts';

const HOUSE = stairLimitsById('AU', 'au-house');
const PUBLIC = stairLimitsById('AU', 'au-public');
import { METRIC as F, MM_PER_INCH } from './units.ts';

const near = (a: number, b: number, tol = 0.01, msg?: string) => assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} is not within ${tol} of ${b}`);
function ok<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) assert.fail(`expected a result, got error: ${r.error}`);
  return r.value;
}
function err(r: { ok: boolean; error?: string }) {
  assert.equal(r.ok, false);
  assert.ok(r.error && r.error.length > 5);
}

// ---------- Stairs ----------
test('stairs: 2700 floor to floor, house: 15 risers of 180, going 270, 2R+G 630', () => {
  const r = planStair({ limits: HOUSE, totalRise: 2700, stringerWidth: 290 }, F);
  assert.ok(r.ok);
  const v = ok(r);
  assert.equal(v.risers, 15);
  assert.equal(v.treads, 14);
  near(v.riser, 180);
  near(v.going, 270);
  near(v.twoRG, 630);
  near(v.totalGoing, 3780);
  near(v.angle, 33.6901, 0.001);
  near(v.step, 324.4996, 0.001);
  near(v.pitchLine, 4542.9946, 0.01);
  near(v.throat!, 140.2309, 0.01);
  assert.ok(r.ok && r.checks.filter((c) => c.level === 'fail').length === 0);
});

test('stairs: available run picks the riser count that fits it', () => {
  const v = ok(planStair({ limits: HOUSE, totalRise: 2700, totalRun: 3500 }, F));
  assert.equal(v.risers, 15);
  near(v.going, 250);
  near(v.twoRG, 610);
});

test('stairs: forced 20 risers flags a flight over 18', () => {
  const r = planStair({ limits: HOUSE, totalRise: 3600, risers: 20 }, F);
  assert.ok(r.ok);
  assert.ok(r.checks.some((c) => c.level === 'fail' && /landing/.test(c.text)));
});

test('stairs: a going outside the limits fails its check, and public stairs need 250', () => {
  const r = planStair({ totalRise: 2700, going: 245, limits: PUBLIC }, F);
  assert.ok(r.ok);
  assert.ok(r.checks.some((c) => c.level === 'fail' && /Going/.test(c.text)));
  const house = planStair({ limits: HOUSE, totalRise: 2700, going: 245 }, F);
  assert.ok(house.ok && !house.checks.some((c) => c.level === 'fail' && /Going/.test(c.text)));
});

test('stairs: NCC limits as published (Housing 11.2.2a and Volume One D3D14)', () => {
  assert.deepEqual([HOUSE.rMin, HOUSE.rMax, HOUSE.gMin, HOUSE.gMax, HOUSE.sMin, HOUSE.sMax], [115, 190, 240, 355, 550, 700]);
  assert.equal(PUBLIC.gMin, 250);
  assert.equal(stairLimitsById('AU', 'au-private').gMin, 240);
  assert.equal(HOUSE.maxRisers, 18);
  assert.equal(stairCodesFor('AU').length, 3);
  // R 180: going 240-340 (2R+G caps it at 700 - 360)
  assert.deepEqual(goingRangeFor(180, HOUSE), { min: 240, max: 340 });
  assert.equal(goingRangeFor(200, HOUSE), null);
});

test('stairs: bad input gives plain errors', () => {
  err(planStair({ limits: HOUSE, totalRise: 0 }, F));
  err(planStair({ limits: HOUSE, totalRise: NaN }, F));
  err(planStair({ limits: HOUSE, totalRise: 2700, risers: 1 }, F));
  err(planStair({ limits: HOUSE, totalRise: 2700, risers: 2.5 }, F));
  err(planStair({ limits: HOUSE, totalRise: 2700, going: -5 }, F));
  err(planStair({ limits: HOUSE, totalRise: 99999 }, F));
  // tiny rise: still a plan, but the riser check fails
  const r = planStair({ limits: HOUSE, totalRise: 200 }, F);
  assert.ok(r.ok && r.checks.some((c) => c.level === 'fail' && /Riser/.test(c.text)));
});

test('stairs: cut-through stringer is a fail', () => {
  const r = planStair({ limits: HOUSE, totalRise: 2700, stringerWidth: 140 }, F);
  assert.ok(r.ok && r.checks.some((c) => c.level === 'fail' && /stringer/.test(c.text)));
});

// ---------- Roof ----------
test('pitch conversions: 6 in 12 is 26.57°, 500 per 1000, 50%', () => {
  const p = pitchFromRiseRun(6, 12)!;
  near(p.deg, 26.5651, 0.0001);
  near(p.per1000, 500);
  near(p.percent, 50);
  near(p.in12, 6);
  near(pitchFromDegrees(45)!.in12, 12);
  assert.equal(pitchFromDegrees(0), null);
  assert.equal(pitchFromDegrees(90), null);
  assert.equal(pitchFromRiseRun(-1, 12), null);
});

test('common rafter: 6000 span, 22.5°, 45 ridge, 450 eave, 190 rafter with 90 seat', () => {
  const v = ok(commonRafter({ span: 6000, pitchDeg: 22.5, ridgeThickness: 45, overhang: 450, rafterDepth: 190, seat: 90 }, F));
  near(v.run, 2977.5);
  near(v.rise, 1233.3209, 0.001);
  near(v.rafterToRidge, 3222.8228, 0.001);
  near(v.eaveLength, 487.0765, 0.001);
  near(v.total, 3709.8993, 0.001);
  near(v.plumbAngle, 22.5);
  near(v.seatAngle, 67.5);
  near(v.birdsmouth!.plumbHeight, 37.2792, 0.001);
  near(v.birdsmouth!.depthSquare, 34.4415, 0.001);
  near(v.birdsmouth!.hap, 168.3753, 0.001);
  assert.equal(v.birdsmouth!.overThird, false);
});

test('common rafter: framing-square table, 6 in 12 = 13.42 in of rafter per foot of run', () => {
  const v = ok(commonRafter({ span: 2 * 12 * MM_PER_INCH, pitchDeg: pitchFromRiseRun(6, 12)!.deg }, F));
  near(v.rafterToRidge / MM_PER_INCH, 13.4164, 0.0005);
});

test('common rafter: deep birdsmouth fails the one-third rule; bad input errors', () => {
  const r = commonRafter({ span: 6000, pitchDeg: 30, rafterDepth: 90, seat: 90 }, F);
  assert.ok(r.ok && r.checks.some((c) => c.level === 'fail'));
  err(commonRafter({ span: 0, pitchDeg: 22.5 }, F));
  err(commonRafter({ span: 6000, pitchDeg: 0 }, F));
  err(commonRafter({ span: 6000, pitchDeg: 95 }, F));
  err(commonRafter({ span: 100, pitchDeg: 20, ridgeThickness: 200 }, F));
  err(commonRafter({ span: 6000, pitchDeg: 20, overhang: -1 }, F));
});

test('regular hip: 3000 run at 25°, creepers at 600', () => {
  const v = ok(regularHip({ run: 3000, pitchDeg: 25, spacing: 600 }, F));
  near(v.rise, 1398.923, 0.001);
  near(v.hipRun, 4242.6407, 0.001);
  near(v.hipPitch, 18.2489, 0.0001);
  near(v.hipLength, 4467.3242, 0.001);
  near(v.creeperStep!, 662.0268, 0.001);
  assert.equal(v.creepers.length, 4);
  near(v.creepers[0], 662.0268, 0.001);
  near(v.creepers[3], 4 * 662.0268, 0.01);
});

test('regular hip: framing-square table, 6 in 12 hip = 18 in per foot of common run, jacks 17.89 in at 16 in centres', () => {
  const v = ok(regularHip({ run: 12 * MM_PER_INCH, pitchDeg: pitchFromRiseRun(6, 12)!.deg, spacing: 16 * MM_PER_INCH }, F));
  near(v.hipLength / MM_PER_INCH, 18, 0.0005);
  near(v.creeperStep! / MM_PER_INCH, 17.8885, 0.0005);
  err(regularHip({ run: 3000, pitchDeg: 25, spacing: 0 }, F));
  err(regularHip({ run: -1, pitchDeg: 25 }, F));
});

// ---------- Mitres ----------
test('flat mitres: 90° corner 45°, 135° corner 22.5°, outside corner measured 270° is 45°', () => {
  near(ok(flatMitre(90, F)).mitre, 45);
  near(ok(flatMitre(135, F)).mitre, 22.5);
  near(ok(flatMitre(270, F)).mitre, 45);
  near(ok(flatMitre(60, F)).mitre, 60);
  err(flatMitre(0, F));
  err(flatMitre(180, F));
  err(flatMitre(360, F));
  assert.equal(normaliseCorner(NaN), null);
});

test('polygons: 4 sides 45°, 6 sides 30°, 8 sides 22.5°, 12 sides 15°', () => {
  near(ok(polygonMitre(4, F)).mitre, 45);
  near(ok(polygonMitre(6, F)).mitre, 30);
  near(ok(polygonMitre(8, F)).mitre, 22.5);
  near(ok(polygonMitre(12, F)).mitre, 15);
  near(ok(polygonMitre(6, F)).interior, 120);
  err(polygonMitre(2, F));
  err(polygonMitre(4.5, F));
});

test('compound mitres match the mitre-saw crown charts', () => {
  // 45/45 crown, 90° corner: bevel 30.0, mitre 35.3
  let v = ok(compoundMitre(45, 90, F));
  near(v.bevel, 30, 0.01);
  near(v.mitre, 35.264, 0.01);
  // 52/38 crown (38° spring), 90° corner: bevel 33.9, mitre 31.6
  v = ok(compoundMitre(38, 90, F));
  near(v.bevel, 33.863, 0.01);
  near(v.mitre, 31.619, 0.01);
  near(v.nestedMitre, 45);
  // other corners
  v = ok(compoundMitre(45, 120, F));
  near(v.bevel, 20.705, 0.01);
  near(v.mitre, 22.208, 0.01);
  v = ok(compoundMitre(38, 135, F));
  near(v.bevel, 17.551, 0.01);
  near(v.mitre, 14.306, 0.01);
  // limits: standing upright (0°) is a pure 45° bevel; lying flat (90°) is a pure 45° mitre
  v = ok(compoundMitre(0, 90, F));
  near(v.bevel, 45);
  near(v.mitre, 0);
  v = ok(compoundMitre(90, 90, F));
  near(v.bevel, 0);
  near(v.mitre, 45);
  err(compoundMitre(-1, 90, F));
  err(compoundMitre(45, 0, F));
});

// ---------- Layout and decking ----------
test('stud layout: 3000 wall, 450 centres, 45 studs', () => {
  const v = ok(layoutMembers({ length: 3000, spacing: 450, thickness: 45 }, F));
  assert.equal(v.count, 8);
  assert.deepEqual(v.centres, [22.5, 450, 900, 1350, 1800, 2250, 2700, 2977.5]);
  near(v.gaps[0], 382.5);
  near(v.gaps[1], 405);
  near(v.gaps[v.gaps.length - 1], 232.5);
  assert.ok(Math.max(...v.gaps) <= 450 - 45 + 1e-9);
});

test('stud layout: a mark that would clash with the end stud is dropped', () => {
  // 2730: 6 x 450 = 2700 would sit 2677.5-2722.5, overlapping the end stud at 2685-2730
  const v = ok(layoutMembers({ length: 2730, spacing: 450, thickness: 45 }, F));
  assert.deepEqual(v.centres, [22.5, 450, 900, 1350, 1800, 2250, 2707.5]);
  err(layoutMembers({ length: 3000, spacing: 50, thickness: 45 }, F));
  err(layoutMembers({ length: 80, spacing: 450, thickness: 45 }, F));
  err(layoutMembers({ length: 3000, spacing: 0, thickness: 45 }, F));
});

test('decking: 3000 wide, 86 boards, 5 gaps: 33 boards, 2 mm left, gaps opened', () => {
  const v = ok(decking({ deckWidth: 3000, deckLength: 4800, boardWidth: 86, gap: 5, joistSpacing: 450, stockLength: 5400, wastePct: 10 }, F));
  assert.equal(v.boards, 33);
  assert.equal(v.ripped, false);
  near(v.gapAdjust, 2 / 32);
  near(v.linearMetres, 158.4);
  near(v.withWaste, 174.24);
  assert.equal(v.stockPieces, 37); // 33 x 1 length x 1.1 = 36.3, round up
  assert.equal(v.joists, 12); // 4800 / 450 = 10.67 -> 11 + 1
  assert.equal(v.fixings, 12 * 33 * 2);
});

test('decking: a leftover wide enough to rip becomes a ripped last board', () => {
  // 1000 wide, 90 boards, 4 gaps: 10 full boards = 936, 64 left, minus a gap = 60 ripped board
  const v = ok(decking({ deckWidth: 1000, deckLength: 2000, boardWidth: 90, gap: 4 }, F));
  assert.equal(v.boards, 11);
  assert.equal(v.ripped, true);
  near(v.lastBoard, 60);
  err(decking({ deckWidth: 1000, deckLength: 2000, boardWidth: 90, gap: 95 }, F));
  err(decking({ deckWidth: 1000, deckLength: 2000, boardWidth: 90, gap: -1 }, F));
  err(decking({ deckWidth: 1000, deckLength: 2000, boardWidth: 90, gap: 4, wastePct: 150 }, F));
});

// ---------- Cut list ----------
function validPlan(input: CutInput) {
  const r = optimiseCuts(input, F);
  const v = ok(r);
  const kerf = input.kerf ?? 3;
  const trim = input.trim ?? 0;
  for (const bar of v.bars) {
    const need = bar.cuts.reduce((a, c) => a + c.length, 0) + (bar.cuts.length - 1) * kerf + trim;
    assert.ok(need <= bar.stock + 1e-9, `bar of ${bar.stock} overfilled: ${need}`);
    for (let i = 1; i < bar.cuts.length; i++) near(bar.cuts[i].start, bar.cuts[i - 1].start + bar.cuts[i - 1].length + kerf, 1e-9);
  }
  const placed = v.bars.reduce((a, b) => a + b.cuts.length, 0) + v.unplaced.reduce((a, p) => a + p.qty, 0);
  assert.equal(placed, input.pieces.reduce((a, p) => a + p.qty, 0));
  return v;
}

test('cut list: two 2997 pieces fit one 6000 length with a 3 mm kerf, nothing left', () => {
  const v = validPlan({ stock: [{ length: 6000 }], pieces: [{ length: 2997, qty: 2 }], kerf: 3 });
  assert.equal(v.bars.length, 1);
  near(v.bars[0].offcut, 0);
});

test('cut list: three 2000s need two 6000s once the kerf is counted', () => {
  const v = validPlan({ stock: [{ length: 6000 }], pieces: [{ length: 2000, qty: 3 }], kerf: 3 });
  assert.equal(v.bars.length, 2);
  const zero = validPlan({ stock: [{ length: 6000 }], pieces: [{ length: 2000, qty: 3 }], kerf: 0 });
  assert.equal(zero.bars.length, 1);
});

test('cut list: picks the shorter stock that fits better', () => {
  const v = validPlan({ stock: [{ length: 6000 }, { length: 4800 }], pieces: [{ length: 1500, qty: 3 }], kerf: 0 });
  assert.equal(v.bars.length, 1);
  assert.equal(v.bars[0].stock, 4800);
});

test('cut list: a classic mix packs to the lower bound', () => {
  // 8 x 2400 + 8 x 1100 + 6 x 600 = 31,600 of pieces; 6 x 6000 = 36,000 is the fewest lengths that can hold them
  const v = validPlan({ stock: [{ length: 6000 }], pieces: [{ length: 2400, qty: 8 }, { length: 1100, qty: 8 }, { length: 600, qty: 6 }], kerf: 3 });
  assert.equal(v.bars.length, 6);
  near(v.piecesLength, 31600);
});

test('cut list: limited stock leaves pieces unplaced and says so', () => {
  const r = optimiseCuts({ stock: [{ length: 3000, qty: 1 }], pieces: [{ length: 1000, qty: 5 }], kerf: 0 }, F);
  assert.ok(r.ok);
  const v = ok(r);
  assert.equal(v.bars.length, 1);
  assert.deepEqual(v.unplaced, [{ length: 1000, qty: 2, label: undefined }]);
  assert.ok(r.checks.some((c) => c.level === 'fail'));
});

test('cut list: random plans are always valid', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const pieces = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => ({ length: Math.round(200 + rnd() * 3000), qty: 1 + Math.floor(rnd() * 5) }));
    validPlan({ stock: [{ length: 5400 }, { length: 3600 }], pieces, kerf: 3, trim: rnd() < 0.5 ? 10 : 0 });
  }
});

test('cut list: errors for bad input', () => {
  err(optimiseCuts({ stock: [{ length: 2400 }], pieces: [{ length: 2500, qty: 1 }] }, F));
  err(optimiseCuts({ stock: [], pieces: [{ length: 500, qty: 1 }] }, F));
  err(optimiseCuts({ stock: [{ length: 2400 }], pieces: [] }, F));
  err(optimiseCuts({ stock: [{ length: 2400 }], pieces: [{ length: 500, qty: 1.5 }] }, F));
  err(optimiseCuts({ stock: [{ length: 2400 }], pieces: [{ length: 500, qty: 1 }], kerf: -1 }, F));
  err(optimiseCuts({ stock: [{ length: 2400 }], pieces: [{ length: 10, qty: 1001 }] }, F));
  err(optimiseCuts({ stock: [{ length: 2400, qty: 1.5 }], pieces: [{ length: 500, qty: 1 }] }, F));
});

// ---------- Square ----------
test('square: 3000 x 4000 has a 5000 diagonal, 3-4-5 at 3000/4000/5000', () => {
  const v = ok(squareCheck({ a: 3000, b: 4000 }, F));
  near(v.diagonal, 5000);
  assert.deepEqual(v.triple, { k: 1000, a: 3000, b: 4000, c: 5000 });
});

test('square: diagonals 5010 and 4990 put the corner at 89.76°', () => {
  const r = squareCheck({ a: 3000, b: 4000, d1: 5010, d2: 4990 }, F);
  const v = ok(r);
  near(v.measured!.corner, 89.7613, 0.0001);
  near(v.measured!.diff, 20);
  assert.ok(r.ok && r.checks.some((c) => c.level === 'fail'));
  const sq = squareCheck({ a: 3000, b: 4000, d1: 5000 }, F);
  assert.ok(sq.ok && sq.checks[0].level === 'ok');
  near(ok(sq).measured!.corner, 90, 1e-9);
  err(squareCheck({ a: 3000, b: 4000, d1: 9000 }, F));
  err(squareCheck({ a: 0, b: 4000 }, F));
  err(squareCheck({ a: 3000, b: 4000, d1: -1 }, F));
});

// ---------- Arcs ----------
test('arc: 1200 span, 200 rise -> 1000 radius, 73.74°, 1287.0 arc', () => {
  const v = ok(arcFromChord({ chord: 1200, rise: 200, divisions: 4 }, F));
  near(v.radius, 1000);
  near(v.angle, 73.7398, 0.0001);
  near(v.arcLength, 1287.0022, 0.001);
  near(v.offsets[0].y, 0, 1e-9);
  near(v.offsets[2].y, 200, 1e-9);
  near(v.offsets[4].y, 0, 1e-9);
  // at 300 from the centre: sqrt(1000² - 300²) - 800 = 153.94
  near(v.offsets[1].y, 153.9392, 0.001);
});

test('arc: semicircle and more than a semicircle', () => {
  const semi = ok(arcFromChord({ chord: 1000, rise: 500 }, F));
  near(semi.radius, 500);
  near(semi.angle, 180, 1e-6);
  near(semi.arcLength, Math.PI * 500, 1e-6);
  const big = ok(arcFromChord({ chord: 600, rise: 500 }, F));
  near(big.radius, 340);
  near(big.angle, 236.145, 0.001);
  err(arcFromChord({ chord: 0, rise: 10 }, F));
  err(arcFromChord({ chord: 100, rise: 10, divisions: 1 }, F));
});

test('cut list: prices per length add up to a total, and any missing price gives no total', () => {
  const v = validPlan({ stock: [{ length: 6000, price: 18.5 }, { length: 4800, price: 14 }], pieces: [{ length: 2400, qty: 4 }, { length: 1500, qty: 3 }], kerf: 3 });
  const expected = v.bars.reduce((a, b) => a + (b.stock === 6000 ? 18.5 : 14), 0);
  near(v.cost!, expected, 1e-9);
  const none = validPlan({ stock: [{ length: 6000, price: 18.5 }, { length: 4800 }], pieces: [{ length: 4500, qty: 2 }], kerf: 3 });
  assert.equal(none.cost, null);
});

test('square: in imperial the 3-4-5 marks are whole feet (9 ft x 12 ft frame -> 9, 12, 15 ft)', () => {
  const v = ok(squareCheck({ a: 108 * 25.4, b: 144 * 25.4, imperial: true }, F));
  assert.deepEqual(v.triple && [v.triple.a, v.triple.b, v.triple.c].map((x) => Math.round(x / 304.8)), [9, 12, 15]);
});
