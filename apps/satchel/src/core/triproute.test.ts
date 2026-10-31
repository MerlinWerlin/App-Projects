import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import { appleMapsWalkUrl } from './toilets.ts';
import { ALL_DAYS, boundsOf, cameraFor, defaultRouteDay, itemDays, legsOf, routeToday, routeView, tripRoute } from './triproute.ts';

const item = (id: string, local: string, tz: string, lat?: number, lon?: number, extra: Partial<Item> = {}): Item => ({
  id,
  tripId: 't',
  kind: 'activity',
  title: `Title ${id}`,
  start: { local, tz },
  attachments: [],
  ...(lat === undefined ? {} : { place: { id: `p-${id}`, name: `Place ${id}`, lat, lon } }),
  ...extra,
});

const trip = (items: Item[], extra: Partial<Trip> = {}): Trip => ({
  id: 't',
  name: 'Test',
  startDate: '2026-11-02',
  endDate: '2026-11-04',
  homeTz: 'Europe/London',
  items,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
});

test('empty trip: one empty day per trip date, no stops, camera does nothing', () => {
  const r = tripRoute(trip([]));
  assert.deepEqual(
    r.days.map((d) => [d.date, d.dayNumber, d.stops.length]),
    [
      ['2026-11-02', 1, 0],
      ['2026-11-03', 2, 0],
      ['2026-11-04', 3, 0],
    ],
  );
  assert.equal(r.stopCount, 0);
  assert.deepEqual(r.saved, []);
  const v = routeView(r, ALL_DAYS);
  assert.deepEqual(v.stops, []);
  assert.deepEqual(cameraFor(v.framePoints), { kind: 'none' });
  assert.equal(boundsOf([]), null);
});

test('items without coordinates (or with bad ones) are skipped', () => {
  const r = tripRoute(
    trip([
      item('a', '2026-11-02T09:00', 'Europe/Paris', 48.85, 2.35),
      item('b', '2026-11-02T10:00', 'Europe/Paris'),
      item('c', '2026-11-02T11:00', 'Europe/Paris', 200, 2.35),
      item('d', '2026-11-02T12:00', 'Europe/Paris', 48.86, 2.34, { kind: 'hotel' }),
    ]),
  );
  assert.equal(r.stopCount, 2);
  assert.deepEqual(
    r.days[0].stops.map((s) => [s.itemId, s.n, s.kind, s.time]),
    [
      ['a', 1, 'activity', '09:00'],
      ['d', 2, 'hotel', '12:00'],
    ],
  );
});

test('single stop: no legs, zero distance, camera zooms to the spot', () => {
  const r = tripRoute(trip([item('a', '2026-11-03T09:00', 'Asia/Tokyo', 35.6655, 139.7707)]));
  const d = r.days.find((x) => x.date === '2026-11-03');
  assert.ok(d);
  assert.equal(d.stops.length, 1);
  assert.deepEqual(d.legs, []);
  assert.equal(d.meters, 0);
  assert.deepEqual(cameraFor(routeView(r, '2026-11-03').framePoints), { kind: 'point', at: { lat: 35.6655, lon: 139.7707 } });
});

test('per-day legs and distance; numbering restarts each day; no leg joins two days', () => {
  const r = tripRoute(
    trip([
      item('a', '2026-11-02T09:00', 'Asia/Tokyo', 35.0, 135.0),
      item('b', '2026-11-02T13:00', 'Asia/Tokyo', 35.01, 135.0),
      item('c', '2026-11-02T18:00', 'Asia/Tokyo', 35.01, 135.01),
      item('d', '2026-11-03T09:00', 'Asia/Tokyo', 36.0, 136.0),
    ]),
  );
  const [d1, d2] = r.days;
  assert.deepEqual(d1.stops.map((s) => s.n), [1, 2, 3]);
  assert.deepEqual(d2.stops.map((s) => s.n), [1]);
  assert.equal(d1.legs.length, 2);
  assert.equal(d1.legs[0].from.itemId, 'a');
  assert.equal(d1.legs[0].to.itemId, 'b');
  // 0.01° of latitude is about 1.11 km.
  assert.ok(Math.abs(d1.legs[0].meters - 1112) < 5, String(d1.legs[0].meters));
  assert.ok(Math.abs(d1.meters - (d1.legs[0].meters + d1.legs[1].meters)) < 1e-9);
  const all = routeView(r, ALL_DAYS);
  assert.equal(all.legs.length, 2, 'the last stop of day 1 is not joined to day 2');
  assert.equal(all.stops.length, 4);
  const v = routeView(r, '2026-11-03');
  assert.deepEqual(v.stops.map((s) => s.itemId), ['d']);
  assert.deepEqual(routeView(r, '2030-01-01').stops, [], 'an unknown day shows nothing');
});

