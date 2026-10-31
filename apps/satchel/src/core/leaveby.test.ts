import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  airportCountdown,
  airportDraft,
  airportFromDraft,
  airportPlan,
  badClock,
  DEFAULT_AIRPORT_PREFS,
  flightToday,
  guessScope,
  normaliseAirportPrefs,
  readAirport,
  stepMinutes,
  withAirport,
  type AirportPrefs,
} from './leaveby.ts';
import type { Item, Trip } from './model.ts';
import { buildTripFile, importTripFile, parseTripFile, parseTripFileText } from './tripfile.ts';
import { draftFromItem, itemFromDraft } from './trips.ts';
import { toUtc } from './tz.ts';

const prefs = (p: Partial<AirportPrefs> = {}): AirportPrefs => ({ ...DEFAULT_AIRPORT_PREFS, travelMin: 60, ...p });
const flight = (start: string, tz: string, endTz: string, airport?: Item['airport'], extra: Partial<Item> = {}): Item => ({
  id: 'f1',
  tripId: 't1',
  kind: 'flight',
  title: 'Test flight',
  start: { local: start, tz },
  end: { local: start, tz: endTz },
  attachments: [],
  ...(airport ? { airport } : {}),
  ...extra,
});
const at = (local: string, tz: string) => toUtc({ local, tz });

test('domestic and international defaults: arrive-by and leave-by on the departure airport clock', () => {
  const dom = airportPlan(flight('2026-11-20T09:00', 'Australia/Sydney', 'Australia/Melbourne'), prefs({ travelMin: 45 }));
  assert.ok(dom);
  assert.equal(dom.scope, 'domestic');
  assert.equal(dom.scopeGuessed, true);
  assert.equal(dom.bufferMin, 90);
  assert.equal(dom.bufferDefault, true);
  assert.equal(dom.arriveBy.local, '2026-11-20T07:30');
  assert.equal(dom.leaveBy?.local, '2026-11-20T06:45');
  assert.equal(dom.tz, 'Australia/Sydney');

  const intl = airportPlan(flight('2026-11-20T21:00', 'Australia/Sydney', 'Asia/Tokyo'), prefs());
  assert.ok(intl);
  assert.equal(intl.scope, 'international');
  assert.equal(intl.bufferMin, 180);
  assert.equal(intl.arriveBy.local, '2026-11-20T18:00');
  assert.equal(intl.leaveBy?.local, '2026-11-20T17:00');
  assert.deepEqual(intl.warnings, []);
});

test('the times stay on the departure zone: a Tokyo departure reads in Tokyo, whatever zone the trip ends in', () => {
  const p = airportPlan(flight('2026-11-09T09:00', 'Asia/Tokyo', 'Australia/Sydney'), prefs({ travelMin: 30 }));
  assert.ok(p);
  assert.equal(p.leaveBy?.local, '2026-11-09T05:30');
  assert.equal(p.leaveBy?.utc, at('2026-11-09T05:30', 'Asia/Tokyo'));
});

