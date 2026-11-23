import { makeCtx } from './context';
import { downpipes, gradientFromFall, gutterFall } from './drainage';
import { cappingTiles, trimRuns, trims } from './flashing';
import { sheetFixings, perPieceFixings } from './fixings';
import { hipValley, pitchFromRiseRun, rafter, roofGeometry } from './geometry';
import { sheets, stockPieces } from './sheets';
import { battenGauge, slateGauge, tiles } from './tiles';
import {
  degFromX12, feetInches, formatPitch, parseLength, parsePitch, percentFromDeg, pitchFactor, riseOver12,
} from './units';

const m = makeCtx('metric', 'deg');
const us = makeCtx('imperial', 'x12');
const ok = <T,>(r: { ok: boolean } & ({ ok: true; value: T } | { ok: false; error: string })): T => {
  if (!r.ok) throw new Error('expected ok: ' + (r as { error: string }).error);
  return (r as { value: T }).value;
};

describe('units', () => {
  test('pitch conversions (worked: 6:12 = 26.565°, 50%)', () => {
    expect(degFromX12(6)).toBeCloseTo(26.5651, 4);
    expect(riseOver12(26.5651)).toBeCloseTo(6, 3);
    expect(percentFromDeg(45)).toBeCloseTo(100, 6);
    expect(pitchFactor(22.5)).toBeCloseTo(1.0824, 4);
    expect(formatPitch(degFromX12(4), 'x12')).toBe('4:12');
  });
  test('parsePitch accepts degrees, x:12, x/12 and percent; rejects junk and >75°', () => {
    expect(parsePitch('22.5', 'deg')).toBe(22.5);
    expect(parsePitch('22.5°', 'deg')).toBe(22.5);
    expect(parsePitch('6:12', 'deg')).toBeCloseTo(26.565, 3);
    expect(parsePitch('6/12', 'x12')).toBeCloseTo(26.565, 3);
    expect(parsePitch('6', 'x12')).toBeCloseTo(26.565, 3);
    expect(parsePitch('25%', 'deg')).toBeCloseTo(14.036, 3);
    expect(parsePitch('', 'deg')).toBeNull();
    expect(parsePitch('abc', 'deg')).toBeNull();
    expect(parsePitch('80', 'deg')).toBeNull();
    expect(parsePitch('-5', 'deg')).toBeNull();
  });
  test('parseLength metric and imperial', () => {
    expect(parseLength('4215', 'metric', 'mm')).toBe(4215);
    expect(parseLength('4.215 m', 'metric', 'mm')).toBe(4215);
    expect(parseLength('4.2', 'metric', 'm')).toBeCloseTo(4200, 6);
    expect(parseLength('42cm', 'metric', 'mm')).toBe(420);
    expect(parseLength(`12' 6"`, 'imperial', 'ft')).toBeCloseTo(3810, 6);
    expect(parseLength('12ft 6in', 'imperial', 'ft')).toBeCloseTo(3810, 6);
    expect(parseLength('12 6', 'imperial', 'ft')).toBeCloseTo(3810, 6);
    expect(parseLength('150"', 'imperial', 'ft')).toBeCloseTo(3810, 6);
    expect(parseLength(`6 1/2"`, 'imperial', 'in')).toBeCloseTo(165.1, 6);
    expect(parseLength('12.5', 'imperial', 'ft')).toBeCloseTo(3810, 6);
    expect(parseLength('', 'metric', 'mm')).toBeNull();
    expect(parseLength('-3', 'metric', 'mm')).toBeNull();
    expect(parseLength('abc', 'imperial', 'ft')).toBeNull();
  });
  test('feet and inches to the nearest 1/8', () => {
    expect(feetInches(3810)).toBe('12′ 6″');
    expect(feetInches(165.1)).toBe('6 1/2″');
    expect(feetInches(304.8 * 10 + 25.4 * 3.375)).toBe('10′ 3 3/8″');
  });
});

