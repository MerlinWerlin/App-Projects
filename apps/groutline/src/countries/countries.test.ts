/** Every country path: data sanity, no retailer or brand names in UI text, and each calculator runs on its defaults. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adhesiveRate, COUNTRIES, countryForRegion, getCountry, GENERIC, systemFor } from './index.ts';
import { calcTiles } from '../core/tiles.ts';
import { calcAdhesive, calcGrout, calcMembrane, wetAreaSurfaces } from '../core/materials.ts';
import { calcFalls } from '../core/falls.ts';
import { calcStairs } from '../core/stairs.ts';
import { calcTrim } from '../core/trim.ts';
import { IMPERIAL_NOTCHES, NOTCHES } from '../core/notch.ts';
import { calcSetout } from '../core/setout.ts';

const ALL = [...COUNTRIES, GENERIC];
// Retailers and makers named in code docs only: never in anything the UI shows.
const NAMES = /\b(Bunnings|Beaumont|Wickes|Topps|Screwfix|B&Q|Woodies|Tile Style|Delforno|Home Depot|Lowe'?s|Floor ?& ?Decor|RONA|Mitre 10|Tile Warehouse|Mapei|MAPEI|Ardex|ARDEX|Davco|Sika|BAL|Bostik|Laticrete|LATICRETE|Custom Building|RedGard|Hydro ?Ban|Schluter|Kerdi|KERDI|Palace|Everbuild|Nicobond|Butech|Evo-Stik|Kerakoll|Johnson|Duratile|Ultraflex|Keraflex|Kerapoxy|Aquaseal)\b/;

const uiStrings = (c: typeof ALL[number]) => [
  c.name, c.falls.label, c.membraneHeights.label, c.contactRule, c.stairs?.source ?? '', ...Object.values(c.terms),
  ...c.standards.flatMap(s => [s.name, s.note]),
  ...c.catalogue.tiles.flatMap(x => [x.label, x.note ?? '']), ...c.catalogue.adhesives.map(x => x.label),
  ...c.catalogue.grouts.map(x => x.label), ...c.catalogue.membranes.flatMap(x => [x.label, x.note ?? '']),
];

test('six guided countries plus the generic fallback', () => {
  assert.deepEqual(COUNTRIES.map(c => c.code), ['AU', 'NZ', 'GB', 'IE', 'US', 'CA']);
  assert.ok(COUNTRIES.every(c => c.guided));
  assert.equal(GENERIC.guided, false);
  assert.equal(GENERIC.system, 'metric');
});

test('device region picks the country; unknown regions fall back to generic metric', () => {
  assert.equal(countryForRegion('AU').code, 'AU');
  assert.equal(countryForRegion('nz').code, 'NZ');
  assert.equal(countryForRegion('GB').code, 'GB');
  assert.equal(countryForRegion('UK').code, 'GB');
  assert.equal(countryForRegion('IE').code, 'IE');
  assert.equal(countryForRegion('US').code, 'US');
  assert.equal(countryForRegion('CA').code, 'CA');
  assert.equal(countryForRegion('FR').code, 'XX');
  assert.equal(countryForRegion(null).code, 'XX');
  assert.equal(getCountry('nonsense').code, 'XX');
  assert.equal(systemFor(getCountry('US'), null), 'imperial');
  assert.equal(systemFor(getCountry('US'), 'metric'), 'metric');
  assert.equal(systemFor(getCountry('AU'), null), 'metric');
});

for (const c of ALL) {
  test(`${c.code}: catalogue data is sane and sourced`, () => {
    for (const s of uiStrings(c)) assert.doesNotMatch(s, NAMES, `${c.code} UI text names a retailer or brand: "${s}"`);
    assert.ok(c.catalogue.tiles.length >= 6, 'enough tile sizes');
    assert.ok(c.catalogue.adhesives.length >= 1 && c.catalogue.grouts.length >= 1 && c.catalogue.membranes.length >= 1);
    const ids = new Set<string>();
    for (const x of [...c.catalogue.tiles, ...c.catalogue.adhesives, ...c.catalogue.grouts, ...c.catalogue.membranes]) {
      assert.ok(!ids.has(x.id), `duplicate id ${x.id}`); ids.add(x.id);
      assert.ok(x.src && x.src.length > 4, `${x.id} has a source`);
    }
    for (const x of c.catalogue.tiles) {
      assert.ok(x.lengthMm > 0 && x.widthMm > 0 && x.thicknessMm > 0 && x.thicknessMm < 30, x.id);
      assert.ok(x.lengthMm >= x.widthMm, `${x.id} length is the long side`);
      if (x.perBox !== undefined) assert.ok(Number.isInteger(x.perBox) && x.perBox > 0, x.id);
      // Box coverage should match tiles × tile area (within 12%: nominal vs actual face sizes).
      if (x.perBox && x.boxM2 && !x.sheet) {
        const calc = (x.perBox * x.lengthMm * x.widthMm) / 1e6;
        assert.ok(Math.abs(calc - x.boxM2) / x.boxM2 < 0.12, `${x.id}: ${x.perBox} × tile = ${calc.toFixed(3)} m² vs box ${x.boxM2}`);
      }
    }
    for (const g of c.catalogue.grouts) assert.ok(g.density >= 1.2 && g.density <= 2 && g.bagKg > 0, g.id);
    for (const a of c.catalogue.adhesives) {
      assert.ok(a.bagKg > 0, a.id);
      for (const cov of a.coverage ?? []) assert.ok(cov.kgPerM2 > 0.5 && cov.kgPerM2 < 12, `${a.id} ${cov.notchMm}`);
    }
    for (const m of c.catalogue.membranes) assert.ok(m.packL > 0 && m.litresPerM2PerCoat > 0.1 && m.litresPerM2PerCoat < 2 && m.coats >= 1, m.id);
    assert.ok(c.falls.min >= 40 && c.falls.min <= 120);
    if (c.falls.max != null) assert.ok(c.falls.max < c.falls.min, 'steepest is steeper than minimum');
    if (c.stairs) assert.ok(c.stairs.riserMax > c.stairs.riserMin && c.stairs.goingMax > c.stairs.goingMin);
    assert.ok(c.trimStockMm.every(v => v > 2000 && v < 3100));
    assert.ok(c.membraneHeights.showerWallMm >= 1800 && c.membraneHeights.showerWallMm <= 1900);
    if (c.guided) assert.ok(c.standards.length >= 4, 'guided countries name their standards');
  });

  test(`${c.code}: every calculator runs on the country's own defaults`, () => {
    const system = c.system;
    const tile = c.catalogue.tiles[0];
    const tiles = calcTiles({ rects: [{ widthMm: 3000, heightMm: 2400 }], tileLengthMm: tile.lengthMm, tileWidthMm: tile.widthMm, jointMm: c.jointMm.floor, layout: 'straight', perBox: tile.perBox ?? null, boxM2: tile.boxM2 ?? null, system });
    assert.ok(tiles.ok && tiles.value.tiles > 0);
    const setout = calcSetout({ lengthMm: 3000, widthMm: 2400, tileLengthMm: tile.lengthMm, tileWidthMm: tile.widthMm, jointMm: c.jointMm.floor, gapMm: 0, modeX: null, modeY: null, system });
    assert.ok(setout.ok && setout.value.tilesNeeded > 0);
    const g = c.catalogue.grouts[0];
    const grout = calcGrout({ areaM2: 7.2, tileLengthMm: tile.lengthMm, tileWidthMm: tile.widthMm, tileThicknessMm: tile.thicknessMm, jointMm: Math.max(1.5, c.jointMm.floor), density: g.density, bagKg: g.bagKg, extraPct: 10, system });
    assert.ok(grout.ok && grout.value.bags >= 1);
    const notches = system === 'metric' ? NOTCHES : IMPERIAL_NOTCHES;
    for (const a of c.catalogue.adhesives) for (const n of notches) {
      const rate = adhesiveRate(a, n);
      assert.ok(rate.kgPerM2 > 0, `${a.id} ${n.label}`);
      const ad = calcAdhesive({ areaM2: 7.2, kgPerM2: rate.kgPerM2, notchLabel: n.label, backButterKgPerM2: 0, bagKg: a.bagKg, extraPct: 10, system });
      assert.ok(ad.ok && ad.value.bags >= 1);
    }
    const wet = wetAreaSurfaces({ roomLengthMm: 2400, roomWidthMm: 1800, showerLengthMm: 1200, showerWidthMm: 900, showerWalls: 2, doorWidthMm: 800, showerWallHeightMm: c.membraneHeights.showerWallMm, upturnMm: c.membraneHeights.upturnMm, wholeFloor: true });
    assert.equal(wet.problems.length, 0);
    for (const m of c.catalogue.membranes) {
      const mem = calcMembrane({ surfaces: wet.surfaces, litresPerM2PerCoat: m.litresPerM2PerCoat, coats: m.coats, packLitres: m.packL, primerM2PerLitre: c.extras.primerM2PerLitre, primerPackLitres: null, tapeRunMm: wet.tapeMm, tapeRollMm: c.extras.tapeRollMm, system, packUnit: m.packUnit });
      assert.ok(mem.ok && mem.value.packs >= 1, m.id);
    }
    const falls = calcFalls({ drain: 'point', lengthMm: 1200, widthMm: 900, minRatio: c.falls.min, maxRatio: c.falls.max, system });
    assert.ok(falls.ok && falls.value.rise > 0);
    const trim = calcTrim({ runsMm: [2400, 1800, 900], stockMm: c.trimStockMm[0], allowanceMm: 5, system });
    assert.ok(trim.ok && trim.value.lengths >= 2);
    const stairs = calcStairs({ steps: 13, widthMm: 900, goingMm: 280, riserMm: 180, tileRisers: true, tileLengthMm: tile.lengthMm, tileWidthMm: tile.widthMm, jointMm: c.jointMm.floor, buildUpMm: 12, floorRaisedAtFoot: true, landingTiled: true, nosingStockMm: c.trimStockMm[0], limits: c.stairs, system });
    assert.ok(stairs.ok);
    // A comfortable 180 / 280 stair passes every country's code that sets limits.
    assert.deepEqual(stairs.value.issues, [], `${c.code}: ${stairs.value.issues.join(' ')}`);
  });
}

test('AU uses the NCC 2022 falls (1:80 to 1:50), not the old 1:60', () => {
  const au = getCountry('AU');
  assert.equal(au.falls.min, 80);
  assert.equal(au.falls.max, 50);
  const r = calcFalls({ drain: 'point', basis: 'valley', lengthMm: 900, widthMm: 900, minRatio: 80, maxRatio: 50, system: 'metric' });
  // Valley basis: diagonal 636.4 / 80 = 7.95 mm; plane 450 / 7.95 = 1:56.6, within 1:50, so not too steep.
  assert.ok(r.ok);
  assert.ok(Math.abs(r.value.rise - 7.955) < 0.01);
  assert.equal(r.value.tooSteep, false);
  // Plane basis (code wording): 450 / 80 = 5.625 mm, planes exactly 1:80.
  const p = calcFalls({ drain: 'point', lengthMm: 900, widthMm: 900, minRatio: 80, maxRatio: 50, system: 'metric' });
  assert.ok(p.ok && Math.abs(p.value.rise - 5.625) < 1e-9 && !p.value.tooSteep);
});

test('US slope is 1/4 to 1/2 in per ft and stair riser 7 3/4 in', () => {
  const us = getCountry('US');
  assert.equal(us.falls.min, 48);
  assert.equal(us.falls.max, 24);
  assert.ok(Math.abs(us.stairs!.riserMax - 196.85) < 0.01);
  const r = calcStairs({ steps: 3, widthMm: 900, goingMm: 254, riserMm: 200, tileRisers: false, tileLengthMm: 300, tileWidthMm: 300, jointMm: 3, buildUpMm: 0, floorRaisedAtFoot: true, landingTiled: true, nosingStockMm: 2500, limits: us.stairs, system: 'imperial' });
  assert.ok(r.ok && r.value.issues.some(i => /riser/i.test(i)));
});

test('UK calls waterproofing tanking; US calls adhesive thinset; AU spells colour', () => {
  assert.equal(getCountry('GB').terms.waterproofing, 'Tanking');
  assert.equal(getCountry('US').terms.adhesive, 'Thinset');
  assert.equal(getCountry('US').terms.colour, 'color');
  assert.equal(getCountry('AU').terms.colour, 'colour');
});
