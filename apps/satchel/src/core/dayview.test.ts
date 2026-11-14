// T170 Today timetable: day bucketing, now / next, free time, stays, zones. Every name below is invented.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daySchedule, dayStrip, headline, lookOf, openingDay, stayTonight, todayTomorrow, tripToday, type Block, type FreeBlock } from './dayview.ts';
import type { Item, Trip } from './model.ts';
import { toUtc } from './tz.ts';

const P = 'Europe/Paris';
let n = 0;
const item = (kind: Item['kind'], title: string, start: string, end?: string, tz = P, endTz = tz): Item => ({
  id: `i${++n}`,
  tripId: 't',
  kind,
  title,
  start: { local: start, tz },
  end: end ? { local: end, tz: endTz } : undefined,
  attachments: [],
});

const at = (local: string, tz = P) => toUtc({ local, tz });

function paris(): Trip {
  n = 0;
  return {
    id: 't',
    name: 'Paris',
    startDate: '2027-03-02',
    endDate: '2027-03-06',
    homeTz: 'Australia/Sydney',
    createdAt: '2027-01-01',
    items: [
      // Overnight flight from Sydney, lands in Paris the next morning.
      item('flight', 'QF1 to Paris', '2027-03-02T21:00', '2027-03-03T07:30', 'Australia/Sydney', P),
      item('hotel', 'Hôtel Exemple', '2027-03-03T15:00', '2027-03-06T11:00'),
      item('activity', 'Louvre guided tour', '2027-03-03T10:00', '2027-03-03T12:00'),
      item('activity', 'Dinner at Chez Exemple', '2027-03-03T19:30'),
      item('note', 'Free time', '2027-03-04T09:00'),
      item('train', 'TGV to Lyon', '2027-03-05T08:00', '2027-03-05T10:00'),
      item('car', 'Car hire', '2027-03-05T10:30', '2027-03-06T09:00'),
    ],
  };
}

const blocks = (rows: (Block | FreeBlock)[]) => rows.filter((r): r is Block => r.type === 'block');
const frees = (rows: (Block | FreeBlock)[]) => rows.filter((r): r is FreeBlock => r.type === 'free');

test('looks: food, tours, transfers and free time from the title', () => {
  assert.equal(lookOf(item('activity', 'Dinner at Chez Exemple', '2027-03-03T19:30')), 'food');
  assert.equal(lookOf(item('activity', 'Louvre guided tour', '2027-03-03T10:00')), 'tour');
  assert.equal(lookOf(item('activity', 'Airport transfer', '2027-03-03T10:00')), 'transfer');
  assert.equal(lookOf(item('bus', 'Hotel shuttle', '2027-03-03T10:00', '2027-03-03T11:00')), 'transfer');
  assert.equal(lookOf(item('note', 'Free time', '2027-03-03T10:00')), 'free');
  assert.equal(lookOf(item('activity', 'Spa', '2027-03-03T10:00')), 'activity');
});

test('day bucketing: overnight arrival, check-in, plans in time order, free gaps', () => {
  const trip = paris();
  const s = daySchedule(trip, '2027-03-03', at('2027-03-01T12:00'));
  assert.equal(s.zone, P);
  assert.deepEqual(
    blocks(s.rows).map((b) => [b.item.title, b.role, b.look]),
    [
      ['QF1 to Paris', 'arrive', 'flight'],
      ['Louvre guided tour', 'whole', 'tour'],
      ['Hôtel Exemple', 'checkin', 'checkin'],
      ['Dinner at Chez Exemple', 'whole', 'food'],
    ],
  );
  // The flight started in Sydney: a block in another zone, ending the day after it left.
  const fl = blocks(s.rows)[0];
  assert.equal(fl.otherZone, true);
  assert.equal(fl.endsNextDay, true);
  // Gaps: 07:30 → 10:00 (2h30), 12:00 → 15:00, 15:00 → 19:30; dinner (assumed 1h) ends 20:30, evening < 2h so none.
  assert.deepEqual(
    frees(s.rows).map((f) => [f.where, f.from.slice(11), f.to.slice(11)]),
    [
      ['between', '07:30', '10:00'],
      ['between', '12:00', '15:00'],
      ['between', '15:00', '19:30'],
    ],
  );
  assert.equal(s.tonight?.title, 'Hôtel Exemple');
  assert.equal(s.dayNumber, 2);
  assert.equal(s.totalDays, 5);
});

test('middle of a stay: no hotel block, but tonight is the stay; free morning and evening around a note', () => {
  const trip = paris();
  const s = daySchedule(trip, '2027-03-04', at('2027-03-01T12:00'));
  assert.deepEqual(blocks(s.rows).map((b) => b.item.title), ['Free time']);
  assert.equal(s.tonight?.title, 'Hôtel Exemple');
});

