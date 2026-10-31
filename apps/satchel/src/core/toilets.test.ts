import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Item, Trip } from './model.ts';
import {
  appleMapsWalkUrl,
  arrowDegrees,
  bearingDeg,
  compass8,
  compassKey,
  dedupe,
  inBbox,
  isAlwaysOpen,
  nearestToilets,
  normalizeToilet,
  overpassQuery,
  parseBbox,
  parseOverpass,
  parsePackToilets,
  stayFor,
  toiletChips,
  walkMinutes,
  type Toilet,
} from './toilets.ts';

const HERE = { lat: 35.0, lon: 135.75 };

test('parseOverpass: nodes use lat/lon, ways and relations use center, ids get n/w/r', () => {
  const json = {
    elements: [
      { type: 'node', id: 1, lat: 35.001, lon: 135.75, tags: { amenity: 'toilets', name: 'Park WC', fee: 'no', wheelchair: 'yes' } },
      { type: 'way', id: 22, center: { lat: 35.002, lon: 135.751 }, tags: { amenity: 'toilets', changing_table: 'yes' } },
      { type: 'relation', id: 333, center: { lat: 35.003, lon: 135.752 }, tags: { amenity: 'toilets' } },
      { type: 'way', id: 4, tags: { amenity: 'toilets' } }, // no center: dropped
    ],
  };
  const out = parseOverpass(json);
  assert.deepEqual(
    out.map((t) => t.id),
    ['n1', 'w22', 'r333'],
  );
  assert.deepEqual(out[0], { id: 'n1', lat: 35.001, lon: 135.75, name: 'Park WC', fee: 'no', wheelchair: 'yes' });
  assert.equal(out[1]?.lat, 35.002);
  assert.equal(out[1]?.changing_table, 'yes');
});

test('parseOverpass: drops private / no access, keeps customers, ignores other amenities and junk', () => {
  const json = JSON.stringify({
    elements: [
      { type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'toilets', access: 'private' } },
      { type: 'node', id: 2, lat: 1, lon: 1, tags: { amenity: 'toilets', access: 'No' } },
      { type: 'node', id: 3, lat: 1, lon: 1, tags: { amenity: 'toilets', access: 'customers' } },
      { type: 'node', id: 4, lat: 1, lon: 1, tags: { amenity: 'cafe' } },
      { type: 'node', id: 5, lat: 91, lon: 1, tags: { amenity: 'toilets' } },
      { type: 'area', id: 6, lat: 1, lon: 1 },
      null,
      'x',
      { type: 'node', id: 3, lat: 2, lon: 2, tags: { amenity: 'toilets' } }, // duplicate id
      { type: 'node', id: 7, lat: 1, lon: 1, tags: { amenity: 'toilets', diaper: 'yes', name: '   ' } },
    ],
  });
  const out = parseOverpass(json);
  assert.deepEqual(
    out.map((t) => t.id),
    ['n3', 'n7'],
  );
  assert.equal(out[0]?.lat, 1, 'first duplicate wins');
  assert.equal(out[1]?.changing_table, 'yes', 'diaper=yes counts as a changing table');
  assert.equal(out[1]?.name, undefined, 'blank names dropped');
  assert.deepEqual(parseOverpass('not json'), []);
  assert.deepEqual(parseOverpass({}), []);
  assert.deepEqual(parseOverpass(null), []);
});

test('parsePackToilets: contract shape, validated, private dropped, deduped', () => {
  const pois = { built: '2026-10-31', toilets: [{ id: 'n9', lat: 35, lon: 135.7, fee: 'yes', opening_hours: '24/7' }, { id: 'n9', lat: 0, lon: 0 }, { id: 'w1', lat: 35, lon: 135.7, access: 'private' }, { lat: 1, lon: 1 }, { id: 'n2', lat: '35', lon: 1 }], places: [] };
  const out = parsePackToilets(JSON.stringify(pois));
  assert.deepEqual(out, [{ id: 'n9', lat: 35, lon: 135.7, fee: 'yes', opening_hours: '24/7' }]);
  assert.deepEqual(parsePackToilets('{'), []);
  assert.deepEqual(parsePackToilets({ toilets: 'nope' }), []);
  assert.equal(normalizeToilet({ id: 'n1', lat: 1, lon: 1, unisex: 'yes', extra: 'x' })?.unisex, 'yes');
});

