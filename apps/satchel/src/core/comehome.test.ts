// T128 coming home: template, own rows, rename / remove / put back, rating, due time from the final journey across
// zones, the Home again day, nudges, the duty-free row lookup and the .satchel round trip.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Item, Trip } from './model.ts';
import {
  addOwnRow,
  allowanceFor,
  allowanceHost,
  COME_LINKS,
  COME_TEMPLATE,
  comeDue,
  comeNudge,
  comeProgress,
  finalDeparture,
  homeAgainNudge,
  lastCheckout,
  missingTemplate,
  readComingHome,
  readFileComingHome,
  removeRow,
  renameRow,
  restoreTemplate,
  rowsOf,
  setRating,
  setRowDone,
  startComingHome,
  templateRows,
  untickList,
  type AllowanceTable,
} from './comehome.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';
import { toUtc } from './tz.ts';
import { en } from '../i18n/en.ts';

const NOW_ISO = '2027-04-07T00:00:00.000Z';
let n = 0;
const newId = (p: string) => `${p}_${++n}`;
const item = (o: Partial<Item> & Pick<Item, 'id' | 'kind' | 'start'>): Item => ({ tripId: 't1', title: o.kind, attachments: [], ...o }) as Item;
const at = (local: string, tz: string) => toUtc({ local, tz });

// Out Sydney -> Tokyo on 1 Apr; home Tokyo 22:00 on 7 Apr, landing Sydney 08:30 on 8 Apr.
const out = item({ id: 'f1', kind: 'flight', title: 'Sydney to Tokyo', start: { local: '2027-04-01T07:00', tz: 'Australia/Sydney' }, end: { local: '2027-04-01T16:00', tz: 'Asia/Tokyo' } });
const home = item({ id: 'f2', kind: 'flight', title: 'Tokyo to Sydney', start: { local: '2027-04-07T22:00', tz: 'Asia/Tokyo' }, end: { local: '2027-04-08T08:30', tz: 'Australia/Sydney' } });
const hotel = item({
  id: 'h1',
  kind: 'hotel',
  title: 'Hotel',
  start: { local: '2027-04-01T15:00', tz: 'Asia/Tokyo' },
  end: { local: '2027-04-07T11:00', tz: 'Asia/Tokyo' },
  place: { id: 'p1', name: 'Hotel Asakusa' },
});

const trip = (o: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Tokyo',
  startDate: '2027-04-01',
  endDate: '2027-04-08',
  homeTz: 'Australia/Sydney',
  items: [home, hotel, out],
  createdAt: NOW_ISO,
  ...o,
});

const TABLE = JSON.parse(readFileSync(new URL('../content/comehome.json', import.meta.url), 'utf8')) as AllowanceTable;

// ---------------------------------------------------------------- template and editing

test('template: six rows per list in the stated order, each with a catalogue string; links point to the right place', () => {
  assert.deepEqual([...COME_TEMPLATE.before], ['checkout', 'keys', 'passports', 'chargers', 'coins', 'customs']);
  assert.deepEqual([...COME_TEMPLATE.after], ['unpack', 'laundry', 'photos', 'spending', 'recap', 'rate']);
  for (const id of [...COME_TEMPLATE.before, ...COME_TEMPLATE.after]) assert.ok((en as Record<string, string>)[`comehome.tpl.${id}`], id);
  assert.deepEqual(COME_LINKS, { coins: 'cash', customs: 'customs', spending: 'spending', recap: 'recap', rate: 'rate' });
  const rows = templateRows(newId);
  assert.equal(rows.length, 12);
  assert.ok(rows.every((r) => !r.done));
  assert.equal(new Set(rows.map((r) => r.id)).size, 12);
});

test('start: both lists from the template once; a trip with rows keeps them', () => {
  const t1 = startComingHome(trip(), newId, NOW_ISO);
  const ch = readComingHome(t1)!;
  assert.equal(rowsOf(ch, 'before').length, 6);
  assert.equal(rowsOf(ch, 'after').length, 6);
  assert.equal(ch.updatedAt, NOW_ISO);
  assert.equal(startComingHome(t1, newId), t1);
});

