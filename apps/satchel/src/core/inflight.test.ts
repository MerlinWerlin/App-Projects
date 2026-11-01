import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityMap } from './citymaps.ts';
import {
  AFTER_MS,
  arcFlown,
  arcFor,
  arcPath,
  arcPoint,
  BEFORE_MS,
  elapsedFraction,
  flightTimes,
  inflightForItem,
  inflightForTrips,
  inflightView,
  jetlagTip,
  landingChecklist,
  landingStay,
  phaseAt,
  pickFlight,
} from './inflight.ts';
import type { Item, Trip } from './model.ts';
import { toUtc } from './tz.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;

let n = 0;
function flight(from: string, fromTz: string, to: string, toTz: string, dep: string, arr: string, extra: Partial<Item> = {}): Item {
  n += 1;
  return {
    id: extra.id ?? `f${n}`,
    tripId: 't',
    kind: 'flight',
    title: `${from} to ${to}`,
    start: { local: dep, tz: fromTz },
    end: { local: arr, tz: toTz },
    from: { id: `p${n}a`, name: from },
    to: { id: `p${n}b`, name: to },
    attachments: [],
    ...extra,
  };
}

function hotel(id: string, tz: string, from: string, to: string, place: Item['place'] = { id: 'h', name: 'Hotel Sora' }): Item {
  return { id, tripId: 't', kind: 'hotel', title: 'Hotel Sora', start: { local: from, tz }, end: { local: to, tz }, place, attachments: [] };
}

function trip(items: Item[], extra: Partial<Trip> = {}): Trip {
  return { id: 't', name: 'Japan', startDate: '2026-11-01', endDate: '2026-11-20', homeTz: 'Europe/London', items, createdAt: '2026-10-01T00:00:00Z', ...extra };
}

const base = { phoneZone: 'Europe/London' };
const LHR_HND = () => flight('London (LHR)', 'Europe/London', 'Tokyo (HND)', 'Asia/Tokyo', '2026-11-02T11:00', '2026-11-03T07:00');

// ------------------------------------------------------------------ times and windows

test('flightTimes reads each stamp in its own zone and skips non-flights, bad zones and backwards times', () => {
  const f = LHR_HND();
  const t = flightTimes(f);
  assert.ok(t);
  assert.equal(t.dep, Date.UTC(2026, 10, 2, 11, 0));
  assert.equal(t.arr, Date.UTC(2026, 10, 2, 22, 0));
  assert.equal(flightTimes({ ...f, kind: 'train' }), null);
  assert.equal(flightTimes({ ...f, end: undefined }), null);
  assert.equal(flightTimes({ ...f, end: { local: '2026-11-03T07:00', tz: 'Mars/Base' } }), null);
  assert.equal(flightTimes({ ...f, end: { local: '2026-11-02T10:00', tz: 'Europe/London' } }), null);
});

test('elapsedFraction clamps to 0..1', () => {
  assert.equal(elapsedFraction(0, 100, -50), 0);
  assert.equal(elapsedFraction(0, 100, 0), 0);
  assert.equal(elapsedFraction(0, 100, 25), 0.25);
  assert.equal(elapsedFraction(0, 100, 100), 1);
  assert.equal(elapsedFraction(0, 100, 1e9), 1);
  assert.equal(elapsedFraction(100, 100, 50), 0);
  assert.equal(elapsedFraction(100, 100, 150), 1);
});

test('phaseAt: 24 h before, in the air, 6 h after, nothing outside', () => {
  const dep = 10 * HOUR * 100;
  const arr = dep + 5 * HOUR;
  assert.equal(phaseAt(dep, arr, dep - BEFORE_MS - 1), null);
  assert.equal(phaseAt(dep, arr, dep - BEFORE_MS), 'before');
  assert.equal(phaseAt(dep, arr, dep - 1), 'before');
  assert.equal(phaseAt(dep, arr, dep), 'air');
  assert.equal(phaseAt(dep, arr, arr - 1), 'air');
  assert.equal(phaseAt(dep, arr, arr), 'landed');
  assert.equal(phaseAt(dep, arr, arr + AFTER_MS - 1), 'landed');
  assert.equal(phaseAt(dep, arr, arr + AFTER_MS), null);
});

