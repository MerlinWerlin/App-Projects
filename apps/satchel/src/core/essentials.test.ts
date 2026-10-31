import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { EmergencyTable } from './emergency.ts';
import {
  adapterHint,
  CALLING_CODE,
  displayEssentials,
  findEssentials,
  isIsoDate,
  normaliseHome,
  PLUG_LETTERS,
  rowProblems,
  voltageBandsDiffer,
  type EssentialsRow,
  type EssentialsTable,
} from './essentials.ts';

const table = JSON.parse(readFileSync(new URL('../content/country_essentials.json', import.meta.url), 'utf8')) as EssentialsTable;
const emergency = JSON.parse(readFileSync(new URL('../content/emergency_numbers.json', import.meta.url), 'utf8')) as EmergencyTable;
const get = (iso2: string) => {
  const r = findEssentials(table, iso2);
  assert.ok(r, iso2);
  return r;
};

const row = (over: Partial<EssentialsRow>): EssentialsRow => ({
  iso2: 'ZZ',
  country: 'Testland',
  plugs: ['C', 'F'],
  voltage: [230],
  frequency: [50],
  driving: 'right',
  calling_code: '+999',
  sources: ['https://www.iec.ch/world-plugs'],
  checked: '2026-10-31',
  ...over,
});

test('every country in emergency_numbers.json has exactly one essentials row, and no extras', () => {
  const want = emergency.countries.map((r) => r.iso2).sort();
  const have = table.countries.map((r) => r.iso2).sort();
  assert.deepEqual(have, want);
  assert.equal(new Set(have).size, have.length, 'duplicate rows');
});

test('every row has https sources and an ISO checked date', () => {
  for (const r of table.countries) {
    assert.ok(Array.isArray(r.sources) && r.sources.length > 0, `${r.iso2} sources`);
    for (const u of r.sources) assert.match(u, /^https:\/\/[^\s/]+/, `${r.iso2} source ${u}`);
    assert.match(r.checked, /^\d{4}-\d{2}-\d{2}$/, `${r.iso2} checked`);
    assert.ok(isIsoDate(r.checked), `${r.iso2} checked is a real date`);
  }
});

test('plug letters are IEC A–N only, no duplicates', () => {
  const allowed = new Set<string>(PLUG_LETTERS);
  for (const r of table.countries) {
    if (r.plugs === null) continue;
    assert.ok(r.plugs.length > 0, `${r.iso2} empty plug list (use null)`);
    for (const p of r.plugs) assert.ok(allowed.has(p), `${r.iso2} plug ${p}`);
    assert.equal(new Set(r.plugs).size, r.plugs.length, `${r.iso2} duplicate plug`);
  }
});

test('voltage and frequency are in sane ranges or null', () => {
  for (const r of table.countries) {
    if (r.voltage !== null) for (const v of r.voltage) assert.ok(v >= 100 && v <= 240, `${r.iso2} voltage ${v}`);
    if (r.frequency !== null) for (const f of r.frequency) assert.ok(f === 50 || f === 60, `${r.iso2} frequency ${f}`);
  }
});

test("driving side is 'left' | 'right' | null and calling code is +digits or null", () => {
  for (const r of table.countries) {
    assert.ok(r.driving === null || r.driving === 'left' || r.driving === 'right', `${r.iso2} driving ${r.driving}`);
    if (r.calling_code !== null) assert.match(r.calling_code, CALLING_CODE, `${r.iso2} calling code`);
  }
});

test('every row passes rowProblems', () => {
  const bad = table.countries.map((r) => ({ iso2: r.iso2, p: rowProblems(r) })).filter((x) => x.p.length);
  assert.deepEqual(bad, []);
});

test('hand-checked sample matches the table (docs/research/COUNTRY_ESSENTIALS.md)', () => {
  const sample: Record<string, [string[] | null, number[] | null, number[] | null, 'left' | 'right' | null, string | null]> = {
    AU: [['I'], [230], [50], 'left', '+61'],
    JP: [['A', 'B'], [100], [50, 60], 'left', '+81'],
    US: [['A', 'B'], [120], [60], 'right', '+1'],
    GB: [['G'], [230], [50], 'left', '+44'],
    IN: [['C', 'D', 'M'], [230], [50], 'left', '+91'],
    BR: [['C', 'N'], [127, 220], [60], 'right', '+55'],
    ZA: [['C', 'D', 'M', 'N'], [230], [50], 'left', '+27'],
    TH: [['A', 'B', 'C', 'F'], [230], [50], 'left', '+66'],
    DE: [['C', 'F'], [230], [50], 'right', '+49'],
    FR: [['C', 'E'], [230], [50], 'right', '+33'],
    IT: [['C', 'F', 'L'], [230], [50], 'right', '+39'],
    CN: [['A', 'C', 'I'], [220], [50], 'right', '+86'],
    KR: [['C', 'F'], [220], [60], 'right', '+82'],
    ID: [['C', 'F'], [230], [50], 'left', '+62'],
    AE: [['C', 'D', 'G'], [230], [50], 'right', '+971'],
    NZ: [['I'], [230], [50], 'left', '+64'],
    MX: [['A', 'B'], [127], [60], 'right', '+52'],
    SG: [['G'], [230], [50], 'left', '+65'],
    CH: [['C', 'J'], [230], [50], 'right', '+41'],
  };
  for (const [iso2, [plugs, voltage, frequency, driving, cc]] of Object.entries(sample)) {
    const r = get(iso2);
    assert.deepEqual([r.plugs, r.voltage, r.frequency, r.driving, r.calling_code], [plugs, voltage, frequency, driving, cc], iso2);
  }
});