test('own rows go on their own list; blank words are ignored; rename and back to the usual words', () => {
  let t = startComingHome(trip(), newId, NOW_ISO);
  t = addOwnRow(t, 'after', '  Pick up the dog ', newId, NOW_ISO);
  assert.equal(addOwnRow(t, 'before', '   ', newId), t);
  const ch = readComingHome(t)!;
  const own = rowsOf(ch, 'after').at(-1)!;
  assert.equal(own.label, 'Pick up the dog');
  assert.equal(own.tpl, undefined);
  const keys = rowsOf(ch, 'before')[1];
  t = renameRow(t, keys.id, 'Room cards back to the desk', NOW_ISO);
  assert.equal(readComingHome(t)!.rows.find((r) => r.id === keys.id)!.label, 'Room cards back to the desk');
  t = renameRow(t, keys.id, '  ', NOW_ISO);
  assert.equal(readComingHome(t)!.rows.find((r) => r.id === keys.id)!.label, undefined);
  // An own row keeps its old words when renamed to blank.
  t = renameRow(t, own.id, '', NOW_ISO);
  assert.equal(readComingHome(t)!.rows.find((r) => r.id === own.id)!.label, 'Pick up the dog');
});

test('remove and put back: per list, template order, own rows stay last', () => {
  let t = startComingHome(trip(), newId, NOW_ISO);
  t = addOwnRow(t, 'before', 'Post the postcards', newId, NOW_ISO);
  const before = rowsOf(readComingHome(t), 'before');
  t = removeRow(t, before[0].id, NOW_ISO); // checkout
  t = removeRow(t, before[4].id, NOW_ISO); // coins
  assert.deepEqual(missingTemplate(readComingHome(t), 'before'), ['checkout', 'coins']);
  assert.deepEqual(missingTemplate(readComingHome(t), 'after'), []);
  assert.equal(restoreTemplate(t, 'after', newId), t);
  t = restoreTemplate(t, 'before', newId, NOW_ISO);
  const back = rowsOf(readComingHome(t), 'before');
  assert.deepEqual(back.map((r) => r.tpl ?? r.label), ['checkout', 'keys', 'passports', 'chargers', 'coins', 'customs', 'Post the postcards']);
  assert.ok(back.every((r) => !r.done));
});

test('put back on an emptied list sits where that list goes', () => {
  let t = startComingHome(trip(), newId, NOW_ISO);
  for (const r of rowsOf(readComingHome(t), 'after')) t = removeRow(t, r.id, NOW_ISO);
  t = restoreTemplate(t, 'after', newId, NOW_ISO);
  assert.deepEqual(rowsOf(readComingHome(t), 'after').map((r) => r.tpl), [...COME_TEMPLATE.after]);
});

test('tick, progress per list, untick one list only', () => {
  let t = startComingHome(trip(), newId, NOW_ISO);
  const ch = readComingHome(t)!;
  t = setRowDone(t, rowsOf(ch, 'before')[0].id, true, NOW_ISO);
  t = setRowDone(t, rowsOf(ch, 'after')[0].id, true, NOW_ISO);
  assert.deepEqual(comeProgress(readComingHome(t), 'before'), { done: 1, total: 6, open: 5 });
  t = untickList(t, 'before', NOW_ISO);
  assert.deepEqual(comeProgress(readComingHome(t), 'before'), { done: 0, total: 6, open: 6 });
  assert.deepEqual(comeProgress(readComingHome(t), 'after'), { done: 1, total: 6, open: 5 });
  assert.deepEqual(comeProgress(null, 'after'), { done: 0, total: 0, open: 0 });
});

test('rating: 1-5 only, ticks the rate row, clear keeps the tick', () => {
  let t = startComingHome(trip(), newId, NOW_ISO);
  assert.equal(setRating(t, 6), t);
  assert.equal(setRating(t, 2.5), t);
  t = setRating(t, 4, NOW_ISO);
  let ch = readComingHome(t)!;
  assert.equal(ch.rating, 4);
  assert.equal(ch.rows.find((r) => r.tpl === 'rate')!.done, true);
  t = setRating(t, null, NOW_ISO);
  ch = readComingHome(t)!;
  assert.equal(ch.rating, undefined);
  assert.equal(ch.rows.find((r) => r.tpl === 'rate')!.done, true);
});

