import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { upsertIdea, type Idea } from './ideas.ts';
import {
  bookingEntries,
  clearRecents,
  hitDistance,
  ideaEntries,
  matchTier,
  needsOsmCredit,
  normalize,
  packPlaceEntries,
  parsePackPlaces,
  parseRecents,
  pinEntries,
  prepare,
  pushRecent,
  RECENTS_MAX,
  removeRecent,
  sampleEntries,
  savedEntries,
  search,
  searchState,
  toiletEntries,
  type Labels,
  type SearchEntry,
} from './mapsearch.ts';
import { addPlace } from './places.ts';
import { parsePoiCategories, parsePoiSet } from './poi.ts';
import type { WaybackPin } from './wayback.ts';

const NOW = '2026-10-24T00:00:00Z';
const L: Labels = {
  kind: (k) => ({ booking: 'Booking', saved: 'Saved place', idea: 'Idea', pin: 'Pin', toilet: 'Toilet', place: 'Place', sample: 'Sample' })[k],
  category: (id) => ({ toilets: 'Toilets', pharmacy: 'Pharmacy', food: 'Food' })[id] ?? id,
  ideaCategory: (id) => id.toUpperCase(),
  bookingKind: (k) => k,
  pin: (p) => p.label ?? (p.preset === 'parked' ? 'I parked here' : 'Meeting point'),
};
const at = (lat: number, lon: number, rest: Partial<SearchEntry> & { key: string; name: string }): SearchEntry => ({ kind: 'saved', lat, lon, ...rest });

test('normalize: case, Latin accents, full width, apostrophes and punctuation', () => {
  assert.equal(normalize('  Café  SEÑOR! '), 'cafe senor');
  assert.equal(normalize('Ŝtraße Øresund Łódź'), 'strasse oresund lodz');
  assert.equal(normalize('Ｔｏｋｙｏ　Ｓｔａｔｉｏｎ'), 'tokyo station');
  assert.equal(normalize("O'Hare"), 'ohare');
  assert.equal(normalize('Gion-Shijō / 祇園四条'), 'gion shijo 祇園四条');
  assert.equal(normalize(''), '');
});

test('normalize: Japanese kana and kanji pass through, voiced marks kept, half-width katakana made full width', () => {
  assert.equal(normalize('ぎおん'), 'ぎおん');
  assert.equal(normalize('ガイド'), 'ガイド');
  assert.equal(normalize('ｶﾞｲﾄﾞ'), 'ガイド');
  assert.equal(normalize('東京タワー'), '東京タワー');
  assert.notEqual(normalize('が'), normalize('か'), 'dakuten is not an accent to strip');
});

test('matchTier: prefix > word start > substring > other words', () => {
  const [e] = prepare([at(35, 139, { key: 'a', name: 'Tsukiji Outer Market', terms: ['Activity', 'Morning at the fish market'] })]);
  assert.equal(matchTier(e, 'tsuk'), 0);
  assert.equal(matchTier(e, 'outer'), 1);
  assert.equal(matchTier(e, 'uter'), 2);
  assert.equal(matchTier(e, 'fish morning'), 3);
  assert.equal(matchTier(e, 'ramen'), null);
  assert.equal(matchTier(e, ''), null);
});

test('search ranks by tier first, then nearer first when a position is known', () => {
  const entries = prepare([
    at(35.70, 139.70, { key: 'far-prefix', name: 'Ramen Ichi' }),
    at(35.68, 139.76, { key: 'near-word', name: 'Shop Ramen' }),
    at(35.681, 139.761, { key: 'near-sub', name: 'Superramen' }),
    at(35.60, 139.60, { key: 'far-prefix-2', name: 'Ramen Ni' }),
  ]);
  assert.deepEqual(search(entries, 'ramen').map((h) => h.key), ['far-prefix-2', 'far-prefix', 'near-word', 'near-sub'], 'no position: shorter name first');
  const from = { lat: 35.6, lon: 139.6 };
  const hits = search(entries, 'RÁMEN', from);
  assert.deepEqual(hits.map((h) => h.key), ['far-prefix-2', 'far-prefix', 'near-word', 'near-sub']);
  assert.equal(hits[0].meters, 0);
  assert.ok((hits[1].meters ?? 0) > 10_000);
  assert.equal(hits[1].dir, 'ne');
  assert.ok(hits[1].walk && hits[1].walk.minutes > 100);
  assert.deepEqual(hitDistance(hits[1])?.unit, 'km');
});

test('search: no position means no distance; ties then go by kind, shorter name, then name', () => {
  const entries = prepare([
    at(1, 1, { key: 'p', kind: 'sample', name: 'Park' }),
    at(2, 2, { key: 'b', kind: 'booking', name: 'Park Hotel' }),
    at(3, 3, { key: 'b2', kind: 'booking', name: 'Park' }),
  ]);
  const hits = search(entries, 'park');
  assert.deepEqual(hits.map((h) => h.key), ['b2', 'b', 'p']);
  assert.equal(hits[0].meters, null);
  assert.equal(hits[0].dir, null);
  assert.equal(hits[0].walk, null);
  assert.equal(hitDistance(hits[0]), null);
});

