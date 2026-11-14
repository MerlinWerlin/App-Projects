// T170 itinerary import: calendar files, timetable text and confirmations. Every name and code below is invented.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aiPrompt,
  alreadyPlanned,
  looksLikeJson,
  readAiReply,
  durationMinutes,
  guessKind,
  icsEvents,
  importSpan,
  looksLikeIcs,
  parseIcs,
  parseItinerary,
  parsePlanText,
  routeIn,
  tripForImport,
  unescapeIcs,
  unfoldIcs,
  usable,
  zoneFromTzid,
  type ImportOptions,
} from './itinerary.ts';
import type { Item, Trip } from './model.ts';
import { itemFromDraft, validateItem } from './trips.ts';
import { toUtc } from './tz.ts';

const opts: ImportOptions = { now: '2027-02-01', fallbackTz: 'Europe/Paris', firstDay: '2027-03-03' };

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Example//EN',
  'BEGIN:VEVENT',
  'UID:1@example',
  'DTSTART;TZID=Europe/Paris:20270303T093000',
  'DTEND;TZID=Europe/Paris:20270303T113000',
  'SUMMARY:Guided tour of the old town',
  'LOCATION:Place du Marché\\, Lyon',
  'DESCRIPTION:Meet the guide by the fountain.\\nBooking reference: TR4K9Z',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'DESCRIPTION:Reminder',
  'TRIGGER:-PT30M',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:2@example',
  'DTSTART:20270303T190000Z',
  'DURATION:PT2H',
  'SUMMARY:Dinner at Le Petit Example',
  'LOCATION:Paris',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:3@example',
  'DTSTART;VALUE=DATE:20270304',
  'DTEND;VALUE=DATE:20270307',
  'SUMMARY:Stay at Hotel Exemple',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:4@example',
  'DTSTART:20270305T080000Z',
  'DTEND:20270305T091500Z',
  'SUMMARY:Flight AB123 Paris to London',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:5@example',
  'STATUS:CANCELLED',
  'DTSTART:20270306T080000Z',
  'SUMMARY:Cancelled thing',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('ics text primitives: unfold, unescape, durations, zones', () => {
  assert.deepEqual(unfoldIcs('SUMMARY:Long\r\n  title\r\nX:1'), ['SUMMARY:Long title', 'X:1']);
  assert.equal(unescapeIcs('a\\, b\\; c\\nd\\\\e'), 'a, b; c\nd\\e');
  assert.equal(durationMinutes('PT1H30M'), 90);
  assert.equal(durationMinutes('P1D'), 1440);
  assert.equal(durationMinutes('P1W'), 10080);
  assert.equal(durationMinutes('nonsense'), null);
  assert.equal(zoneFromTzid('Europe/Paris'), 'Europe/Paris');
  assert.equal(zoneFromTzid('/Europe/Paris'), 'Europe/Paris');
  assert.equal(zoneFromTzid('AUS Eastern Standard Time'), 'Australia/Sydney');
  assert.equal(zoneFromTzid('Not/AZone'), undefined);
  assert.ok(looksLikeIcs(ICS));
  assert.ok(!looksLikeIcs('09:00 Breakfast'));
});

test('ics: alarms are skipped, cancelled events are left out', () => {
  assert.equal(icsEvents(ICS).length, 5);
  assert.equal(icsEvents(ICS)[0].DESCRIPTION.value.startsWith('Meet'), true);
  const got = parseIcs(ICS, opts);
  assert.equal(got.length, 4);
  assert.ok(!got.some((p) => p.draft.title.includes('Cancelled')));
});

