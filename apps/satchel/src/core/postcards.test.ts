import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { demoTrip } from './demo.ts';
import type { Trip } from './model.ts';
import {
  addressLines,
  addressText,
  cleanBook,
  copyPeople,
  EMPTY_BOOK,
  GENERIC_PROMPTS,
  hasAddress,
  isPostcardsKey,
  MAX_PROMPTS,
  noteLine,
  orderedPeople,
  postcardsKey,
  removePerson,
  sentCount,
  sentFrom,
  setSent,
  splitLines,
  upsertPerson,
  validatePerson,
  writePrompts,
  type PostcardBook,
  type StopLike,
} from './postcards.ts';
import { buildTripFile } from './tripfile.ts';

let seq = 0;
const newId = (p: string) => `${p}${++seq}`;
const draft = (name: string, address = '', country = '') => ({ name, address, country });

function book(...names: string[]): PostcardBook {
  let b = EMPTY_BOOK;
  for (const n of names) b = upsertPerson(b, draft(n, '1 Harbour St\nManly NSW 2095', 'Australia'), newId);
  return b;
}

// Sydney until 2 Nov (its own dates), then Los Angeles from 2 Nov (its own dates), then Tokyo from 6 Nov.
const STOPS: StopLike[] = [
  { name: 'Sydney', tz: 'Australia/Sydney', fromDate: '2026-10-30', toDate: '2026-11-02' },
  { name: 'Los Angeles', tz: 'America/Los_Angeles', fromDate: '2026-11-02', toDate: '2026-11-05' },
  { name: 'Tokyo', tz: 'Asia/Tokyo', fromDate: '2026-11-06', toDate: '2026-11-09' },
];
const at = (iso: string) => Date.parse(iso);

test('keys: one phone-only key per trip', () => {
  assert.equal(postcardsKey('t1'), 'satchel.postcards.v1.t1');
  assert.equal(isPostcardsKey(postcardsKey('t1')), true);
  assert.equal(isPostcardsKey('satchel.postcards.v1.'), false);
  assert.equal(isPostcardsKey('satchel.lostbag.v1.t1.a'), false);
});

test('people: add, edit keeps the tick, remove, name required', () => {
  let b = book('Gran', 'Sam');
  assert.equal(b.people.length, 2);
  assert.deepEqual(validatePerson(draft('  ')), ['name']);
  assert.equal(upsertPerson(b, draft('   '), newId), b);
  b = setSent(b, b.people[0].id, true, at('2026-11-01T02:00:00Z'), STOPS, 'Australia/Sydney');
  b = upsertPerson(b, draft('Grandma', '\n 2 Beach Rd \n\n Bondi ', 'australia'), newId, b.people[0].id);
  assert.equal(b.people[0].name, 'Grandma');
  assert.deepEqual(b.people[0].lines, ['2 Beach Rd', 'Bondi']);
  assert.ok(b.people[0].sent, 'editing the address keeps the sent tick');
  b = removePerson(b, b.people[1].id);
  assert.deepEqual(b.people.map((p) => p.name), ['Grandma']);
});

test('sent counts: "3 of 5 sent", unticking clears, sent ones listed last', () => {
  let b = book('A', 'B', 'C', 'D', 'E');
  assert.deepEqual(sentCount(b), { sent: 0, total: 5 });
  const [a, , c, d, e] = b.people;
  b = setSent(b, d.id, true, at('2026-11-03T01:00:00Z'), STOPS, 'UTC');
  b = setSent(b, a.id, true, at('2026-11-03T02:00:00Z'), STOPS, 'UTC');
  b = setSent(b, e.id, true, at('2026-11-03T03:00:00Z'), STOPS, 'UTC');
  assert.deepEqual(sentCount(b), { sent: 3, total: 5 });
  assert.deepEqual(orderedPeople(b).map((p) => p.name), ['B', 'C', 'D', 'A', 'E']);
  b = setSent(b, e.id, false, at('2026-11-04T00:00:00Z'), STOPS, 'UTC');
  assert.deepEqual(sentCount(b), { sent: 2, total: 5 });
  assert.equal(b.people.find((p) => p.id === c.id)?.sent, null);
  assert.deepEqual(sentCount(EMPTY_BOOK), { sent: 0, total: 0 });
});

