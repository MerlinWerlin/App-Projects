import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { formatDay, formatDuration, formatRange, todayIn, zoneCity } from './format.ts';
import { draftFromItem, itemFromDraft, mergeRecovered, newItemDraft, newTripDraft, orderTrips, removeItem, removeTrip, tripFromDraft, upsertItem, upsertTrip, validateItem, validateTrip } from './trips.ts';

const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');

test('trip validation', () => {
  assert.deepEqual(validateTrip({ name: 'Japan', startDate: '2026-11-03', endDate: '2026-11-11', homeTz: 'Australia/Sydney' }), []);
  assert.deepEqual(validateTrip({ name: ' ', startDate: '2026-11-03', endDate: '2026-11-01', homeTz: 'Nowhere/Here' }), ['name', 'endBeforeStart', 'homeTz']);
  assert.deepEqual(validateTrip({ name: 'x', startDate: '2026-13-01', endDate: '', homeTz: 'UTC' }), ['startDate', 'endDate']);
  const d = newTripDraft('2026-10-24', 'Australia/Sydney');
  assert.equal(d.startDate, '2026-10-31');
});

test('item validation: arrival before departure is fine across the dateline, not otherwise', () => {
  const d = { ...newItemDraft('flight', '2026-11-10', 'Asia/Tokyo'), title: 'Tokyo → Honolulu', startTime: '21:00', endDate: '2026-11-10', endTime: '09:25', endTz: 'Pacific/Honolulu' };
  assert.deepEqual(validateItem(d), []);
  assert.deepEqual(validateItem({ ...d, endTz: 'Asia/Tokyo' }), ['endBeforeStart']);
  assert.deepEqual(validateItem({ ...d, endDate: '', endTime: '' }), ['endRequired']);
  assert.deepEqual(validateItem({ ...d, title: '', startTime: '9:00', startTz: 'Bad/Zone' }), ['title', 'start', 'startTz']);
  const note = { ...newItemDraft('note', '2026-11-10', 'Asia/Tokyo'), title: 'Cash' };
  assert.deepEqual(validateItem(note), []);
  const act = { ...newItemDraft('activity', '2026-11-10', 'Asia/Tokyo'), title: 'Museum' };
  assert.deepEqual(validateItem(act), []);
});

test('draft round trip keeps the item', () => {
  for (const it of trip.items) {
    const back = itemFromDraft(draftFromItem(it), trip.id, it);
    assert.equal(back.id, it.id);
    assert.deepEqual(back.start, it.start);
    assert.deepEqual(back.end, it.end);
    assert.equal(back.title, it.title);
    assert.equal(back.place?.localAddress, it.place?.localAddress);
    assert.equal(back.from?.name, it.from?.name);
  }
});

test('hotel draft defaults: 15:00 check-in, 11:00 next-day check-out', () => {
  const h = newItemDraft('hotel', '2026-11-03', 'Asia/Tokyo');
  assert.equal(h.startTime, '15:00');
  assert.equal(h.endDate, '2026-11-04');
  assert.equal(h.endTime, '11:00');
});

test('list operations', () => {
  let trips = upsertTrip([], trip);
  assert.equal(trips.length, 1);
  const extra = itemFromDraft({ ...newItemDraft('note', '2026-11-14', 'Asia/Tokyo'), title: 'Late note' }, trip.id);
  trips = upsertItem(trips, extra);
  assert.equal(trips[0].items.length, trip.items.length + 1);
  assert.equal(trips[0].endDate, '2026-11-14', 'trip stretches to include the item');
  trips = removeItem(trips, trip.id, extra.id);
  assert.equal(trips[0].items.length, trip.items.length);
  const t2 = tripFromDraft({ name: 'Past', startDate: '2025-01-01', endDate: '2025-01-05', homeTz: 'UTC' });
  const t3 = tripFromDraft({ name: 'Soon', startDate: '2026-10-30', endDate: '2026-10-31', homeTz: 'UTC' });
  trips = upsertTrip(upsertTrip(trips, t2), t3);
  assert.deepEqual(orderTrips(trips, '2026-10-24').map((t) => t.name), ['Soon', trip.name, 'Past']);
  assert.equal(removeTrip(trips, t2.id).length, 2);
});

test('format helpers', () => {
  assert.equal(zoneCity('Asia/Ho_Chi_Minh'), 'Ho Chi Minh');
  assert.equal(zoneCity('UTC'), 'UTC');
  assert.equal(formatDay('2026-11-03'), 'Tue, Nov 3');
  assert.equal(formatRange('2026-11-03', '2026-11-11'), 'Nov 3 – Nov 11');
  assert.equal(formatDuration(445), '7h 25m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(1500), '1d 1h');
  assert.equal(todayIn('Asia/Tokyo', Date.parse('2026-10-24T20:00:00Z')), '2026-10-25');
});

test('the place phone round-trips through the form and is dropped when blank', () => {
  const d = { ...newItemDraft('hotel', '2026-11-04', 'Asia/Tokyo'), title: 'Ryokan', placeName: 'Ryokan', placePhone: ' +81 75 000 0000 ' };
  const it = itemFromDraft(d, 't1');
  assert.equal(it.place?.phone, '+81 75 000 0000');
  assert.equal(draftFromItem(it).placePhone, '+81 75 000 0000');
  const cleared = itemFromDraft({ ...draftFromItem(it), placePhone: '' }, 't1', it);
  assert.equal(cleared.place?.phone, undefined);
  // A phone on its own is enough to keep a place.
  const only = itemFromDraft({ ...newItemDraft('activity', '2026-11-04', 'Asia/Tokyo'), title: 'Tea', placePhone: '075' }, 't1');
  assert.equal(only.place?.phone, '075');
  assert.equal(only.place?.name, 'Tea');
  // Kinds without a place keep no phone.
  assert.equal(itemFromDraft({ ...newItemDraft('note', '2026-11-04', 'UTC'), title: 'n', placePhone: '1' }, 't1').place, undefined);
});

test('recovered trips are added back without overwriting trips on the phone', () => {
  const a = { ...trip, id: 'a', name: 'Now' };
  const old = { ...trip, id: 'a', name: 'Old copy' };
  const b = { ...trip, id: 'b', name: 'Lost' };
  const cur = [a];
  assert.equal(mergeRecovered(cur, []), cur);
  assert.equal(mergeRecovered(cur, [old]), cur);
  assert.deepEqual(
    mergeRecovered(cur, [old, b]).map((t) => t.name),
    ['Now', 'Lost'],
  );
});

test('T54: editing a trip keeps its budget, rates and expenses', () => {
  const withSpending = { ...trip, budget: { currency: 'AUD', amount: 1000 }, rates: { JPY: 0.01 }, expenses: [{ id: 'e', amount: 5, currency: 'JPY', category: 'food' as const, day: trip.startDate }] };
  const back = tripFromDraft({ name: 'Renamed', startDate: trip.startDate, endDate: trip.endDate, homeTz: trip.homeTz }, withSpending);
  assert.deepEqual(back.budget, withSpending.budget);
  assert.deepEqual(back.rates, withSpending.rates);
  assert.deepEqual(back.expenses, withSpending.expenses);
});
