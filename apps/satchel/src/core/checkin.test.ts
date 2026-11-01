import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  briefCheckin,
  checkinCheck,
  itemStatus,
  pickupOutsideDesk,
  readCheckin,
  reminderIcs,
  setDone,
  splitMinutes,
  tripStatus,
  windowState,
  windowsFor,
  withCheckin,
  type CheckinWindow,
} from './checkin.ts';
import type { Item, Trip } from './model.ts';
import { readiness, toFix } from './readiness.ts';
import { checkinDue } from './todos.ts';
import { fromUtc, toUtc } from './tz.ts';

const MIN = 60_000;
const item = (over: Partial<Item>): Item => ({
  id: 'i1',
  tripId: 't1',
  kind: 'flight',
  title: 'Sydney to Tokyo',
  start: { local: '2027-04-01T21:00', tz: 'Australia/Sydney' },
  end: { local: '2027-04-02T05:30', tz: 'Asia/Tokyo' },
  attachments: [],
  ...over,
});
const win = (i: Item, kind: CheckinWindow['kind']) => {
  const w = windowsFor(i).find((x) => x.kind === kind);
  assert.ok(w, `${kind} window`);
  return w;
};

test('flight: online check-in opens 24 h before and closes 60 min before an international departure (usual)', () => {
  const f = item({});
  const w = win(f, 'online');
  assert.equal(w.tz, 'Australia/Sydney');
  assert.equal(w.opens?.local, '2027-03-31T21:00');
  assert.equal(w.closes?.local, '2027-04-01T20:00');
  assert.equal(w.scope, 'international');
  assert.equal(w.usual, true);
  const b = win(f, 'bagDrop');
  assert.equal(b.closes?.local, '2027-04-01T20:00');
  assert.equal(b.opens, null);
  assert.equal(b.usual, true);
});

test('flight: custom offsets (48 h / 90 min / bag drop 75 min) are used and not labelled usual', () => {
  const f = item({ checkin: { opensH: 48, closesMin: 90, bagDropMin: 75 } });
  const w = win(f, 'online');
  assert.equal(w.opens?.local, '2027-03-30T21:00');
  assert.equal(w.closes?.local, '2027-04-01T19:30');
  assert.equal(w.usual, false);
  assert.equal(win(f, 'bagDrop').closes?.local, '2027-04-01T19:45');
  // An odd custom value (31 h) is fine too.
  assert.equal(win(item({ checkin: { opensH: 31 } }), 'online').opens?.local, '2027-03-31T14:00');
});

test('flight: domestic vs international by the zones\' countries, and the airport fields\' own choice wins', () => {
  const dom = item({ title: 'Sydney to Melbourne', end: { local: '2027-04-01T22:35', tz: 'Australia/Melbourne' } });
  assert.equal(win(dom, 'online').scope, 'domestic');
  assert.equal(win(dom, 'online').closes?.local, '2027-04-01T20:15');
  const us = item({ start: { local: '2027-06-01T08:00', tz: 'America/New_York' }, end: { local: '2027-06-01T11:00', tz: 'America/Los_Angeles' } });
  assert.equal(win(us, 'online').closes?.local, '2027-06-01T07:15');
  // Typed as domestic on the airport fields (e.g. a zone pair that guesses wrong).
  const own = item({ airport: { scope: 'domestic' } });
  assert.equal(win(own, 'online').closes?.local, '2027-04-01T20:15');
  // No arrival zone at all: international (the safer, earlier closing).
  assert.equal(win(item({ end: undefined }), 'online').scope, 'international');
});

test('flight: a typed bag-drop time is used, on the evening before a just-after-midnight departure', () => {
  const f = item({ start: { local: '2027-04-02T00:20', tz: 'Australia/Sydney' }, airport: { bagDrop: '23:40' } });
  const b = win(f, 'bagDrop');
  assert.equal(b.closes?.local, '2027-04-01T23:40');
  assert.equal(b.usual, false);
  // Online check-in closing crosses midnight backwards too.
  assert.equal(win(f, 'online').closes?.local, '2027-04-01T23:20');
});

test('stay: booked times are used; date-only stamps fall back to 15:00 / 10:00 marked usual', () => {
  const booked = item({ kind: 'hotel', title: 'Hotel', start: { local: '2027-04-02T14:00', tz: 'Asia/Tokyo' }, end: { local: '2027-04-05T11:00', tz: 'Asia/Tokyo' } });
  const ci = win(booked, 'stayIn');
  const co = win(booked, 'stayOut');
  assert.equal(ci.opens?.local, '2027-04-02T14:00');
  assert.equal(ci.closes, null);
  assert.equal(ci.usual, false);
  assert.equal(co.closes?.local, '2027-04-05T11:00');
  assert.equal(co.opens?.local, '2027-04-05T00:00');
  assert.equal(co.usual, false);
  const plain = item({ kind: 'hotel', title: 'Hotel', start: { local: '2027-04-02', tz: 'Asia/Tokyo' }, end: { local: '2027-04-05', tz: 'Asia/Tokyo' } });
  assert.equal(win(plain, 'stayIn').opens?.local, '2027-04-02T15:00');
  assert.equal(win(plain, 'stayIn').usual, true);
  assert.equal(win(plain, 'stayOut').closes?.local, '2027-04-05T10:00');
  assert.equal(win(plain, 'stayOut').usual, true);
});

