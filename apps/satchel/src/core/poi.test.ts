import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import {
  bookingPins,
  categoryForTags,
  defaultToggles,
  distanceParts,
  filterByCategories,
  haversineMeters,
  MAP_V0_CATEGORIES,
  parsePoiCategories,
  parsePoiSet,
  regionFor,
  sortByDistance,
} from './poi.ts';

const load = (f: string): unknown => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const cats = parsePoiCategories(load('../content/osm_poi_tags.json'));

test('content: every Map v0 toggle exists in osm_poi_tags.json', () => {
  const ids = new Set(cats.map((c) => c.id));
  for (const id of MAP_V0_CATEGORIES) assert.ok(ids.has(id), id);
});

test('OSM tags map to the Map v0 categories', () => {
  const cases: [Record<string, string>, string | null][] = [
    [{ amenity: 'toilets' }, 'toilets'],
    [{ amenity: 'drinking_water' }, 'drinking_water'],
    [{ amenity: 'fuel' }, 'fuel'],
    [{ amenity: 'restaurant' }, 'food'],
    [{ amenity: 'cafe' }, 'food'],
    [{ amenity: 'fast_food' }, 'food'],
    [{ amenity: 'pharmacy' }, 'pharmacy'],
    [{ amenity: 'atm' }, 'atm_bank'],
    [{ amenity: 'hospital' }, 'hospital_clinic'],
    [{ healthcare: 'clinic' }, 'hospital_clinic'],
    [{ railway: 'station' }, 'transport'],
    [{ amenity: 'bus_station' }, 'transport'],
    [{ amenity: 'bench' }, null],
    [{}, null],
  ];
  for (const [tags, want] of cases) assert.equal(categoryForTags(tags, cats), want, JSON.stringify(tags));
});

test('exclusions veto their category: a subway entrance is not a station', () => {
  assert.equal(categoryForTags({ railway: 'subway_entrance', public_transport: 'station' }, cats), null);
  assert.equal(categoryForTags({ public_transport: 'station' }, cats), 'transport');
});

test('higher priority wins when tags match two categories', () => {
  // atm_bank is priority 4, pharmacy 5
  assert.equal(categoryForTags({ amenity: 'pharmacy', atm: 'yes' }, cats), 'pharmacy');
  const custom = parsePoiCategories({
    categories: [
      { id: 'a', tags: [{ key: 'k', value: 'v' }], priority: 1 },
      { id: 'b', tags: [{ key: 'k', value: 'v' }], priority: 3 },
      { id: 'c', tags: [{ key: 'k', value: 'v' }], priority: 3 },
    ],
  });
  assert.equal(categoryForTags({ k: 'v' }, custom), 'b');
});

test('parsePoiCategories skips malformed rows and duplicates', () => {
  const out = parsePoiCategories({
    categories: [null, { id: 'x' }, { id: 'y', tags: [{ key: 'a', value: 'b' }, { key: 'c' }] }, { id: 'y', tags: [{ key: 'a', value: 'b' }] }],
  });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].tags, [{ key: 'a', value: 'b' }]);
  assert.deepEqual(parsePoiCategories('nope'), []);
});

test('toggles start from default_on and filter the points', () => {
  const on = defaultToggles(cats);
  assert.deepEqual(Object.keys(on), [...MAP_V0_CATEGORIES]);
  assert.ok(Object.values(on).every((v) => v === true));
  const pois = [
    { id: '1', category: 'toilets' },
    { id: '2', category: 'food' },
    { id: '3', category: 'police' },
  ];
  assert.deepEqual(
    filterByCategories(pois, { ...on, food: false }).map((p) => p.id),
    ['1'],
  );
  assert.deepEqual(filterByCategories(pois, {}), []);
});

