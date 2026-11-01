// T142 run-105 follow-ups: Plan B flags dismissed on this phone (per trip, never in the trip or its file), saved
// places with their own indoor / outdoor mark (file, Plan this trip again, re-save), indoor swaps from ideas with no
// map spot by the plan's city name (accent-insensitive, after the ones within 30 km), and Photo light windows joined
// across local midnight on the day card (Tromsø, Reykjavik in summer, on their own zones).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item, Trip } from './model.ts';
import type { Idea } from './ideas.ts';
import { addPlace } from './places.ts';
import { buildTripFile, parseTripFileText } from './tripfile.ts';
import { copyTrip } from './tripcopy.ts';
import {
  briefRain,
  dismissRain,
  foldCity,
  ideaNamesCity,
  NO_RAIN_DISMISSALS,
  outdoorPlans,
  placeMark,
  planCity,
  rainDismissedFor,
  rainFlagId,
  rainFlags,
  RAIN_DISMISSED_KEY,
  restoreRain,
  setPlaceSetting,
  withoutDismissed,
  type RainSource,
} from './rainplan.ts';
import { dayWindows, photoDay, solarElevation, BLUE_LOW, GOLDEN_HIGH, GOLDEN_LOW, type PhotoDay } from './photolight.ts';
import type { Forecast, ForecastPoint } from './weather.ts';
import { addDays, localDate, toUtc } from './tz.ts';
import { followups105 } from '../i18n/en/followups105.ts';

const H = 3_600_000;
const PARIS = { lat: 48.8566, lon: 2.3522 };
const at = (local: string, tz = 'Europe/Paris') => toUtc({ local, tz });

function forecast(fromUtc: number, hours: number, wet: (at: number) => boolean): Forecast {
  const points: ForecastPoint[] = [];
  for (let i = 0; i < hours; i++) {
    const t = fromUtc + i * H;
    const w = wet(t);
    points.push({ at: t, temp: 12, hours: 1, symbol: w ? 'rain' : 'clearsky_day', precip: w ? 1.2 : 0, tMax: null, tMin: null });
  }
  return { asOf: fromUtc, points };
}
const wetAfternoon = forecast(at('2027-04-01T00:00'), 24 * 6, (u) => {
  const h = new Date(u).getUTCHours();
  return h >= 12 && h < 16;
});
const source = (extra: Partial<RainSource> = {}): RainSource => ({ key: 'paris', name: 'Paris', ...PARIS, tz: 'Europe/Paris', fromDate: '2027-04-01', toDate: '2027-04-06', forecast: wetAfternoon, fromCache: true, ...extra });
const NOW = at('2027-04-01T07:00');

const activity = (id: string, title: string, start: string, end: string, extra: Partial<Item> = {}): Item => ({
  id,
  tripId: 't1',
  kind: 'activity',
  title,
  start: { local: start, tz: 'Europe/Paris' },
  end: { local: end, tz: 'Europe/Paris' },
  place: { id: `pl_${id}`, name: title, ...PARIS },
  attachments: [],
  ...extra,
});
const trip = (extra: Partial<Trip> = {}): Trip => ({ id: 't1', name: 'Paris', startDate: '2027-04-01', endDate: '2027-04-06', homeTz: 'Australia/Sydney', items: [], createdAt: '2027-01-01T00:00:00.000Z', ...extra });
const idea = (id: string, name: string, extra: Partial<Idea> = {}): Idea => ({ id, name, category: 'see', createdAt: '2027-03-01T00:00:00.000Z', ...extra });

// ---- (1) dismiss one flag, on this phone only ----

