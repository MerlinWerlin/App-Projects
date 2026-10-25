// docs/spec/EDGE_CASES.md as tests: 'Trips and timeline' and 'App state and editing' (T26).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import { extraDays, groupByDay, nextUp, overlaps, span, tripPhase } from './timeline.ts';
import {
  draftChanged,
  draftFromItem,
  itemFromDraft,
  newItemDraft,
  orderTrips,
  parseStoredTrips,
  removeItem,
  tripFromDraft,
  upsertItem,
  upsertTrip,
  validateItem,
} from './trips.ts';
import { checkWallTime, dayShift, minutesBetween, toUtc } from './tz.ts';

const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
const byId = (id: string) => trip.items.find((i) => i.id === id)!;
const item = (x: Partial<Item> & Pick<Item, 'id' | 'kind' | 'start'>): Item => ({ tripId: trip.id, title: x.id, attachments: [], ...x });

// ---- Trips and timeline ----

test('DST: a skipped wall time is flagged with the time Satchel will use; a repeated one is flagged too', () => {
  // Sydney springs forward 4 Oct 2026 02:00 -> 03:00 and falls back 5 Apr 2026 03:00 -> 02:00.
  assert.deepEqual(checkWallTime({ local: '2026-10-04T02:30', tz: 'Australia/Sydney' }), { kind: 'skipped', usedLocal: '2026-10-04T03:30' });
  assert.deepEqual(checkWallTime({ local: '2026-04-05T02:30', tz: 'Australia/Sydney' }), { kind: 'repeated' });
  assert.deepEqual(checkWallTime({ local: '2026-04-05T03:30', tz: 'Australia/Sydney' }), { kind: 'normal' });
  // New York: 8 Mar 2026 02:30 does not exist; 1 Nov 2026 01:30 happens twice.
  assert.equal(checkWallTime({ local: '2026-03-08T02:30', tz: 'America/New_York' }).kind, 'skipped');
  assert.equal(checkWallTime({ local: '2026-11-01T01:30', tz: 'America/New_York' }).kind, 'repeated');
  // Zones without daylight saving never flag.
  assert.equal(checkWallTime({ local: '2026-10-04T02:30', tz: 'Asia/Tokyo' }).kind, 'normal');
});

test('DST: each item keeps its own zone and shows its own local time', () => {
  const f = byId('demo-f1');
  const back = itemFromDraft(draftFromItem(f), trip.id, f);
  assert.deepEqual(back.start, { local: f.start.local, tz: 'Australia/Sydney' });
  assert.deepEqual(back.end, { local: f.end!.local, tz: 'Asia/Tokyo' });
});

test('an overnight journey shows on its arrival day too, without changing its stored time or zone', () => {
  // Return flight: Osaka 21:30 on day 7 -> Sydney 08:50 on day 8.
  const f2 = byId('demo-f2');
  assert.deepEqual(extraDays(f2), ['2026-11-11']);
  const days = groupByDay(trip);
  const d8 = days.find((d) => d.date === '2026-11-11')!;
  assert.deepEqual(d8.continuing.map((i) => i.id), ['demo-f2']);
  assert.deepEqual(d8.items, []);
  assert.equal(days.find((d) => d.date === '2026-11-10')!.items.at(-1)!.id, 'demo-f2');
  assert.equal(f2.start.tz, 'Asia/Tokyo');
  assert.equal(f2.end!.tz, 'Australia/Sydney');
  // Duration uses absolute times: 21:30 JST -> 08:50 AEDT is 9h20m.
  assert.equal(minutesBetween(f2.start, f2.end!), 9 * 60 + 20);
});

test('crossing the date line backwards: arriving on the same or an earlier date is shown once; durations use absolute times', () => {
  const hnl = item({ id: 'x-hnl', kind: 'flight', start: { local: '2026-11-05T21:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-05T09:25', tz: 'Pacific/Honolulu' } });
  assert.deepEqual(extraDays(hnl), []);
  assert.equal(dayShift(hnl.start, hnl.end!), 0);
  assert.equal(minutesBetween(hnl.start, hnl.end!), 7 * 60 + 25);
  const akl = item({ id: 'x-akl', kind: 'flight', start: { local: '2026-11-05T22:00', tz: 'Pacific/Honolulu' }, end: { local: '2026-11-07T05:00', tz: 'Pacific/Auckland' } });
  assert.equal(dayShift(akl.start, akl.end!), 2);
  assert.deepEqual(extraDays(akl), ['2026-11-06', '2026-11-07']);
  assert.equal(minutesBetween(akl.start, akl.end!), 8 * 60);
});

