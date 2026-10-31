import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityCatalog, CityMap } from './citymaps.ts';
import { demoTrip } from './demo.ts';
import type { EmergencyCard, Item, Trip, TravelDoc } from './model.ts';
import type { PackList } from './packing.ts';
import {
  CHECK_ORDER,
  emergencyCheck,
  homeToday,
  hotelsCheck,
  hoursUntil,
  leavingSoon,
  mapCheck,
  nextLeaving,
  packingCheck,
  passportCheck,
  readiness,
  showReadiness,
  toFix,
  tripEnd,
  visaCheck,
  type ReadinessInput,
} from './readiness.ts';
import { toUtc } from './tz.ts';

const doc = (kind: TravelDoc['kind'], expires?: string, id = `${kind}-${expires ?? 'x'}`): TravelDoc => ({ id, kind, label: 'P1234567 secret', expires, attachments: [] });
const city = (id: string, name: string, bbox: [number, number, number, number]): CityMap => ({
  id,
  name,
  country: 'JP',
  bbox,
  center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
  minzoom: 10,
  maxzoom: 15,
  file: `${id}.tar`,
  bytes: 1000,
});
const TOKYO = city('tokyo', 'Tokyo', [139.5, 35.5, 140.0, 35.9]);
const KYOTO = city('kyoto', 'Kyoto', [135.6, 34.9, 135.9, 35.1]);
const PARIS = city('paris', 'Paris', [2.2, 48.8, 2.5, 48.95]);
const catalog = (cities: CityMap[]): CityCatalog => ({ version: 1, release: 'satchel-maps-v1', built: '2026-10-01', attribution: '© OpenStreetMap contributors', cities });

// Demo trip 3–11 Nov 2026 (Sydney home), "now" is 31 Oct 2026 noon in Sydney.
const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
const NOW = toUtc({ local: '2026-10-31T12:00', tz: 'Australia/Sydney' });
const full: EmergencyCard = { insurer: 'Example Cover', policy: 'POL-1', insurerPhone: '+61 2 0000 0000', contacts: [{ id: 'c1', name: 'Sam', phone: '+61 400 000 000' }] };
const packed = (done: boolean[]): PackList => ({ tripId: trip.id, items: done.map((d, i) => ({ id: `p${i}`, label: `Item ${i}`, done: d })) });
const base = (over: Partial<ReadinessInput> = {}): ReadinessInput => ({
  trip,
  docs: [doc('passport', '2030-01-01'), doc('visa', '2027-01-01')],
  packing: packed([true, true]),
  card: full,
  catalog: catalog([TOKYO, KYOTO]),
  installed: [TOKYO],
  now: NOW,
  ...over,
});

// ------------------------------------------------------------------ passport

test('passport: valid well past six months after the trip passes', () => {
  const c = passportCheck([doc('passport', '2030-01-01')], '2026-11-10', '2026-10-31');
  assert.equal(c.status, 'pass');
  assert.equal(c.fix, null);
});

test('passport: under six months after the trip end warns (the common 6-month rule)', () => {
  const c = passportCheck([doc('passport', '2027-03-01')], '2026-11-10', '2026-10-31');
  assert.equal(c.status, 'warn');
  assert.equal(c.reason, 'sixMonths');
  assert.equal(c.until, '2027-05-10');
  assert.deepEqual(c.fix, { kind: 'vault' });
});

test('passport: exactly six months after the end passes; one day short warns', () => {
  assert.equal(passportCheck([doc('passport', '2027-05-10')], '2026-11-10', '2026-10-31').status, 'pass');
  assert.equal(passportCheck([doc('passport', '2027-05-09')], '2026-11-10', '2026-10-31').status, 'warn');
});

test('passport: expired, or running out during the trip, fails', () => {
  const gone = passportCheck([doc('passport', '2026-10-01')], '2026-11-10', '2026-10-31');
  assert.equal(gone.status, 'fail');
  assert.equal(gone.reason, 'expired');
  const during = passportCheck([doc('passport', '2026-11-05')], '2026-11-10', '2026-10-31');
  assert.equal(during.status, 'fail');
  assert.equal(during.reason, 'duringTrip');
});

