import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import type { Item, Place, Trip } from './model.ts';
import { cityFromAddress, isDemoTrip, regionForZone, statsEmpty, tileSeed, travelStats, tripSpan } from './travelstats.ts';

const item = (id: string, x: Partial<Item> & Pick<Item, 'kind' | 'start'>): Item => ({ id, tripId: 't', title: id, attachments: [], ...x });
const trip = (id: string, x: Partial<Trip> = {}): Trip => ({
  id,
  name: id,
  startDate: '2026-03-01',
  endDate: '2026-03-05',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...x,
});
const SYD: Place = { id: 'syd', name: 'Sydney', lat: -33.9366, lon: 151.1658 };
const HND: Place = { id: 'hnd', name: 'Haneda', lat: 35.5447, lon: 139.7682 };
const LHR: Place = { id: 'lhr', name: 'Heathrow', lat: 51.47, lon: -0.4543 };
const JFK: Place = { id: 'jfk', name: 'JFK', lat: 40.6413, lon: -73.7781 };

test('empty: no trips gives zeros, nothing next, and the empty state', () => {
  const s = travelStats([], '2026-10-31');
  assert.equal(s.tripsTaken, 0);
  assert.deepEqual(s.countries, []);
  assert.deepEqual(s.cities, []);
  assert.equal(s.daysAway, 0);
  assert.equal(s.tripsThisYear, 0);
  assert.equal(s.longest, null);
  assert.deepEqual(s.flights, { legs: 0, measured: 0, unmeasured: 0, km: 0 });
  assert.equal(s.next, null);
  assert.equal(statsEmpty(s), true);
});

test('countries are deduplicated across trips and zones; the home country is left out', () => {
  const a = trip('a', {
    items: [
      item('1', { kind: 'flight', start: { local: '2026-03-01T09:00', tz: 'Australia/Sydney' }, end: { local: '2026-03-01T17:00', tz: 'Asia/Tokyo' } }),
      item('2', { kind: 'train', start: { local: '2026-03-03T09:00', tz: 'Asia/Tokyo' }, end: { local: '2026-03-03T11:00', tz: 'Asia/Tokyo' } }),
    ],
  });
  const b = trip('b', {
    startDate: '2026-06-01',
    endDate: '2026-06-10',
    items: [
      item('3', { kind: 'activity', start: { local: '2026-06-02T09:00', tz: 'Asia/Tokyo' } }),
      item('4', { kind: 'hotel', start: { local: '2026-06-04T15:00', tz: 'Europe/Paris' }, end: { local: '2026-06-06T10:00', tz: 'Europe/Paris' } }),
      item('5', { kind: 'note', start: { local: '2026-06-05T09:00', tz: 'Australia/Melbourne' } }),
    ],
  });
  const s = travelStats([a, b], '2026-10-31');
  assert.deepEqual(s.countries, ['FR', 'JP']);
  assert.equal(s.home, 'AU');
  assert.deepEqual(
    s.tiles.map((x) => [x.iso2, x.region, x.planned]),
    [
      ['FR', 'europe', false],
      ['JP', 'asia', false],
    ],
  );
  assert.equal(s.tripsTaken, 2);
});

test('cities: the town from a hotel address, else the zone city; deduped without case or accents', () => {
  const t = trip('c', {
    homeTz: 'America/New_York',
    items: [
      item('1', { kind: 'hotel', start: { local: '2026-03-01T15:00', tz: 'Europe/Zurich' }, place: { id: 'h', name: 'H', address: 'Bahnhofstrasse 1, 8001 Zürich, Switzerland' } }),
      item('2', { kind: 'activity', start: { local: '2026-03-02T09:00', tz: 'Europe/Zurich' } }),
      item('3', { kind: 'activity', start: { local: '2026-03-03T09:00', tz: 'Europe/Paris' } }),
      item('4', { kind: 'hotel', start: { local: '2026-03-04T15:00', tz: 'Europe/Paris' }, place: { id: 'h2', name: 'H2', address: '1 rue X, 75001 Paris' } }),
      item('5', { kind: 'activity', start: { local: '2026-03-04T09:00', tz: 'America/New_York' } }),
    ],
  });
  const s = travelStats([t], '2026-10-31', { countryName: (c) => ({ CH: 'Switzerland', FR: 'France' })[c] });
  assert.deepEqual(s.cities, ['Paris', 'Zürich']);
  assert.equal(cityFromAddress('2-1 Asakusa, Taito City, Tokyo'), 'Tokyo');
  assert.equal(cityFromAddress('Tokyo'), null);
  assert.equal(cityFromAddress(undefined), null);
});

test('the demo trip gives Japan, Tokyo and Kyoto, and is left out unless included', () => {
  const demo = demoTrip('2026-10-01', '2026-09-01T00:00:00Z');
  assert.equal(isDemoTrip(demo), true);
  const off = travelStats([demo], '2026-10-31');
  assert.equal(off.demoLeftOut, 1);
  assert.equal(off.tripsTaken, 0);
  assert.deepEqual(off.countries, []);
  assert.equal(statsEmpty(off), true);
  const on = travelStats([demo], '2026-10-31', { includeDemo: true });
  assert.equal(on.demoLeftOut, 0);
  assert.deepEqual(on.countries, ['JP']);
  assert.deepEqual(on.cities, ['Kyoto', 'Tokyo']);
  assert.equal(on.flights.legs, 2);
  assert.equal(on.flights.measured, 2);
  // Sydney-Haneda ~7,800 km and Kansai-Sydney ~7,400 km
  assert.ok(on.flights.km > 14_500 && on.flights.km < 16_000, String(on.flights.km));
  // imported copies keep demo: true under another id
  assert.equal(travelStats([{ ...demo, id: 'copy' }], '2026-10-31').demoLeftOut, 1);
});

