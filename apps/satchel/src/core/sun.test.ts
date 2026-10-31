// T70 daylight: NOAA sunrise / sunset / civil twilight against published almanac times (timeanddate.com / national
// observatory tables, rounded to the minute), within 2 minutes, plus the polar and white-night cases.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSpan, lightLeftMin, sunDay } from './sun.ts';
import { toUtc, wallMs } from './tz.ts';

const SYDNEY = { lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' };
const TOKYO = { lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' };
const REYKJAVIK = { lat: 64.1466, lon: -21.9426, tz: 'Atlantic/Reykjavik' };
const LONDON = { lat: 51.5074, lon: -0.1278, tz: 'Europe/London' };
const TROMSO = { lat: 69.6492, lon: 18.9553, tz: 'Europe/Oslo' };
const LONGYEARBYEN = { lat: 78.2232, lon: 15.6267, tz: 'Arctic/Longyearbyen' };
const MCMURDO = { lat: -77.846, lon: 166.676, tz: 'Antarctica/McMurdo' };

/** |a - b| in minutes for two wall clocks. */
const off = (a: string | null, b: string) => {
  assert.ok(a, `expected a time near ${b}`);
  return Math.abs(wallMs(a) - wallMs(b)) / 60_000;
};
const near = (a: string | null, b: string, what: string) => assert.ok(off(a, b) <= 2, `${what}: got ${a}, want ${b} ±2 min`);

const at = (p: { lat: number; lon: number; tz: string }, date: string) => {
  const s = sunDay(p.lat, p.lon, date, p.tz);
  assert.ok(s);
  return s;
};

test('Sydney near both solstices (AEDT in December, AEST in June)', () => {
  const dec = at(SYDNEY, '2026-12-21');
  near(dec.sunrise, '2026-12-21T05:41', 'Sydney Dec sunrise');
  near(dec.sunset, '2026-12-21T20:05', 'Sydney Dec sunset');
  const jun = at(SYDNEY, '2026-06-21');
  near(jun.sunrise, '2026-06-21T07:00', 'Sydney Jun sunrise');
  near(jun.sunset, '2026-06-21T16:54', 'Sydney Jun sunset');
  assert.equal(jun.polar, null);
  assert.ok(jun.civilDawn && jun.civilDawn < jun.sunrise!);
  assert.ok(jun.civilDusk && jun.civilDusk > jun.sunset!);
});

test('Tokyo near both solstices', () => {
  const jun = at(TOKYO, '2026-06-21');
  near(jun.sunrise, '2026-06-21T04:25', 'Tokyo Jun sunrise');
  near(jun.sunset, '2026-06-21T19:00', 'Tokyo Jun sunset');
  const dec = at(TOKYO, '2026-12-21');
  near(dec.sunrise, '2026-12-21T06:47', 'Tokyo Dec sunrise');
  near(dec.sunset, '2026-12-21T16:32', 'Tokyo Dec sunset');
  near(dec.civilDawn, '2026-12-21T06:19', 'Tokyo Dec civil dawn');
  near(dec.civilDusk, '2026-12-21T16:59', 'Tokyo Dec civil dusk');
});

test('Reykjavik: sunset after midnight in June (white night), a short December day', () => {
  const jun = at(REYKJAVIK, '2026-06-21');
  near(jun.sunrise, '2026-06-21T02:55', 'Reykjavik Jun sunrise');
  near(jun.sunset, '2026-06-22T00:03', 'Reykjavik Jun sunset (next calendar day)');
  assert.equal(jun.polar, null);
  assert.equal(jun.twilightAllNight, true);
  assert.equal(jun.civilDawn, null);
  assert.equal(jun.civilDusk, null);
  const dec = at(REYKJAVIK, '2026-12-21');
  near(dec.sunrise, '2026-12-21T11:22', 'Reykjavik Dec sunrise');
  near(dec.sunset, '2026-12-21T15:29', 'Reykjavik Dec sunset');
  assert.ok(Math.abs(dec.daylightMin - 247) <= 3, String(dec.daylightMin));
});

test('London midsummer in BST', () => {
  const s = at(LONDON, '2026-06-21');
  near(s.sunrise, '2026-06-21T04:43', 'London sunrise');
  near(s.sunset, '2026-06-21T21:21', 'London sunset');
});

test('polar night and polar day: a flag, no sunrise or sunset', () => {
  const night = at(TROMSO, '2026-12-21');
  assert.equal(night.polar, 'night');
  assert.equal(night.sunrise, null);
  assert.equal(night.sunset, null);
  assert.equal(night.daylightMin, 0);
  assert.ok(night.civilDawn && night.civilDusk, 'Tromsø still has civil twilight around noon');
  const day = at(TROMSO, '2026-06-21');
  assert.equal(day.polar, 'day');
  assert.equal(day.sunrise, null);
  assert.equal(day.daylightMin, 1440);
  assert.equal(day.twilightAllNight, true);
  // Svalbard in deep polar night has no civil twilight at all; McMurdo in its summer has the sun up all day.
  const deep = at(LONGYEARBYEN, '2026-12-21');
  assert.equal(deep.polar, 'night');
  assert.equal(deep.civilDawn, null);
  assert.equal(deep.twilightAllNight, false);
  assert.equal(at(MCMURDO, '2026-12-21').polar, 'day');
  assert.equal(at(MCMURDO, '2026-06-21').polar, 'night');
});

test('times are wall clocks in the place zone and on its own date', () => {
  const s = at(TOKYO, '2026-11-01');
  assert.equal(s.sunrise!.slice(0, 10), '2026-11-01');
  assert.equal(s.sunset!.slice(0, 10), '2026-11-01');
  assert.ok(s.solarNoon > s.sunrise! && s.solarNoon < s.sunset!);
  assert.equal(s.tz, 'Asia/Tokyo');
});

test('bad input is null, never a throw', () => {
  assert.equal(sunDay(91, 0, '2026-01-01', 'UTC'), null);
  assert.equal(sunDay(0, 200, '2026-01-01', 'UTC'), null);
  assert.equal(sunDay(0, 0, '1 Jan', 'UTC'), null);
  assert.equal(sunDay(0, 0, '2026-01-01', 'Not/AZone'), null);
});

test('light left: minutes to sunset while the sun is up, null otherwise, Infinity in polar day', () => {
  const s = at(TOKYO, '2026-12-21');
  const before = toUtc({ local: '2026-12-21T05:00', tz: TOKYO.tz });
  assert.equal(lightLeftMin(s, before), null);
  const afternoon = s.sunsetUtc! - (3 * 60 + 10) * 60_000;
  assert.equal(lightLeftMin(s, afternoon), 190);
  assert.equal(lightLeftMin(s, s.sunsetUtc! + 1), null);
  assert.equal(lightLeftMin(at(TROMSO, '2026-12-21'), before), null);
  assert.equal(lightLeftMin(at(TROMSO, '2026-06-21'), before), Infinity);
  assert.equal(formatSpan(190), '3 h 10 m');
  assert.equal(formatSpan(45), '45 m');
  assert.equal(formatSpan(-5), '0 m');
});