test('in progress across zones: London to Tokyo, picked from booking zones only', () => {
  const f = LHR_HND();
  const tr = trip([f]);
  const now = Date.UTC(2026, 10, 2, 16, 30); // 5.5 h into 11 h
  const v = inflightView(tr, { ...base, phoneZone: 'America/New_York', now });
  assert.ok(v);
  assert.equal(v.phase, 'air');
  assert.equal(v.fraction, 0.5);
  assert.equal(v.minutesLeft, 330);
  assert.equal(v.durationMin, 660);
  assert.equal(v.fromCode, 'LHR');
  assert.equal(v.toCode, 'HND');
  assert.equal(v.landsLocal, '2026-11-03T07:00');
  assert.equal(v.landsDayShift, 1);
  // Set your watch to: Tokyo clock now, 9 h ahead of London in November.
  assert.deepEqual(v.watch, { time: '01:30', diffMinutes: 540 });
  assert.equal(v.home.tz, 'Europe/London');
  assert.equal(v.home.time, '16:30');
  assert.equal(v.destination.time, '01:30');
});

test('date-line crossing westbound: Tokyo to Honolulu lands the day before it left', () => {
  const f = flight('Tokyo (NRT)', 'Asia/Tokyo', 'Honolulu (HNL)', 'Pacific/Honolulu', '2026-11-03T08:00', '2026-11-02T20:00');
  const t = flightTimes(f);
  assert.ok(t);
  assert.equal(t.arr - t.dep, 7 * HOUR);
  const v = inflightView(trip([f], { homeTz: 'Asia/Tokyo' }), { ...base, now: t.dep + 2 * HOUR });
  assert.ok(v);
  assert.equal(v.phase, 'air');
  assert.equal(v.landsLocal, '2026-11-02T20:00');
  assert.equal(v.landsDayShift, -1);
  assert.equal(v.minutesLeft, 300);
  assert.equal(v.watch.diffMinutes, -19 * 60);
});

test('date-line crossing eastbound and overnight: Los Angeles to Sydney lands two dates later', () => {
  const f = flight('Los Angeles (LAX)', 'America/Los_Angeles', 'Sydney (SYD)', 'Australia/Sydney', '2026-11-02T22:00', '2026-11-04T07:30');
  const t = flightTimes(f);
  assert.ok(t);
  assert.equal(t.arr - t.dep, 14.5 * HOUR);
  const v = inflightView(trip([f], { homeTz: 'America/Los_Angeles' }), { ...base, now: t.dep + 14 * HOUR });
  assert.ok(v);
  assert.equal(v.landsDayShift, 2);
  assert.equal(v.minutesLeft, 30);
  assert.ok(Math.abs(v.fraction - 14 / 14.5) < 1e-9);
});

test('overnight flight is in the air across local midnight on both clocks', () => {
  const f = flight('London (LHR)', 'Europe/London', 'Singapore (SIN)', 'Asia/Singapore', '2026-11-02T21:00', '2026-11-03T17:00');
  const now = toUtc({ local: '2026-11-03T01:00', tz: 'Europe/London' });
  const p = pickFlight([f], now);
  assert.equal(p?.phase, 'air');
  const v = inflightView(trip([f]), { ...base, now });
  assert.equal(v?.landsLocal, '2026-11-03T17:00');
  assert.equal(v?.minutesLeft, 8 * 60);
});

// ------------------------------------------------------------------ picking

