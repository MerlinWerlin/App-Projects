// T139 Photo light: golden and blue hour from the T70 solar model, on each place's own zone. Checks the band edges
// (elevation at each window edge), the order of the day, and the polar, southern, half-hour zone, DST and date-line
// cases. The sun model itself is checked against almanac times in sun.test.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Item, Trip } from './model.ts';
import {
  arcSpan,
  BLUE_LOW,
  blueWindows,
  briefLight,
  defaultLightDate,
  goldenWindows,
  GOLDEN_HIGH,
  GOLDEN_LOW,
  lightDates,
  lightDayFor,
  lightLeftToday,
  nextGoodLight,
  photoDay,
  solarElevation,
  spotLight,
  sunArc,
  windowAt,
  zoneForSpot,
  type PhotoDay,
} from './photolight.ts';
import { toUtc, wallMs } from './tz.ts';

const MIN = 60_000;
const SINGAPORE = { lat: 1.3521, lon: 103.8198, tz: 'Asia/Singapore' };
const QUITO = { lat: -0.1807, lon: -78.4678, tz: 'America/Guayaquil' };
const SYDNEY = { lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' };
const TROMSO = { lat: 69.6492, lon: 18.9553, tz: 'Europe/Oslo' };
const LONGYEARBYEN = { lat: 78.2232, lon: 15.6267, tz: 'Arctic/Longyearbyen' };
const REYKJAVIK = { lat: 64.1466, lon: -21.9426, tz: 'Atlantic/Reykjavik' };
const MUMBAI = { lat: 19.076, lon: 72.8777, tz: 'Asia/Kolkata' };
const ADELAIDE = { lat: -34.9285, lon: 138.6007, tz: 'Australia/Adelaide' };
const LONDON = { lat: 51.5074, lon: -0.1278, tz: 'Europe/London' };
const NEW_YORK = { lat: 40.7128, lon: -74.006, tz: 'America/New_York' };
const SANTIAGO = { lat: -33.4489, lon: -70.6693, tz: 'America/Santiago' };
const APIA = { lat: -13.8333, lon: -171.7667, tz: 'Pacific/Apia' };
const PAGO_PAGO = { lat: -14.2756, lon: -170.702, tz: 'Pacific/Pago_Pago' };
const KIRITIMATI = { lat: 1.8721, lon: -157.4278, tz: 'Pacific/Kiritimati' };

type P = { lat: number; lon: number; tz: string };
const at = (p: P, date: string): PhotoDay => {
  const d = photoDay(p.lat, p.lon, date, p.tz);
  assert.ok(d, `${p.tz} ${date}`);
  return d;
};

/** Every window edge that isn't midnight sits on its band edge (within 0.15 degrees). */
function edgesOnBands(d: PhotoDay) {
  for (const w of d.windows) {
    const lo = w.kind === 'blue' ? BLUE_LOW : GOLDEN_LOW;
    const hi = w.kind === 'blue' ? GOLDEN_LOW : GOLDEN_HIGH;
    for (const [utc, clipped] of [
      [w.startUtc, w.fromMidnight],
      [w.endUtc, w.toMidnight],
    ] as const) {
      if (clipped) continue;
      const el = solarElevation(d.lat, d.lon, utc);
      assert.ok(Math.min(Math.abs(el - lo), Math.abs(el - hi)) < 0.15, `${w.kind} ${w.part} edge at ${el.toFixed(2)} deg`);
    }
    assert.ok(w.endUtc > w.startUtc);
  }
}

/** Blue, golden (morning), golden, blue (evening) in that order, each touching the next where they meet. */
function ordinaryDay(d: PhotoDay) {
  assert.equal(d.note, null);
  assert.deepEqual(
    d.windows.map((w) => `${w.part}:${w.kind}`),
    ['morning:blue', 'morning:golden', 'evening:golden', 'evening:blue'],
  );
  const [b1, g1, g2, b2] = d.windows;
  assert.equal(b1.endUtc, g1.startUtc);
  assert.equal(g2.endUtc, b2.startUtc);
  assert.ok(d.sun.sunriseUtc! > g1.startUtc && d.sun.sunriseUtc! < g1.endUtc, 'sunrise falls in the morning golden hour');
  assert.ok(d.sun.sunsetUtc! > g2.startUtc && d.sun.sunsetUtc! < g2.endUtc, 'sunset falls in the evening golden hour');
  edgesOnBands(d);
}

const mins = (a: number, b: number) => (b - a) / MIN;
const near = (a: string, b: string, tol: number, what: string) => assert.ok(Math.abs(wallMs(a) - wallMs(b)) / MIN <= tol, `${what}: got ${a}, want ${b} ±${tol}`);

test('equator: four short windows, the sun climbs steeply (about 40 min golden, under 10 min blue)', () => {
  for (const [p, date] of [
    [SINGAPORE, '2026-03-20'],
    [QUITO, '2026-06-21'],
  ] as const) {
    const d = at(p, date);
    ordinaryDay(d);
    for (const g of goldenWindows(d)) assert.ok(mins(g.startUtc, g.endUtc) > 36 && mins(g.startUtc, g.endUtc) < 46, `${p.tz} golden ${mins(g.startUtc, g.endUtc)}`);
    for (const b of blueWindows(d)) assert.ok(mins(b.startUtc, b.endUtc) > 6 && mins(b.startUtc, b.endUtc) < 11, `${p.tz} blue ${mins(b.startUtc, b.endUtc)}`);
  }
  // Singapore in March: sunrise near 07:08, so golden hour starts near 06:56 local.
  near(at(SINGAPORE, '2026-03-20').windows[1].start, '2026-03-20T06:56', 3, 'Singapore golden start');
});

test('high latitude summer: Tromsø white night (golden across midnight, no blue), Longyearbyen no golden hour at all', () => {
  const tromso = at(TROMSO, '2026-06-21');
  assert.equal(tromso.sun.polar, 'day');
  assert.equal(tromso.note, 'noBlue');
  assert.equal(blueWindows(tromso).length, 0);
  const g = goldenWindows(tromso);
  assert.equal(g.length, 2);
  assert.ok(g[0].fromMidnight && !g[0].toMidnight);
  assert.ok(g[1].toMidnight && !g[1].fromMidnight);
  edgesOnBands(tromso);

  const svalbard = at(LONGYEARBYEN, '2026-06-21');
  assert.equal(svalbard.sun.polar, 'day');
  assert.equal(svalbard.note, 'noGolden');
  assert.deepEqual(svalbard.windows, []);
  assert.ok(svalbard.minElevation > GOLDEN_HIGH);

  // Reykjavik in June has a sunrise and a sunset, but the sun never gets to -4: golden light all night.
  const rey = at(REYKJAVIK, '2026-06-21');
  assert.equal(rey.sun.polar, null);
  assert.equal(rey.note, 'noBlue');
  assert.equal(blueWindows(rey).length, 0);
});

test('high latitude winter: Tromsø polar night has blue and a little golden light at midday; Longyearbyen none', () => {
  const tromso = at(TROMSO, '2026-12-21');
  assert.equal(tromso.sun.polar, 'night');
  assert.equal(tromso.sun.sunset, null);
  assert.equal(tromso.note, 'lowSun');
  assert.deepEqual(
    tromso.windows.map((w) => `${w.part}:${w.kind}`),
    ['morning:blue', 'midday:golden', 'evening:blue'],
  );
  edgesOnBands(tromso);

  const svalbard = at(LONGYEARBYEN, '2026-12-21');
  assert.equal(svalbard.note, 'dark');
  assert.deepEqual(svalbard.windows, []);
  assert.equal(nextGoodLight(LONGYEARBYEN.lat, LONGYEARBYEN.lon, LONGYEARBYEN.tz, toUtc({ local: '2026-12-21T12:00', tz: LONGYEARBYEN.tz })), null);
});

test('southern hemisphere: Sydney midsummer (AEDT), long golden hours and a late sunset', () => {
  const d = at(SYDNEY, '2026-12-21');
  ordinaryDay(d);
  const [, g1, g2] = d.windows;
  // Sunset near 20:05 (sun.test.ts); golden hour about 19:29 to 20:23.
  near(g2.start, '2026-12-21T19:29', 4, 'Sydney evening golden start');
  near(g2.end, '2026-12-21T20:23', 4, 'Sydney evening golden end');
  assert.ok(mins(g1.startUtc, g1.endUtc) > 45, 'mid latitudes: slower sun, longer golden hour than the equator');
  // Midwinter: the same order, a shorter day.
  ordinaryDay(at(SYDNEY, '2026-06-21'));
});

test('half-hour zones: Mumbai (UTC+5:30) and Adelaide (UTC+10:30 in summer) read on their own clock', () => {
  const mum = at(MUMBAI, '2026-03-20');
  ordinaryDay(mum);
  // Sunrise about 06:42 IST: golden from about 06:29.
  near(mum.windows[1].start, '2026-03-20T06:29', 4, 'Mumbai golden start');
  assert.equal(toUtc({ local: mum.windows[1].start, tz: MUMBAI.tz }), Math.round(mum.windows[1].startUtc / MIN) * MIN);
  const adl = at(ADELAIDE, '2026-12-21');
  ordinaryDay(adl);
  assert.equal(adl.dayEndUtc - adl.dayStartUtc, 24 * 60 * MIN);
  assert.equal(toUtc({ local: adl.windows[2].start, tz: ADELAIDE.tz }), Math.round(adl.windows[2].startUtc / MIN) * MIN);
});

test('DST days: 23 h (London spring forward), 25 h (New York fall back), a skipped midnight (Santiago)', () => {
  const lon = at(LONDON, '2026-03-29');
  ordinaryDay(lon);
  assert.equal(lon.dayEndUtc - lon.dayStartUtc, 23 * 60 * MIN);
  // After the change, evening times are in BST: golden ends near 19:49.
  near(lon.windows[2].end, '2026-03-29T19:49', 4, 'London evening golden end');
  const ny = at(NEW_YORK, '2026-11-01');
  ordinaryDay(ny);
  assert.equal(ny.dayEndUtc - ny.dayStartUtc, 25 * 60 * MIN);
  near(ny.windows[2].start, '2026-11-01T16:13', 4, 'New York evening golden start (EST)');
  // Chile moves its clocks at midnight: the local day starts at 01:00.
  const scl = at(SANTIAGO, '2026-09-06');
  ordinaryDay(scl);
  assert.equal(scl.dayEndUtc - scl.dayStartUtc, 23 * 60 * MIN);
});

test('date line: Apia (UTC+13) and Pago Pago (UTC-11) share a sky a calendar day apart; Kiritimati (UTC+14)', () => {
  const apia = at(APIA, '2026-03-21');
  const pago = at(PAGO_PAGO, '2026-03-20');
  ordinaryDay(apia);
  ordinaryDay(pago);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(mins(apia.windows[i].startUtc, pago.windows[i].startUtc)) < 8, `window ${i} instants`);
    near(apia.windows[i].start.replace('2026-03-21', '2026-03-20'), pago.windows[i].start, 8, `window ${i} wall clocks`);
  }
  const kir = at(KIRITIMATI, '2026-03-20');
  ordinaryDay(kir);
  assert.ok(kir.windows[0].start.startsWith('2026-03-20T06'), kir.windows[0].start);
});