test('ics: TZID keeps the wall clock; UTC times land in the named city; place and code are read', () => {
  const [tour, dinner, stay, flight] = parseIcs(ICS, opts);
  assert.equal(tour.draft.kind, 'activity');
  assert.equal(tour.draft.startDate, '2027-03-03');
  assert.equal(tour.draft.startTime, '09:30');
  assert.equal(tour.draft.endTime, '11:30');
  assert.equal(tour.draft.startTz, 'Europe/Paris');
  assert.equal(tour.draft.placeName, 'Place du Marché');
  assert.equal(tour.draft.address, 'Lyon');
  assert.equal(tour.draft.ref, 'TR4K9Z');
  // 19:00 UTC in Paris in March (UTC+1) is 20:00; DURATION gives the end.
  assert.equal(dinner.draft.startTime, '20:00');
  assert.equal(dinner.draft.endTime, '22:00');
  assert.equal(dinner.check, false);
  // All-day over nights, worded as a stay: a hotel with default times, marked to check.
  assert.equal(stay.draft.kind, 'hotel');
  assert.equal(stay.draft.startDate, '2027-03-04');
  assert.equal(stay.draft.endDate, '2027-03-07');
  assert.equal(stay.check, true);
  // A flight with a route in its title.
  assert.equal(flight.draft.kind, 'flight');
  assert.equal(flight.draft.number, 'AB123');
  assert.equal(flight.draft.fromName, 'Paris');
  assert.equal(flight.draft.toName, 'London');
  assert.equal(flight.draft.startTime, '09:00');
  assert.equal(flight.draft.endTz, 'Europe/London');
  assert.equal(flight.draft.endTime, '09:15');
  for (const p of [tour, dinner, stay, flight]) assert.deepEqual(validateItem(p.draft), [], p.draft.title);
});

test('ics: a UTC time with no place clue uses the fallback zone and asks to check', () => {
  const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20270310T120000Z\nSUMMARY:Spa\nEND:VEVENT\nEND:VCALENDAR';
  const [spa] = parseIcs(ics, { ...opts, fallbackTz: 'Asia/Tokyo' });
  assert.equal(spa.draft.startTime, '21:00');
  assert.equal(spa.draft.startTz, 'Asia/Tokyo');
  assert.equal(spa.check, true);
});

test('ics: a journey with no end becomes an activity (never a draft the form would refuse)', () => {
  const ics = 'BEGIN:VEVENT\nDTSTART;TZID=Europe/Paris:20270311T080000\nSUMMARY:Train to Lyon\nEND:VEVENT';
  const [p] = parseIcs(ics, opts);
  assert.equal(p.draft.kind, 'activity');
  assert.deepEqual(validateItem(p.draft), []);
});

const PLAN = `Paris family holiday

Day 1 – Wed 3 Mar
09:00 Breakfast at the hotel
10:30 – 12:30 Louvre guided tour @ Rue de Rivoli
1pm Lunch
15:00 Free time
19:30 Dinner cruise on the Seine

Day 2
8:15am Airport transfer to Lyon
noon Check in at Hôtel Exemple

Thursday 5 March 2027
- 10:00 Cooking class
Some line with no time is ignored`;

test('plan text: Day N and dated headings set the day; lines starting with a time are plans', () => {
  const got = parsePlanText(PLAN, opts);
  const rows = got.map((p) => [p.draft.startDate, p.draft.startTime, p.draft.title, p.draft.kind]);
  assert.deepEqual(rows, [
    ['2027-03-03', '09:00', 'Breakfast at the hotel', 'activity'],
    ['2027-03-03', '10:30', 'Louvre guided tour', 'activity'],
    ['2027-03-03', '13:00', 'Lunch', 'activity'],
    ['2027-03-03', '15:00', 'Free time', 'note'],
    ['2027-03-03', '19:30', 'Dinner cruise on the Seine', 'activity'],
    ['2027-03-04', '08:15', 'Airport transfer to Lyon', 'activity'],
    ['2027-03-04', '12:00', 'Check in at Hôtel Exemple', 'hotel'],
    ['2027-03-05', '10:00', 'Cooking class', 'activity'],
  ]);
  const tour = got[1].draft;
  assert.equal(tour.endTime, '12:30');
  assert.equal(tour.placeName, 'Rue de Rivoli');
  // Paris is named, so its zone is used.
  assert.equal(tour.startTz, 'Europe/Paris');
  const hotel = got[6].draft;
  assert.equal(hotel.placeName, 'Hôtel Exemple');
  assert.equal(hotel.endDate, '2027-03-05');
  for (const p of got) assert.deepEqual(validateItem(p.draft), [], p.draft.title);
});

