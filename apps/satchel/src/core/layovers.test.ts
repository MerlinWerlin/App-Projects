// T131 connections and layovers: detection, minute-exact times across zones (midnight, DST, half-hour zones),
// tight / OK / long by the traveller's limits, missing ends, overlapping legs (a clash, never a layover), place
// matching, terminal / gate fields (form, file, copy), the readiness row and the Your day pick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Item, Place, Trip } from './model.ts';
import {
  briefConnections,
  classify,
  connectionAfter,
  connectionDay,
  connections,
  connectionsCheck,
  crossesBorder,
  DEFAULT_LAYOVER_PREFS,
  departureGate,
  departureTerminal,
  findConnections,
  LEG_TEXT_MAX,
  legInfoDraft,
  LONG_IDEAS,
  MAX_CONNECTION_MIN,
  normaliseLayoverPrefs,
  placeMatch,
  readLegInfo,
  splitMinutes,
  terminalLabel,
  terminalNote,
  withLegInfo,
  applyLayoverOverrides,
  dropLayoverOverrides,
  LAYOVER_OVERRIDE_KEY,
  MAX_OVERRIDES,
  MIN_LONG,
  normaliseLayoverOverrides,
  overrideFor,
  setLayoverOverride,
} from './layovers.ts';
import { overlaps } from './timeline.ts';
import { readiness, toFix } from './readiness.ts';
import { toUtc } from './tz.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';
import { itemFromDraft, draftFromItem } from './trips.ts';
import { layovers } from '../i18n/en/layovers.ts';

const P = (name: string, lat?: number, lon?: number): Place => ({ id: `pl_${name}`, name, ...(lat !== undefined && lon !== undefined ? { lat, lon } : {}) });