test('display: formats values, collapses unknowns to null, lists source hosts', () => {
  const jp = displayEssentials(get('JP'));
  assert.equal(jp.plugs, 'A, B');
  assert.equal(jp.voltage, '100 V');
  assert.equal(jp.frequency, '50 / 60 Hz');
  assert.equal(jp.driving, 'left');
  assert.equal(jp.callingCode, '+81');
  assert.ok(jp.sourceHosts.includes('iec.ch'));
  assert.equal(jp.checked, '2026-10-31');
  assert.equal(jp.unknownCount, 0);
  assert.equal(jp.verifyLocally, true);
  assert.equal(displayEssentials(get('BR')).voltage, '127 / 220 V');

  const blank = displayEssentials(row({ plugs: null, voltage: null, frequency: null, driving: null, calling_code: null }));
  assert.deepEqual([blank.plugs, blank.voltage, blank.frequency, blank.driving, blank.callingCode], [null, null, null, null, null]);
  assert.equal(blank.unknownCount, 5);
});

test('display: malformed values never show as facts', () => {
  const bad = row({ plugs: ['Z'], voltage: [5000], frequency: [400], driving: 'middle' as never, calling_code: '81', checked: '2026-02-30', sources: ['http://x.org'] });
  assert.deepEqual(rowProblems(bad).sort(), ['calling_code', 'checked', 'driving', 'frequency', 'plugs', 'sources', 'voltage']);
  const d = displayEssentials(bad);
  assert.deepEqual([d.plugs, d.voltage, d.frequency, d.driving, d.callingCode, d.checked], [null, null, null, null, null, null]);
  assert.deepEqual(d.sourceHosts, []);
  assert.deepEqual(rowProblems(row({ plugs: [] })), ['plugs']);
  assert.deepEqual(rowProblems(row({ plugs: ['C', 'C'] })), ['plugs-duplicate']);
  assert.equal(CALLING_CODE.test('+12345'), false);
});

test('adapter hint: same country, fits, some, adapter, unknown', () => {
  assert.equal(adapterHint(get('AU'), get('AU')).verdict, 'same');
  // Australia (I) at home, New Zealand (I) away: fits.
  assert.equal(adapterHint(get('NZ'), get('AU')).verdict, 'fits');
  // Australia (I) to Japan (A, B): adapter.
  assert.equal(adapterHint(get('JP'), get('AU')).verdict, 'adapter');
  // US (A, B) to Japan (A, B): fits (but US B plugs need a B socket; Japan lists B).
  assert.equal(adapterHint(get('JP'), get('US')).verdict, 'fits');
  // Germany (C, F) to France (C, E): C fits, F doesn't -> some.
  const deFr = adapterHint(get('FR'), get('DE'));
  assert.equal(deFr.verdict, 'some');
  assert.deepEqual(deFr.fitting, ['C']);
  // Germany (C, F) to the UK (G): adapter.
  assert.equal(adapterHint(get('GB'), get('DE')).verdict, 'adapter');
  // Unknown plugs on either side.
  assert.equal(adapterHint(row({ plugs: null }), get('AU')).verdict, 'unknown');
  assert.equal(adapterHint(get('AU'), row({ plugs: null })).verdict, 'unknown');
  // Europlug fits type N (Brazil).
  assert.equal(adapterHint(row({ plugs: ['N'] }), row({ iso2: 'YY', plugs: ['C'] })).verdict, 'fits');
});

test('adapter hint: voltage bands', () => {
  assert.equal(adapterHint(get('GB'), get('US')).voltageDiffers, true);
  assert.equal(adapterHint(get('US'), get('JP')).voltageDiffers, false);
  assert.equal(adapterHint(get('DE'), get('AU')).voltageDiffers, false);
  // Brazil has both bands, so it never differs from either.
  assert.equal(voltageBandsDiffer([120], [127, 220]), false);
  assert.equal(voltageBandsDiffer(null, [230]), false);
});

test('normaliseHome keeps only known codes', () => {
  assert.equal(normaliseHome(table, 'au'), 'AU');
  assert.equal(normaliseHome(table, 'ZZ'), null);
  assert.equal(normaliseHome(table, 42), null);
  assert.equal(normaliseHome(table, null), null);
});
