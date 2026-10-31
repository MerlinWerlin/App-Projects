// T48 (owner feedback 2026-10-31): no country may ever show a blank emergency card.
// Every row needs a dialable number, a source URL and a checked date, and numbers must be plain digits.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CORE_SERVICES, displayRow, FALLBACK_NUMBER, hasDialable, PLAIN_NUMBER, SERVICES, sourceOf, type EmergencyRow, type EmergencyTable } from '../core/emergency.ts';

const table = JSON.parse(readFileSync(new URL('./emergency_numbers.json', import.meta.url), 'utf8')) as EmergencyTable;

test('every country has at least one dialable number in general / police / ambulance / fire', () => {
  const blank = table.countries.filter((r) => !hasDialable(r)).map((r) => r.iso2);
  assert.deepEqual(blank, [], `countries with no number: ${blank.join(' ')}`);
  for (const r of table.countries) assert.equal(displayRow(r).noNumber, false, r.iso2);
});

test('the 23 rows the owner saw blank (Afghanistan, Angola, ...) now show numbers', () => {
  const was = 'AF AO CD CF CV EH ER GQ GS GW KP LS LY PN SH SL SO SS ST SY TK TV YE'.split(' ');
  for (const iso2 of was) {
    const r = table.countries.find((x) => x.iso2 === iso2);
    assert.ok(r, iso2);
    assert.ok(displayRow(r).lines.length > 0, iso2);
    assert.ok(r.notes && r.notes.trim(), `${iso2} needs a note`);
    assert.notEqual(r.confidence, 'high', `${iso2} filled from public lists cannot be high confidence`);
  }
  const af = table.countries.find((x) => x.iso2 === 'AF')!;
  assert.equal(af.police, '119');
  const ao = table.countries.find((x) => x.iso2 === 'AO')!;
  assert.deepEqual([ao.police, ao.ambulance, ao.fire], ['113', '112', '115']);
});

test('every row has an https source URL and a real checked date, so "source pending" never shows', () => {
  for (const r of table.countries) {
    assert.equal(typeof r.source_url, 'string', `${r.iso2} source_url`);
    assert.match(String(r.source_url), /^https:\/\//, r.iso2);
    assert.match(String(r.source_checked), /^\d{4}-\d{2}-\d{2}$/, `${r.iso2} source_checked`);
    assert.equal(sourceOf(r).kind, 'checked', r.iso2);
    if (/wikipedia\.org/.test(String(r.source_url))) assert.match(String(r.notes), /not an official national source/, `${r.iso2} must say the source is a public list`);
  }
});

test('every number is plain digits (no spaces, letters, +, * or #)', () => {
  for (const r of table.countries) {
    for (const s of SERVICES) {
      const n = r[s];
      if (n !== null) assert.match(n, PLAIN_NUMBER, `${r.iso2} ${s} "${n}"`);
    }
  }
});

test('display: missing services are reported with the general number that covers them', () => {
  const base: EmergencyRow = { iso2: 'ZZ', country: 'Testland', general: null, police: null, ambulance: null, fire: null, tourist_police: null, notes: null, source_url: null, source_checked: null, confidence: 'low' };
  const onlyGeneral = displayRow({ ...base, general: '112' });
  assert.deepEqual(onlyGeneral.missingServices, [...CORE_SERVICES]);
  assert.equal(onlyGeneral.coverNumber, '112');
  const policeOnly = displayRow({ ...base, police: '777' });
  assert.deepEqual(policeOnly.missingServices, ['ambulance', 'fire']);
  assert.equal(policeOnly.coverNumber, null);
  const nothing = displayRow(base);
  assert.equal(nothing.noNumber, true);
  assert.equal(FALLBACK_NUMBER, '112');
  const full = displayRow({ ...base, general: '911', police: '911', ambulance: '911', fire: '911' });
  assert.deepEqual(full.missingServices, []);
});
