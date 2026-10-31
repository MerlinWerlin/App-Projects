import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { EssentialsTable } from './essentials.ts';
import type { Item, Trip } from './model.ts';
import { buildList, listFor, parseTemplates, putList, resetTicks, toggleItem, type PackList } from './packing.ts';
import {
  acceptSuggestion,
  clothesQty,
  dismissedOf,
  dismissSuggestion,
  forecastTripDays,
  homeCountryFor,
  isCovered,
  itemQty,
  LAUNDRY_EVERY_NIGHTS,
  openSuggestions,
  packingText,
  restoreSuggestions,
  ruleIndex,
  setLaundry,
  smartSuggestions,
  tripNightsInZones,
  type SmartInput,
  type Suggestion,
} from './smartpack.ts';
import type { WeatherDay } from './weather.ts';

const templates = parseTemplates(JSON.parse(readFileSync(new URL('../content/packing_templates.json', import.meta.url), 'utf8'))).templates;
const table = JSON.parse(readFileSync(new URL('../content/country_essentials.json', import.meta.url), 'utf8')) as EssentialsTable;
const tpl = (id: string) => {
  const t = templates.find((x) => x.id === id);
  assert.ok(t, id);
  return t;
};

const item = (n: number, start: [string, string], end?: [string, string], kind: Item['kind'] = 'hotel'): Item => ({
  id: `i${n}`,
  tripId: 't1',
  kind,
  title: 'x',
  start: { local: start[0], tz: start[1] },
  ...(end ? { end: { local: end[0], tz: end[1] } } : {}),
  attachments: [],
});

const trip = (startDate: string, endDate: string, items: Item[] = [], homeTz = 'Australia/Sydney'): Trip => ({
  id: 't1',
  name: 'Kyoto trip',
  startDate,
  endDate,
  homeTz,
  createdAt: '2026-10-01T00:00:00Z',
  items,
});

// English labels as the screen would give them.
const LABEL: Record<string, string> = {
  umbrella: 'Umbrella',
  rain_jacket: 'Rain jacket',
  warm_layer: 'Warm layer',
  gloves_hat: 'Gloves and warm hat',
  sun_hat: 'Sun hat',
  sunscreen: 'Sunscreen',
  eye_mask: 'Eye mask',
};
const labelOf = (s: Suggestion) => (s.kind === 'plug_adapter' ? `Plug adapter: type${(s.plugs ?? []).length > 1 ? 's' : ''} ${(s.plugs ?? []).join(', ')}` : LABEL[s.kind]);
const ids = (s: Suggestion[]) => s.map((x) => x.id);

const NOW = Date.parse('2026-11-01T00:00:00Z');
const day = (date: string, high: number, low: number, group: WeatherDay['group'] = 'cloudy', precipMm = 0): WeatherDay => ({ date, high, low, group, precipMm });

// ---------------------------------------------------------------- nights

test('nights come from the trip dates when there are no bookings; never negative; junk is 0', () => {
  assert.equal(tripNightsInZones(trip('2026-11-03', '2026-11-10')), 7);
  assert.equal(tripNightsInZones(trip('2026-11-03', '2026-11-03')), 0);
  assert.equal(tripNightsInZones(trip('2026-11-10', '2026-11-03')), 0);
  assert.equal(tripNightsInZones(trip('soon', 'later')), 0);
});

test('nights read each booking in its own zone: a flight home landing the next morning adds a night', () => {
  // Leaves Tokyo 10 Nov 21:30 Tokyo time, lands Sydney 11 Nov 08:40 Sydney time.
  const t = trip('2026-11-03', '2026-11-10', [item(0, ['2026-11-10T21:30', 'Asia/Tokyo'], ['2026-11-11T08:40', 'Australia/Sydney'], 'flight')]);
  assert.equal(tripNightsInZones(t), 8);
});