test('bad input is refused, never thrown', () => {
  assert.equal(photoDay(91, 0, '2026-01-01', 'UTC'), null);
  assert.equal(photoDay(0, 0, '2026-1-1', 'UTC'), null);
  assert.equal(photoDay(0, 0, '2026-01-01', 'Mars/Olympus'), null);
});

test('light left today, the window now, and the next good light', () => {
  const d = at(SYDNEY, '2026-12-21');
  const [b1, g1, g2, b2] = d.windows;
  const noon = toUtc({ local: '2026-12-21T12:00', tz: SYDNEY.tz });
  const left = lightLeftToday(d, noon);
  assert.equal(left.goldenMin, Math.floor(mins(g2.startUtc, g2.endUtc)));
  assert.equal(left.blueMin, Math.floor(mins(b2.startUtc, b2.endUtc)));
  assert.equal(left.goodMin, left.goldenMin + left.blueMin);
  assert.ok(left.daylightMin !== null && left.daylightMin > 400);
  const mid = g2.startUtc + 10 * MIN;
  assert.equal(windowAt(d, mid), g2);
  assert.equal(lightLeftToday(d, mid).goldenMin, Math.floor(mins(mid, g2.endUtc)));
  assert.equal(windowAt(d, noon), null);
  const before = lightLeftToday(d, b1.startUtc - MIN);
  assert.equal(before.daylightMin, null);
  assert.ok(before.goodMin > 100);

  const n = nextGoodLight(SYDNEY.lat, SYDNEY.lon, SYDNEY.tz, noon);
  assert.ok(n && n.state === 'next' && n.window.startUtc === g2.startUtc);
  assert.equal(n.minutes, Math.ceil(mins(noon, g2.startUtc)));
  const inBlue = nextGoodLight(SYDNEY.lat, SYDNEY.lon, SYDNEY.tz, b2.startUtc + MIN);
  assert.ok(inBlue && inBlue.state === 'now' && inBlue.window.kind === 'blue');
  // Golden only, late evening: tomorrow morning's.
  const late = nextGoodLight(SYDNEY.lat, SYDNEY.lon, SYDNEY.tz, b2.endUtc + MIN, ['golden']);
  assert.ok(late && late.state === 'next' && late.window.start.startsWith('2026-12-22') && late.window.part === 'morning');
  assert.ok(g1.endUtc < g2.startUtc);
});

