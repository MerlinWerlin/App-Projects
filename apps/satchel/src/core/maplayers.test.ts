// T117 map layers + legend: registry, stored choices, counts, the visibility filter with stand-ins, bounds and
// fit region (incl. the antimeridian), the trip scope, the new pin families, and the Map tab wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Idea } from './ideas.ts';
import type { Item, Trip } from './model.ts';
import {
  boundsOf,
  dayPlanPins,
  DEFAULT_LAYER_PREFS,
  fitRegion,
  hiddenCount,
  ideaPins,
  isShown,
  LAYER_SPECS,
  layerCounts,
  layerOf,
  lonSpan,
  MAP_LAYERS,
  MAPLAYERS_KEY,
  parseLayerPrefs,
  regionOfBounds,
  showAllLayers,
  startScope,
  toggleLayer,
  toiletLayerPins,
  visiblePins,
  waybackLayerPins,
  withScope,
  type LayerPrefs,
} from './maplayers.ts';
import { en } from '../i18n/en.ts';
import { maplayers } from '../i18n/en/maplayers.ts';

const pin = (id: string, lat = 35, lon = 139) => ({ id, lat, lon });
const prefs = (hidden: LayerPrefs['hidden'] = [], scope: LayerPrefs['scope'] = 'all'): LayerPrefs => ({ hidden, scope });

// ---- registry ----

test('registry: every family has a distinct prefix, an icon and a theme tone; ids map back by prefix', () => {
  const prefixes = MAP_LAYERS.map((id) => LAYER_SPECS[id].prefix);
  assert.equal(new Set(prefixes).size, MAP_LAYERS.length);
  for (const id of MAP_LAYERS) {
    const s = LAYER_SPECS[id];
    assert.equal(s.id, id);
    assert.match(s.icon, /^[a-z-]+$/);
    assert.ok(s.tone);
    assert.equal(layerOf(`${s.prefix}x`), id);
  }
  // the ids map.tsx and the route layer already use
  assert.equal(layerOf('r:item1:place'), 'route');
  assert.equal(layerOf('b:item1:from'), 'bookings');
  assert.equal(layerOf('s:trip:place'), 'saved');
  assert.equal(layerOf('g:t/p/g'), 'gifts');
  assert.equal(layerOf('p:node/1'), 'pois');
  for (const other of ['me', 'spot', 'search', '']) assert.equal(layerOf(other), null);
  assert.equal(LAYER_SPECS.route.tripOnly, true);
  assert.equal(LAYER_SPECS.route.byDay, true);
  assert.equal(LAYER_SPECS.wayback.phone, true);
  assert.equal(LAYER_SPECS.toilets.phone, true);
});

// ---- stored choices ----

test('parseLayerPrefs: defensive; unknown layers dropped, registry order, scope all unless trip', () => {
  assert.deepEqual(parseLayerPrefs(undefined), DEFAULT_LAYER_PREFS);
  assert.deepEqual(parseLayerPrefs(null), DEFAULT_LAYER_PREFS);
  assert.deepEqual(parseLayerPrefs('x'), DEFAULT_LAYER_PREFS);
  assert.deepEqual(parseLayerPrefs([]), DEFAULT_LAYER_PREFS);
  assert.deepEqual(parseLayerPrefs({ hidden: ['pois', 'nope', 'bookings', 'pois', 3], scope: 'trip' }), { hidden: ['bookings', 'pois'], scope: 'trip' });
  assert.deepEqual(parseLayerPrefs({ hidden: 'pois', scope: 'weird' }), { hidden: [], scope: 'all' });
  assert.equal(MAPLAYERS_KEY, 'satchel.maplayers.v1');
});