describe('geometry', () => {
  test('gable 10 m × 8 m at 22.5° (worked example)', () => {
    const g = ok(roofGeometry({ type: 'gable', lengthMm: 10000, widthMm: 8000, pitchDeg: 22.5 }, m));
    expect(g.runMm).toBe(4000);
    expect(g.riseMm).toBeCloseTo(1656.85, 1); // 4000 × tan 22.5°
    expect(g.rafterMm).toBeCloseTo(4329.57, 1); // 4000 ÷ cos 22.5°
    expect(g.planAreaM2).toBe(80);
    expect(g.roofAreaM2).toBeCloseTo(86.59, 2);
    expect(g.ridgeMm).toBe(10000);
    expect(g.bargeCount).toBe(4);
    expect(g.eavesMm).toBe(20000);
  });
  test('hip 12 × 8 at 25°: ridge 4 m, hips √(2·run²+rise²)', () => {
    const g = ok(roofGeometry({ type: 'hip', lengthMm: 12000, widthMm: 8000, pitchDeg: 25 }, m));
    const rise = 4000 * Math.tan((25 * Math.PI) / 180);
    expect(g.ridgeMm).toBe(4000);
    expect(g.hipEachMm).toBeCloseTo(Math.sqrt(2 * 4000 ** 2 + rise ** 2), 6);
    expect(g.hipCount).toBe(4);
    expect(g.eavesMm).toBe(40000);
    expect(g.roofAreaM2).toBeCloseTo(96 / Math.cos((25 * Math.PI) / 180), 6);
    expect(g.hipPitchDeg).toBeCloseTo((Math.atan(rise / (4000 * Math.SQRT2)) * 180) / Math.PI, 6);
  });
  test('hip with width > length is swapped; square hip is a pyramid', () => {
    const g = ok(roofGeometry({ type: 'hip', lengthMm: 8000, widthMm: 12000, pitchDeg: 25 }, m));
    expect(g.swapped).toBe(true);
    expect(g.ridgeMm).toBe(4000);
    const p = ok(roofGeometry({ type: 'hip', lengthMm: 8000, widthMm: 8000, pitchDeg: 25 }, m));
    expect(p.ridgeMm).toBe(0);
    expect(p.planes.every(x => x.shape === 'tri')).toBe(true);
  });
  test('skillion 6 × 4 at 5°', () => {
    const g = ok(roofGeometry({ type: 'skillion', lengthMm: 6000, widthMm: 4000, pitchDeg: 5 }, m));
    expect(g.runMm).toBe(4000);
    expect(g.rafterMm).toBeCloseTo(4015.28, 1);
    expect(g.topEdgeMm).toBe(6000);
    expect(g.bargeCount).toBe(2);
    expect(g.eavesMm).toBe(6000);
  });
  test('invalid input', () => {
    expect(roofGeometry({ type: 'gable', lengthMm: 0, widthMm: 8000, pitchDeg: 20 }, m).ok).toBe(false);
    expect(roofGeometry({ type: 'gable', lengthMm: 1000, widthMm: 8000, pitchDeg: 0 }, m).ok).toBe(false);
    expect(roofGeometry({ type: 'gable', lengthMm: 1000, widthMm: 8000, pitchDeg: 80 }, m).ok).toBe(false);
    expect(roofGeometry({ type: 'gable', lengthMm: NaN, widthMm: 8000, pitchDeg: 20 }, m).ok).toBe(false);
  });
  test('rafter with overhang', () => {
    const r = ok(rafter({ runMm: 3000, pitchDeg: 30, overhangMm: 450 }, m));
    expect(r.rafterMm).toBeCloseTo(3464.1, 1);
    expect(r.totalMm).toBeCloseTo(3464.1 + 519.6, 1);
    expect(rafter({ runMm: 3000, pitchDeg: 30, overhangMm: -1 }, m).ok).toBe(false);
  });
  test('hip/valley equal and unequal pitch', () => {
    const h = ok(hipValley({ runMm: 4000, pitchDeg: 45 }, m));
    expect(h.hipMm).toBeCloseTo(Math.sqrt(3) * 4000, 3);
    expect(h.planAngleDeg).toBeCloseTo(45, 6);
    const u = ok(hipValley({ runMm: 4000, pitchDeg: 30, pitch2Deg: 45 }, m));
    const rise = 4000 * Math.tan(Math.PI / 6);
    expect(u.run2Mm).toBeCloseTo(rise, 6);
    expect(u.hipMm).toBeCloseTo(Math.sqrt(4000 ** 2 + rise ** 2 + rise ** 2), 6);
  });
  test('pitch from rise and run (imperial 6 in 12)', () => {
    expect(ok(pitchFromRiseRun({ riseMm: 152.4, runMm: 304.8 }, us)).deg).toBeCloseTo(26.565, 3);
    expect(pitchFromRiseRun({ riseMm: 10, runMm: 0 }, us).ok).toBe(false);
    expect(pitchFromRiseRun({ riseMm: 10000, runMm: 100 }, us).ok).toBe(false);
  });
});

