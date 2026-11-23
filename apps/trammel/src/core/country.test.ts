// Every country path: region detection, units, trade words, money, and the stair code each one checks, with a worked
// example per code (expected values worked out by hand from the cited tables).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COUNTRIES, countryFromRegion, formatMoney, GUIDED, parseCountry } from './country.ts';
import { stairCodesFor, stairLimitsById, STAIR_CODES } from './stairCodes.ts';
import { goingRangeFor, planStair } from './stairs.ts';
import { localTool, toolById } from './tools.ts';
import { METRIC as F } from './units.ts';

const fails = (r: ReturnType<typeof planStair>) => (r.ok ? r.checks.filter((c) => c.level === 'fail').map((c) => c.text) : ['error']);
const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test('device region picks the country; unguided regions fall back to generic', () => {
  assert.equal(countryFromRegion('AU'), 'AU');
  assert.equal(countryFromRegion('nz'), 'NZ');
  assert.equal(countryFromRegion('GB'), 'GB');
  assert.equal(countryFromRegion('UK'), 'GB');
  assert.equal(countryFromRegion('IE'), 'IE');
  assert.equal(countryFromRegion('US'), 'US');
  assert.equal(countryFromRegion('CA'), 'CA');
  assert.equal(countryFromRegion('FR'), 'OTHER');
  assert.equal(countryFromRegion(''), 'OTHER');
  assert.equal(countryFromRegion(null), 'OTHER');
  assert.equal(parseCountry('US'), 'US');
  assert.equal(parseCountry('XX'), null);
  assert.equal(parseCountry(5), null);
});

test('units, words and money follow the country', () => {
  assert.equal(COUNTRIES.US.units, 'imperial');
  for (const c of ['AU', 'NZ', 'GB', 'IE', 'CA', 'OTHER'] as const) assert.equal(COUNTRIES[c].units, 'metric');
  const mitre = toolById('mitre')!;
  const crown = toolById('crown')!;
  const layout = toolById('layout')!;
  assert.equal(localTool(mitre, COUNTRIES.AU.terms).name, 'Mitre');
  assert.equal(localTool(mitre, COUNTRIES.US.terms).name, 'Miter');
  assert.equal(localTool(mitre, COUNTRIES.CA.terms).name, 'Miter');
  assert.equal(localTool(crown, COUNTRIES.AU.terms).name, 'Cornice & compound');
  assert.equal(localTool(crown, COUNTRIES.GB.terms).name, 'Coving & compound');
  assert.equal(localTool(crown, COUNTRIES.US.terms).name, 'Crown & compound');
  assert.match(localTool(layout, COUNTRIES.NZ.terms).blurb, /dwang/);
  assert.match(localTool(layout, COUNTRIES.US.terms).blurb, /blocking/);
  assert.match(localTool(toolById('stairs')!, COUNTRIES.US.terms).blurb, /run/);
  assert.match(formatMoney(12.5, 'AU'), /12\.50/);
  assert.match(formatMoney(12.5, 'IE'), /€/);
  assert.match(formatMoney(12.5, 'GB'), /£/);
  assert.equal(formatMoney(12.5, 'OTHER'), '12.50');
  assert.deepEqual(COUNTRIES.NZ.spacings, [400, 480, 600]);
  near(COUNTRIES.US.spacings[1], 406.4);
});

test('every guided country checks a real code with a source; anywhere else is guidance only', () => {
  for (const c of GUIDED) {
    const codes = stairCodesFor(c);
    assert.ok(codes.length >= 2, c);
    for (const l of codes) {
      if (l.id === 'gb-other') {
        assert.equal(l.binding, false); // Scotland, Wales, NI: not checked, guidance only
        continue;
      }
      assert.equal(l.binding, true, l.id);
      assert.ok(l.source.length > 8, l.id);
      assert.ok(l.rMax != null && l.gMin != null, `${l.id} sets a max riser and min going`);
    }
    assert.equal(new Set(codes.map((l) => l.id)).size, codes.length);
  }
  assert.equal(stairCodesFor('OTHER')[0].binding, false);
  assert.equal(stairLimitsById('AU', 'nope').id, 'au-house');
  assert.equal(Object.keys(STAIR_CODES).length, 7);
});

test('NZ: main private 2700 rise, going lifted to the 280 minimum, 4 m flight; common stair needs a landing', () => {
  const main = stairLimitsById('NZ', 'nz-main');
  const r = planStair({ limits: main, totalRise: 2700 }, F);
  assert.ok(r.ok);
  assert.equal(r.value.risers, 15);
  near(r.value.going, 280);
  near(r.value.angle, 32.735, 0.01);
  assert.deepEqual(fails(r), []);
  assert.ok(fails(planStair({ limits: stairLimitsById('NZ', 'nz-common'), totalRise: 2700 }, F)).some((t) => /landing/.test(t)));
  assert.ok(fails(planStair({ limits: main, totalRise: 2700, risers: 13 }, F)).some((t) => /Riser/.test(t))); // 207.7 > 190
  // Pitch: 190 riser on a 240 going is 38.4 deg, over the 37 deg limit
  assert.ok(fails(planStair({ limits: main, totalRise: 2850, risers: 15, going: 290 }, F)).length === 0);
  assert.ok(fails(planStair({ limits: stairLimitsById('NZ', 'nz-secondary'), totalRise: 2850, risers: 15, going: 240 }, F)).some((t) => /Going|Pitch/.test(t)));
  // The going range honours the pitch limit: 180 riser at 37 deg needs at least 238.9, raised to 280 by the table
  assert.deepEqual(goingRangeFor(180, main)?.min, 280);
});

