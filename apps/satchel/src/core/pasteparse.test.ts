// T77 Paste a booking: parser tests. Every name, airline, hotel, company and reference below is invented; airport
// codes are real (public) and flight numbers only follow the usual two-character + digits format.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { airportByCode, zoneFromCity } from './airports.ts';
import {
  alreadyInTrip,
  codesIn,
  draftForForm,
  findDates,
  findRef,
  findTimes,
  flightNumbers,
  foundFields,
  lineParts,
  needsCheck,
  parseBookings,
  suggestTrip,
  type PasteBooking,
  type PasteOptions,
} from './pasteparse.ts';
import type { Item } from './model.ts';
import { validateItem } from './trips.ts';

const NOW = '2026-10-31';
const opts: PasteOptions = { now: NOW, fallbackTz: 'Australia/Sydney' };
const one = (text: string, o: Partial<PasteOptions> = {}): PasteBooking => {
  const r = parseBookings(text, { ...opts, ...o });
  assert.equal(r.length, 1, `expected one booking, got ${r.length}`);
  return r[0];
};
const dates = (s: string, us = false) => findDates(s, { now: NOW, us }).map((d) => d.date);

// ---- fixtures ----

const MULTI_LEG_EMAIL = `Your trip is confirmed!
Booking reference: K7Q2ZP
Passenger: Alex Example

Flight 1: QF 25 · Coral Wing Airways
Sydney (SYD) → Tokyo Haneda (HND)
Departs: Fri 12 Mar 2027, 21:00  Terminal 1
Arrives: Sat 13 Mar 2027, 05:10
Seat: 32A

Flight 2: JL5
Tokyo Haneda (HND) → Osaka Kansai (KIX)
Departs: 15 Mar 2027 at 2:35 PM
Arrives: 15 Mar 2027 at 3.50pm
Seat 14C`;

const HOTEL_EMAIL = `Booking confirmation
Thank you, Sam. Your stay at Harbour Lantern Hotel is confirmed.

Harbour Lantern Hotel
1-2-3 Example Street, Shinjuku, Tokyo 160-0022
Tel: +81 3 1234 5678

Check-in: Mon 15 Mar 2027 (from 3:00 PM)
Check-out: Thu 18 Mar 2027 (until 11:00 AM)
3 nights, 1 room

Confirmation number: 88412093`;

const TRAIN = `Your train tickets
Train: Hikari 503
From: Tokyo Station  To: Kyoto Station
Date: 18/03/2027
Departs 12:03  Arrives 14:18
Car 7, Seat 12E
Booking ref: RX-55120`;

const CAR = `Car hire confirmation
Supplier: Meadow Lane Rentals
Pick-up: Kyoto Station Branch, 18 March 2027 15:00
Drop-off: Osaka Kansai Airport Desk, 21 March 2027 10:00
Reservation number: MLR-449201`;

const EVENT = `Your tickets
Event: Evening Lantern Concert
Venue: Riverside Hall
Address: 45 Example Lane, Kyoto
Date: Sat 20 Mar 2027
Doors open 18:30, show starts 19:00, ends 21:15
Order number: EV-30018
Seat: Row F, Seat 12`;

const SMS = 'Coral Wing: Your booking ABC123 is confirmed. NH 110 SYD-HND Mar 12 21:00. Seat 32A';

const FULL_ITINERARY = `Hi Jordan, here is your itinerary.
Booking reference: ZX81QM

Flight NH 110
Sydney (SYD) → Tokyo Haneda (HND)
Departs 2027-04-02 20:45, Terminal T1
Arrives 2027-04-03 05:00

Hotel: Quiet Pine Ryokan
Address: 12 Example-dori, Higashiyama Ward
Kyoto 605-0000
Check-in: 3 Apr 2027 16:00
Check-out: 6 Apr 2027 10:00
Confirmation number: QP-55821`;

// ---- whole pastes ----

