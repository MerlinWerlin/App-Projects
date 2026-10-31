// T67 (folds T62, T63): city-pack pois.json format 2 (police + phone / opening_hours for Nearest help) built by
// tools/maps/pois.mjs and read by src/core/help.ts and citymaps.ts, old packs still read; Spending rate edits stamp
// the rate date; the readiness map row refreshes when the offline maps change.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { HELP_POI_CATEGORIES, overpassQuery, POI_TAGS, POIS_FORMAT, toPois, type OverpassElement } from '../../tools/maps/pois.mjs';
import { PACK_FORMAT, packFormat, parseCatalog, parseCity, type CityCatalog, type CityMap } from './citymaps.ts';
import { rateDates, setRateOn } from './convert.ts';
import { demoTrip } from './demo.ts';
import { HELP_CATEGORIES, nearestHelp, PACK_HELP_FORMAT, packCategories, packFormatOf, packLimited, packMissing, parsePackHelp, parsePackHelpFile } from './help.ts';
import type { Trip } from './model.ts';
import { mapCheck } from './readiness.ts';
import { cityMapsChanged, createSignal } from './signal.ts';
import { parsePackToilets } from './toilets.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// ------------------------------------------------------------------ fixture: an Overpass answer for a Kyoto bbox

const FIXTURE: OverpassElement[] = [
  { type: 'node', id: 1, lat: 35.0031234567, lon: 135.7681234567, tags: { amenity: 'police', name: '交番', 'name:en': 'Shijo Koban', phone: '+81 75-123-4567; +81 75-765-4321', opening_hours: '24/7' } },
  { type: 'way', id: 2, center: { lat: 35.01, lon: 135.76 }, tags: { amenity: 'hospital', name: 'Kyoto City Hospital', 'contact:phone': '+81 75-311-5311', emergency: 'yes' } },
  { type: 'node', id: 3, lat: 35.004, lon: 135.769, tags: { amenity: 'pharmacy', name: 'Corner Pharmacy', opening_hours: 'Mo-Sa 09:00-20:00' } },
  { type: 'node', id: 4, lat: 35.005, lon: 135.77, tags: { amenity: 'pharmacy', name: 'Staff Only', access: 'private' } },
  { type: 'node', id: 5, lat: 35.006, lon: 135.771, tags: { amenity: 'clinic' } },
  { type: 'node', id: 6, lat: 35.007, lon: 135.772, tags: { amenity: 'fuel', name: 'Gas', phone: '+81 75-000-0000' } },
  { type: 'node', id: 7, lat: 35.008, lon: 135.773, tags: { amenity: 'toilets', wheelchair: 'yes', diaper: 'yes', fee: 'no' } },
  { type: 'node', id: 8, lat: 35.009, lon: 135.774, tags: { amenity: 'toilets', access: 'private' } },
  { type: 'node', id: 1, lat: 35.0031, lon: 135.7681, tags: { amenity: 'police' } }, // duplicate id
  { type: 'relation', id: 9, tags: { amenity: 'police' } }, // no position
  { type: 'node', id: 10, lat: 35.01, lon: 135.775, tags: { shop: 'bakery' } }, // not ours
];
const BBOX: [number, number, number, number] = [135.68, 34.93, 135.84, 35.07];

test('pack build: the Overpass query asks for police as well as the old categories, inside the bbox', () => {
  const q = overpassQuery(BBOX);
  assert.ok(q.startsWith('[out:json]'));
  assert.ok(q.includes('nwr["amenity"="police"](34.93,135.68,35.07,135.84);'));
  for (const v of ['toilets', 'pharmacy', 'hospital', 'clinic', 'drinking_water', 'fuel', 'atm', 'bank', 'bus_station', 'ferry_terminal']) assert.ok(q.includes(`"amenity"="${v}"`), v);
  assert.ok(q.includes('"railway"="station"'));
  assert.ok(q.endsWith('out center tags;'));
  assert.deepEqual(POI_TAGS.police, [['amenity', 'police']]);
  assert.deepEqual(HELP_POI_CATEGORIES, ['hospital_clinic', 'pharmacy', 'police']);
});