test('scope guess: same country domestic, different or unknown international; the traveller’s choice wins', () => {
  assert.equal(guessScope(flight('2026-11-20T09:00', 'America/New_York', 'America/Chicago')), 'domestic');
  assert.equal(guessScope(flight('2026-11-20T09:00', 'Europe/London', 'Asia/Tokyo')), 'international');
  assert.equal(guessScope({ start: { local: '2026-11-20T09:00', tz: 'Europe/London' } }), 'international');
  assert.equal(guessScope(flight('2026-11-20T09:00', 'Pacific/Nowhere_Made_Up', 'Pacific/Nowhere_Made_Up')), 'international');
  const chosen = airportPlan(flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo', { scope: 'domestic' }), prefs());
  assert.equal(chosen?.scope, 'domestic');
  assert.equal(chosen?.scopeGuessed, false);
  assert.equal(chosen?.bufferMin, 90);
});

test('per-flight buffer and travel time override the Settings defaults', () => {
  const p = airportPlan(flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo', { bufferMin: 120, travelMin: 20 }), prefs({ travelMin: 90, internationalMin: 240 }));
  assert.ok(p);
  assert.equal(p.bufferMin, 120);
  assert.equal(p.bufferDefault, false);
  assert.equal(p.travelMin, 20);
  assert.equal(p.travelDefault, false);
  assert.equal(p.leaveBy?.local, '2026-11-20T06:40');
  // A buffer of 0 is the traveller's choice, not "not set".
  assert.equal(airportPlan(flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo', { bufferMin: 0, travelMin: 0 }), prefs())?.leaveBy?.local, '2026-11-20T09:00');
});

test('daylight saving: spring forward between leaving and take-off counts real elapsed time', () => {
  // New York jumps 02:00 -> 03:00 on 8 Mar 2026. 150 minutes before 04:00 EDT is 00:30 EST, not 01:30.
  const p = airportPlan(flight('2026-03-08T04:00', 'America/New_York', 'America/Chicago'), prefs({ travelMin: 60 }));
  assert.ok(p);
  assert.equal(p.arriveBy.local, '2026-03-08T01:30');
  assert.equal(p.leaveBy?.local, '2026-03-08T00:30');
  assert.equal(p.departure.utc - (p.leaveBy?.utc ?? 0), 150 * 60_000);
});

test('daylight saving: fall back means the first 01:30 when 01:00-02:00 happens twice', () => {
  // New York goes 02:00 -> 01:00 on 1 Nov 2026. 150 minutes before 03:00 EST is the first 01:30 (EDT).
  const p = airportPlan(flight('2026-11-01T03:00', 'America/New_York', 'America/Chicago'), prefs({ travelMin: 60 }));
  assert.ok(p);
  assert.equal(p.leaveBy?.local, '2026-11-01T01:30');
  assert.equal(p.leaveBy?.utc, Date.UTC(2026, 10, 1, 5, 30));
  // London clocks back on 25 Oct 2026: 180 + 60 minutes before 02:30 GMT is 23:30 BST the evening before.
  const l = airportPlan(flight('2026-10-25T02:30', 'Europe/London', 'Asia/Tokyo'), prefs({ travelMin: 60 }));
  assert.equal(l?.leaveBy?.local, '2026-10-24T23:30');
});

test('a boarding time that daylight saving skips is read as the clock would show, and flagged', () => {
  const p = airportPlan(flight('2026-03-08T04:30', 'America/New_York', 'America/Chicago', { boarding: '02:45' }), prefs());
  assert.ok(p);
  assert.ok(p.warnings.includes('boardingSkipped'));
  assert.equal(p.boarding?.local, '2026-03-08T03:45');
  assert.ok(!p.warnings.includes('boardingAfterDeparture'));
});

test('crossing midnight: leave-by and boarding fall on the evening before an early departure', () => {
  const p = airportPlan(flight('2026-11-21T01:00', 'Australia/Sydney', 'Asia/Tokyo', { boarding: '00:20', bagDrop: '23:50' }), prefs({ travelMin: 60 }));
  assert.ok(p);
  assert.equal(p.leaveBy?.local, '2026-11-20T21:00');
  assert.equal(p.boarding?.local, '2026-11-21T00:20');
  assert.equal(p.bagDrop?.local, '2026-11-20T23:50');
  assert.deepEqual(p.warnings, []);
  const q = airportPlan(flight('2026-11-21T00:20', 'Australia/Sydney', 'Asia/Tokyo', { boarding: '23:40' }), prefs());
  assert.equal(q?.boarding?.local, '2026-11-20T23:40');
  // A late-evening departure with boarding typed just after midnight: nearest is the next day, so it is flagged.
  const r = airportPlan(flight('2026-11-20T23:50', 'Australia/Sydney', 'Asia/Tokyo', { boarding: '00:10' }), prefs());
  assert.equal(r?.boarding?.local, '2026-11-21T00:10');
  assert.ok(r?.warnings.includes('boardingAfterDeparture'));
});

test('missing fields: no travel time gives arrive-by only; no airport fields still plans; other kinds and bad zones give null', () => {
  const p = airportPlan(flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo'), DEFAULT_AIRPORT_PREFS);
  assert.ok(p);
  assert.equal(p.travelMin, null);
  assert.equal(p.leaveBy, null);
  assert.equal(p.arriveBy.local, '2026-11-20T06:00');
  assert.equal(p.boarding, null);
  assert.equal(p.bagDrop, null);
  assert.equal(airportPlan({ ...flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo'), kind: 'train' }, prefs()), null);
  assert.equal(airportPlan(flight('2026-11-20T09:00', 'Mars/Olympus', 'Asia/Tokyo'), prefs()), null);
  assert.equal(airportPlan(flight('2026-11-20 09:00', 'Australia/Sydney', 'Asia/Tokyo'), prefs()), null);
  // No end at all (a flight saved without arrival): still a plan, scope guessed international.
  const noEnd = airportPlan({ ...flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo'), end: undefined }, prefs());
  assert.equal(noEnd?.scope, 'international');
});

test('damaged stored values are ignored, not trusted', () => {
  const junk = { terminal: 42, gate: '  ', boarding: '25:00', bagDrop: '9:5', scope: 'galactic', bufferMin: -10, travelMin: 'soon' };
  const p = airportPlan(flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo', junk as never), prefs());
  assert.ok(p);
  assert.equal(p.boarding, null);
  assert.equal(p.bagDrop, null);
  assert.equal(p.scopeGuessed, true);
  assert.equal(p.bufferMin, 180);
  assert.equal(p.travelMin, 60);
  assert.equal(readAirport(junk), undefined);
  assert.equal(readAirport('T1'), undefined);
  assert.equal(readAirport(null), undefined);
  assert.equal(airportPlan(flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo', 'oops' as never), prefs())?.bufferMin, 180);
});

test('validation: boarding at or after departure is flagged and left out of the countdown', () => {
  const p = airportPlan(flight('2026-11-20T10:00', 'Australia/Sydney', 'Asia/Tokyo', { boarding: '10:30' }), prefs());
  assert.ok(p);
  assert.deepEqual(p.warnings, ['boardingAfterDeparture']);
  const c = airportCountdown(p, at('2026-11-20T09:50', 'Australia/Sydney'));
  assert.equal(c?.step, 'departure');
  assert.deepEqual(airportPlan(flight('2026-11-20T10:00', 'Australia/Sydney', 'Asia/Tokyo', { boarding: '10:00' }), prefs())?.warnings, ['boardingAfterDeparture']);
});

test('validation: bag drop after boarding warns; after departure warns once and never moves arrive-by later', () => {
  const p = airportPlan(flight('2026-11-20T10:00', 'Australia/Sydney', 'Asia/Tokyo', { boarding: '09:20', bagDrop: '09:40' }), prefs());
  assert.deepEqual(p?.warnings, ['bagDropAfterBoarding']);
  const q = airportPlan(flight('2026-11-20T10:00', 'Australia/Sydney', 'Asia/Tokyo', { boarding: '09:20', bagDrop: '10:30' }), prefs());
  assert.deepEqual(q?.warnings, ['bagDropAfterDeparture']);
  assert.equal(q?.arriveBy.local, '2026-11-20T07:00');
  assert.equal(q?.arriveByBagDrop, false);
});

test('bag drop closing before the buffer time brings arrive-by (and leave-by) earlier', () => {
  const p = airportPlan(flight('2026-11-20T10:00', 'Australia/Sydney', 'Asia/Tokyo', { bufferMin: 30, bagDrop: '09:00' }), prefs({ travelMin: 40 }));
  assert.ok(p);
  assert.equal(p.arriveByBagDrop, true);
  assert.equal(p.arriveBy.local, '2026-11-20T09:00');
  assert.equal(p.leaveBy?.local, '2026-11-20T08:20');
  // Bag drop later than the buffer time: the buffer decides.
  assert.equal(airportPlan(flight('2026-11-20T10:00', 'Australia/Sydney', 'Asia/Tokyo', { bagDrop: '09:00' }), prefs())?.arriveByBagDrop, false);
});

test('countdown walks leave, bag drop, boarding, departure, then stops once the flight has gone', () => {
  const tz = 'Australia/Sydney';
  const p = airportPlan(flight('2026-11-20T10:00', tz, 'Asia/Tokyo', { boarding: '09:20', bagDrop: '09:00' }), prefs({ travelMin: 60 }));
  assert.ok(p);
  assert.equal(p.leaveBy?.local, '2026-11-20T06:00');
  const c1 = airportCountdown(p, at('2026-11-20T04:50', tz));
  assert.deepEqual([c1?.step, c1?.minutes, c1?.leavePassed], ['leave', 70, false]);
  const c2 = airportCountdown(p, at('2026-11-20T06:30', tz));
  assert.deepEqual([c2?.step, c2?.minutes, c2?.leavePassed], ['bagDrop', 150, true]);
  assert.equal(airportCountdown(p, at('2026-11-20T09:05', tz))?.step, 'boarding');
  assert.equal(airportCountdown(p, at('2026-11-20T09:30', tz))?.step, 'departure');
  // Partial minutes round up: 30 seconds before departure still says 1 minute.
  assert.equal(airportCountdown(p, at('2026-11-20T10:00', tz) - 30_000)?.minutes, 1);
  assert.equal(airportCountdown(p, at('2026-11-20T10:00', tz)), null);
});

test('Your day: the flight leaving today, or whose leave-by is today; gone flights drop off', () => {
  const tz = 'Australia/Sydney';
  const early = { ...flight('2026-11-21T01:00', tz, 'Asia/Tokyo'), id: 'early' };
  const later = { ...flight('2026-11-21T15:00', tz, 'Asia/Tokyo'), id: 'later' };
  const items = [later, early];
  // 20 Nov evening: leave-by 21:00 for the 01:00 flight is today.
  assert.equal(flightToday(items, tz, '2026-11-20', at('2026-11-20T18:00', tz), prefs())?.item.id, 'early');
  // Without a travel time, a flight just after midnight belongs to its own day only.
  assert.equal(flightToday(items, tz, '2026-11-20', at('2026-11-20T18:00', tz), DEFAULT_AIRPORT_PREFS), null);
  // 21 Nov after the early one left: the afternoon flight.
  assert.equal(flightToday(items, tz, '2026-11-21', at('2026-11-21T02:00', tz), prefs())?.item.id, 'later');
  assert.equal(flightToday(items, tz, '2026-11-21', at('2026-11-21T16:00', tz), prefs()), null);
  assert.equal(flightToday(items, 'Not/AZone', '2026-11-21', at('2026-11-21T02:00', tz), prefs()), null);
  // "Today" is read in the traveller's zone: in Tokyo (2h behind Sydney in November) the 01:00 Sydney flight is 23:00 on the 20th.
  assert.equal(flightToday([early], 'Asia/Tokyo', '2026-11-20', at('2026-11-20T20:00', 'Asia/Tokyo'), DEFAULT_AIRPORT_PREFS)?.item.id, 'early');
});

test('Settings defaults: stored values are normalised; steppers snap and stay in range', () => {
  assert.deepEqual(normaliseAirportPrefs(undefined), DEFAULT_AIRPORT_PREFS);
  assert.deepEqual(normaliseAirportPrefs({ travelMin: 40, domesticMin: 'x', internationalMin: 9999 }), { travelMin: 40, domesticMin: 90, internationalMin: 180 });
  assert.equal(normaliseAirportPrefs({ travelMin: -5 }).travelMin, null);
  assert.equal(stepMinutes(90, 1, 15, 360), 105);
  assert.equal(stepMinutes(92, 1, 15, 360), 105);
  assert.equal(stepMinutes(92, -1, 15, 360), 90);
  assert.equal(stepMinutes(0, -1, 15, 360), 0);
  assert.equal(stepMinutes(360, 1, 15, 360), 360);
});

test('form draft: round trip, blank means not set, unknown keys kept, other kinds drop the fields', () => {
  const info = { terminal: 'T1', gate: '52B', boarding: '08:15', bagDrop: '07:45', scope: 'international' as const, bufferMin: 150, travelMin: 35 };
  const d = airportDraft(info);
  assert.deepEqual(d, { terminal: 'T1', gate: '52B', boarding: '08:15', bagDrop: '07:45', scope: 'international', bufferMin: '150', travelMin: '35' });
  assert.deepEqual(airportFromDraft(d), info);
  const blank = airportDraft(undefined);
  assert.equal(airportFromDraft(blank), undefined);
  assert.deepEqual(airportFromDraft({ ...blank, gate: ' 12 ' }, { lounge: 'Level 3' }), { lounge: 'Level 3', gate: '12' });
  const f = flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo');
  assert.deepEqual(withAirport(f, d, info).airport, info);
  assert.equal('airport' in withAirport({ ...f, airport: info }, blank, info), false);
  assert.equal('airport' in withAirport({ ...f, kind: 'hotel' }, d, info), false);
  assert.equal(badClock('8.15'), true);
  assert.equal(badClock('08:15'), false);
  assert.equal(badClock(''), false);
});

test('item edit keeps the airport fields: draft -> item -> draft does not drop them', () => {
  const prev = flight('2026-11-20T09:00', 'Australia/Sydney', 'Asia/Tokyo', { terminal: 'T1', boarding: '08:15', bufferMin: 150 });
  const d = draftFromItem(prev);
  const a = airportDraft(prev.airport);
  const saved = withAirport(itemFromDraft(d, prev.tripId, prev), a, prev.airport);
  assert.deepEqual(saved.airport, prev.airport);
  assert.equal(saved.id, prev.id);
});

const trip = (items: Item[]): Trip => ({ id: 't1', name: 'Airport day', startDate: '2026-11-20', endDate: '2026-11-22', homeTz: 'Australia/Sydney', items, createdAt: '2026-10-31T00:00:00Z' });
let n = 0;
const ids = (p: string) => `${p}_${++n}`;

test('trip files: airport fields round-trip, unknown keys survive, and files without them load as before', () => {
  const info = { terminal: 'T1', gate: '52B', boarding: '23:40', bagDrop: '23:00', scope: 'international' as const, bufferMin: 150, travelMin: 35 };
  const withNew = { ...flight('2026-11-21T00:20', 'Australia/Sydney', 'Asia/Tokyo', { ...info, lounge: 'Level 3' } as never), futureField: { x: 1 } } as Item;
  const plain = { ...flight('2026-11-22T09:00', 'Australia/Sydney', 'Asia/Tokyo'), id: 'f2' };
  const { file } = buildTripFile(trip([withNew, plain]), {}, { now: '2026-10-31T00:00:00Z' });
  const parsed = parseTripFileText(JSON.stringify(file));
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, ids, '2026-10-31T00:00:00Z');
  const [a, b] = imp.trip.items;
  assert.deepEqual(a.airport, { ...info, lounge: 'Level 3' });
  assert.deepEqual((a as Item & { futureField?: unknown }).futureField, { x: 1 });
  assert.equal('airport' in b, false);
  assert.equal(airportPlan(a, prefs())?.boarding?.local, '2026-11-20T23:40');
});

test('trip files: a damaged airport value is dropped, not a reason to refuse the trip', () => {
  const { file } = buildTripFile(trip([flight('2026-11-21T09:00', 'Australia/Sydney', 'Asia/Tokyo')]), {}, { now: '2026-10-31T00:00:00Z' });
  const raw = JSON.parse(JSON.stringify(file));
  raw.items[0].airport = 'gate 5';
  const r1 = parseTripFile(raw);
  assert.ok(r1.ok);
  assert.equal('airport' in r1.file.items[0], false);
  raw.items[0].airport = { gate: '5', boarding: 'late', bufferMin: 'lots' };
  const r2 = parseTripFile(raw);
  assert.ok(r2.ok);
  assert.deepEqual(r2.file.items[0].airport, { gate: '5' });
});