test('rain flags: dismiss one per trip (phone-only key), count it, show the day’s again; the Your day row skips it', () => {
  assert.equal(RAIN_DISMISSED_KEY, 'satchel.rain.dismissed.v1');
  const t = trip({ items: [activity('a1', 'Park picnic', '2027-04-02T13:00', '2027-04-02T17:00'), activity('a2', 'Boat trip', '2027-04-02T14:00', '2027-04-02T15:00')] });
  const flags = rainFlags(t, '2027-04-02', [source()], NOW);
  assert.equal(flags.length, 2);
  const id = rainFlagId(flags[0]);
  assert.equal(id, 'item:a1@2027-04-02');

  let store = dismissRain(NO_RAIN_DISMISSALS, 't1', id);
  store = dismissRain(store, 't1', id); // twice: still once
  store = dismissRain(store, 'other', 'item:x@2027-04-03');
  assert.deepEqual(rainDismissedFor(store, 't1'), [id]);
  const split = withoutDismissed(flags, rainDismissedFor(store, 't1'));
  assert.deepEqual(split.flags.map((f) => f.plan.id), ['a2']);
  assert.equal(split.dismissed, 1);

  // Your day: the first flag not dismissed.
  const dayNow = at('2027-04-02T09:00');
  assert.equal(briefRain(t, '2027-04-02', [source()], dayNow)?.flag.plan.id, 'a1');
  const b = briefRain(t, '2027-04-02', [source()], dayNow, [id]);
  assert.equal(b?.flag.plan.id, 'a2');
  assert.equal(b?.more, 0);

  // Show the day's dismissed ones again; other days and trips keep theirs.
  store = dismissRain(store, 't1', 'idea:i9@2027-04-03');
  const back = restoreRain(store, 't1', '2027-04-02');
  assert.deepEqual(rainDismissedFor(back, 't1'), ['idea:i9@2027-04-03']);
  assert.deepEqual(rainDismissedFor(back, 'other'), ['item:x@2027-04-03']);
  assert.equal('t1' in restoreRain(back, 't1', '2027-04-03'), false);
  assert.equal('t1' in restoreRain(store, 't1'), false);

  // Stored data of any shape reads safely; nothing lands on the trip.
  assert.deepEqual(rainDismissedFor(null, 't1'), []);
  assert.deepEqual(rainDismissedFor({ t1: ['ok', 3, '', 'ok'] }, 't1'), ['ok']);
  assert.deepEqual(rainDismissedFor(['t1'], 't1'), []);
  assert.equal(JSON.stringify(t).includes('dismiss'), false);
});

// ---- (1) saved places carry the mark ----

test('saved places: own mark wins over the guess, set and cleared, kept on re-save, in Plan B and in .satchel', () => {
  const t0 = trip({
    places: [{ id: 'sp1', name: 'Glass pavilion', lat: 48.86, lon: 2.35, savedAt: '2027-03-01T00:00:00.000Z' }],
    dayPlans: [{ day: '2027-04-02', places: [{ placeId: 'sp1' }] }],
  });
  assert.deepEqual(placeMark({ name: 'Glass pavilion' }), { setting: null, guessed: false });
  assert.deepEqual(placeMark({ name: 'Rose garden', setting: 'indoor' }), { setting: 'indoor', guessed: false });
  assert.deepEqual(placeMark({ name: 'Rose garden', setting: 'roof' }), { setting: 'outdoor', guessed: true });
  assert.deepEqual(outdoorPlans(t0, '2027-04-02', [source()]), [], 'unclear name: not flagged');

  const t = setPlaceSetting(t0, 'sp1', 'outdoor');
  assert.equal(t.places?.[0].setting, 'outdoor');
  assert.equal(setPlaceSetting(t0, 'nope', 'outdoor'), t0);
  assert.equal('setting' in (setPlaceSetting(t, 'sp1', null).places?.[0] ?? {}), false);
  const plans = outdoorPlans(t, '2027-04-02', [source()]);
  assert.deepEqual(plans.map((p) => [p.key, p.mark.guessed]), [['place:sp1', false]]);
  assert.equal(rainFlags(t, '2027-04-02', [source()], NOW).length, 1);

  // Saving the same spot again (rename from the map) keeps the mark.
  const re = addPlace(t, { name: 'Glass pavilion (east)', lat: 48.86, lon: 2.35 }, '2027-03-02T00:00:00.000Z');
  assert.ok(re.ok);
  if (re.ok) assert.equal(re.place.setting, 'outdoor');

  // .satchel: the mark travels; a damaged one is dropped, the place and the file kept.
  const built = buildTripFile(t, {}, { packing: null, now: '2027-03-10T00:00:00.000Z' });
  const ok = parseTripFileText(JSON.stringify(built.file));
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.file.places[0].setting, 'outdoor');
  const bad = structuredClone(built.file) as unknown as { places: Record<string, unknown>[] };
  bad.places[0].setting = 'roof';
  const r = parseTripFileText(JSON.stringify(bad));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.file.places.length, 1);
    assert.equal('setting' in r.file.places[0], false);
  }

  // Plan this trip again keeps it.
  let n = 0;
  const copy = copyTrip(t, null, { name: 'Paris again', startDate: '2028-04-01', parts: { bookings: true, packing: false, bags: false, ideas: true, todos: false, companions: false, budget: false }, newId: (p) => `${p}_${++n}`, now: '2028-01-01T00:00:00.000Z' });
  assert.equal(copy.trip.places?.[0].setting, 'outdoor');
});