test('pack build: pois.json format 2 carries police plus phone / hours / amenity / emergency on help places', () => {
  const pois = toPois(FIXTURE, '2026-10-31');
  assert.equal(pois.format, 2);
  assert.equal(POIS_FORMAT, PACK_FORMAT);
  assert.equal(POIS_FORMAT, PACK_HELP_FORMAT);
  assert.equal(pois.built, '2026-10-31');
  assert.match(pois.attribution, /OpenStreetMap/);
  assert.deepEqual(pois.places, [
    { id: 'n1', lat: 35.003123, lon: 135.768123, category: 'police', name: 'Shijo Koban', amenity: 'police', phone: '+81 75-123-4567; +81 75-765-4321', opening_hours: '24/7' },
    { id: 'w2', lat: 35.01, lon: 135.76, category: 'hospital_clinic', name: 'Kyoto City Hospital', amenity: 'hospital', phone: '+81 75-311-5311', emergency: 'yes' },
    { id: 'n3', lat: 35.004, lon: 135.769, category: 'pharmacy', name: 'Corner Pharmacy', amenity: 'pharmacy', opening_hours: 'Mo-Sa 09:00-20:00' },
    { id: 'n5', lat: 35.006, lon: 135.771, category: 'hospital_clinic', amenity: 'clinic' },
    // not a help category: no contact details added
    { id: 'n6', lat: 35.007, lon: 135.772, category: 'fuel', name: 'Gas' },
  ]);
  assert.deepEqual(pois.toilets, [{ id: 'n7', lat: 35.008, lon: 135.773, fee: 'no', wheelchair: 'yes', changing_table: 'yes' }]);
  assert.deepEqual(toPois('junk', 'x').places, []);
});

test('pack build -> app: Nearest help reads a format 2 pack fully offline (police, tap-to-call, hours, ED)', () => {
  const text = JSON.stringify(toPois(FIXTURE, '2026-10-31'));
  const file = parsePackHelpFile(text);
  assert.equal(file.format, 2);
  assert.equal(packLimited(file.format), false);
  assert.deepEqual(packMissing(file.places, file.format), []);
  const byId = Object.fromEntries(file.places.map((p) => [p.id, p]));
  assert.deepEqual(byId.n1, { id: 'n1', lat: 35.003123, lon: 135.768123, category: 'police', kind: 'police', name: 'Shijo Koban', phone: '+81 75-123-4567', tel: 'tel:+81751234567', opening_hours: '24/7' });
  assert.equal(byId.w2.kind, 'hospital');
  assert.equal(byId.w2.emergency, true);
  assert.equal(byId.w2.tel, 'tel:+81753115311');
  assert.equal(byId.n5.kind, 'clinic');
  assert.equal(byId.n3.opening_hours, 'Mo-Sa 09:00-20:00');
  const near = nearestHelp(file.places, { lat: 35.003, lon: 135.768 });
  assert.equal(near[0].id, 'n1');
  // the Toilets tab still reads the same file
  assert.equal(parsePackToilets(text).length, 1);
});

test('old packs: a format 1 pois.json (no format field) is still read, and says police / numbers / hours are missing', () => {
  const v1 = {
    built: '2026-10-30',
    attribution: '© OpenStreetMap contributors (ODbL)',
    toilets: [{ id: 'n7', lat: 35.008, lon: 135.773 }],
    places: [
      { id: 'w2', lat: 35.01, lon: 135.76, category: 'hospital_clinic', name: 'Kyoto City Hospital' },
      { id: 'n3', lat: 35.004, lon: 135.769, category: 'pharmacy', name: 'Corner Pharmacy' },
    ],
  };
  const file = parsePackHelpFile(JSON.stringify(v1));
  assert.equal(file.format, 1);
  assert.equal(file.places.length, 2);
  assert.equal(packLimited(file.format), true);
  assert.deepEqual(packMissing(file.places, file.format), ['police']);
  assert.deepEqual(packMissing(file.places), ['police']); // the old one-argument call
  assert.deepEqual(parsePackHelp(v1), file.places);
  assert.equal(parsePackToilets(v1).length, 1);
  // junk formats count as the first format, never as "has everything"
  for (const f of [0, -2, 1.5, '2', null]) assert.equal(packFormatOf({ format: f, places: [] }), 1, String(f));
  assert.equal(packFormatOf('not json'), 1);
  assert.equal(packFormatOf({ format: 3 }), 3);
  assert.deepEqual(packCategories(1), ['medical', 'pharmacy']);
  assert.deepEqual(packCategories(3), HELP_CATEGORIES);
});

