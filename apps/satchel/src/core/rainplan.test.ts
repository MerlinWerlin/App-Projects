import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item, Trip } from './model.ts';
import type { Idea } from './ideas.ts';
import { draftFromIdea, ideaFromDraft, readFileIdeas, readIdeas } from './ideas.ts';
import { guessSetting, markOf, readPlanSetting } from './plansetting.ts';
import {
  applyUndo,
  briefRain,
  daytime,
  driestDay,
  forecastAge,
  ideaMark,
  itemMark,
  itemWindow,
  movePlan,
  outdoorPlans,
  rainByDay,
  rainFlags,
  setIdeaSetting,
  setItemSetting,
  sourceFor,
  swapToIdea,
  windowOn,
  windowWeather,
  type RainSource,
} from './rainplan.ts';
import type { Forecast, ForecastPoint } from './weather.ts';
import { toUtc } from './tz.ts';
import { buildTripFile, parseTripFileText } from './tripfile.ts';

const H = 3_600_000;
const PARIS = { lat: 48.8566, lon: 2.3522 };
const LYON = { lat: 45.764, lon: 4.8357 };

/** Hourly forecast from `fromUtc` for `hours` hours; `wet(i, at)` gives the symbol for each hour. */
function forecast(fromUtc: number, hours: number, wet: (at: number) => string, asOf = fromUtc, precip?: (at: number) => number): Forecast {
  const points: ForecastPoint[] = [];
  for (let i = 0; i < hours; i++) {
    const at = fromUtc + i * H;
    const symbol = wet(at);
    points.push({ at, temp: 12, hours: 1, symbol, precip: precip ? precip(at) : symbol.includes('rain') ? 1.2 : 0, tMax: null, tMin: null });
  }
  return { asOf, points };
}

const at = (local: string, tz = 'Europe/Paris') => toUtc({ local, tz });
/** Rain in these [from, to) local spans (Paris), clear otherwise. */
const rainIn = (...spans: [string, string][]) => (u: number) => (spans.some(([a, b]) => u >= at(a) && u < at(b)) ? 'rain' : 'clearsky_day');

const activity = (id: string, title: string, start: string, end?: string, extra: Partial<Item> = {}, tz = 'Europe/Paris'): Item => ({
  id,
  tripId: 't1',
  kind: 'activity',
  title,
  start: { local: start, tz },
  ...(end ? { end: { local: end, tz } } : {}),
  place: { id: `pl_${id}`, name: title, ...PARIS },
  attachments: [],
  ...extra,
});

const trip = (extra: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Paris',
  startDate: '2027-04-01',
  endDate: '2027-04-06',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: '2027-01-01T00:00:00.000Z',
  ...extra,
});

const source = (f: Forecast | null, extra: Partial<RainSource> = {}): RainSource => ({ key: 'paris', name: 'Paris', ...PARIS, tz: 'Europe/Paris', fromDate: '2027-04-01', toDate: '2027-04-06', forecast: f, fromCache: true, ...extra });

const NOW = at('2027-04-01T07:00');
const idea = (id: string, name: string, extra: Partial<Idea> = {}): Idea => ({ id, name, category: 'see', createdAt: '2027-03-01T00:00:00.000Z', ...extra });

// ---- marks ----

test('guessSetting: word lists, explicit words win, unclear names stay unknown', () => {
  assert.equal(guessSetting('Hike to the waterfall'), 'outdoor');
  assert.equal(guessSetting('Louvre Museum'), 'indoor');
  assert.equal(guessSetting('Jardin du Luxembourg', 'Luxembourg gardens'), 'outdoor');
  assert.equal(guessSetting('Indoor climbing'), 'indoor');
  assert.equal(guessSetting('Open-air museum'), 'outdoor');
  assert.equal(guessSetting('Surf class'), null);
  assert.equal(guessSetting('Dinner with Sam'), null);
  assert.equal(guessSetting('Musée d’Orsay gallery'), 'indoor');
  assert.equal(guessSetting(''), null);
});

test('marks: the traveller’s own wins over a guess; eat / shop ideas read as indoor', () => {
  assert.deepEqual(itemMark({ title: 'Park picnic' }), { setting: 'outdoor', guessed: true });
  assert.deepEqual(itemMark({ title: 'Park picnic', setting: 'indoor' }), { setting: 'indoor', guessed: false });
  assert.deepEqual(ideaMark({ name: 'Ramen alley', category: 'eat' }), { setting: 'indoor', guessed: true });
  assert.deepEqual(ideaMark({ name: 'Somewhere', category: 'see' }), { setting: null, guessed: false });
  assert.deepEqual(markOf('sideways', null), { setting: null, guessed: false });
  assert.equal(readPlanSetting('outdoor'), 'outdoor');
  assert.equal(readPlanSetting(1), undefined);
});

