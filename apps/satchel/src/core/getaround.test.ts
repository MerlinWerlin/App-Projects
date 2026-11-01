// T132 Getting around: lookup, trip countries in order, section ordering, summary lines, search, phrase hook and
// row checks. Content checks (sources, dates, brands) live in src/content/getaround.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CORE_SECTIONS,
  findGetaround,
  GETAROUND_CHECKED,
  hasGetaround,
  notCoveredEntry,
  pickGetaroundCountry,
  rowProblems,
  searchGetaround,
  SECTION_ORDER,
  sectionsFor,
  sourceHosts,
  summaryLines,
  tripGetaroundCountries,
  USEFUL_PHRASES,
  type GetaroundRow,
  type GetaroundTable,
} from './getaround.ts';
import type { Item, ItemKind, Trip } from './model.ts';
import { isPhraseId, languageForCountry, type PhraseTable } from './phrases.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const TABLE = JSON.parse(read('src/content/getaround.json')) as GetaroundTable;
const PHRASES = JSON.parse(read('src/content/phrases.json')) as PhraseTable;

const row = (over: Partial<GetaroundRow> = {}): GetaroundRow => ({
  iso2: 'ZZ',
  country: 'Testland',
  area: 'Test City',
  transit: 'Trains and buses.',
  tickets: ['Test Card'],
  contactless: 'yes',
  contactless_note: 'Tap your card.',
  hours: '5am to midnight.',
  taxi: 'Metered.',
  rides: 'available',
  airport: 'Train to the centre.',
  sources: ['https://transport.example.org/visitors'],
  checked: '2026-11-01',
  recheck: false,
  recheck_reason: null,
  ...over,
});
const table = (...rows: GetaroundRow[]): GetaroundTable => ({ version: 1, rule: 'verify locally', countries: rows });

test('findGetaround: case and spaces forgiven; unknown, empty and malformed codes give null', () => {
  assert.equal(findGetaround(TABLE, 'jp')?.country, 'Japan');
  assert.equal(findGetaround(TABLE, ' GB ')?.iso2, 'GB');
  assert.equal(findGetaround(TABLE, 'XX'), null);
  assert.equal(findGetaround(TABLE, ''), null);
  assert.equal(findGetaround(TABLE, null), null);
  assert.equal(findGetaround(TABLE, 'JPN'), null);
  assert.equal(hasGetaround(TABLE, 'sg'), true);
  assert.equal(hasGetaround(TABLE, 'AQ'), false);
  assert.equal(GETAROUND_CHECKED, '2026-11-01');
});

test('notCoveredEntry: countries listed as not yet covered, never one that has a row', () => {
  // T137 covered the last 9 backlog countries, so the bundled list is empty; check the lookup on a sample table too.
  const nc = TABLE.not_covered ?? [];
  const sample: GetaroundTable = { ...TABLE, not_covered: [{ iso2: 'AQ', country: 'Antarctica', reason: 'No official operator page could be read.' }] };
  assert.equal(notCoveredEntry(sample, 'aq')?.country, 'Antarctica');
  assert.equal(notCoveredEntry(sample, 'JP'), null);
  for (const e of nc) {
    assert.equal(notCoveredEntry(TABLE, e.iso2.toLowerCase())?.iso2, e.iso2);
    assert.equal(findGetaround(TABLE, e.iso2), null, `${e.iso2} is both covered and not covered`);
  }
  assert.equal(notCoveredEntry(TABLE, 'JP'), null);
  assert.equal(notCoveredEntry(TABLE, 'nope'), null);
});

test('pickGetaroundCountry: first covered candidate wins', () => {
  assert.equal(pickGetaroundCountry(TABLE, [null, 'AQ', 'nz', 'JP']), 'NZ');
  assert.equal(pickGetaroundCountry(TABLE, [undefined, 'AQ']), null);
  assert.equal(pickGetaroundCountry(TABLE, []), null);
});