test('toggle, show all, scope: pure updates that round-trip through the parser', () => {
  let p = toggleLayer(DEFAULT_LAYER_PREFS, 'pois');
  assert.equal(isShown(p, 'pois'), false);
  p = toggleLayer(p, 'route');
  assert.deepEqual(p.hidden, ['route', 'pois']);
  assert.equal(hiddenCount(p), 2);
  assert.deepEqual(parseLayerPrefs(JSON.parse(JSON.stringify(p))), p);
  p = toggleLayer(p, 'pois');
  assert.deepEqual(p.hidden, ['route']);
  assert.deepEqual(showAllLayers(p).hidden, []);
  assert.equal(withScope(p, 'trip').scope, 'trip');
  assert.deepEqual(DEFAULT_LAYER_PREFS, { hidden: [], scope: 'all' }, 'the default is never changed in place');
});

test('startScope: a ?tripId param wins; "all" is every trip; otherwise the stored choice scopes to the trip on now', () => {
  assert.equal(startScope('t1', prefs(), 't2'), 't1');
  assert.equal(startScope(['t1'], prefs([], 'trip'), 't2'), 't1');
  assert.equal(startScope('all', prefs([], 'trip'), 't2'), null);
  assert.equal(startScope(undefined, prefs([], 'trip'), 't2'), 't2');
  assert.equal(startScope('', prefs([], 'trip'), 't2'), 't2');
  assert.equal(startScope(undefined, prefs([], 'trip'), null), null, 'no trip to scope to');
  assert.equal(startScope(undefined, prefs(), 't2'), null);
});

// ---- counts + filter ----

test('layerCounts counts every family (zero when empty) and ignores pins outside the layers', () => {
  const c = layerCounts([pin('b:1'), pin('b:2'), pin('p:a'), pin('me'), pin('search'), pin('w:x')]);
  assert.equal(c.bookings, 2);
  assert.equal(c.pois, 1);
  assert.equal(c.wayback, 1);
  assert.equal(c.route, 0);
  assert.deepEqual(Object.keys(c), [...MAP_LAYERS]);
});

test('visiblePins: hidden families leave, pins outside the layers stay, order kept', () => {
  const all = [pin('me', 1, 1), pin('b:1', 2, 2), pin('p:a', 3, 3), pin('s:x', 4, 4), pin('search', 5, 5)];
  assert.deepEqual(visiblePins(all, prefs()).map((p) => p.id), ['me', 'b:1', 'p:a', 's:x', 'search']);
  assert.deepEqual(visiblePins(all, prefs(['pois', 'bookings'])).map((p) => p.id), ['me', 's:x', 'search']);
  assert.deepEqual(visiblePins(all, prefs([...MAP_LAYERS])).map((p) => p.id), ['me', 'search']);
});

test('visiblePins: on one spot the earlier family stands in; hide it and the other shows; same family never hides itself', () => {
  const spot = { lat: 35.0000001, lon: 139.0000002 };
  const list = [pin('p:a', 35, 139), pin('s:x', spot.lat, spot.lon), pin('i:t/1', 35, 139), pin('r:item:place', 35, 139), pin('me', 35, 139)];
  assert.deepEqual(visiblePins(list, prefs()).map((p) => p.id), ['r:item:place', 'me']);
  assert.deepEqual(visiblePins(list, prefs(['route'])).map((p) => p.id), ['i:t/1', 'me']);
  assert.deepEqual(visiblePins(list, prefs(['route', 'ideas'])).map((p) => p.id), ['s:x', 'me']);
  assert.deepEqual(visiblePins(list, prefs(['route', 'saved', 'ideas'])).map((p) => p.id), ['p:a', 'me']);
  // two bookings at one hotel both stay
  assert.deepEqual(visiblePins([pin('b:1', 1, 1), pin('b:2', 1, 1)], prefs()).map((p) => p.id), ['b:1', 'b:2']);
  // a little apart is a different spot
  assert.equal(visiblePins([pin('s:x', 1, 1), pin('p:a', 1.0001, 1)], prefs()).length, 2);
});

// ---- bounds ----