test('toiletChips: fee, wheelchair, changing table, unisex, customers, hours', () => {
  const ids = (t: Partial<Toilet>) => toiletChips({ id: 'n1', lat: 0, lon: 0, ...t }).map((c) => c.id);
  assert.deepEqual(ids({}), ['feeUnknown']);
  assert.deepEqual(ids({ fee: 'no' }), ['free']);
  assert.deepEqual(ids({ fee: 'yes' }), ['paid']);
  assert.deepEqual(ids({ fee: '100 JPY' }), ['paid']);
  assert.deepEqual(ids({ fee: 'no', wheelchair: 'yes' }), ['free', 'wheelchair']);
  assert.deepEqual(ids({ fee: 'no', wheelchair: 'designated' }), ['free', 'wheelchair']);
  assert.deepEqual(ids({ fee: 'no', wheelchair: 'limited' }), ['free', 'wheelchairLimited']);
  assert.deepEqual(ids({ fee: 'no', wheelchair: 'no' }), ['free', 'noWheelchair']);
  assert.deepEqual(ids({ fee: 'no', wheelchair: 'unknown' }), ['free']);
  assert.deepEqual(ids({ fee: 'no', changing_table: 'yes', unisex: 'yes', access: 'customers' }), ['free', 'changingTable', 'unisex', 'customersOnly']);
  assert.deepEqual(ids({ fee: 'no', changing_table: 'no' }), ['free']);
  assert.deepEqual(ids({ opening_hours: '24/7' }), ['feeUnknown', 'open247']);
  const hours = toiletChips({ id: 'n1', lat: 0, lon: 0, opening_hours: 'Mo-Fr 08:00-20:00' });
  assert.deepEqual(hours[1], { id: 'hours', text: 'Mo-Fr 08:00-20:00' });
  const long = toiletChips({ id: 'n1', lat: 0, lon: 0, opening_hours: 'Mo-Fr 08:00-20:00; Sa 09:00-18:00; Su 10:00-16:00; PH off' })[1];
  assert.ok(long && long.id === 'hours' && long.text.length === 40 && long.text.endsWith('…'));
});

test('isAlwaysOpen recognises the usual 24/7 spellings', () => {
  assert.ok(isAlwaysOpen('24/7'));
  assert.ok(isAlwaysOpen(' 24/7 '));
  assert.ok(isAlwaysOpen('Mo-Su 00:00-24:00'));
  assert.ok(isAlwaysOpen('00:00-24:00'));
  assert.ok(!isAlwaysOpen('Mo-Fr 00:00-24:00'));
  assert.ok(!isAlwaysOpen(undefined));
  assert.ok(!isAlwaysOpen(''));
});

test('bearing and 8-point compass', () => {
  assert.ok(Math.abs(bearingDeg(HERE, { lat: 35.01, lon: 135.75 }) - 0) < 0.01);
  assert.ok(Math.abs(bearingDeg(HERE, { lat: 35, lon: 135.76 }) - 90) < 0.1);
  assert.ok(Math.abs(bearingDeg(HERE, { lat: 34.99, lon: 135.75 }) - 180) < 0.01);
  assert.ok(Math.abs(bearingDeg(HERE, { lat: 35, lon: 135.74 }) - 270) < 0.1);
  assert.equal(bearingDeg(HERE, HERE), 0);
  assert.equal(compass8(0), 'n');
  assert.equal(compass8(22.4), 'n');
  assert.equal(compass8(22.6), 'ne');
  assert.equal(compass8(135), 'se');
  assert.equal(compass8(337.6), 'n');
  assert.equal(compass8(359.9), 'n');
  assert.equal(compass8(-90), 'w');
  assert.equal(compass8(720 + 225), 'sw');
  assert.equal(compassKey(45), 'toilets.dir.ne');
  assert.equal(arrowDegrees(359.7), 0);
  assert.equal(arrowDegrees(-45), 315);
  // crossing the antimeridian: going east from 179.99 to -179.99 is east, not west
  assert.equal(compass8(bearingDeg({ lat: 0, lon: 179.99 }, { lat: 0, lon: -179.99 })), 'e');
});

test('walkMinutes at 4.8 km/h, never 0', () => {
  assert.equal(walkMinutes(80), 1);
  assert.equal(walkMinutes(0), 1);
  assert.equal(walkMinutes(Number.NaN), 1);
  assert.equal(walkMinutes(800), 10);
  assert.equal(walkMinutes(4800), 60);
});

test('nearestToilets: nearest first, dedupe, limit, max distance, direction', () => {
  const list: Toilet[] = [
    { id: 'far', lat: 35.02, lon: 135.75 },
    { id: 'near', lat: 35.001, lon: 135.751 },
    { id: 'mid', lat: 34.995, lon: 135.75 },
    { id: 'near', lat: 40, lon: 140 },
  ];
  const hits = nearestToilets(list, HERE);
  assert.deepEqual(
    hits.map((h) => h.id),
    ['near', 'mid', 'far'],
  );
  assert.equal(hits[0]?.dirKey, 'toilets.dir.ne');
  assert.equal(hits[1]?.dirKey, 'toilets.dir.s');
  assert.ok(hits[1] && Math.abs(hits[1].meters - 556) < 2);
  assert.equal(hits[1]?.minutes, 7);
  assert.deepEqual(
    nearestToilets(list, HERE, 1).map((h) => h.id),
    ['near'],
  );
  assert.deepEqual(
    nearestToilets(list, HERE, 60, 1000).map((h) => h.id),
    ['near', 'mid'],
  );
  assert.deepEqual(nearestToilets([], HERE), []);
  assert.deepEqual(nearestToilets(list, HERE, 0), []);
  assert.deepEqual(
    dedupe([{ id: 'a' }, { id: 'a' }, { id: 'b' }]).map((x) => x.id),
    ['a', 'b'],
  );
});