test('crossing zones: day is the local date in each item’s own zone, order is the real instant', () => {
  // Leave Sydney 2 Nov 23:30 (12:30 UTC); an Auckland dinner on 3 Nov 01:00 local (2 Nov 12:00 UTC) happens first
  // in real time but sits on 3 Nov; a Honolulu stop on 2 Nov 08:00 local (18:00 UTC) is on 2 Nov after Sydney.
  const r = tripRoute(
    trip([
      item('hnl', '2026-11-02T08:00', 'Pacific/Honolulu', 21.3, -157.85),
      item('syd', '2026-11-02T23:30', 'Australia/Sydney', -33.87, 151.21),
      item('akl', '2026-11-03T01:00', 'Pacific/Auckland', -36.85, 174.76),
      item('akl2', '2026-11-03T09:00', 'Pacific/Auckland', -36.84, 174.77),
    ]),
  );
  const d2 = r.days.find((d) => d.date === '2026-11-02');
  const d3 = r.days.find((d) => d.date === '2026-11-03');
  assert.deepEqual(d2?.stops.map((s) => [s.itemId, s.tz, s.time]), [
    ['syd', 'Australia/Sydney', '23:30'],
    ['hnl', 'Pacific/Honolulu', '08:00'],
  ]);
  assert.deepEqual(d3?.stops.map((s) => s.itemId), ['akl', 'akl2']);
  const days = itemDays(trip([item('x', '2026-11-04T23:59', 'Asia/Tokyo')]));
  assert.equal(days.get('x'), '2026-11-04');
});

test('a booking dated before the trip gets its own day, numbered before Day 1', () => {
  const r = tripRoute(trip([item('early', '2026-11-01T20:00', 'Europe/Paris', 48.85, 2.35)]));
  assert.equal(r.days[0].date, '2026-11-01');
  assert.equal(r.days[0].dayNumber, 0);
  assert.deepEqual(r.days.map((d) => d.index), [0, 1, 2, 3]);
});

test('saved places: listed apart, never in a day’s legs; framed on All days or when a day has no stops', () => {
  const t = trip([item('a', '2026-11-02T09:00', 'Asia/Tokyo', 35.0, 135.0), item('b', '2026-11-02T10:00', 'Asia/Tokyo', 35.02, 135.0)], {
    places: [
      { id: 'p1', name: 'Ramen bar', lat: 35.1, lon: 135.1, category: 'food', savedAt: '2026-10-30T00:00:00Z' },
      { id: 'p2', name: 'Sample shrine', lat: 35.2, lon: 135.2, sample: true, savedAt: '2026-10-30T00:00:00Z' },
      { id: 'bad', name: '', lat: 1, lon: 1, savedAt: '' } as never,
    ],
  });
  const r = tripRoute(t);
  assert.deepEqual(
    r.saved.map((s) => [s.placeId, s.category ?? null, s.sample]),
    [
      ['p1', 'food', false],
      ['p2', null, true],
    ],
  );
  assert.equal(r.stopCount, 2);
  const all = routeView(r, ALL_DAYS);
  assert.equal(all.legs.length, 1);
  assert.equal(all.framePoints.length, 4);
  assert.equal(routeView(r, '2026-11-02').framePoints.length, 2, 'a day frames its own stops');
  assert.equal(routeView(r, '2026-11-03').framePoints.length, 2, 'an empty day frames the saved places');
  const b = boundsOf(all.framePoints);
  assert.deepEqual(b, { south: 35.0, west: 135.0, north: 35.2, east: 135.2 });
  assert.equal(cameraFor(all.framePoints).kind, 'fit');
});

test('today in the trip’s own zone, and the day the map opens on', () => {
  const t = trip([item('a', '2026-11-03T09:00', 'Asia/Tokyo', 35, 135)], { homeTz: 'Asia/Tokyo' });
  const r = tripRoute(t);
  // 2 Nov 20:00 UTC is already 3 Nov 05:00 in Tokyo.
  const now = Date.UTC(2026, 10, 2, 20, 0);
  assert.equal(routeToday(t, now), '2026-11-03');
  assert.equal(defaultRouteDay(r, routeToday(t, now)), '2026-11-03');
  // A trip day without stops opens on every day.
  assert.equal(defaultRouteDay(r, '2026-11-02'), ALL_DAYS);
  assert.equal(routeToday(t, Date.UTC(2026, 11, 25)), null);
  assert.equal(defaultRouteDay(r, null), ALL_DAYS);
});

test('the demo trip maps its hotels and the market on their own days', () => {
  const t = demoTrip('2026-11-02');
  const r = tripRoute(t);
  assert.ok(r.stopCount >= 3);
  for (const d of r.days) for (const s of d.stops) assert.equal(s.day, d.date);
  assert.deepEqual(legsOf([]), []);
});

test('walking directions between two stops: start and end in the Apple Maps link', () => {
  assert.equal(
    appleMapsWalkUrl(35.0037, 135.7788, 'Gion Garden Inn', { lat: 34.9858, lon: 135.7588 }),
    'http://maps.apple.com/?saddr=34.9858,135.7588&daddr=35.0037,135.7788&dirflg=w&q=Gion%20Garden%20Inn',
  );
  assert.equal(appleMapsWalkUrl(35, 135.5), 'http://maps.apple.com/?daddr=35,135.5&dirflg=w');
});