test('setItemSetting / setIdeaSetting set and clear the mark; ideas read and save it', () => {
  const t = trip({ items: [activity('a1', 'Walk', '2027-04-02T10:00')], ideas: [idea('i1', 'Spot')] });
  assert.equal(setItemSetting(t, 'a1', 'indoor').items[0].setting, 'indoor');
  assert.equal('setting' in setItemSetting(setItemSetting(t, 'a1', 'indoor'), 'a1', null).items[0], false);
  assert.equal(setItemSetting(t, 'nope', 'indoor'), t);
  const marked = setIdeaSetting(t, 'i1', 'outdoor', 'x');
  assert.equal(readIdeas(marked)[0].setting, 'outdoor');
  assert.equal(readIdeas(setIdeaSetting(marked, 'i1', null))[0].setting, undefined);
  // The idea form: the draft carries it; a draft without the field keeps the idea's mark.
  const i = readIdeas(marked)[0];
  assert.equal(ideaFromDraft({ ...draftFromIdea(i), setting: 'indoor' }, () => 'n', i).setting, 'indoor');
  assert.equal(ideaFromDraft({ ...draftFromIdea(i), setting: '' }, () => 'n', i).setting, undefined);
  const { setting: _s, ...older } = draftFromIdea(i);
  assert.equal(ideaFromDraft(older, () => 'n', i).setting, 'outdoor');
  // A damaged mark in a file is dropped, the idea kept.
  assert.deepEqual(readFileIdeas([{ ...i, setting: 'roof' }])?.map((x) => x.setting), [undefined]);
});

test('.satchel: an item’s mark travels; a damaged one is dropped without refusing the file', () => {
  const t = trip({ items: [activity('a1', 'Boat trip', '2027-04-02T10:00', '2027-04-02T12:00', { setting: 'outdoor' })] });
  const built = buildTripFile(t, {}, { packing: null, now: '2027-03-10T00:00:00.000Z' });
  const ok = parseTripFileText(JSON.stringify(built.file));
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.file.items[0].setting, 'outdoor');
  const bad = structuredClone(built.file) as unknown as { items: Record<string, unknown>[] };
  bad.items[0].setting = 'roof';
  const r = parseTripFileText(JSON.stringify(bad));
  assert.ok(r.ok);
  if (r.ok) assert.equal('setting' in r.file.items[0], false);
});

// ---- forecast windows ----

test('windowWeather: wet start, worst kind, coverage; 6-hour steps never counted twice', () => {
  const f = forecast(at('2027-04-02T00:00'), 24, rainIn(['2027-04-02T14:00', '2027-04-02T16:00']));
  const w = windowWeather(f, at('2027-04-02T13:00'), at('2027-04-02T17:00'));
  assert.equal(w.coverage, 'full');
  assert.equal(w.wetFrom, at('2027-04-02T14:00'));
  assert.equal(w.group, 'rain');
  assert.equal(w.wetHours, 2);
  assert.equal(w.mm, 2.4);
  assert.equal(windowWeather(f, at('2027-04-03T10:00'), at('2027-04-03T12:00')).coverage, 'none');
  assert.equal(windowWeather(f, at('2027-04-02T22:00'), at('2027-04-03T02:00')).coverage, 'part');
  // Thunder beats rain; a symbol-less step counts by its mm.
  const mixed: Forecast = {
    asOf: 0,
    points: [
      { at: at('2027-04-02T10:00'), temp: 1, hours: 1, symbol: 'lightrain', precip: 0.4, tMax: null, tMin: null },
      { at: at('2027-04-02T11:00'), temp: 1, hours: 1, symbol: 'rainandthunder', precip: 3, tMax: null, tMin: null },
      { at: at('2027-04-02T11:00'), temp: 1, hours: 6, symbol: 'clearsky_day', precip: 0, tMax: null, tMin: null },
      { at: at('2027-04-02T12:00'), temp: 1, hours: 6, symbol: null, precip: 6, tMax: null, tMin: null },
    ],
  };
  const m = windowWeather(mixed, at('2027-04-02T10:00'), at('2027-04-02T18:00'));
  assert.equal(m.group, 'thunder');
  assert.equal(m.wetHours, 8);
});