test('hotel stays and notes do not repeat on every day; a hire car shows again on its return day only', () => {
  assert.deepEqual(extraDays(byId('demo-h1')), []);
  assert.deepEqual(extraDays(byId('demo-n1')), []);
  const car = item({ id: 'x-car', kind: 'car', start: { local: '2026-11-04T09:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-07T18:00', tz: 'Asia/Tokyo' } });
  assert.deepEqual(extraDays(car), ['2026-11-07']);
});

test('overlapping items are both kept and flagged; saving is not blocked', () => {
  const bus = item({ id: 'x-bus', kind: 'bus', start: { local: '2026-11-07T13:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-07T15:00', tz: 'Asia/Tokyo' } });
  const clash = { ...newItemDraft('bus', '2026-11-07', 'Asia/Tokyo'), title: 'Bus', startTime: '13:00', endDate: '2026-11-07', endTime: '15:00' };
  assert.deepEqual(validateItem(clash), [], 'validation never looks at other items');
  const trips = upsertItem([trip], { ...bus });
  assert.equal(trips[0].items.length, trip.items.length + 1);
  assert.equal(overlaps(trips[0].items).length, 1);
});

test('missing end time: start only, no invented end, left out of overlaps and never "now"', () => {
  const act = item({ id: 'x-act', kind: 'activity', start: { local: '2026-11-04T12:30', tz: 'Asia/Tokyo' } });
  const lunch = item({ id: 'x-lunch', kind: 'activity', start: { local: '2026-11-04T12:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-04T13:00', tz: 'Asia/Tokyo' } });
  assert.equal(span(act).end, span(act).start);
  assert.deepEqual(overlaps([act, lunch]), []);
  assert.deepEqual(extraDays(act), []);
  const draft = draftFromItem(act);
  assert.equal(draft.endDate, '');
  assert.equal(itemFromDraft(draft, trip.id, act).end, undefined, 'saving again does not invent an end');
  const at = toUtc(act.start);
  assert.equal(nextUp([act], at - 60_000)?.state, 'next');
  assert.equal(nextUp([act], at + 60_000), null);
});

test('empty trip: every day is listed and empty, ready for a first item', () => {
  const empty = tripFromDraft({ name: 'Blank', startDate: '2026-12-01', endDate: '2026-12-03', homeTz: 'UTC' });
  const days = groupByDay(empty);
  assert.deepEqual(days.map((d) => d.date), ['2026-12-01', '2026-12-02', '2026-12-03']);
  assert.ok(days.every((d) => d.items.length === 0 && d.continuing.length === 0));
  assert.equal(nextUp(empty.items, Date.parse('2026-11-01T00:00:00Z')), null);
});

test('past trip: kept in the list and timeline, not presented as upcoming', () => {
  const past: Trip = { ...demoTrip('2025-03-01', '2025-02-01T00:00:00Z'), id: 'old', name: 'Last year' };
  const today = '2026-10-24';
  const list = orderTrips([past, trip], today);
  assert.deepEqual(list.map((t) => t.id), ['demo', 'old']);
  assert.equal(tripPhase(past, today), 'past');
  assert.equal(groupByDay(past).length, 9);
  assert.equal(nextUp(past.items, Date.parse('2026-10-24T00:00:00Z')), null);
  assert.equal(nextUp([...past.items, ...trip.items], Date.parse('2026-10-24T00:00:00Z'))?.item.id, 'demo-f1');
});

test('very long names are kept in full (only trimmed)', () => {
  const long = `  ${'Grand tour of the northern prefectures with friends and family '.repeat(8)}  `;
  const t = tripFromDraft({ name: long, startDate: '2026-12-01', endDate: '2026-12-03', homeTz: 'UTC' });
  assert.equal(t.name, long.trim());
  const it = itemFromDraft({ ...newItemDraft('note', '2026-12-01', 'UTC'), title: long }, t.id);
  assert.equal(it.title, long.trim());
});

test('right-to-left titles are stored untouched and times stay plain digits', () => {
  const title = 'رحلة إلى طوكيو';
  const it = itemFromDraft({ ...newItemDraft('activity', '2026-12-01', 'Asia/Dubai'), title, startTime: '09:05' }, 'x');
  assert.equal(it.title, title);
  assert.equal(it.start.local, '2026-12-01T09:05');
});