test('old packs: meta.json / catalog entries without a format are format 1; the catalog stays version 1', () => {
  const raw = { id: 'kyoto', name: 'Kyoto', country: 'JP', bbox: BBOX, center: [135.76, 35.0], minzoom: 10, maxzoom: 16, file: 'kyoto.tar', bytes: 1000 };
  const old = parseCity(raw)!;
  assert.equal(old.format, undefined);
  assert.equal(packFormat(old), 1);
  const v2 = parseCity({ ...raw, format: 2 })!;
  assert.equal(v2.format, 2);
  assert.equal(packFormat(v2), 2);
  assert.equal(parseCity({ ...raw, format: 'two' })!.format, undefined);
  assert.equal(parseCity({ ...raw, format: 0 })!.format, undefined);
  const cat = parseCatalog({ version: 1, release: 'satchel-maps-v1', built: '2026-10-31', attribution: 'x', cities: [raw, { ...raw, id: 'tokyo', file: 'tokyo.tar', format: 2 }] })!;
  assert.deepEqual(cat.cities.map(packFormat), [1, 2]);
  // build.mjs keeps writing catalog version 1 (a version bump would hide every city from older app builds)
  assert.equal(parseCatalog({ version: 2, cities: [] }), null);
  const build = readFileSync(new URL('../../tools/maps/build.mjs', import.meta.url), 'utf8');
  assert.match(build, /const catalog = \{ version: 1,/);
  assert.match(build, /format: POIS_FORMAT/);
  assert.match(build, /toPois\(await overpass\(city\.bbox\), BUILT\)/);
});

test('docs: MAP_PACKS.md documents the format 2 pois.json fields', () => {
  const doc = read('../../docs/MAP_PACKS.md');
  for (const word of ['format', 'police', 'phone', 'opening_hours', 'pois.mjs']) assert.ok(doc.includes(word), word);
});

// ------------------------------------------------------------------ T63: Spending rate edits stamp the rate date

test('spending: the Spending screen saves rates with setRateOn, so the converter shows the rate date', () => {
  const src = read('../../app/spending/[tripId].tsx');
  assert.ok(!/\bsetRate\(/.test(src), 'Spending must not call setRate directly');
  assert.equal((src.match(/setRateOn\(trip, c, (rate|null), todayIn\(deviceZone\(\)\)\)/g) ?? []).length, 2);
});

test('spending: a rate typed on Spending is dated, a cleared one loses its date, and a home change drops stale dates', () => {
  const t0: Trip = { ...demoTrip('2026-11-10'), budget: { currency: 'AUD', amount: 100000 } };
  const t1 = setRateOn(t0, 'JPY', 0.0102, '2026-10-31');
  assert.deepEqual(rateDates(t1), { JPY: '2026-10-31' });
  const t2 = setRateOn(t1, 'JPY', 0.0105, '2026-11-02');
  assert.deepEqual(rateDates(t2), { JPY: '2026-11-02' });
  assert.deepEqual(rateDates(setRateOn(t2, 'JPY', null, '2026-11-03')), {});
  // home currency's own rate is refused and the trip is left as it was
  assert.equal(setRateOn(t2, 'AUD', 1.2, '2026-11-03'), t2);
});

// ------------------------------------------------------------------ T63: readiness map row refreshes after a download

test('signal: listeners hear every emit until they unsubscribe; a throwing listener does not stop the others', () => {
  const s = createSignal();
  const heard: string[] = [];
  const offA = s.subscribe(() => heard.push('a'));
  s.subscribe(() => {
    throw new Error('boom');
  });
  s.subscribe(() => heard.push('c'));
  s.emit();
  offA();
  offA();
  s.emit();
  assert.deepEqual(heard, ['a', 'c', 'c']);
  assert.equal(s.version(), 2);
});

test('readiness: the map row flips from "not downloaded" to passing once the city is installed', () => {
  const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
  const tokyo: CityMap = { id: 'tokyo', name: 'Tokyo', country: 'JP', bbox: [139.5, 35.5, 140.0, 35.9], center: [139.75, 35.7], minzoom: 10, maxzoom: 16, file: 'tokyo.tar', bytes: 1000 };
  const kyoto: CityMap = { ...tokyo, id: 'kyoto', name: 'Kyoto', bbox: [135.6, 34.9, 135.9, 35.1], center: [135.75, 35.0], file: 'kyoto.tar' };
  const catalog: CityCatalog = { version: 1, release: 'satchel-maps-v1', built: '2026-10-31', attribution: 'x', cities: [tokyo, kyoto] };
  let installed: CityMap[] = [];
  let row = mapCheck(trip, catalog, installed);
  assert.equal(row.reason, 'notDownloaded');
  // what the card does: reload on cityMapsChanged and work the row out again
  const off = cityMapsChanged.subscribe(() => {
    installed = [kyoto];
    row = mapCheck(trip, catalog, installed);
  });
  cityMapsChanged.emit();
  off();
  assert.equal(row.status, 'pass');
  assert.equal(row.city, 'Kyoto');
});

test('readiness: downloads, deletes and catalog saves emit cityMapsChanged, and the card and help cache listen', () => {
  const maps = read('../native/cityMaps.ts');
  assert.ok((maps.match(/cityMapsChanged\.emit\(\)/g) ?? []).length >= 3);
  assert.match(maps, /onProgress\('unpack', 1\);\s*cityMapsChanged\.emit\(\);\s*return \{ ok: true, city: meta \}/);
  const card = read('../ui/ReadinessCard.tsx');
  assert.match(card, /cityMapsChanged\.subscribe\(load\)/);
  const help = read('../native/help.ts');
  assert.match(help, /cityMapsChanged\.subscribe\(\(\) => cache\.clear\(\)\)/);
});