test('boundsOf: plain box; none and invalid points give null', () => {
  assert.equal(boundsOf([]), null);
  assert.equal(boundsOf([{ lat: Number.NaN, lon: 1 }, { lat: 95, lon: 0 }]), null);
  const b = boundsOf([{ lat: 35.6, lon: 139.7 }, { lat: 35.0, lon: 135.7 }, { lat: 34.6, lon: 135.5 }])!;
  assert.deepEqual(b, { south: 34.6, north: 35.6, west: 135.5, east: 139.7, crosses: false });
  assert.ok(Math.abs(lonSpan(b) - 4.2) < 1e-9);
});

test('boundsOf: Fiji to Samoa crosses the antimeridian instead of spanning the world', () => {
  const b = boundsOf([{ lat: -18.1, lon: 178.4 }, { lat: -13.8, lon: -171.8 }, { lat: -17.7, lon: 177.4 }])!;
  assert.equal(b.crosses, true);
  assert.equal(b.west, 177.4);
  assert.equal(b.east, -171.8);
  assert.ok(Math.abs(lonSpan(b) - 10.8) < 1e-9);
  const r = regionOfBounds(b, 1);
  assert.ok(Math.abs(r.longitude - -177.2) < 1e-9, `centre over the line, was ${r.longitude}`);
  assert.ok(Math.abs(r.longitudeDelta - 10.8) < 1e-9);
  assert.ok(Math.abs(r.latitude - -15.95) < 1e-9);
});

test('boundsOf: points either side of the 180th meridian near the line; out-of-range longitudes are skipped', () => {
  assert.equal(boundsOf([{ lat: 0, lon: 180.1 }]), null);
  const b = boundsOf([{ lat: 0, lon: 179.9 }, { lat: 1, lon: -179.9 }])!;
  assert.equal(b.crosses, true);
  assert.ok(Math.abs(lonSpan(b) - 0.2) < 1e-9);
  const r = regionOfBounds(b, 1, 0);
  assert.ok(Math.abs(Math.abs(r.longitude) - 180) < 1e-9);
  // Tokyo and Los Angeles: the Pacific is the shorter way
  const p = boundsOf([{ lat: 35.7, lon: 139.7 }, { lat: 34.05, lon: -118.24 }])!;
  assert.equal(p.crosses, true);
  assert.ok(lonSpan(p) < 120);
  // London and New York don't cross
  const a = boundsOf([{ lat: 51.5, lon: -0.1 }, { lat: 40.7, lon: -74 }])!;
  assert.equal(a.crosses, false);
});

test('regionOfBounds / fitRegion: padding, a minimum for one pin, caps; null for none', () => {
  const one = fitRegion([{ lat: 10, lon: 20 }])!;
  assert.deepEqual(one, { latitude: 10, longitude: 20, latitudeDelta: 0.01, longitudeDelta: 0.01 });
  const r = fitRegion([{ lat: 0, lon: 0 }, { lat: 1, lon: 2 }])!;
  assert.ok(Math.abs(r.latitudeDelta - 1.3) < 1e-9);
  assert.ok(Math.abs(r.longitudeDelta - 2.6) < 1e-9);
  const world = fitRegion([{ lat: -80, lon: -170 }, { lat: 80, lon: 0 }, { lat: 0, lon: 100 }])!;
  assert.ok(world.latitudeDelta <= 180 && world.longitudeDelta <= 360);
  assert.equal(fitRegion([]), null);
});

// ---- new families ----

const idea = (id: string, extra: Partial<Idea> = {}): Idea => ({ id, name: `Idea ${id}`, category: 'eat', createdAt: '2027-03-01T00:00:00.000Z', ...extra }) as Idea;
const trip = (extra: Partial<Trip> = {}): Trip => ({ id: 't1', name: 'Tokyo', startDate: '2027-04-01', endDate: '2027-04-05', homeTz: 'Australia/Sydney', items: [], createdAt: '2027-01-01T00:00:00.000Z', ...extra });

