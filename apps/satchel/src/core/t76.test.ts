// T76 (run-88 follow-ups): offline city tiles in the position picker, renaming dropped pins, packing quantities and
// non-English matches for suggestions, a forecast for every trip stop, the demo hotel after the flight lands,
// "Use my default" on flights, the font licence notice and licence summaries, and the spec catalogue prefixes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { inSpecGroups, SPEC_SYNC_PREFIXES } from '../i18n/specsync.ts';
import { demoTrip } from './demo.ts';
import { BUNDLED_FONTS, isOflHeading, OFL_1_1, OFL_TITLE } from './fontlicence.ts';
import { airportPlan, DEFAULT_AIRPORT_PREFS, defaultBuffer, withAirport, airportDraft } from './leaveby.ts';
import { LICENCE_SECTIONS, LICENCE_SUMMARIES, licenceKeys, summaryKey } from './licences.ts';
import type { Item, Trip } from './model.ts';
import { cleanQty, MAX_QTY, renameItem, setItemQty, type PackItem, type PackList } from './packing.ts';
import { COVERS_INTL, foldLabel, isCovered, itemQty, labelCovers, openSuggestions, ruleIndex, suggestedQty, type Suggestion } from './smartpack.ts';
import { tripRoute } from './triproute.ts';
import { toUtc } from './tz.ts';
import { dropPin, parsePins, renamePin } from './wayback.ts';
import { defaultStop, stopDates, stopKey, weatherPlace, weatherStops } from './weather.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
const byId = (id: string) => trip.items.find((i) => i.id === id) as Item;
const utc = (local: string, tz: string) => toUtc({ local, tz });

// ---- position picker: downloaded city tiles ----

test('position picker draws the downloaded city tiles the Map tab uses, picked by where the map looks', () => {
  const src = read('../ui/PositionField.tsx');
  assert.match(src, /listInstalled\(\)/);
  assert.match(src, /pickCityFor\(view\.lat, view\.lon, installed\)/);
  assert.match(src, /offlineTilesFor\(offlineCity\)/);
  assert.match(src, /offlineTiles=\{offlineTiles\}/);
  assert.match(src, /limitZoom=\{net === 'offline'\}/);
  assert.match(src, /onRegionChange=/);
  assert.match(src, /cityMapsChanged\.subscribe\(load\)/, 'a city downloaded or deleted meanwhile is picked up');
  // the map adapter is what turns offlineTiles into a LocalTile overlay
  assert.match(read('../native/maps.tsx'), /<LocalTile pathTemplate=\{tiles\.pathTemplate\}/);
  assert.ok(en['f88.position.offlineCity'].includes('{city}'));
});

// ---- wayback: rename ----

test('wayback rename: a preset pin becomes a custom one with the new label; blank or unknown leave the list alone', () => {
  const r = dropPin([], { preset: 'parked', lat: 35.7, lon: 139.8 }, '2026-11-04T01:00:00Z', 'p1');
  assert.ok(r.ok);
  const pins = r.ok ? r.pins : [];
  const renamed = renamePin(pins, 'p1', '  Level 3,   bay 12 ');
  assert.equal(renamed[0].preset, 'custom');
  assert.equal(renamed[0].label, 'Level 3, bay 12');
  assert.deepEqual(renamePin(pins, 'p1', '   '), parsePins(pins));
  assert.deepEqual(renamePin(pins, 'nope', 'X'), parsePins(pins));
});

test('wayback screen: every pin row has a Rename control wired to renamePin, labelled for screen readers', () => {
  const src = read('../../app/wayback.tsx');
  assert.match(src, /renamePin\(parsePins\(old\), renaming\.id, label\)/);
  assert.match(src, /accessibilityLabel=\{t\('f88\.wayback\.renameA11y', \{ name \}\)\}/);
  assert.match(src, /label=\{t\('f88\.wayback\.renameLabel'\)\}/);
  for (const k of ['f88.wayback.rename', 'f88.wayback.renamed', 'f88.wayback.renameSave'] as const) assert.ok(en[k], k);
});