test('plan text: no heading uses the default day; times inside sentences are not plans', () => {
  const got = parsePlanText('Pick-up is at 9:00 from the lobby\n14:00 Museum', { ...opts, defaultDay: '2027-03-09' });
  assert.equal(got.length, 1);
  assert.equal(got[0].draft.title, 'Museum');
  assert.equal(got[0].draft.startDate, '2027-03-09');
  assert.equal(got[0].check, true);
});

test('kind words and routes', () => {
  assert.equal(guessKind('Flight QF1 SYD → LHR'), 'flight');
  assert.equal(guessKind('Shinkansen to Kyoto'), 'train');
  assert.equal(guessKind('Ferry to the island'), 'ferry');
  assert.equal(guessKind('Hotel Exemple'), 'hotel');
  assert.equal(guessKind('Car hire pick-up'), 'car');
  assert.equal(guessKind('Dinner with friends'), 'activity');
  assert.deepEqual(routeIn('Flight AB123 Paris to London'), { from: 'Paris', to: 'London' });
  assert.deepEqual(routeIn('SYD → NRT'), { from: 'SYD', to: 'NRT' });
  assert.equal(routeIn('Dinner'), null);
});

const CONFIRMATION = `Your trip is confirmed
Booking reference: K7Q2ZP

Flight QF 25
Depart Sydney (SYD) 12 Mar 2027 09:30
Arrive Tokyo Narita (NRT) 12 Mar 2027 17:45

Day 1
19:00 Welcome dinner`;

test('one entry point: confirmations and timetable lines together, without doubles', () => {
  const got = parseItinerary(CONFIRMATION, { ...opts, firstDay: '2027-03-12' });
  assert.equal(got[0].source, 'booking');
  assert.equal(got[0].draft.kind, 'flight');
  assert.ok(got.some((p) => p.source === 'plan' && p.draft.title === 'Welcome dinner' && p.draft.startDate === '2027-03-12'));
  assert.equal(usable(got).length, got.length);
  assert.deepEqual(parseItinerary('', opts), []);
  assert.deepEqual(parseItinerary('just words, nothing else', opts), []);
  // Calendar text goes to the calendar reader.
  assert.equal(parseItinerary(ICS, opts)[0].source, 'calendar');
});

const trip = (items: Item[] = []): Trip => ({ id: 't1', name: 'Paris', startDate: '2027-03-03', endDate: '2027-03-08', homeTz: 'Australia/Sydney', items, createdAt: '2027-01-01' });

test('already planned, span and which trip', () => {
  const got = parsePlanText(PLAN, opts);
  const saved = itemFromDraft(got[0].draft, 't1');
  assert.ok(alreadyPlanned(got[0], trip([saved])));
  assert.ok(!alreadyPlanned(got[1], trip([saved])));
  assert.deepEqual(importSpan(got), { from: '2027-03-03', to: '2027-03-05' });
  const other: Trip = { ...trip(), id: 't2', startDate: '2027-06-01', endDate: '2027-06-10' };
  assert.equal(tripForImport(got, [other, trip()])?.id, 't1');
  assert.equal(tripForImport(got, [other]), undefined);
});

test('saved items keep the wall clock in their zone', () => {
  const [, , , flight] = parseIcs(ICS, opts);
  const it = itemFromDraft(flight.draft, 't1');
  assert.equal(toUtc(it.start), Date.UTC(2027, 2, 5, 8, 0));
  assert.equal(toUtc(it.end!), Date.UTC(2027, 2, 5, 9, 15));
});

test('open in: a calendar file is recognised by name, UTI, MIME or its first bytes, and goes to the itinerary', async () => {
  const { classifyFile, decideKind, routeFor, sniffKind } = await import('./openin.ts');
  assert.equal(classifyFile({ name: 'Trip.ics' }), 'ics');
  assert.equal(classifyFile({ uti: 'com.apple.ical.ics' }), 'ics');
  assert.equal(classifyFile({ mime: 'text/calendar; charset=utf-8' }), 'ics');
  assert.equal(sniffKind(new TextEncoder().encode('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')), 'ics');
  assert.equal(decideKind({ name: 'export.txt' }, new TextEncoder().encode('BEGIN:VCALENDAR\r\n')), 'ics');
  assert.equal(routeFor('ics'), 'itinerary');
});