test('sent from: the trip stop for that date, each stop on its own IANA zone', () => {
  // 20:00 UTC on 2 Nov: 07:00 on 3 Nov in Sydney (its stay ended on the 2nd), 12:00 on 2 Nov in Los Angeles (arrived).
  assert.deepEqual(sentFrom(STOPS, at('2026-11-02T20:00:00Z'), 'Australia/Sydney'), { date: '2026-11-02', place: 'Los Angeles', tz: 'America/Los_Angeles' });
  // 20:00 UTC on 1 Nov: 07:00 on 2 Nov in Sydney (still there), 13:00 on 1 Nov in Los Angeles (not there yet).
  assert.deepEqual(sentFrom(STOPS, at('2026-11-01T20:00:00Z'), 'America/Los_Angeles'), { date: '2026-11-02', place: 'Sydney', tz: 'Australia/Sydney' });
  // 2 Nov 00:30 Sydney time is still 1 Nov in UTC: the date is Sydney's, never the phone's or UTC's.
  assert.deepEqual(sentFrom(STOPS, at('2026-11-01T13:30:00Z'), 'UTC'), { date: '2026-11-02', place: 'Sydney', tz: 'Australia/Sydney' });
  // A gap between stops (5 Nov LA left, Tokyo from 6 Nov): the last stop reached on its own clock.
  assert.equal(sentFrom(STOPS, at('2026-11-05T12:00:00Z'), 'UTC').place, 'Los Angeles');
  // 8 Nov in Tokyo.
  assert.deepEqual(sentFrom(STOPS, at('2026-11-08T03:00:00Z'), 'UTC'), { date: '2026-11-08', place: 'Tokyo', tz: 'Asia/Tokyo' });
  // Before the first stop: the first stop. No stops: the fallback zone and no place.
  assert.equal(sentFrom(STOPS, at('2026-10-01T00:00:00Z'), 'UTC').place, 'Sydney');
  assert.deepEqual(sentFrom([], at('2026-11-01T20:00:00Z'), 'Asia/Tokyo'), { date: '2026-11-02', place: null, tz: 'Asia/Tokyo' });
  assert.deepEqual(sentFrom([], at('2026-11-01T20:00:00Z'), 'Not/AZone'), { date: '2026-11-01', place: null, tz: 'UTC' });
  // The tick stores the instant with it.
  const b = setSent(book('Gran'), 'pc' + seq, true, at('2026-11-02T20:00:00Z'), STOPS, 'UTC');
  assert.deepEqual(b.people[0].sent, { at: '2026-11-02T20:00:00.000Z', date: '2026-11-02', place: 'Los Angeles', tz: 'America/Los_Angeles' });
});