test('missing times and kinds: no windows rather than a guess', () => {
  // Train / ferry without a booking: nothing; with a booking code: closes 15 / 30 min before, no opening unless set.
  const train = item({ kind: 'train', title: 'Train', start: { local: '2027-04-03T09:00', tz: 'Asia/Tokyo' }, end: { local: '2027-04-03T11:15', tz: 'Asia/Tokyo' } });
  assert.deepEqual(windowsFor(train), []);
  const booked = { ...train, ref: 'X1' };
  const tw = win(booked, 'online');
  assert.equal(tw.opens, null);
  assert.equal(tw.closes?.local, '2027-04-03T08:45');
  assert.equal(windowsFor(booked).length, 1);
  assert.equal(win({ ...booked, checkin: { opensH: 24 } }, 'online').opens?.local, '2027-04-02T09:00');
  const ferry = item({ kind: 'ferry', title: 'Ferry', start: { local: '2027-04-03T09:00', tz: 'Europe/Athens' }, attachments: [{ id: 'a', uri: 'x', name: 't.pdf', mime: 'application/pdf', role: 'ticket' }] });
  assert.equal(win(ferry, 'online').closes?.local, '2027-04-03T08:30');
  // A flight saved without a clock, a zone this phone can't read, a stay with no check-out, a car with no desk hours.
  assert.deepEqual(windowsFor(item({ start: { local: '2027-04-01', tz: 'Australia/Sydney' } })), []);
  assert.deepEqual(windowsFor(item({ start: { local: '2027-04-01T21:00', tz: 'Mars/Olympus' } })), []);
  const open = item({ kind: 'hotel', start: { local: '2027-04-02T15:00', tz: 'Asia/Tokyo' }, end: undefined });
  assert.deepEqual(windowsFor(open).map((w) => w.kind), ['stayIn']);
  assert.deepEqual(windowsFor(item({ kind: 'car', start: { local: '2027-04-02T09:00', tz: 'Asia/Tokyo' } })), []);
  assert.deepEqual(windowsFor(item({ kind: 'activity' })), []);
  assert.deepEqual(windowsFor(item({ kind: 'note' })), []);
});

test('hire car: desk hours on the pick-up day, a closing time after midnight runs into the next day', () => {
  const car = item({ kind: 'car', title: 'Car', start: { local: '2027-04-02T23:30', tz: 'Europe/Lisbon' }, checkin: { deskFrom: '22:00', deskTo: '02:00' } });
  const d = win(car, 'desk');
  assert.equal(d.opens?.local, '2027-04-02T22:00');
  assert.equal(d.closes?.local, '2027-04-03T02:00');
  assert.equal(pickupOutsideDesk(car), false);
  const late = { ...car, checkin: { deskFrom: '08:00', deskTo: '18:00' } };
  assert.equal(pickupOutsideDesk(late), true);
});

test('overdue, open, later, done and past states', () => {
  const f = item({});
  const w = win(f, 'online');
  const opens = w.opens!.utc;
  const closes = w.closes!.utc;
  const s1 = windowState(w, opens - (3 * 60 + 20) * MIN, false);
  assert.equal(s1.state, 'later');
  assert.equal(s1.minutes, 200);
  assert.deepEqual(splitMinutes(s1.minutes!), { d: 0, h: 3, m: 20 });
  const s2 = windowState(w, closes - 90 * MIN, false);
  assert.equal(s2.state, 'open');
  assert.equal(s2.minutes, 90);
  assert.equal(windowState(w, closes + MIN, false).state, 'overdue');
  assert.equal(windowState(w, closes + MIN, true).state, 'done');
  assert.equal(windowState(w, toUtc(f.start) + MIN, false).state, 'past');
  // The tick doesn't cover a stay's check-out.
  const h = item({ kind: 'hotel', start: { local: '2027-04-02T15:00', tz: 'Asia/Tokyo' }, end: { local: '2027-04-05T10:00', tz: 'Asia/Tokyo' } });
  const co = win(h, 'stayOut');
  assert.equal(windowState(co, co.closes!.utc - 60 * MIN, true).state, 'open');
  assert.equal(windowState(co, co.closes!.utc + MIN, false).state, 'past');
  // Rounded up: 30 s to go still says 1 minute.
  assert.equal(windowState(w, closes - 30_000, false).minutes, 1);
});