// ---- packing quantities ----

const list = (items: PackItem[]): PackList => ({ tripId: 't', items });
const socks: PackItem = { id: 's', label: 'Socks', done: false, category: 'clothes', templateItemId: 'socks' };
const RULES = ruleIndex([{ id: 'x', name: 'x', trip_types: [], items: [{ id: 'socks', label: 'Socks', category: 'clothes', qty_rule: { rule: 'per_day', max: 10 }, conditions: [] }] }]);

test('packing qty: a hand-set number wins over the worked-out one until cleared; clamped 1..99', () => {
  const ctx = { nights: 6, laundry: false, rules: RULES };
  const l0 = list([socks]);
  assert.equal(itemQty(socks, ctx), 6);
  const l1 = setItemQty(l0, 's', 3);
  assert.equal(l1.items[0].userQty, 3);
  assert.equal(itemQty(l1.items[0], ctx), 3);
  assert.equal(suggestedQty(l1.items[0], ctx), 6, 'the suggestion is still known for "Use the suggested"');
  assert.equal(itemQty(l1.items[0], { ...ctx, laundry: true }), 3, 'laundry does not cap a number the traveller chose');
  const l2 = setItemQty(l1, 's', null);
  assert.equal('userQty' in l2.items[0], false);
  assert.equal(itemQty(l2.items[0], ctx), 6);
  assert.equal(setItemQty(l0, 's', 0).items[0].userQty, 1);
  assert.equal(setItemQty(l0, 's', 500).items[0].userQty, MAX_QTY);
  assert.equal(setItemQty(l0, 's', 2.9).items[0].userQty, 2);
  assert.equal(setItemQty(l0, 'missing', 2), l0);
  assert.equal(setItemQty(l0, 's', null), l0, 'clearing nothing is a no-op');
  assert.equal(setItemQty(l1, 's', 3), l1, 'same number is a no-op');
});

test('packing qty: a traveller row with no rule takes a number too; junk stored numbers are ignored', () => {
  const ctx = { nights: 4, laundry: false, rules: RULES };
  const own: PackItem = { id: 'o', label: 'Snacks', done: false };
  assert.equal(itemQty(own, ctx), undefined);
  assert.equal(itemQty({ ...own, userQty: 4 }, ctx), 4);
  for (const junk of [0, -1, 100, Number.NaN, '3' as unknown as number]) assert.equal(itemQty({ ...own, userQty: junk }, ctx), undefined, String(junk));
  assert.equal(cleanQty(12.7), 12);
  assert.equal(cleanQty(null), undefined);
  // renaming keeps the number, and the edit card saves both at once
  const l = setItemQty(renameItem(list([own]), 'o', 'Trail snacks'), 'o', 5);
  assert.deepEqual(l.items[0], { id: 'o', label: 'Trail snacks', done: false, userQty: 5 });
});

test('packing screen: the edit card has a - / + quantity stepper and "Use the suggested"', () => {
  const src = read('../../app/packing/[tripId].tsx');
  assert.match(src, /setItemQty\(renameItem\(l, row\.item\.id, label\), row\.item\.id, own\)/);
  assert.match(src, /f88\.packing\.qtyLess/);
  assert.match(src, /f88\.packing\.qtyMore/);
  assert.match(src, /f88\.packing\.qtySuggested/);
});

// ---- suggestions: other languages ----

const umbrella: Suggestion = { id: 'umbrella', kind: 'umbrella', category: 'misc', reason: { kind: 'forecast_rain', days: 2 } };
const sunscreen: Suggestion = { id: 'sunscreen', kind: 'sunscreen', category: 'toiletries', reason: { kind: 'forecast_hot', highC: 30 } };
const plugG: Suggestion = { id: 'plug_adapter:G', kind: 'plug_adapter', category: 'tech', plugs: ['G'], reason: { kind: 'plugs', countries: ['GB'], plugs: ['G'], some: false, voltageDiffers: false } };
const row = (label: string): PackItem => ({ id: label, label, done: false });