test('big address: lines as typed, country line upper-cased, plain text for copying', () => {
  const p = { name: ' Ana  García ', lines: splitLines('Calle Mayor 5, 2º\n\n28013 Madrid\n'), country: 'España' };
  assert.deepEqual(addressLines(p), { lines: ['Ana García', 'Calle Mayor 5, 2º', '28013 Madrid'], country: 'ESPAÑA' });
  assert.equal(addressText(p), 'Ana García\nCalle Mayor 5, 2º\n28013 Madrid\nESPAÑA');
  assert.equal(addressLines({ name: 'Jo', lines: [], country: 'united kingdom' }).country, 'UNITED KINGDOM');
  assert.equal(addressText({ name: 'Jo', lines: ['1 High St'], country: '' }), 'Jo\n1 High St');
  assert.equal(addressLines({ name: 'Mo', lines: [], country: 'Österreich' }).country, 'ÖSTERREICH');
  assert.equal(hasAddress({ lines: [], country: '' }), false);
  assert.equal(hasAddress({ lines: [], country: 'Japan' }), true);
  assert.equal(splitLines(Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n')).length, 8);
});

test('plan this trip again copies the people (names and addresses), never the ticks', () => {
  let b = book('Gran', 'Sam', 'Mia');
  b = setSent(b, b.people[0].id, true, at('2026-11-02T20:00:00Z'), STOPS, 'UTC');
  b = setSent(b, b.people[2].id, true, at('2026-11-03T20:00:00Z'), STOPS, 'UTC');
  const copy = copyPeople(b, newId);
  assert.deepEqual(copy.people.map((p) => p.name), ['Gran', 'Sam', 'Mia']);
  assert.deepEqual(copy.people.map((p) => p.lines), b.people.map((p) => p.lines));
  assert.ok(copy.people.every((p) => p.sent === null));
  assert.deepEqual(sentCount(copy), { sent: 0, total: 3 });
  assert.ok(copy.people.every((p, i) => p.id !== b.people[i].id), 'new ids');
  assert.ok(b.people[0].sent, 'the old trip keeps its ticks');
});

test('cleanBook: damaged stored values never crash, bad rows dropped', () => {
  assert.deepEqual(cleanBook(null), EMPTY_BOOK);
  assert.deepEqual(cleanBook({ people: 'x' }), EMPTY_BOOK);
  const b = cleanBook({
    people: [
      { id: 'a', name: 'Gran', lines: ['1 St', 5, ''], country: 'Japan', sent: { at: '2026-11-02T20:00:00Z', date: '2026-11-02', place: 'Kyoto', tz: 'Asia/Tokyo' } },
      { id: 'a', name: 'Dup' },
      { id: 'b', name: '' },
      { id: 'c', name: 'Sam', sent: { at: 'nope', date: '2026-11-02' } },
      { id: 'd', name: 'Mo', sent: { at: '2026-11-02T20:00:00Z', date: '2026-02-30', tz: 'X' } },
      'junk',
    ],
  });
  assert.deepEqual(b.people.map((p) => [p.id, p.name, p.lines, p.sent?.place ?? null]), [
    ['a', 'Gran', ['1 St'], 'Kyoto'],
    ['c', 'Sam', [], null],
    ['d', 'Mo', [], null],
  ]);
  assert.equal(b.people[1].sent, null);
});

test('what to write: from that day’s journal pages and ideas, topped up, no duplicates, offline', () => {
  const base = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  const day = base.startDate;
  const trip: Trip = {
    ...base,
    places: [...(base.places ?? []), { id: 'sp1', name: 'Fushimi Inari', lat: 34.9671, lon: 135.7727 } as NonNullable<Trip['places']>[number]],
    journal: [
      { id: 'j1', day, note: 'Climbed through a thousand red gates at dawn. Legs are jelly.', photos: [], placeId: 'sp1', mood: 'joyful', weather: 'sunny', createdAt: '2026-11-02T00:00:00Z' },
      { id: 'j2', day: '2026-11-03', note: 'Other day.', photos: [], createdAt: '2026-11-03T00:00:00Z' },
    ],
    ideas: [
      { id: 'i1', name: 'Nishiki Market', category: 'eat', day, done: true, createdAt: '2026-10-01T00:00:00Z' },
      { id: 'i2', name: 'Fushimi Inari', category: 'see', day, createdAt: '2026-10-01T00:00:00Z' },
      { id: 'i3', name: 'Tea house', category: 'do', day, createdAt: '2026-10-01T00:00:00Z' },
    ],
  };
  const p = writePrompts(trip, day);
  assert.equal(p.length, MAX_PROMPTS);
  assert.deepEqual(p[0], { kind: 'note', text: 'Climbed through a thousand red gates at dawn.' });
  assert.deepEqual(p[1], { kind: 'place', name: 'Fushimi Inari' });
  assert.deepEqual(p[2], { kind: 'went', name: 'Nishiki Market' });
  assert.deepEqual(p[3], { kind: 'mood', mood: 'joyful' });
  assert.deepEqual(p[4], { kind: 'weather', weather: 'sunny' });
  // The planned idea with the same name as the place is not repeated.
  assert.ok(!p.some((x) => x.kind === 'plan' && x.name === 'Fushimi Inari'));
  // A day with nothing written gets the generic prompts.
  const empty = writePrompts({ ...base, journal: [], ideas: [] }, day);
  assert.deepEqual(empty.map((x) => (x.kind === 'generic' ? x.id : x.kind)), [...GENERIC_PROMPTS]);
  // The other day's note only shows on that day.
  assert.deepEqual(writePrompts(trip, '2026-11-03')[0], { kind: 'note', text: 'Other day.' });
  // Long notes cut on a word with an ellipsis.
  const long = noteLine('word '.repeat(40));
  assert.ok(long.endsWith('…') && long.length <= 91);
  // No network or AI anywhere in the module.
  const src = readFileSync(new URL('./postcards.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /fetch\(|https?:\/\/|XMLHttpRequest|openai|from 'react-native'/i);
});

test('every prompt kind, generic id, mood and weather has a catalogue string', () => {
  const keys = new Set(Object.keys(en));
  for (const k of ['note', 'place', 'went', 'plan']) assert.ok(keys.has(`postcards.prompt.${k}`), k);
  for (const g of GENERIC_PROMPTS) assert.ok(keys.has(`postcards.prompt.generic.${g}`), g);
  for (const m of ['joyful', 'relaxed', 'adventurous', 'grateful', 'tired', 'meh']) assert.ok(keys.has(`postcards.prompt.mood.${m}`), m);
  for (const w of ['sunny', 'partly', 'cloudy', 'rain', 'storm', 'snow']) assert.ok(keys.has(`postcards.prompt.weather.${w}`), w);
  const words = Object.entries(en).filter(([k]) => k.startsWith('postcards.')).map(([, v]) => v).join(' ');
  assert.ok(words.length > 0);
});

// ----------------------------------------------------------------------------------------------- phone-only guard

test('postcard people stay on this phone: own key per trip, never in .satchel trip files', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts', 'src/state/tripTransfer.ts', 'src/core/tripcopy.ts', 'src/core/journal.ts', 'src/core/ideas.ts']) {
    assert.doesNotMatch(read(p), /postcard/i, p);
  }
  // The key prefix is declared once, in this module.
  assert.equal((read('src/core/postcards.ts').match(/'satchel\.postcards\.v1\.'/g) ?? []).length, 1);
  // A trip file built from a trip whose postcard list has names, addresses and ticks carries none of them.
  const trip: Trip = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  let b = upsertPerson(EMPTY_BOOK, draft('Zqgran', 'Zq12 Lane\nZqtown 9999', 'Zqland'), newId);
  b = setSent(b, b.people[0].id, true, at('2026-11-02T20:00:00Z'), STOPS, 'UTC');
  const saved = new Map([[postcardsKey(trip.id), b]]);
  assert.equal(saved.size, 1);
  const built = buildTripFile(trip, {}, { now: '2026-10-31T00:00:00Z' } as Parameters<typeof buildTripFile>[2]);
  const file = JSON.stringify(built.file);
  assert.doesNotMatch(file, /satchel\.postcards|postcard|Zqgran|Zq12|Zqtown|Zqland/i);
});
