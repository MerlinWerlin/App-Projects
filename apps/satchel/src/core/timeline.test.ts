import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import { groupByDay, nextUp, nightsWithoutBed, overlaps, sortItems, span, tripPhase } from './timeline.ts';
import { toUtc } from './tz.ts';

const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
const byId = (id: string) => trip.items.find((i) => i.id === id)!;

test('items sort by the real instant, not the wall clock', () => {
  // The outbound flight leaves Sydney 09:30 (22:30 UTC the day before); the Tokyo hotel check-in is 15:00 JST.
  const ids = sortItems(trip.items).map((i) => i.id);
  assert.deepEqual(ids.slice(0, 3), ['demo-f1', 'demo-h1', 'demo-a1']);
  assert.equal(ids[ids.length - 1], 'demo-f2');
});

test('groupByDay covers every trip date and files items by their own local date', () => {
  const days = groupByDay(trip);
  assert.equal(days.length, 9);
  assert.equal(days[0].date, '2026-11-03');
  assert.deepEqual(days[0].items.map((i) => i.id), ['demo-f1', 'demo-h1']);
  assert.deepEqual(days[2].items, []);
  assert.deepEqual(days[4].items.map((i) => i.id), ['demo-t1', 'demo-h2']);
  assert.deepEqual(days[8].items, []);
});

test('the demo trip has a bed every night and no clashes', () => {
  assert.deepEqual(nightsWithoutBed(trip), []);
  assert.deepEqual(overlaps(trip.items), []);
});

test('a missing hotel night is found; a red-eye flight covers its night', () => {
  const t: Trip = { ...trip, items: trip.items.filter((i) => i.id !== 'demo-h2') };
  assert.deepEqual(nightsWithoutBed(t), ['2026-11-07', '2026-11-08', '2026-11-09']);
  // the overnight return flight departs on the 10th, so the 10th is covered
  assert.ok(!nightsWithoutBed(t).includes('2026-11-10'));
});

test('clashing transport is flagged; hotel vs flight is not', () => {
  const clash: Item = { ...byId('demo-t1'), id: 'x-bus', kind: 'bus', start: { local: '2026-11-07T13:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-07T15:00', tz: 'Asia/Tokyo' } };
  const pairs = overlaps([...trip.items, clash]);
  assert.equal(pairs.length, 1);
  assert.deepEqual(pairs[0].map((i) => i.id).sort(), ['demo-t1', 'x-bus']);
  const doubleHotel: Item = { ...byId('demo-h1'), id: 'x-h' };
  assert.equal(overlaps([...trip.items, doubleHotel]).length, 1);
});

test('next up: before the trip, in the air, and between items', () => {
  const before = nextUp(trip.items, Date.parse('2026-11-02T20:30:00Z'));
  assert.equal(before?.item.id, 'demo-f1');
  assert.equal(before?.state, 'next');
  assert.equal(before?.minutes, 120);

  // mid-flight (01:00 UTC on 3 Nov): the flight is "now", even though the hotel check-in window has opened later
  const air = nextUp(trip.items, Date.parse('2026-11-03T01:00:00Z'));
  assert.equal(air?.item.id, 'demo-f1');
  assert.equal(air?.state, 'now');
  assert.equal(air?.minutes, (toUtc(byId('demo-f1').end!) - Date.parse('2026-11-03T01:00:00Z')) / 60000);

  // during a hotel stay with nothing else on: the next real item, never the hotel
  const stay = nextUp(trip.items, Date.parse('2026-11-05T03:00:00Z'));
  assert.equal(stay?.item.id, 'demo-t1');
  assert.equal(stay?.state, 'next');

  assert.equal(nextUp(trip.items, Date.parse('2026-12-01T00:00:00Z')), null);
});

test('spans never run backwards and notes are instants', () => {
  for (const i of trip.items) assert.ok(span(i).end >= span(i).start, i.id);
  const n = span(byId('demo-n1'));
  assert.equal(n.end, n.start);
});

test('trip phase', () => {
  assert.equal(tripPhase(trip, '2026-11-01'), 'upcoming');
  assert.equal(tripPhase(trip, '2026-11-05'), 'active');
  assert.equal(tripPhase(trip, '2026-11-12'), 'past');
});