test('search: the same name at the same spot shows once (higher kind wins); limit holds; bad positions skipped', () => {
  const entries = prepare([
    at(35.0058, 135.7776, { key: 'sample:kyo-01', kind: 'sample', name: 'Sample public toilets' }),
    at(35.00581, 135.7776, { key: 'saved:x', kind: 'saved', name: 'Sample public toilets' }),
    at(Number.NaN, 0, { key: 'bad', name: 'Sample broken' }),
    at(35.0058, 135.7776, { key: 'sample:kyo-01', kind: 'sample', name: 'duplicate key' }),
  ]);
  assert.equal(entries.length, 2);
  const hits = search(entries, 'sample');
  assert.deepEqual(hits.map((h) => h.key), ['saved:x']);
  const many = prepare(Array.from({ length: 100 }, (_, i) => at(i / 100, 0, { key: `k${i}`, name: `Cafe ${i}` })));
  assert.equal(search(many, 'cafe').length, 40);
  assert.equal(search(many, 'cafe', null, 5).length, 5);
});

test('empty and no-result states', () => {
  const entries = prepare([at(1, 1, { key: 'a', name: 'Kyoto Station' })]);
  assert.deepEqual(search(entries, '   '), []);
  assert.equal(searchState('  ', []), 'idle');
  assert.equal(searchState('!!', []), 'idle', 'punctuation only is nothing typed');
  const none = search(entries, 'zzz');
  assert.equal(searchState('zzz', none), 'none');
  assert.equal(searchState('kyo', search(entries, 'kyo')), 'results');
  assert.deepEqual(search([], 'kyoto'), []);
});

test('Japanese queries find Japanese names and local addresses', () => {
  const trip = demoTrip('2026-11-03', NOW);
  const entries = prepare([...bookingEntries([trip], L), at(35.0, 135.7, { key: 'j', name: '祇園 ぎおん茶屋' })]);
  assert.deepEqual(search(entries, 'ぎおん').map((h) => h.key), ['j']);
  assert.deepEqual(search(entries, '祇園').map((h) => h.key), ['j', 'booking:demo-h2:place']);
  assert.deepEqual(search(entries, '浅草').map((h) => h.key), ['booking:demo-h1:place']);
});

test('bookingEntries cover place, from and to with kind, title, address and trip as other words', () => {
  const trip = demoTrip('2026-11-03', NOW);
  const list = bookingEntries([trip], L);
  const names = list.map((e) => e.name);
  assert.ok(names.includes('Haneda Airport T3'));
  assert.ok(names.includes('Kyoto Station'));
  const hotel = list.find((e) => e.key === 'booking:demo-h1:place');
  assert.ok(hotel);
  assert.equal(hotel.itemId, 'demo-h1');
  assert.equal(hotel.detail, 'hotel · Tokyo & Kyoto (demo)');
  const entries = prepare(list);
  assert.deepEqual(search(entries, 'fish market').map((h) => h.key), ['booking:demo-a1:place']);
  assert.ok(search(entries, 'taito').some((h) => h.key === 'booking:demo-h1:place'), 'address finds it');
});

test('ideas with a spot, saved places and dropped pins are searchable', () => {
  let trip = demoTrip('2026-11-03', NOW);
  const idea: Idea = { id: 'i1', name: 'Fushimi Inari shrine', category: 'see', lat: 34.9671, lon: 135.7727, createdAt: NOW };
  trip = upsertIdea(trip, idea);
  trip = upsertIdea(trip, { id: 'i2', name: 'Fushimi sake museum', category: 'see', createdAt: NOW });
  const r = addPlace(trip, { name: 'Kissa Café', lat: 35.01, lon: 135.76, category: 'food' }, NOW, 'p1');
  assert.ok(r.ok);
  trip = r.trip;
  const ideas = ideaEntries([trip], L);
  assert.deepEqual(ideas.map((e) => e.name), ['Fushimi Inari shrine'], 'an idea without a spot is left out');
  assert.equal(ideas[0].detail, `SEE · ${trip.name}`);
  const saved = savedEntries([trip], L);
  assert.equal(saved[0].detail, `Food · ${trip.name}`);
  const pins: WaybackPin[] = [
    { id: 'pin1', preset: 'parked', lat: 35.0, lon: 135.7, droppedAt: NOW },
    { id: 'pin2', preset: 'custom', label: 'Bike rack', lat: 35.0, lon: 135.71, droppedAt: NOW },
  ];
  const entries = prepare([...ideas, ...saved, ...pinEntries(pins, L)]);
  assert.deepEqual(search(entries, 'cafe').map((h) => h.key), [`saved:${trip.id}:p1`]);
  assert.deepEqual(search(entries, 'parked').map((h) => h.key), ['pin:pin1']);
  assert.deepEqual(search(entries, 'pin').map((h) => h.key).sort(), ['pin:pin1', 'pin:pin2']);
  assert.deepEqual(search(entries, 'inari').map((h) => h.kind), ['idea']);
});