test('days away: each booking date read in its own zone, overlaps counted once, clipped at today', () => {
  // Home Sydney; trip says 1-10 March but the return leaves LA on the 10th and lands in Sydney on the 12th.
  const t = trip('d', {
    startDate: '2026-03-01',
    endDate: '2026-03-10',
    items: [
      item('out', { kind: 'flight', start: { local: '2026-03-01T10:00', tz: 'Australia/Sydney' }, end: { local: '2026-03-01T06:00', tz: 'America/Los_Angeles' } }),
      item('back', { kind: 'flight', start: { local: '2026-03-10T22:30', tz: 'America/Los_Angeles' }, end: { local: '2026-03-12T07:00', tz: 'Australia/Sydney' } }),
    ],
  });
  assert.deepEqual(tripSpan(t), { start: '2026-03-01', end: '2026-03-12' });
  const s = travelStats([t], '2026-10-31');
  assert.equal(s.daysAway, 12);
  assert.equal(s.longest?.days, 12);
  // an overlapping trip (11-15 March) adds only 13, 14, 15
  const o = trip('o', { startDate: '2026-03-11', endDate: '2026-03-15' });
  assert.equal(travelStats([t, o], '2026-10-31').daysAway, 15);
  // a trip on now counts up to today only
  const now = trip('n', { startDate: '2026-10-29', endDate: '2026-11-08' });
  assert.equal(travelStats([now], '2026-10-31').daysAway, 3);
  // a trip across the new year still counts its days in order
  const ny = trip('y', { startDate: '2025-12-30', endDate: '2026-01-02' });
  assert.equal(travelStats([ny], '2026-10-31').daysAway, 4);
});

test('flight km from coordinates only; legs without coordinates are counted but not measured', () => {
  const t = trip('f', {
    homeTz: 'Europe/London',
    items: [
      item('1', { kind: 'flight', start: { local: '2026-03-01T09:00', tz: 'Europe/London' }, end: { local: '2026-03-01T12:00', tz: 'America/New_York' }, from: LHR, to: JFK }),
      item('2', { kind: 'flight', start: { local: '2026-03-04T19:00', tz: 'America/New_York' }, end: { local: '2026-03-05T07:00', tz: 'Europe/London' }, from: { id: 'x', name: 'JFK' }, to: { id: 'y', name: 'LHR' } }),
      item('3', { kind: 'train', start: { local: '2026-03-02T09:00', tz: 'America/New_York' }, from: JFK, to: LHR }),
      item('4', { kind: 'flight', start: { local: '2026-03-03T09:00', tz: 'America/New_York' }, from: JFK, to: { id: 'z', name: 'Bad', lat: 200, lon: 0 } }),
    ],
  });
  const s = travelStats([t], '2026-10-31');
  assert.equal(s.flights.legs, 3);
  assert.equal(s.flights.measured, 1);
  assert.equal(s.flights.unmeasured, 2);
  // London Heathrow - New York JFK is about 5,540 km
  assert.ok(Math.abs(s.flights.km - 5540) < 20, String(s.flights.km));
  // future flights in a trip on now are not counted yet
  const live = trip('l', {
    startDate: '2026-10-30',
    endDate: '2026-11-05',
    items: [
      item('a', { kind: 'flight', start: { local: '2026-10-30T09:00', tz: 'Australia/Sydney' }, end: { local: '2026-10-30T17:00', tz: 'Asia/Tokyo' }, from: SYD, to: HND }),
      item('b', { kind: 'flight', start: { local: '2026-11-05T09:00', tz: 'Asia/Tokyo' }, from: HND, to: SYD }),
    ],
  });
  assert.equal(travelStats([live], '2026-10-31').flights.legs, 1);
});

test('upcoming: next trip countdown, planned countries kept apart from visited ones, trips this year', () => {
  const past = trip('p', { startDate: '2026-02-01', endDate: '2026-02-04', items: [item('1', { kind: 'activity', start: { local: '2026-02-02T09:00', tz: 'Asia/Tokyo' } })] });
  const soon = trip('s', {
    name: 'Lisbon',
    startDate: '2026-11-10',
    endDate: '2026-11-20',
    items: [
      item('2', { kind: 'hotel', start: { local: '2026-11-10T15:00', tz: 'Europe/Lisbon' } }),
      item('3', { kind: 'activity', start: { local: '2026-11-12T09:00', tz: 'Asia/Tokyo' } }),
    ],
  });
  const later = trip('l', { startDate: '2027-01-05', endDate: '2027-01-09' });
  const s = travelStats([later, past, soon], '2026-10-31');
  assert.deepEqual(s.next, { tripId: 's', name: 'Lisbon', days: 10, zone: 'Europe/Lisbon' });
  assert.deepEqual(s.countries, ['JP']);
  assert.deepEqual(s.planned, ['PT']);
  assert.deepEqual(s.tiles.at(-1), { iso2: 'PT', region: 'europe', planned: true });
  assert.equal(s.tripsThisYear, 2);
  assert.equal(s.tripsTaken, 1);
  assert.equal(statsEmpty(travelStats([soon], '2026-10-31')), false);
});

test('regions and tile seeds are stable', () => {
  assert.equal(regionForZone('America/Argentina/Buenos_Aires'), 'americas');
  assert.equal(regionForZone('Pacific/Auckland'), 'oceania');
  assert.equal(regionForZone('Indian/Maldives', 'MV'), 'asia');
  assert.equal(regionForZone('Indian/Mauritius', 'MU'), 'africa');
  assert.equal(regionForZone('Atlantic/Reykjavik'), 'europe');
  assert.equal(tileSeed('JP'), tileSeed('JP'));
  assert.notEqual(tileSeed('JP'), tileSeed('FR'));
});
