import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { clockPair, countdown, dayPart, destinationZone, focusTrip, formatOffset, placeCode, quickStats, todayAgenda, tripRoute } from './glance.ts';
import type { Trip } from './model.ts';
import { toUtc } from './tz.ts';

const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');

test('dayPart splits the day into four greetings', () => {
  assert.equal(dayPart(5), 'morning');
  assert.equal(dayPart(11), 'morning');
  assert.equal(dayPart(12), 'afternoon');
  assert.equal(dayPart(18), 'evening');
  assert.equal(dayPart(22), 'night');
  assert.equal(dayPart(2), 'night');
});

test('destination is the zone the trip mostly sits in, home excluded', () => {
  assert.equal(destinationZone(trip), 'Asia/Tokyo');
  const home: Trip = { ...trip, items: trip.items.map((i) => ({ ...i, start: { ...i.start, tz: trip.homeTz }, end: i.end ? { ...i.end, tz: trip.homeTz } : undefined })) };
  assert.equal(destinationZone(home), null);
  assert.equal(tripRoute(home), null);
});

test('route codes prefer an explicit code in the place name, else the city', () => {
  assert.equal(placeCode('Narita Airport (NRT)'), 'NRT');
  assert.equal(placeCode('Sydney'), 'SYD');
  assert.equal(placeCode('Zürich'), 'ZUR');
  assert.equal(placeCode(''), '---');
  const r = tripRoute(trip);
  assert.ok(r);
  assert.equal(r.toCity, 'Tokyo');
  assert.equal(r.toCode, 'TOK');
  assert.equal(r.fromCode.length, 3);
});

test('countdown: days until, start day, day N of M with progress, past', () => {
  assert.deepEqual(countdown(trip, '2026-10-22'), { kind: 'upcoming', days: 12 });
  assert.deepEqual(countdown(trip, '2026-11-03'), { kind: 'today' });
  const c = countdown(trip, '2026-11-05');
  assert.equal(c.kind, 'active');
  if (c.kind === 'active') {
    assert.equal(c.day, 3);
    assert.equal(c.total, 9);
    assert.ok(Math.abs(c.progress - 3 / 9) < 1e-9);
  }
  assert.deepEqual(countdown(trip, '2026-12-01'), { kind: 'past' });
});

test('focusTrip picks the trip on now, else the soonest upcoming; stats skip past trips', () => {
  const later: Trip = { ...trip, id: 'b', startDate: '2027-01-10', endDate: '2027-01-12', items: [] };
  const old: Trip = { ...trip, id: 'c', startDate: '2025-01-10', endDate: '2025-01-12' };
  assert.equal(focusTrip([later, trip, old], '2026-10-30')?.id, trip.id);
  assert.equal(focusTrip([later, old], '2026-10-30')?.id, 'b');
  assert.equal(focusTrip([old], '2026-10-30'), null);
  const s = quickStats([later, trip, old], '2026-10-30');
  assert.equal(s.trips, 2);
  assert.equal(s.daysAway, 9 + 3);
  assert.equal(s.bookings, trip.items.filter((i) => i.kind !== 'note').length);
});

test('todayAgenda lists today in each booking’s own zone and marks done / now / later', () => {
  const f1 = trip.items.find((i) => i.id === 'demo-f1')!;
  // Mid-flight: the flight is under way, the hotel check-in later the same Tokyo day.
  const now = toUtc(f1.start) + 60 * 60_000;
  const rows = todayAgenda([trip], now);
  const f = rows.find((r) => r.item.id === 'demo-f1');
  assert.equal(f?.state, 'now');
  assert.equal(rows.find((r) => r.item.id === 'demo-h1')?.state, 'later');
  assert.equal(todayAgenda([trip], toUtc({ local: '2026-12-20T12:00', tz: 'UTC' })).length, 0);
});

test('clockPair and formatOffset', () => {
  const now = Date.UTC(2026, 10, 5, 3, 0); // 5 Nov 03:00 UTC: Tokyo 12:00, Sydney 14:00 (AEDT)
  const c = clockPair('Asia/Tokyo', 'Australia/Sydney', now);
  assert.ok(c);
  assert.equal(c.destTime, '12:00');
  assert.equal(c.homeTime, '14:00');
  assert.equal(c.diffMinutes, -120);
  assert.equal(formatOffset(-120), '−2h');
  assert.equal(formatOffset(345), '+5h 45m');
  assert.equal(formatOffset(30), '+30m');
  assert.equal(formatOffset(0), '');
  assert.equal(clockPair('Not/AZone', 'UTC', now), null);
});
