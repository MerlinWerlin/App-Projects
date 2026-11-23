// Every country path: defaults, spelling, standards, pipe series and the generic fallback.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeNote, COUNTRIES, COUNTRY_CODES, countryFromRegion, ISO_PIPES, money, NPS_PIPES, parseCountry } from './country.ts';
import { parsePrefs } from './jobs.ts';
import { spell } from './spell.ts';

test('device region picks a supported country, anything else is OTHER', () => {
  assert.equal(countryFromRegion('AU'), 'AU');
  assert.equal(countryFromRegion('nz'), 'NZ');
  assert.equal(countryFromRegion('UK'), 'GB');
  assert.equal(countryFromRegion('GB'), 'GB');
  assert.equal(countryFromRegion('IE'), 'IE');
  assert.equal(countryFromRegion('US'), 'US');
  assert.equal(countryFromRegion('CA'), 'CA');
  assert.equal(countryFromRegion('DE'), 'OTHER');
  assert.equal(countryFromRegion(null), 'OTHER');
  assert.equal(parseCountry('AU'), 'AU');
  assert.equal(parseCountry('XX'), null);
  assert.equal(parseCountry(3), null);
});

test('each country sets units, paper, currency, spelling and standards', () => {
  const want: Record<string, [string, string, string | null, string, string | null]> = {
    AU: ['metric', 'a4', 'AUD', 'intl', 'AS/NZS 1554.1'],
    NZ: ['metric', 'a4', 'NZD', 'intl', 'AS/NZS 1554.1'],
    GB: ['metric', 'a4', 'GBP', 'intl', 'BS EN 1090-2 and BS EN ISO 5817'],
    IE: ['metric', 'a4', 'EUR', 'intl', 'EN 1090-2 and EN ISO 5817'],
    US: ['imperial', 'letter', 'USD', 'us', 'AWS D1.1'],
    CA: ['imperial', 'letter', 'CAD', 'intl', 'CSA W59'],
    OTHER: ['metric', 'a4', null, 'intl', null],
  };
  for (const c of COUNTRY_CODES) {
    const i = COUNTRIES[c];
    assert.deepEqual([i.units, i.paper, i.currency?.code ?? null, i.spelling, i.standards?.welding ?? null], want[c], c);
    assert.ok(i.pipes.length >= 12, c);
    assert.ok(codeNote(i).length > 20);
  }
  assert.equal(codeNote(COUNTRIES.US), 'For structural work follow AWS D1.1 and the engineer\'s drawings.');
  assert.match(codeNote(COUNTRIES.OTHER), /local welding code/);
  assert.equal(money(12.5, COUNTRIES.GB), '£12.50');
  assert.equal(money(12.5, COUNTRIES.OTHER), '12.50');
});

test('pipe series: ISO ODs for AU/NZ/UK/IE/other, ASME NPS for US and Canada', () => {
  assert.equal(COUNTRIES.OTHER.pipes, ISO_PIPES);
  for (const c of ['AU', 'NZ', 'GB', 'IE'] as const) assert.deepEqual(COUNTRIES[c].pipes.map(p => p.od), ISO_PIPES.map(p => p.od));
  for (const c of ['US', 'CA'] as const) assert.equal(COUNTRIES[c].pipes, NPS_PIPES);
  const nps = (n: string) => NPS_PIPES.find(p => p.label === `NPS ${n}`)!;
  // ASME B36.10M: NPS 2 = 2.375 in OD, Sch 40 0.154 in, Sch 80 0.218 in; NPS 4 = 4.500 in, 0.237 / 0.337 in.
  assert.ok(Math.abs(nps('2').od - 60.325) < 1e-9);
  assert.ok(Math.abs(nps('2').walls!['Sch 40'] - 3.9116) < 1e-9);
  assert.ok(Math.abs(nps('2').walls!['Sch 80'] - 5.5372) < 1e-9);
  assert.ok(Math.abs(nps('4').od - 114.3) < 1e-9);
  assert.ok(Math.abs(nps('4').walls!['Sch 40'] - 6.0198) < 1e-9);
  assert.equal(NPS_PIPES.length, 15);
  for (const p of NPS_PIPES) assert.ok(p.walls!['Sch 80'] > p.walls!['Sch 40'] && p.walls!['Sch 40'] < p.od / 2);
  assert.equal(ISO_PIPES.find(p => p.label === 'DN25')!.od, 33.7);
});

test('US spelling only for US users', () => {
  const s = 'Mitre both ends: 2 metres of aluminium, centreline 3 millimetres, colour';
  assert.equal(spell(s, 'us'), 'Miter both ends: 2 meters of aluminum, centerline 3 millimeters, color');
  assert.equal(spell(s, 'intl'), s);
  assert.equal(spell('Frame mitres', 'us'), 'Frame miters');
  assert.equal(spell('CENTRE', 'us'), 'CENTER');
  assert.equal(spell('Metres', 'us'), 'Meters');
  assert.equal(spell('perimetre', 'us'), 'perimetre'); // whole words only
});

test('country is remembered and corrupt prefs fall back to asking again', () => {
  assert.equal(parsePrefs('{"country":"NZ","units":"metric"}').country, 'NZ');
  assert.equal(parsePrefs('{"country":"ZZ"}').country, null);
  assert.equal(parsePrefs('nonsense').country, null);
  assert.equal(parsePrefs(null).country, null);
});