test('next good light joins a white night across midnight into one spell', () => {
  const evening = at(TROMSO, '2026-06-21').windows[1];
  const n = nextGoodLight(TROMSO.lat, TROMSO.lon, TROMSO.tz, evening.startUtc + 30 * MIN);
  assert.ok(n && n.state === 'now');
  assert.ok(n.window.start.startsWith('2026-06-21') && n.window.end.startsWith('2026-06-22'), `${n.window.start} ${n.window.end}`);
  // High summer with no golden hour at all within the search: nothing.
  assert.equal(nextGoodLight(LONGYEARBYEN.lat, LONGYEARBYEN.lon, LONGYEARBYEN.tz, toUtc({ local: '2026-06-21T12:00', tz: LONGYEARBYEN.tz })), null);
});

test('sun arc: before, up (0..1), after, polar day and polar night; golden spans above the horizon', () => {
  const d = at(SYDNEY, '2026-12-21');
  assert.deepEqual(sunArc(d, d.sun.sunriseUtc! - MIN), { state: 'before', f: 0 });
  assert.deepEqual(sunArc(d, d.sun.sunsetUtc!), { state: 'after', f: 1 });
  const up = sunArc(d, (d.sun.sunriseUtc! + d.sun.sunsetUtc!) / 2);
  assert.equal(up.state, 'up');
  assert.ok(Math.abs(up.f - 0.5) < 1e-9);
  const [b1, g1, g2] = d.windows;
  assert.equal(arcSpan(d, b1), null, 'blue hour is below the horizon');
  const s1 = arcSpan(d, g1);
  const s2 = arcSpan(d, g2);
  assert.ok(s1 && s1[0] === 0 && s1[1] > 0 && s1[1] < 0.2);
  assert.ok(s2 && s2[1] === 1 && s2[0] > 0.8);
  const polar = at(TROMSO, '2026-06-21');
  assert.equal(sunArc(polar, polar.dayStartUtc).state, 'polarDay');
  assert.ok(arcSpan(polar, polar.windows[0]));
  const night = at(TROMSO, '2026-12-21');
  assert.deepEqual(sunArc(night, night.peakUtc), { state: 'polarNight', f: 0.5 });
  assert.equal(arcSpan(night, night.windows[1]), null);
});