test('haversine: known distances', () => {
  assert.equal(haversineMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
  // one degree of latitude ~ 111.2 km
  assert.ok(Math.abs(haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 111_195) < 50);
  // Tokyo Station -> Kyoto Station ~ 372 km great-circle
  const d = haversineMeters({ lat: 35.6812, lon: 139.7671 }, { lat: 34.9858, lon: 135.7588 });
  assert.ok(d > 365_000 && d < 380_000, String(d));
  // symmetric, and fine across the antimeridian
  assert.ok(Math.abs(haversineMeters({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }) - 22_239) < 20);
});

test('sortByDistance: nearest first, stable ties, adds meters', () => {
  const from = { lat: 35, lon: 135 };
  const pts = [
    { id: 'far', lat: 35.1, lon: 135 },
    { id: 'tieA', lat: 35.01, lon: 135 },
    { id: 'near', lat: 35.001, lon: 135 },
    { id: 'tieB', lat: 34.99, lon: 135 },
  ];
  const out = sortByDistance(pts, from);
  assert.deepEqual(
    out.map((p) => p.id),
    ['near', 'tieA', 'tieB', 'far'],
  );
  assert.ok(out[0].meters > 100 && out[0].meters < 120);
  assert.equal('meters' in pts[0], false, 'input untouched');
});

test('distanceParts rounds for display', () => {
  assert.deepEqual(distanceParts(3), { n: '10', unit: 'm' });
  assert.deepEqual(distanceParts(347), { n: '350', unit: 'm' });
  assert.deepEqual(distanceParts(1234), { n: '1.2', unit: 'km' });
  assert.deepEqual(distanceParts(14_600), { n: '15', unit: 'km' });
  assert.deepEqual(distanceParts(Number.NaN), { n: '0', unit: 'm' });
});

for (const city of ['kyoto', 'tokyo']) {
  test(`demo POIs (${city}): labelled as sample data, every point maps to an offered category, near the demo hotel`, () => {
    const raw = load(`../content/demo_pois_${city}.json`) as { pois: unknown[] };
    const set = parsePoiSet(raw, cats);
    assert.ok(set);
    assert.equal(set.sample, true);
    assert.equal(set.source, 'sample data for the demo trip, not real OpenStreetMap data');
    assert.equal(set.pois.length, raw.pois.length, 'no point dropped');
    const offered = new Set<string>(MAP_V0_CATEGORIES);
    for (const p of set.pois) {
      assert.ok(offered.has(p.category), `${p.id} ${p.category}`);
      assert.match(p.name, /^Sample /, 'names say they are samples');
      assert.ok(haversineMeters(set.center, p) < 3000, p.id);
    }
    for (const id of MAP_V0_CATEGORIES) assert.ok(set.pois.some((p) => p.category === id), `${city} has ${id}`);
  });
}

test('parsePoiSet drops bad points and rejects bad files', () => {
  const set = parsePoiSet(
    {
      city: 'X',
      source: 's',
      center: { lat: 1, lon: 1 },
      pois: [
        { id: 'a', name: 'A', lat: 1, lon: 1, tags: { amenity: 'toilets' } },
        { id: 'a', name: 'dup', lat: 1, lon: 1, tags: { amenity: 'toilets' } },
        { id: 'b', name: 'B', lat: 91, lon: 1, tags: { amenity: 'toilets' } },
        { id: 'c', name: 'C', lat: 1, lon: 1, tags: { amenity: 'bench' } },
        { id: 'd', name: '', lat: 1, lon: 1, tags: { amenity: 'toilets' } },
      ],
    },
    cats,
  );
  assert.deepEqual(
    set?.pois.map((p) => p.id),
    ['a'],
  );
  assert.equal(parsePoiSet({ city: 'X', pois: [] }, cats), null);
  assert.equal(parsePoiSet(null, cats), null);
});

test('bookingPins: only places with coordinates, one per place per trip', () => {
  const trip = demoTrip('2026-11-03');
  const pins = bookingPins([trip]);
  // Every leg is pinned (airports and stations too); the return to Sydney T1 is the same place as the departure.
  assert.deepEqual(
    pins.map((p) => p.id),
    ['demo-f1:from', 'demo-f1:to', 'demo-h1:place', 'demo-a1:place', 'demo-t1:from', 'demo-t1:to', 'demo-h2:place', 'demo-f2:from'],
  );
  assert.ok(pins.some((p) => p.kind === 'train' && p.name === 'Kyoto Station'));
  assert.equal(pins[2].kind, 'hotel');
  assert.equal(pins[0].tripId, 'demo');
  const dup = { ...trip, items: [...trip.items, { ...trip.items[1], id: 'demo-h1b' }] };
  assert.equal(bookingPins([dup]).length, 8);
  const noCoords = { ...trip, items: trip.items.map((i) => ({ ...i, from: i.from && { id: i.from.id, name: i.from.name }, to: undefined })) };
  assert.ok(bookingPins([noCoords]).every((p) => p.id.endsWith(':place')), 'places without coordinates are skipped');
  assert.deepEqual(bookingPins([]), []);
});

test('regionFor covers the points with padding and a minimum span', () => {
  assert.equal(regionFor([]), null);
  const one = regionFor([{ lat: 35, lon: 135 }]);
  assert.deepEqual(one, { latitude: 35, longitude: 135, latitudeDelta: 0.02, longitudeDelta: 0.02 });
  const two = regionFor([
    { lat: 35, lon: 135 },
    { lat: 36, lon: 139 },
  ]);
  assert.ok(two);
  assert.equal(two.latitude, 35.5);
  assert.equal(two.longitude, 137);
  assert.ok(Math.abs(two.latitudeDelta - 1.3) < 1e-9);
  assert.ok(Math.abs(two.longitudeDelta - 5.2) < 1e-9);
});