test('passport: none is missing, no expiry date warns, and the best of several counts', () => {
  assert.equal(passportCheck([doc('visa', '2030-01-01')], '2026-11-10', '2026-10-31').status, 'missing');
  assert.equal(passportCheck([doc('passport')], '2026-11-10', '2026-10-31').reason, 'noExpiry');
  assert.equal(passportCheck([doc('passport', '2026-01-01', 'old'), doc('passport', '2031-01-01', 'new')], '2026-11-10', '2026-10-31').status, 'pass');
});

// ------------------------------------------------------------------ visa

test('visa: none in the vault is "not checked", never a fail', () => {
  const c = visaCheck([doc('passport', '2030-01-01')], '2026-11-10');
  assert.equal(c.status, 'unknown');
  assert.equal(c.reason, 'notNoted');
  assert.deepEqual(c.fix, { kind: 'vault' });
});

test('visa: one covering the trip (or undated) passes; one ending before the trip ends warns', () => {
  assert.equal(visaCheck([doc('visa', '2026-11-10')], '2026-11-10').status, 'pass');
  assert.equal(visaCheck([doc('visa')], '2026-11-10').status, 'pass');
  const short = visaCheck([doc('visa', '2026-11-09')], '2026-11-10');
  assert.equal(short.status, 'warn');
  assert.equal(short.reason, 'expired');
});

// ------------------------------------------------------------------ packing

test('packing: no list or an empty one is missing, part-ticked warns, all ticked passes', () => {
  assert.equal(packingCheck('t', null).status, 'missing');
  assert.equal(packingCheck('t', { tripId: 't', items: [] }).reason, 'empty');
  const part = packingCheck('t', packed([true, false, false]));
  assert.equal(part.status, 'warn');
  assert.equal(part.done, 1);
  assert.equal(part.total, 3);
  assert.deepEqual(part.fix, { kind: 'packing', tripId: 't' });
  assert.equal(packingCheck('t', packed([true, true])).status, 'pass');
});

// ------------------------------------------------------------------ emergency

test('emergency: empty card is missing, partly filled warns, insurance plus a contact passes', () => {
  assert.equal(emergencyCheck(null).status, 'missing');
  assert.equal(emergencyCheck({ contacts: [], medicalNotes: 'Allergic to penicillin' }).status, 'missing');
  const part = emergencyCheck({ contacts: [{ id: 'c', name: 'Sam', phone: '0400 000 000' }] });
  assert.equal(part.status, 'warn');
  assert.deepEqual(part.fix, { kind: 'emergency' });
  assert.equal(emergencyCheck(full).status, 'pass');
});

// ------------------------------------------------------------------ hotels

const strip = (i: Item): Item => (i.kind === 'hotel' && i.place ? { ...i, place: { ...i.place, address: undefined, localAddress: ' ' } } : i);

test('hotels: every hotel with an address passes; some warns; none is missing and the fix opens the first without', () => {
  assert.equal(hotelsCheck(trip).status, 'pass');
  const none = hotelsCheck({ items: trip.items.map(strip) });
  assert.equal(none.status, 'missing');
  assert.deepEqual(none.fix, { kind: 'address', itemId: 'demo-h1' });
  const some = hotelsCheck({ items: trip.items.map((i) => (i.id === 'demo-h2' ? strip(i) : i)) });
  assert.equal(some.status, 'warn');
  assert.equal(some.done, 1);
  assert.equal(some.total, 2);
  assert.deepEqual(some.fix, { kind: 'address', itemId: 'demo-h2' });
});

test('hotels: a trip without hotel bookings is not judged', () => {
  const c = hotelsCheck({ items: trip.items.filter((i) => i.kind !== 'hotel') });
  assert.equal(c.status, 'unknown');
  assert.equal(c.fix, null);
});

// ------------------------------------------------------------------ map

test('map: a downloaded city covering the hotels passes', () => {
  const c = mapCheck(trip, catalog([TOKYO, KYOTO]), [KYOTO]);
  assert.equal(c.status, 'pass');
  assert.equal(c.city, 'Kyoto');
});

test('map: listed but not downloaded is missing, with a fix to the map tab', () => {
  const c = mapCheck(trip, catalog([PARIS, TOKYO]), []);
  assert.equal(c.status, 'missing');
  assert.equal(c.reason, 'notDownloaded');
  assert.equal(c.city, 'Tokyo');
  assert.deepEqual(c.fix, { kind: 'map', tripId: trip.id });
});