test('forecastAge: just now, minutes, hours, days', () => {
  assert.deepEqual(forecastAge(0, 2 * 60_000), { unit: 'now', n: 0 });
  assert.deepEqual(forecastAge(0, 20 * 60_000), { unit: 'min', n: 20 });
  assert.deepEqual(forecastAge(0, 5 * H), { unit: 'h', n: 5 });
  assert.deepEqual(forecastAge(0, 75 * H), { unit: 'd', n: 3 });
});

// ---- flags ----

const wetAfternoon = forecast(at('2027-04-01T00:00'), 24 * 6, rainIn(['2027-04-02T14:00', '2027-04-02T16:00']));

test('no forecast: nothing is flagged (no stops, nothing cached, or the day beyond the forecast)', () => {
  const t = trip({ items: [activity('a1', 'Park picnic', '2027-04-02T13:00', '2027-04-02T17:00')] });
  assert.deepEqual(rainFlags(t, '2027-04-02', [], NOW), []);
  assert.deepEqual(rainFlags(t, '2027-04-02', [source(null)], NOW), []);
  assert.equal(rainByDay(t, ['2027-04-02'], [source(null)], NOW).size, 0);
  const short = forecast(at('2027-04-01T00:00'), 24, () => 'rain');
  assert.deepEqual(rainFlags(t, '2027-04-02', [source(short)], NOW), []);
});

test('rain inside the plan’s hours flags it with the time on its own clock; rain outside does not', () => {
  const t = trip({
    items: [
      activity('a1', 'Park picnic', '2027-04-02T13:00', '2027-04-02T17:00'),
      activity('a2', 'Walking tour', '2027-04-02T09:00', '2027-04-02T12:00'),
      activity('a3', 'Hike after the rain', '2027-04-02T16:00', '2027-04-02T18:00'),
      activity('a4', 'Louvre Museum', '2027-04-02T13:00', '2027-04-02T17:00'),
      activity('a5', 'Garden, marked indoor', '2027-04-02T13:00', '2027-04-02T17:00', { setting: 'indoor' }),
    ],
  });
  const flags = rainFlags(t, '2027-04-02', [source(wetAfternoon)], NOW);
  assert.deepEqual(flags.map((f) => f.plan.id), ['a1']);
  const f = flags[0];
  assert.equal(f.wetLocal, '14:00');
  assert.equal(f.fromStart, false);
  assert.equal(f.group, 'rain');
  assert.equal(f.plan.allDay, false);
  assert.equal(f.plan.mark.guessed, true);
  assert.equal(f.freshness, 'cached');
  // No end: DEFAULT_ACTIVITY_MIN (2 h) from the start.
  const noEnd = trip({ items: [activity('b1', 'Boat trip', '2027-04-02T12:30')] });
  assert.equal(rainFlags(noEnd, '2027-04-02', [source(wetAfternoon)], NOW)[0]?.wetLocal, '14:00');
  const early = trip({ items: [activity('b2', 'Boat trip', '2027-04-02T11:00')] });
  assert.deepEqual(rainFlags(early, '2027-04-02', [source(wetAfternoon)], NOW), []);
  // A plan already over is left out; one under way is checked from now ("Rain during").
  assert.deepEqual(rainFlags(t, '2027-04-02', [source(wetAfternoon)], at('2027-04-02T17:30')), []);
  const during = rainFlags(t, '2027-04-02', [source(wetAfternoon)], at('2027-04-02T14:30'))[0];
  assert.equal(during.fromStart, true);
  assert.equal(during.wetLocal, '14:30');
});

test('stale forecast: still flags, marked stale with its age', () => {
  const asOf = at('2027-03-29T07:00');
  const f = forecast(at('2027-04-01T00:00'), 24 * 6, rainIn(['2027-04-02T14:00', '2027-04-02T16:00']), asOf);
  const t = trip({ items: [activity('a1', 'Park picnic', '2027-04-02T13:00', '2027-04-02T17:00')] });
  const [flag] = rainFlags(t, '2027-04-02', [source(f)], NOW);
  assert.equal(flag.freshness, 'stale');
  assert.deepEqual(flag.age, { unit: 'd', n: 3 });
  assert.equal(flag.asOf, asOf);
});

