/** Worked examples for the geometry calculators. Every expected number is worked by hand in the comment beside it. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editableLength, formatArea, formatLength, parseAmount, parseLength } from './units.ts';
import { calcTiles } from './tiles.ts';
import { bestCentred, calcSetout, planAxis } from './setout.ts';
import { calcFalls, parseGradient } from './falls.ts';
import { calcTrim } from './trim.ts';
import { calcStairs } from './stairs.ts';

const close = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('parseAmount reads decimals and fractions', () => {
  assert.equal(parseAmount('3/16'), 0.1875);
  assert.equal(parseAmount('1 1/2'), 1.5);
  assert.equal(parseAmount('2.5'), 2.5);
  assert.equal(parseAmount('1/0'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('1.5 1/2'), null);
  assert.equal(parseAmount(''), null);
});

test('parseLength: metric defaults to mm, accepts m and cm', () => {
  assert.equal(parseLength('2400', 'room', 'metric'), 2400);
  assert.equal(parseLength('2.4m', 'room', 'metric'), 2400);
  assert.equal(parseLength('240 cm', 'room', 'metric'), 2400);
  assert.equal(parseLength('3', 'joint', 'metric'), 3);
  assert.equal(parseLength('1,200', 'room', 'metric'), 1200);
  assert.equal(parseLength('-5', 'room', 'metric'), null);
  assert.equal(parseLength('0', 'room', 'metric'), null);
  assert.equal(parseLength('0', 'joint', 'metric', true), 0);
  assert.equal(parseLength('twelve', 'room', 'metric'), null);
});

test('parseLength: imperial feet-inches and fractions', () => {
  close(parseLength("12' 6\"", 'room', 'imperial')!, 12 * 304.8 + 6 * 25.4); // 3810 mm
  close(parseLength("12'6", 'room', 'imperial')!, 3810);
  close(parseLength('12ft 6in', 'room', 'imperial')!, 3810);
  close(parseLength('150"', 'room', 'imperial')!, 3810);
  close(parseLength('10', 'room', 'imperial')!, 3048); // plain number = feet for rooms
  close(parseLength('12', 'tile', 'imperial')!, 304.8); // plain number = inches for tiles
  close(parseLength('3/16', 'joint', 'imperial')!, 4.7625);
  close(parseLength('600mm', 'tile', 'imperial')!, 600); // a metric tile size typed in a US job still works
});

test('format lengths and areas', () => {
  assert.equal(formatLength(2400, 'metric'), '2,400 mm');
  assert.equal(formatLength(3810, 'imperial'), '12′ 6″');
  assert.equal(formatLength(4.7625, 'imperial', 'joint'), '3/16″');
  assert.equal(formatLength(304.8, 'imperial', 'tile'), '12″');
  assert.equal(formatArea(1, 'metric'), '1.00 m²');
  assert.equal(formatArea(0.09290304 * 100, 'imperial'), '100.0 sq ft');
  assert.equal(editableLength(3810, 'imperial', 'room'), `12' 6"`);
  assert.equal(editableLength(4.7625, 'imperial', 'joint'), '3/16');
});

test('tile count: 3.0 × 2.8 m floor, 600 × 600 with 3 mm joints, straight lay', () => {
  // Net 8.40 m². Per tile (0.603)² = 0.363609 m². 8.40 / 0.363609 = 23.10 tiles. +10% = 25.41 -> 26 tiles.
  // Box of 4: 26 / 4 = 6.5 -> 7 boxes.
  const r = calcTiles({ rects: [{ widthMm: 3000, heightMm: 2800 }], tileLengthMm: 600, tileWidthMm: 600, jointMm: 3, layout: 'straight', perBox: 4, system: 'metric' });
  assert.ok(r.ok);
  close(r.value.netM2, 8.4);
  close(r.value.tileM2, 0.363609);
  close(r.value.tilesNoWaste, 23.1018, 1e-3);
  assert.equal(r.value.tiles, 26);
  assert.equal(r.value.boxes, 7);
  assert.ok(r.steps.length >= 4);
});

test('tile count: wall with a window and a door cut out, herringbone, box by m²', () => {
  // 4.0 × 2.7 = 10.8 m², window 1.2 × 0.9 = 1.08, door 0.82 × 2.04 = 1.6728 -> net 8.0472 m².
  // 300 × 75 + 2 mm: 0.302 × 0.077 = 0.023254 m² -> 346.06 tiles; +20% = 415.27 -> 416.
  // Order area 8.0472 × 1.2 = 9.65664 m²; boxes of 0.81 m²: 11.92 -> 12.
  const r = calcTiles({
    rects: [{ widthMm: 4000, heightMm: 2700 }, { widthMm: 1200, heightMm: 900, subtract: true }, { widthMm: 820, heightMm: 2040, subtract: true }],
    tileLengthMm: 300, tileWidthMm: 75, jointMm: 2, layout: 'herringbone', boxM2: 0.81, system: 'metric',
  });
  assert.ok(r.ok);
  close(r.value.netM2, 8.0472);
  assert.equal(r.value.tiles, 416);
  assert.equal(r.value.boxes, 12);
});

test('tile count: imperial 12 × 10 ft room, 12 × 24 in tile, 1/8 in joint, third offset', () => {
  // 120 sq ft = 11.1484 m². Tile (12.125 × 24.125 in) = 292.516 sq in = 2.03136 sq ft.
  // 120 / 2.03136 = 59.07; +12% (third offset) = 66.16 -> 67 tiles.
  const r = calcTiles({ rects: [{ widthMm: 12 * 304.8, heightMm: 10 * 304.8 }], tileLengthMm: 24 * 25.4, tileWidthMm: 12 * 25.4, jointMm: 25.4 / 8, layout: 'third', system: 'imperial' });
  assert.ok(r.ok);
  assert.equal(r.value.tiles, 67);
  assert.ok(r.notes.some(n => /lippage|batch/i.test(n)));
});

test('tile count: waste override, zero joint, exact fit still rounds correctly', () => {
  // 1.2 × 1.2 m, 300 × 300, 0 joint, 0% waste = exactly 16 tiles (no float creep to 17).
  const r = calcTiles({ rects: [{ widthMm: 1200, heightMm: 1200 }], tileLengthMm: 300, tileWidthMm: 300, jointMm: 0, layout: 'straight', wastePct: 0, system: 'metric' });
  assert.ok(r.ok);
  assert.equal(r.value.tiles, 16);
});

test('tile count rejects bad input', () => {
  const base = { tileLengthMm: 300, tileWidthMm: 300, jointMm: 2, layout: 'straight' as const, system: 'metric' as const };
  assert.equal(calcTiles({ ...base, rects: [] }).ok, false);
  assert.equal(calcTiles({ ...base, rects: [{ widthMm: 1000, heightMm: 1000 }, { widthMm: 1000, heightMm: 1000, subtract: true }] }).ok, false);
  assert.equal(calcTiles({ ...base, rects: [{ widthMm: 1000, heightMm: 0 }] }).ok, false);
  assert.equal(calcTiles({ ...base, rects: [{ widthMm: 1000, heightMm: 1000 }], tileLengthMm: 0 }).ok, false);
  assert.equal(calcTiles({ ...base, rects: [{ widthMm: 1000, heightMm: 1000 }], jointMm: -1 }).ok, false);
  assert.equal(calcTiles({ ...base, rects: [{ widthMm: 1000, heightMm: 1000 }], wastePct: 150 }).ok, false);
  assert.equal(calcTiles({ ...base, rects: [{ widthMm: 1000, heightMm: 1000 }], perBox: 2.5 }).ok, false);
});

test('set-out: 3000 mm, 600 tile, 3 mm joint, no gap', () => {
  // Module 603. Joint on centre: 1500 = 2×603 + 294 -> cut 294 − 1.5 = 292.5 each side, 4 full.
  const a = planAxis(3000, 600, 3, 0, 'joint');
  assert.equal(a.full, 4);
  close(a.cutStart, 292.5);
  // Tile on centre: 1500 − 301.5 = 1198.5 = 1×603 + 595.5 -> cut 594 each side, 3 full.
  const b = planAxis(3000, 600, 3, 0, 'tile');
  assert.equal(b.full, 3);
  close(b.cutStart, 594);
  // The pieces add back up to the span: 594 + 3 + 3×603 + 594 = 3000.
  const last = b.pieces[b.pieces.length - 1];
  close(last[1], 3000);
  assert.equal(bestCentred(3000, 600, 3, 0).mode, 'tile');
});

test('set-out: from a wall leaves the whole cut at the far wall', () => {
  // 2000 mm, 300 tile, 2 joint, 5 mm gap: usable 1990, n = ⌊(1990 + 2) / 302⌋ = 6, cut = 1990 − 6×302 = 178.
  const p = planAxis(2000, 300, 2, 5, 'wall');
  assert.equal(p.full, 6);
  close(p.cutEnd, 178);
  assert.equal(p.cutStart, 0);
});

test('set-out: exact fit gives no cut pieces', () => {
  // 1806 mm with 600 + 3: tile on centre: 903 − 301.5 = 601.5 = 0×603 + 601.5 -> cut 600 = a full tile -> 3 full, no cuts.
  const p = planAxis(1806, 600, 3, 0, 'tile');
  assert.equal(p.cutStart, 0);
  assert.equal(p.full, 3);
  assert.equal(p.pieces.length, 3);
});

test('set-out: area narrower than one tile', () => {
  const p = planAxis(450, 600, 3, 0, 'joint');
  assert.equal(p.full, 0);
  close(p.cutStart, 450);
});

test('set-out: grid count and sliver warning', () => {
  const r = calcSetout({ lengthMm: 3000, widthMm: 2400, tileLengthMm: 600, tileWidthMm: 600, jointMm: 3, gapMm: 0, modeX: null, modeY: null, system: 'metric' });
  assert.ok(r.ok);
  // Width 2400: joint mode 1200 = 1×603 + 597 -> cut 595.5 (2 full + 2 cuts); tile mode: 1200 − 301.5 = 898.5 = 1×603 + 295.5 -> cut 294 (3 full + 2 cuts). Joint wins.
  assert.equal(r.value.y.mode, 'joint');
  close(r.value.y.cutStart, 595.5);
  // Grid: 5 × 4 pieces = 20 tiles, 3 × 2 = 6 full.
  assert.equal(r.value.tilesNeeded, 20);
  assert.equal(r.value.fullTiles, 6);
  const sliver = calcSetout({ lengthMm: 1220, widthMm: 1220, tileLengthMm: 600, tileWidthMm: 600, jointMm: 3, gapMm: 0, modeX: 'wall', modeY: 'wall', system: 'metric' });
  assert.ok(sliver.ok);
  assert.ok(sliver.value.smallestCut < 25);
  assert.ok(sliver.notes.some(n => /sliver/.test(n)));
  assert.equal(calcSetout({ lengthMm: 0, widthMm: 100, tileLengthMm: 600, tileWidthMm: 600, jointMm: 3, gapMm: 0, modeX: null, modeY: null, system: 'metric' }).ok, false);
});

test('gradients parse in every common form', () => {
  assert.equal(parseGradient('1:60'), 60);
  assert.equal(parseGradient('1/80'), 80);
  assert.equal(parseGradient('100'), 100);
  close(parseGradient('2%')!, 50);
  assert.equal(parseGradient('1/4 in/ft'), 48);
  assert.equal(parseGradient('1/4" per ft'), 48);
  assert.equal(parseGradient('1/2 in per foot'), 24);
  assert.equal(parseGradient('0%'), null);
  assert.equal(parseGradient('abc'), null);
});

test('falls: 1200 × 900 shower, centre waste, 1:60, plane basis (default)', () => {
  // Plane run to the furthest wall = 600. Rise 600 / 60 = 10 mm. Steepest plane 450 / 10 = 1:45. Valley 750 / 10 = 1:75.
  const r = calcFalls({ drain: 'point', lengthMm: 1200, widthMm: 900, minRatio: 60, maxRatio: 40, thicknessAtWasteMm: 20, system: 'metric' });
  assert.ok(r.ok);
  close(r.value.longestRun, 600);
  close(r.value.rise, 10);
  close(r.value.steepestRatio, 45);
  close(r.value.valleyRatio!, 75);
  close(r.value.perimeterThickness!, 30);
  assert.equal(r.value.tooSteep, false);
});

test('falls: 1200 × 900 shower, centre waste, 1:60, valley basis', () => {
  // Corner run √(600² + 450²) = 750. Rise 750 / 60 = 12.5 mm. Shortest run 450 -> 450 / 12.5 = 1:36.
  const r = calcFalls({ drain: 'point', basis: 'valley', lengthMm: 1200, widthMm: 900, minRatio: 60, maxRatio: 40, thicknessAtWasteMm: 20, system: 'metric' });
  assert.ok(r.ok);
  close(r.value.longestRun, 750);
  close(r.value.rise, 12.5);
  close(r.value.steepestRatio, 36);
  close(r.value.perimeterThickness!, 32.5);
  assert.equal(r.value.tooSteep, true);
});

test('falls: linear waste along a wall, imperial 1/4 in per ft', () => {
  // 60 in run at 1:48 = 1.25 in.
  const r = calcFalls({ drain: 'linear', lengthMm: 60 * 25.4, widthMm: 36 * 25.4, minRatio: 48, system: 'imperial' });
  assert.ok(r.ok);
  close(r.value.rise, 1.25 * 25.4);
  assert.equal(r.value.tooSteep, false);
});

test('falls: off-centre waste and bad input', () => {
  // Waste 300 from left, 450 from back in 1200 × 900: furthest corner (1200, 0 or 900): √(900² + 450²) = 1006.23.
  const r = calcFalls({ drain: 'point', basis: 'valley', lengthMm: 1200, widthMm: 900, drainXMm: 300, drainYMm: 450, minRatio: 80, system: 'metric' });
  assert.ok(r.ok);
  close(r.value.longestRun, Math.hypot(900, 450));
  const plane = calcFalls({ drain: 'point', lengthMm: 1200, widthMm: 900, drainXMm: 300, drainYMm: 450, minRatio: 80, system: 'metric' });
  assert.ok(plane.ok);
  close(plane.value.longestRun, 900); // furthest wall is 900 away on the right
  assert.equal(calcFalls({ drain: 'point', lengthMm: 1200, widthMm: 900, drainXMm: 1300, minRatio: 60, system: 'metric' }).ok, false);
  assert.equal(calcFalls({ drain: 'point', lengthMm: 1200, widthMm: 900, minRatio: 0, system: 'metric' }).ok, false);
  assert.equal(calcFalls({ drain: 'point', lengthMm: 1200, widthMm: 900, minRatio: 60, maxRatio: 80, system: 'metric' }).ok, false);
});

test('trim: cut list reuses offcuts and handles runs longer than a length', () => {
  // Runs 3000, 1200, 1200, 800 from 2500 stock: 3000 = 1 full + 500.
  // Pieces sorted 1200, 1200, 800, 500 -> bar A: 1200 + 1200 (100 left), bar B: 800 + 500 (1200 left). Total bars 1 + 2 = 3.
  const r = calcTrim({ runsMm: [3000, 1200, 1200, 800], stockMm: 2500, allowanceMm: 0, system: 'metric' });
  assert.ok(r.ok);
  assert.equal(r.value.lengths, 3);
  assert.equal(r.value.naive, 3); // 6200 / 2500 = 2.48 -> 3
  close(r.value.offcut, 1300);
});

test('trim: offcuts that are too short need extra lengths', () => {
  // Four 1300 runs from 2500: each bar holds one 1300 only -> 4 lengths, straight division says 3 (5200 / 2500 = 2.08).
  const r = calcTrim({ runsMm: [1300, 1300, 1300, 1300], stockMm: 2500, allowanceMm: 0, system: 'metric' });
  assert.ok(r.ok);
  assert.equal(r.value.lengths, 4);
  assert.equal(r.value.naive, 3);
  assert.equal(calcTrim({ runsMm: [], stockMm: 2500, allowanceMm: 0, system: 'metric' }).ok, false);
  assert.equal(calcTrim({ runsMm: [100], stockMm: 0, allowanceMm: 0, system: 'metric' }).ok, false);
});

test('stairs: 12 treads, 1000 wide, 250 going, 180 riser, 300 × 300 tile', () => {
  // Tread: ⌈1000 / 303⌉ = 4 × ⌈250 / 303⌉ = 1 -> 4. Riser: 4 × ⌈180 / 303⌉ = 4. Flight 12 × 8 = 96.
  // Nosing: 12 × 1000 from 2400 -> two per length -> 6 lengths.
  // Build-up 12 mm, landing not tiled, floor at foot not raised: bottom 192, top 168.
  const r = calcStairs({
    steps: 12, widthMm: 1000, goingMm: 250, riserMm: 180, tileRisers: true, tileLengthMm: 300, tileWidthMm: 300, jointMm: 3,
    buildUpMm: 12, floorRaisedAtFoot: false, landingTiled: false, nosingStockMm: 2400,
    limits: { riserMin: 115, riserMax: 190, goingMin: 240, goingMax: 355, twoRGMin: 550, twoRGMax: 700, source: 'test' }, system: 'metric',
  });
  assert.ok(r.ok);
  assert.equal(r.value.tiles, 96);
  assert.equal(r.value.nosingLengths, 6);
  assert.equal(r.value.bottomRiser, 192);
  assert.equal(r.value.topRiser, 168);
  assert.ok(r.value.issues.some(i => /Bottom riser/.test(i)));
  assert.ok(r.value.issues.some(i => /consistent/.test(i)));
});

test('stairs: rejects fractional treads', () => {
  const r = calcStairs({ steps: 2.5, widthMm: 1000, goingMm: 250, riserMm: 180, tileRisers: false, tileLengthMm: 300, tileWidthMm: 300, jointMm: 3, buildUpMm: 12, floorRaisedAtFoot: true, landingTiled: true, nosingStockMm: 2400, limits: null, system: 'metric' });
  assert.equal(r.ok, false);
});