// ---- trips

const stamp = (local: string, tz: string) => ({ local, tz });
const hotel = (id: string, name: string, lat: number, lon: number, tz: string, from: string, to: string): Item =>
  ({ id, tripId: 'T', kind: 'hotel', title: name, start: stamp(`${from}T15:00`, tz), end: stamp(`${to}T10:00`, tz), place: { name, lat, lon } }) as unknown as Item;
const trip = (items: Item[], extra: Partial<Trip> = {}): Trip =>
  ({ id: 'T', name: 'Japan and Sydney', startDate: '2026-12-18', endDate: '2026-12-24', homeTz: 'Australia/Sydney', items, ...extra }) as unknown as Trip;
const TRIP = trip([
  hotel('h1', 'Sydney hotel', SYDNEY.lat, SYDNEY.lon, SYDNEY.tz, '2026-12-18', '2026-12-20'),
  hotel('h2', 'Kyoto inn', 35.0116, 135.7681, 'Asia/Tokyo', '2026-12-20', '2026-12-24'),
]);

test('trip days: each day at its own stay, in its own zone', () => {
  assert.equal(lightDates(TRIP).length, 7);
  const now = toUtc({ local: '2026-12-01T12:00', tz: SYDNEY.tz });
  const d18 = lightDayFor(TRIP, '2026-12-18', now);
  assert.ok(d18 && d18.place.name === 'Sydney hotel' && d18.day.tz === SYDNEY.tz);
  const d22 = lightDayFor(TRIP, '2026-12-22', now);
  assert.ok(d22 && d22.place.name === 'Kyoto inn' && d22.day.tz === 'Asia/Tokyo');
  assert.equal(lightDayFor(trip([]), '2026-12-22', now), null);
  assert.equal(defaultLightDate(TRIP, now), '2026-12-18');
  assert.equal(defaultLightDate(TRIP, toUtc({ local: '2026-12-21T09:00', tz: 'Asia/Tokyo' })), '2026-12-21');
  assert.equal(defaultLightDate(TRIP, toUtc({ local: '2027-01-21T09:00', tz: 'Asia/Tokyo' })), '2026-12-24');
});

