import { makeCtx } from '../core/context';
import { gutterFall } from '../core/drainage';
import { roofGeometry } from '../core/geometry';
import { sheets } from '../core/sheets';
import { tiles } from '../core/tiles';
import { degFromX12 } from '../core/units';
import { downpipePlan } from './drainagePlan';
import { countryFor, countryList, flag, GUIDED, isKnownCountry } from './index';
import { isPublicSource } from './src';
import { interp } from './uk-ie';

const BRANDS = /lysaght|stramit|metroll|fielders|monier|bristile|dimond|gerard|marley|redland|cladco|eternit|onduline|floplast|brett martin|owens|gaf|iko|metal sales|westman|eagle|colorbond|zincalume|klip|trimdek|spandek|custom orb|home depot|lowe|travis|bunnings|wickes|castle/i;

describe('every guided country', () => {
  test.each(GUIDED.map(c => [c.code, c] as const))('%s has a full, cited, brand-free profile', (_code, c) => {
    expect(c.guided).toBe(true);
    expect(c.standards.length).toBeGreaterThan(2);
    expect(c.safety.text.length).toBeGreaterThan(20);
    expect(c.safety.src.url).toMatch(/^https:\/\//);
    expect(c.sheets.length + c.shingles.length).toBeGreaterThan(0);
    const items = [...c.sheets, ...c.tiles, ...c.shingles, ...c.caps, ...c.gutters, ...c.downpipes];
    for (const it of items) {
      expect(it.src.url).toMatch(/^https:\/\//); // every catalogue value is cited
      expect(it.name).not.toMatch(BRANDS); // UI names are generic
      expect((it as { note?: string }).note ?? '').not.toMatch(BRANDS);
    }
    for (const sh of c.sheets) {
      expect(sh.coverMm).toBeGreaterThan(200);
      expect(sh.coverMm).toBeLessThan(1200);
    }
    for (const t of c.tiles) expect(t.tilesPerM2 ?? 1).toBeGreaterThan(0);
    for (const t of [...c.standards.map(x => x.name), c.safety.text, ...c.notes, ...c.gaps]) expect(t).not.toMatch(/lysaght|monier|marley|floplast|metal sales|owens corning/i);
    expect(c.drainage.fallRatio).toBeGreaterThanOrEqual(100);
    expect(c.drainage.slopeFactor(0)).toBeCloseTo(1, 6);
    expect(c.drainage.slopeFactor(30)).toBeGreaterThanOrEqual(1);
  });

  test('units and words follow the country', () => {
    expect(countryFor('US').sys).toBe('imperial');
    expect(countryFor('US').pitchStyle).toBe('x12');
    expect(countryFor('US').terms.downpipe).toBe('downspout');
    expect(countryFor('US').terms.barge).toBe('rake');
    expect(countryFor('CA').terms.gutter).toBe('eavestrough');
    expect(countryFor('NZ').terms.gutter).toBe('spouting');
    expect(countryFor('GB').terms.barge).toBe('verge');
    expect(countryFor('AU').terms.underlay).toBe('sarking');
    expect(countryFor('AU').sys).toBe('metric');
    expect(countryFor('IE').currency).toBe('EUR');
    expect(countryFor('uk').code).toBe('GB');
  });
});

describe('generic fallback', () => {
  test('unknown and other countries are metric generic with their own name', () => {
    const de = countryFor('DE');
    expect(de.guided).toBe(false);
    expect(de.name).toBe('Germany');
    expect(de.sys).toBe('metric');
    expect(de.sheets).toEqual([]);
    expect(countryFor(null).name).toBe('Other country');
    expect(countryFor('ZZ').guided).toBe(false);
    expect(isKnownCountry('FR')).toBe(true);
    expect(isKnownCountry('ZZ')).toBe(false);
  });
  test('picker lists guided first, then A–Z, no duplicates', () => {
    const l = countryList();
    expect(l.slice(0, 6).map(x => x.code)).toEqual(['AU', 'NZ', 'GB', 'IE', 'US', 'CA']);
    expect(new Set(l.map(x => x.code)).size).toBe(l.length);
    const rest = l.slice(6).map(x => x.name);
    expect([...rest].sort((a, b) => a.localeCompare(b))).toEqual(rest);
    expect(flag('AU')).toBe('🇦🇺');
  });
});

describe('sources', () => {
  test('only regulators, standards bodies and government sites are linkable', () => {
    expect(isPublicSource('https://www.osha.gov/laws-regs/x')).toBe(true);
    expect(isPublicSource('https://assets.publishing.service.gov.uk/x.pdf')).toBe(true);
    expect(isPublicSource('https://www.building.govt.nz/x')).toBe(true);
    expect(isPublicSource('https://lysaght.com/document/1')).toBe(false);
    expect(isPublicSource('https://www.lowes.com/pd/x')).toBe(false);
  });
});

describe('country worked examples', () => {
  test('AU: 10 × 8 m gable, corrugated at 22.5°', () => {
    const c = countryFor('AU');
    const ctx = makeCtx(c.sys, c.pitchStyle, c.terms);
    const g = roofGeometry({ type: 'gable', lengthMm: 10000, widthMm: 8000, pitchDeg: 22.5 }, ctx);
    if (!g.ok) throw new Error(g.error);
    const p = c.sheets.find(x => x.id === 'corrugated')!;
    const r = sheets({ planes: g.value.planes, pitchDeg: 22.5, coverWidthMm: p.coverMm, overhangMm: c.defaults.overhangMm, ridgeAllowanceMm: 0, maxSheetMm: c.defaults.maxSheetMm, endLapMm: p.endLapMm ?? 0 }, ctx);
    expect(r.ok && r.value.sheets).toBe(28);
    // AU drainage: 80 m² plan at 22.5° → 80 × 1.225 = 98 m² catchment ÷ 37 m² worked example = 3 downpipes
    const d = downpipePlan(c, { planM2: 80, pitchDeg: 22.5, intensityMmPerHr: 200, gutterId: 'quad-115', downpipeId: 'round-90', customCapacityLps: null, areaPerDownpipeM2: null, runMm: 20000 }, ctx);
    expect(d.ok && d.value.downpipes).toBe(3);
    expect(d.ok && d.value.catchmentM2).toBeCloseTo(98, 6);
    expect(gutterFall({ runMm: 10000, ratio: c.drainage.fallRatio }, ctx).ok).toBe(true);
  });
  test('NZ: E1/AS1 Table 5 by pitch band', () => {
    const c = countryFor('NZ');
    const ctx = makeCtx(c.sys, c.pitchStyle, c.terms);
    const base = { intensityMmPerHr: 100, gutterId: null, customCapacityLps: null, areaPerDownpipeM2: null, runMm: null };
    const a = downpipePlan(c, { ...base, planM2: 160, pitchDeg: 20, downpipeId: 'round-74' }, ctx); // 85 m² → 2
    const b = downpipePlan(c, { ...base, planM2: 160, pitchDeg: 30, downpipeId: 'round-74' }, ctx); // 70 m² → 3
    expect(a.ok && a.value.downpipes).toBe(2);
    expect(b.ok && b.value.downpipes).toBe(3);
    expect(downpipePlan(c, { ...base, planM2: 160, pitchDeg: 60, downpipeId: 'round-74' }, ctx).ok).toBe(false);
  });
  test('GB: AD H effective area and outlet flow', () => {
    const c = countryFor('GB');
    expect(c.drainage.slopeFactor(30)).toBeCloseTo(1.289, 3);
    expect(c.drainage.slopeFactor(45)).toBeCloseTo(1.5, 6);
    expect(c.drainage.slopeFactor(60)).toBeCloseTo(1.866, 3);
    const ctx = makeCtx(c.sys, c.pitchStyle, c.terms);
    // 50 m² plan at 45° → 75 m² effective × 75 mm/h ÷ 3600 = 1.5625 L/s; half-round 112 at 0.82 L/s → 2 outlets
    const d = downpipePlan(c, { planM2: 50, pitchDeg: 45, intensityMmPerHr: null, gutterId: 'half-round-112', downpipeId: 'round-68', customCapacityLps: null, areaPerDownpipeM2: null, runMm: null }, ctx);
    expect(d.ok && d.value.flowLps).toBeCloseTo(1.5625, 6);
    expect(d.ok && d.value.downpipes).toBe(2);
    const adh = downpipePlan(c, { planM2: 50, pitchDeg: 45, intensityMmPerHr: null, gutterId: 'adh-100', downpipeId: null, customCapacityLps: null, areaPerDownpipeM2: null, runMm: null }, ctx);
    expect(adh.ok && adh.value.downpipes).toBe(3); // 1.5625 ÷ 0.78
  });
  test('IE: TGD H multipliers', () => {
    const c = countryFor('IE');
    expect(c.drainage.slopeFactor(30)).toBeCloseTo(1.15, 6);
    expect(c.drainage.slopeFactor(45)).toBeCloseTo(1.4, 6);
    expect(c.drainage.slopeFactor(60)).toBeCloseTo(2.0, 6);
    expect(c.drainage.slopeFactor(15)).toBeCloseTo(1.075, 6);
    expect(interp([[0, 1], [10, 2]], 20)).toBe(2);
  });
  test('US: imperial gable, x:12 pitch, IPC flow and rule of thumb', () => {
    const c = countryFor('US');
    const ctx = makeCtx(c.sys, c.pitchStyle, c.terms);
    const g = roofGeometry({ type: 'gable', lengthMm: 40 * 304.8, widthMm: 30 * 304.8, pitchDeg: degFromX12(6) }, ctx);
    if (!g.ok) throw new Error(g.error);
    expect(g.value.roofAreaM2 * 10.7639).toBeCloseTo(1200 * 1.118034, 0); // 6:12 pitch factor 1.118
    // 1200 sq ft plan (111.5 m²) at 3 in/h: Q = 111.48 × 76.2 ÷ 3600 = 2.36 L/s; 5" half-round 4.67 L/s → 1, spacing 80 ft ÷ 40 → 2
    const d = downpipePlan(c, { planM2: 1200 / 10.7639, pitchDeg: degFromX12(6), intensityMmPerHr: 76.2, gutterId: 'half-round-5', downpipeId: 'round-3', customCapacityLps: null, areaPerDownpipeM2: null, runMm: 80 * 304.8 }, ctx);
    expect(d.ok && d.value.downpipes).toBe(2);
    const rule = downpipePlan(c, { planM2: 1500 / 10.7639, pitchDeg: 20, intensityMmPerHr: null, gutterId: 'k-5', downpipeId: '2x3', customCapacityLps: null, areaPerDownpipeM2: null, runMm: null }, ctx);
    expect(rule.ok && rule.value.downpipes).toBe(3); // 1500 ÷ 600
    expect(c.shingles[0]!.bundlesPerSquare).toBe(3);
  });
  test('CA: needs entered capacity (not verified) and uses eavestrough wording', () => {
    const c = countryFor('CA');
    const ctx = makeCtx(c.sys, c.pitchStyle, c.terms);
    const none = downpipePlan(c, { planM2: 100, pitchDeg: 20, intensityMmPerHr: 40, gutterId: 'k-5', downpipeId: '2x3', customCapacityLps: null, areaPerDownpipeM2: null, runMm: null }, ctx);
    expect(none.ok).toBe(false);
    expect(!none.ok && none.error).toMatch(/downspout/);
    const ok = downpipePlan(c, { planM2: 100, pitchDeg: 20, intensityMmPerHr: 40, gutterId: 'k-5', downpipeId: '2x3', customCapacityLps: 0.5, areaPerDownpipeM2: null, runMm: null }, ctx);
    expect(ok.ok && ok.value.downpipes).toBe(3); // 100 × 40 ÷ 3600 = 1.11 L/s ÷ 0.5
  });
  test('generic: rational method with entered values; errors without intensity', () => {
    const c = countryFor('FR');
    const ctx = makeCtx(c.sys, c.pitchStyle, c.terms);
    expect(downpipePlan(c, { planM2: 100, pitchDeg: 20, intensityMmPerHr: null, gutterId: null, downpipeId: null, customCapacityLps: 1, areaPerDownpipeM2: null, runMm: null }, ctx).ok).toBe(false);
    const r = downpipePlan(c, { planM2: 100, pitchDeg: 20, intensityMmPerHr: 120, gutterId: null, downpipeId: null, customCapacityLps: 1, areaPerDownpipeM2: null, runMm: null }, ctx);
    expect(r.ok && r.value.downpipes).toBe(4); // 3.33 L/s
  });
  test('GB tiles: interlocking tile on a 10 × 8 m gable at 35°', () => {
    const c = countryFor('GB');
    const ctx = makeCtx(c.sys, c.pitchStyle, c.terms);
    const g = roofGeometry({ type: 'gable', lengthMm: 10000, widthMm: 8000, pitchDeg: 35 }, ctx);
    if (!g.ok) throw new Error(g.error);
    const t = c.tiles[0]!;
    const r = tiles({ planes: g.value.planes, roofAreaM2: g.value.roofAreaM2, eavesSetOutMm: 320, topSetOutMm: 40, maxGaugeMm: t.maxGaugeMm!, tileCoverWidthMm: t.coverWidthMm!, tilesPerM2: t.tilesPerM2, wastePct: 5, battenStockMm: 4800 }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.gaugeMm).toBeLessThanOrEqual(345);
  });
});
