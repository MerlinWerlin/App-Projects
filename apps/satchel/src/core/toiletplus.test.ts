import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HoursStatus } from './openinghours.ts';
import {
  applyFilters,
  arrange,
  filterCounts,
  hoursLine,
  NOTE_MAX,
  parseFilters,
  parseRecent,
  parseSaved,
  passes,
  plainToilet,
  pushRecent,
  RECENT_MAX,
  savedOf,
  setNote,
  setVote,
  statusFor,
  toggleFilter,
  toggleSaved,
  weekdayOf,
  type Row,
  type SavedToilet,
} from './toiletplus.ts';
import { nearestToilets, type Toilet } from './toilets.ts';

const HERE = { lat: 35.0, lon: 135.75 };
const T = (id: string, dLat: number, tags: Partial<Toilet> = {}): Toilet => ({ id, lat: HERE.lat + dLat, lon: HERE.lon, ...tags });
const OPEN: HoursStatus = { state: 'open', closesAt: '18:00', closesInDays: 0 };
const CLOSED: HoursStatus = { state: 'closed', opensAt: '09:00', opensInDays: 1 };
const UNK: HoursStatus = { state: 'unknown' };

const toilets = [
  T('n1', 0.001, { fee: 'no', wheelchair: 'yes', changing_table: 'yes', unisex: 'yes' }),
  T('n2', 0.002, { fee: 'yes', wheelchair: 'limited' }),
  T('n3', 0.003, { fee: 'free', changing_table: 'limited' }),
  T('n4', 0.004, { wheelchair: 'designated', unisex: 'no' }),
];
const hits = nearestToilets(toilets, HERE);
const rows: Row[] = hits.map((hit, i) => ({ hit, status: [OPEN, CLOSED, UNK, OPEN][i] }));

test('passes: each chip reads the right tag', () => {
  const ids = (f: Parameters<typeof passes>[1]) => rows.filter((r) => passes(r, f)).map((r) => r.hit.id);
  assert.deepEqual(ids('free'), ['n1', 'n3']);
  assert.deepEqual(ids('wheelchair'), ['n1', 'n4'], 'limited is not wheelchair accessible for the filter');
  assert.deepEqual(ids('changingTable'), ['n1', 'n3']);
  assert.deepEqual(ids('unisex'), ['n1']);
  assert.deepEqual(ids('openNow'), ['n1', 'n3', 'n4'], 'unknown hours stay; only known-closed is hidden');
});

test('applyFilters ANDs the chips; none active keeps all', () => {
  assert.equal(applyFilters(rows, []).length, 4);
  assert.deepEqual(
    applyFilters(rows, ['free', 'openNow']).map((r) => r.hit.id),
    ['n1', 'n3'],
  );
  assert.deepEqual(
    applyFilters(rows, ['free', 'wheelchair']).map((r) => r.hit.id),
    ['n1'],
  );
});

test('filterCounts: what each chip would leave with the others', () => {
  assert.deepEqual(filterCounts(rows, []), { free: 2, wheelchair: 2, changingTable: 2, openNow: 3, unisex: 1 });
  assert.deepEqual(filterCounts(rows, ['free']), { free: 2, wheelchair: 1, changingTable: 2, openNow: 2, unisex: 1 });
  assert.deepEqual(filterCounts([], ['free']), { free: 0, wheelchair: 0, changingTable: 0, openNow: 0, unisex: 0 });
});

test('toggleFilter keeps display order; parseFilters drops junk', () => {
  assert.deepEqual(toggleFilter([], 'unisex'), ['unisex']);
  assert.deepEqual(toggleFilter(['unisex'], 'free'), ['free', 'unisex']);
  assert.deepEqual(toggleFilter(['free', 'unisex'], 'free'), ['unisex']);
  assert.deepEqual(parseFilters(['openNow', 'bogus', 'free', 3]), ['free', 'openNow']);
  assert.deepEqual(parseFilters('free'), []);
  assert.deepEqual(parseFilters(null), []);
});

test('statusFor: 24/7 forms are open, unknown stays unknown, zone respected', () => {
  const utc = Date.UTC(2026, 10, 2, 3, 0); // Monday 12:00 in Tokyo
  assert.deepEqual(statusFor({ opening_hours: '24/7' }, utc, 'Asia/Tokyo'), { state: 'open' });
  assert.deepEqual(statusFor({ opening_hours: 'Mo-Su 00:00-24:00' }, utc, 'Asia/Tokyo'), { state: 'open' });
  assert.deepEqual(statusFor({}, utc, 'Asia/Tokyo'), { state: 'unknown' });
  assert.deepEqual(statusFor({ opening_hours: 'sunrise-sunset' }, utc, 'Asia/Tokyo'), { state: 'unknown' });
  assert.equal(statusFor({ opening_hours: 'Mo-Fr 09:00-17:00' }, utc, 'Asia/Tokyo').state, 'open');
  assert.equal(statusFor({ opening_hours: 'Mo-Fr 09:00-17:00' }, utc, 'Europe/London').state, 'closed', '03:00 in London');
});