test('reading: damaged rows dropped, duplicates once, template rows forced to their list, unknown fields kept', () => {
  const raw = {
    rows: [
      { id: 'a', tpl: 'keys', list: 'after', done: true },
      { id: 'a', tpl: 'unpack', done: false },
      { id: 'b', label: 'Own', list: 'nowhere' },
      { id: 'c' },
      { tpl: 'keys' },
      'junk',
      { id: 'd', tpl: 'nope', label: '  ' },
    ],
    rating: 9,
    later: 1,
  };
  const ch = readComingHome({ comingHome: raw as never })!;
  assert.deepEqual(
    ch.rows.map((r) => [r.id, r.list, r.tpl ?? r.label, r.done]),
    [
      ['a', 'before', 'keys', true],
      ['b', 'before', 'Own', false],
    ],
  );
  assert.equal(ch.rating, undefined);
  assert.equal((ch as unknown as { later: number }).later, 1);
  assert.equal(readComingHome({ comingHome: 'x' as never }), null);
  assert.equal(readFileComingHome({ rows: [] }), undefined);
  assert.equal(readFileComingHome(undefined), undefined);
  assert.deepEqual(readFileComingHome({ rows: [], rating: 3 })?.rating, 3);
});

// ---------------------------------------------------------------- due time across zones

test('final departure: the last journey by real instant, not by wall clock', () => {
  // A Bangkok bus at 21:30 (+07:00 = 14:30Z) reads earlier on the wall clock than the 22:00 Tokyo flight (13:00Z)
  // but leaves later in real time, so it is the final departure.
  const bus = item({ id: 'b1', kind: 'bus', title: 'Bangkok bus', start: { local: '2027-04-07T21:30', tz: 'Asia/Bangkok' } });
  const d = finalDeparture(trip({ items: [home, bus, hotel, out] }))!;
  assert.equal(d.item?.id, 'b1');
  assert.equal(d.at, at('2027-04-07T21:30', 'Asia/Bangkok'));
  // Without the bus the Tokyo flight is last; the Home again day is the day after landing, on Sydney's clock.
  const f = finalDeparture(trip())!;
  assert.equal(f.item?.id, 'f2');
  assert.equal(f.home, '2027-04-09');
  assert.equal(f.homeTz, 'Australia/Sydney');
});

test('final departure fallback: the whole end date in the home zone; null with nothing to place', () => {
  const d = finalDeparture(trip({ items: [hotel] }))!;
  assert.equal(d.item, undefined);
  assert.equal(d.at, at('2027-04-09T00:00', 'Australia/Sydney'));
  assert.equal(d.home, '2027-04-09');
  assert.equal(finalDeparture({ items: [], endDate: 'x', homeTz: 'Australia/Sydney' }), null);
  // An unreadable zone is skipped, never guessed.
  const bad = item({ id: 'x', kind: 'flight', start: { local: '2027-04-09T10:00', tz: 'Mars/Base' } });
  assert.equal(finalDeparture(trip({ items: [bad, home] }))!.item?.id, 'f2');
});

test('due: today / tomorrow / later counted on the departure clock (Tokyo), not the phone or home zone', () => {
  // 6 Apr 23:30 in Tokyo is still 6 Apr there, but already 7 Apr 00:30 in Sydney: Tokyo says "tomorrow".
  assert.equal(comeDue(trip(), at('2027-04-06T23:30', 'Asia/Tokyo'))!.when, 'tomorrow');
  assert.equal(comeDue(trip(), at('2027-04-07T00:10', 'Asia/Tokyo'))!.when, 'today');
  assert.equal(comeDue(trip(), at('2027-04-05T12:00', 'Asia/Tokyo'))!.when, 'later');
  assert.equal(comeDue(trip(), at('2027-04-05T12:00', 'Asia/Tokyo'))!.days, 2);
  const d = comeDue(trip(), at('2027-04-07T21:59', 'Asia/Tokyo'))!;
  assert.equal(d.when, 'today');
  assert.equal(d.time, '22:00');
});

test('due after leaving: travelling until the Home again day on the arrival clock (Sydney), then home, then done', () => {
  assert.equal(comeDue(trip(), at('2027-04-07T22:00', 'Asia/Tokyo'))!.when, 'travelling');
  assert.equal(comeDue(trip(), at('2027-04-08T23:59', 'Australia/Sydney'))!.when, 'travelling');
  assert.equal(comeDue(trip(), at('2027-04-09T00:00', 'Australia/Sydney'))!.when, 'home');
  assert.equal(comeDue(trip(), at('2027-04-10T00:00', 'Australia/Sydney'))!.when, 'done');
});