test('toilets go by their name or the kind word, deduped, OSM-credited', () => {
  const list = toiletEntries(
    [
      { id: 'n1', lat: 35.0, lon: 135.0 },
      { id: 'n1', lat: 35.0, lon: 135.0 },
      { id: 'n2', lat: 35.01, lon: 135.0, name: 'Station toilets' },
      { id: 'n3', lat: 99, lon: 135.0 },
    ],
    L,
  );
  assert.deepEqual(list.map((e) => e.name), ['Toilet', 'Station toilets']);
  const hits = search(prepare(list), 'toil', { lat: 35.01, lon: 135.0 });
  assert.deepEqual(hits.map((h) => h.key), ['toilet:n1', 'toilet:n2'], 'a name prefix beats a word start even when farther');
  const more = toiletEntries([{ id: 'a', lat: 35.0, lon: 135.0 }, { id: 'b', lat: 35.02, lon: 135.0 }], L);
  assert.deepEqual(search(prepare(more), 'toilet', { lat: 35.019, lon: 135.0 }).map((h) => h.key), ['toilet:b', 'toilet:a'], 'same tier: nearer first');
  assert.equal(needsOsmCredit(hits), true);
  assert.equal(needsOsmCredit(search(prepare([at(1, 1, { key: 'a', name: 'Toilet' })]), 'toilet')), false);
});

test('pack places: pois.json places[] parsed defensively; unnamed go by category', () => {
  const raw = JSON.stringify({
    format: 2,
    toilets: [],
    places: [
      { id: 'n10', lat: 35.0, lon: 135.0, category: 'pharmacy', name: 'Kamo Pharmacy' },
      { id: 'n11', lat: 35.001, lon: 135.0, category: 'pharmacy' },
      { id: 'n11', lat: 35.001, lon: 135.0, category: 'pharmacy' },
      { id: 'n12', lat: 'x', lon: 135.0, category: 'fuel' },
      { id: '', lat: 35, lon: 135, category: 'fuel' },
      null,
    ],
  });
  const places = parsePackPlaces(raw);
  assert.deepEqual(places.map((p) => p.id), ['n10', 'n11']);
  assert.deepEqual(parsePackPlaces('{oops'), []);
  assert.deepEqual(parsePackPlaces({ toilets: [] }), []);
  const entries = packPlaceEntries(places, 'Kyoto', L);
  assert.deepEqual(entries.map((e) => [e.name, e.detail, e.osm]), [['Kamo Pharmacy', 'Pharmacy · Kyoto', true], ['Pharmacy', 'Pharmacy · Kyoto', true]]);
  assert.deepEqual(search(prepare(entries), 'pharm').map((h) => h.key), ['place:n11', 'place:n10'], 'shorter name first when no position');
});

test('demo POIs are searchable and stay marked sample', () => {
  const cats = parsePoiCategories(JSON.parse(readFileSync(new URL('../content/osm_poi_tags.json', import.meta.url), 'utf8')));
  const set = parsePoiSet(JSON.parse(readFileSync(new URL('../content/demo_pois_kyoto.json', import.meta.url), 'utf8')), cats);
  assert.ok(set);
  const entries = prepare(sampleEntries(set.pois, set.city, L));
  const hits = search(entries, 'sample public', set.center);
  assert.ok(hits.length >= 2);
  assert.ok(hits.every((h) => h.sample === true && h.kind === 'sample'));
  assert.ok((hits[0].meters ?? Infinity) <= (hits[1].meters ?? Infinity));
});

test('recents: newest first, deduped ignoring case and accents, capped, removable, clearable', () => {
  let r: string[] = [];
  r = pushRecent(r, '  Gion  ');
  r = pushRecent(r, 'cafe');
  r = pushRecent(r, 'CAFÉ');
  assert.deepEqual(r, ['CAFÉ', 'Gion']);
  r = pushRecent(r, '   ');
  assert.deepEqual(r, ['CAFÉ', 'Gion'], 'blank is not a search');
  for (let i = 0; i < 20; i++) r = pushRecent(r, `q${i}`);
  assert.equal(r.length, RECENTS_MAX);
  assert.equal(r[0], 'q19');
  assert.equal(pushRecent([], 'x'.repeat(200))[0].length, 80);
  assert.deepEqual(removeRecent(['a', 'B'], 'b'), ['a']);
  assert.deepEqual(clearRecents(), []);
  assert.deepEqual(parseRecents(null), []);
  assert.deepEqual(parseRecents(['a', 3, '', 'A', ' b ']), ['a', 'b']);
  assert.equal(parseRecents(Array.from({ length: 30 }, (_, i) => `s${i}`)).length, RECENTS_MAX);
});
