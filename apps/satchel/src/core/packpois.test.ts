// T13: offline POI layers — parsing a city pack's pois.json, the per-category toggles (all on at first open), the
// empty-list "Show all" rule and the pipeline round trip (tools/maps/pois.mjs -> the app's parser).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { POI_TAGS, toPois } from '../../tools/maps/pois.mjs';
import {
  filterPoisByToggles,
  nearestPois,
  OFFERED_POI_CATEGORIES,
  OSM_POI_ATTRIBUTION,
  packPoiSet,
  parsePackPoiFile,
  parsePoiToggles,
  poiCategoryCounts,
  poiCategoriesOff,
  poiListEmpty,
  storePoiToggles,
  togglePoiCategory,
  allPoiCategoriesOn,
  type PackPoi,
} from './packpois.ts';
import { parsePoiCategories } from './poi.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const GOOD = {
  format: 2,
  built: '2026-10-30',
  attribution: '© OpenStreetMap contributors (ODbL)',
  toilets: [
    { id: 'n1', lat: 35.0, lon: 135.7, fee: 'no' },
    { id: 'n2', lat: 35.01, lon: 135.71, name: 'Station toilets', access: 'private' },
  ],
  places: [
    { id: 'n3', lat: 35.02, lon: 135.72, category: 'pharmacy', name: 'Corner Pharmacy' },
    { id: 'n4', lat: 35.03, lon: 135.73, category: 'food', name: 'Noodle bar' },
    { id: 'w5', lat: 35.04, lon: 135.74, category: 'atm_bank' },
  ],
};

test('pack POIs: toilets and places become map points; private toilets left out; unnamed kept without a name', () => {
  const r = parsePackPoiFile(JSON.stringify(GOOD));
  assert.ok(r.ok);
  assert.equal(r.format, 2);
  assert.deepEqual(
    r.pois.map((p) => [p.id, p.category, p.name ?? null]),
    [
      ['t:n1', 'toilets', null],
      ['p:n3', 'pharmacy', 'Corner Pharmacy'],
      ['p:n4', 'food', 'Noodle bar'],
      ['p:w5', 'atm_bank', null],
    ],
  );
  assert.equal(r.dropped, 1);
  assert.equal(r.truncated, false);
  // Parsed objects work too, and a format 1 file (no `format`) reads as 1.
  const old = parsePackPoiFile({ toilets: [], places: [{ id: 'n9', lat: 1, lon: 2, category: 'fuel' }] });
  assert.ok(old.ok && old.format === 1 && old.pois.length === 1);
});

test('pack POIs: malformed files give a reason, never a throw', () => {
  for (const bad of ['', '{', 'not json', 'null', '[]', '42', '"text"', '{"hello":1}']) {
    const r = parsePackPoiFile(bad);
    assert.deepEqual(r, { ok: false, reason: 'malformed' }, bad);
  }
  for (const bad of [null, undefined, 7, [], { toilets: 'x', places: 3 }]) assert.equal(parsePackPoiFile(bad).ok, false);
  // Only one of the two lists is enough.
  assert.ok(parsePackPoiFile({ places: [] }).ok);
  assert.ok(parsePackPoiFile({ toilets: [] }).ok);
});

test('pack POIs: malformed entries, unknown categories and missing names', () => {
  const r = parsePackPoiFile({
    places: [
      null,
      'n1',
      42,
      [],
      { lat: 1, lon: 1, category: 'fuel' }, // no id
      { id: '', lat: 1, lon: 1, category: 'fuel' }, // empty id
      { id: 'n2', lat: 1, lon: 1 }, // no category
      { id: 'n3', lat: 1, lon: 1, category: 'casino' }, // unknown category
      { id: 'n4', lat: 1, lon: 1, category: 'FUEL' }, // case matters
      { id: 'n5', lat: 1, lon: 1, category: 'fuel', name: '   ' }, // blank name: kept, unnamed
      { id: 'n6', lat: 1, lon: 1, category: 'fuel', name: 7 }, // non-string name: kept, unnamed
      { id: 'n7', lat: 1, lon: 1, category: 'fuel', name: 'x'.repeat(300) }, // junk-long name: kept, unnamed
      { id: 'n8', lat: 1, lon: 1, category: 'fuel', name: ' Line\nbreak ' },
      { id: 'n8', lat: 2, lon: 2, category: 'fuel', name: 'Duplicate' },
      { id: 123, lat: 1, lon: 1, category: 'police', name: 'Numeric id' },
    ],
  });
  assert.ok(r.ok);
  assert.deepEqual(
    r.pois.map((p) => [p.id, p.name ?? null]),
    [
      ['p:n5', null],
      ['p:n6', null],
      ['p:n7', null],
      ['p:n8', 'Line break'],
      ['p:123', 'Numeric id'],
    ],
  );
  assert.equal(r.dropped, 10);
});