test('due across the date line: Honolulu to Auckland lands two calendar days later', () => {
  const hnl = item({ id: 'f9', kind: 'flight', start: { local: '2027-06-10T14:00', tz: 'Pacific/Honolulu' }, end: { local: '2027-06-11T21:00', tz: 'Pacific/Auckland' } });
  const t = trip({ items: [hnl], homeTz: 'Pacific/Auckland', endDate: '2027-06-11' });
  const d = finalDeparture(t)!;
  assert.equal(d.home, '2027-06-12');
  // 9 Jun 20:00 in Honolulu is already 10 Jun in Auckland: on the departure clock it's still "tomorrow".
  assert.equal(comeDue(t, at('2027-06-09T20:00', 'Pacific/Honolulu'))!.when, 'tomorrow');
  assert.equal(comeDue(t, at('2027-06-12T08:00', 'Pacific/Auckland'))!.when, 'home');
});

test('end-date fallback: the last day is "today" all day in the home zone', () => {
  const t = trip({ items: [] });
  assert.equal(comeDue(t, at('2027-04-08T23:59', 'Australia/Sydney'))!.when, 'today');
  assert.equal(comeDue(t, at('2027-04-08T23:59', 'Australia/Sydney'))!.time, '');
  assert.equal(comeDue(t, at('2027-04-07T09:00', 'Australia/Sydney'))!.when, 'tomorrow');
  assert.equal(comeDue(t, at('2027-04-09T09:00', 'Australia/Sydney'))!.when, 'home');
});

test('nudges: heading home today/tomorrow until the before list is all ticked; home again the day after', () => {
  const morning = at('2027-04-07T08:00', 'Asia/Tokyo');
  assert.equal(comeNudge(trip(), morning)!.when, 'today'); // not started still nudges
  assert.equal(comeNudge(trip(), at('2027-04-04T08:00', 'Asia/Tokyo')), null);
  let t = startComingHome(trip(), newId, NOW_ISO);
  for (const r of rowsOf(readComingHome(t), 'before')) t = setRowDone(t, r.id, true, NOW_ISO);
  assert.equal(comeNudge(t, morning), null);
  assert.equal(comeNudge(trip(), at('2027-04-08T09:00', 'Australia/Sydney')), null);
  const day = at('2027-04-09T09:00', 'Australia/Sydney');
  assert.equal(homeAgainNudge(t, day)!.when, 'home');
  for (const r of rowsOf(readComingHome(t), 'after')) t = setRowDone(t, r.id, true, NOW_ISO);
  assert.equal(homeAgainNudge(t, day), null);
});

test('checkout: the last stay that ends by the final departure, on its own clock', () => {
  assert.deepEqual(lastCheckout(trip()), { name: 'Hotel Asakusa', date: '2027-04-07', time: '11:00', tz: 'Asia/Tokyo' });
  assert.equal(lastCheckout(trip({ items: [home, out] })), null);
});

// ---------------------------------------------------------------- duty-free row

test('allowance lookup: AU NZ GB IE US CA have their own page, EU members the EU page, others none', () => {
  for (const iso of ['AU', 'NZ', 'GB', 'IE', 'US', 'CA']) assert.equal(allowanceFor(TABLE, iso)?.id, iso);
  for (const iso of ['FR', 'DE', 'ES', 'it']) assert.equal(allowanceFor(TABLE, iso)?.id, 'EU', iso);
  assert.equal(allowanceFor(TABLE, 'JP'), null);
  assert.equal(allowanceFor(TABLE, null), null);
  assert.equal(allowanceHost(allowanceFor(TABLE, 'AU')!), 'abf.gov.au');
});

// ---------------------------------------------------------------- .satchel round trip

test('.satchel: comingHome travels in the file and imports cleaned; older files have none', () => {
  let t = startComingHome(trip(), newId, NOW_ISO);
  t = addOwnRow(t, 'after', 'Pick up the dog', newId, NOW_ISO);
  t = setRating(t, 5, NOW_ISO);
  const file = buildTripFile(t, {}).file;
  const parsed = parseTripFileText(JSON.stringify(file));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const imported = importTripFile(parsed.file, newId, NOW_ISO);
  const ch = readComingHome(imported.trip)!;
  assert.equal(ch.rows.length, 13);
  assert.equal(ch.rating, 5);
  assert.equal(rowsOf(ch, 'after').at(-1)!.label, 'Pick up the dog');
  const older = { ...file, trip: { ...file.trip } } as typeof file;
  delete (older.trip as { comingHome?: unknown }).comingHome;
  const p2 = parseTripFileText(JSON.stringify(older));
  assert.ok(p2.ok && p2.file.trip.comingHome === undefined);
});