test('map: no catalog on the phone says so (unknown), never a fail; a downloaded city still passes', () => {
  const c = mapCheck(trip, null, []);
  assert.equal(c.status, 'unknown');
  assert.equal(c.reason, 'catalogUnavailable');
  assert.equal(c.city, 'Tokyo');
  assert.equal(mapCheck(trip, null, [TOKYO]).status, 'pass');
});

test('map: a destination the catalog does not cover is unknown, without a fix', () => {
  const c = mapCheck(trip, catalog([PARIS]), []);
  assert.equal(c.reason, 'notInCatalog');
  assert.equal(c.status, 'unknown');
  assert.equal(c.fix, null);
});

test('map: without coordinates the destination zone city name matches the catalog', () => {
  const bare: Trip = { ...trip, items: trip.items.map((i) => ({ ...i, place: i.place ? { ...i.place, lat: undefined, lon: undefined } : undefined, to: undefined })) };
  assert.equal(mapCheck(bare, catalog([TOKYO]), []).reason, 'notDownloaded');
  assert.equal(mapCheck(bare, catalog([TOKYO]), [TOKYO]).status, 'pass');
});

// ------------------------------------------------------------------ whole card

test('all good: ready, every judged check passes', () => {
  const r = readiness(base());
  assert.deepEqual(
    r.checks.map((c) => c.id),
    [...CHECK_ORDER],
  );
  assert.equal(r.overall, 'ready');
  assert.equal(r.passed, 6);
  assert.equal(r.scored, 6);
  assert.equal(r.score, 1);
  assert.equal(r.tripEnd, '2026-11-11');
  assert.deepEqual(toFix(r), []);
});

test('unknown rows are left out of the score; warnings make it "almost"; fails and missing make it "not yet"', () => {
  const almost = readiness(base({ docs: [doc('passport', '2027-03-01')], packing: packed([true, false]) }));
  assert.equal(almost.overall, 'almost');
  assert.equal(almost.scored, 5);
  assert.equal(almost.passed, 3);
  const notYet = readiness(base({ docs: [], catalog: null, installed: [] }));
  assert.equal(notYet.overall, 'notYet');
  assert.equal(notYet.scored, 4);
  assert.deepEqual(
    toFix(readiness(base({ docs: [doc('passport', '2026-01-01')], card: null, packing: packed([false]) }))).map((c) => c.id),
    ['passport', 'emergency', 'packing'],
  );
});

test('the card never carries a document label or number', () => {
  const r = readiness(base({ docs: [doc('passport', '2027-03-01'), doc('visa', '2026-11-01')] }));
  assert.ok(!JSON.stringify(r).includes('P1234567'));
  assert.ok(!JSON.stringify(r).includes('2027-03-01'), 'the expiry itself is not shown, only the date it must last until');
});

test('empty trip: no bookings, no dates beyond start, nothing crashes', () => {
  const empty: Trip = { id: 'e', name: 'Somewhere', startDate: '2026-12-01', endDate: '2026-12-01', homeTz: 'Australia/Sydney', items: [], createdAt: '2026-10-01T00:00:00Z' };
  const r = readiness({ trip: empty, docs: [], packing: null, card: null, catalog: null, installed: [], now: NOW });
  const by = Object.fromEntries(r.checks.map((c) => [c.id, c]));
  assert.equal(by.passport.status, 'missing');
  assert.equal(by.visa.status, 'unknown');
  assert.equal(by.packing.status, 'missing');
  assert.equal(by.emergency.status, 'missing');
  assert.equal(by.hotels.status, 'unknown');
  assert.equal(by.map.reason, 'noDestination');
  assert.equal(r.scored, 3);
  assert.equal(r.passed, 0);
  assert.equal(r.score, 0);
  assert.equal(r.overall, 'notYet');
});

test('trip with no end date: the last booking day is the end, else the start date', () => {
  const noEnd: Trip = { ...trip, endDate: '' };
  assert.equal(tripEnd(noEnd), '2026-11-11');
  assert.equal(tripEnd({ ...noEnd, items: [] }), '2026-11-03');
  assert.equal(tripEnd({ startDate: '', endDate: '', items: [] }), null);
  // a passport that lasts to the last booking but not 6 months past it warns against that day
  const r = readiness(base({ trip: noEnd, docs: [doc('passport', '2027-05-01')] }));
  assert.equal(r.tripEnd, '2026-11-11');
  assert.equal(r.checks[0].reason, 'sixMonths');
  const bare = readiness({ trip: { ...noEnd, startDate: '', items: [] }, docs: [doc('passport', '2030-01-01')], packing: null, card: null, catalog: null, installed: [], now: NOW });
  assert.equal(bare.tripEnd, bare.today, 'no dates at all: checked against today');
});