test('multi-leg flight email gives one draft per leg, with zones from the airport codes', () => {
  const r = parseBookings(MULTI_LEG_EMAIL, opts);
  assert.equal(r.length, 2);
  const [a, b] = r;
  assert.equal(a.kind, 'flight');
  assert.equal(a.draft.number, 'QF 25');
  assert.equal(a.draft.fromName, 'Sydney (SYD)');
  assert.equal(a.draft.toName, 'Tokyo Haneda (HND)');
  assert.equal(a.draft.title, 'Sydney → Tokyo Haneda');
  assert.equal(a.draft.startDate, '2027-03-12');
  assert.equal(a.draft.startTime, '21:00');
  assert.equal(a.draft.startTz, 'Australia/Sydney');
  assert.equal(a.draft.endDate, '2027-03-13');
  assert.equal(a.draft.endTime, '05:10');
  assert.equal(a.draft.endTz, 'Asia/Tokyo');
  assert.equal(a.draft.seat, '32A');
  assert.equal(a.draft.ref, 'K7Q2ZP');
  assert.equal(a.airport?.terminal, '1');
  assert.equal(b.draft.number, 'JL 5');
  assert.equal(b.draft.startTime, '14:35');
  assert.equal(b.draft.endTime, '15:50');
  assert.equal(b.draft.seat, '14C');
  assert.equal(b.draft.ref, 'K7Q2ZP', 'the shared reference reaches every leg');
  assert.deepEqual(needsCheck(a), []);
});

test('every flight leg makes a valid booking form draft', () => {
  for (const b of parseBookings(MULTI_LEG_EMAIL, opts)) assert.deepEqual(validateItem(draftForForm(b, 'Flight')), []);
});

test('hotel email: name, address, phone, check-in/out and confirmation number', () => {
  const h = one(HOTEL_EMAIL);
  assert.equal(h.kind, 'hotel');
  assert.equal(h.draft.title, 'Harbour Lantern Hotel');
  assert.equal(h.draft.placeName, 'Harbour Lantern Hotel');
  assert.equal(h.draft.address, '1-2-3 Example Street, Shinjuku, Tokyo 160-0022');
  assert.equal(h.draft.placePhone, '+81 3 1234 5678');
  assert.equal(h.draft.startDate, '2027-03-15');
  assert.equal(h.draft.startTime, '15:00');
  assert.equal(h.draft.endDate, '2027-03-18');
  assert.equal(h.draft.endTime, '11:00');
  assert.equal(h.draft.startTz, 'Asia/Tokyo', 'zone from the city in the address');
  assert.equal(h.draft.ref, '88412093');
  assert.deepEqual(needsCheck(h), []);
  assert.deepEqual(validateItem(draftForForm(h, 'Hotel')), []);
});

test('hotel without printed times gets the usual times marked as a guess; nights give check-out', () => {
  const h = one('Rosewater Inn\n22 Example Road, Kyoto\nArrival 2027-05-01, 2 nights\nBooking number: RW-1001');
  assert.equal(h.kind, 'hotel');
  assert.equal(h.draft.startDate, '2027-05-01');
  assert.equal(h.draft.startTime, '15:00');
  assert.equal(h.draft.endDate, '2027-05-03');
  assert.equal(h.draft.endTime, '11:00');
  assert.equal(h.confidence.start, 'low');
  assert.equal(h.confidence.end, 'low');
  assert.ok(needsCheck(h).includes('start'));
});

test('hotel in a city the text does not name falls back to the given zone, marked to check', () => {
  const h = one('Hotel: Blue Gate Lodge\nCheck-in 10 Jun 2027 14:00\nCheck-out 12 Jun 2027 10:00', { fallbackTz: 'Europe/Paris' });
  assert.equal(h.draft.startTz, 'Europe/Paris');
  assert.equal(h.confidence.zone, 'low');
  assert.ok(needsCheck(h).includes('zone'));
});

test('train: name and number, stations, date, times, car and seat, reference', () => {
  const t = one(TRAIN);
  assert.equal(t.kind, 'train');
  assert.equal(t.draft.number, 'Hikari 503');
  assert.equal(t.draft.fromName, 'Tokyo Station');
  assert.equal(t.draft.toName, 'Kyoto Station');
  assert.equal(t.draft.title, 'Tokyo Station → Kyoto Station');
  assert.equal(t.draft.startDate, '2027-03-18');
  assert.equal(t.draft.startTime, '12:03');
  assert.equal(t.draft.endDate, '2027-03-18');
  assert.equal(t.draft.endTime, '14:18');
  assert.equal(t.draft.startTz, 'Asia/Tokyo');
  assert.equal(t.draft.seat, 'Car 7, 12E');
  assert.equal(t.draft.ref, 'RX-55120');
  assert.deepEqual(validateItem(draftForForm(t, 'Train')), []);
});