test('DST change inside the window: 24 real hours, so the wall clock moves an hour', () => {
  // New York springs forward 8 Mar 2026: 24 h before 10:00 EDT is 09:00 EST the day before.
  const ny = item({ start: { local: '2026-03-08T10:00', tz: 'America/New_York' }, end: { local: '2026-03-08T13:00', tz: 'America/Los_Angeles' } });
  const w = win(ny, 'online');
  assert.equal(w.opens?.local, '2026-03-07T09:00');
  assert.equal((toUtc(ny.start) - w.opens!.utc) / 3_600_000, 24);
  // And falls back 1 Nov 2026: 24 h before 10:00 EST is 11:00 EDT.
  const fall = { ...ny, start: { local: '2026-11-01T10:00', tz: 'America/New_York' }, end: { local: '2026-11-01T13:00', tz: 'America/Los_Angeles' } };
  assert.equal(win(fall, 'online').opens?.local, '2026-10-31T11:00');
  // London 29 Mar 2026 (BST starts 01:00): 48 h before 08:00 BST is 07:00 GMT on the 27th.
  const lon = item({ start: { local: '2026-03-29T08:00', tz: 'Europe/London' }, checkin: { opensH: 48 } });
  assert.equal(win(lon, 'online').opens?.local, '2026-03-27T07:00');
  // A desk opening in the skipped hour is flagged.
  const car = item({ kind: 'car', start: { local: '2026-03-29T09:00', tz: 'Europe/London' }, checkin: { deskFrom: '01:30', deskTo: '20:00' } });
  assert.equal(win(car, 'desk').skipped, true);
  // A stay's check-out day starting in a skipped midnight (Santiago, 6 Sep 2026) still opens.
  const st = item({ kind: 'hotel', start: { local: '2026-09-04T15:00', tz: 'America/Santiago' }, end: { local: '2026-09-06T11:00', tz: 'America/Santiago' } });
  const co = win(st, 'stayOut');
  assert.ok(co.opens && co.opens.utc < co.closes!.utc);
});

test('date line: every time is on the departure clock (Apia), not the arrival one (Pago Pago)', () => {
  const f = item({ title: 'Apia to Pago Pago', start: { local: '2027-01-02T01:00', tz: 'Pacific/Apia' }, end: { local: '2027-01-01T02:00', tz: 'Pacific/Pago_Pago' } });
  const w = win(f, 'online');
  assert.equal(w.tz, 'Pacific/Apia');
  assert.equal(w.opens?.local, '2027-01-01T01:00');
  assert.equal(w.closes?.local, '2027-01-02T00:00');
  // The same opening instant is a day earlier on the other side of the line.
  assert.equal(fromUtc(w.opens!.utc, 'Pacific/Pago_Pago').slice(0, 10), '2026-12-31');
  assert.equal(w.scope, 'international');
  // Kiritimati (UTC+14) stay: usual times on its own clock.
  const k = item({ kind: 'hotel', start: { local: '2027-01-01', tz: 'Pacific/Kiritimati' }, end: { local: '2027-01-03', tz: 'Pacific/Kiritimati' } });
  assert.equal(win(k, 'stayIn').opens?.local, '2027-01-01T15:00');
});

test('readCheckin drops bad values and unknown keys; withCheckin / setDone', () => {
  assert.equal(readCheckin(null), undefined);
  assert.equal(readCheckin([1]), undefined);
  assert.equal(readCheckin({ opensH: 0, closesMin: -5, bagDropMin: 'x', deskFrom: '25:00', deskTo: '10:00', doneAt: 'never', other: 1 }), undefined);
  assert.deepEqual(readCheckin({ opensH: 36, closesMin: 0, deskFrom: '08:00', deskTo: '17:00', later: true }), { opensH: 36, closesMin: 0, deskFrom: '08:00', deskTo: '17:00' });
  // Desk hours come as a pair.
  assert.equal(readCheckin({ deskFrom: '08:00' }), undefined);
  assert.equal(readCheckin({ opensH: 1.5 }), undefined);
  const f = item({});
  const ticked = setDone(f, true, Date.UTC(2027, 2, 31, 12));
  assert.equal(ticked.checkin?.doneAt, '2027-03-31T12:00:00.000Z');
  const unticked = setDone(ticked, false, 0);
  assert.equal('checkin' in unticked, false);
  assert.deepEqual(withCheckin(f, { opensH: 30 }).checkin, { opensH: 30 });
  assert.equal('checkin' in withCheckin(withCheckin(f, { opensH: 30 }), {}), false);
});