test('pickFlight: in the air beats leaving soon; a connection on the ground shows its next leg', () => {
  const a = flight('London (LHR)', 'Europe/London', 'Dubai (DXB)', 'Asia/Dubai', '2026-11-02T09:00', '2026-11-02T19:00');
  const b = flight('Dubai (DXB)', 'Asia/Dubai', 'Tokyo (HND)', 'Asia/Tokyo', '2026-11-02T22:00', '2026-11-03T12:00');
  const inA = toUtc({ local: '2026-11-02T12:00', tz: 'Europe/London' });
  assert.equal(pickFlight([b, a], inA)?.item.id, a.id);
  assert.equal(pickFlight([b, a], inA)?.phase, 'air');
  const onGround = toUtc({ local: '2026-11-02T20:00', tz: 'Asia/Dubai' });
  const p = pickFlight([a, b], onGround);
  assert.equal(p?.item.id, b.id);
  assert.equal(p?.phase, 'before');
  const afterB = toUtc({ local: '2026-11-03T13:00', tz: 'Asia/Tokyo' });
  assert.equal(pickFlight([a, b], afterB)?.item.id, b.id);
  assert.equal(pickFlight([a, b], afterB)?.phase, 'landed');
});

test('inflightForTrips prefers a flight in the air in any trip', () => {
  const air = LHR_HND();
  const soon = flight('Paris (CDG)', 'Europe/Paris', 'Rome (FCO)', 'Europe/Rome', '2026-11-02T20:00', '2026-11-02T22:00');
  const t1 = trip([soon], { id: 'a', name: 'Italy' });
  const t2 = trip([air], { id: 'b', name: 'Japan' });
  const v = inflightForTrips([t1, t2], { ...base, now: Date.UTC(2026, 10, 2, 13, 0) });
  assert.equal(v?.tripId, 'b');
  assert.equal(v?.phase, 'air');
  assert.equal(inflightForTrips([t1, t2], { ...base, now: Date.UTC(2026, 9, 1) }), null);
  assert.equal(inflightForItem([t1, t2], soon.id, { ...base, now: Date.UTC(2026, 10, 2, 13, 0) })?.phase, 'before');
  assert.equal(inflightForItem([t1, t2], 'nope', { ...base, now: Date.UTC(2026, 10, 2, 13, 0) }), null);
});

// ------------------------------------------------------------------ before and after

test('before departure: countdown within 24 h, leave-by from Airport day when a travel time is set', () => {
  const f = LHR_HND();
  f.airport = { travelMin: 60, bufferMin: 180 };
  const dep = Date.UTC(2026, 10, 2, 11, 0);
  const v = inflightView(trip([f]), { ...base, now: dep - 5 * HOUR });
  assert.ok(v?.before);
  assert.equal(v.phase, 'before');
  assert.equal(v.before.minutes, 300);
  assert.equal(v.before.leaveBy?.local, '2026-11-02T07:00');
  assert.equal(v.before.leavePassed, false);
  assert.equal(v.before.next?.step, 'leave');
  assert.equal(v.fraction, 0);
  const late = inflightView(trip([f]), { ...base, now: dep - 2 * HOUR });
  assert.equal(late?.before?.leavePassed, true);
  assert.equal(late?.before?.next?.step, 'departure');
  // No travel time anywhere: no leave-by, still a countdown.
  const plain = inflightView(trip([LHR_HND()]), { ...base, now: dep - HOUR });
  assert.equal(plain?.before?.leaveBy, null);
  assert.equal(plain?.before?.minutes, 60);
  assert.equal(inflightView(trip([f]), { ...base, now: dep - BEFORE_MS - MIN }), null);
});

test('after landing: 6 h window, handing over to the arrival card when abroad', () => {
  const f = LHR_HND();
  const arr = Date.UTC(2026, 10, 2, 22, 0);
  const v = inflightView(trip([f]), { ...base, now: arr + 90 * MIN });
  assert.equal(v?.phase, 'landed');
  assert.equal(v?.minutesSince, 90);
  assert.equal(v?.minutesLeft, 0);
  assert.equal(v?.fraction, 1);
  assert.equal(v?.handover, true);
  assert.equal(inflightView(trip([f]), { ...base, now: arr + AFTER_MS }), null);
  // A domestic flight has no arrival card to hand over to.
  const dom = flight('London (LHR)', 'Europe/London', 'Edinburgh (EDI)', 'Europe/London', '2026-11-02T08:00', '2026-11-02T09:20');
  const d = inflightView(trip([dom]), { ...base, now: Date.UTC(2026, 10, 2, 10, 0) });
  assert.equal(d?.phase, 'landed');
  assert.equal(d?.handover, false);
});