test('car hire: company, pick-up place and time, drop-off time and place, reservation number', () => {
  const c = one(CAR);
  assert.equal(c.kind, 'car');
  assert.equal(c.draft.carrier, 'Meadow Lane Rentals');
  assert.equal(c.draft.placeName, 'Kyoto Station Branch');
  assert.equal(c.draft.startDate, '2027-03-18');
  assert.equal(c.draft.startTime, '15:00');
  assert.equal(c.draft.endDate, '2027-03-21');
  assert.equal(c.draft.endTime, '10:00');
  assert.equal(c.draft.startTz, 'Asia/Tokyo');
  assert.equal(c.draft.ref, 'MLR-449201');
  assert.equal(c.dropOff, 'Osaka Kansai Airport Desk');
  const d = draftForForm(c, 'Car hire', (p) => `Drop-off: ${p}`);
  assert.equal(d.notes, 'Drop-off: Osaka Kansai Airport Desk');
  assert.deepEqual(validateItem(d), []);
});

test('event: name, venue, address, start (not doors), end, seat, order number', () => {
  const e = one(EVENT);
  assert.equal(e.kind, 'activity');
  assert.equal(e.draft.title, 'Evening Lantern Concert');
  assert.equal(e.draft.placeName, 'Riverside Hall');
  assert.equal(e.draft.address, '45 Example Lane, Kyoto');
  assert.equal(e.draft.startDate, '2027-03-20');
  assert.equal(e.draft.startTime, '19:00');
  assert.equal(e.draft.endTime, '21:15');
  assert.equal(e.draft.seat, 'Row F, Seat 12');
  assert.equal(e.draft.ref, 'EV-30018');
  assert.equal(e.draft.startTz, 'Asia/Tokyo');
});

test('event with only doors time starts at the doors', () => {
  const e = one('Tickets for Harbour Lights Festival\nDate: 2027-01-09\nDoors open 17:30\nVenue: Pier Park, Sydney\nOrder #: HL-2201');
  assert.equal(e.kind, 'activity');
  assert.equal(e.draft.startTime, '17:30');
  assert.equal(e.draft.endDate, '', 'no end when none is printed');
  assert.equal(e.draft.startTz, 'Australia/Sydney');
});

test('ferry and bus are told apart from trains', () => {
  const f = one('Ferry booking\nSailing: Blue Strait Ferries\nFrom: Harbour Pier To: Island Wharf\nDeparts 2027-02-14 08:15, arrives 09:40\nBooking ref: BSF-7720');
  assert.equal(f.kind, 'ferry');
  assert.equal(f.draft.fromName, 'Harbour Pier');
  assert.equal(f.draft.toName, 'Island Wharf');
  assert.equal(f.draft.startTime, '08:15');
  assert.equal(f.draft.endTime, '09:40');
  assert.equal(f.draft.endDate, '2027-02-14');
  const b = one('Bus ticket\nGreenline Coaches, bus 88\nSydney → Byron Bay\n14 Feb 2027 07:00 – 21:30\nTicket number: GL-8810');
  assert.equal(b.kind, 'bus');
  assert.equal(b.draft.fromName, 'Sydney');
  assert.equal(b.draft.toName, 'Byron Bay');
  assert.equal(b.draft.startTime, '07:00');
  assert.equal(b.draft.endTime, '21:30');
  assert.equal(b.draft.ref, 'GL-8810');
});

test('a text message with an inline route', () => {
  const f = one(SMS);
  assert.equal(f.kind, 'flight');
  assert.equal(f.draft.number, 'NH 110');
  assert.equal(f.draft.fromName, 'Sydney (SYD)');
  assert.equal(f.draft.toName, 'Tokyo Haneda (HND)');
  assert.equal(f.draft.startDate, '2027-03-12', 'Mar 12 with no year: the next one after now');
  assert.equal(f.draft.startTime, '21:00');
  assert.equal(f.draft.ref, 'ABC123');
  assert.equal(f.draft.seat, '32A');
  assert.equal(f.confidence.start, 'low', 'an inferred year without a weekday is a guess');
});