test('all-day plans: untimed ideas, saved places on the day and 00:00 activities are checked over the daytime hours', () => {
  const night = forecast(at('2027-04-01T00:00'), 24 * 6, rainIn(['2027-04-02T02:00', '2027-04-02T05:00'], ['2027-04-02T21:00', '2027-04-02T23:00']));
  const t = trip({
    items: [activity('a1', 'Beach day', '2027-04-02T00:00')],
    ideas: [idea('i1', 'Hike to the lake', { day: '2027-04-02', ...PARIS }), idea('i2', 'Ramen', { category: 'eat', day: '2027-04-02' }), idea('i3', 'Old park', { day: '2027-04-02', done: true })],
    places: [{ id: 'sp1', name: 'Parc Monceau', lat: 48.8797, lon: 2.3091, savedAt: '2027-03-01T00:00:00.000Z' }],
    dayPlans: [{ day: '2027-04-02', places: [{ placeId: 'sp1' }] }],
  });
  const plans = outdoorPlans(t, '2027-04-02', [source(night)]);
  assert.deepEqual(plans.map((p) => [p.key, p.allDay]), [['item:a1', true], ['idea:i1', true], ['place:sp1', true]]);
  assert.deepEqual(plans[0].from, at('2027-04-02T08:00'));
  assert.deepEqual(plans[0].to, at('2027-04-02T20:00'));
  assert.deepEqual(rainFlags(t, '2027-04-02', [source(night)], NOW), [], 'night rain only');
  const flags = rainFlags(t, '2027-04-02', [source(wetAfternoon)], NOW);
  assert.deepEqual(flags.map((f) => [f.plan.key, f.wetLocal]), [['idea:i1', '14:00'], ['item:a1', '14:00'], ['place:sp1', '14:00']]);
  // A multi-day activity's middle day is all-day too.
  const camp = activity('c1', 'Camping', '2027-04-01T15:00', '2027-04-03T11:00');
  assert.equal(itemWindow(camp, '2027-04-02')?.allDay, true);
  assert.equal(itemWindow(camp, '2027-04-01')?.allDay, false);
  assert.equal(itemWindow(camp, '2027-04-05'), null);
});

test('zone / DST: hours are read on the booking’s own clock across the spring-forward night', () => {
  // London springs forward 2027-03-28 01:00 GMT -> 02:00 BST: 10:00 local is 09:00 UTC that day, 10:00 UTC the day before.
  const tz = 'Europe/London';
  const LON = { lat: 51.5072, lon: -0.1276 };
  const t = trip({
    startDate: '2027-03-26',
    endDate: '2027-03-30',
    items: [activity('a1', 'Kew Gardens', '2027-03-28T10:00', '2027-03-28T12:00', { place: { id: 'p', name: 'Kew', ...LON } }, tz)],
  });
  const f = forecast(Date.UTC(2027, 2, 26), 24 * 5, (u) => (u >= Date.UTC(2027, 2, 28, 9) && u < Date.UTC(2027, 2, 28, 10) ? 'heavyrain' : 'fair_day'));
  const src = source(f, { key: 'london', ...LON, tz, fromDate: '2027-03-26', toDate: '2027-03-30' });
  const now = Date.UTC(2027, 2, 26, 6);
  const [flag] = rainFlags(t, '2027-03-28', [src], now);
  assert.equal(flag.wetLocal, '10:00');
  assert.equal(flag.fromStart, true);
  // Moving keeps 10:00 London on the new day (a different UTC instant), same zone.
  const moved = movePlan(t, flag.plan, '2027-03-27');
  assert.deepEqual(moved?.trip.items[0].start, { local: '2027-03-27T10:00', tz });
  assert.deepEqual(moved?.trip.items[0].end, { local: '2027-03-27T12:00', tz });
  assert.equal(windowOn(t, flag.plan, '2027-03-27')?.from, Date.UTC(2027, 2, 27, 10));
  // A 01:30 start moved onto the change day falls in the gap: said so.
  const gap = trip({ ...t, items: [activity('g1', 'Night walk', '2027-03-27T01:30', '2027-03-27T02:30', {}, tz)] });
  const plan = outdoorPlans(gap, '2027-03-27', [src])[0];
  assert.equal(windowOn(gap, plan, '2027-03-28')?.clock, 'skipped');
  // A zone other than the forecast place's: still its own clock (Tokyo booking, Tokyo forecast).
  const tokyo = { lat: 35.68, lon: 139.76 };
  const tt = trip({ items: [activity('k1', 'Shrine walk', '2027-04-02T09:00', '2027-04-02T11:00', { place: { id: 'p', name: 'Meiji', ...tokyo } }, 'Asia/Tokyo')] });
  const tf = forecast(Date.UTC(2027, 3, 1), 48, (u) => (u === Date.UTC(2027, 3, 2, 1) ? 'sleet' : 'cloudy'));
  const ts = source(tf, { key: 'tokyo', ...tokyo, tz: 'Asia/Tokyo' });
  const [tflag] = rainFlags(tt, '2027-04-02', [source(wetAfternoon), ts], Date.UTC(2027, 3, 1));
  assert.equal(tflag.sourceKey, 'tokyo');
  assert.equal(tflag.wetLocal, '10:00');
  assert.equal(tflag.group, 'sleet');
});

