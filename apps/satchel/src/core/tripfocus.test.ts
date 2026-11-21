import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chosenTrip } from './tripfocus.ts';

const a = { id: 'a', name: 'Girls trip' };
const b = { id: 'b', name: 'Bali with Mum' };

test('chosenTrip: the picked trip wins while it exists', () => {
  assert.equal(chosenTrip([a, b], 'b', a), b);
});

test('chosenTrip: unset, unknown, deleted or junk picks fall back to the automatic trip', () => {
  assert.equal(chosenTrip([a, b], null, a), a);
  assert.equal(chosenTrip([a, b], 'gone', a), a);
  assert.equal(chosenTrip([a], 'b', a), a);
  assert.equal(chosenTrip([a, b], 42, b), b);
  assert.equal(chosenTrip([], 'a', null), null);
});

import { orderTrips, parseStoredTrips } from './trips.ts';
import type { Trip } from './model.ts';

test('existing data: a 1.0 build-18 save (one trip, no focus key) loads as that one trip with every booking kept', () => {
  const saved = [
    {
      id: 'japan', name: 'Tokyo & Kyoto', startDate: '2026-11-20', endDate: '2026-11-28', homeTz: 'Australia/Sydney', createdAt: '2026-11-01T00:00:00Z',
      items: [
        { id: 'f1', kind: 'flight', title: 'SYD → HND', start: { local: '2026-11-20T09:00', tz: 'Australia/Sydney' }, end: { local: '2026-11-20T17:30', tz: 'Asia/Tokyo' }, attachments: [{ id: 'p', uri: 'attachments/p.png', name: 'pass.png', mime: 'image/png' }] },
        { id: 'h1', kind: 'hotel', title: 'Asakusa', start: { local: '2026-11-20T15:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-24T10:00', tz: 'Asia/Tokyo' } },
      ],
      expenses: [{ id: 'e1' }],
      journal: [{ day: '2026-11-21' }],
    },
  ];
  const trips = parseStoredTrips(JSON.stringify(saved)) as Trip[];
  assert.equal(trips.length, 1);
  assert.equal(trips[0].name, 'Tokyo & Kyoto');
  assert.deepEqual(trips[0].items.map((i) => i.id), ['f1', 'h1']);
  assert.equal(trips[0].items[0].attachments?.length, 1);
  assert.deepEqual(trips[0].expenses, [{ id: 'e1' }]);
  assert.deepEqual(trips[0].journal as unknown, [{ day: '2026-11-21' }]);
  // with no pick saved, Home and the Itinerary tab show it
  assert.equal(chosenTrip(trips, null, trips[0])?.id, 'japan');
});

test('several trips: each keeps its own title and bookings, all are listed, and picking one switches to it', () => {
  const mk = (id: string, name: string, start: string, end: string): Trip =>
    ({ id, name, startDate: start, endDate: end, homeTz: 'Australia/Sydney', createdAt: '2026-01-01T00:00:00Z', items: [{ id: `${id}-i`, tripId: id, kind: 'note', title: name, start: { local: `${start}T09:00`, tz: 'Australia/Sydney' }, attachments: [] }] }) as unknown as Trip;
  const trips = [mk('girls', 'Girls trip', '2026-11-20', '2026-11-28'), mk('bali', 'Bali with Mum', '2027-03-01', '2027-03-08'), mk('nz', 'NZ ski', '2026-07-01', '2026-07-07')];
  const listed = orderTrips(trips, '2026-11-22');
  assert.deepEqual(listed.map((x) => x.name), ['Girls trip', 'Bali with Mum', 'NZ ski']);
  const picked = chosenTrip(listed, 'bali', listed[0]);
  assert.equal(picked?.name, 'Bali with Mum');
  assert.deepEqual(picked?.items.map((i) => i.id), ['bali-i']);
});
