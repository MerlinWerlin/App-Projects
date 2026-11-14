// T170 itinerary import: calendar files, timetable text and confirmations. Every name and code below is invented.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  alreadyPlanned,
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