// ---- App state and editing ----

test('killed mid-edit: editing a draft never touches the saved trip; the last committed version stays', () => {
  const saved = upsertTrip([], trip);
  const snapshot = JSON.stringify(saved);
  const draft = draftFromItem(byId('demo-f1'));
  draft.title = 'Half-typed';
  draft.startTime = '1';
  assert.equal(JSON.stringify(saved), snapshot);
  assert.deepEqual(parseStoredTrips(snapshot), saved, 'reopening restores exactly what was committed');
});

test('list operations are pure, so a failed write cannot leave a half-applied list in memory', () => {
  const saved = upsertTrip([], trip);
  const snapshot = JSON.stringify(saved);
  const it = itemFromDraft({ ...newItemDraft('note', '2026-11-04', 'Asia/Tokyo'), title: 'New' }, trip.id);
  upsertItem(saved, it);
  removeItem(saved, trip.id, 'demo-f1');
  upsertTrip(saved, { ...trip, name: 'Renamed' });
  assert.equal(JSON.stringify(saved), snapshot);
});

test('saved data that was cut short or damaged is reported unreadable (null), never read as "no trips"', () => {
  const full = JSON.stringify([trip]);
  assert.equal(parseStoredTrips(full.slice(0, full.length / 2)), null);
  assert.equal(parseStoredTrips('{"not":"a list"}'), null);
  assert.deepEqual(parseStoredTrips(null), []);
  assert.deepEqual(parseStoredTrips(''), []);
  assert.deepEqual(parseStoredTrips('[]'), []);
});

test('one damaged trip or item is dropped without losing the rest', () => {
  const badItem = { id: 'bad', kind: 'flight', title: 'No start' };
  const odd = { ...trip.items[0], id: 'odd', kind: 'spaceship' };
  const raw = JSON.stringify([{ ...trip, items: [...trip.items, badItem, odd] }, { id: 'x', name: 'No dates' }, 42, null]);
  const out = parseStoredTrips(raw)!;
  assert.equal(out.length, 1);
  assert.equal(out[0].items.length, trip.items.length);
  const noAttachments = JSON.stringify([{ ...trip, items: [{ ...trip.items[0], attachments: undefined }] }]);
  assert.deepEqual(parseStoredTrips(noAttachments)![0].items[0].attachments, []);
});

test('discard check: a form is "changed" only when a field differs from where it started', () => {
  const start = draftFromItem(byId('demo-h1'));
  assert.equal(draftChanged(start, { ...start }), false);
  assert.equal(draftChanged(start, { ...start, notes: 'late arrival' }), true);
  assert.equal(draftChanged(start, { ...start, kind: 'activity' }), true);
  const t0 = { name: '', startDate: '2026-11-01', endDate: '2026-11-08', homeTz: 'UTC' };
  assert.equal(draftChanged(t0, { ...t0 }), false);
  assert.equal(draftChanged(t0, { ...t0, name: 'Japan' }), true);
});

test('editing keeps existing attachments; fields that do not fit the kind are dropped', () => {
  const f = { ...byId('demo-f1'), attachments: [{ id: 'a1', uri: 'file:///t.pdf', name: 't.pdf', mime: 'application/pdf', role: 'ticket' as const }] };
  const back = itemFromDraft({ ...draftFromItem(f), notes: 'Gate closes early' }, trip.id, f);
  assert.deepEqual(back.attachments, f.attachments);
  const asHotel = itemFromDraft({ ...draftFromItem(f), kind: 'hotel', endDate: '2026-11-04', endTime: '11:00' }, trip.id, f);
  assert.equal(asHotel.seat, undefined);
  assert.equal(asHotel.carrier, undefined);
  assert.equal(asHotel.number, undefined);
  assert.equal(asHotel.from, undefined);
  assert.equal(asHotel.ref, f.ref);
  const car = itemFromDraft({ ...newItemDraft('car', '2026-11-04', 'Asia/Tokyo'), title: 'Car', carrier: 'Demo Cars', endDate: '2026-11-05', endTime: '10:00' }, trip.id);
  assert.equal(car.carrier, 'Demo Cars');
  const note = itemFromDraft({ ...newItemDraft('note', '2026-11-04', 'Asia/Tokyo'), title: 'N', ref: 'X1' }, trip.id);
  assert.equal(note.ref, undefined);
});