test('bbox parse and containment, including the antimeridian', () => {
  const b = parseBbox([135.6, 34.9, 135.9, 35.1]);
  assert.ok(b);
  assert.ok(inBbox(b, HERE));
  assert.ok(inBbox(b, { lat: 34.9, lon: 135.6 }), 'edges count');
  assert.ok(!inBbox(b, { lat: 35.2, lon: 135.75 }));
  assert.ok(!inBbox(b, { lat: 35, lon: 136 }));
  const fiji = parseBbox([177, -19, -178, -16]);
  assert.ok(fiji && inBbox(fiji, { lat: -18, lon: 179 }) && inBbox(fiji, { lat: -18, lon: -179 }) && !inBbox(fiji, { lat: -18, lon: 0 }));
  assert.equal(parseBbox([1, 2, 3]), null);
  assert.equal(parseBbox([0, 10, 1, 5]), null);
  assert.equal(parseBbox(['1', 2, 3, 4]), null);
  assert.equal(parseBbox(null), null);
});

test('overpassQuery: exact QL, rounded radius, clamped', () => {
  assert.equal(overpassQuery(35.0116, 135.7681, 800), '[out:json][timeout:20];nwr["amenity"="toilets"](around:800,35.0116,135.7681);out center 60;');
  assert.equal(overpassQuery(35.123456789, -0.5, 2500.4), '[out:json][timeout:20];nwr["amenity"="toilets"](around:2500,35.123457,-0.5);out center 60;');
  assert.match(overpassQuery(0, 0, 999999), /around:10000,/);
  assert.match(overpassQuery(0, 0, -5), /around:1,/);
  assert.match(overpassQuery(0, 0, Number.NaN), /around:800,/);
});

test('appleMapsWalkUrl: walking directions, optional encoded name', () => {
  assert.equal(appleMapsWalkUrl(35.0116, 135.7681), 'http://maps.apple.com/?daddr=35.0116,135.7681&dirflg=w');
  assert.equal(appleMapsWalkUrl(35, 135.5, 'Café & WC #2'), 'http://maps.apple.com/?daddr=35,135.5&dirflg=w&q=Caf%C3%A9%20%26%20WC%20%232');
  assert.equal(appleMapsWalkUrl(35, 135.5, '   '), 'http://maps.apple.com/?daddr=35,135.5&dirflg=w');
});

const hotel = (id: string, from: string, to: string, place: Item['place']): Item => ({
  id,
  tripId: 't1',
  kind: 'hotel',
  title: `Hotel ${id}`,
  start: { local: `${from}T15:00`, tz: 'Asia/Tokyo' },
  end: { local: `${to}T10:00`, tz: 'Asia/Tokyo' },
  place,
  attachments: [],
});
const trip = (items: Item[]): Trip => ({ id: 't1', name: 'Japan', startDate: '2026-11-01', endDate: '2026-11-10', homeTz: 'Europe/London', items, createdAt: '2026-10-01T00:00:00Z' });

test('stayFor: the hotel covering today, else the next, else the last; needs coordinates and an active trip', () => {
  const a = hotel('a', '2026-11-01', '2026-11-04', { id: 'p1', name: 'Tokyo Inn', lat: 35.68, lon: 139.76 });
  const b = hotel('b', '2026-11-04', '2026-11-08', { id: 'p2', name: 'Kyoto Ryokan', lat: 35.0, lon: 135.75 });
  const noPos = hotel('c', '2026-11-08', '2026-11-10', { id: 'p3', name: 'Osaka Hotel' });
  const trips = [trip([b, noPos, a])];
  assert.deepEqual(stayFor(trips, '2026-11-02'), { name: 'Tokyo Inn', lat: 35.68, lon: 139.76 });
  assert.equal(stayFor(trips, '2026-11-05')?.name, 'Kyoto Ryokan');
  assert.equal(stayFor(trips, '2026-11-09')?.name, 'Kyoto Ryokan', 'no position on the Osaka stay: fall back to the last');
  assert.equal(stayFor(trips, '2026-12-01'), null, 'no trip today');
  assert.equal(stayFor([trip([noPos])], '2026-11-02'), null);
  assert.equal(stayFor([trip([hotel('d', '2026-11-06', '2026-11-08', { id: 'p', name: '', lat: 1, lon: 2 })])], '2026-11-02')?.name, 'Hotel d', 'next stay, title when no place name');
});