let n = 0;
function leg(kind: Item['kind'], from: Place | undefined, to: Place | undefined, start: [string, string], end?: [string, string], extra: Partial<Item> = {}): Item {
  n++;
  return {
    id: extra.id ?? `leg${n}`,
    tripId: 't1',
    kind,
    title: `${from?.name ?? '?'} to ${to?.name ?? '?'}`,
    start: { local: start[0], tz: start[1] },
    ...(end ? { end: { local: end[0], tz: end[1] } } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    attachments: [],
    ...extra,
  };
}

const SYD = P('Sydney (SYD)');
const SIN = P('Singapore (SIN)');
const LHR = P('London (LHR)');

// ---------------------------------------------------------------- detection and timing

test('flight -> flight through Singapore: 85 min across zones, a border change, so tight under 90', () => {
  const a = leg('flight', SYD, SIN, ['2027-03-10T13:00', 'Australia/Sydney'], ['2027-03-10T18:30', 'Asia/Singapore'], { legInfo: { arrTerminal: 'T1' } });
  const b = leg('flight', SIN, LHR, ['2027-03-10T19:55', 'Asia/Singapore'], ['2027-03-11T06:00', 'Europe/London'], { airport: { terminal: 'Terminal 3', gate: 'B7' } });
  const [c, ...rest] = connections([b, a]);
  assert.equal(rest.length, 0);
  assert.equal(c.arrive.id, a.id);
  assert.equal(c.depart.id, b.id);
  assert.equal(c.minutes, 85);
  assert.equal(c.crossBorder, true);
  assert.equal(c.limit, 90);
  assert.equal(c.status, 'tight');
  assert.equal(c.match, 'same');
  assert.equal(c.place, 'Singapore (SIN)');
  assert.equal(c.country, 'SG');
  assert.deepEqual(c.terminal, { from: 'T1', to: 'Terminal 3', change: true });
  assert.deepEqual(terminalNote(c), { kind: 'change', from: '1', to: '3' });
  assert.deepEqual(c.gate, { to: 'B7' });
  assert.equal(c.id, `${a.id}>${b.id}`);
  assert.equal(connectionAfter([c], a.id), c);
  assert.equal(connectionAfter([c], b.id), undefined);
});

test('same-country trains: 45 min is tight (under 60), 70 min OK, 6 h long', () => {
  const tokyo = P('Tokyo Station', 35.6812, 139.7671);
  const kyoto = P('Kyoto', 34.9858, 135.7588);
  const sendai = P('Sendai', 38.2601, 140.8821);
  const make = (dep: string) => [
    leg('train', kyoto, tokyo, ['2027-05-01T08:00', 'Asia/Tokyo'], ['2027-05-01T10:15', 'Asia/Tokyo']),
    leg('train', tokyo, sendai, [dep, 'Asia/Tokyo'], ['2027-05-01T20:00', 'Asia/Tokyo']),
  ];
  const at = (dep: string) => connections(make(dep))[0];
  assert.deepEqual([at('2027-05-01T11:00').minutes, at('2027-05-01T11:00').status, at('2027-05-01T11:00').crossBorder], [45, 'tight', false]);
  assert.equal(at('2027-05-01T11:25').status, 'ok');
  assert.equal(at('2027-05-01T16:15').status, 'long');
});

test('minute-exact across two different zones (India +5:30 to Nepal +5:45)', () => {
  const border = P('Border Station');
  const a = leg('bus', P('Delhi'), border, ['2027-02-01T06:00', 'Asia/Kolkata'], ['2027-02-01T10:00', 'Asia/Kolkata']);
  const b = leg('bus', border, P('Kathmandu'), ['2027-02-01T10:30', 'Asia/Kathmandu'], ['2027-02-01T18:00', 'Asia/Kathmandu']);
  const [c] = connections([a, b]);
  // 10:00 IST = 04:30 UTC, 10:30 NPT = 04:45 UTC.
  assert.equal(c.minutes, 15);
  assert.equal(c.crossBorder, true);
  assert.equal(c.status, 'tight');
});

test('a change over midnight counts real minutes and sits on the arrival day', () => {
  const hub = P('Doha (DOH)');
  const a = leg('flight', P('Nairobi (NBO)'), hub, ['2027-06-01T18:00', 'Africa/Nairobi'], ['2027-06-01T23:20', 'Asia/Qatar']);
  const b = leg('flight', hub, P('Bangkok (BKK)'), ['2027-06-02T00:35', 'Asia/Qatar'], ['2027-06-02T11:00', 'Asia/Bangkok']);
  const [c] = connections([a, b]);
  assert.equal(c.minutes, 75);
  assert.equal(connectionDay(c), '2027-06-01');
});

test('DST: spring forward shortens the wall-clock gap, fall back lengthens it', () => {
  const pier = P('Dover Pier');
  // Europe/London, 28 Mar 2027: 01:00 -> 02:00. 00:40 GMT to 02:10 BST is 30 real minutes, not 90.
  const a = leg('ferry', P('Calais'), pier, ['2027-03-27T22:00', 'Europe/Paris'], ['2027-03-28T00:40', 'Europe/London']);
  const b = leg('bus', pier, P('London Victoria'), ['2027-03-28T02:10', 'Europe/London'], ['2027-03-28T04:30', 'Europe/London']);
  const [c] = connections([a, b]);
  assert.equal(c.minutes, 30);
  assert.equal(c.status, 'tight');
  // 31 Oct 2027: 02:00 -> 01:00. 00:30 BST to 02:30 GMT is 3 h, not 2.
  const a2 = leg('ferry', P('Calais'), pier, ['2027-10-30T22:00', 'Europe/Paris'], ['2027-10-31T00:30', 'Europe/London']);
  const b2 = leg('bus', pier, P('London Victoria'), ['2027-10-31T02:30', 'Europe/London'], ['2027-10-31T05:00', 'Europe/London']);
  assert.equal(connections([a2, b2])[0].minutes, 180);
});

test('the date line: arriving "before" you left still counts real minutes', () => {
  const hnl = P('Honolulu (HNL)');
  const a = leg('flight', P('Tokyo (HND)'), hnl, ['2027-07-01T21:00', 'Asia/Tokyo'], ['2027-07-01T09:00', 'Pacific/Honolulu']);
  const b = leg('flight', hnl, P('Kahului (OGG)'), ['2027-07-01T11:00', 'Pacific/Honolulu'], ['2027-07-01T11:40', 'Pacific/Honolulu']);
  const [c] = connections([a, b]);
  assert.equal(c.minutes, 120);
  assert.equal(c.status, 'ok');
});

test('a first leg with no arrival time forms no connection (and no clash)', () => {
  const a = leg('train', P('Milan'), P('Zurich'), ['2027-04-01T08:00', 'Europe/Rome']);
  const b = leg('train', P('Zurich'), P('Basel'), ['2027-04-01T12:00', 'Europe/Zurich'], ['2027-04-01T13:00', 'Europe/Zurich']);
  const r = findConnections([a, b]);
  assert.deepEqual(r.connections, []);
  assert.deepEqual(r.clashes, []);
  // A second leg without an end still takes the connection (only the first leg's arrival is needed).
  const a2 = leg('train', P('Milan'), P('Zurich'), ['2027-04-01T08:00', 'Europe/Rome'], ['2027-04-01T11:20', 'Europe/Zurich']);
  const b2 = leg('train', P('Zurich'), P('Basel'), ['2027-04-01T12:00', 'Europe/Zurich']);
  assert.equal(connections([a2, b2])[0].minutes, 40);
});

test('overlapping legs are a clash, never a layover; legs that clash pair with nothing', () => {
  const hub = P('Frankfurt (FRA)');
  const a = leg('flight', P('Rome (FCO)'), hub, ['2027-09-01T08:00', 'Europe/Rome'], ['2027-09-01T10:10', 'Europe/Berlin']);
  const b = leg('flight', hub, P('Oslo (OSL)'), ['2027-09-01T09:50', 'Europe/Berlin'], ['2027-09-01T12:00', 'Europe/Oslo']);
  const c = leg('train', P('Oslo (OSL)'), P('Oslo S'), ['2027-09-01T12:30', 'Europe/Oslo'], ['2027-09-01T12:50', 'Europe/Oslo']);
  const r = findConnections([a, b, c]);
  assert.deepEqual(r.connections, []);
  assert.equal(r.clashes.length, 1);
  assert.equal(r.clashes[0].first.id, a.id);
  assert.equal(r.clashes[0].second.id, b.id);
  assert.equal(r.clashes[0].overlapMin, 20);
  // The timeline reports the same pair as a clash.
  assert.deepEqual(overlaps([a, b, c]).map(([x, y]) => [x.id, y.id]), [[a.id, b.id]]);
  // Leaving the minute you land is a 0-minute (tight) connection, not a clash.
  const b0 = { ...b, start: { local: '2027-09-01T10:10', tz: 'Europe/Berlin' } };
  const r0 = findConnections([a, b0]);
  assert.deepEqual(r0.clashes, []);
  assert.equal(r0.connections[0].minutes, 0);
  assert.equal(r0.connections[0].status, 'tight');
});

test('over 24 h is a stay, not a layover; exactly 24 h is a long layover', () => {
  const hub = P('Istanbul (IST)');
  const a = leg('flight', P('Paris (CDG)'), hub, ['2027-08-01T08:00', 'Europe/Paris'], ['2027-08-01T12:00', 'Europe/Istanbul']);
  const later = (local: string) => leg('flight', hub, P('Dubai (DXB)'), [local, 'Europe/Istanbul'], ['2027-08-03T06:00', 'Asia/Dubai']);
  assert.equal(connections([a, later('2027-08-02T12:00')])[0].minutes, MAX_CONNECTION_MIN);
  assert.equal(connections([a, later('2027-08-02T12:00')])[0].status, 'long');
  assert.deepEqual(connections([a, later('2027-08-02T12:01')]), []);
});

test('only back-to-back journeys pair: different places, other kinds and unreadable zones are left out', () => {
  const a = leg('flight', P('Paris (CDG)'), P('Madrid (MAD)'), ['2027-08-01T08:00', 'Europe/Paris'], ['2027-08-01T10:00', 'Europe/Madrid']);
  const elsewhere = leg('flight', P('Lisbon (LIS)'), P('Porto (OPO)'), ['2027-08-01T12:00', 'Europe/Lisbon'], ['2027-08-01T13:00', 'Europe/Lisbon']);
  assert.deepEqual(connections([a, elsewhere]), []);
  // A hotel, an activity or a note in between doesn't break a connection; a car hire is not a journey.
  const b = leg('train', P('Madrid'), P('Seville'), ['2027-08-01T12:00', 'Europe/Madrid'], ['2027-08-01T14:30', 'Europe/Madrid']);
  const coffee = leg('activity', undefined, undefined, ['2027-08-01T11:00', 'Europe/Madrid'], ['2027-08-01T11:30', 'Europe/Madrid'], { place: P('Cafe') });
  const car = leg('car', undefined, undefined, ['2027-08-01T10:30', 'Europe/Madrid'], ['2027-08-05T10:30', 'Europe/Madrid'], { place: P('Madrid (MAD)') });
  const [c] = connections([a, coffee, car, b]);
  assert.equal(c.minutes, 120);
  assert.equal(c.match, 'same', '"Madrid (MAD)" and "Madrid": the same place by name');
  // A leg whose zone this phone can't read is skipped, never given an invented time.
  const broken = leg('train', P('Madrid'), P('Seville'), ['2027-08-01T12:00', 'Mars/Olympus'], ['2027-08-01T14:30', 'Europe/Madrid']);
  assert.deepEqual(connections([a, broken]), []);
  // The next journey pairs, not a later one.
  const third = leg('bus', P('Seville'), P('Cadiz'), ['2027-08-01T15:00', 'Europe/Madrid'], ['2027-08-01T16:45', 'Europe/Madrid']);
  assert.deepEqual(connections([a, b, third]).map((x) => [x.arrive.id, x.depart.id]), [[a.id, b.id], [b.id, third.id]]);
});

// ---------------------------------------------------------------- places

test('placeMatch: positions decide when both are saved; else names and codes', () => {
  const hnd = P('Haneda', 35.5494, 139.7798);
  const hndT3 = P('Haneda T3', 35.5443, 139.7686);
  const nrt = P('Narita', 35.772, 140.3929);
  const osaka = P('Osaka', 34.6937, 135.5023);
  assert.equal(placeMatch(hnd, hndT3), 'same');
  assert.equal(placeMatch(hnd, nrt), 'nearby');
  assert.equal(placeMatch(hnd, osaka), null);
  // Names alone.
  assert.equal(placeMatch(P('Singapore (SIN)'), P('SIN')), 'same');
  assert.equal(placeMatch(P('sin'), P('Singapore Changi')), 'same', 'a bare code reads as its city');
  assert.equal(placeMatch(P('Singapore (SIN)'), P('Singapore Changi')), 'same');
  assert.equal(placeMatch(P('Doha'), P('Doha Hamad')), 'same');
  assert.equal(placeMatch(P('Zürich HB'), P('zurich hb')), 'same');
  assert.equal(placeMatch(P('London LHR'), P('London LGW')), 'nearby', 'two codes in one city: a change of airport');
  assert.equal(placeMatch(P('LHR'), P('LGW')), 'nearby');
  assert.equal(placeMatch(P('Tokyo Station'), P('Tokyo Haneda')), 'nearby');
  assert.equal(placeMatch(P('Port Louis'), P('Port Moresby')), null, 'a generic first word is not a city');
  assert.equal(placeMatch(P('Paris'), P('Lyon')), null);
  assert.equal(placeMatch(P(''), P('Lyon')), null);
  assert.equal(placeMatch(undefined, P('Lyon')), null);
  // A position on one side only falls back to the names.
  assert.equal(placeMatch(P('Haneda', 35.5494, 139.7798), P('Haneda')), 'same');
});

test('a change between airports in one city is a connection marked nearby', () => {
  const a = leg('flight', P('Sapporo (CTS)'), P('Tokyo (HND)', 35.5494, 139.7798), ['2027-01-10T08:00', 'Asia/Tokyo'], ['2027-01-10T09:40', 'Asia/Tokyo']);
  const b = leg('flight', P('Tokyo (NRT)', 35.772, 140.3929), P('Manila (MNL)'), ['2027-01-10T14:00', 'Asia/Tokyo'], ['2027-01-10T18:30', 'Asia/Manila']);
  const [c] = connections([a, b]);
  assert.equal(c.match, 'nearby');
  assert.equal(c.place, 'Tokyo (NRT)');
  assert.equal(c.crossBorder, true);
});

test('crossesBorder ignores zones with no known country', () => {
  const a = leg('train', P('A'), P('B'), ['2027-01-01T08:00', 'Europe/Paris'], ['2027-01-01T09:00', 'Europe/Paris']);
  const b = leg('train', P('B'), P('C'), ['2027-01-01T10:00', 'UTC'], ['2027-01-01T11:00', 'Europe/Paris']);
  assert.equal(crossesBorder(a, b), false);
  const c = leg('train', P('B'), P('C'), ['2027-01-01T10:00', 'Europe/Paris'], ['2027-01-01T11:00', 'Europe/Brussels']);
  assert.equal(crossesBorder(a, c), true);
});

// ---------------------------------------------------------------- limits

test('classify: boundaries and the traveller\'s own limits', () => {
  const p = DEFAULT_LAYOVER_PREFS;
  assert.deepEqual(classify(59, false, p), { status: 'tight', limit: 60 });
  assert.deepEqual(classify(60, false, p), { status: 'ok', limit: 60 });
  assert.deepEqual(classify(89, true, p), { status: 'tight', limit: 90 });
  assert.deepEqual(classify(90, true, p), { status: 'ok', limit: 90 });
  assert.equal(classify(300, false, p).status, 'ok');
  assert.equal(classify(301, false, p).status, 'long');
  const mine = { tightMin: 45, tightCrossMin: 120, longMin: 420 };
  assert.equal(classify(50, false, mine).status, 'ok');
  assert.equal(classify(100, true, mine).status, 'tight');
  assert.equal(classify(400, false, mine).status, 'ok');
  // Limits flow through detection.
  const hub = P('Hub');
  const a = leg('bus', P('A'), hub, ['2027-01-01T08:00', 'Europe/Paris'], ['2027-01-01T09:00', 'Europe/Paris']);
  const b = leg('bus', hub, P('C'), ['2027-01-01T09:50', 'Europe/Paris'], ['2027-01-01T11:00', 'Europe/Paris']);
  assert.equal(connections([a, b]).at(0)?.status, 'tight');
  assert.equal(connections([a, b], mine).at(0)?.status, 'ok');
});

test('normaliseLayoverPrefs: damaged or out-of-range values fall back to the defaults', () => {
  assert.deepEqual(normaliseLayoverPrefs(null), DEFAULT_LAYOVER_PREFS);
  assert.deepEqual(normaliseLayoverPrefs('x'), DEFAULT_LAYOVER_PREFS);
  assert.deepEqual(normaliseLayoverPrefs({ tightMin: -5, tightCrossMin: 9999, longMin: 30 }), DEFAULT_LAYOVER_PREFS);
  assert.deepEqual(normaliseLayoverPrefs({ tightMin: 45.5, tightCrossMin: '90', longMin: null }), DEFAULT_LAYOVER_PREFS);
  assert.deepEqual(normaliseLayoverPrefs({ tightMin: 30, tightCrossMin: 120, longMin: 480, extra: 1 }), { tightMin: 30, tightCrossMin: 120, longMin: 480 });
  // Bad stored limits never break classification.
  assert.equal(classify(70, false, { tightMin: NaN, tightCrossMin: 90, longMin: 300 } as never).status, 'ok');
});

// ---------------------------------------------------------------- terminal and gate

test('readLegInfo / withLegInfo: trimmed, empties dropped, unknown keys kept, journeys only', () => {
  assert.equal(readLegInfo(undefined), undefined);
  assert.equal(readLegInfo([]), undefined);
  assert.equal(readLegInfo({ depTerminal: '  ', arrGate: 5 }), undefined);
  assert.deepEqual(readLegInfo({ depTerminal: '  T 2 ', arrGate: 'B  12', future: 1 }), { future: 1, depTerminal: 'T 2', arrGate: 'B 12' });
  assert.equal(readLegInfo({ arrTerminal: 'x'.repeat(100) })?.arrTerminal?.length, LEG_TEXT_MAX);
  const train = leg('train', P('A'), P('B'), ['2027-01-01T08:00', 'Europe/Paris'], ['2027-01-01T09:00', 'Europe/Paris'], { legInfo: { arrGate: '4', future: 'kept' } as never });
  const draft = { ...legInfoDraft(train.legInfo), depGate: ' 11 ' };
  assert.deepEqual(draft, { depTerminal: '', depGate: ' 11 ', arrTerminal: '', arrGate: '4' });
  assert.deepEqual(withLegInfo(train, draft, train.legInfo).legInfo, { future: 'kept', depGate: '11', arrGate: '4' });
  // Clearing every field removes the object (nothing unknown left).
  const plain = leg('bus', P('A'), P('B'), ['2027-01-01T08:00', 'Europe/Paris'], undefined, { legInfo: { arrGate: '4' } });
  assert.equal('legInfo' in withLegInfo(plain, legInfoDraft(undefined), plain.legInfo), false);
  // Not a journey: dropped.
  const hotel = { ...train, kind: 'hotel' as const };
  assert.equal('legInfo' in withLegInfo(hotel, draft, train.legInfo), false);
  // Edit booking: switching a journey to a hotel drops it, a journey keeps it.
  assert.equal(itemFromDraft({ ...draftFromItem(train), kind: 'hotel' }, 't1', train).legInfo, undefined);
  assert.deepEqual(itemFromDraft(draftFromItem(train), 't1', train).legInfo, train.legInfo);
  assert.deepEqual(itemFromDraft({ ...draftFromItem(train), kind: 'ferry' }, 't1', train).legInfo, train.legInfo);
});

test('a flight\'s departure terminal and gate come from its airport fields first', () => {
  const f = leg('flight', P('A'), P('B'), ['2027-01-01T08:00', 'Europe/Paris'], undefined, { airport: { terminal: '2E', gate: 'K40' }, legInfo: { depTerminal: '1', depGate: '9' } });
  assert.equal(departureTerminal(f), '2E');
  assert.equal(departureGate(f), 'K40');
  assert.equal(departureTerminal({ ...f, airport: {} }), '1');
  assert.equal(departureTerminal({ ...f, kind: 'train' }), '1', 'only a flight has airport fields');
  assert.equal(departureGate({ ...f, kind: 'train' }), '9');
});

test('terminalLabel and terminalNote', () => {
  assert.equal(terminalLabel('T1'), '1');
  assert.equal(terminalLabel('terminal 2'), '2');
  assert.equal(terminalLabel('Terminal 2E'), '2E');
  assert.equal(terminalLabel('t-3'), '3');
  assert.equal(terminalLabel('North'), 'North');
  assert.equal(terminalLabel(' Satellite '), 'Satellite');
  const hub = P('Hub (HUB)');
  const a = (arr?: string) => leg('flight', P('X'), hub, ['2027-01-01T08:00', 'Europe/Paris'], ['2027-01-01T09:00', 'Europe/Paris'], arr ? { legInfo: { arrTerminal: arr } } : {});
  const b = (dep?: string) => leg('flight', hub, P('Y'), ['2027-01-01T11:00', 'Europe/Paris'], ['2027-01-01T12:00', 'Europe/Paris'], dep ? { airport: { terminal: dep } } : {});
  assert.deepEqual(terminalNote(connections([a('T1'), b('Terminal 1')])[0]), { kind: 'same', terminal: '1' });
  assert.equal(connections([a('T1'), b('Terminal 1')])[0].terminal.change, false);
  assert.deepEqual(terminalNote(connections([a('T1'), b('T2')])[0]), { kind: 'change', from: '1', to: '2' });
  assert.equal(terminalNote(connections([a('T1'), b()])[0]), null);
  assert.equal(terminalNote(connections([a(), b()])[0]), null);
});

test('splitMinutes', () => {
  assert.deepEqual(splitMinutes(85), { h: 1, m: 25 });
  assert.deepEqual(splitMinutes(45), { h: 0, m: 45 });
  assert.deepEqual(splitMinutes(120), { h: 2, m: 0 });
  assert.deepEqual(splitMinutes(-3), { h: 0, m: 0 });
});

test('.satchel: terminal and gate fields travel; bad values are dropped on import, unknown keys kept', () => {
  const a = leg('train', P('A'), P('B'), ['2027-01-01T08:00', 'Europe/Paris'], ['2027-01-01T09:00', 'Europe/Paris'], { legInfo: { depGate: '7', arrTerminal: 'Hall 2' } });
  const trip: Trip = { id: 't1', name: 'Rail', startDate: '2027-01-01', endDate: '2027-01-02', homeTz: 'Europe/Paris', items: [a], createdAt: '2026-12-01T00:00:00.000Z' };
  const built = buildTripFile(trip, {});
  assert.deepEqual(built.file.items[0].legInfo, { depGate: '7', arrTerminal: 'Hall 2' });
  const tampered = JSON.parse(JSON.stringify(built.file));
  tampered.items[0].legInfo = { depGate: 42, arrTerminal: ' Hall 2 ', later: true };
  const parsed = parseTripFileText(JSON.stringify(tampered));
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, (p) => `${p}_n`);
  assert.deepEqual(imp.trip.items[0].legInfo, { later: true, arrTerminal: 'Hall 2' });
  // Nothing usable left: the key goes.
  tampered.items[0].legInfo = { depGate: '' };
  const p2 = parseTripFileText(JSON.stringify(tampered));
  assert.ok(p2.ok);
  assert.equal('legInfo' in importTripFile(p2.file, (p) => `${p}_m`).trip.items[0], false);
});