test('nights across the date line follow the printed dates, not elapsed hours', () => {
  // Sydney 10 Nov 10:00 -> Los Angeles 10 Nov 06:30 (arrives "before" it left); home LA 17 Nov 22:00 -> Sydney 19 Nov 06:00.
  const t = trip('2026-11-10', '2026-11-19', [
    item(0, ['2026-11-10T10:00', 'Australia/Sydney'], ['2026-11-10T06:30', 'America/Los_Angeles'], 'flight'),
    item(1, ['2026-11-17T22:00', 'America/Los_Angeles'], ['2026-11-19T06:00', 'Australia/Sydney'], 'flight'),
  ]);
  assert.equal(tripNightsInZones(t), 9);
});

test('a daylight-saving change mid-trip does not lose or gain a night', () => {
  // UK clocks go forward on 29 Mar 2026: 7 nights is 167 hours, still 7 nights.
  const spring = trip('2026-03-28', '2026-04-04', [item(0, ['2026-03-28T15:00', 'Europe/London'], ['2026-04-04T11:00', 'Europe/London'])]);
  assert.equal(tripNightsInZones(spring), 7);
  // Sydney clocks go forward on 4 Oct 2026, back in April; New York falls back 1 Nov 2026.
  const fall = trip('2026-10-30', '2026-11-03', [item(0, ['2026-10-30T16:00', 'America/New_York'], ['2026-11-03T10:00', 'America/New_York'])]);
  assert.equal(tripNightsInZones(fall), 4);
});

test('a booking far outside the trip dates (a typo) is ignored; one just outside counts', () => {
  const typo = trip('2026-11-03', '2026-11-10', [item(0, ['2027-11-03T15:00', 'Asia/Tokyo'], ['2027-11-05T10:00', 'Asia/Tokyo'])]);
  assert.equal(tripNightsInZones(typo), 7);
  const early = trip('2026-11-03', '2026-11-10', [item(0, ['2026-11-02T23:55', 'Australia/Sydney'], ['2026-11-03T09:00', 'Asia/Tokyo'], 'flight')]);
  assert.equal(tripNightsInZones(early), 8);
  const bad = trip('2026-11-03', '2026-11-10', [item(0, ['not a date', 'Asia/Tokyo'])]);
  assert.equal(tripNightsInZones(bad), 7);
});

// ---------------------------------------------------------------- quantities

test('clothes quantities scale with nights, and laundry caps them', () => {
  const perDay = { rule: 'per_day' as const, max: 7 };
  const per2 = { rule: 'per_2_days' as const, max: 4 };
  assert.equal(clothesQty(perDay, 3, false), 3);
  assert.equal(clothesQty(perDay, 10, false), 7);
  assert.equal(clothesQty(perDay, 10, true), LAUNDRY_EVERY_NIGHTS);
  assert.equal(clothesQty(perDay, 2, true), 2, 'laundry never raises a short trip');
  assert.equal(clothesQty(per2, 10, false), 4);
  assert.equal(clothesQty(per2, 10, true), 2);
  assert.equal(clothesQty(perDay, 0, true), 1, 'a day trip still packs one');
  assert.equal(clothesQty(null, 10, true), undefined);
  assert.equal(clothesQty(perDay, Number.NaN, false), 1);
});

test('row quantities follow the nights and the laundry switch; laundry only caps clothes; plain rows keep their own', () => {
  const list = buildList('t1', [tpl('city_break'), tpl('family_kids')], { nights: 12, facts: { kids: true } });
  const rules = ruleIndex(templates);
  const socks = list.items.find((i) => i.label === 'Socks');
  assert.ok(socks);
  assert.equal(itemQty(socks, { nights: 12, laundry: false, rules }), 7);
  assert.equal(itemQty(socks, { nights: 12, laundry: true, rules }), 4);
  assert.equal(itemQty(socks, { nights: 2, laundry: false, rules }), 2, 'a shorter trip updates the count');
  assert.equal(itemQty({ id: 'x', label: 'Spare batteries', done: false, qty: 3 }, { nights: 12, laundry: true, rules }), 3);
  assert.equal(itemQty({ id: 'y', label: 'Pen', done: false }, { nights: 12, laundry: true, rules }), undefined);
  // A non-clothes rule is never capped by laundry.
  const custom = new Map([['nappies', { rule: { rule: 'per_day' as const, max: 9 }, category: 'kids' }]]);
  assert.equal(itemQty({ id: 'n', label: 'Nappies', done: false, category: 'kids', templateItemId: 'nappies' }, { nights: 8, laundry: true, rules: custom }), 8);
});