let n = 0;
function item(kind: ItemKind, start: [string, string], end?: [string, string]): Item {
  n++;
  return { id: `i${n}`, tripId: 't', kind, title: `${kind} ${n}`, start: { local: start[0], tz: start[1] }, end: end ? { local: end[0], tz: end[1] } : undefined, attachments: [] };
}
const trip = (homeTz: string, items: Item[]): Trip => ({ id: 't1', name: 'Test', startDate: '2026-12-01', endDate: '2026-12-14', homeTz, items, createdAt: '2026-10-01T00:00:00Z' });

test('tripGetaroundCountries: trip order, home left out, uncovered countries skipped, each once', () => {
  const t = trip('Australia/Sydney', [
    item('flight', ['2026-12-01T09:30', 'Australia/Sydney'], ['2026-12-01T17:45', 'Asia/Tokyo']),
    item('hotel', ['2026-12-01T19:30', 'Asia/Tokyo'], ['2026-12-04T11:00', 'Asia/Tokyo']),
    item('flight', ['2026-12-04T13:00', 'Asia/Tokyo'], ['2026-12-04T15:00', 'Asia/Seoul']),
    item('flight', ['2026-12-06T09:00', 'Asia/Seoul'], ['2026-12-06T13:00', 'Asia/Hong_Kong']),
    item('flight', ['2026-12-08T09:00', 'Asia/Hong_Kong'], ['2026-12-08T20:00', 'Asia/Tokyo']),
    item('flight', ['2026-12-09T09:00', 'Asia/Tokyo'], ['2026-12-09T21:00', 'Australia/Sydney']),
  ]);
  assert.deepEqual(
    tripGetaroundCountries(t, 'AU', TABLE).map((r) => r.iso2),
    ['JP', 'KR', 'HK'],
  );
  assert.deepEqual(
    tripGetaroundCountries(t, 'JP', TABLE).map((r) => r.iso2),
    ['AU', 'KR', 'HK'],
  );
  // A country without a row (Korea left out here) is skipped.
  const noKorea: GetaroundTable = { ...TABLE, countries: TABLE.countries.filter((r) => r.iso2 !== 'KR') };
  assert.deepEqual(
    tripGetaroundCountries(t, 'AU', noKorea).map((r) => r.iso2),
    ['JP', 'HK'],
  );
  assert.deepEqual(tripGetaroundCountries(trip('Australia/Sydney', []), 'AU', TABLE), []);
  assert.deepEqual(tripGetaroundCountries(t, 'AU', table()), []);
});

test('sectionsFor: fixed order with every section; sections not on the pages read moved to the end', () => {
  const full = sectionsFor(row());
  assert.deepEqual(
    full.map((s) => s.id),
    [...SECTION_ORDER],
  );
  assert.ok(full.every((s) => s.known));
  const part = sectionsFor(row({ hours: null, rides: null, contactless: null, contactless_note: null }));
  assert.deepEqual(
    part.map((s) => `${s.id}${s.known ? '' : '?'}`),
    ['transit', 'tickets', 'taxi', 'airport', 'contactless?', 'hours?', 'rides?'],
  );
});

test('sectionsFor: tickets trimmed and capped, contactless carries its answer and note, odd values count as unsure', () => {
  const s = sectionsFor(row({ tickets: [' A ', ' ', 'B', 'C', 'D', 'E', 'F', 'G'], contactless: 'some', contactless_note: '  ', taxi: '   ' }));
  assert.deepEqual(s.find((x) => x.id === 'tickets'), { id: 'tickets', known: true, names: ['A', 'B', 'C', 'D', 'E', 'F'] });
  assert.deepEqual(s.find((x) => x.id === 'contactless'), { id: 'contactless', known: true, answer: 'some', note: null });
  assert.deepEqual(s.find((x) => x.id === 'taxi'), { id: 'taxi', known: false });
  assert.equal(sectionsFor(row({ contactless: 'maybe' as never })).find((x) => x.id === 'contactless')?.known, false);
  assert.equal(sectionsFor(row({ rides: 'everywhere' as never })).find((x) => x.id === 'rides')?.known, false);
  assert.equal(sectionsFor(row({ tickets: [] })).find((x) => x.id === 'tickets')?.known, false);
});