test('suggestions: a row written in German, French, Spanish, Italian, Dutch or Portuguese counts as the item', () => {
  for (const l of ['Regenschirm', 'parapluie', 'Paraguas', 'ombrello', 'Paraplu', 'guarda-chuva', 'Kleiner Regenschirm']) assert.ok(isCovered(list([row(l)]), umbrella, 'Umbrella'), l);
  for (const l of ['Crème solaire', 'Sonnencreme', 'protector solar', 'Zonnebrand', 'CREMA SOLARE']) assert.ok(isCovered(list([row(l)]), sunscreen, 'Sunscreen'), l);
  assert.ok(isCovered(list([row('Reiseadapter')]), plugG, 'Plug adapter (type G)'));
  assert.ok(isCovered(list([row('adaptateur')]), plugG, 'Plug adapter (type G)'));
  assert.ok(labelCovers('rain_jacket', 'Regenjacke'));
  assert.ok(labelCovers('warm_layer', 'Doudoune'));
  assert.ok(labelCovers('gloves_hat', 'Mütze'));
  assert.ok(labelCovers('eye_mask', 'Schlafmaske'));
  assert.ok(labelCovers('sun_hat', 'Casquette'));
  // English still works, and whole words only
  assert.ok(labelCovers('umbrella', 'Compact umbrella'));
  assert.equal(labelCovers('umbrella', 'Schirmmütze'), false, 'part of a longer word does not count');
  assert.equal(labelCovers('umbrella', 'Phone charger'), false);
  assert.equal(isCovered(list([row('Ladekabel')]), plugG, 'Plug adapter (type G)'), false);
  // openSuggestions drops the covered one
  const open = openSuggestions(list([row('Regenschirm')]), [umbrella, sunscreen], (s) => s.id);
  assert.deepEqual(open.map((s) => s.id), ['sunscreen']);
});

test('suggestions synonym table: folded, lower-case, no duplicates with the English list, every kind covered', () => {
  assert.equal(foldLabel('Crème  Solaire!'), 'creme solaire');
  assert.equal(foldLabel('Mütze'), 'mutze');
  for (const [kind, words] of Object.entries(COVERS_INTL)) {
    assert.ok(words.length >= 3, kind);
    for (const w of words) assert.equal(foldLabel(w), w, `${kind}: ${w} is stored folded`);
    assert.equal(new Set(words).size, words.length, `${kind} has duplicates`);
  }
});

// ---- weather: every stop ----

test('weather stops: every place of the demo trip once, in the order reached, with the dates you are there', () => {
  const now = utc('2026-11-02T12:00', 'Asia/Tokyo');
  const stops = weatherStops(trip, now);
  const names = stops.map((s) => s.name);
  assert.ok(names.length >= 5, names.join(', '));
  assert.equal(new Set(stops.map((s) => s.key)).size, stops.length, 'one per spot');
  const hotel = stops.find((s) => s.name.startsWith('Hotel Asakusa'));
  assert.ok(hotel);
  assert.equal(hotel?.fromDate, '2026-11-03');
  assert.equal(hotel?.toDate, '2026-11-07');
  assert.equal(hotel?.tz, 'Asia/Tokyo');
  assert.ok(names.indexOf('Haneda Airport T3') < names.indexOf(hotel?.name ?? ''), 'landing comes before the hotel');
  const kyoto = stops.find((s) => s.name === 'Kyoto Station');
  assert.equal(kyoto?.fromDate, '2026-11-07');
});