test('pack POIs: coordinates out of range or not numbers are dropped', () => {
  const at = (lat: unknown, lon: unknown) => ({ id: `n${String(lat)}${String(lon)}`, lat, lon, category: 'transport' });
  const r = parsePackPoiFile({
    places: [at(91, 0), at(-90.0001, 0), at(0, 180.5), at(0, -181), at(Number.NaN, 0), at(0, Infinity), at('35', '135'), at(null, 0), at(undefined, undefined), at(90, 180), at(-90, -180), at(0, 0)],
  });
  assert.ok(r.ok);
  assert.deepEqual(
    r.pois.map((p) => [p.lat, p.lon]),
    [
      [90, 180],
      [-90, -180],
      [0, 0],
    ],
  );
  assert.equal(r.dropped, 9);
});

test('pack POIs: size limits — too-large text is refused, a long list is cut and says so', () => {
  const text = JSON.stringify(GOOD);
  assert.deepEqual(parsePackPoiFile(text, { maxChars: text.length - 1 }), { ok: false, reason: 'too-large' });
  assert.ok(parsePackPoiFile(text, { maxChars: text.length }).ok);
  const many = { places: Array.from({ length: 50 }, (_, i) => ({ id: `n${i}`, lat: 1, lon: 1, category: 'fuel' })) };
  const r = parsePackPoiFile(many, { maxPoints: 20 });
  assert.ok(r.ok && r.pois.length === 20 && r.truncated);
  assert.equal(r.ok && r.pois[19].id, 'p:n19');
});

test('pack POIs: a set for the map names unnamed points by category and centres on the bbox', () => {
  const r = parsePackPoiFile(GOOD);
  assert.ok(r.ok);
  const set = packPoiSet({ id: 'kyoto', name: 'Kyoto', bbox: [135.68, 34.93, 135.84, 35.07] }, r.pois, (c) => `[${c}]`);
  assert.equal(set.sample, false);
  assert.equal(set.source, 'pack:kyoto');
  assert.ok(Math.abs(set.center.lat - 35) < 1e-9 && Math.abs(set.center.lon - 135.76) < 1e-9);
  assert.deepEqual(set.pois.map((p) => p.name), ['[toilets]', 'Corner Pharmacy', 'Noodle bar', '[atm_bank]']);
});

test('toggles: release standard §1 — every offered category is ON at first open, even default_on false ones', () => {
  const cats = parsePoiCategories(JSON.parse(read('../content/osm_poi_tags.json')));
  // Some offered categories are default_on false in the content; that must not matter.
  const offOnes = cats.filter((c) => !c.defaultOn && (OFFERED_POI_CATEGORIES as readonly string[]).includes(c.id));
  assert.ok(offOnes.length >= 2, 'content has default_on false categories we offer (embassy, supermarket)');
  for (const first of [null, undefined, {}, [], 'junk', { off: 'toilets' }]) {
    const t = parsePoiToggles(first);
    for (const id of OFFERED_POI_CATEGORIES) assert.equal(t[id], true, `${id} on at first open`);
  }
  // Every offered category exists in the content file, and has an OSM extract in the pipeline.
  for (const id of OFFERED_POI_CATEGORIES) {
    assert.ok(cats.some((c) => c.id === id), `${id} in osm_poi_tags.json`);
    if (id !== 'toilets') assert.ok(POI_TAGS[id], `${id} in tools/maps POI_TAGS`);
  }
});