// ------------------------------------------------------------------ checklist

const tokyoMap: CityMap = { id: 'tokyo', name: 'Tokyo', country: 'JP', bbox: [139.5, 35.5, 140.0, 35.9], center: [139.7, 35.7], minzoom: 10, maxzoom: 16, file: 'tokyo.tar', bytes: 1 };

test('checklist with nothing but the flight: the arrival card and the to-do list roaming suggestion', () => {
  const f = LHR_HND();
  const tr = trip([f]);
  const t = flightTimes(f)!;
  assert.deepEqual(landingChecklist(tr, f, t.arr, t.dep, {}).map((c) => c.kind), ['arrival', 'roaming']);
  // Home country set to Japan in Settings: no arrival card.
  assert.deepEqual(landingChecklist(tr, f, t.arr, t.dep, { homeIso2: 'JP' }), []);
});

test('checklist built from what the trip has: stay, address, cash, map + toilets, roaming', () => {
  const f = LHR_HND();
  const h = hotel('h1', 'Asia/Tokyo', '2026-11-03T15:00', '2026-11-08T11:00', { id: 'pl', name: 'Hotel Sora', address: '1-2-3 Shinjuku', lat: 35.69, lon: 139.7 });
  const tr = trip([f, h], { cash: { start: [{ currency: 'JPY', amount: 20000 }, { currency: 'GBP', amount: 0 }] } });
  const t = flightTimes(f)!;
  const list = landingChecklist(tr, f, t.arr, t.dep, { stayDetails: true, installed: [tokyoMap] });
  assert.deepEqual(
    list.map((c) => c.kind),
    ['arrival', 'stay', 'address', 'cash', 'map', 'toilets', 'roaming'],
  );
  assert.deepEqual(list.find((c) => c.kind === 'cash'), { kind: 'cash', rows: [{ currency: 'JPY', amount: 20000 }] });
  assert.deepEqual(list.find((c) => c.kind === 'address'), { kind: 'address', itemId: 'h1', name: 'Hotel Sora' });
  assert.deepEqual(list.find((c) => c.kind === 'map'), { kind: 'map', city: 'Tokyo' });
  // Without saved stay details, a map or cash, those rows are left out.
  const bare = landingChecklist(trip([f, { ...h, place: { id: 'pl', name: 'Hotel Sora' } }]), f, t.arr, t.dep, { stayDetails: false, installed: [] });
  assert.deepEqual(bare.map((c) => c.kind), ['arrival', 'roaming']);
});

test('roaming row follows the to-do: hidden suggestion leaves it out, ticked shows done, own eSIM to-do counts', () => {
  const f = LHR_HND();
  const t = flightTimes(f)!;
  const kinds = (tr: Trip) => landingChecklist(tr, f, t.arr, t.dep).filter((c) => c.kind === 'roaming');
  const hidden = trip([f], { todos: [{ id: 'x', title: '', suggestion: 'roaming', dismissed: true, createdAt: '' }] });
  assert.deepEqual(kinds(hidden), []);
  const ticked = trip([f], { todos: [{ id: 'x', title: '', suggestion: 'roaming', done: true, createdAt: '' }] });
  assert.deepEqual(kinds(ticked), [{ kind: 'roaming', done: true }]);
  const own = trip([f], { todos: [{ id: 'x', title: '', suggestion: 'roaming', dismissed: true, createdAt: '' }, { id: 'y', title: 'Buy an eSIM', createdAt: '' }] });
  assert.deepEqual(kinds(own), [{ kind: 'roaming', done: false }]);
  // Domestic flights get no roaming row.
  const dom = flight('London (LHR)', 'Europe/London', 'Edinburgh (EDI)', 'Europe/London', '2026-11-02T08:00', '2026-11-02T09:20');
  const dt = flightTimes(dom)!;
  assert.deepEqual(landingChecklist(trip([dom]), dom, dt.arr, dt.dep), []);
});

