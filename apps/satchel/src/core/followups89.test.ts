import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIRPORTS, airportByCode, zoneFromCity } from './airports.ts';
import {
  nextFindNonce,
  parseDateOrder,
  parseSavedPastes,
  pasteFingerprint,
  pasteSavedIn,
  PASTE_SAVED_KEEP,
  recordPasteSaved,
  validStop,
  WEATHER_STOP_KEEP,
  weatherStopFor,
  withWeatherStop,
} from './followups89.ts';
import { codesIn, parseBookings } from './pasteparse.ts';

// ---- airport table (T80: grown from ~160 to ~540) ----

test('airport table is large, well formed and every zone is a real IANA zone', () => {
  assert.ok(AIRPORTS.size >= 350, `only ${AIRPORTS.size} airports`);
  for (const [code, a] of AIRPORTS) {
    assert.match(code, /^[A-Z]{3}$/, code);
    assert.equal(a.code, code);
    assert.ok(a.city && !a.city.includes('|'), code);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: a.tz }), `${code} ${a.tz}`);
  }
});

test('new airports map to the right zones', () => {
  const want: Record<string, string> = {
    CJU: 'Asia/Seoul',
    XIY: 'Asia/Shanghai',
    KHH: 'Asia/Taipei',
    BKI: 'Asia/Kuching',
    HYD: 'Asia/Kolkata',
    KTM: 'Asia/Kathmandu',
    RUH: 'Asia/Riyadh',
    AYT: 'Europe/Istanbul',
    ADD: 'Africa/Addis_Ababa',
    TFS: 'Atlantic/Canary',
    PDL: 'Atlantic/Azores',
    LCA: 'Asia/Nicosia',
    MSP: 'America/Chicago',
    DTW: 'America/Detroit',
    SDF: 'America/Kentucky/Louisville',
    YYT: 'America/St_Johns',
    SJD: 'America/Mazatlan',
    SXM: 'America/Lower_Princes',
    USH: 'America/Argentina/Ushuaia',
    IPC: 'Pacific/Easter',
    PPT: 'Pacific/Tahiti',
  };
  for (const [code, tz] of Object.entries(want)) assert.equal(airportByCode(code)?.tz, tz, code);
});

test('no airport code doubles as a currency code (bar four kept from T77) or an everyday capitalised word', () => {
  const currencies = new Set(Intl.supportedValuesOf('currency'));
  const clash = [...AIRPORTS.keys()].filter((c) => currencies.has(c)).sort();
  assert.deepEqual(clash, ['HNL', 'MAD', 'PEN', 'STN']);
  for (const w of ['EXT', 'LED', 'ACE', 'POS', 'MID', 'INN', 'LOS', 'AUS', 'IND', 'SUB', 'RUN', 'GOT', 'SHE', 'GPS']) assert.equal(airportByCode(w), undefined, w);
  // So "HOLIDAY INN", "LED TV" and "LOS ANGELES (LAX)" only find what they should.
  assert.deepEqual(codesIn('HOLIDAY INN, LED TV, EXT 4410').map((c) => c.code), []);
  assert.deepEqual(codesIn('LOS ANGELES (LAX)').map((c) => c.code), ['LAX']);
});

test('city zones: second airports fold into their city; ambiguous names are not used to guess', () => {
  assert.equal(zoneFromCity('Tverskaya St, Moscow')?.tz, 'Europe/Moscow');
  assert.equal(zoneFromCity('Seaside Blvd, Durban')?.tz, 'Africa/Johannesburg');
  assert.equal(zoneFromCity('12 Main Rd, Tenerife')?.tz, 'Atlantic/Canary');
  assert.equal(zoneFromCity('Chengdu Tianfu airport')?.city, 'Chengdu');
  assert.equal(zoneFromCity('Hotel Bristol, Vienna')?.tz, 'Europe/Vienna');
  assert.equal(zoneFromCity('Ocean Road, Nha Trang')?.tz, 'Asia/Ho_Chi_Minh');
  assert.equal(zoneFromCity('Ask for Salvador at the desk'), undefined);
  // The T77 cases still hold.
  assert.equal(zoneFromCity('5 Example Ave, New York')?.tz, 'America/New_York');
  assert.equal(zoneFromCity('Gion, Kyoto 605')?.tz, 'Asia/Tokyo');
});

test('a flight between two new airports gets both zones', () => {
  const [b] = parseBookings('Flight XX 123\nLisbon (LIS) → Funchal Madeira (FNC)\nDeparts 12 Mar 2027 09:10\nArrives 12 Mar 2027 11:00', { now: '2027-01-01' });
  assert.equal(b.kind, 'flight');
  assert.equal(b.draft.startTz, 'Europe/Lisbon');
  assert.equal(b.draft.endTz, 'Atlantic/Madeira');
  assert.deepEqual(b.unknownCodes, []);
});

// ---- day/month order ----

test('date order: month first only when chosen', () => {
  assert.equal(parseDateOrder('monthFirst'), 'monthFirst');
  assert.equal(parseDateOrder('dayFirst'), 'dayFirst');
  for (const junk of [undefined, null, 1, 'MONTHFIRST', {}]) assert.equal(parseDateOrder(junk), 'dayFirst');
});

// ---- saved pastes ----