// ---- structured data: email booking markup and the traveller's own AI ----

const LD = [
  {
    '@context': 'http://schema.org',
    '@type': 'FlightReservation',
    reservationNumber: 'K7Q2ZP',
    reservedTicket: { '@type': 'Ticket', ticketedSeat: { '@type': 'Seat', seatNumber: '32A' } },
    reservationFor: {
      '@type': 'Flight',
      flightNumber: '25',
      airline: { '@type': 'Airline', name: 'Coral Wing Airways', iataCode: 'QF' },
      departureAirport: { '@type': 'Airport', name: 'Sydney Airport', iataCode: 'SYD' },
      arrivalAirport: { '@type': 'Airport', name: 'Narita', iataCode: 'NRT' },
      departureTime: '2027-03-12T09:30:00+11:00',
      arrivalTime: '2027-03-12T17:45:00+09:00',
    },
  },
  {
    '@context': 'http://schema.org',
    '@type': 'LodgingReservation',
    reservationNumber: 'HX-88123',
    reservationFor: { '@type': 'LodgingBusiness', name: 'Hotel Exemple Shinjuku', address: { streetAddress: '1-2-3 Example', addressLocality: 'Tokyo', addressCountry: 'JP' } },
    checkinDate: '2027-03-12T15:00:00+09:00',
    checkoutDate: '2027-03-15',
  },
  { '@type': 'FoodEstablishmentReservation', reservationStatus: 'http://schema.org/ReservationCancelled', reservationFor: { name: 'Gone' }, startTime: '2027-03-13T19:00:00' },
];