// ---------------------------------------------------------------- readiness and Your day

const hub = P('Hub (HUB)');
function tripWith(depLocal: string): Trip {
  const a = leg('flight', P('Here (HRE)'), hub, ['2027-03-01T08:00', 'Europe/Paris'], ['2027-03-01T10:00', 'Europe/London'], { id: 'in' });
  const b = leg('flight', hub, P('There (THR)'), [depLocal, 'Europe/London'], ['2027-03-01T23:00', 'America/New_York'], { id: 'out' });
  return { id: 'tr', name: 'Trip', startDate: '2027-03-01', endDate: '2027-03-05', homeTz: 'Europe/Paris', items: [a, b], createdAt: '' };
}

test('connectionsCheck: no row without connections; warn for tight (fix opens the next leg); pass otherwise', () => {
  assert.equal(connectionsCheck({ items: [] }), null);
  const tight = connectionsCheck(tripWith('2027-03-01T11:00'));
  assert.deepEqual(tight, { id: 'connections', status: 'warn', reason: 'tight', done: 1, total: 1, city: 'Hub (HUB)', minutes: 60, fix: { kind: 'connection', itemId: 'out' } });
  assert.deepEqual(connectionsCheck(tripWith('2027-03-01T12:00')), { id: 'connections', status: 'pass', reason: 'ok', done: 1, total: 1, fix: null });
  // The traveller's limits apply.
  assert.equal(connectionsCheck(tripWith('2027-03-01T12:00'), { tightMin: 60, tightCrossMin: 150, longMin: 300 })?.status, 'warn');
});