test('trip status, Your day pick and the readiness row', () => {
  const f = item({ number: 'EA 25' });
  const h = item({ id: 'h1', kind: 'hotel', title: 'Hotel', start: { local: '2027-04-02T15:00', tz: 'Asia/Tokyo' }, end: { local: '2027-04-05T10:00', tz: 'Asia/Tokyo' } });
  const trip = { items: [h, f] };
  const opens = win(f, 'online').opens!.utc;
  // 5 h before opening: Your day says it opens; readiness passes.
  const before = opens - 5 * 60 * MIN;
  assert.equal(briefCheckin(trip, before)?.status.state, 'later');
  assert.equal(briefCheckin(trip, before)?.item.id, 'i1');
  assert.equal(briefCheckin(trip, opens - 30 * 60 * MIN), null);
  assert.equal(checkinCheck(trip, before)?.status, 'pass');
  // Open and not ticked: warn, fix opens the flight.
  const open = opens + 60 * MIN;
  const c = checkinCheck(trip, open);
  assert.equal(c?.status, 'warn');
  assert.equal(c?.reason, 'open');
  assert.deepEqual(c?.fix, { kind: 'checkin', itemId: 'i1' });
  assert.equal(briefCheckin(trip, open)?.status.state, 'open');
  // Ticked: pass, and Your day stays quiet.
  const done = { items: [h, setDone(f, true, open)] };
  assert.equal(checkinCheck(done, open)?.status, 'pass');
  assert.equal(checkinCheck(done, open)?.done, 1);
  assert.equal(briefCheckin(done, open), null);
  // Closed, flight not yet gone: overdue first in the list.
  const late = win(f, 'online').closes!.utc + MIN;
  assert.equal(checkinCheck(trip, late)?.reason, 'overdue');
  assert.equal(tripStatus(trip, late)[0].state, 'overdue');
  // No journeys: no row.
  assert.equal(checkinCheck({ items: [h] }, open), null);
  // The stay's check-in drops out of the trip list once its check-out day has come.
  const coDay = toUtc({ local: '2027-04-05T08:00', tz: 'Asia/Tokyo' });
  assert.deepEqual(tripStatus({ items: [h] }, coDay).map((s) => s.window.kind), ['stayOut']);
  assert.deepEqual(itemStatus(h, coDay).map((s) => s.window.kind), ['stayIn', 'stayOut']);
});

test('calendar reminder: one event at the opening, with an alert; none once it has passed', () => {
  const f = item({});
  const w = win(f, 'online');
  const r = reminderIcs(w, { summary: 'Online check-in opens, Sydney; Tokyo', description: 'Usual time, check your booking' }, w.opens!.utc - 86_400_000);
  assert.ok(r);
  assert.equal(r.at, w.opens!.utc);
  assert.match(r.text, /DTSTART:20270331T100000Z\r\n/);
  assert.match(r.text, /BEGIN:VALARM\r\nACTION:DISPLAY/);
  assert.match(r.text, /SUMMARY:Online check-in opens\\, Sydney\\; Tokyo/);
  assert.match(r.text, /UID:checkin-online-i1@satchel\.trip/);
  assert.equal(reminderIcs(w, { summary: 's', description: 'd' }, w.opens!.utc + 1), null);
  // A closing-only window reminds 30 min before it closes.
  const b = win(f, 'bagDrop');
  assert.equal(reminderIcs(b, { summary: 's', description: 'd' }, 0)?.at, b.closes!.utc - 30 * MIN);
});

test('the to-do list uses the booking\'s own opening offset', () => {
  assert.equal(checkinDue(item({})).time, '21:00');
  const d = checkinDue(item({ checkin: { opensH: 36 } }));
  assert.equal(d.date, '2027-03-31');
  assert.equal(d.time, '09:00');
});

test('readiness: the check-in row is scored (warn while open and not ticked, pass once ticked)', () => {
  const f = item({});
  const open = win(f, 'online').opens!.utc + 60 * MIN;
  const trip: Trip = { id: 't1', name: 'Tokyo', startDate: '2027-04-01', endDate: '2027-04-06', homeTz: 'Australia/Sydney', items: [f], createdAt: '2027-01-01T00:00:00.000Z' };
  const base = { docs: [], packing: null, card: null, catalog: null, installed: [], now: open };
  const r = readiness({ ...base, trip, checkin: checkinCheck(trip, open) });
  const row = r.checks.find((c) => c.id === 'checkin');
  assert.equal(row?.status, 'warn');
  assert.ok(toFix(r).some((c) => c.id === 'checkin'));
  const ticked = { ...trip, items: [setDone(f, true, open)] };
  const r2 = readiness({ ...base, trip: ticked, checkin: checkinCheck(ticked, open) });
  assert.equal(r2.checks.find((c) => c.id === 'checkin')?.status, 'pass');
  assert.equal(r2.passed, r.passed + 1);
  assert.equal(r2.scored, r.scored);
});