describe('sheets', () => {
  const gable = ok(roofGeometry({ type: 'gable', lengthMm: 10000, widthMm: 8000, pitchDeg: 22.5 }, m));
  test('gable: ⌈10000/762⌉ = 14 per side, 28 sheets of rafter + 50 mm', () => {
    const s = ok(sheets({ planes: gable.planes, pitchDeg: 22.5, coverWidthMm: 762, overhangMm: 50, ridgeAllowanceMm: 0, maxSheetMm: 12000, endLapMm: 200 }, m));
    expect(s.sheets).toBe(28);
    expect(s.cutList).toEqual([{ lengthMm: 4380, qty: 28 }]); // 4329.6 + 50 → 4380 rounded up to 10 mm
    expect(s.splitRuns).toBe(0);
  });
  test('long run split with end lap', () => {
    const g = ok(roofGeometry({ type: 'skillion', lengthMm: 1524, widthMm: 15000, pitchDeg: 5 }, m));
    const s = ok(sheets({ planes: g.planes, pitchDeg: 5, coverWidthMm: 762, overhangMm: 50, ridgeAllowanceMm: 0, maxSheetMm: 8000, endLapMm: 200 }, m));
    // run 15057.3 + 50 = 15107.3 → k = ⌈(15107.3 − 200)/(7800)⌉ = 2
    expect(s.sheets).toBe(4);
    expect(s.splitRuns).toBe(2);
    expect(s.cutList[0]!.lengthMm).toBe(7660);
  });
  test('hip roof sheets shorten toward the hips', () => {
    const g = ok(roofGeometry({ type: 'hip', lengthMm: 12000, widthMm: 8000, pitchDeg: 25 }, m));
    const s = ok(sheets({ planes: g.planes, pitchDeg: 25, coverWidthMm: 762, overhangMm: 50, ridgeAllowanceMm: 0, maxSheetMm: 12000, endLapMm: 200 }, m));
    expect(s.hipCut).toBe(true);
    const lengths = s.cutList.map(c => c.lengthMm);
    expect(Math.max(...lengths)).toBe(Math.ceil((g.rafterMm + 50) / 10) * 10);
    expect(Math.min(...lengths)).toBeLessThan(1000);
    // 16 per long side, 11 per end: 2×16 + 2×11
    expect(s.sheets).toBe(54);
  });
  test('imperial rounds to whole inches', () => {
    const g = ok(roofGeometry({ type: 'gable', lengthMm: 30 * 304.8, widthMm: 24 * 304.8, pitchDeg: degFromX12(6) }, us));
    const s = ok(sheets({ planes: g.planes, pitchDeg: g.pitchDeg, coverWidthMm: 914.4, overhangMm: 50.8, ridgeAllowanceMm: 0, maxSheetMm: 12000, endLapMm: 152.4 }, us));
    expect(s.sheets).toBe(20);
    expect((s.cutList[0]!.lengthMm / 25.4) % 1).toBeCloseTo(0, 6);
  });
  test('invalid', () => {
    expect(sheets({ planes: gable.planes, pitchDeg: 22.5, coverWidthMm: 0, overhangMm: 50, ridgeAllowanceMm: 0, maxSheetMm: 12000, endLapMm: 200 }, m).ok).toBe(false);
    expect(sheets({ planes: [], pitchDeg: 22.5, coverWidthMm: 762, overhangMm: 50, ridgeAllowanceMm: 0, maxSheetMm: 12000, endLapMm: 200 }, m).ok).toBe(false);
    expect(sheets({ planes: gable.planes, pitchDeg: 22.5, coverWidthMm: 762, overhangMm: 50, ridgeAllowanceMm: 0, maxSheetMm: 300, endLapMm: 200 }, m).ok).toBe(false);
  });
  test('stock pieces', () => {
    expect(stockPieces(2900, 3000, 50)).toBe(1);
    expect(stockPieces(10000, 3000, 50)).toBe(4); // (10000−50)/(2950) = 3.37
    expect(stockPieces(0, 3000)).toBe(0);
  });
});