test('readiness: the connections row sits after the map row, before to-dos, and is scored', () => {
  const trip = tripWith('2027-03-01T11:00');
  const r = readiness({ trip, docs: [], packing: null, card: null, catalog: null, installed: [], now: Date.UTC(2027, 1, 1), connections: connectionsCheck(trip), todos: { id: 'todos', status: 'warn', reason: 'overdue', done: 1, total: 1, fix: { kind: 'todos', tripId: 'tr' } } });
  assert.deepEqual(r.checks.map((c) => c.id), ['passport', 'visa', 'packing', 'emergency', 'hotels', 'map', 'connections', 'todos']);
  const fix = toFix(r).map((c) => c.id);
  assert.ok(fix.indexOf('connections') < fix.indexOf('todos'));
  const without = readiness({ trip, docs: [], packing: null, card: null, catalog: null, installed: [], now: Date.UTC(2027, 1, 1), connections: null });
  assert.equal(without.checks.some((c) => c.id === 'connections'), false);
  assert.equal(without.scored + 1, r.scored - 1, 'connections and to-dos rows are both scored');
});

test('briefConnections: on the day of the change, until the next leg leaves', () => {
  const trip = tripWith('2027-03-01T11:25');
  const at = (iso: string) => Date.parse(iso);
  assert.equal(briefConnections(trip, 'Europe/London', '2027-03-01', at('2027-03-01T07:00:00Z')).length, 1);
  assert.equal(briefConnections(trip, 'Europe/London', '2027-03-01', at('2027-03-01T11:00:00Z')).length, 1);
  assert.equal(briefConnections(trip, 'Europe/London', '2027-03-01', at('2027-03-01T11:25:00Z')).length, 0, 'gone once the next leg leaves');
  assert.equal(briefConnections(trip, 'Europe/London', '2027-02-28', at('2027-02-28T09:00:00Z')).length, 0, 'not the day before');
  // In a zone where the change falls on another date.
  assert.equal(briefConnections(trip, 'Pacific/Kiritimati', '2027-03-02', at('2027-03-01T09:00:00Z')).length, 1);
  assert.equal(toUtc(trip.items[1].start), at('2027-03-01T11:25:00Z'));
});