test('summaryLines: tickets (max 3 names), then contactless, then rides; capped by max; nothing when unknown', () => {
  assert.deepEqual(summaryLines(row({ tickets: ['A', 'B', 'C', 'D'] }), 3), [
    { id: 'tickets', names: ['A', 'B', 'C'] },
    { id: 'contactless', answer: 'yes' },
    { id: 'rides' },
  ]);
  assert.deepEqual(summaryLines(row()), [
    { id: 'tickets', names: ['Test Card'] },
    { id: 'contactless', answer: 'yes' },
  ]);
  assert.deepEqual(summaryLines(row({ tickets: null, contactless: null, contactless_note: null, rides: null })), []);
  assert.deepEqual(summaryLines(row(), 0), []);
  // Real rows: London leads with Oyster and a yes for contactless.
  assert.deepEqual(summaryLines(findGetaround(TABLE, 'GB') as GetaroundRow), [
    { id: 'tickets', names: ['Oyster card'] },
    { id: 'contactless', answer: 'yes' },
  ]);
});

test('sourceHosts: hosts without www, deduplicated, in order', () => {
  assert.deepEqual(sourceHosts({ sources: ['https://www.japan.travel/en/a', 'https://www.japan.travel/b', 'https://tfl.gov.uk/x'] }), ['japan.travel', 'tfl.gov.uk']);
  assert.deepEqual(sourceHosts(findGetaround(TABLE, 'GB') as GetaroundRow), ['tfl.gov.uk', 'visitlondon.com']);
});

test('searchGetaround: covered countries only, code then prefix then word then contains (area too); empty lists A-Z', () => {
  assert.equal(searchGetaround(TABLE, 'jp')[0].iso2, 'JP');
  assert.equal(searchGetaround(TABLE, 'new')[0].iso2, 'NZ');
  assert.ok(searchGetaround(TABLE, 'kingdom').some((r) => r.iso2 === 'GB'));
  assert.ok(searchGetaround(TABLE, 'lisbon').some((r) => r.iso2 === 'PT'));
  assert.deepEqual(searchGetaround(TABLE, 'antarctica'), []);
  assert.equal(searchGetaround(TABLE, 'korea')[0].iso2, 'KR');
  assert.equal(searchGetaround(TABLE, 'shanghai')[0].iso2, 'CN');
  const all = searchGetaround(TABLE, '  ');
  assert.equal(all.length, TABLE.countries.length);
  assert.deepEqual(
    all.map((r) => r.country),
    [...all.map((r) => r.country)].sort(),
  );
});

test('useful words: the station and address phrase cards exist, and the hook finds a language where one is bundled', () => {
  for (const id of USEFUL_PHRASES) assert.ok(isPhraseId(id), id);
  for (const id of USEFUL_PHRASES) assert.ok(PHRASES.phrases.some((p) => p.id === id), id);
  assert.equal(languageForCountry(PHRASES, 'JP'), 'ja');
  assert.equal(languageForCountry(PHRASES, 'TW'), 'zh-Hant');
  assert.equal(languageForCountry(PHRASES, 'GB'), null);
  // At least a third of the covered countries get the phrase link.
  const linked = TABLE.countries.filter((r) => languageForCountry(PHRASES, r.iso2)).length;
  assert.ok(linked * 3 >= TABLE.countries.length, `${linked}`);
});