test('weather stops: the card opens on the current or next place; each stop shows its own days', () => {
  const now = utc('2026-11-04T12:00', 'Asia/Tokyo');
  const stops = weatherStops(trip, now);
  const first = defaultStop(stops, trip, now);
  const p = weatherPlace(trip, now);
  assert.ok(p && first);
  assert.equal(first?.key, stopKey(p as { lat: number; lon: number }));
  const kyoto = stops.find((s) => s.name === 'Kyoto Station');
  assert.ok(kyoto);
  assert.deepEqual(stopDates(trip, kyoto as NonNullable<typeof kyoto>, '2026-11-04'), ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']);
  assert.deepEqual(stopDates(trip, { fromDate: '2026-11-03' }, '2026-11-04', 2), ['2026-11-04', '2026-11-05'], 'a stop under way starts today');
  assert.deepEqual(stopDates(trip, { fromDate: '2026-11-03' }, '2026-12-01'), [], 'trip over');
  assert.deepEqual(stopDates(trip, { fromDate: '2026-10-30' }, '2026-10-20', 1), ['2026-11-03'], 'never before the trip');
});

test('weather stops: no booking positions falls back to a saved place over the trip dates; none at all is empty', () => {
  const bare: Trip = { ...trip, items: trip.items.map((i) => ({ ...i, place: i.place ? { ...i.place, lat: undefined, lon: undefined } : undefined, from: undefined, to: undefined })) };
  assert.deepEqual(weatherStops(bare, Date.UTC(2026, 10, 4)), []);
  const withSaved = { ...bare, places: [{ id: 'sp', name: 'Gion corner', lat: 35.0037, lon: 135.7788, savedAt: '2026-10-01T00:00:00Z' }] } as unknown as Trip;
  const one = weatherStops(withSaved, Date.UTC(2026, 10, 4));
  assert.equal(one.length, 1);
  assert.equal(one[0].name, 'Gion corner');
  assert.equal(one[0].fromDate, trip.startDate);
});

test('weather card: stop chips and per-stop dates (forecast cache is keyed by each stop’s coordinates)', () => {
  const src = read('../ui/WeatherCard.tsx');
  assert.match(src, /weatherStops\(trip, now\)/);
  assert.match(src, /stopDates\(trip, place, today\)/);
  assert.match(src, /<Chip key=\{s\.key\} label=\{s\.name\}/);
  assert.match(read('../native/weather.ts'), /cacheKey\(at\)/);
});

// ---- demo trip order ----

test('demo trip: the Tokyo hotel check-in is after the flight lands, and the route shows landing then hotel', () => {
  const f = byId('demo-f1');
  const h = byId('demo-h1');
  assert.ok(f.end);
  assert.ok(toUtc(h.start) > toUtc(f.end as NonNullable<Item['end']>), 'check-in after landing');
  const route = tripRoute(trip, { transport: true });
  const day1 = route.days.find((d) => d.date === '2026-11-03');
  const keys = day1?.stops.map((s) => s.key) ?? [];
  assert.ok(keys.indexOf('demo-f1:to') >= 0 && keys.indexOf('demo-f1:to') < keys.indexOf('demo-h1:place'), keys.join(', '));
  // every booking that starts somewhere else starts after the one before it arrives (no other overlaps either)
  const t2 = byId('demo-t1');
  const h2 = byId('demo-h2');
  assert.ok(toUtc(h2.start) > toUtc(t2.end as NonNullable<Item['end']>));
});

// ---- airport: use my default ----

test('airport: "Use my default" goes back to the Settings buffer for the flight type; scope can go back to the guess', () => {
  const prefs = { travelMin: 45, domesticMin: 75, internationalMin: 150 };
  assert.equal(defaultBuffer(prefs, 'domestic'), 75);
  assert.equal(defaultBuffer(prefs, 'international'), 150);
  assert.equal(defaultBuffer({ junk: 1 } as unknown as typeof prefs, 'domestic'), DEFAULT_AIRPORT_PREFS.domesticMin);
  const f = byId('demo-f1');
  const own = withAirport(f, { ...airportDraft(undefined), bufferMin: '60', scope: 'domestic' });
  assert.equal(airportPlan(own, prefs)?.bufferMin, 60);
  const back = withAirport(own, { ...airportDraft(own.airport), bufferMin: '', scope: '' }, own.airport);
  const plan = airportPlan(back, prefs);
  assert.equal(plan?.scope, 'international', 'guessed again from Sydney -> Tokyo');
  assert.equal(plan?.bufferMin, 150);
  assert.equal(plan?.bufferDefault, true);
  const src = read('../ui/AirportFields.tsx');
  assert.match(src, /f88\.airport\.useDefaultBuffer/);
  assert.match(src, /form\.set\('scope', ''\)/);
});

// ---- licences ----

test('licences: the OFL 1.1 notice covers every font the app loads, with its full text', () => {
  const layout = read('../../app/_layout.tsx');
  const pkg = JSON.parse(read('../../package.json')) as { dependencies: Record<string, string> };
  for (const f of BUNDLED_FONTS) {
    assert.ok(f.packageName in pkg.dependencies, f.packageName);
    assert.match(layout, new RegExp(`from '${f.packageName}'`));
    assert.match(f.copyright, /^Copyright /);
  }
  for (const m of layout.matchAll(/import \{([^}]*)\} from '@expo-google-fonts\/([a-z-]+)'/g)) {
    assert.ok(BUNDLED_FONTS.some((f) => f.packageName === `@expo-google-fonts/${m[2]}`), m[2]);
  }
  const text = OFL_1_1.join('\n');
  assert.ok(OFL_1_1.includes(OFL_TITLE));
  for (const h of ['PREAMBLE', 'DEFINITIONS', 'PERMISSION & CONDITIONS', 'TERMINATION', 'DISCLAIMER']) assert.ok(OFL_1_1.includes(h) && isOflHeading(h), h);
  for (const n of ['1)', '2)', '3)', '4)', '5)']) assert.ok(OFL_1_1.some((p) => p.startsWith(n)), n);
  assert.match(text, /may be sold by itself/);
  assert.equal(isOflHeading(OFL_1_1[OFL_1_1.length - 1]), false);
  const screen = read('../../app/licences.tsx');
  assert.match(screen, /<FontNotice \/>/);
  assert.match(screen, /OFL_1_1\.map/);
});

