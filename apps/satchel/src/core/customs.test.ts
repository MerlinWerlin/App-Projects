// T115 local customs guide: lookup, section ordering, trip countries, search and row checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CUSTOMS_CHECKED,
  findCustoms,
  hasCustoms,
  pickCustomsCountry,
  rowProblems,
  searchCustoms,
  SECTION_ORDER,
  sectionsFor,
  sourceHosts,
  tripCustomsCountries,
  type CustomsRow,
  type CustomsTable,
} from './customs.ts';
import type { Item, ItemKind, Trip } from './model.ts';

const TABLE = JSON.parse(readFileSync(new URL('../content/customs.json', import.meta.url), 'utf8')) as CustomsTable;

const row = (over: Partial<CustomsRow> = {}): CustomsRow => ({
  iso2: 'ZZ',
  country: 'Testland',
  greetings: 'Hello.',
  shoes: 'Off.',
  dress: 'Modest.',
  photos: 'Ask.',
  gestures: 'None.',
  public: 'Queue.',
  alcohol: 'Licensed places.',
  water: 'yes',
  water_note: 'Fine.',
  good_to_know: ['One.', 'Two.'],
  sources: ['https://www.gov.uk/foreign-travel-advice/japan'],
  checked: '2026-11-01',
  recheck: false,
  ...over,
});
const table = (...rows: CustomsRow[]): CustomsTable => ({ version: 1, rule: 'verify locally', countries: rows });

test('findCustoms: case and spaces forgiven; unknown, empty and malformed codes give null', () => {
  assert.equal(findCustoms(TABLE, 'jp')?.country, 'Japan');
  assert.equal(findCustoms(TABLE, ' JP ')?.iso2, 'JP');
  assert.equal(findCustoms(TABLE, 'XX'), null);
  assert.equal(findCustoms(TABLE, ''), null);
  assert.equal(findCustoms(TABLE, null), null);
  assert.equal(findCustoms(TABLE, 'JPN'), null);
  assert.equal(hasCustoms(TABLE, 'fr'), true);
  assert.equal(hasCustoms(TABLE, 'AQ'), false);
});

test('pickCustomsCountry: first covered candidate wins', () => {
  assert.equal(pickCustomsCountry(TABLE, [null, 'AQ', 'th', 'JP']), 'TH');
  assert.equal(pickCustomsCountry(TABLE, [undefined, 'AQ']), null);
  assert.equal(pickCustomsCountry(TABLE, []), null);
});

test('sectionsFor: fixed order with every section, unsure (null) sections moved to the end', () => {
  const full = sectionsFor(row());
  assert.deepEqual(
    full.map((s) => s.id),
    [...SECTION_ORDER],
  );
  assert.ok(full.every((s) => s.known));
  const part = sectionsFor(row({ gestures: null, water: null, water_note: null, good_to_know: null }));
  assert.deepEqual(
    part.map((s) => `${s.id}${s.known ? '' : '?'}`),
    ['greetings', 'shoes', 'dress', 'photos', 'public', 'alcohol', 'water?', 'gestures?', 'good_to_know?'],
  );
});

test('sectionsFor: water carries its answer and note; blank text counts as unsure; good to know trimmed to 4', () => {
  const s = sectionsFor(row({ water: 'varies', water_note: '  ', greetings: '   ', good_to_know: ['a', ' ', 'b', 'c', 'd', 'e'] }));
  const water = s.find((x) => x.id === 'water');
  assert.deepEqual(water, { id: 'water', known: true, water: 'varies', note: null });
  assert.deepEqual(s.find((x) => x.id === 'greetings'), { id: 'greetings', known: false });
  assert.deepEqual(s.find((x) => x.id === 'good_to_know'), { id: 'good_to_know', known: true, lines: ['a', 'b', 'c', 'd'] });
  // An unexpected water value is treated as not sure, never shown as an answer.
  assert.equal(sectionsFor(row({ water: 'maybe' as never })).find((x) => x.id === 'water')?.known, false);
});

test('sourceHosts: hosts without www, deduplicated, bad URLs skipped', () => {
  assert.deepEqual(sourceHosts({ sources: ['https://www.gov.uk/foreign-travel-advice/japan', 'https://www.gov.uk/x', 'http://insecure.example', 'https://www.japan.travel/en/'] }), ['gov.uk', 'japan.travel']);
  assert.deepEqual(sourceHosts(findCustoms(TABLE, 'JP') as CustomsRow).slice(0, 2), ['gov.uk', 'japan.travel']);
});