test('ideaPins: ideas with a map spot only, on every trip given, with the trip for the tap', () => {
  const t1 = trip({ ideas: [idea('a', { lat: 35.7, lon: 139.7, done: true }), idea('b'), idea('c', { lat: 99, lon: 0 })] });
  const t2 = trip({ id: 't2', name: 'Kyoto', ideas: [idea('d', { lat: 35, lon: 135.7 })] });
  const pins = ideaPins([t1, t2]);
  assert.deepEqual(pins.map((p) => p.id), ['i:t1/a', 'i:t2/d']);
  assert.equal(pins[0].done, true);
  assert.equal(pins[1].tripName, 'Kyoto');
  assert.ok(pins.every((p) => layerOf(p.id) === 'ideas'));
  assert.deepEqual(ideaPins([trip()]), []);
});

test('waybackLayerPins / toiletLayerPins read the phone lists defensively', () => {
  const w = waybackLayerPins([{ id: 'p1', preset: 'parked', lat: 1, lon: 2, droppedAt: '2027-01-01' }, { id: 'bad' }, 'x']);
  assert.deepEqual(w.map((p) => [p.id, p.pinId]), [['w:p1', 'p1']]);
  assert.deepEqual(waybackLayerPins(null), []);
  const t = toiletLayerPins([{ toilet: { id: 'n1', lat: 3, lon: 4, name: 'Park loo' }, note: 'clean', vote: null, savedAt: 1 }, { toilet: { id: 'n2' } }]);
  assert.deepEqual(t, [{ id: 't:n1', toiletId: 'n1', lat: 3, lon: 4, name: 'Park loo', note: 'clean' }]);
  assert.deepEqual(toiletLayerPins(undefined), []);
});

test('dayPlanPins: today’s numbered stops for the trip on today; nothing outside its dates or with no trip', () => {
  const TZ = 'Asia/Tokyo';
  const hotel: Item = { id: 'h1', tripId: 't1', kind: 'hotel', title: 'Hotel', start: { local: '2027-04-01T15:00', tz: TZ }, end: { local: '2027-04-05T11:00', tz: TZ }, place: { id: 'ph', name: 'Hotel', lat: 35.7, lon: 139.7 }, attachments: [] };
  const t = trip({ items: [hotel], ideas: [idea('a', { lat: 35.71, lon: 139.71, day: '2027-04-03' }), idea('b', { lat: 35.72, lon: 139.72, day: '2027-04-03' })] });
  const pins = dayPlanPins(t, '2027-04-03');
  assert.equal(pins.length, 2);
  assert.deepEqual(pins.map((p) => p.n), [1, 2]);
  assert.ok(pins.every((p) => p.id.startsWith('d:t1/') && layerOf(p.id) === 'dayplan' && p.day === '2027-04-03'));
  assert.deepEqual(dayPlanPins(t, '2027-05-01'), []);
  assert.deepEqual(dayPlanPins(null, '2027-04-03'), []);
});

// ---- strings + wiring ----

test('strings: every maplayers key is prefixed, in the English catalogue, and each layer has a name and a description', () => {
  for (const k of Object.keys(maplayers)) {
    assert.ok(k.startsWith('maplayers.'), k);
    assert.ok(k in en, k);
  }
  for (const id of MAP_LAYERS) {
    assert.ok(`maplayers.layer.${id}` in maplayers, id);
    assert.ok(`maplayers.layer.${id}.desc` in maplayers, id);
  }
});

test('wiring: the Map tab filters through the layers, keeps the choice on the phone, and the sheet uses timed motion only', () => {
  const map = readFileSync(new URL('../../app/(tabs)/map.tsx', import.meta.url), 'utf8');
  const sheet = readFileSync(new URL('../ui/MapLayersSheet.tsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../ui/useMapLayers.ts', import.meta.url), 'utf8');
  assert.match(map, /useMapLayers\(/);
  assert.match(map, /<MapLayersSheet/);
  assert.match(hook, /usePersisted<unknown>\(MAPLAYERS_KEY/);
  assert.match(hook, /visiblePins\(/);
  for (const src of [sheet, hook]) {
    assert.doesNotMatch(src, /Animated\.spring|spring\(|bounce/i);
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'tokens only');
  }
  assert.match(sheet, /accessibilityViewIsModal/);
});