test('laundry is stored on the list and survives a store round trip', () => {
  const list = setLaundry(buildList('t1', [tpl('city_break')], { nights: 5 }), true);
  assert.equal(setLaundry(list, true), list, 'no change, same object');
  const back = listFor(JSON.parse(JSON.stringify(putList({}, list))), 't1');
  assert.equal(back?.laundry, true);
});

// ---------------------------------------------------------------- suggestion rules

const tokyo = { lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo' };
const base = (over: Partial<SmartInput> = {}): SmartInput => ({ trip: trip('2026-11-03', '2026-11-08'), now: NOW, place: tokyo, ...over });

test('forecast rain on a trip day suggests an umbrella and a rain jacket', () => {
  const s = smartSuggestions(base({ forecast: { asOf: NOW, days: [day('2026-11-03', 18, 12, 'cloudy'), day('2026-11-04', 17, 12, 'rain', 6), day('2026-11-05', 19, 13, 'partly', 1.2)] } }));
  assert.deepEqual(ids(s), ['umbrella', 'rain_jacket']);
  assert.deepEqual(s[0].reason, { kind: 'forecast_rain', days: 2 });
  assert.equal(s[0].category, 'misc');
  assert.equal(s[1].category, 'clothes');
});

test('cold lows suggest a warm layer (and gloves at freezing); hot highs suggest a sun hat and sunscreen', () => {
  const cold = smartSuggestions(base({ forecast: { asOf: NOW, days: [day('2026-11-04', 9, 6, 'clear')] } }));
  assert.deepEqual(ids(cold), ['warm_layer']);
  assert.deepEqual(cold[0].reason, { kind: 'forecast_cold', lowC: 6 });
  const freezing = smartSuggestions(base({ forecast: { asOf: NOW, days: [day('2026-11-04', 2, -3, 'snow')] } }));
  assert.deepEqual(ids(freezing), ['warm_layer', 'gloves_hat']);
  const hot = smartSuggestions(base({ forecast: { asOf: NOW, days: [day('2026-11-04', 31, 22, 'clear')] } }));
  assert.deepEqual(ids(hot), ['sun_hat', 'sunscreen']);
  assert.deepEqual(hot[0].reason, { kind: 'forecast_hot', highC: 31 });
  const mild = smartSuggestions(base({ forecast: { asOf: NOW, days: [day('2026-11-04', 20, 12, 'partly')] } }));
  assert.deepEqual(ids(mild), [], 'mild dry days: nothing');
});

test('forecast days outside the trip, or a forecast over 48 hours old, are not used', () => {
  const outside = { asOf: NOW, days: [day('2026-11-01', 15, 10, 'rain', 9)] };
  assert.deepEqual(forecastTripDays(base({ forecast: outside })), []);
  const stale = { asOf: NOW - 49 * 3_600_000, days: [day('2026-11-04', 15, 10, 'rain', 9)] };
  assert.deepEqual(forecastTripDays(base({ forecast: stale })), []);
  assert.deepEqual(ids(smartSuggestions(base({ forecast: stale }))), [], 'Tokyo in November: mid-latitude, so no season guess either');
});

test('without a forecast: winter at high latitude suggests warm things; the tropics suggest sun things; mid-latitudes nothing', () => {
  const oslo = { lat: 59.91, lon: 10.75, tz: 'Europe/Oslo' };
  const winter = smartSuggestions(base({ trip: trip('2026-12-20', '2026-12-27'), place: oslo }));
  assert.deepEqual(ids(winter), ['warm_layer', 'gloves_hat']);
  assert.equal(winter[0].reason.kind, 'season_cold');
  const summerOslo = smartSuggestions(base({ trip: trip('2026-08-01', '2026-08-05'), place: oslo }));
  assert.ok(!ids(summerOslo).includes('warm_layer'));
  const singapore = smartSuggestions(base({ place: { lat: 1.29, lon: 103.85, tz: 'Asia/Singapore' } }));
  assert.deepEqual(ids(singapore), ['sun_hat', 'sunscreen']);
  assert.equal(singapore[0].reason.kind, 'season_tropics');
  // Southern winter is June to August.
  const ushuaia = smartSuggestions(base({ trip: trip('2026-07-01', '2026-07-05'), place: { lat: -54.8, lon: -68.3, tz: 'America/Argentina/Ushuaia' } }));
  assert.deepEqual(ids(ushuaia), ['warm_layer', 'gloves_hat']);
});

test('a forecast that covers the trip wins over the season guess', () => {
  const oslo = { lat: 59.91, lon: 10.75, tz: 'Europe/Oslo' };
  const s = smartSuggestions(base({ trip: trip('2026-12-20', '2026-12-22'), place: oslo, now: Date.parse('2026-12-19T00:00:00Z'), forecast: { asOf: Date.parse('2026-12-19T00:00:00Z'), days: [day('2026-12-20', 11, 9, 'cloudy')] } }));
  assert.deepEqual(ids(s), [], 'a mild forecast means no warm-layer guess');
});

test('very long days or white nights suggest an eye mask (daylight is computed offline)', () => {
  const tromso = { lat: 69.65, lon: 18.96, tz: 'Europe/Oslo' };
  assert.ok(ids(smartSuggestions(base({ trip: trip('2026-06-20', '2026-06-23'), place: tromso }))).includes('eye_mask'));
  const reykjavik = { lat: 64.15, lon: -21.94, tz: 'Atlantic/Reykjavik' };
  assert.ok(ids(smartSuggestions(base({ trip: trip('2026-06-18', '2026-06-21'), place: reykjavik }))).includes('eye_mask'));
  assert.ok(!ids(smartSuggestions(base({ trip: trip('2026-06-18', '2026-06-21'), place: tokyo }))).includes('eye_mask'));
});

test('plug adapter: destination plug types against the home country, grouped by plug set', () => {
  const t = trip('2026-11-03', '2026-11-10', [
    item(0, ['2026-11-03T10:00', 'Australia/Sydney'], ['2026-11-03T20:00', 'Europe/London'], 'flight'),
    item(1, ['2026-11-05T09:00', 'Europe/Dublin']),
    item(2, ['2026-11-07T09:00', 'Asia/Tokyo']),
    item(3, ['2026-11-08T09:00', 'Europe/Paris']),
  ]);
  const s = smartSuggestions({ trip: t, now: NOW, essentials: { table, home: 'AU' } });
  assert.deepEqual(ids(s), ['plug_adapter:G', 'plug_adapter:AB', 'plug_adapter:CE']);
  assert.deepEqual(s[0].plugs, ['G']);
  assert.equal(labelOf(s[0]), 'Plug adapter: type G');
  assert.equal(labelOf(s[1]), 'Plug adapter: types A, B');
  const r = s[0].reason;
  assert.ok(r.kind === 'plugs');
  assert.deepEqual(r.countries, ['United Kingdom', 'Ireland']);
  const jp = s[1].reason;
  assert.ok(jp.kind === 'plugs' && jp.voltageDiffers, 'Japan 100 V vs Australia 230 V');
});

test('plug adapter: nothing at home, nothing where plugs fit, nothing without a known home country', () => {
  const nz = trip('2026-11-03', '2026-11-10', [item(0, ['2026-11-03T10:00', 'Pacific/Auckland'])]);
  assert.deepEqual(smartSuggestions({ trip: nz, now: NOW, essentials: { table, home: 'AU' } }), [], 'NZ uses type I like Australia');
  const home = trip('2026-11-03', '2026-11-10', [item(0, ['2026-11-03T10:00', 'Australia/Sydney'])]);
  assert.deepEqual(smartSuggestions({ trip: home, now: NOW, essentials: { table, home: 'AU' } }), []);
  const london = trip('2026-11-03', '2026-11-10', [item(0, ['2026-11-03T10:00', 'Europe/London'])]);
  assert.deepEqual(smartSuggestions({ trip: london, now: NOW, essentials: { table, home: null } }), []);
  assert.deepEqual(smartSuggestions({ trip: london, now: NOW, essentials: { table, home: 'ZZ' } }), []);
  assert.deepEqual(smartSuggestions({ trip: london, now: NOW, essentials: null }), []);
});

test('home country: the saved one, else the trip home zone, else none', () => {
  assert.equal(homeCountryFor(table, 'gb', trip('2026-11-03', '2026-11-10')), 'GB');
  assert.equal(homeCountryFor(table, null, trip('2026-11-03', '2026-11-10')), 'AU');
  assert.equal(homeCountryFor(table, 'ZZ', trip('2026-11-03', '2026-11-10', [], 'Mars/Base')), null);
});

test('missing data gives no suggestions and never throws', () => {
  assert.deepEqual(smartSuggestions({ trip: trip('2026-11-03', '2026-11-08'), now: NOW }), []);
  assert.deepEqual(smartSuggestions({ trip: trip('bad', 'dates'), now: NOW, place: tokyo, forecast: { asOf: NOW, days: [] } }), []);
  assert.deepEqual(smartSuggestions({ trip: trip('2026-11-03', '2026-11-08'), now: NOW, place: { lat: 200, lon: 0, tz: 'Nowhere/Zone' } }), []);
  assert.deepEqual(smartSuggestions({ trip: trip('2026-11-03', '2026-11-08'), now: NOW, forecast: { asOf: Number.NaN, days: [day('2026-11-04', 30, 20, 'rain', 5)] } }), []);
});

// ---------------------------------------------------------------- the list: no duplicates, dismissals

const rainy = base({ forecast: { asOf: NOW, days: [day('2026-11-04', 31, 4, 'rain', 8)] } });

test('accepting adds an unpacked row once; re-running never offers it again, even after a rename', () => {
  const start = buildList('t1', [tpl('longhaul_carryon')], { nights: 5 });
  const all = smartSuggestions(rainy);
  let open = openSuggestions(start, all, labelOf);
  const umbrella = open.find((s) => s.id === 'umbrella');
  assert.ok(umbrella);
  const r = acceptSuggestion(start, umbrella, labelOf(umbrella), 'sg1');
  assert.equal(r.added, true);
  const row = r.list.items.find((i) => i.id === 'sg1');
  assert.deepEqual(row, { id: 'sg1', label: 'Umbrella', done: false, category: 'misc', suggestionId: 'umbrella' });
  // Accepting again does nothing.
  assert.equal(acceptSuggestion(r.list, umbrella, 'Umbrella', 'sg2').added, false);
  // Renamed by the traveller: still not offered again.
  const renamed: PackList = { ...r.list, items: r.list.items.map((i) => (i.id === 'sg1' ? { ...i, label: 'Folding brolly thing' } : i)) };
  open = openSuggestions(renamed, smartSuggestions(rainy), labelOf);
  assert.ok(!ids(open).includes('umbrella'));
});

test('items already on the list cover suggestions: same label, or a row that clearly covers it', () => {
  const list: PackList = {
    tripId: 't1',
    items: [
      { id: 'a', label: 'umbrella!', done: true },
      { id: 'b', label: 'Waterproof jacket', done: false, category: 'clothes' },
      { id: 'c', label: 'Sun protection', done: false, category: 'health' },
      { id: 'd', label: 'Warm travel layer', done: false, category: 'clothes' },
    ],
  };
  const open = ids(openSuggestions(list, smartSuggestions(rainy), labelOf));
  assert.deepEqual(open, ['sun_hat'], 'umbrella, rain jacket, sunscreen and warm layer are covered');
  // The ticked umbrella stays ticked: suggestions never touch rows.
  assert.equal(list.items[0].done, true);
});

test('a generic adapter covers every plug suggestion; a typed one only its own types', () => {
  const g: Suggestion = { id: 'plug_adapter:G', kind: 'plug_adapter', category: 'tech', plugs: ['G'], reason: { kind: 'plugs', countries: ['United Kingdom'], plugs: ['G'], some: false, voltageDiffers: false } };
  const ab: Suggestion = { ...g, id: 'plug_adapter:AB', plugs: ['A', 'B'] };
  const generic: PackList = { tripId: 't1', items: [{ id: 'a', label: 'Multi-country plug adapter', done: false }] };
  assert.ok(isCovered(generic, g, labelOf(g)) && isCovered(generic, ab, labelOf(ab)));
  const typed: PackList = { tripId: 't1', items: [{ id: 'a', label: 'Plug adapter: type G', done: false }] };
  assert.ok(isCovered(typed, g, labelOf(g)));
  assert.ok(!isCovered(typed, ab, labelOf(ab)));
  const both: PackList = { tripId: 't1', items: [{ id: 'a', label: 'Adaptor types A and B', done: false }] };
  assert.ok(isCovered(both, ab, labelOf(ab)));
  const charger: PackList = { tripId: 't1', items: [{ id: 'a', label: 'Phone charger', done: false }] };
  assert.ok(!isCovered(charger, g, labelOf(g)));
});

test('dismissed suggestions stay dismissed across runs and a store round trip; restore brings them back', () => {
  let list = buildList('t1', [tpl('city_break')], { nights: 5 });
  list = dismissSuggestion(list, 'umbrella');
  assert.equal(dismissSuggestion(list, 'umbrella'), list, 'dismissing twice changes nothing');
  const stored = JSON.parse(JSON.stringify(putList({}, list)));
  const back = listFor(stored, 't1');
  assert.ok(back);
  assert.deepEqual(dismissedOf(back), ['umbrella']);
  for (let run = 0; run < 3; run++) assert.ok(!ids(openSuggestions(back, smartSuggestions(rainy), labelOf)).includes('umbrella'));
  // Ticks and resets never touch dismissals.
  const ticked = resetTicks(toggleItem(back, back.items[0].id));
  assert.deepEqual(dismissedOf(ticked), ['umbrella']);
  assert.ok(ids(openSuggestions(restoreSuggestions(back), smartSuggestions(rainy), labelOf)).includes('umbrella'));
  // Junk from an older build reads as nothing dismissed.
  assert.deepEqual(dismissedOf({ tripId: 't1', items: [], dismissed: 'umbrella' as unknown as string[] }), []);
  assert.deepEqual(dismissedOf({ tripId: 't1', items: [], dismissed: ['ok', 3 as unknown as string, ''] }), ['ok']);
});

test('suggestions are never on the list until accepted', () => {
  const list = buildList('t1', [tpl('city_break')], { nights: 5 });
  const before = JSON.stringify(list);
  smartSuggestions(rainy);
  openSuggestions(list, smartSuggestions(rainy), labelOf);
  assert.equal(JSON.stringify(list), before);
});

test('an empty label or a clashing id is refused', () => {
  const list: PackList = { tripId: 't1', items: [{ id: 'sg1', label: 'Pen', done: false }] };
  const s = smartSuggestions(rainy)[0];
  assert.equal(acceptSuggestion(list, s, '  ', 'sg9').added, false);
  assert.equal(acceptSuggestion(list, s, 'Umbrella', 'sg1').added, false);
});

// ---------------------------------------------------------------- share text

test('the list as text: title, progress, categories in order, ticks and quantities', () => {
  const list: PackList = {
    tripId: 't1',
    items: [
      { id: 'a', label: 'Socks', done: false, category: 'clothes', templateItemId: 'cb_socks' },
      { id: 'b', label: 'Passport', done: true, category: 'documents' },
      { id: 'c', label: '  Snacks   for the  plane ', done: false },
    ],
  };
  const rules = ruleIndex(templates);
  const text = packingText(
    list,
    { title: 'Kyoto trip · Packing list', progress: (d, n) => `${d} of ${n} packed`, category: (c) => c.toUpperCase(), qty: (n) => `× ${n}`, note: 'Laundry on the trip', empty: 'Nothing on the list yet.' },
    (i) => itemQty(i, { nights: 9, laundry: true, rules }),
  );
  assert.equal(text, 'Kyoto trip · Packing list\n1 of 3 packed\nLaundry on the trip\n\nDOCUMENTS\n☑ Passport\n\nCLOTHES\n☐ Socks × 4\n\nMISC\n☐ Snacks for the plane\n');
  const empty = packingText({ tripId: 't1', items: [] }, { title: 'T', progress: (d, n) => `${d}/${n}`, category: (c) => c, qty: (n) => `x${n}`, empty: 'Nothing yet.' });
  assert.equal(empty, 'T\n0/0\n\nNothing yet.\n');
});
