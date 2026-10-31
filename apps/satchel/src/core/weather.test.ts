// T70 weather: the MET Norway Locationforecast compact parser and day summaries, on a fixture written from the
// documented schema (src/core/fixtures/metno_compact_tokyo.json: Tokyo, hourly for three local days then 6-hourly,
// with a malformed step and a ragged end), plus place choice, freshness, units and the request shape.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Item, Trip } from './model.ts';
import {
  cacheKey,
  cardDates,
  dailySummary,
  dayOn,
  forecastReaches,
  forecastUrl,
  formatMm,
  formatTemp,
  freshness,
  normaliseForecast,
  normaliseTempUnit,
  parseForecast,
  roundCoord,
  STALE_AFTER_MS,
  symbolGroup,
  userAgent,
  weatherPlace,
} from './weather.ts';
import { toUtc } from './tz.ts';

const raw: unknown = JSON.parse(readFileSync(new URL('./fixtures/metno_compact_tokyo.json', import.meta.url), 'utf8'));
const TZ = 'Asia/Tokyo';

test('parseForecast: keeps usable steps in time order, skips malformed ones, reads meta.updated_at', () => {
  const f = parseForecast(raw);
  assert.ok(f);
  assert.equal(f.asOf, Date.parse('2026-10-31T14:12:45Z'));
  assert.equal(f.points.length, 72 + 8 + 1);
  assert.ok(f.points.every((p, i) => i === 0 || p.at > f.points[i - 1].at));
  const first = f.points[0];
  assert.equal(first.hours, 1, 'next_1_hours wins over next_6_hours');
  assert.equal(first.symbol, 'clearsky_night');
  const six = f.points.find((p) => p.at === Date.parse('2026-11-04T00:00:00Z'));
  assert.deepEqual(six && { hours: six.hours, symbol: six.symbol, precip: six.precip, tMax: six.tMax, tMin: six.tMin }, { hours: 6, symbol: 'lightsnow', precip: 1.2, tMax: 2, tMin: -1 });
  assert.equal(f.points.at(-1)?.hours, null, 'the last step has an instant temperature only');
});

test('parseForecast: anything without a timeseries is null; no updated_at falls back to the fetch time', () => {
  for (const bad of [null, 1, 'x', {}, { properties: {} }, { properties: { timeseries: [] } }, { properties: { timeseries: [{ time: 'nope', data: {} }] } }]) {
    assert.equal(parseForecast(bad), null);
  }
  const minimal = { properties: { timeseries: [{ time: '2026-11-01T00:00:00Z', data: { instant: { details: { air_temperature: 3 } } } }] } };
  assert.equal(parseForecast(minimal, 123)?.asOf, 123);
});

test('dailySummary: high / low, rain without double counting, icon group per local day', () => {
  const days = dailySummary(parseForecast(raw)!, TZ);
  assert.deepEqual(
    days.map((d) => [d.date, d.high, d.low, d.group, d.precipMm]),
    [
      ['2026-11-01', 18, 10, 'clear', 0],
      ['2026-11-02', 16, 12, 'rain', 4],
      ['2026-11-03', 18, 12, 'thunder', 2],
      ['2026-11-04', 3, -2, 'snow', 4.6],
      ['2026-11-05', 12, 5, 'partly', 0.1],
    ],
  );
  assert.equal(dayOn(days, '2026-11-06'), null, 'a day with one reading is left out');
  assert.equal(dayOn(days, '2026-11-02')?.group, 'rain');
});

test('dailySummary: days follow the place zone, not UTC', () => {
  const utcDays = dailySummary(parseForecast(raw)!, 'UTC').map((d) => d.date);
  assert.equal(utcDays[0], '2026-10-31');
  assert.deepEqual(dailySummary(parseForecast(raw)!, 'Bad/Zone'), []);
});

test('normaliseForecast round-trips the cached shape and rejects damage', () => {
  const f = parseForecast(raw)!;
  assert.deepEqual(normaliseForecast(JSON.parse(JSON.stringify(f))), f);
  assert.equal(normaliseForecast(null), null);
  assert.equal(normaliseForecast({ asOf: 'x', points: [] }), null);
  assert.equal(normaliseForecast({ asOf: 1, points: [{ nope: 1 }] }), null);
});

test('symbolGroup: every MET family lands in one of eight groups', () => {
  const cases: [string, string | null][] = [
    ['clearsky_day', 'clear'],
    ['clearsky_polartwilight', 'clear'],
    ['fair_night', 'partly'],
    ['partlycloudy_day', 'partly'],
    ['cloudy', 'cloudy'],
    ['fog', 'fog'],
    ['lightrain', 'rain'],
    ['heavyrainshowers_day', 'rain'],
    ['lightsleetshowers_night', 'sleet'],
    ['heavysleet', 'sleet'],
    ['snow', 'snow'],
    ['lightsnowshowers_day', 'snow'],
    ['rainandthunder', 'thunder'],
    ['heavysnowshowersandthunder_night', 'thunder'],
    ['lightssleetshowersandthunder_day', 'thunder'],
    ['', null],
    ['tornado', null],
  ];
  for (const [code, want] of cases) assert.equal(symbolGroup(code), want, code);
  assert.equal(symbolGroup(undefined), null);
});