describe('tiles and battens', () => {
  test('even gauge: 4330 − 320 − 40 = 3970 → ⌈3970/345⌉ = 12 gauges of 330.8, 13 rows', () => {
    const b = ok(battenGauge({ slopeMm: 4330, eavesSetOutMm: 320, topSetOutMm: 40, maxGaugeMm: 345 }, m));
    expect(b.gauges).toBe(12);
    expect(b.gaugeMm).toBeCloseTo(330.83, 2);
    expect(b.rows).toBe(13);
    expect(battenGauge({ slopeMm: 300, eavesSetOutMm: 320, topSetOutMm: 40, maxGaugeMm: 345 }, m).ok).toBe(false);
  });
  test('slate gauge (500 − 75) / 2 = 212.5', () => {
    expect(ok(slateGauge(500, 75, m)).gaugeMm).toBe(212.5);
    expect(slateGauge(500, 600, m).ok).toBe(false);
  });
  test('gable tile counts by courses and area', () => {
    const g = ok(roofGeometry({ type: 'gable', lengthMm: 10000, widthMm: 8000, pitchDeg: 22.5 }, m));
    const t = ok(tiles({ planes: g.planes, roofAreaM2: g.roofAreaM2, eavesSetOutMm: 320, topSetOutMm: 40, maxGaugeMm: 345, tileCoverWidthMm: 300, tilesPerM2: 10.5, wastePct: 5, battenStockMm: 6000 }, m));
    expect(t.rows).toBe(13); // 4329.6 − 360 = 3969.6 → ⌈11.5⌉ = 12 gauges → 13 rows
    expect(t.tilesByCourses).toBe(13 * 34 * 2); // ⌈10000 ÷ 300⌉ = 34 a course, two planes
    expect(t.tilesByArea).toBe(910); // 86.59 m² × 10.5 = 909.2
    expect(t.tilesToOrder).toBe(929); // 884 × 1.05 = 928.2
    expect(t.battenLinealMm).toBe(13 * 10000 * 2);
    expect(t.battenPieces).toBe(Math.ceil((260000 * 1.05) / 6000));
  });
  test('hip roof counts by area', () => {
    const g = ok(roofGeometry({ type: 'hip', lengthMm: 12000, widthMm: 8000, pitchDeg: 25 }, m));
    const t = ok(tiles({ planes: g.planes, roofAreaM2: g.roofAreaM2, eavesSetOutMm: 320, topSetOutMm: 40, maxGaugeMm: 345, tileCoverWidthMm: 300, tilesPerM2: null, wastePct: 10, battenStockMm: 6000 }, m));
    expect(t.tilesByCourses).toBeNull();
    expect(t.tilesByArea).toBe(Math.ceil(g.roofAreaM2 * (1e6 / (t.gaugeMm! * 300))));
    expect(t.tilesToOrder).toBe(Math.ceil(t.tilesByArea * 1.1));
  });
});

describe('tiles with partial maker data', () => {
  const g = roofGeometry({ type: 'gable', lengthMm: 10000, widthMm: 8000, pitchDeg: 22.5 }, m);
  if (!g.ok) throw new Error('setup');
  test('coverage only (no gauge, no cover): counts by area, no battens', () => {
    const t = ok(tiles({ planes: g.value.planes, roofAreaM2: g.value.roofAreaM2, eavesSetOutMm: 320, topSetOutMm: 40, maxGaugeMm: null, tileCoverWidthMm: null, tilesPerM2: 9.26, wastePct: 0, battenStockMm: 6000 }, m));
    expect(t.tilesToOrder).toBe(Math.ceil(g.value.roofAreaM2 * 9.26 - 1e-9));
    expect(t.battenPieces).toBeNull();
    expect(t.tilesByCourses).toBeNull();
  });
  test('no coverage and no gauge is an error', () => {
    expect(tiles({ planes: g.value.planes, roofAreaM2: g.value.roofAreaM2, eavesSetOutMm: 320, topSetOutMm: 40, maxGaugeMm: null, tileCoverWidthMm: 300, tilesPerM2: null, wastePct: 0, battenStockMm: 6000 }, m).ok).toBe(false);
  });
});