test('England: private stair 15 x 180 passes; 12 risers (225) and a 200 going fail; utility stair over 16 risers fails', () => {
  const priv = stairLimitsById('GB', 'gb-private');
  const ok = planStair({ limits: priv, totalRise: 2700 }, F);
  assert.ok(ok.ok);
  assert.equal(ok.value.risers, 15);
  assert.deepEqual(fails(ok), []);
  assert.ok(fails(planStair({ limits: priv, totalRise: 2700, risers: 12 }, F)).some((t) => /Riser/.test(t)));
  assert.ok(fails(planStair({ limits: priv, totalRise: 2700, going: 200 }, F)).some((t) => /Going/.test(t)));
  // steep private stair: 220 riser, 220 going is 45 deg, over 42
  assert.ok(fails(planStair({ limits: priv, totalRise: 2640, risers: 12, going: 220 }, F)).some((t) => /Pitch/.test(t)));
  assert.ok(fails(planStair({ limits: stairLimitsById('GB', 'gb-utility'), totalRise: 3060, risers: 17 }, F)).some((t) => /landing/.test(t)));
});

test('Ireland: private stair passes; 17 risers exceeds 16 a flight; public stair needs a 280 going', () => {
  const priv = stairLimitsById('IE', 'ie-private');
  assert.deepEqual(fails(planStair({ limits: priv, totalRise: 2700 }, F)), []);
  assert.ok(fails(planStair({ limits: priv, totalRise: 3060, risers: 17 }, F)).some((t) => /landing/.test(t)));
  assert.ok(fails(planStair({ limits: stairLimitsById('IE', 'ie-public'), totalRise: 2700, going: 270 }, F)).some((t) => /Going/.test(t)));
});

test('USA: IRC dwelling 108 in rise passes; IBC caps the riser at 7 in and needs an 11 in tread', () => {
  const irc = stairLimitsById('US', 'us-irc');
  const rise = 108 * 25.4;
  const r = planStair({ limits: irc, totalRise: rise }, F, 'Run');
  assert.ok(r.ok);
  assert.equal(r.value.risers, 16); // 2743.2 / 175 = 15.7 -> 16 risers of 171.45
  near(r.value.riser, 171.45);
  assert.deepEqual(fails(r), []);
  assert.ok(fails(planStair({ limits: irc, totalRise: rise, risers: 13 }, F)).some((t) => /Riser/.test(t))); // 211 > 196.85
  const ibc = stairLimitsById('US', 'us-ibc');
  assert.ok(fails(planStair({ limits: ibc, totalRise: rise, risers: 15 }, F)).some((t) => /Riser/.test(t))); // 182.9 > 177.8
  assert.ok(fails(planStair({ limits: ibc, totalRise: rise, risers: 16, going: 270 }, F)).some((t) => /Going/.test(t)));
  assert.ok(fails(planStair({ limits: ibc, totalRise: 3800 }, F)).some((t) => /landing/.test(t))); // over 12 ft
  assert.equal(r.ok && r.checks.some((c) => /2R\+G/.test(c.text)), false); // no 2R+G rule in the US codes
});

test('Canada: private stair 15 x 180 at 270 passes; public stair needs a 280 run and a 180 max riser', () => {
  const priv = stairLimitsById('CA', 'ca-private');
  assert.deepEqual(fails(planStair({ limits: priv, totalRise: 2700 }, F)), []);
  assert.ok(fails(planStair({ limits: priv, totalRise: 2700, going: 360 }, F)).some((t) => /Going/.test(t)));
  const pub = stairLimitsById('CA', 'ca-public');
  const r = planStair({ limits: pub, totalRise: 2700 }, F);
  assert.ok(r.ok);
  near(r.value.going, 280);
  assert.deepEqual(fails(r), []);
  assert.ok(fails(planStair({ limits: pub, totalRise: 2700, risers: 14 }, F)).some((t) => /Riser/.test(t))); // 192.9 > 180
});

test('anywhere else: no code is claimed, so nothing fails, only notes', () => {
  const g = stairLimitsById('OTHER', undefined);
  const r = planStair({ limits: g, totalRise: 2700, going: 200, risers: 10 }, F);
  assert.ok(r.ok);
  assert.deepEqual(fails(r), []);
  assert.ok(r.checks.some((c) => c.level === 'warn' && /2R\+G/.test(c.text)));
  assert.ok(r.checks.some((c) => /local building code/.test(c.text)));
});