test('itinerary with a flight then a hotel gives both', () => {
  const r = parseBookings(FULL_ITINERARY, opts);
  assert.deepEqual(
    r.map((b) => b.kind),
    ['flight', 'hotel'],
  );
  const [f, h] = r;
  assert.equal(f.draft.ref, 'ZX81QM');
  assert.equal(f.airport?.terminal, 'T1');
  assert.equal(f.draft.endDate, '2027-04-03');
  assert.equal(h.draft.title, 'Quiet Pine Ryokan');
  assert.equal(h.draft.address, '12 Example-dori, Higashiyama Ward, Kyoto 605-0000');
  assert.equal(h.draft.startTz, 'Asia/Tokyo');
  assert.equal(h.draft.ref, 'QP-55821', 'its own number, not the flight reference');
  assert.equal(h.draft.startTime, '16:00');
});

test('overnight flight with arrival time only rolls to the next day (as a guess); "+1" is taken as printed', () => {
  const a = one('Flight SQ 222\nSYD → SIN\nDeparts 12 Mar 2027 23:30\nArrives 05:15');
  assert.equal(a.draft.endDate, '2027-03-13');
  assert.equal(a.confidence.end, 'low');
  const b = one('Flight SQ 222 SYD → SIN 12 Mar 2027 23:30 – 05:15 +1');
  assert.equal(b.draft.endDate, '2027-03-13');
  assert.equal(b.confidence.end, 'high');
  const c = one('Flight QF 401\nSYD → MEL\nDeparts 12 Mar 2027 09:00\nArrives 10:35');
  assert.equal(c.draft.endDate, '2027-03-12');
  assert.equal(c.confidence.end, 'high');
});

test('unknown airport codes are kept and the zone is left for the traveller', () => {
  const f = one('Flight ZZ 12\nDeparts Littlebay (QQX) 2027-06-01 10:00\nArrives Sydney (SYD) 2027-06-01 12:40');
  assert.equal(f.draft.fromName, 'Littlebay (QQX)');
  assert.equal(f.draft.startTz, '');
  assert.equal(f.draft.endTz, 'Australia/Sydney');
  assert.deepEqual(f.unknownCodes, ['QQX']);
  assert.ok(needsCheck(f).includes('zone'));
  assert.ok(validateItem(draftForForm(f, 'Flight')).includes('startTz'), 'the form asks for the zone');
});

test('US date hint reads 03/12/2027 as March 12; default reads 12 March... as day first', () => {
  const us = one('Flight UA 837 SFO → NRT on 03/12/2027 at 11:20 AM, arriving 03/13/2027 3:05 PM', { us: true });
  assert.equal(us.draft.startDate, '2027-03-12');
  assert.equal(us.draft.startTime, '11:20');
  assert.equal(us.draft.endDate, '2027-03-13');
  assert.equal(us.draft.endTime, '15:05');
  const dm = one('Flight UA 837 SFO → NRT on 03/12/2027 at 11:20 AM');
  assert.equal(dm.draft.startDate, '2027-12-03');
  assert.equal(dm.confidence.start, 'low', 'both readings are possible, so it says check this');
});

test('gate and boarding time go to the airport fields', () => {
  const f = one('Flight QF 1\nSYD → LHR\nDeparts 2027-07-01 16:00 Terminal 1, Gate 52\nBoarding 15:20');
  assert.deepEqual(f.airport, { terminal: '1', gate: '52', boarding: '15:20' });
  assert.equal(f.draft.startTime, '16:00', 'boarding is not the departure');
});

test('garbage, empty and odd input give nothing and never throw', () => {
  const junk = [
    '',
    '   \n\n  ',
    'hello world, lunch at 12:30? price was $23.45 on 1/2. The ABC of it all 12345.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    '🙂🙂🙂 ✈️ → ← ((((( ))))) ::::: ----',
    'AB 12 CD 34 EF 56',
    '<html><body><div>Unsubscribe</div></body></html>',
    'x'.repeat(200_000),
    '12/13/14/15 99:99 32 Foo 2027',
    'Meeting notes: call Taylor at 3pm on Tuesday.',
  ];
  for (const s of junk) assert.deepEqual(parseBookings(s, opts), [], JSON.stringify(s.slice(0, 40)));
  assert.deepEqual(parseBookings(undefined as unknown as string, opts), []);
  assert.deepEqual(parseBookings(null as unknown as string, opts), []);
});

test('Windows line endings, tabs and non-breaking spaces read the same', () => {
  const r = parseBookings(MULTI_LEG_EMAIL.replace(/\n/g, '\r\n').replace(/ /g, ' '), opts);
  assert.equal(r.length, 2);
  assert.equal(r[0].draft.startTime, '21:00');
});