test('freshness: cached offline, stale after 48 h', () => {
  const asOf = Date.parse('2026-10-31T12:00:00Z');
  assert.equal(freshness(asOf, asOf + 60_000, false), 'fresh');
  assert.equal(freshness(asOf, asOf + 60_000, true), 'cached');
  assert.equal(freshness(asOf, asOf + STALE_AFTER_MS + 1, true), 'stale');
  assert.equal(freshness(asOf, asOf + STALE_AFTER_MS, true), 'cached');
});

test('units and number formatting', () => {
  assert.equal(formatTemp(12.4, 'c'), '12°');
  assert.equal(formatTemp(-0.4, 'c'), '0°');
  assert.equal(formatTemp(-3.6, 'c'), '-4°');
  assert.equal(formatTemp(12, 'f'), '54°');
  assert.equal(formatTemp(-40, 'f'), '-40°');
  assert.equal(normaliseTempUnit('f'), 'f');
  assert.equal(normaliseTempUnit('kelvin'), 'c');
  assert.equal(normaliseTempUnit(undefined), 'c');
  assert.equal(formatMm(0), '0');
  assert.equal(formatMm(0.04), '0');
  assert.equal(formatMm(4.6), '4.6');
  assert.equal(formatMm(12.34), '12');
});

test('request: four-decimal coordinates, cache key per spot, identifying User-Agent', () => {
  assert.equal(roundCoord(35.676234), 35.6762);
  assert.equal(forecastUrl({ lat: 35.676234, lon: 139.650312 }), 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=35.6762&lon=139.6503');
  assert.equal(cacheKey({ lat: -33.86881, lon: 151.20929 }), 'satchel.weather.v1.-33.8688,151.2093');
  assert.equal(userAgent('0.1.0'), 'Satchel/0.1.0 github.com/MerlinWerlin/App-Projects');
});

// ---- place choice ----

const KYOTO = { id: 'p1', name: 'Kyoto hotel', lat: 35.0116, lon: 135.7681 };
const TOKYO_HOTEL = { id: 'p2', name: 'Tokyo hotel', lat: 35.6762, lon: 139.6503 };
const item = (o: Partial<Item> & Pick<Item, 'id' | 'kind' | 'start'>): Item => ({ tripId: 't', title: o.id, attachments: [], ...o });
const trip = (items: Item[], extra: Partial<Trip> = {}): Trip => ({
  id: 't',
  name: 'Japan',
  startDate: '2026-11-01',
  endDate: '2026-11-08',
  homeTz: 'Australia/Sydney',
  items,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
});
const at = (local: string, tz = TZ) => toUtc({ local, tz });

test('weatherPlace: the hotel you are in, else the latest place reached, else the next one', () => {
  const t = trip([
    item({ id: 'f', kind: 'flight', start: { local: '2026-11-01T09:00', tz: 'Australia/Sydney' }, end: { local: '2026-11-01T17:00', tz: TZ }, to: { id: 'hnd', name: 'Haneda', lat: 35.5494, lon: 139.7798 } }),
    item({ id: 'h1', kind: 'hotel', start: { local: '2026-11-01T19:00', tz: TZ }, end: { local: '2026-11-04T10:00', tz: TZ }, place: TOKYO_HOTEL }),
    item({ id: 'h2', kind: 'hotel', start: { local: '2026-11-04T15:00', tz: TZ }, end: { local: '2026-11-08T10:00', tz: TZ }, place: KYOTO }),
  ]);
  assert.equal(weatherPlace(t, at('2026-10-20T12:00'))?.name, 'Haneda', 'before the trip: the first place ahead');
  assert.equal(weatherPlace(t, at('2026-11-01T18:00'))?.name, 'Haneda', 'landed, not checked in yet');
  assert.equal(weatherPlace(t, at('2026-11-02T12:00'))?.name, 'Tokyo hotel');
  assert.equal(weatherPlace(t, at('2026-11-04T12:00'))?.name, 'Tokyo hotel', 'between hotels: the last place reached');
  const kyoto = weatherPlace(t, at('2026-11-05T12:00'));
  assert.deepEqual(kyoto, { name: 'Kyoto hotel', lat: KYOTO.lat, lon: KYOTO.lon, tz: TZ });
});

test('weatherPlace: saved places when no booking has coordinates, else null', () => {
  const noCoords = [item({ id: 'n', kind: 'note', start: { local: '2026-11-02T09:00', tz: TZ } })];
  assert.equal(weatherPlace(trip(noCoords), Date.now()), null);
  const withSaved = trip(noCoords, {
    places: [
      { id: 's2', name: 'Later', lat: 34.69, lon: 135.5, savedAt: '2026-10-05T00:00:00Z' },
      { id: 's1', name: 'Sensō-ji', lat: 35.7148, lon: 139.7967, savedAt: '2026-10-02T00:00:00Z' },
    ],
  });
  assert.deepEqual(weatherPlace(withSaved, Date.now()), { name: 'Sensō-ji', lat: 35.7148, lon: 139.7967, tz: TZ });
  assert.equal(weatherPlace(trip([], { places: withSaved.places }), Date.now())?.tz, 'Australia/Sydney', 'no bookings: the home zone');
});

test('cardDates: from today or the first day, up to five, never past the last day', () => {
  const t = trip([]);
  assert.deepEqual(cardDates(t, '2026-10-20'), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  assert.deepEqual(cardDates(t, '2026-11-06'), ['2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(cardDates(t, '2026-11-09'), []);
  assert.equal(forecastReaches(cardDates(t, '2026-10-20'), '2026-10-20'), false, 'three weeks out: no forecast yet');
  assert.equal(forecastReaches(cardDates(t, '2026-10-25'), '2026-10-25'), true);
});