test('licences: each main licence has a short summary in the catalogue, and the screen shows it', () => {
  for (const k of Object.values(LICENCE_SUMMARIES)) assert.ok(k in en, k);
  for (const k of licenceKeys()) assert.ok(k in en, k);
  const libs = LICENCE_SECTIONS.find((s) => s.id === 'libraries');
  for (const e of libs?.entries ?? []) assert.ok(summaryKey(e), `${e.name} (${e.licence}) has a summary`);
  for (const id of ['osm', 'metno', 'inter']) {
    const e = LICENCE_SECTIONS.flatMap((s) => s.entries).find((x) => x.id === id);
    assert.ok(e && summaryKey(e), id);
  }
  assert.match(en['f88.licences.summaryNote'], /general guidance/);
  assert.match(read('../../app/licences.tsx'), /summaryKey\(e\)/);
});

// ---- spec catalogue ----

test('spec catalogue sync covers the run-88 groups and T76', () => {
  for (const p of ['position.', 'licences.', 'wayback.', 'airport.', 'smartpack.', 'f88.']) assert.ok((SPEC_SYNC_PREFIXES as readonly string[]).includes(p), p);
  assert.ok(inSpecGroups('wayback.drop'));
  assert.ok(inSpecGroups('f88.wayback.rename'));
  const cat = JSON.parse(read('../../docs/spec/EN_CATALOGUE.json')) as Record<string, string>;
  for (const k of Object.keys(en).filter((x) => x.startsWith('f88.') || x.startsWith('airport.'))) assert.equal(cat[k], (en as Record<string, string>)[k], k);
});