test('a summary that repeats a flight number does not make an extra leg', () => {
  const r = parseBookings('Flight QF 25\nSydney (SYD) → Tokyo Haneda (HND)\nQF 25 departs 2027-03-12 21:00\nArrives 2027-03-13 05:10', opts);
  assert.equal(r.length, 1);
});

test('legs written route-first keep their own route', () => {
  const r = parseBookings('Your flights\nPNR: TT55RQ\nMEL → SIN\nFlight 7C 101 departs 2027-08-01 10:00 arrives 15:30\nSIN → BKK\nFlight 7C 205 departs 2027-08-01 18:00 arrives 19:25', opts);
  assert.equal(r.length, 2);
  assert.equal(r[0].draft.fromName, 'Melbourne (MEL)');
  assert.equal(r[0].draft.toName, 'Singapore (SIN)');
  assert.equal(r[1].draft.fromName, 'Singapore (SIN)');
  assert.equal(r[1].draft.toName, 'Bangkok Suvarnabhumi (BKK)');
  assert.equal(r[1].draft.number, '7C 205');
  assert.equal(r[1].draft.ref, 'TT55RQ');
});

test('return trip email: outbound and return legs, dates on their own line, check-in closing time ignored', () => {
  const r = parseBookings(
    `Booking confirmed - Sunfield Air
Booking code: PX4M2Q
Outbound
Thursday, 4 February 2027
Flight SF 802  Melbourne (MEL) to Auckland (AKL)
Check-in closes 06:10
Departure 07:00 Terminal 2
Arrival 12:20
Return
Tuesday, 16 February 2027
Flight SF 803 Auckland (AKL) to Melbourne (MEL)
Departure 13:30
Arrival 15:25`,
    opts,
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].draft.fromName, 'Melbourne (MEL)');
  assert.equal(r[0].draft.startDate, '2027-02-04');
  assert.equal(r[0].draft.startTime, '07:00');
  assert.equal(r[0].draft.endTime, '12:20');
  assert.equal(r[0].draft.endTz, 'Pacific/Auckland');
  assert.equal(r[0].airport?.terminal, '2');
  assert.equal(r[1].draft.fromName, 'Auckland (AKL)');
  assert.equal(r[1].draft.startDate, '2027-02-16');
  assert.equal(r[1].draft.ref, 'PX4M2Q');
  assert.equal(r[0].draft.carrier, 'Sunfield Air');
});

test('hotel "arrival" and "departure" dates are check-in and check-out', () => {
  const h = one('Dear guest,\nYour reservation at Maple Court Apartments\nArrival date: 10/06/2027\nDeparture date: 14/06/2027\nAddress: 77 Example Avenue, London W1 2AB\nReservation number: MC-77120');
  assert.equal(h.kind, 'hotel');
  assert.equal(h.draft.title, 'Maple Court Apartments');
  assert.equal(h.draft.startDate, '2027-06-10');
  assert.equal(h.draft.endDate, '2027-06-14');
  assert.equal(h.draft.startTz, 'Europe/London');
  assert.equal(h.draft.ref, 'MC-77120');
});

// ---- dates ----

test('date formats', () => {
  assert.deepEqual(dates('12 Mar 2027'), ['2027-03-12']);
  assert.deepEqual(dates('12 March 2027'), ['2027-03-12']);
  assert.deepEqual(dates('Mar 12, 2027'), ['2027-03-12']);
  assert.deepEqual(dates('March 12 2027'), ['2027-03-12']);
  assert.deepEqual(dates('2027-03-12'), ['2027-03-12']);
  assert.deepEqual(dates('12/03/2027'), ['2027-03-12']);
  assert.deepEqual(dates('03/12/2027', true), ['2027-03-12']);
  assert.deepEqual(dates('12.03.2027'), ['2027-03-12']);
  assert.deepEqual(dates('12/03/27'), ['2027-03-12']);
  assert.deepEqual(dates('1st April 2027'), ['2027-04-01']);
  assert.deepEqual(dates('Sept 3, 2027'), ['2027-09-03']);
  assert.deepEqual(dates('12MAR2027'), ['2027-03-12']);
});

test('a part over 12 settles day/month order whatever the hint', () => {
  assert.deepEqual(dates('25/03/2027', true), ['2027-03-25']);
  assert.deepEqual(dates('03/25/2027'), ['2027-03-25']);
  const [d] = findDates('25/03/2027', { now: NOW });
  assert.equal(d.confidence, 'high');
  const [a] = findDates('04/05/2027', { now: NOW });
  assert.equal(a.confidence, 'low');
});