test('hoursLine: the row text for each status', () => {
  assert.equal(hoursLine(UNK, 0), null, 'nothing when unknown');
  assert.deepEqual(hoursLine({ state: 'open' }, 0), { key: 'toiletplus.hours.open', vars: {} });
  assert.deepEqual(hoursLine(OPEN, 0), { key: 'toiletplus.hours.openCloses', vars: { time: '18:00' } });
  assert.deepEqual(hoursLine({ state: 'open', closesAt: '02:00', closesInDays: 1 }, 0), { key: 'toiletplus.hours.openCloses', vars: { time: '02:00' } }, 'same night');
  assert.deepEqual(hoursLine({ state: 'open', closesAt: '18:00', closesInDays: 1 }, 0), { key: 'toiletplus.hours.openClosesTomorrow', vars: { time: '18:00' } });
  assert.deepEqual(hoursLine({ state: 'closed' }, 0), { key: 'toiletplus.hours.closed', vars: {} });
  assert.deepEqual(hoursLine({ state: 'closed', opensAt: '09:00', opensInDays: 0 }, 0), { key: 'toiletplus.hours.closedOpens', vars: { time: '09:00' } });
  assert.deepEqual(hoursLine(CLOSED, 0), { key: 'toiletplus.hours.closedOpensTomorrow', vars: { time: '09:00' } });
  assert.deepEqual(hoursLine({ state: 'closed', opensAt: '08:00', opensInDays: 3 }, 4), { key: 'toiletplus.hours.closedOpensDay', vars: { time: '08:00', day: 'toiletplus.day.0' } }, 'Friday -> Monday');
});

test('weekdayOf: Monday is 0', () => {
  assert.equal(weekdayOf('2026-11-02T10:00'), 0);
  assert.equal(weekdayOf('2026-11-08'), 6);
  assert.equal(weekdayOf('junk'), 0);
});

test('toggleSaved, setNote, setVote', () => {
  let saved: SavedToilet[] = [];
  saved = toggleSaved(saved, hits[0], 100);
  assert.equal(saved.length, 1);
  assert.deepEqual(Object.keys(saved[0].toilet).sort(), Object.keys(toilets[0]).sort(), 'stores only the toilet tags, not distance');
  saved = toggleSaved(saved, hits[1], 200);
  assert.deepEqual(
    saved.map((s) => s.toilet.id),
    ['n2', 'n1'],
    'newest first',
  );
  saved = setNote(saved, 'n1', 'Clean, ask for the key at the café   ');
  assert.equal(savedOf(saved, 'n1')?.note, 'Clean, ask for the key at the café');
  assert.equal(setNote(saved, 'n1', 'x'.repeat(NOTE_MAX + 50)).find((s) => s.toilet.id === 'n1')?.note.length, NOTE_MAX);
  saved = setVote(saved, 'n1', 'up');
  assert.equal(savedOf(saved, 'n1')?.vote, 'up');
  saved = setVote(saved, 'n1', 'up');
  assert.equal(savedOf(saved, 'n1')?.vote, null, 'tap again clears');
  saved = setVote(saved, 'n1', 'down');
  assert.equal(savedOf(saved, 'n1')?.vote, 'down');
  saved = toggleSaved(saved, hits[0], 300);
  assert.equal(savedOf(saved, 'n1'), null, 'unstar removes');
});

test('pushRecent: newest first, deduped, at most 10', () => {
  let recent = pushRecent([], hits[0], 1);
  recent = pushRecent(recent, hits[1], 2);
  recent = pushRecent(recent, hits[0], 3);
  assert.deepEqual(
    recent.map((r) => r.toilet.id),
    ['n1', 'n2'],
  );
  for (let i = 0; i < 15; i++) recent = pushRecent(recent, T(`x${i}`, 0.01), 10 + i);
  assert.equal(recent.length, RECENT_MAX);
  assert.equal(recent[0].toilet.id, 'x14');
});

test('parseSaved / parseRecent accept good data and drop junk', () => {
  const good = [{ toilet: toilets[0], note: 'hi', vote: 'up', savedAt: 5 }];
  assert.deepEqual(parseSaved(good), [{ toilet: toilets[0], note: 'hi', vote: 'up', savedAt: 5 }]);
  assert.deepEqual(parseSaved([{ toilet: { id: 'a', lat: 999, lon: 0 } }, null, 'x', { toilet: toilets[1], vote: 'meh' }]), [{ toilet: toilets[1], note: '', vote: null, savedAt: 0 }]);
  assert.equal(parseSaved([...good, ...good]).length, 1, 'deduped');
  assert.deepEqual(parseSaved({}), []);
  const rec = parseRecent([
    { toilet: toilets[0], at: 1 },
    { toilet: toilets[1], at: 9 },
    { toilet: toilets[2] },
  ]);
  assert.deepEqual(
    rec.map((r) => r.toilet.id),
    ['n2', 'n1'],
  );
  assert.deepEqual(parseRecent('nope'), []);
  assert.deepEqual(plainToilet({ ...hits[0] }), toilets[0]);
});

test('arrange: saved near the search point pinned on top, including ones the search missed', () => {
  const far = T('far', 0.5);
  const extra = T('extra', 0.0025, { name: 'My café' });
  const saved: SavedToilet[] = [
    { toilet: toilets[3], note: 'best', vote: 'up', savedAt: 1 },
    { toilet: extra, note: '', vote: null, savedAt: 2 },
    { toilet: far, note: '', vote: null, savedAt: 3 },
    { toilet: toilets[1], note: 'dirty', vote: 'down', savedAt: 4 },
  ];
  const out = arrange(hits, saved, HERE);
  assert.deepEqual(
    out.map((h) => [h.id, h.pinned]),
    [
      ['extra', true],
      ['n4', true],
      ['n1', false],
      ['n2', false],
      ['n3', false],
    ],
  );
  assert.ok(out[0].meters > 200 && out[0].minutes >= 1, 'the extra one gets distance and walk time');
  assert.deepEqual(
    arrange(hits, [], HERE).map((h) => h.id),
    ['n1', 'n2', 'n3', 'n4'],
  );
});