let n = 0;
function item(kind: ItemKind, start: [string, string], end?: [string, string]): Item {
  n++;
  return { id: `i${n}`, tripId: 't', kind, title: `${kind} ${n}`, start: { local: start[0], tz: start[1] }, end: end ? { local: end[0], tz: end[1] } : undefined, attachments: [] };
}
const trip = (homeTz: string, items: Item[]): Trip => ({ id: 't1', name: 'Test', startDate: '2026-12-01', endDate: '2026-12-14', homeTz, items, createdAt: '2026-10-01T00:00:00Z' });

test('tripCustomsCountries: trip order, home left out, uncovered countries skipped, each once', () => {
  const t = trip('Australia/Sydney', [
    item('flight', ['2026-12-01T09:30', 'Australia/Sydney'], ['2026-12-01T17:45', 'Asia/Tokyo']),
    item('hotel', ['2026-12-01T19:30', 'Asia/Tokyo'], ['2026-12-04T11:00', 'Asia/Tokyo']),
    item('flight', ['2026-12-04T13:00', 'Asia/Tokyo'], ['2026-12-04T15:00', 'Asia/Seoul']),
    item('flight', ['2026-12-06T09:00', 'Asia/Seoul'], ['2026-12-06T12:00', 'Antarctica/McMurdo']),
    item('flight', ['2026-12-08T09:00', 'Antarctica/McMurdo'], ['2026-12-08T20:00', 'Asia/Tokyo']),
    item('flight', ['2026-12-09T09:00', 'Asia/Tokyo'], ['2026-12-09T21:00', 'Australia/Sydney']),
  ]);
  assert.deepEqual(
    tripCustomsCountries(t, 'AU', TABLE).map((r) => r.iso2),
    ['JP', 'KR'],
  );
  // Home counts too when the trip's home is somewhere else.
  assert.deepEqual(
    tripCustomsCountries(t, 'JP', TABLE).map((r) => r.iso2),
    ['AU', 'KR'],
  );
  assert.deepEqual(tripCustomsCountries(trip('Australia/Sydney', []), 'AU', TABLE), []);
  assert.deepEqual(tripCustomsCountries(t, 'AU', table()), []);
});

test('searchCustoms: covered countries only, code then prefix then word then contains; empty lists A-Z', () => {
  assert.equal(searchCustoms(TABLE, 'jp')[0].iso2, 'JP');
  assert.equal(searchCustoms(TABLE, 'new')[0].iso2, 'NZ');
  assert.ok(searchCustoms(TABLE, 'korea').some((r) => r.iso2 === 'KR'));
  assert.deepEqual(searchCustoms(TABLE, 'antarctica'), []);
  const all = searchCustoms(TABLE, '');
  assert.equal(all.length, TABLE.countries.length);
  assert.ok(all.every((r, i) => i === 0 || all[i - 1].country <= r.country));
  assert.equal(searchCustoms(TABLE, 'côte').length, 0);
});

test('rowProblems: a full row passes; nulls are fine; missing keys, bad water, wrong list sizes and bad sources fail', () => {
  assert.deepEqual(rowProblems(row()), []);
  assert.deepEqual(rowProblems(row({ greetings: null, water: null, water_note: null, good_to_know: null })), []);
  const { gestures: _g, ...noGestures } = row();
  assert.deepEqual(rowProblems(noGestures as CustomsRow), ['gestures-missing']);
  assert.deepEqual(rowProblems(row({ water: 'sometimes' as never })), ['water']);
  assert.deepEqual(rowProblems(row({ good_to_know: ['only one'] })), ['good_to_know']);
  assert.deepEqual(rowProblems(row({ good_to_know: ['1', '2', '3', '4', '5'] })), ['good_to_know']);
  assert.deepEqual(rowProblems(row({ sources: [] })), ['sources']);
  assert.deepEqual(rowProblems(row({ sources: ['http://x.org'] })), ['sources']);
  assert.deepEqual(rowProblems(row({ shoes: '  ', checked: '1 Nov', iso2: 'zz' })), ['iso2', 'shoes', 'checked']);
});

test('CUSTOMS_CHECKED matches the content file', () => {
  assert.equal(TABLE.checked, CUSTOMS_CHECKED);
});