test('Your day row: today’s golden hour still to come or under way, gone once it is over', () => {
  const morning = toUtc({ local: '2026-12-22T09:00', tz: 'Asia/Tokyo' });
  const b = briefLight(TRIP, '2026-12-22', morning);
  assert.ok(b && b.state === 'next' && b.window.part === 'evening' && b.place.name === 'Kyoto inn');
  const during = briefLight(TRIP, '2026-12-22', b.window.startUtc + 5 * MIN);
  assert.ok(during && during.state === 'now');
  assert.equal(briefLight(TRIP, '2026-12-22', b.window.endUtc + MIN), null);
});

test('saved places and ideas take the nearest stop’s zone; the date follows the trip', () => {
  const now = toUtc({ local: '2026-12-01T12:00', tz: SYDNEY.tz });
  const nara = { lat: 34.6851, lon: 135.8048 };
  assert.equal(zoneForSpot(TRIP, nara, now), 'Asia/Tokyo');
  assert.equal(zoneForSpot(TRIP, { lat: -33.9, lon: 151.3 }, now), SYDNEY.tz);
  assert.equal(zoneForSpot(trip([], { homeTz: 'Europe/London' }), nara, now), 'Europe/London');
  const before = spotLight(TRIP, nara, null, now);
  assert.ok(before && before.date === '2026-12-18' && before.tz === 'Asia/Tokyo');
  const planned = spotLight(TRIP, nara, '2026-12-23', now);
  assert.ok(planned && planned.date === '2026-12-23');
  assert.equal(spotLight(TRIP, { lat: 200, lon: 0 }, null, now), null);
});