test('sourceFor: nearest cached place within reach; a far plan gets none; untimed stops use the day’s stop', () => {
  const lyon = source(wetAfternoon, { key: 'lyon', ...LYON });
  assert.equal(sourceFor({ at: PARIS, day: '2027-04-02' }, [lyon, source(wetAfternoon)])?.key, 'paris');
  assert.equal(sourceFor({ at: PARIS, day: '2027-04-02' }, [lyon]), null);
  assert.equal(sourceFor({ at: null, day: '2027-04-04' }, [source(wetAfternoon, { toDate: '2027-04-03' }), source(null, { key: 'lyon', ...LYON, fromDate: '2027-04-04' })]), null);
  const later = source(wetAfternoon, { key: 'lyon', ...LYON, fromDate: '2027-04-04' });
  assert.equal(sourceFor({ at: null, day: '2027-04-02' }, [source(wetAfternoon, { toDate: '2027-04-03' }), later])?.key, 'paris');
  assert.equal(sourceFor({ at: null, day: '2027-04-05' }, [source(wetAfternoon, { toDate: '2027-04-03' }), later])?.key, 'lyon');
});

test('indoor swaps: same city only, unplanned or that day, own marks first then nearest; none when there are none', () => {
  const base = trip({ items: [activity('a1', 'Park picnic', '2027-04-02T13:00', '2027-04-02T17:00')] });
  assert.deepEqual(rainFlags(base, '2027-04-02', [source(wetAfternoon)], NOW)[0].swaps, [], 'no indoor alternative');
  const t = trip({
    ...base,
    ideas: [
      idea('far', 'Lyon museum', { lat: LYON.lat, lon: LYON.lon, setting: 'indoor' }),
      idea('guess', 'Orsay gallery', { lat: 48.86, lon: 2.3265 }),
      idea('own', 'Covered passage', { lat: 48.87, lon: 2.34, setting: 'indoor' }),
      idea('other', 'Picasso museum', { lat: 48.8598, lon: 2.3624, day: '2027-04-04' }),
      idea('done', 'Army museum', { lat: 48.8559, lon: 2.3125, done: true }),
      idea('nospot', 'Some museum'),
      idea('out', 'Rooftop garden', { lat: 48.86, lon: 2.35 }),
    ],
  });
  const swaps = rainFlags(t, '2027-04-02', [source(wetAfternoon)], NOW)[0].swaps;
  assert.deepEqual(swaps.map((s) => [s.ideaId, s.guessed]), [['own', false], ['guess', true]]);
  assert.ok((swaps[0].m ?? 0) > 0);
  const change = swapToIdea(t, 'guess', '2027-04-02', 'now');
  assert.equal(readIdeas(change!.trip).find((i) => i.id === 'guess')?.day, '2027-04-02');
  assert.equal(readIdeas(applyUndo(change!.trip, change!.undo)).find((i) => i.id === 'guess')?.day, undefined);
});

