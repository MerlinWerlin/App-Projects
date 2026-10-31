import assert from 'node:assert/strict';
import { test } from 'node:test';
import { briefTrip, dayBrief } from './daybrief.ts';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import { toUtc } from './tz.ts';

const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
const at = (local: string, tz: string) => toUtc({ local, tz });
const item = (x: Partial<Item> & Pick<Item, 'id' | 'start'>): Item => ({ tripId: 'eu', kind: 'activity', title: x.id, attachments: [], ...x });

test('no trip on today: no brief (before, after, and with no trips)', () => {
  assert.equal(dayBrief([trip], at('2026-10-31T09:00', 'Australia/Sydney')), null);
  assert.equal(dayBrief([trip], at('2026-11-12T09:00', 'Australia/Sydney')), null);
  assert.equal(dayBrief([], Date.UTC(2026, 10, 5)), null);
});

test('a normal day: first and next booking, stops, tonight’s hotel with its address card', () => {
  const b = dayBrief([trip], at('2026-11-04T06:00', 'Asia/Tokyo'));
  assert.ok(b);
  assert.equal(b.zone, 'Asia/Tokyo');
  assert.equal(b.today, '2026-11-04');
  assert.equal(b.day, 2);
  assert.equal(b.total, 9);
  assert.equal(b.lastDay, false);
  assert.equal(b.stops, 1);
  assert.equal(b.first?.id, 'demo-a1');
  assert.equal(b.next?.item.id, 'demo-a1');
  assert.equal(b.next?.state, 'next');
  assert.equal(b.next?.minutes, 90);
  assert.equal(b.tonight?.item.id, 'demo-h1');
  assert.equal(b.tonight?.hasAddress, true);
  assert.equal(b.early, null);
  // Later the same day: the market is under way, then done.
  assert.equal(dayBrief([trip], at('2026-11-04T08:00', 'Asia/Tokyo'))?.next?.state, 'now');
  const done = dayBrief([trip], at('2026-11-04T18:00', 'Asia/Tokyo'));
  assert.equal(done?.next, null);
  assert.equal(done?.first?.id, 'demo-a1');
});

test('a train day: next is the train, then the hotel check-in; tonight is the new hotel', () => {
  const b = dayBrief([trip], at('2026-11-07T09:50', 'Asia/Tokyo'));
  assert.ok(b);
  assert.equal(b.next?.item.id, 'demo-t1');
  assert.equal(b.next?.minutes, 133);
  // Check-out from the first hotel isn't a stop; the train and the new check-in are.
  assert.deepEqual(
    b.items.map((i) => i.id),
    ['demo-t1', 'demo-h2'],
  );
  assert.equal(b.stops, 2);
  assert.equal(b.tonight?.item.id, 'demo-h2');
  assert.equal(dayBrief([trip], at('2026-11-07T13:00', 'Asia/Tokyo'))?.next?.item.id, 'demo-t1');
  assert.equal(dayBrief([trip], at('2026-11-07T14:30', 'Asia/Tokyo'))?.next?.item.id, 'demo-h2');
});

test('overnight flight crossing midnight: counted on the day it leaves, still "now" after midnight', () => {
  const before = dayBrief([trip], at('2026-11-10T22:00', 'Asia/Tokyo'));
  assert.ok(before);
  assert.equal(before.today, '2026-11-10');
  assert.equal(before.next?.item.id, 'demo-f2');
  assert.equal(before.next?.state, 'now');
  assert.equal(before.tonight, null); // you sleep on the plane
  const after = dayBrief([trip], at('2026-11-11T00:30', 'Asia/Tokyo'));
  assert.ok(after);
  assert.equal(after.zone, 'Asia/Tokyo'); // still travelling: the zone you left from
  assert.equal(after.today, '2026-11-11');
  assert.equal(after.first?.id, 'demo-f2');
  assert.equal(after.stops, 0);
  assert.equal(after.next?.state, 'now');
  assert.equal(after.next?.minutes, 380); // lands 08:50 Sydney = 06:50 Tokyo
});

test('last day: flagged, no hotel tonight, nothing next once you have landed', () => {
  const b = dayBrief([trip], at('2026-11-11T10:00', 'Australia/Sydney'));
  assert.ok(b);
  assert.equal(b.zone, 'Australia/Sydney');
  assert.equal(b.lastDay, true);
  assert.equal(b.day, 9);
  assert.equal(b.tonight, null);
  assert.equal(b.next, null);
  assert.equal(b.first?.id, 'demo-f2');
});

const eu: Trip = {
  id: 'eu',
  name: 'London and Paris',
  startDate: '2026-11-03',
  endDate: '2026-11-06',
  homeTz: 'Australia/Sydney',
  createdAt: '2026-10-01T00:00:00Z',
  items: [
    item({ id: 'hotel', kind: 'hotel', title: 'Riverside rooms', start: { local: '2026-11-03T15:00', tz: 'Europe/London' }, end: { local: '2026-11-06T10:00', tz: 'Europe/London' }, place: { id: 'p', name: 'Riverside rooms' } }),
    item({ id: 'late', title: 'Late show', start: { local: '2026-11-04T23:30', tz: 'Europe/Paris' } }),
    item({ id: 'midnight', title: 'Night tour', start: { local: '2026-11-05T00:30', tz: 'Europe/Paris' } }),
    item({ id: 'train', kind: 'train', title: 'London → Paris', start: { local: '2026-11-05T08:30', tz: 'Europe/Paris' }, end: { local: '2026-11-05T11:00', tz: 'Europe/Paris' } }),
    item({ id: 'lunch', title: 'Lunch', start: { local: '2026-11-05T12:00', tz: 'Europe/London' } }),
  ],
};

test('an item in another zone counts on the day it falls on where you are; early heads-up uses its own clock', () => {
  const b = dayBrief([eu], at('2026-11-04T20:00', 'Europe/London'));
  assert.ok(b);
  assert.equal(b.zone, 'Europe/London');
  // 23:30 Paris = 22:30 London (today); 00:30 Paris on the 5th = 23:30 London on the 4th (also today).
  assert.deepEqual(
    b.items.map((i) => i.id),
    ['late', 'midnight'],
  );
  assert.equal(b.stops, 2);
  assert.equal(b.next?.item.id, 'late');
  assert.equal(b.next?.minutes, 150);
  assert.equal(b.tonight?.item.id, 'hotel');
  assert.equal(b.tonight?.hasAddress, false);
  assert.equal(b.early?.id, 'train'); // 08:30 Paris, before 09:00 on the ticket
});

test('no early heads-up when tomorrow starts at a civil hour; two trips on: the earlier one', () => {
  const late: Trip = { ...eu, items: eu.items.filter((i) => i.id !== 'train') };
  assert.equal(dayBrief([late], at('2026-11-04T20:00', 'Europe/London'))?.early, null);
  const other: Trip = { ...eu, id: 'later', startDate: '2026-11-04' };
  assert.equal(briefTrip([other, eu], at('2026-11-04T20:00', 'Europe/London'))?.id, 'eu');
});