test('a day with nothing planned is all free', () => {
  const trip = paris();
  trip.items = trip.items.filter((i) => i.kind === 'hotel');
  const s = daySchedule(trip, '2027-03-04', at('2027-03-01T12:00'));
  assert.equal(s.blocks.length, 0);
  assert.deepEqual(frees(s.rows).map((f) => f.where), ['day']);
});

test('check-out, train and car pick-up on one day; car return the next', () => {
  const trip = paris();
  const d5 = daySchedule(trip, '2027-03-05', at('2027-03-01T12:00'));
  assert.deepEqual(blocks(d5.rows).map((b) => [b.item.title, b.role]), [
    ['TGV to Lyon', 'whole'],
    ['Car hire', 'pickup'],
  ]);
  const d6 = daySchedule(trip, '2027-03-06', at('2027-03-01T12:00'));
  assert.deepEqual(blocks(d6.rows).map((b) => [b.item.title, b.role]), [
    ['Car hire', 'return'],
    ['Hôtel Exemple', 'checkout'],
  ]);
  assert.equal(d6.tonight, null);
});

test('now and next, and the free gap you are in', () => {
  const trip = paris();
  // 11:00 Paris on 3 Mar: the tour is on; check-in is next (both highlighted).
  const s = daySchedule(trip, '2027-03-03', at('2027-03-03T11:00'));
  const st = Object.fromEntries(blocks(s.rows).map((b) => [b.item.title, b.state]));
  assert.deepEqual(st, { 'QF1 to Paris': 'done', 'Louvre guided tour': 'now', 'Hôtel Exemple': 'next', 'Dinner at Chez Exemple': 'later' });
  assert.equal(headline(s)?.item.title, 'Louvre guided tour');
  // 13:00: in the gap; check-in is next.
  const s2 = daySchedule(trip, '2027-03-03', at('2027-03-03T13:00'));
  assert.equal(blocks(s2.rows).find((b) => b.state === 'next')?.item.title, 'Hôtel Exemple');
  assert.ok(frees(s2.rows).some((f) => f.current && f.from.endsWith('12:00')));
  // Late at night: tomorrow's first block is next, so today has none.
  const s3 = daySchedule(trip, '2027-03-03', at('2027-03-03T23:30'));
  assert.ok(blocks(s3.rows).every((b) => b.state === 'done'));
  assert.equal(daySchedule(trip, '2027-03-04', at('2027-03-03T23:30')).blocks[0].state, 'next');
});

test('today, tomorrow, opening day and the day strip', () => {
  const trip = paris();
  // Before the trip (traveller still in Sydney): opens on day 1.
  assert.equal(openingDay(trip, at('2027-02-20T10:00')), '2027-03-02');
  // During: today where the traveller is (Paris after the flight lands).
  const now = at('2027-03-04T09:30');
  assert.equal(tripToday(trip, now), '2027-03-04');
  assert.deepEqual(todayTomorrow(trip, now), { today: '2027-03-04', tomorrow: '2027-03-05' });
  // Last day: no tomorrow. After: the last day.
  assert.deepEqual(todayTomorrow(trip, at('2027-03-06T09:30')), { today: '2027-03-06', tomorrow: null });
  assert.equal(openingDay(trip, at('2027-04-01T09:30')), '2027-03-06');
  const strip = dayStrip(trip, now);
  assert.deepEqual(strip.map((d) => d.date), ['2027-03-02', '2027-03-03', '2027-03-04', '2027-03-05', '2027-03-06']);
  assert.deepEqual(strip.map((d) => d.lead), ['flight', 'flight', 'free', 'train', 'checkout']);
  assert.deepEqual(strip.map((d) => d.today), [false, false, true, false, false]);
  assert.deepEqual(strip.map((d) => d.past), [true, true, false, false, false]);
  assert.equal(strip[1].count, 4);
});

test('stay tonight picks the stay whose nights include the date', () => {
  const trip = paris();
  assert.equal(stayTonight(trip, '2027-03-02'), null);
  assert.equal(stayTonight(trip, '2027-03-05')?.title, 'Hôtel Exemple');
  assert.equal(stayTonight(trip, '2027-03-06'), null);
});

test('an item with a zone this phone cannot read is left off the timetable, never thrown on', () => {
  const trip = paris();
  trip.items.push(item('activity', 'Broken zone', '2027-03-03T09:00', undefined, 'Not/AZone'));
  const s = daySchedule(trip, '2027-03-03', at('2027-03-03T09:00'));
  assert.ok(!s.blocks.some((b) => b.item.title === 'Broken zone'));
});