test('driest-day pick: fewest wet hours then least rain, earliest on a tie, same city, covered days only', () => {
  const sym = rainIn(['2027-04-02T13:00', '2027-04-02T17:00'], ['2027-04-03T14:00', '2027-04-03T15:00'], ['2027-04-06T00:00', '2027-04-06T23:00']);
  const mm = (u: number) => (u >= at('2027-04-04T13:00') && u < at('2027-04-04T17:00') ? 0.1 : sym(u) === 'rain' ? 1 : 0);
  const f = forecast(at('2027-04-01T00:00'), 24 * 5 + 20, sym, at('2027-04-01T06:00'), mm);
  const t = trip({ items: [activity('a1', 'Park picnic', '2027-04-02T13:00', '2027-04-02T17:00')] });
  const now = at('2027-04-01T14:00');
  const [flag] = rainFlags(t, '2027-04-02', [source(f)], now);
  // 04-03: 1 wet hour; 04-04: dry, 0.4 mm; 04-05: dry, 0 mm (picked); 04-06: wet; 04-01 already passed.
  assert.deepEqual(flag.move, { date: '2027-04-05', dry: true, wetHours: 0, mm: 0, clock: 'normal' });
  // Another city that day is not offered.
  const lyonDay = source(null, { key: 'lyon', ...LYON, fromDate: '2027-04-05', toDate: '2027-04-05' });
  const away = rainFlags(t, '2027-04-02', [source(f, { toDate: '2027-04-04' }), lyonDay, source(null, { key: 'p2', fromDate: '2027-04-06' })], now)[0];
  assert.equal(away.move?.date, '2027-04-04');
  // Nothing drier: no move.
  const allWet = forecast(at('2027-04-01T00:00'), 24 * 6, () => 'heavyrain');
  assert.equal(rainFlags(t, '2027-04-02', [source(allWet)], now)[0].move, null);
  assert.equal(driestDay(t, flag.plan, source(null), [], now, flag), null);
  // Before 13:00 on 04-01 that day is still ahead and dry, so it is the earliest driest.
  assert.equal(rainFlags(t, '2027-04-02', [source(f)], NOW)[0].move?.date, '2027-04-01');
});

test('movePlan + applyUndo: booking on its own clock, idea to the day, saved place between day plans', () => {
  const t = trip({
    items: [activity('a1', 'Park picnic', '2027-04-02T13:00', '2027-04-02T17:00')],
    ideas: [idea('i1', 'Hike', { day: '2027-04-02', rank: 0 })],
    places: [{ id: 'sp1', name: 'Parc Monceau', lat: 48.8797, lon: 2.3091, savedAt: '2027-03-01T00:00:00.000Z' }],
    dayPlans: [{ day: '2027-04-02', places: [{ placeId: 'sp1' }], backToHotel: true }],
  });
  const a = movePlan(t, { kind: 'item', id: 'a1', day: '2027-04-02' }, '2027-04-05')!;
  assert.equal(a.trip.items[0].start.local, '2027-04-05T13:00');
  assert.equal(a.trip.items[0].end?.local, '2027-04-05T17:00');
  assert.deepEqual(applyUndo(a.trip, a.undo), t);
  const i = movePlan(t, { kind: 'idea', id: 'i1', day: '2027-04-02' }, '2027-04-04', 'now')!;
  assert.equal(readIdeas(i.trip)[0].day, '2027-04-04');
  assert.deepEqual(readIdeas(applyUndo(i.trip, i.undo)), readIdeas(t));
  const p = movePlan(t, { kind: 'place', id: 'sp1', day: '2027-04-02' }, '2027-04-03', 'now')!;
  assert.deepEqual(p.trip.dayPlans?.map((r) => [r.day, r.places]), [['2027-04-02', undefined], ['2027-04-03', [{ placeId: 'sp1' }]]]);
  assert.deepEqual(applyUndo(p.trip, p.undo).dayPlans, t.dayPlans);
  assert.equal(movePlan(t, { kind: 'item', id: 'a1', day: '2027-04-02' }, '2027-04-02'), null);
  assert.equal(movePlan(t, { kind: 'item', id: 'gone', day: '2027-04-02' }, '2027-04-03'), null);
  // A booking deleted since stays deleted.
  assert.deepEqual(applyUndo({ ...a.trip, items: [] }, a.undo).items, []);
});

test('briefRain: today’s first flag and how many more; daytime is DST-safe', () => {
  const t = trip({ items: [activity('a1', 'Park picnic', '2027-04-02T15:00', '2027-04-02T17:00'), activity('a2', 'Boat trip', '2027-04-02T13:30', '2027-04-02T15:00')] });
  const b = briefRain(t, '2027-04-02', [source(wetAfternoon)], NOW);
  assert.equal(b?.flag.plan.id, 'a2');
  assert.equal(b?.flag.wetLocal, '14:00');
  assert.equal(b?.more, 1);
  assert.equal(briefRain(t, '2027-04-03', [source(wetAfternoon)], NOW), null);
  const d = daytime('2027-03-28', 'Europe/London');
  assert.equal(d.to - d.from, 12 * H);
});