test('email booking markup: JSON-LD blocks are found in an .eml and read exactly', async () => {
  const { emlJsonLd, jsonLdBlocks } = await import('./openin.ts');
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(LD)}</script></head><body>Hi</body></html>`;
  assert.equal(jsonLdBlocks(html).length, 1);
  const eml = ['From: bookings@example.com', 'Subject: Your trip', 'Content-Type: text/html; charset=utf-8', '', html].join('\r\n');
  const json = emlJsonLd(eml);
  assert.ok(json.startsWith('['));
  const got = parseItinerary(json, opts);
  assert.equal(got.length, 2); // the cancelled one is left out
  const [fl, stay] = got;
  assert.equal(fl.draft.kind, 'flight');
  assert.equal(fl.draft.number, 'QF25');
  assert.equal(fl.draft.ref, 'K7Q2ZP');
  assert.equal(fl.draft.seat, '32A');
  assert.equal(fl.draft.startTime, '09:30');
  assert.equal(fl.draft.startTz, 'Australia/Sydney');
  assert.equal(fl.draft.endTime, '17:45');
  assert.equal(fl.draft.endTz, 'Asia/Tokyo');
  assert.equal(fl.draft.fromName, 'Sydney Airport (SYD)');
  assert.equal(stay.draft.kind, 'hotel');
  assert.equal(stay.draft.placeName, 'Hotel Exemple Shinjuku');
  assert.equal(stay.draft.startTz, 'Asia/Tokyo');
  assert.equal(stay.draft.endDate, '2027-03-15');
  assert.equal(stay.draft.endTime, '11:00');
  for (const p of got) assert.deepEqual(validateItem(p.draft), [], p.draft.title);
  // A plain email with no markup gives nothing here (its text still goes to Paste a booking).
  assert.equal(emlJsonLd(['Subject: Hi', '', 'Hello'].join('\r\n')), '');
});

const AI_REPLY = `Here you go:
\`\`\`json
[
  {"date": "2027-03-03", "start": "9:30", "end": "11:00", "endDate": "", "type": "tour", "title": "Old town walking tour", "place": "Town Hall", "address": "", "from": "", "to": "", "code": "", "timezone": "Europe/Paris"},
  {"date": "2027-03-03", "start": "15:00", "end": "11:00", "endDate": "2027-03-05", "type": "hotel", "title": "Hotel Exemple", "place": "Hotel Exemple", "code": "HX1", "timezone": "Europe/Paris"},
  {"date": "2027-03-05", "start": "08:00", "end": "10:00", "type": "train", "title": "TGV 6201", "from": "Paris", "to": "Lyon", "timezone": "Europe/Paris"},
  {"date": "2027-03-05", "start": "12:00", "type": "transfer", "title": "Driver to the vineyard"},
  {"date": "March 6", "start": "10:00", "title": "Bad date"},
  {"date": "2027-03-06", "start": "25:00", "title": "Bad time"},
  {"date": "2027-03-06", "start": "10:00", "title": "Bad zone", "timezone": "Mars/Olympus"}
]
\`\`\``;

test('own AI: a fenced JSON reply is read, bad items are listed with the reason', () => {
  const r = readAiReply(AI_REPLY, opts);
  assert.equal(r.error, null);
  assert.deepEqual(r.problems, [
    { item: 5, reason: 'date' },
    { item: 6, reason: 'time' },
    { item: 7, reason: 'zone' },
  ]);
  const [tour, hotel, train, transfer] = r.plans;
  assert.equal(tour.draft.startTime, '09:30');
  assert.equal(tour.draft.endTime, '11:00');
  assert.equal(tour.check, false);
  assert.equal(hotel.draft.kind, 'hotel');
  assert.equal(hotel.draft.endDate, '2027-03-05');
  assert.equal(train.draft.kind, 'train');
  assert.equal(train.draft.toName, 'Lyon');
  assert.equal(transfer.draft.title, 'Transfer: Driver to the vineyard');
  assert.equal(transfer.check, true); // no time zone given
  for (const p of r.plans) assert.deepEqual(validateItem(p.draft), [], p.draft.title);
  // The one entry point reads the same reply.
  assert.equal(parseItinerary(AI_REPLY, opts).length, 4);
});

test('own AI: clear errors for replies in the wrong shape', () => {
  assert.equal(readAiReply('Sure! Here is your trip...', opts).error, 'json');
  assert.equal(readAiReply('{"trip": "Paris"}', opts).error, 'notList');
  assert.equal(readAiReply('[]', opts).error, 'empty');
  assert.equal(readAiReply('{"items": [{"date": "2027-03-03", "start": "09:00", "title": "Museum"}]}', opts).plans.length, 1);
  assert.ok(looksLikeJson('```json\n[]```'));
  assert.ok(!looksLikeJson('Day 1\n09:00 Museum'));
});

test('own AI: the prompt asks for the strict format and carries the itinerary and trip', () => {
  const p = aiPrompt('Day 1\n09:00 Museum', { name: 'Paris', startDate: '2027-03-03', endDate: '2027-03-08' });
  assert.match(p, /ONLY the lines/);
  assert.match(p, /Day · Start–End · Type: Title · Place or address · Booking code/);
  assert.match(p, /Flight, Stay, Tour, Food, Transport, Free time, Other/);
  assert.match(p, /"Paris", 2027-03-03 to 2027-03-08/);
  assert.ok(p.endsWith('Day 1\n09:00 Museum'));
  assert.match(aiPrompt('', undefined), /\[paste your itinerary here\]$/);
});

// ---- T173 the copy-in format ----

test('copy-in format: the example reads as five plans, the stay closed by its check-out line', async () => {
  const { FORMAT_EXAMPLE, readLines, looksLikeLines } = await import('./itinerary.ts');
  assert.ok(looksLikeLines(FORMAT_EXAMPLE));
  const r = readLines(FORMAT_EXAMPLE, { now: '2027-01-10', fallbackTz: 'Asia/Tokyo' });
  assert.deepEqual(r.problems, []);
  assert.deepEqual(
    r.plans.map((p) => [p.draft.startDate, p.draft.startTime, p.draft.kind, p.look, p.draft.title]),
    [
      ['2027-05-12', '09:30', 'flight', 'flight', 'QF1 Sydney to Tokyo'],
      ['2027-05-12', '15:00', 'hotel', 'stay', 'Hotel Sakura'],
      ['2027-05-13', '10:00', 'activity', 'tour', 'Asakusa walking tour'],
      ['2027-05-13', '19:00', 'activity', 'food', 'Dinner at Ramen Street'],
      ['2027-05-14', '13:00', 'activity', 'free', 'Shopping in Harajuku'],
    ],
  );
  const [flight, stay, tour] = r.plans;
  assert.equal(flight.draft.ref, 'ABC123');
  assert.equal(flight.draft.number, 'QF1');
  assert.equal(flight.draft.startTz, 'Australia/Sydney');
  assert.equal(flight.draft.endTz, 'Asia/Tokyo');
  assert.equal(flight.draft.endTime, '20:45');
  assert.equal(stay.draft.placeName, '1-2-3 Shinjuku');
  assert.equal(stay.draft.ref, 'HX8812');
  assert.equal(stay.draft.endDate, '2027-05-15');
  assert.equal(stay.draft.endTime, '11:00');
  assert.equal(tour.draft.endTime, '12:00');
  assert.equal(tour.draft.placeName, 'Kaminarimon Gate');
  for (const p of r.plans) assert.deepEqual(validateItem(p.draft), [], p.draft.title);
  // The one entry point reads the format too.
  assert.equal(parseItinerary(FORMAT_EXAMPLE, { now: '2027-01-10', fallbackTz: 'Asia/Tokyo' }).length, 5);
});

test('copy-in format: lines that do not fit say why, by line number; "|" and "Conf" prefixes work', async () => {
  const { readLines } = await import('./itinerary.ts');
  const r = readLines(
    ['Mon 12 May | 09:00 | Tour: Museum | City Museum | Conf ZX99', 'someday · 10:00 · Tour: Lost', 'Tue 13 May · soon · Food: Lunch', 'Tue 13 May · 12:00 · Food:'].join('\n'),
    { now: '2027-01-10', fallbackTz: 'Europe/Paris' },
  );
  assert.equal(r.plans.length, 1);
  assert.equal(r.plans[0].draft.ref, 'ZX99');
  assert.deepEqual(r.problems, [
    { line: 2, reason: 'date' },
    { line: 3, reason: 'time' },
    { line: 4, reason: 'title' },
  ]);
});

// ---- T174 Share itinerary: export -> import round trips ----

test('share: a calendar file Satchel wrote comes back exactly (times, zones, kinds, plan types, codes, routes)', async () => {
  const { buildIcs } = await import('./ics.ts');
  const { itemFromPlan, newPlanForm } = await import('./planform.ts');
  const words = {
    kind: (k: string) => k,
    starts: (_k: string, at: string) => `Starts ${at}`,
    ends: (_k: string, at: string) => `Ends ${at}`,
    zoneTime: (time: string, city: string) => `${time} ${city} time`,
    code: (ref: string) => `Booking code: ${ref}`,
    notes: (text: string) => `Notes: ${text}`,
  };
  const flight: Item = {
    id: 'f1', tripId: 't', kind: 'flight', title: 'QF25', ref: 'K7Q2ZP', number: 'QF25',
    start: { local: '2027-03-12T09:30', tz: 'Australia/Sydney' }, end: { local: '2027-03-12T17:45', tz: 'Asia/Tokyo' },
    from: { id: 'a', name: 'Sydney (SYD)' }, to: { id: 'b', name: 'Tokyo Narita (NRT)' }, attachments: [],
  };
  const stay: Item = {
    id: 'h1', tripId: 't', kind: 'hotel', title: 'Hotel Sakura', ref: 'HX1',
    start: { local: '2027-03-12T15:00', tz: 'Asia/Tokyo' }, end: { local: '2027-03-15T11:00', tz: 'Asia/Tokyo' },
    place: { id: 'p', name: 'Hotel Sakura', address: '1-2-3 Shinjuku, Tokyo' }, attachments: [],
  };
  const dinner = itemFromPlan({ ...newPlanForm('2027-03-13', 'Asia/Tokyo', 'food'), title: 'Ramen Street', start: '19:00', end: '20:30', place: 'Tokyo Station', notes: 'Bring cash' }, 't')!;
  const free = itemFromPlan({ ...newPlanForm('2027-03-14', 'Asia/Tokyo', 'free'), title: 'Shopping' }, 't')!;
  const trip: Trip = { id: 't', name: 'Japan', startDate: '2027-03-12', endDate: '2027-03-15', homeTz: 'Australia/Sydney', items: [flight, stay, dinner, free], createdAt: '2027-01-01' };
  const ics = buildIcs(trip, words as never, { includeCodes: true, includeNotes: true, now: Date.UTC(2027, 0, 1) });
  const back = parseItinerary(ics.text, { now: '2027-01-01', fallbackTz: 'Europe/Paris' });
  assert.equal(back.length, 4);
  const byTitle = Object.fromEntries(back.map((p) => [p.draft.title, p]));
  for (const orig of trip.items) {
    const p = byTitle[orig.title];
    assert.ok(p, orig.title);
    assert.equal(p.check, false, orig.title);
    assert.equal(p.draft.kind, orig.kind, orig.title);
    assert.equal(`${p.draft.startDate}T${p.draft.startTime}`, orig.start.local, orig.title);
    assert.equal(p.draft.startTz, orig.start.tz, orig.title);
    if (orig.end) {
      assert.equal(`${p.draft.endDate}T${p.draft.endTime}`, orig.end.local, orig.title);
      assert.equal(p.draft.endTz, orig.end.tz, orig.title);
    }
    assert.equal(p.draft.ref, orig.ref ?? '', orig.title);
    assert.equal(p.look, orig.look, orig.title);
    assert.deepEqual(validateItem(p.draft), [], orig.title);
  }
  assert.equal(byTitle.QF25.draft.fromName, 'Sydney (SYD)');
  assert.equal(byTitle.QF25.draft.toName, 'Tokyo Narita (NRT)');
  assert.equal(byTitle.QF25.draft.number, 'QF25');
  assert.equal(byTitle['Hotel Sakura'].draft.address, '1-2-3 Shinjuku, Tokyo');
  assert.equal(byTitle['Ramen Street'].draft.notes, 'Bring cash');
  // Codes left out on export stay out on import.
  const noCodes = parseItinerary(buildIcs(trip, words as never, { includeCodes: false }).text, { now: '2027-01-01', fallbackTz: 'Europe/Paris' });
  assert.ok(noCodes.every((p) => !p.draft.ref));
});

test('share: a Satchel trip file round-trips the plans, plan types and codes', async () => {
  const { buildTripFile, importTripFile, parseTripFileText } = await import('./tripfile.ts');
  const { itemFromPlan, newPlanForm } = await import('./planform.ts');
  const tour = itemFromPlan({ ...newPlanForm('2027-03-13', 'Asia/Tokyo', 'tour'), title: 'Asakusa walk', code: 'TR9', start: '10:00', end: '12:00' }, 't')!;
  const trip: Trip = { id: 't', name: 'Japan', startDate: '2027-03-12', endDate: '2027-03-15', homeTz: 'Australia/Sydney', items: [tour], createdAt: '2027-01-01' };
  const parsed = parseTripFileText(JSON.stringify(buildTripFile(trip, {}).file));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  let n = 0;
  const back = importTripFile(parsed.file, (p) => `${p}_${++n}`).trip.items[0];
  assert.equal(back.title, 'Asakusa walk');
  assert.equal(back.look, 'tour');
  assert.equal(back.ref, 'TR9');
  assert.deepEqual(back.start, tour.start);
  assert.deepEqual(back.end, tour.end);
});

test('share: the readable text carries every plan of the day, codes only when asked', async () => {
  const { itineraryText } = await import('./itinerarytext.ts');
  const { itemFromPlan, newPlanForm } = await import('./planform.ts');
  const tour = itemFromPlan({ ...newPlanForm('2027-03-13', 'Asia/Tokyo', 'tour'), title: 'Asakusa walk', code: 'TR9' }, 't')!;
  const trip: Trip = { id: 't', name: 'Japan', startDate: '2027-03-12', endDate: '2027-03-15', homeTz: 'Australia/Sydney', items: [tour], createdAt: '2027-01-01' };
  const words = { kind: (k: string) => k, dates: (r: string) => r, dayHeading: (d: string) => d, zoneTime: (t: string) => t, noTime: '', arrives: (t: string) => t, code: (r: string) => `Code ${r}`, nothing: 'none' };
  assert.match(itineraryText(trip, words as never, { includeCodes: true }), /Asakusa walk[\s\S]*Code TR9/);
  assert.doesNotMatch(itineraryText(trip, words as never, { includeCodes: false }), /TR9/);
});