test('toggles: stored choices persist; unknown ids ignored; round trip', () => {
  let t = allPoiCategoriesOn();
  t = togglePoiCategory(t, 'food');
  t = togglePoiCategory(t, 'embassy');
  const stored = storePoiToggles(t);
  assert.deepEqual(stored, { off: ['food', 'embassy'] });
  const back = parsePoiToggles(JSON.parse(JSON.stringify({ ...stored, off: [...stored.off, 'casino', 3] })));
  assert.deepEqual(back, t);
  assert.equal(poiCategoriesOff(back), 2);
  assert.equal(togglePoiCategory(back, 'food').food, true);
});

test('filter + Nearby: markers and the list follow the toggles; an empty filtered list keeps Show all', () => {
  const pois: PackPoi[] = [
    { id: 't:1', category: 'toilets', lat: 35, lon: 135 },
    { id: 'p:2', category: 'food', lat: 35.001, lon: 135 },
  ];
  const on = allPoiCategoriesOn();
  assert.equal(filterPoisByToggles(pois, on).length, 2);
  const noFood = togglePoiCategory(on, 'food');
  assert.deepEqual(filterPoisByToggles(pois, noFood).map((p) => p.id), ['t:1']);
  // Sample-set categories outside the offered list stay shown.
  assert.equal(filterPoisByToggles([{ category: 'tourist_info' }], noFood).length, 1);
  assert.deepEqual(poiCategoryCounts(pois).food, 1);

  assert.equal(poiListEmpty(2, 1, noFood), null);
  const onlyFood = OFFERED_POI_CATEGORIES.filter((c) => c !== 'food').reduce((t, c) => togglePoiCategory(t, c), on);
  assert.deepEqual(filterPoisByToggles(pois, togglePoiCategory(onlyFood, 'food')), []);
  assert.deepEqual(poiListEmpty(2, 0, togglePoiCategory(onlyFood, 'food')), { kind: 'noneOn', showAll: true });
  assert.deepEqual(poiListEmpty(2, 0, noFood), { kind: 'noneInCats', showAll: true });
  assert.deepEqual(poiListEmpty(0, 0, on), { kind: 'none', showAll: false });
});

test('nearest: capped, nearest first, ties in file order', () => {
  const pts = [
    { id: 'far', lat: 35.1, lon: 135 },
    { id: 'a', lat: 35.01, lon: 135 },
    { id: 'b', lat: 34.99, lon: 135 },
    { id: 'near', lat: 35.001, lon: 135 },
  ];
  assert.deepEqual(nearestPois(pts, { lat: 35, lon: 135 }, 3).map((p) => p.id), ['near', 'a', 'b']);
  assert.deepEqual(nearestPois(pts, { lat: 35, lon: 135 }, 0), []);
});

test('pipeline round trip: tools/maps toPois output (new categories too) parses in the app', () => {
  const file = toPois(
    [
      { type: 'node', id: 1, lat: 35.0, lon: 135.7, tags: { amenity: 'toilets' } },
      { type: 'node', id: 2, lat: 35.01, lon: 135.71, tags: { amenity: 'cafe', name: 'Kissa' } },
      { type: 'node', id: 3, lat: 35.02, lon: 135.72, tags: { shop: 'supermarket', name: 'Market' } },
      { type: 'way', id: 4, center: { lat: 35.03, lon: 135.73 }, tags: { office: 'diplomatic', name: 'Embassy' } },
      { type: 'node', id: 5, lat: 35.04, lon: 135.74, tags: { amenity: 'police' } },
      { type: 'node', id: 6, lat: 35.05, lon: 135.75, tags: { amenity: 'restaurant' } },
    ],
    '2026-11-01',
  );
  assert.equal(file.attribution, OSM_POI_ATTRIBUTION);
  const r = parsePackPoiFile(JSON.stringify(file));
  assert.ok(r.ok);
  assert.deepEqual(
    r.pois.map((p) => p.category),
    ['toilets', 'food', 'supermarket', 'embassy', 'police', 'food'],
  );
  assert.equal(r.dropped, 0);
});

test('attribution: the map line and the pack line both credit OpenStreetMap under the ODbL', () => {
  const en = read('../i18n/en/packpois.ts');
  assert.match(en, /© OpenStreetMap contributors \(ODbL\)/);
});