// ------------------------------------------------------------------ time zones

test('today is the home-zone date: the same instant is a day apart in Sydney and Los Angeles', () => {
  const at = Date.UTC(2026, 10, 1, 14, 0); // 1 Nov 14:00 UTC = 2 Nov 01:00 Sydney, 1 Nov 07:00 Los Angeles
  assert.equal(homeToday({ homeTz: 'Australia/Sydney' }, at), '2026-11-02');
  assert.equal(homeToday({ homeTz: 'America/Los_Angeles' }, at), '2026-11-01');
  assert.equal(homeToday({ homeTz: 'Not/AZone' }, at), '2026-11-01', 'an unreadable home zone falls back to UTC');
  // a passport expiring on 1 Nov: already expired for a Sydney traveller, still (just) valid in Los Angeles
  const t: Trip = { ...trip, startDate: '2026-11-01', endDate: '2026-11-01' };
  const p = [doc('passport', '2026-11-01')];
  const syd = readiness(base({ trip: { ...t, homeTz: 'Australia/Sydney' }, docs: p, now: at }));
  const lax = readiness(base({ trip: { ...t, homeTz: 'America/Los_Angeles' }, docs: p, now: at }));
  assert.equal(syd.checks[0].reason, 'expired');
  assert.equal(lax.checks[0].reason, 'sixMonths');
});

test('leaving soon: 0–3 days out in the home zone, from the same instant in two zones', () => {
  // the demo starts 3 Nov; 30 Oct 14:00 UTC is 31 Oct in Sydney (3 days out) but 30 Oct in Los Angeles (4 days)
  const at = Date.UTC(2026, 9, 30, 14, 0);
  assert.equal(leavingSoon(trip, at)?.days, 3);
  assert.equal(leavingSoon({ ...trip, homeTz: 'America/Los_Angeles' }, at), null);
  assert.equal(leavingSoon(trip, toUtc({ local: '2026-10-29T12:00', tz: 'Australia/Sydney' })), null, '5 days out');
  assert.equal(leavingSoon(trip, toUtc({ local: '2026-11-02T20:00', tz: 'Australia/Sydney' }))?.days, 1);
});

test('leaving soon: on the day, until the first booking leaves (in its own zone)', () => {
  // first flight 3 Nov 09:30 Sydney time
  const before = toUtc({ local: '2026-11-03T06:15', tz: 'Australia/Sydney' });
  const s = leavingSoon(trip, before);
  assert.equal(s?.days, 0);
  assert.equal(s?.departs, toUtc({ local: '2026-11-03T09:30', tz: 'Australia/Sydney' }));
  assert.equal(hoursUntil(s!, before), 3);
  assert.equal(leavingSoon(trip, toUtc({ local: '2026-11-03T09:31', tz: 'Australia/Sydney' })), null, 'already left');
  assert.equal(leavingSoon(trip, toUtc({ local: '2026-11-04T09:00', tz: 'Asia/Tokyo' })), null, 'trip under way');
});

test('leaving soon: an empty trip uses its start date only, and the soonest of several wins', () => {
  const empty: Trip = { id: 'e', name: 'Bali', startDate: '2026-11-01', endDate: '2026-11-05', homeTz: 'Australia/Sydney', items: [], createdAt: '' };
  const s = leavingSoon(empty, NOW);
  assert.equal(s?.days, 1);
  assert.equal(s?.departs, null);
  assert.equal(hoursUntil(s!, NOW), null);
  assert.equal(nextLeaving([trip, empty], NOW)?.trip.id, 'e');
  assert.equal(nextLeaving([{ ...empty, startDate: '2027-01-01' }], NOW), null);
  assert.equal(leavingSoon({ ...empty, startDate: '' }, NOW), null);
});

test('the card shows until the trip has ended in the home zone, including a trip with no end date', () => {
  assert.equal(showReadiness(trip, NOW), true);
  assert.equal(showReadiness(trip, toUtc({ local: '2026-11-11T23:00', tz: 'Australia/Sydney' })), true);
  assert.equal(showReadiness(trip, toUtc({ local: '2026-11-12T00:30', tz: 'Australia/Sydney' })), false);
  assert.equal(showReadiness({ ...trip, endDate: '' }, NOW), true);
});
