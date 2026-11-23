import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, COUNTRY_ORDER, countryFromRegion, profile } from './country.ts';
import { barMassPerM } from './reo.ts';

const RETAILERS = /bunnings|mitre ?10|home ?depot|lowe'?s|rona|wickes|b&q|travis|jewson|selco|mkm|toolstation|mcmahons|woodies|chadwicks|placemakers|boral|holcim|firth|quikrete|sakrete|marshalls|kilsaran|adbri|pavestone|oldcastle|infrabuild|blue circle|roadstone/i;

test('device region picks the country, anything else is generic', () => {
  assert.equal(countryFromRegion('AU'), 'AU');
  assert.equal(countryFromRegion('nz'), 'NZ');
  assert.equal(countryFromRegion('GB'), 'GB');
  assert.equal(countryFromRegion('UK'), 'GB');
  assert.equal(countryFromRegion('IE'), 'IE');
  assert.equal(countryFromRegion('US'), 'US');
  assert.equal(countryFromRegion('CA'), 'CA');
  assert.equal(countryFromRegion('DE'), 'XX');
  assert.equal(countryFromRegion(undefined), 'XX');
  assert.equal(profile(null).code, 'AU');
});

test('units follow local practice', () => {
  assert.equal(COUNTRIES.US.units, 'imperial');
  for (const c of ['AU', 'NZ', 'GB', 'IE', 'CA', 'XX'] as const) assert.equal(COUNTRIES[c].units, 'metric', c);
});

test('every country has sane catalogues, with no retailer or maker names in what the UI shows', () => {
  for (const code of COUNTRY_ORDER) {
    const c = COUNTRIES[code];
    assert.ok(c.bags.length && c.mesh.length && c.bars.length && c.pavers.length && c.blocks.length && c.materials.length, code);
    assert.ok(c.order.increment > 0 && c.order.increment < 1 && c.order.truck >= 3 && c.order.truck <= 10, `${code} order`);
    for (const b of c.bags) {
      assert.ok(b.kg > 5 && b.kg < 50, `${code} ${b.id} kg`);
      // makers' yields sit at 0.00042–0.00052 m³ per kg of dry mix
      if (b.yieldM3) assert.ok(b.yieldM3 / b.kg > 0.0004 && b.yieldM3 / b.kg < 0.00053, `${code} ${b.id} yield ${b.yieldM3 / b.kg}`);
    }
    for (const m of c.mesh) assert.ok(m.length > m.width && m.width > 0.9 && m.lap > 0.1 && m.lap < m.width / 2, `${code} ${m.id}`);
    for (const b of c.bars) assert.ok(b.d >= 9 && b.d <= 20 && b.stock >= 3 && b.stock <= 12.5, `${code} ${b.id}`);
    for (const p of c.pavers) assert.ok(p.length >= p.width && p.width >= 0.09 && p.length <= 0.61, `${code} ${p.id}`);
    for (const b of c.blocks) assert.ok(b.length > 0.25 && b.height >= 0.1 && b.depth > 0.15, `${code} ${b.id}`);
    for (const m of c.materials) assert.ok(m.density >= 0.3 && m.density <= 2.5 && m.compactPct >= 0 && m.compactPct <= 30, `${code} ${m.id}`);
    assert.ok(c.falls.presets.length >= 2 && c.falls.presets.every(p => p.ratio >= 10 && p.ratio <= 200), `${code} falls`);
    const shown = [...c.bags.map(x => x.label), ...c.mesh.map(x => x.label), ...c.bars.map(x => x.label), ...c.pavers.map(x => x.label), ...c.blocks.map(x => x.label), ...c.materials.map(x => x.name), ...c.falls.presets.map(p => p.detail), c.falls.buildingNote, c.wallNote ?? '', ...Object.values(c.terms)].join(' | ');
    assert.ok(!RETAILERS.test(shown), `${code} shows a retailer or maker name: ${shown.match(RETAILERS)?.[0]}`);
  }
});

test('country values match their sources', () => {
  // Boral: 108 × 20 kg bags per m³
  assert.ok(Math.abs(COUNTRIES.AU.bags[0]!.yieldM3! - 1 / 108) < 1e-12);
  // Quikrete 80 lb = 0.60 ft³
  const q = COUNTRIES.US.bags.find(b => b.id === '80lb')!;
  assert.ok(Math.abs(q.yieldM3! - 0.0169901) < 1e-6 && Math.abs(q.kg - 36.287) < 1e-3);
  // US ready-mix in ½ yd³ steps
  assert.ok(Math.abs(COUNTRIES.US.order.increment - 0.382277) < 1e-5);
  // #4 bar 20 ft weighs 13.36 lb (Home Depot) → nominal mass of a ½ in bar
  const n4 = COUNTRIES.US.bars.find(b => b.id === '#4')!;
  const lb = (barMassPerM(n4.d) * n4.stock) / 0.45359237;
  assert.ok(Math.abs(lb - 13.36) < 0.05, `#4 20 ft = ${lb} lb`);
  // UK T12 6 m = 5.328 kg (Travis Perkins)
  const h12 = COUNTRIES.GB.bars.find(b => b.id === 'H12')!;
  assert.ok(Math.abs(barMassPerM(h12.d) * h12.stock - 5.328) < 0.01);
  // #57 stone 1.4 short tons per yd³ ≈ 1.66 t/m³; NRCan stone 1.35 t per yd³ ≈ 1.77 t/m³
  assert.ok(Math.abs(COUNTRIES.US.materials[0]!.density - 1.661) < 0.002);
  assert.ok(Math.abs(COUNTRIES.CA.materials[0]!.density - 1.766) < 0.002);
  // IRC R401.3: 6 in in 10 ft = 1:20; NCC: 50 mm in 1 m = 1:20
  assert.equal(COUNTRIES.US.falls.presets[0]!.ratio, 20);
  assert.equal(COUNTRIES.AU.falls.presets[0]!.ratio, 20);
  // Approved Document K private stair 2R + G 550–700
  assert.deepEqual(COUNTRIES.GB.stairs!.twoRG, [0.55, 0.7]);
});

test('unverified catalogues are flagged generic, never silently local', () => {
  assert.ok(COUNTRIES.GB.generic.includes('blocks') && COUNTRIES.IE.generic.includes('blocks'));
  assert.ok(COUNTRIES.IE.generic.includes('stairs') && COUNTRIES.IE.stairs === undefined);
  assert.ok(COUNTRIES.NZ.generic.includes('falls'));
  assert.equal(COUNTRIES.XX.verified, false);
  for (const code of ['AU', 'NZ', 'GB', 'IE', 'US', 'CA'] as const) assert.equal(COUNTRIES[code].verified, true);
});