test('landingStay: the hotel running after landing, not one far ahead or already over', () => {
  const f = LHR_HND();
  const t = flightTimes(f)!;
  const before = hotel('old', 'Europe/London', '2026-10-30T15:00', '2026-11-02T08:00');
  const later = hotel('later', 'Asia/Tokyo', '2026-11-10T15:00', '2026-11-12T11:00');
  assert.equal(landingStay(trip([f, before, later]), t.arr), null);
  const next = hotel('next', 'Asia/Tokyo', '2026-11-03T15:00', '2026-11-05T11:00');
  assert.equal(landingStay(trip([f, before, later, next]), t.arr)?.id, 'next');
});

test('map matched by name when no position is saved', () => {
  const f = LHR_HND();
  const t = flightTimes(f)!;
  const list = landingChecklist(trip([f]), f, t.arr, t.dep, { installed: [tokyoMap] });
  assert.deepEqual(list.map((c) => c.kind), ['arrival', 'map', 'toilets', 'roaming']);
});

// ------------------------------------------------------------------ jet lag, ticket

test('jet lag tip from the existing plan; none for a small clock change', () => {
  const f = LHR_HND();
  const tip = jetlagTip(trip([f]), f, 'Europe/London');
  assert.ok(tip);
  assert.equal(tip.direction, 'east');
  assert.equal(tip.shift, 540);
  assert.ok(tip.seek || tip.avoid);
  const short = flight('London (LHR)', 'Europe/London', 'Rome (FCO)', 'Europe/Rome', '2026-11-02T08:00', '2026-11-02T11:30');
  assert.equal(jetlagTip(trip([short]), short, 'Europe/London'), null);
});

test('ticket shortcut only when there is a ticket file, ref or seat', () => {
  const now = Date.UTC(2026, 10, 2, 13, 0);
  assert.equal(inflightView(trip([LHR_HND()]), { ...base, now })?.ticket, null);
  const withRef = LHR_HND();
  withRef.ref = 'ABC123';
  assert.deepEqual(inflightView(trip([withRef]), { ...base, now })?.ticket, { itemId: withRef.id, attachmentId: null });
  const withFile = LHR_HND();
  withFile.attachments = [{ id: 'a1', uri: 'file://x.pdf', name: 'x.pdf', mime: 'application/pdf', role: 'ticket' }];
  assert.deepEqual(inflightView(trip([withFile]), { ...base, now })?.ticket, { itemId: withFile.id, attachmentId: 'a1' });
  const carrier = LHR_HND();
  carrier.carrier = 'Sample Air';
  carrier.number = 'SA 7';
  assert.equal(inflightView(trip([carrier]), { ...base, now })?.flight, 'Sample Air SA 7');
});

// ------------------------------------------------------------------ arc

test('arc: endpoints, level at the apex, flown part ends at the plane', () => {
  const arc = arcFor(300, 120, 20);
  assert.deepEqual(arcPoint(arc, 0), { x: 20, y: 100, angle: arcPoint(arc, 0).angle });
  assert.ok(arcPoint(arc, 0).angle < 0);
  const mid = arcPoint(arc, 0.5);
  assert.equal(mid.x, 150);
  assert.equal(mid.y, 20);
  assert.equal(mid.angle, 0);
  const end = arcPoint(arc, 1);
  assert.equal(end.x, 280);
  assert.equal(end.y, 100);
  assert.ok(end.angle > 0);
  assert.deepEqual(arcPoint(arc, -3), arcPoint(arc, 0));
  assert.deepEqual(arcPoint(arc, 7), arcPoint(arc, 1));
  assert.deepEqual(arcPoint(arc, Number.NaN), arcPoint(arc, 0));
  const flown = arcFlown(arc, 0.3);
  const p = arcPoint(arc, 0.3);
  assert.equal(flown.p2.x, p.x);
  assert.equal(flown.p2.y, p.y);
  // The flown part's own midpoint lies on the full arc (at 0.15).
  const q = arcPoint(flown, 0.5);
  const r = arcPoint(arc, 0.15);
  assert.ok(Math.abs(q.x - r.x) < 1e-9 && Math.abs(q.y - r.y) < 1e-9);
  assert.equal(arcPath(arc), 'M 20 100 Q 150 -60 280 100');
});