// ---- (2) indoor swaps by city name ----

test('city names fold accents and case; an idea names a city as whole words only', () => {
  assert.equal(foldCity('Zürich  Hauptbahnhof'), 'zurich hauptbahnhof');
  assert.equal(foldCity('MONTRÉAL, QC'), 'montreal qc');
  assert.equal(ideaNamesCity({ name: 'Kunsthaus', spotName: 'Zürich' }, 'Zurich'), true);
  assert.equal(ideaNamesCity({ name: 'Kunsthaus', spotName: 'Zurich' }, 'Zürich'), true);
  assert.equal(ideaNamesCity({ name: 'Zurichsee boat', note: undefined }, 'Zurich'), false);
  assert.equal(ideaNamesCity({ name: 'Museum', note: 'rainy day in PARIS' }, 'Paris'), true);
  assert.equal(ideaNamesCity({ name: 'Museum' }, ''), false);
});

test('indoor swaps: ideas with no map spot whose city matches the plan’s by name come after the ones within 30 km', () => {
  const picnic = activity('a1', 'Park picnic', '2027-04-02T13:00', '2027-04-02T17:00', { place: { id: 'pl', name: 'Parc des Buttes-Chaumont', address: '1 Rue Botzaris, 75019 París', ...PARIS } });
  const t = trip({
    items: [picnic],
    ideas: [
      idea('nearby', 'Covered passage', { lat: 48.87, lon: 2.34, setting: 'indoor' }),
      idea('byname', 'Orangerie museum (PARIS 1er)'), // no spot, so no spot name either (ideas.ts keeps it only with a spot)
      idea('ownname', 'Chocolate class', { note: 'Rainy-day option in paris', setting: 'indoor' }),
      idea('lyon', 'Lumière museum', { note: 'Lyon' }),
      idea('noname', 'Some gallery'),
      idea('fakeword', 'Parisian bakery tour', { setting: 'indoor' }),
      idea('done', 'Army museum', { note: 'Paris', done: true }),
      idea('elsewhere', 'Picasso museum', { note: 'Paris', day: '2027-04-04' }),
    ],
  });
  assert.equal(planCity(t, { kind: 'item', id: 'a1', day: '2027-04-02', tz: 'Europe/Paris' }), 'Paris', 'accented address folded');
  const swaps = rainFlags(t, '2027-04-02', [source()], NOW)[0].swaps;
  assert.deepEqual(
    swaps.map((s) => [s.ideaId, s.m === null, s.city ?? null]),
    [
      ['nearby', false, null],
      ['ownname', true, 'Paris'],
      ['byname', true, 'Paris'],
    ],
  );
});

test('plan city: falls back to the stay booked over that day; a city in another country than the plan is ignored', () => {
  const hotel: Item = { id: 'h1', tripId: 't1', kind: 'hotel', title: 'Hôtel du Nord', start: { local: '2027-04-01T15:00', tz: 'Europe/Zurich' }, end: { local: '2027-04-04T10:00', tz: 'Europe/Zurich' }, place: { id: 'ph', name: 'Hôtel du Nord', address: 'Bahnhofplatz 1, Zürich' }, attachments: [] };
  const hike = activity('a1', 'Lake walk', '2027-04-02T13:00', '2027-04-02T17:00', { start: { local: '2027-04-02T13:00', tz: 'Europe/Zurich' }, end: { local: '2027-04-02T17:00', tz: 'Europe/Zurich' }, place: { id: 'pl', name: 'Lake walk' } });
  const t = trip({ items: [hotel, hike] });
  assert.equal(planCity(t, { kind: 'item', id: 'a1', day: '2027-04-02', tz: 'Europe/Zurich' }), 'Zurich');
  assert.equal(planCity(t, { kind: 'item', id: 'a1', day: '2027-04-05', tz: 'Europe/Zurich' }), null, 'no stay that day');
  const named = trip({ items: [activity('a2', 'Paris street walk', '2027-04-02T13:00', '2027-04-02T17:00', { start: { local: '2027-04-02T13:00', tz: 'Europe/London' }, end: { local: '2027-04-02T17:00', tz: 'Europe/London' } })] });
  assert.equal(planCity(named, { kind: 'item', id: 'a2', day: '2027-04-02', tz: 'Europe/London' }), null, '"Paris" on a London plan is a name, not the city');
});

// ---- (3) Photo light across midnight ----