// ---------------------------------------------------------------- T134: one connection's own limits

test('own limits: stored per trip + leg pair, normalised on read, last row wins, capped', () => {
  assert.equal(LAYOVER_OVERRIDE_KEY, 'satchel.layovers.override.v1');
  assert.deepEqual(normaliseLayoverOverrides(null), []);
  assert.deepEqual(normaliseLayoverOverrides({ tripId: 'tr' }), []);
  const rows = normaliseLayoverOverrides([
    { tripId: 'tr', arriveId: 'in', departId: 'out', tightMin: 45, tightCrossMin: 'x', longMin: 20 },
    { tripId: '', arriveId: 'in', departId: 'out', tightMin: 10 },
    { tripId: 'tr', arriveId: 'in' },
    'junk',
    { tripId: 'tr2', arriveId: 'a>b|c', departId: 'd', tightMin: 30, tightCrossMin: 30, longMin: 600 },
    { tripId: 'tr', arriveId: 'in', departId: 'out', tightMin: 50, tightCrossMin: 75, longMin: 480 },
  ]);
  assert.deepEqual(rows, [
    { tripId: 'tr2', arriveId: 'a>b|c', departId: 'd', tightMin: 30, tightCrossMin: 30, longMin: 600 },
    { tripId: 'tr', arriveId: 'in', departId: 'out', tightMin: 50, tightCrossMin: 75, longMin: 480 },
  ]);
  // Bad values fall back to the defaults (long under its minimum, a non-number).
  assert.deepEqual(overrideFor([{ tripId: 'tr', arriveId: 'in', departId: 'out', tightMin: 45, tightCrossMin: 'x', longMin: 20 }], 'tr', 'in', 'out'), { tightMin: 45, tightCrossMin: 90, longMin: 300 });
  assert.equal(overrideFor(rows, 'tr', 'out', 'in'), null);
  const many = Array.from({ length: MAX_OVERRIDES + 5 }, (_, i) => ({ tripId: 't', arriveId: `a${i}`, departId: 'b', ...DEFAULT_LAYOVER_PREFS }));
  const kept = normaliseLayoverOverrides(many);
  assert.equal(kept.length, MAX_OVERRIDES);
  assert.equal(kept[0].arriveId, 'a5', 'the oldest go first');
});

