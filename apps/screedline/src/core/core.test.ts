/**
 * Worked examples, checked by hand (working in the comments), plus edge cases and invalid input.
 * Run: npm test (node --test, Node 22.18+ strips the types).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAG_YIELD_M3_PER_KG, composite, footing, pier, premixBags, siteMix, slab, stairs, truckOrder } from './concrete.ts';
import { bars, barMassPerM, mesh, piecesForRun, trenchMesh } from './reo.ts';
import { falls } from './falls.ts';
import { formwork } from './formwork.ts';
import { bulk, convert, pavers } from './landscape.ts';
import { retainingWall } from './retaining.ts';
import { evaporationRate, pourWeather } from './weather.ts';
import { ceilCount, ceilTo, fmt, fromMetric, parseNumber, toMetric } from './units.ts';
import type { Calc } from './calc.ts';

const close = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
function value<T>(c: Calc<T>): T {
  if (!c.ok) assert.fail('expected ok, got ' + JSON.stringify(c.errors));
  assert.ok(c.steps.length > 0, 'shows working');
  return c.value;
}
function errors<T>(c: Calc<T>) {
  assert.equal(c.ok, false);
  return (c as { errors: Record<string, string> }).errors;
}

// ---------- units ----------
test('parseNumber accepts normal input and rejects junk', () => {
  assert.equal(parseNumber('1.5'), 1.5);
  assert.equal(parseNumber(' 2 '), 2);
  assert.equal(parseNumber('.5'), 0.5);
  assert.equal(parseNumber('1,5'), 1.5);
  assert.equal(parseNumber('7.'), 7);
  for (const bad of ['', ' ', '-', 'abc', '1.2.3', '1,2,3', '1e5', 'Infinity', null, undefined]) assert.equal(parseNumber(bad as string), null, String(bad));
});
test('unit conversions use exact definitions', () => {
  close(toMetric('len', 10, 'imperial'), 3.048);
  close(toMetric('thick', 4, 'imperial'), 0.1016);
  close(toMetric('thick', 100, 'metric'), 0.1);
  close(fromMetric('vol', 0.764554857984, 'imperial'), 1);
  close(toMetric('temp', 212, 'imperial'), 100);
  close(fromMetric('temp', 0, 'imperial'), 32);
  close(toMetric('speed', 10, 'imperial'), 16.09344);
  close(fromMetric('density', 1, 'imperial'), 62.42796, 1e-4);
});
test('rounding helpers ignore floating-point dust', () => {
  assert.equal(ceilTo(2.4, 0.2), 2.4);
  assert.equal(ceilTo(0.1 + 0.2, 0.1), 0.3);
  assert.equal(ceilTo(2.41, 0.2), 2.6);
  assert.equal(ceilCount(3.0000000001), 3);
  assert.equal(ceilCount(3.01), 4);
  assert.equal(fmt(1234.5, 1), '1,234.5');
  assert.equal(fmt(-0.0001, 2), '0.00');
  assert.equal(fmt(1234567, 0), '1,234,567');
});

// ---------- concrete ----------
test('slab: 6 × 4 m at 100 mm with 5 % waste', () => {
  // 6 × 4 = 24 m², × 0.1 = 2.4 m³, × 1.05 = 2.52 m³
  const v = value(slab({ length: 6, width: 4, depth: 0.1, wastePct: 5 }));
  close(v.net, 2.4);
  close(v.total, 2.52);
  close(v.area!, 24);
});
test('slab with a thickened edge beam', () => {
  // ring = 10×8 − 9.4×7.4 = 80 − 69.56 = 10.44 m², extra = 10.44 × (0.4 − 0.1) = 3.132 m³
  const v = value(slab({ length: 10, width: 8, depth: 0.1, wastePct: 0, edgeWidth: 0.3, edgeDepth: 0.4 }));
  close(v.net, 8 + 3.132);
});
test('slab rejects bad input with field errors', () => {
  const e = errors(slab({ length: 0, width: null, depth: -1, wastePct: 5 }));
  assert.ok(e.length && e.width && e.depth);
  assert.ok(errors(slab({ length: 6, width: 4, depth: 0.1, wastePct: 150 })).waste);
  assert.ok(errors(slab({ length: 6, width: 4, depth: 0.1, wastePct: 0, edgeWidth: 0.3, edgeDepth: 0.1 })).edgeDepth);
  assert.ok(errors(slab({ length: 6, width: 4, depth: 0.1, wastePct: 0, edgeWidth: 2, edgeDepth: 0.4 })).edgeWidth);
});
test('pad footings: 3 × 600 × 600 × 500 mm', () => {
  // 0.6 × 0.6 × 0.5 = 0.18 m³ each, × 3 = 0.54 m³
  close(value(footing({ count: 3, length: 0.6, width: 0.6, depth: 0.5, wastePct: 0 })).total, 0.54);
  assert.ok(errors(footing({ count: 2.5, length: 1, width: 1, depth: 1, wastePct: 0 })).count);
});
test('piers: 4 × 450 mm diameter × 1.2 m', () => {
  // π × 0.225² = 0.159043 m², × 1.2 = 0.190852, × 4 = 0.763407 m³
  close(value(pier({ count: 4, diameter: 0.45, depth: 1.2, wastePct: 0 })).net, 0.763407, 1e-6);
});
test('steps: 3 steps, 170 rise, 280 going, 1.2 m wide', () => {
  // 1.2 × 0.17 × 0.28 × (3 × 4 / 2 = 6) = 0.34272 m³; 2R + G = 620 mm (no NCC note)
  const c = stairs({ steps: 3, rise: 0.17, going: 0.28, width: 1.2, wastePct: 0 });
  close(value(c).net, 0.34272);
  assert.equal(c.ok && c.notes.length, 0);
  const ncc = { riser: [0.115, 0.19] as [number, number], going: [0.24, 0.355] as [number, number], twoRG: [0.55, 0.7] as [number, number], code: 'NCC' };
  assert.equal(stairs({ steps: 3, rise: 0.17, going: 0.28, width: 1.2, wastePct: 0, rule: ncc }).ok && (stairs({ steps: 3, rise: 0.17, going: 0.28, width: 1.2, wastePct: 0, rule: ncc }) as { notes: string[] }).notes.length, 0);
  const steep = stairs({ steps: 1, rise: 0.3, going: 0.3, width: 1, wastePct: 0, rule: ncc });
  assert.ok(steep.ok && steep.notes.some(n => n.includes('550')) && steep.notes.some(n => n.startsWith('Rise 300 mm')));
  // no rule (unverified country): no code claims at all
  const plain = stairs({ steps: 1, rise: 0.3, going: 0.3, width: 1, wastePct: 0 });
  assert.ok(plain.ok && plain.notes.length === 0);
  assert.ok(errors(stairs({ steps: 0, rise: 0.17, going: 0.28, width: 1, wastePct: 0 })).steps);
});
test('custom shape: rectangle + triangle − circle', () => {
  // 4×3 = 12, ½×4×2 = 4, circle d 1 = 0.785398; area 15.214602 m², × 0.1 = 1.5214602 m³
  const v = value(composite([{ kind: 'rect', a: 4, b: 3 }, { kind: 'tri', a: 4, b: 2 }, { kind: 'circle', a: 1, subtract: true }], 0.1, 0));
  close(v.area!, 15.214602, 1e-6);
  close(v.net, 1.5214602, 1e-6);
  assert.ok(errors(composite([{ kind: 'rect', a: 1, b: 1 }, { kind: 'rect', a: 1, b: 1, subtract: true }], 0.1, 0)).shapes);
  assert.ok(errors(composite([], 0.1, 0)).shapes);
  assert.ok(errors(composite([{ kind: 'tri', a: 2, b: null }], 0.1, 0)).s0b);
});
test('truck order: 7.3 m³ in 0.2 m³ steps on 6 m³ trucks', () => {
  // 7.3 → 7.4 m³ = 37 steps over 2 trucks → 3.8 + 3.6
  const v = value(truckOrder({ volume: 7.3, increment: 0.2, truckCapacity: 6 }));
  close(v.order, 7.4);
  assert.equal(v.loads, 2);
  assert.deepEqual(v.loadSizes, [3.8, 3.6]);
  close(v.extra, 0.1);
});
test('truck order keeps exact volumes and flags small loads', () => {
  const c = truckOrder({ volume: 2.4, increment: 0.2, truckCapacity: 6 });
  close(value(c).order, 2.4);
  assert.ok(c.ok && c.notes.some(n => n.includes('short-load')));
  assert.ok(errors(truckOrder({ volume: 2, increment: 1, truckCapacity: 0.5 })).truckCapacity);
});
test('premix bags: 0.1 m³ with 20 kg bags', () => {
  // 108 bags/m³ → 20 kg yields 1/108 = 0.0092593 m³; 0.1 / 0.0092593 = 10.8 → 11 bags
  close(BAG_YIELD_M3_PER_KG, 1 / 2160, 1e-12);
  close(BAG_YIELD_M3_PER_KG, 0.000468205, 0.000468205 * 0.015); // within 1.5 % of Quikrete's US yield
  const v = value(premixBags({ volume: 0.1, bagKg: 20 }));
  assert.equal(v.bags, 11);
  close(v.bagsPerM3, 108, 1e-9);
  assert.equal(v.totalKg, 220);
  // label says 0.01 m³ per bag → exactly 10 bags
  assert.equal(value(premixBags({ volume: 0.1, bagKg: 20, yieldPerBag: 0.01 })).bags, 10);
});
test('site mix 1:2:3 for 1 m³ with 20 kg cement bags', () => {
  // dry 1.54 m³; cement 1.54/6 × 1440 = 369.6 kg → 19 bags; sand 0.5133; aggregate 0.77
  const v = value(siteMix({ volume: 1, ratio: '1:2:3', cementBagKg: 20 }));
  close(v.cementKg, 369.6, 1e-9);
  assert.equal(v.cementBags, 19);
  close(v.sandM3, 0.513333, 1e-6);
  close(v.aggregateM3, 0.77, 1e-9);
});

// ---------- reo ----------
test('pieces along a run with laps', () => {
  assert.equal(piecesForRun(6, 6, 0.5), 1);
  assert.equal(piecesForRun(11.5, 6, 0.5), 2); // 2×6 − 0.5 = 11.5 exactly
  assert.equal(piecesForRun(12, 6, 0.5), 3);
});
test('mesh: 6 × 4 m slab, 50 mm edge, 200 mm laps, SL sheets', () => {
  // mesh 5.9 × 3.9; along 5.9 ≤ 6 → 1; across ⌈(3.9 − 2.4)/2.2⌉ + 1 = 2 → 2 sheets; chairs ⌈5.9/0.8⌉ × ⌈3.9/0.8⌉ = 8 × 5
  const v = value(mesh({ length: 6, width: 4, edge: 0.05, lap: 0.2, sheetLength: 6, sheetWidth: 2.4, chairSpacing: 0.8 }));
  assert.equal(v.sheets, 2);
  assert.equal(v.rotated, false);
  assert.equal(v.chairs, 40);
});
test('mesh picks the better orientation and adds spare sheets', () => {
  // 2.4 × 12 m strip: sheets along the 2.4 m side need 1 × (⌈9.6/2.2⌉+1 = 6) = 6; turned: 1 × (⌈6/5.8⌉+1 = 3) = 3
  const v = value(mesh({ length: 2.4, width: 12, edge: 0, lap: 0.2, sheetLength: 6, sheetWidth: 2.4, chairSpacing: 0.8 }));
  assert.equal(v.sheets, 3);
  assert.equal(v.rotated, true);
  assert.equal(value(mesh({ length: 6, width: 4, edge: 0.05, lap: 0.2, sheetLength: 6, sheetWidth: 2.4, chairSpacing: 0.8, wastePct: 10 })).sheets, 3);
  assert.ok(errors(mesh({ length: 0.08, width: 4, edge: 0.05, lap: 0.2, sheetLength: 6, sheetWidth: 2.4, chairSpacing: 0.8 })).edge);
  assert.ok(errors(mesh({ length: 6, width: 4, edge: 0.05, lap: 3, sheetLength: 6, sheetWidth: 2.4, chairSpacing: 0.8 })).lap);
});
test('bar mass matches AS/NZS 4671 nominal masses', () => {
  const table: [number, number][] = [[10, 0.617], [12, 0.888], [16, 1.58], [20, 2.47], [24, 3.55], [28, 4.83], [32, 6.31]];
  for (const [d, kg] of table) close(barMassPerM(d), kg, 0.005);
});
test('bars: 2 footings × 4 N12 bars over 12 m, 6 m stock, 500 mm laps', () => {
  // 3 bars per line, 8 lines → 24 stock bars, 16 laps, 144 m × 0.8878 kg/m = 127.85 kg
  const v = value(bars({ runLength: 12, runs: 2, barsPerRun: 4, stockLength: 6, lap: 0.5, diameter: 12 }));
  assert.equal(v.piecesPerBar, 3);
  assert.equal(v.stockBars, 24);
  assert.equal(v.laps, 16);
  close(v.massKg, 127.85, 0.01);
  assert.ok(errors(bars({ runLength: 12, runs: 1, barsPerRun: 1, stockLength: 6, lap: 6, diameter: 12 })).lap);
});
test('trench mesh: 30 m of footing with 4 corners, 300 mm wide', () => {
  // 30 + 4 × 0.3 = 31.2 m; ⌈(31.2 − 6) / 5.5⌉ + 1 = ⌈4.58⌉ + 1 = 6 lengths
  assert.equal(value(trenchMesh({ totalLength: 30, lines: 1, stockLength: 6, lap: 0.5, corners: 4, meshWidth: 0.3 })).pieces, 6);
  // 2 layers, no corners: 11.5 m = exactly 2 lengths per layer
  assert.equal(value(trenchMesh({ totalLength: 11.5, lines: 2, stockLength: 6, lap: 0.5, corners: 0, meshWidth: 0.3 })).pieces, 4);
  assert.ok(errors(trenchMesh({ totalLength: 10, lines: 1, stockLength: 6, lap: 0.5, corners: 1.5, meshWidth: 0.3 })).corners);
});

// ---------- falls ----------
test('falls: 1 % over 10 m is 100 mm, 1:100, 10 mm/m', () => {
  const v = value(falls({ run: 10, mode: 'pct', value: 1 }));
  close(v.drop, 0.1);
  close(v.ratio, 100);
  close(v.mmPerM, 10);
});
test('falls: 1:60 over 6 m and 50 mm over 1 m', () => {
  close(value(falls({ run: 6, mode: 'ratio', value: 60 })).pct, 1.666667, 1e-6);
  const v = value(falls({ run: 1, mode: 'drop', value: 0.05 }));
  close(v.pct, 5);
  close(v.ratio, 20);
});
test('falls: peg heights every 2 m over 5 m at 1 %', () => {
  const v = value(falls({ run: 5, mode: 'pct', value: 1, station: 2 }));
  assert.deepEqual(v.stations.map(s => s.at), [2, 4, 5]);
  close(v.stations[2]!.below, 0.05);
  assert.ok(errors(falls({ run: 5, mode: 'ratio', value: 0.5 })).value);
  assert.ok(errors(falls({ run: 0, mode: 'pct', value: 1 })).run);
});

// ---------- formwork ----------
test('formwork: 6 × 4 m slab, 4.8 m boards, pegs at 1 m', () => {
  // boards 2+1+2+1 = 6, joints 2; pegs (6+1)+(4+1)+(6+1)+(4+1) = 24, + 2 joints = 26
  const v = value(formwork({ sides: [6, 4, 6, 4], boardLength: 4.8, pegSpacing: 1 }));
  assert.equal(v.perimeter, 20);
  assert.equal(v.boards, 6);
  assert.equal(v.pegs, 26);
  assert.ok(errors(formwork({ sides: [], boardLength: 4.8, pegSpacing: 1 })).sides);
});

// ---------- landscape ----------
test('bulk: 20 m² of road base 100 mm thick, 20 % compaction', () => {
  // 2 m³ finished, 2.4 m³ loose, × 1.92 = 4.608 t
  const v = value(bulk({ area: 20, depth: 0.1, density: 1.92, compactPct: 20 }));
  close(v.looseVolume, 2.4);
  close(v.tonnes, 4.608);
});
test('convert tonnes and cubic metres', () => {
  close(value(convert({ value: 3, from: 't', density: 1.6 })).m3, 1.875);
  close(value(convert({ value: 2, from: 'm3', density: 1.22 })).t, 2.44);
  assert.ok(errors(convert({ value: 2, from: 'm3', density: 0 })).density);
});
test('pavers: 10 m² of 230 × 115 with 3 mm joints', () => {
  // 1 / (0.233 × 0.118) = 36.3716 per m²; × 10 × 1.05 = 381.9 → 382
  const v = value(pavers({ area: 10, paverLength: 0.23, paverWidth: 0.115, joint: 0.003, wastePct: 5, beddingDepth: 0.03, baseDepth: 0.1, baseCompactPct: 20 }));
  close(v.perM2, 36.3716, 1e-4);
  assert.equal(v.pavers, 382);
  close(v.beddingM3, 0.33);
  close(v.baseM3, 1.2);
});

// ---------- retaining ----------
test('retaining wall: 10 m × 600 mm with 150 mm buried', () => {
  // 750 mm / 200 mm = 3.75 → 4 courses; 10 / 0.4 = 25 per course; 100 × 1.05 = 105; caps 25
  const c = retainingWall({ length: 10, height: 0.6, buried: 0.15, blockLength: 0.4, blockHeight: 0.2, blockDepth: 0.3, capLength: 0.4, wastePct: 5, drainWidth: 0.3 });
  const v = value(c);
  assert.equal(v.courses, 4);
  assert.equal(v.blocks, 105);
  assert.equal(v.caps, 25);
  close(v.drainM3, 2.25);
  close(v.padM3, 0.9);
  // the approval caveat shows at every height (boundaries, buildings, loads)
  assert.ok(c.ok && c.notes.some(n => n.includes('council')));
  const tall = retainingWall({ length: 10, height: 1.2, buried: 0.15, blockLength: 0.4, blockHeight: 0.2, blockDepth: 0.3, capLength: 0, wastePct: 0, drainWidth: 0.3 });
  assert.ok(tall.ok && tall.notes.some(n => n.includes('council')));
});

// ---------- weather ----------
test('evaporation (Uno 1998): 30 °C, 50 % RH, 20 km/h', () => {
  // 48^2.5 = 15962.6; (15962.6 − 0.5 × 15962.6) × 24 × 5e-6 = 0.958 kg/m²/h
  close(evaporationRate(30, 30, 0.5, 20), 0.9578, 1e-3);
  const v = value(pourWeather({ airC: 30, concreteC: 30, humidityPct: 50, windKmh: 20 }));
  assert.equal(v.risk, 'moderate');
  assert.ok(v.warnings.some(w => w.includes('Hot weather')));
});
test('evaporation is never negative and flags high risk', () => {
  assert.equal(evaporationRate(10, 30, 1, 10), 0);
  assert.equal(value(pourWeather({ airC: 35, concreteC: 36, humidityPct: 20, windKmh: 30 })).risk, 'high');
  assert.ok(value(pourWeather({ airC: 3, concreteC: 4, humidityPct: 80, windKmh: 5, delivery: { min: 5, max: 35, source: 'AS 1379' } })).warnings.some(w => w.includes('AS 1379')));
  assert.ok(!value(pourWeather({ airC: 3, concreteC: 4, humidityPct: 80, windKmh: 5 })).warnings.some(w => w.includes('AS 1379')));
  assert.ok(errors(pourWeather({ airC: 20, concreteC: 20, humidityPct: 120, windKmh: 5 })).humidityPct);
});

// ---------- review fixes (GPT-6.2 Sol, verified) ----------
test('truck loads never exceed the truck: NZ 12.75 m³ in 0.25 steps on 6.4 m³ trucks', () => {
  // 6.4 / 0.25 = 25.6 → 25 steps (6.25 m³) per truck; 51 steps → 3 loads of 17 steps = 4.25 m³
  const v = value(truckOrder({ volume: 12.75, increment: 0.25, truckCapacity: 6.4 }));
  assert.equal(v.loads, 3);
  assert.deepEqual(v.loadSizes, [4.25, 4.25, 4.25]);
  for (const s of v.loadSizes) assert.ok(s <= 6.4);
  assert.ok(errors(truckOrder({ volume: 2, increment: 0.01, truckCapacity: 6 })).increment);
  assert.ok(errors(truckOrder({ volume: 2, increment: 0.2, truckCapacity: 0.3 })).truckCapacity);
});
test('edge beam chosen but empty is an error, not a plain slab', () => {
  const e = errors(slab({ length: 6, width: 4, depth: 0.1, wastePct: 5, edge: true, edgeWidth: null, edgeDepth: null }));
  assert.ok(e.edgeWidth && e.edgeDepth);
  close(value(slab({ length: 6, width: 4, depth: 0.1, wastePct: 0, edge: false, edgeWidth: null, edgeDepth: null })).net, 2.4);
});
test('pour weather never calls a non-estimate "low"', () => {
  assert.ok(errors(pourWeather({ airC: -20, concreteC: 10, humidityPct: 50, windKmh: 10 })).airC);
  assert.ok(errors(pourWeather({ airC: 5, concreteC: -19, humidityPct: 50, windKmh: 10 })).concreteC);
});
test('stairs: risers per flight and pitch', () => {
  const ncc = { riser: [0.115, 0.19] as [number, number], going: [0.24, 0.355] as [number, number], twoRG: [0.55, 0.7] as [number, number], code: 'NCC', maxRisers: 18 };
  const many = stairs({ steps: 19, rise: 0.17, going: 0.28, width: 1, wastePct: 0, rule: ncc });
  assert.ok(many.ok && many.notes.some(n => n.includes('at most 18')));
  const adk = { riser: [0.15, 0.22] as [number, number], going: [0.22, 0.3] as [number, number], twoRG: [0.55, 0.7] as [number, number], code: 'Approved Document K', maxPitchDeg: 42 };
  const steep = stairs({ steps: 3, rise: 0.22, going: 0.22, width: 1, wastePct: 0, rule: adk });
  assert.ok(steep.ok && steep.notes.some(n => n.includes('45.0°')));
});
test('numbers: thousands separators and decimal commas', () => {
  assert.equal(parseNumber('1,500'), 1500);
  assert.equal(parseNumber('12,500.5'), 12500.5);
  assert.equal(parseNumber('1,234,567'), 1234567);
  assert.equal(parseNumber('1,5'), 1.5);
  assert.equal(parseNumber('12,25'), 12.25);
  close(toMetric('tonnes', 1, 'imperial'), 0.90718474);
  close(fromMetric('tonnes', 1, 'imperial'), 1.10231131, 1e-6);
});