const card = (over: Partial<Record<string, string>> = {}) => ({
  kind: 'flight' as const,
  draft: { title: 'Sydney to Tokyo', startDate: '2027-03-12', startTime: '21:00', fromName: 'Sydney', toName: 'Tokyo', placeName: '', number: 'XX 123', ref: 'ABC123', ...over },
});

test('fingerprint: same booking same print (case and spacing aside), different booking different print', () => {
  assert.equal(pasteFingerprint(card()), pasteFingerprint(card({ number: ' xx  123 ', title: 'SYDNEY TO TOKYO' })));
  assert.notEqual(pasteFingerprint(card()), pasteFingerprint(card({ startDate: '2027-12-03' })));
  assert.notEqual(pasteFingerprint(card()), pasteFingerprint(card({ number: 'XX 124' })));
  assert.notEqual(pasteFingerprint(card()), pasteFingerprint({ ...card(), kind: 'train' }));
});

test('saved pastes: recorded newest first, one per print and trip, capped; only counts while the booking exists', () => {
  const fp = pasteFingerprint(card());
  let list = recordPasteSaved(undefined, { fp, tripId: 't1', itemId: 'i1', at: 1 });
  list = recordPasteSaved(list, { fp, tripId: 't1', itemId: 'i2', at: 2 });
  assert.deepEqual(list, [{ fp, tripId: 't1', itemId: 'i2', at: 2 }]);
  list = recordPasteSaved(list, { fp, tripId: 't2', itemId: 'i3', at: 3 });
  assert.equal(list.length, 2);
  assert.equal(pasteSavedIn(list, fp, { id: 't1', items: [{ id: 'i2' }] }), true);
  assert.equal(pasteSavedIn(list, fp, { id: 't1', items: [{ id: 'other' }] }), false, 'deleted since');
  assert.equal(pasteSavedIn(list, fp, { id: 't9', items: [{ id: 'i2' }] }), false, 'another trip');
  assert.equal(pasteSavedIn(list, 'nope', { id: 't1', items: [{ id: 'i2' }] }), false);
  assert.equal(pasteSavedIn(list, fp, undefined), false);
  let many: unknown = [];
  for (let i = 0; i < PASTE_SAVED_KEEP + 5; i++) many = recordPasteSaved(many, { fp: `f${i}`, tripId: 't', itemId: `i${i}`, at: i });
  const kept = parseSavedPastes(many);
  assert.equal(kept.length, PASTE_SAVED_KEEP);
  assert.equal(kept[0].fp, `f${PASTE_SAVED_KEEP + 4}`);
  assert.deepEqual(parseSavedPastes([null, 3, { fp: 'a' }, { fp: '', tripId: 't', itemId: 'i', at: 1 }, { fp: 'b', tripId: 't', itemId: 'i', at: 1 }]), [{ fp: 'b', tripId: 't', itemId: 'i', at: 1 }]);
  assert.deepEqual(parseSavedPastes('junk'), []);
});

// ---- weather stop per trip ----

test('weather stop: remembered per trip, validated against the stops, capped', () => {
  let raw: unknown = withWeatherStop(undefined, 'trip-a', 'kyoto');
  raw = withWeatherStop(raw, 'trip-b', 'paris');
  assert.equal(weatherStopFor(raw, 'trip-a'), 'kyoto');
  assert.equal(weatherStopFor(raw, 'trip-b'), 'paris');
  assert.equal(weatherStopFor(raw, 'trip-c'), null);
  raw = withWeatherStop(raw, 'trip-a', 'osaka');
  assert.equal(weatherStopFor(raw, 'trip-a'), 'osaka');
  assert.deepEqual(Object.keys(raw as object), ['trip-b', 'trip-a']);
  for (const junk of [null, 'x', [], { a: 3 }]) assert.equal(weatherStopFor(junk, 'a'), null);
  let big: unknown = {};
  for (let i = 0; i < WEATHER_STOP_KEEP + 3; i++) big = withWeatherStop(big, `t${i}`, 's');
  assert.equal(Object.keys(big as object).length, WEATHER_STOP_KEEP);
  assert.equal(weatherStopFor(big, 't0'), null);
  const stops = [{ key: 'kyoto' }, { key: 'osaka' }];
  assert.equal(validStop('osaka', stops), 'osaka');
  assert.equal(validStop('gone', stops), null);
  assert.equal(validStop(null, stops), null);
});

// ---- Nearest toilet nonce ----

test('find nonce: each new request runs once, a stale param never re-runs, nothing while busy', () => {
  const handled = new Set<string>();
  assert.equal(nextFindNonce([null, undefined], handled, false), null);
  assert.equal(nextFindNonce(['n1', 'n1'], handled, false), 'n1');
  handled.add('n1');
  assert.equal(nextFindNonce([null, 'n1'], handled, false), null, 'same tap seen again');
  // Tab already open: the param did not change but the in-memory request did.
  assert.equal(nextFindNonce(['n2', 'n1'], handled, false), 'n2');
  assert.equal(nextFindNonce(['n2', 'n1'], handled, true), null, 'waits for the running search');
  handled.add('n2');
  assert.equal(nextFindNonce([null, 'n1'], handled, false), null, 'stale param');
  assert.equal(nextFindNonce([null, 'n3'], handled, false), 'n3', 'param alone still works');
});