test('rowProblems: a complete row passes; every field, source, date and re-check rule is enforced', () => {
  assert.deepEqual(rowProblems(row()), []);
  assert.deepEqual(rowProblems(row({ iso2: 'zz' })), ['iso2']);
  assert.deepEqual(rowProblems(row({ area: ' ' })), ['area']);
  assert.deepEqual(rowProblems(row({ transit: '' })), ['transit', 'gaps-without-recheck']);
  assert.deepEqual(rowProblems(row({ tickets: [] })), ['tickets', 'gaps-without-recheck']);
  assert.deepEqual(rowProblems(row({ contactless: 'often' as never })), ['contactless', 'gaps-without-recheck']);
  assert.deepEqual(rowProblems(row({ contactless: null })), ['contactless_note-without-answer', 'gaps-without-recheck']);
  assert.deepEqual(rowProblems(row({ rides: 'lots' as never })), ['rides']);
  assert.deepEqual(rowProblems(row({ sources: ['http://transport.example.org'] })), ['sources']);
  assert.deepEqual(rowProblems(row({ sources: [] })), ['sources']);
  assert.deepEqual(rowProblems(row({ checked: '1 Nov' })), ['checked']);
  assert.deepEqual(rowProblems(row({ recheck: true })), ['recheck_reason']);
  assert.deepEqual(rowProblems(row({ recheck_reason: 'why' })), ['recheck_reason-without-recheck']);
  // Hours and rides may be missing without a re-check; a core section may not.
  assert.deepEqual(rowProblems(row({ hours: null, rides: null })), []);
  for (const id of CORE_SECTIONS) {
    const blank = id === 'contactless' ? { contactless: null, contactless_note: null } : { [id]: null };
    assert.deepEqual(rowProblems(row(blank as Partial<GetaroundRow>)), ['gaps-without-recheck'], id);
    assert.deepEqual(rowProblems(row({ ...(blank as Partial<GetaroundRow>), recheck: true, recheck_reason: 'Not on the page.' })), [], id);
  }
  const missing = row();
  delete (missing as Partial<GetaroundRow>).taxi;
  assert.deepEqual(rowProblems(missing), ['taxi-missing', 'gaps-without-recheck']);
});

// ----------------------------------------------------------------------------------------------- UI source guards

test('getaround UI: entry points wired, route registered, strings from the catalogue, timed motion and tokens only', () => {
  const files = ['app/getaround/[country].tsx', 'src/ui/getaround.tsx'];
  const src = files.map(read).join('\n');
  assert.doesNotMatch(src, new RegExp('Animated\\.spr' + 'ing|\\bspr' + 'ing\\(|withSpr' + 'ing'));
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'tokens only');
  // Every t('...') key used exists in the getaround catalogue (or a shared one) and every getaround key is used.
  const strings = read('src/i18n/en/getaround.ts');
  const keys = [...strings.matchAll(/'(getaround\.[^']+)':/g)].map((m) => m[1]);
  assert.ok(keys.length > 40);
  const used = new Set([...src.matchAll(/'(getaround\.[a-zA-Z0-9_.]+)'/g)].map((m) => m[1]));
  for (const k of used) assert.ok(keys.includes(k), `missing string ${k}`);
  const wiring = src + read('app/_layout.tsx') + read('src/ui/ArrivalCard.tsx');
  for (const k of keys) assert.ok(wiring.includes(`'${k}'`), `unused string ${k}`);
  // No hard-coded English in the screen's JSX text.
  assert.doesNotMatch(read('app/getaround/[country].tsx'), />\s*[A-Z][a-z]+ [a-z]+[^<{]*</);
  // Entry points: arrival card, trip screen, Map tab; route registered with a translated title.
  assert.match(read('src/ui/ArrivalCard.tsx'), /pathname: '\/getaround\/\[country\]'/);
  assert.match(read('app/trip/[id].tsx'), /<GetaroundTripCard trip=\{trip\} \/>/);
  assert.match(read('app/(tabs)/map.tsx'), /<GetaroundMapButton trip=\{/);
  assert.match(read('app/_layout.tsx'), /<Stack\.Screen name="getaround\/\[country\]" options=\{\{ \.\.\.header, title: t\('getaround\.route'\) \}\} \/>/);
  // Useful words go to the existing phrase cards, not a copy of them.
  assert.match(read('app/getaround/[country].tsx'), /pathname: '\/phrases', params: \{ lang: phraseLang, phrase: id \}/);
  // Offline: bundled JSON only, no fetch.
  assert.doesNotMatch(src, /\bfetch\(/);
});