test('own limits: set starts from the usual limits, changes one field, "use my usual limits" removes it', () => {
  const usual = { tightMin: 40, tightCrossMin: 80, longMin: 360 };
  let s = setLayoverOverride(undefined, 'tr', 'in', 'out', { tightCrossMin: 45 }, usual);
  assert.deepEqual(overrideFor(s, 'tr', 'in', 'out'), { tightMin: 40, tightCrossMin: 45, longMin: 360 });
  s = setLayoverOverride(s, 'tr', 'in', 'out', { longMin: 600 }, DEFAULT_LAYOVER_PREFS);
  assert.deepEqual(overrideFor(s, 'tr', 'in', 'out'), { tightMin: 40, tightCrossMin: 45, longMin: 600 }, 'an existing row keeps its own values');
  s = setLayoverOverride(s, 'tr', 'x', 'y', { tightMin: 15 });
  assert.equal(s.length, 2);
  s = setLayoverOverride(s, 'tr', 'in', 'out', null);
  assert.equal(overrideFor(s, 'tr', 'in', 'out'), null);
  assert.equal(s.length, 1);
  // Out-of-range input is clamped by the normaliser (invalid -> default).
  assert.equal(overrideFor(setLayoverOverride([], 'tr', 'in', 'out', { longMin: 5 }), 'tr', 'in', 'out')?.longMin, DEFAULT_LAYOVER_PREFS.longMin);
});