test('impossible dates are skipped', () => {
  assert.deepEqual(dates('31 Feb 2027'), []);
  assert.deepEqual(dates('2027-13-01'), []);
  assert.deepEqual(dates('29 Feb 2028'), ['2028-02-29']);
});

test('year inference: next occurrence from now, checked against the weekday', () => {
  assert.deepEqual(dates('12 Mar'), ['2027-03-12']);
  assert.deepEqual(dates('20 Nov'), ['2026-11-20']);
  assert.deepEqual(dates('Oct 1'), ['2026-10-01'], 'a month back is still this year (just travelled)');
  assert.deepEqual(dates('1 Aug'), ['2027-08-01'], 'long past means next year');
  // 12 Mar 2027 is a Friday; 12 Mar 2028 is a Sunday.
  const [fri] = findDates('Fri 12 Mar', { now: NOW });
  assert.equal(fri.date, '2027-03-12');
  assert.equal(fri.confidence, 'high');
  const [sun] = findDates('Sun 12 Mar', { now: NOW });
  assert.equal(sun.date, '2028-03-12', 'the weekday picks the year');
  const [none] = findDates('12 Mar', { now: NOW });
  assert.equal(none.confidence, 'low');
});

test('a printed weekday that does not match the date is a check-this', () => {
  const [d] = findDates('Mon 12 Mar 2027', { now: NOW });
  assert.equal(d.date, '2027-03-12');
  assert.equal(d.confidence, 'low');
});

test('dates do not swallow the time after them', () => {
  assert.deepEqual(dates('Mar 12 21:00'), ['2027-03-12']);
  assert.deepEqual(
    findTimes('Mar 12 21:00').map((t) => t.time),
    ['21:00'],
  );
});

// ---- times ----

test('time formats', () => {
  const t = (s: string) => findTimes(s).map((x) => x.time);
  assert.deepEqual(t('14:35'), ['14:35']);
  assert.deepEqual(t('2:35 PM'), ['14:35']);
  assert.deepEqual(t('2:35pm'), ['14:35']);
  assert.deepEqual(t('Departs 2.35pm'), ['14:35']);
  assert.deepEqual(t('12:05 a.m.'), ['00:05']);
  assert.deepEqual(t('12:30 PM'), ['12:30']);
  assert.deepEqual(t('from 3pm'), ['15:00']);
  assert.deepEqual(t('check-in 14.00'), ['14:00']);
  assert.deepEqual(t('Total $23.45'), [], 'a price is not a time');
  assert.deepEqual(t('25:00 or 13:75'), []);
  assert.deepEqual(t('13:00 PM'), [], '13 PM is nonsense');
  assert.equal(findTimes('05:15 +1')[0].nextDay, true);
});

// ---- pieces ----

test('flight numbers need flight context', () => {
  assert.deepEqual(flightNumbers('Flight QF 25', false), ['QF 25']);
  assert.deepEqual(flightNumbers('Flight number: JL5', false), ['JL 5']);
  assert.deepEqual(flightNumbers('NH 110 SYD-HND', false), ['NH 110']);
  assert.deepEqual(flightNumbers('NH 0110 departs 21:00', true), ['NH 110']);
  assert.deepEqual(flightNumbers('Seat 32A, Gate B12, Terminal T1', true), []);
  assert.deepEqual(flightNumbers('Room AB 12 on level 3', false), []);
  assert.deepEqual(flightNumbers('Ticket AB 12', false), [], 'no flight word, no route');
  assert.deepEqual(flightNumbers('Arrive 9:00 AM 10 people', true), []);
});

test('airport codes: known anywhere, unknown only in a name (XYZ) or a route', () => {
  assert.deepEqual(
    codesIn('Sydney (SYD) → Tokyo Haneda (HND)').map((c) => [c.code, c.name]),
    [
      ['SYD', 'Sydney'],
      ['HND', 'Tokyo Haneda'],
    ],
  );
  assert.deepEqual(
    codesIn('QQX → SYD').map((c) => c.code),
    ['QQX', 'SYD'],
  );
  assert.deepEqual(
    codesIn('THE END AND MAR USD').map((c) => c.code),
    [],
  );
  assert.deepEqual(
    codesIn('XYZ alone').map((c) => c.code),
    [],
  );
});