describe('flashings', () => {
  test('gable trims and pieces at 6 m stock with 100 mm laps', () => {
    const g = ok(roofGeometry({ type: 'gable', lengthMm: 10000, widthMm: 8000, pitchDeg: 22.5 }, m));
    const runs = trimRuns(g, m);
    const r = ok(trims({ runs, stockMm: 6000, lapMm: 100, wastePct: 0 }, m));
    expect(r.lines.map(l => [l.kind, l.pieces])).toEqual([['ridge', 2], ['barge', 4], ['eaves', 4]]);
    expect(r.pieces).toBe(10);
    expect(r.totalMm).toBeCloseTo(10000 + 4 * g.rafterMm + 20000, 6);
    const h = ok(roofGeometry({ type: 'hip', lengthMm: 12000, widthMm: 8000, pitchDeg: 25 }, m));
    expect(trimRuns(h, m).map(x => x.kind)).toEqual(['ridge', 'hip', 'eaves', 'eaves']);
    expect(trims({ runs, stockMm: 6000, lapMm: 4000, wastePct: 0 }, m).ok).toBe(false);
  });
  test('capping tiles', () => {
    expect(ok(cappingTiles(10000, { perMetre: 2.6 }, m)).tiles).toBe(26);
    expect(ok(cappingTiles(10000, { effectiveLengthMm: 380 }, m)).tiles).toBe(27);
    expect(cappingTiles(10000, {}, m).ok).toBe(false);
  });
});

describe('drainage', () => {
  test('fall at 1:500 over 12 m = 24 mm', () => {
    expect(ok(gutterFall({ runMm: 12000, ratio: 500 }, m)).fallMm).toBe(24);
    expect(gutterFall({ runMm: 12000, ratio: 10 }, m).ok).toBe(false);
    expect(gradientFromFall(12000, 24)).toBe(500);
    expect(gradientFromFall(0, 24)).toBeNull();
  });
  test('downpipes: 100 m² at 180 mm/h → 5 L/s; 2 L/s each → 3', () => {
    const d = ok(downpipes({ catchmentPlanM2: 100, slopeFactor: 1, intensityMmPerHr: 180, capacityLps: 2, method: 'test' }, m));
    expect(d.flowLps).toBeCloseTo(5, 9);
    expect(d.downpipes).toBe(3);
    const s = ok(downpipes({ catchmentPlanM2: 10, slopeFactor: 1, intensityMmPerHr: 100, capacityLps: 5, runMm: 30000, maxSpacingMm: 12000, method: 'test' }, m));
    expect(s.downpipes).toBe(3);
    expect(downpipes({ catchmentPlanM2: 100, slopeFactor: 0.5, intensityMmPerHr: 180, capacityLps: 2, method: 'x' }, m).ok).toBe(false);
    expect(downpipes({ catchmentPlanM2: 100, slopeFactor: 1, intensityMmPerHr: 0, capacityLps: 2, method: 'x' }, m).ok).toBe(false);
  });
});

describe('fixings', () => {
  test('28 sheets, 4330 mm run at 900 mm purlins: 6 lines; 5 end + 4 intermediate', () => {
    const f = ok(sheetFixings({ sheets: 28, slopeMm: 4330, supportSpacingMm: 900, endPerSheet: 5, intermediatePerSheet: 4, sideLapSpacingMm: null, wastePct: 5, boxSize: 100 }, m));
    expect(f.supports).toBe(6);
    expect(f.screws).toBe(28 * (10 + 16));
    expect(f.total).toBe(Math.ceil(728 * 1.05));
    expect(f.boxes).toBe(8);
  });
  test('per piece', () => {
    expect(ok(perPieceFixings(100, 4, 0, 250, 'shingles')).boxes).toBe(2);
    expect(perPieceFixings(0, 4, 0, 250, 'shingles').ok).toBe(false);
  });
});