test('own limits: dropped with the trip, or with either leg', () => {
  const s = [
    { tripId: 'tr', arriveId: 'in', departId: 'out', ...DEFAULT_LAYOVER_PREFS },
    { tripId: 'tr', arriveId: 'out', departId: 'last', ...DEFAULT_LAYOVER_PREFS },
    { tripId: 'other', arriveId: 'in', departId: 'out', ...DEFAULT_LAYOVER_PREFS },
  ];
  assert.deepEqual(dropLayoverOverrides(s, 'tr').map((o) => o.tripId), ['other']);
  assert.deepEqual(dropLayoverOverrides(s, 'tr', ['in']).map((o) => `${o.tripId}:${o.arriveId}`), ['tr:out', 'other:in']);
  assert.deepEqual(dropLayoverOverrides(s, 'tr', ['out']).map((o) => o.tripId), ['other'], 'a leg in the middle ends both changes');
  assert.equal(dropLayoverOverrides(s, 'tr', ['zzz']).length, 3);
});

test('own limits decide the status of that change only: connections, readiness and Your day', () => {
  const trip = tripWith('2027-03-01T11:00'); // 60 min across a border: tight under the usual 90
  const own = setLayoverOverride([], 'tr', 'in', 'out', { tightCrossMin: 45 });
  const [plain] = connections(trip.items);
  assert.deepEqual([plain.status, plain.own, plain.limit], ['tight', false, 90]);
  const [mine] = connections(trip.items, DEFAULT_LAYOVER_PREFS, { tripId: 'tr', overrides: own });
  assert.deepEqual([mine.status, mine.own, mine.limit, mine.prefs.tightCrossMin], ['ok', true, 45, 45]);
  // Another trip's row (or another pair) does nothing.
  assert.equal(connections(trip.items, DEFAULT_LAYOVER_PREFS, { tripId: 'other', overrides: own })[0].own, false);
  // Its own long limit: exactly 60 min against a 60 min limit is OK, 75 min is long; the usual limits don't count.
  const longer = setLayoverOverride([], 'tr', 'in', 'out', { tightCrossMin: 0, longMin: 60 });
  assert.equal(connections(trip.items, { tightMin: 360, tightCrossMin: 360, longMin: 1440 }, { tripId: 'tr', overrides: longer })[0].status, 'ok');
  const longest = setLayoverOverride([], 'tr', 'in', 'out', { tightCrossMin: 0, longMin: MIN_LONG });
  assert.equal(connections(tripWith('2027-03-01T11:15').items, DEFAULT_LAYOVER_PREFS, { tripId: 'tr', overrides: longest })[0].status, 'long');
  // applyLayoverOverrides re-judges a list found with the usual limits the same way.
  assert.deepEqual(applyLayoverOverrides([plain], 'tr', own)[0], mine);
  assert.equal(applyLayoverOverrides([plain], 'tr', [])[0], plain);
  // Readiness and Your day use them when given.
  assert.equal(connectionsCheck(trip)?.status, 'warn');
  assert.equal(connectionsCheck(trip, DEFAULT_LAYOVER_PREFS, own)?.status, 'pass');
  assert.equal(briefConnections(trip, 'Europe/London', '2027-03-01', Date.parse('2027-03-01T07:00:00Z'), DEFAULT_LAYOVER_PREFS, own)[0].status, 'ok');
  assert.equal(briefConnections(trip, 'Europe/London', '2027-03-01', Date.parse('2027-03-01T07:00:00Z'))[0].status, 'tight');
});

