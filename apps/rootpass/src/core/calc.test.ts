// Worked examples for every calculator, with edge cases and invalid input.
// Expected values are worked by hand (shown in each comment) or taken from published tables where noted.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bend, defaultK } from './bend.ts';
import { cutList } from './cutlist.ts';
import { bendOutline, lobster, mitreCutBack } from './lobster.ts';
import { cornerMitre, polygonFrame, rectFrame } from './mitre.ts';
import { pcd } from './pcd.ts';
import { saddle, saddleT, type SaddleInput } from './saddle.ts';
import { fmt, inchFraction, len, parseNum } from './units.ts';
import { rhsCornerRadii, weight } from './weight.ts';
import { jointArea, weldFiller } from './weld.ts';

const near = (a: number, b: number, tol = 1e-6, msg?: string) => assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} ≉ ${b} (±${tol})`);
const DEG = Math.PI / 180;

/* ---------- units ---------- */
test('parseNum reads decimals, commas and tape fractions; rejects junk', () => {
  assert.equal(parseNum('12.5'), 12.5);
  assert.equal(parseNum('12,5'), 12.5);
  assert.equal(parseNum('3 1/2'), 3.5);
  assert.equal(parseNum('1/4'), 0.25);
  assert.equal(parseNum('-2'), -2);
  assert.equal(parseNum('.5'), 0.5);
  for (const bad of ['', 'abc', '1/0', '1..2', '3 1/0', '2e3', null, undefined]) assert.ok(Number.isNaN(parseNum(bad as string)), String(bad));
});

test('inch fractions round to the nearest 1/16 and reduce', () => {
  assert.equal(inchFraction(3.53), '3 1/2'); // 3.53 × 16 = 56.5 → 56/16
  assert.equal(inchFraction(0.999), '1');
  assert.equal(inchFraction(0.0625), '1/16');
  assert.equal(inchFraction(2.375), '2 3/8');
  assert.equal(inchFraction(-1.25), '-1 1/4');
  assert.equal(len(25.4, 'imperial'), '1.000 in (1")');
  assert.equal(len(12.345, 'metric'), '12.3 mm');
  assert.equal(fmt(-0.00001, 2), '0.00');
});

/* ---------- saddle ---------- */
const tee = (o: Partial<SaddleInput>): SaddleInput => ({ headerOD: 100, branchOD: 100, branchWall: 0, angleDeg: 90, offset: 0, contact: 'outside', ...o });

test('equal square tee: deepest cut = half the OD, sides uncut', () => {
  const r = saddle(tee({}));
  assert.ok(r.ok);
  near(r.value.maxDepth, 50, 1e-9);
  near(r.value.circumference, Math.PI * 100, 1e-9);
  const at = (deg: number) => r.value.points.find(p => p.phiDeg === deg)!.h;
  near(at(0), 0, 1e-9);
  near(at(180), 0, 1e-9);
  near(at(90), 50, 1e-9);
  near(at(270), 50, 1e-9);
  near(r.value.points[90].x, (Math.PI * 100) / 4, 1e-9); // quarter of the circumference
});

test('unequal square tee matches the textbook ordinate formula h = √(R² − r²cos²φ) − √(R² − r²)', () => {
  const R = 114.3 / 2, r = 60.3 / 2;
  const res = saddle(tee({ headerOD: 114.3, branchOD: 60.3 }));
  assert.ok(res.ok);
  for (const p of res.value.ordinates) {
    const want = Math.sqrt(R * R - r * r * Math.cos(p.phiDeg * DEG) ** 2) - Math.sqrt(R * R - r * r);
    near(p.h, want, 1e-9, `φ ${p.phiDeg}`);
  }
  near(res.value.maxDepth, R - Math.sqrt(R * R - r * r), 1e-9); // 8.60 mm
  near(res.value.maxDepth, 8.600, 1e-3);
});

// Independent check: march along the branch surface line at each φ and find where it meets the header
// cylinder by bisection, with no use of the closed-form equation.
function bisectT(phi: number, R: number, r: number, e: number, thDeg: number): number {
  const th = thDeg * DEG;
  const d = [Math.cos(th), 0, Math.sin(th)], u = [0, 1, 0], v = [-Math.sin(th), 0, Math.cos(th)];
  const P = (t: number) => [0, 1, 2].map(k => [0, e, 0][k] + t * d[k] + r * (Math.cos(phi) * u[k] + Math.sin(phi) * v[k]));
  const f = (t: number) => { const p = P(t); return p[1] ** 2 + p[2] ** 2 - R * R; };
  // The line enters the header cylinder from outside (large t) going toward the axis; find the outermost root.
  let hi = 10 * R + 10 * r, lo = hi;
  while (f(lo) > 0 && lo > -10 * R) lo -= 0.5;
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

test('laterals and offset branches agree with an independent numeric intersection', () => {
  const cases = [
    { headerOD: 168.3, branchOD: 114.3, angleDeg: 45, offset: 0 },
    { headerOD: 219.1, branchOD: 88.9, angleDeg: 60, offset: 50 },
    { headerOD: 114.3, branchOD: 114.3, angleDeg: 30, offset: 0 },
    { headerOD: 273.1, branchOD: 60.3, angleDeg: 90, offset: -100 },
  ];
  for (const c of cases) {
    const R = c.headerOD / 2, r = c.branchOD / 2;
    for (let deg = 0; deg < 360; deg += 7.5) {
      const closed = saddleT(deg * DEG, R, r, c.offset, c.angleDeg * DEG);
      near(closed, bisectT(deg * DEG, R, r, c.offset, c.angleDeg), 1e-6, `${JSON.stringify(c)} φ ${deg}`);
    }
  }
});

test('inside-wall contact uses the bore radius but wraps the outside circumference', () => {
  const r = saddle(tee({ headerOD: 114.3, branchOD: 114.3, branchWall: 6, contact: 'inside' }));
  assert.ok(r.ok);
  near(r.value.contactRadius, 114.3 / 2 - 6, 1e-9);
  near(r.value.circumference, Math.PI * 114.3, 1e-9);
  near(r.value.maxDepth, 57.15 - Math.sqrt(57.15 ** 2 - 51.15 ** 2), 1e-9); // 25.49
});

test('branch length: long and short points from the height above the header centreline', () => {
  const r = saddle(tee({ heightFromCentre: 300 }));
  assert.ok(r.ok);
  near(r.value.longLength!, 300, 1e-9); // equal tee: tips reach the centreline (t min = 0)
  near(r.value.shortLength!, 250, 1e-9);
  const tooShort = saddle(tee({ heightFromCentre: 40 }));
  assert.equal(tooShort.ok, false);
});

test('saddle rejects impossible fits and bad input', () => {
  assert.equal(saddle(tee({ branchOD: 120 })).ok, false); // branch bigger than header
  assert.equal(saddle(tee({ headerOD: 100, branchOD: 60, offset: 25 })).ok, false); // 25 + 30 > 50
  assert.equal(saddle(tee({ headerOD: 100, branchOD: 60, offset: 20 })).ok, true); // flush with the side: allowed
  assert.equal(saddle(tee({ angleDeg: 5 })).ok, false);
  assert.equal(saddle(tee({ angleDeg: 95 })).ok, false);
  assert.equal(saddle(tee({ headerOD: 0 })).ok, false);
  assert.equal(saddle(tee({ headerOD: NaN })).ok, false);
  assert.equal(saddle(tee({ contact: 'inside', branchWall: 0 })).ok, false);
  assert.equal(saddle(tee({ contact: 'inside', branchWall: 50 })).ok, false);
  assert.equal(saddle(tee({ divisions: 3 })).ok, false);
});

/* ---------- lobster ---------- */
test('4-piece 90° lobster-back: 3 welds of 30°, cuts 15° off square', () => {
  const r = lobster({ od: 114.3, bendDeg: 90, pieces: 4, radius: 150 });
  assert.ok(r.ok);
  const t15 = Math.tan(15 * DEG); // 0.267949
  assert.equal(r.value.welds, 3);
  near(r.value.weldDeg, 30, 1e-12);
  near(r.value.cutDeg, 15, 1e-12);
  near(r.value.middle.centre, 2 * 150 * t15, 1e-9); // 80.385
  near(r.value.middle.long, 2 * 207.15 * t15, 1e-9); // 111.01
  near(r.value.middle.short, 2 * 92.85 * t15, 1e-9); // 49.76
  near(r.value.middle.centre, 80.385, 1e-3);
  near(r.value.end.centre, 150 * t15, 1e-9);
  near(r.value.totalCentreline, 6 * 150 * t15, 1e-9); // 2W·Rc·tan β, W = 3
  near(r.value.cutDepth, 114.3 * t15, 1e-9);
});

test('2-piece mitre elbow and tangents', () => {
  const r = lobster({ od: 60.3, bendDeg: 90, pieces: 2, radius: 60.3, tangent: 50 });
  assert.ok(r.ok);
  assert.equal(r.value.middle.qty, 0);
  near(r.value.cutDeg, 45, 1e-12);
  near(r.value.end.long, (60.3 + 30.15) + 50, 1e-9);
  near(r.value.end.short, (60.3 - 30.15) + 50, 1e-9);
});

test('mitre cut-back: zero at the long side, D·tan β at the short side', () => {
  near(mitreCutBack(0, 100, 15 * DEG), 0, 1e-12);
  near(mitreCutBack(Math.PI, 100, 15 * DEG), 100 * Math.tan(15 * DEG), 1e-12);
  near(mitreCutBack(Math.PI / 2, 100, 15 * DEG), 50 * Math.tan(15 * DEG), 1e-12);
});

test('lobster rejects bad input', () => {
  assert.equal(lobster({ od: 100, bendDeg: 90, pieces: 4, radius: 40 }).ok, false); // Rc < OD/2
  assert.equal(lobster({ od: 100, bendDeg: 0, pieces: 4, radius: 150 }).ok, false);
  assert.equal(lobster({ od: 100, bendDeg: 90, pieces: 1, radius: 150 }).ok, false);
  assert.equal(lobster({ od: 100, bendDeg: 90, pieces: 2.5, radius: 150 }).ok, false);
  assert.equal(lobster({ od: 100, bendDeg: 180, pieces: 2, radius: 150 }).ok, false); // 180° at one weld
  assert.equal(lobster({ od: 100, bendDeg: 90, pieces: 3, radius: 150, tangent: -1 }).ok, false);
});

/* ---------- frames ---------- */
test('rectangular frame: short point = long point − 2 × member', () => {
  const r = rectFrame({ width: 1000, height: 500, member: 50, measured: 'outside' });
  assert.ok(r.ok);
  assert.deepEqual(r.value.pieces.map(p => [p.qty, p.longPoint, p.shortPoint]), [[2, 1000, 900], [2, 500, 400]]);
  const inside = rectFrame({ width: 900, height: 400, member: 50, measured: 'inside' });
  assert.ok(inside.ok);
  assert.equal(inside.value.pieces[0].longPoint, 1000);
  assert.equal(rectFrame({ width: 90, height: 400, member: 50, measured: 'outside' }).ok, false);
});

test('polygon frames', () => {
  const hex = polygonFrame({ sides: 6, width: 40, size: 300, sizeKind: 'outsideSide' });
  assert.ok(hex.ok);
  near(hex.value.cutDeg, 30, 1e-12);
  near(hex.value.pieces[0].shortPoint, 300 - 2 * 40 * Math.tan(30 * DEG), 1e-9); // 253.812
  const oct = polygonFrame({ sides: 8, width: 25, size: 600, sizeKind: 'outsideFlats' });
  assert.ok(oct.ok);
  near(oct.value.pieces[0].longPoint, 600 * Math.tan(22.5 * DEG), 1e-9); // 248.53
  const tri = polygonFrame({ sides: 3, width: 20, size: 400, sizeKind: 'outsideCorners' });
  assert.ok(tri.ok);
  near(tri.value.pieces[0].longPoint, 400 * Math.sin(60 * DEG), 1e-9); // side = D·sin(180/n)
  const fromInside = polygonFrame({ sides: 6, width: 40, size: hex.value.pieces[0].shortPoint, sizeKind: 'insideSide' });
  assert.ok(fromInside.ok);
  near(fromInside.value.pieces[0].longPoint, 300, 1e-9);
  assert.equal(polygonFrame({ sides: 5, width: 20, size: 400, sizeKind: 'outsideFlats' }).ok, false); // odd + flats
  assert.equal(polygonFrame({ sides: 2, width: 20, size: 400, sizeKind: 'outsideSide' }).ok, false);
  assert.equal(polygonFrame({ sides: 6, width: 400, size: 100, sizeKind: 'outsideSide' }).ok, false);
});

test('corner mitre bisects the corner', () => {
  const a = cornerMitre(90); assert.ok(a.ok); assert.equal(a.value.cutDeg, 45);
  const b = cornerMitre(120); assert.ok(b.ok); assert.equal(b.value.cutDeg, 30);
  assert.equal(cornerMitre(180).ok, false);
  assert.equal(cornerMitre(0).ok, false);
});

/* ---------- weight ---------- */
test('SHS and CHS mass match the Australian Tube Mills catalogue', () => {
  const shs = weight({ shape: 'shs', material: 'mild', dims: [50, 50, 3], length: 1000, qty: 1 });
  assert.ok(shs.ok);
  near(shs.value.perMetre, 4.25, 0.01); // ATM: 50×50×3.0 SHS 4.25 kg/m
  const chs = weight({ shape: 'chs', material: 'mild', dims: [48.3, 3.2], length: 1000, qty: 1 });
  assert.ok(chs.ok);
  near(chs.value.perMetre, 3.56, 0.01); // ATM: 48.3×3.2 CHS 3.56 kg/m
  assert.deepEqual(rhsCornerRadii(8), { ro: 20, ri: 12 });
});

test('plate, round bar, angle and aluminium', () => {
  const plate = weight({ shape: 'plate', material: 'mild', dims: [1200, 6], length: 2400, qty: 1 });
  assert.ok(plate.ok);
  near(plate.value.total, 2.4 * 1.2 * 0.006 * 7850, 1e-9); // 135.648 kg
  const bar = weight({ shape: 'round', material: 'mild', dims: [20], length: 6000, qty: 2 });
  assert.ok(bar.ok);
  near(bar.value.total, 2 * Math.PI * 0.01 ** 2 * 6 * 7850, 1e-9); // 29.60 kg
  const ang = weight({ shape: 'angle', material: 'mild', dims: [50, 50, 6], length: 1000, qty: 1 });
  assert.ok(ang.ok);
  near(ang.value.perMetre, 564e-6 * 7850, 1e-9); // 4.43; table 4.47 (radii ignored, warned)
  assert.equal(ang.warnings.length, 1);
  const al = weight({ shape: 'flat', material: 'al6061', dims: [50, 5], length: 1000, qty: 1, pricePerKg: 10 });
  assert.ok(al.ok);
  near(al.value.total, 0.675, 1e-9);
  near(al.value.cost!, 6.75, 1e-9);
});

test('weight rejects bad sections', () => {
  assert.equal(weight({ shape: 'chs', material: 'mild', dims: [50, 25], length: 1000, qty: 1 }).ok, false);
  assert.equal(weight({ shape: 'shs', material: 'mild', dims: [20, 20, 6], length: 1000, qty: 1 }).ok, false);
  assert.equal(weight({ shape: 'flat', material: 'mild', dims: [50, 0], length: 1000, qty: 1 }).ok, false);
  assert.equal(weight({ shape: 'flat', material: 'mild', dims: [50, 5], length: 1000, qty: 0 }).ok, false);
  assert.equal(weight({ shape: 'flat', material: 'mild', dims: [50, 5], length: -1, qty: 1 }).ok, false);
});

/* ---------- weld ---------- */
test('6 mm fillet, 1 m, MIG', () => {
  const r = weldFiller({ joint: { kind: 'fillet', legA: 6, legB: 6 }, length: 1000, reinforcementPct: 0, process: 'gmaw' });
  assert.ok(r.ok);
  near(r.value.area, 18, 1e-12);
  near(r.value.depositedKg, 18e-6 * 1 * 7850, 1e-12); // 0.1413 kg
  near(r.value.fillerKg, 0.1413 / 0.95, 1e-9);
  assert.equal(r.value.packs, 1);
});

test('V-butt joint areas', () => {
  const sv = jointArea({ kind: 'singleV', thickness: 10, gap: 2, rootFace: 2, includedDeg: 60 });
  assert.ok(sv.ok);
  near(sv.value.area, 20 + 64 * Math.tan(30 * DEG), 1e-9); // 56.95
  const dv = jointArea({ kind: 'doubleV', thickness: 20, gap: 2, rootFace: 2, includedDeg: 60 });
  assert.ok(dv.ok);
  near(dv.value.area, 40 + (324 * Math.tan(30 * DEG)) / 2, 1e-9); // 133.53
  const sq = jointArea({ kind: 'squareButt', thickness: 3, gap: 1.5 });
  assert.ok(sq.ok);
  near(sq.value.area, 4.5, 1e-12);
});

test('stick welding needs more rods; bad input rejected', () => {
  const r = weldFiller({ joint: { kind: 'fillet', legA: 8, legB: 8 }, length: 20000, reinforcementPct: 10, process: 'mmaw' });
  assert.ok(r.ok);
  near(r.value.fillerKg, (32 * 1.1 * 20000e-9 * 7850) / 0.6, 1e-9); // 9.21 kg
  assert.equal(r.value.packs, 2);
  assert.equal(weldFiller({ joint: { kind: 'squareButt', thickness: 3, gap: 0 }, length: 100, reinforcementPct: 0, process: 'gmaw' }).ok, false);
  assert.equal(weldFiller({ joint: { kind: 'singleV', thickness: 10, gap: 2, rootFace: 10, includedDeg: 60 }, length: 100, reinforcementPct: 0, process: 'gmaw' }).ok, false);
  assert.equal(weldFiller({ joint: { kind: 'fillet', legA: 6, legB: 6 }, length: 100, reinforcementPct: 0, process: 'gmaw', efficiency: 0 }).ok, false);
  assert.equal(weldFiller({ joint: { kind: 'fillet', legA: 6, legB: 6 }, length: 0, reinforcementPct: 0, process: 'gmaw' }).ok, false);
});

/* ---------- bend ---------- */
test('90° bend, 2 mm sheet, 2 mm radius, K 0.4', () => {
  const r = bend({ thickness: 2, radius: 2, angleDeg: 90, k: 0.4, flanges: [50, 50] });
  assert.ok(r.ok);
  near(r.value.ba, (Math.PI / 2) * 2.8, 1e-12); // 4.398
  near(r.value.ossb, 4, 1e-12);
  near(r.value.bd, 8 - (Math.PI / 2) * 2.8, 1e-12); // 3.602
  near(r.value.flat!, 100 - 3.6018, 1e-3);
  assert.equal(defaultK(1, 2), 0.33);
  assert.equal(defaultK(4, 2), 0.4);
  assert.equal(defaultK(10, 2), 0.5);
});

test('bend rejects bad input', () => {
  assert.equal(bend({ thickness: 0, radius: 2, angleDeg: 90, k: 0.4 }).ok, false);
  assert.equal(bend({ thickness: 2, radius: -1, angleDeg: 90, k: 0.4 }).ok, false);
  assert.equal(bend({ thickness: 2, radius: 2, angleDeg: 200, k: 0.4 }).ok, false);
  assert.equal(bend({ thickness: 2, radius: 2, angleDeg: 90, k: 0.7 }).ok, false);
  assert.equal(bend({ thickness: 2, radius: 2, angleDeg: 90, k: 0.4, flanges: [50] }).ok, false);
  assert.equal(bend({ thickness: 2, radius: 2, angleDeg: 90, k: 0.4, flanges: [3, 50] }).ok, false); // under setback
});

/* ---------- cut list ---------- */
test('kerf is counted: three 2000 mm parts do not fit a 6000 mm length', () => {
  const r = cutList({ stock: 6000, kerf: 3, trim: 0, parts: [{ length: 2000, qty: 6 }] });
  assert.ok(r.ok);
  assert.equal(r.value.bars.length, 3);
  const noKerf = cutList({ stock: 6000, kerf: 0, trim: 0, parts: [{ length: 2000, qty: 6 }] });
  assert.ok(noKerf.ok);
  assert.equal(noKerf.value.bars.length, 2);
  assert.equal(noKerf.value.bars[0].offcut, 0);
});

test('beats First Fit Decreasing on a known case (FFD 4 lengths, best 3)', () => {
  const parts = [470, 440, 400, 400, 350, 340, 230, 210].map(length => ({ length, qty: 1 }));
  const r = cutList({ stock: 1000, kerf: 0, trim: 0, parts });
  assert.ok(r.ok);
  assert.equal(r.value.bars.length, 3);
  assert.equal(r.value.optimal, true);
  for (const b of r.value.bars) assert.ok(b.used <= 1000);
  assert.equal(r.value.bars.flatMap(b => b.cuts).length, 8);
});

test('every plan respects stock, kerf and trim', () => {
  const r = cutList({ stock: 6500, kerf: 2.5, trim: 10, parts: [{ length: 1234, qty: 7 }, { length: 875, qty: 9 }, { length: 432, qty: 5 }, { length: 2600, qty: 3 }] });
  assert.ok(r.ok);
  for (const b of r.value.bars) {
    const used = b.cuts.reduce((s, c) => s + c.length, 0) + 2.5 * (b.cuts.length - 1);
    near(b.used, used, 1e-9);
    assert.ok(used <= 6490 + 1e-9);
    assert.ok(b.offcut >= 0);
  }
  assert.equal(r.value.pieces, 24);
  assert.ok(r.value.bars.length >= r.value.lowerBound);
});

test('cut list rejects bad input', () => {
  assert.equal(cutList({ stock: 6000, kerf: 3, trim: 0, parts: [] }).ok, false);
  assert.equal(cutList({ stock: 6000, kerf: 3, trim: 0, parts: [{ length: 6100, qty: 1 }] }).ok, false);
  assert.equal(cutList({ stock: 6000, kerf: 3, trim: 10, parts: [{ length: 5995, qty: 1 }] }).ok, false); // trim leaves 5990
  assert.equal(cutList({ stock: 6000, kerf: 3, trim: 0, parts: [{ length: 100, qty: 1.5 }] }).ok, false);
  assert.equal(cutList({ stock: 6000, kerf: -1, trim: 0, parts: [{ length: 100, qty: 1 }] }).ok, false);
});

/* ---------- PCD ---------- */
test('4 holes straddling on 100 PCD', () => {
  const r = pcd({ pcd: 100, holes: 4, layout: 'straddle' });
  assert.ok(r.ok);
  near(r.value.holes[0].x, 50 * Math.SQRT1_2, 1e-9); // 35.355
  near(r.value.holes[0].y, 50 * Math.SQRT1_2, 1e-9);
  near(r.value.holes[2].x, -50 * Math.SQRT1_2, 1e-9);
  near(r.value.chord, 100 * Math.SQRT1_2, 1e-9); // 70.711
});

test('6 holes on centre, every hole on the circle, equal chords', () => {
  const r = pcd({ pcd: 150, holes: 6, layout: 'onCentre', holeDia: 18 });
  assert.ok(r.ok);
  assert.deepEqual([r.value.holes[0].x, r.value.holes[0].y], [0, 75]);
  near(r.value.chord, 75, 1e-9); // hexagon: chord = radius
  for (const h of r.value.holes) near(Math.hypot(h.x, h.y), 75, 1e-9);
  for (let k = 0; k < 6; k++) {
    const a = r.value.holes[k], b = r.value.holes[(k + 1) % 6];
    near(Math.hypot(a.x - b.x, a.y - b.y), r.value.chord, 1e-9);
  }
  assert.equal(r.value.holes[1].x > 0, true); // clockwise from 12 o'clock
  assert.equal(pcd({ pcd: 100, holes: 1, layout: 'onCentre' }).ok, false);
  assert.equal(pcd({ pcd: 0, holes: 4, layout: 'onCentre' }).ok, false);
  const clash = pcd({ pcd: 40, holes: 12, layout: 'onCentre', holeDia: 12 });
  assert.ok(clash.ok);
  assert.equal(clash.warnings.length, 1); // chord 10.4 < 12
});

test('bend drawing: pieces share weld corners and the outside corners sit at (Rc + r)/cos β', () => {
  const polys = bendOutline(100, 150, 90, 4);
  assert.equal(polys.length, 4);
  for (let k = 0; k < 3; k++) {
    assert.deepEqual(polys[k][2], polys[k + 1][1]); // outer corner shared
    assert.deepEqual(polys[k][3], polys[k + 1][0]); // inner corner shared
    near(Math.hypot(...polys[k][2]), 200 / Math.cos(15 * DEG), 1e-9);
  }
  near(polys[3][2][0], 0, 1e-9); // square end at 90°
  near(polys[3][2][1], 200, 1e-9);
});