test('references need to look like codes', () => {
  assert.equal(findRef(['Booking reference: K7Q2ZP']), 'K7Q2ZP');
  assert.equal(findRef(['PNR ABC123']), 'ABC123');
  assert.equal(findRef(['Confirmation #: 88412093']), '88412093');
  assert.equal(findRef(['Your booking is confirmed']), undefined);
  assert.equal(findRef(['Reservation number: MLR-449201']), 'MLR-449201');
});

test('line parts split at role words', () => {
  assert.deepEqual(
    lineParts('Check-in: 15 Mar Check-out: 18 Mar').map((p) => p.role),
    ['start', 'end'],
  );
  assert.deepEqual(
    lineParts('Welcome to Tokyo').map((p) => p.role),
    ['none'],
    '"to" inside a sentence is not an arrival',
  );
  assert.deepEqual(
    lineParts('10:00 to 18:00').map((p) => p.role),
    ['none', 'end'],
  );
  assert.deepEqual(
    lineParts('Online check-in opens 24 hours before').map((p) => p.role),
    ['other'],
  );
});

test('airport table and city zones', () => {
  assert.equal(airportByCode('hnd')?.tz, 'Asia/Tokyo');
  assert.equal(airportByCode('QQX'), undefined);
  assert.equal(zoneFromCity('Gion, Kyoto 605')?.tz, 'Asia/Tokyo');
  assert.equal(zoneFromCity('5 Example Ave, New York')?.tz, 'America/New_York');
  assert.equal(zoneFromCity('nowhere at all'), undefined);
  for (const tz of new Set([...'SYD HND KIX LHR JFK SIN BKK CDG LAX HNL AKL DXB'.split(' ')].map((c) => airportByCode(c)!.tz))) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: tz }));
  }
});

// ---- screen helpers ----

test('found fields list values in reading order with confidence', () => {
  const [a] = parseBookings(MULTI_LEG_EMAIL, opts);
  const f = foundFields(a);
  assert.deepEqual(
    f.map((x) => x.field),
    ['title', 'from', 'to', 'start', 'end', 'zone', 'carrier', 'number', 'seat', 'terminal', 'ref'].filter((k) => f.some((x) => x.field === k)),
  );
  assert.equal(f.find((x) => x.field === 'start')?.value, '2027-03-12 21:00');
  assert.equal(f.find((x) => x.field === 'zone')?.value, 'Australia/Sydney → Asia/Tokyo');
});

test('draft for the form gets a fallback title only when none was found', () => {
  const b = one('Flight ZZ 12\nQQX → QQY\n2027-06-01 10:00');
  assert.equal(b.draft.title, 'QQX → QQY');
  const blank = { ...b, draft: { ...b.draft, title: '' } };
  assert.equal(draftForForm(blank, 'Flight').title, 'Flight');
});

test('already-in-trip and trip suggestion', () => {
  const [a] = parseBookings(MULTI_LEG_EMAIL, opts);
  const item: Item = {
    id: 'x',
    tripId: 't',
    kind: 'flight',
    title: 'Sydney → Tokyo',
    number: 'qf 25',
    start: { local: '2027-03-12T21:00', tz: 'Australia/Sydney' },
    attachments: [],
  };
  assert.equal(alreadyInTrip(a, { items: [item] }), true);
  assert.equal(alreadyInTrip(a, { items: [{ ...item, start: { ...item.start, local: '2027-03-12T22:00' } }] }), false);
  assert.equal(alreadyInTrip(a, undefined), false);
  const trips = [
    { id: 'a', startDate: '2026-12-01', endDate: '2026-12-10' },
    { id: 'b', startDate: '2027-03-12', endDate: '2027-03-25' },
  ];
  assert.equal(suggestTrip(parseBookings(MULTI_LEG_EMAIL, opts), trips)?.id, 'b');
  assert.equal(suggestTrip(parseBookings(HOTEL_EMAIL, opts), [{ id: 'c', startDate: '2027-03-17', endDate: '2027-03-30' }])?.id, 'c', 'within a few days counts');
  assert.equal(suggestTrip([], trips), undefined);
});

test('parsing is quick on a long confirmation', () => {
  const big = Array.from({ length: 40 }, () => MULTI_LEG_EMAIL + '\n\n' + HOTEL_EMAIL).join('\n\n');
  const t0 = Date.now();
  const r = parseBookings(big, opts);
  assert.ok(r.length > 10);
  assert.ok(Date.now() - t0 < 3000);
});