const TROMSO = { lat: 69.6492, lon: 18.9553, tz: 'Europe/Oslo' };
const REYKJAVIK = { lat: 64.1466, lon: -21.9426, tz: 'Atlantic/Reykjavik' };
type P = { lat: number; lon: number; tz: string };
const day = (p: P, date: string): PhotoDay => {
  const d = photoDay(p.lat, p.lon, date, p.tz);
  assert.ok(d, `${p.tz} ${date}`);
  return d;
};
const onBand = (p: P, utc: number) => {
  const el = solarElevation(p.lat, p.lon, utc);
  return [BLUE_LOW, GOLDEN_LOW, GOLDEN_HIGH].some((e) => Math.abs(el - e) < 0.15);
};

test('photo light: a golden hour over midnight is one window on both days (Tromsø white night, own zone)', () => {
  const d1 = day(TROMSO, '2027-06-21');
  const d2 = day(TROMSO, '2027-06-22');
  const w1 = dayWindows(d1);
  const w2 = dayWindows(d2);
  const spill = w1.find((w) => w.spills);
  const carried = w2.find((w) => w.carried);
  assert.ok(spill && carried);
  assert.equal(spill.kind, 'golden');
  assert.equal(carried.kind, 'golden');
  assert.equal(spill.startUtc, carried.startUtc, 'the same window seen from both days');
  assert.equal(spill.endUtc, carried.endUtc);
  assert.equal(localDate(spill.start), '2027-06-21');
  assert.equal(localDate(spill.end), '2027-06-22');
  assert.ok(!spill.toMidnight && !carried.fromMidnight, 'real times, not cut at midnight');
  assert.ok(onBand(TROMSO, spill.startUtc) && onBand(TROMSO, spill.endUtc), 'both ends on the +6 degree edge');
  // The clipped day windows are untouched (arc, light left, next good light still use them).
  assert.ok(d1.windows.some((w) => w.toMidnight));
});

test('photo light: Reykjavik in June (golden all night) and late July (blue hour 23:5x-00:5x) join across midnight', () => {
  const june = dayWindows(day(REYKJAVIK, '2027-06-21'));
  assert.deepEqual(june.map((w) => [w.kind, w.carried, w.spills]), [
    ['golden', true, false],
    ['golden', false, true],
  ]);
  const evening = june[1];
  assert.ok(evening.start < '2027-06-21T23:00' && evening.end > '2027-06-22T03:00', `${evening.start}–${evening.end}`);

  // Late July: the evening blue hour starts before midnight and ends after it.
  const d = day(REYKJAVIK, '2027-07-25');
  const blue = dayWindows(d).find((w) => w.kind === 'blue' && w.spills);
  assert.ok(blue, 'blue hour runs over midnight');
  assert.equal(localDate(blue.start), '2027-07-25');
  assert.equal(localDate(blue.end), '2027-07-26');
  assert.ok(blue.start.slice(11) > '23:00' && blue.end.slice(11) < '02:00', `${blue.start}–${blue.end}`);
  assert.ok(onBand(REYKJAVIK, blue.startUtc) && onBand(REYKJAVIK, blue.endUtc));
  // Before T142 the day card cut it at midnight ("from 23:5x").
  assert.ok(d.windows.some((w) => w.kind === 'blue' && w.toMidnight));
});

test('photo light: every clipped window is inside a joined one; ordinary days and the pole are unchanged', () => {
  for (const [p, first, n] of [
    [TROMSO, '2027-08-08', 10],
    [REYKJAVIK, '2027-07-20', 10],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const d = day(p, addDays(first, i));
      const joined = dayWindows(d);
      for (const w of d.windows) assert.ok(joined.some((j) => j.kind === w.kind && j.startUtc <= w.startUtc && j.endUtc >= w.endUtc), `${d.date} ${w.kind} ${w.start}`);
    }
  }
  // London in spring: nothing near midnight, so the joined list is the day's own.
  const london = day({ lat: 51.5074, lon: -0.1278, tz: 'Europe/London' }, '2027-04-10');
  assert.deepEqual(
    dayWindows(london).map((w) => [w.kind, w.startUtc, w.endUtc, w.carried, w.spills]),
    london.windows.map((w) => [w.kind, w.startUtc, w.endUtc, false, false]),
  );
  // Tromsø polar night has nothing over midnight either.
  assert.ok(dayWindows(day(TROMSO, '2027-12-21')).every((w) => !w.carried && !w.spills));
});

test('f105 strings: present and non-empty', () => {
  for (const [k, v] of Object.entries(followups105)) {
    assert.ok(k.startsWith('f105.'), k);
    assert.ok(typeof v === 'string' && v.trim().length > 0, k);
  }
  assert.ok(Object.keys(followups105).length >= 6);
});