// ---------------------------------------------------------------- strings

test('layover strings: prefixed, no brand names, no promises about entry rules', () => {
  const keys = Object.keys(layovers);
  assert.ok(keys.length > 20);
  for (const k of keys) assert.ok(k.startsWith('layover.'), k);
  for (const idea of LONG_IDEAS) {
    assert.ok(`layover.idea.${idea}` in layovers, idea);
    assert.ok(`layover.idea.${idea}Body` in layovers, idea);
  }
  const all = Object.values(layovers).join(' ');
  // Leaving the airport is always conditional on the entry rules there.
  assert.match((layovers as Record<string, string>)['layover.idea.leaveBody'], /only if/i);
  assert.doesNotMatch(all, /guarantee|you can leave|visa[- ]free/i);
  for (const brand of ['Qantas', 'Emirates', 'Lufthansa', 'Delta', 'United', 'Ryanair', 'easyJet', 'Singapore Airlines', 'Qatar Airways', 'British Airways', 'TripIt', 'Kayak', 'Expedia', 'Skyscanner']) {
    assert.doesNotMatch(all, new RegExp(brand, 'i'), brand);
  }
  // UI and core use only keys that exist.
  const ui = readFileSync(new URL('../ui/layovers.tsx', import.meta.url), 'utf8');
  for (const m of ui.matchAll(/'(layover\.[A-Za-z0-9.]+)'/g)) assert.ok(m[1] in layovers || keys.some((k) => k.startsWith(m[1])), m[1]);
});
