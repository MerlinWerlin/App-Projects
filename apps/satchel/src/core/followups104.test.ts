// T138 run-104 follow-ups: trip gaps catch a city change inside one country by name / zone when positions are
// missing (Tokyo stay then Kyoto stay), the outfit planner's today index, the arrival focus delay, the catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Item, ItemKind, Place, Trip } from './model.ts';
import { findGaps, stayCity, staysApartByName } from './gaps.ts';
import { outfitDates } from './outfits.ts';
import { arrivalFocusDelay, ARRIVAL_SCROLL_MS, outfitTodayIndex } from './followups104.ts';
import { followups104 } from '../i18n/en/followups104.ts';
import { followups102 } from '../i18n/en/followups102.ts';
import { tripcopy } from '../i18n/en/tripcopy.ts';

let n = 0;
const P = (name: string, extra: Partial<Place> = {}): Place => ({ id: `pl_${name}`, name, ...extra });
function it(kind: ItemKind, start: string, tz: string, end?: string, endTz?: string, extra: Partial<Item> = {}): Item {
  n++;
  return { id: extra.id ?? `i${n}`, tripId: 't', kind, title: extra.title ?? `${kind} ${n}`, start: { local: start, tz }, ...(end ? { end: { local: end, tz: endTz ?? tz } } : {}), attachments: [], ...extra };
}
const trip = (items: Item[], over: Partial<Trip> = {}): Trip => ({ id: 't', name: 'Test', startDate: '2026-03-01', endDate: '2026-03-08', homeTz: 'Australia/Sydney', items, createdAt: '2026-01-01T00:00:00Z', ...over });
const SYD = 'Australia/Sydney';
const TYO = 'Asia/Tokyo';
const moves = (items: Item[], over: Partial<Trip> = {}) => findGaps(trip(items, over)).gaps.filter((g) => g.kind === 'move');

/** Sydney -> Tokyo, two stays (no positions) given by the caller, flight home from Osaka. */
function japan(first: Partial<Item>, second: Partial<Item>, between: Item[] = []): Item[] {
  return [
    it('flight', '2026-03-01T09:30', SYD, '2026-03-01T17:45', TYO, { id: 'out', from: P('Sydney'), to: P('Tokyo Haneda') }),
    it('hotel', '2026-03-01T19:30', TYO, '2026-03-04T11:00', TYO, { id: 'h1', ...first }),
    ...between,
    it('hotel', '2026-03-04T15:00', TYO, '2026-03-07T10:00', TYO, { id: 'h2', ...second }),
    it('flight', '2026-03-07T21:30', TYO, '2026-03-08T08:50', SYD, { id: 'home', from: P('Osaka Kansai'), to: P('Sydney') }),
  ];
}

test('a Tokyo stay then a Kyoto stay with no journey and no positions is a missing journey (by name)', () => {
  const g = moves(japan({ place: P('Park Hotel Tokyo') }, { place: P('Gion Inn', { address: '570 Gionmachi, Higashiyama, Kyoto' }) }));
  assert.equal(g.length, 1);
  assert.equal(g[0].id, 'move:h1>h2');
  assert.deepEqual([g[0].from, g[0].to, g[0].fromPlace, g[0].toPlace], ['2026-03-01', '2026-03-04', 'Park Hotel Tokyo', 'Gion Inn']);
  assert.deepEqual(g[0].add, { kind: 'train', date: '2026-03-01', tz: TYO });
  // The city can come from the booking title when the place has none.
  assert.equal(moves(japan({ title: 'Tokyo hotel' }, { title: 'Ryokan in Kyoto' })).length, 1);
});

test('two hotels in one city (different names) or names with no known city are not a move', () => {
  assert.deepEqual(moves(japan({ place: P('Shinjuku Granbell', { address: 'Kabukicho, Shinjuku, Tokyo' }) }, { place: P('Asakusa Inn, Tokyo') })), []);
  assert.deepEqual(moves(japan({ place: P('Asakusa Inn') }, { place: P('Gion Inn') })), []);
  // One named, one not, same zone: not known to be apart.
  assert.deepEqual(moves(japan({ place: P('Park Hotel Tokyo') }, { place: P('Gion Inn') })), []);
});

test('a train between them, a hire car across the change, or saved positions close together: no move', () => {
  const tr = it('train', '2026-03-04T12:00', TYO, '2026-03-04T14:15', TYO, { id: 'tr', from: P('Tokyo'), to: P('Kyoto') });
  assert.deepEqual(moves(japan({ place: P('Park Hotel Tokyo') }, { place: P('Kyoto Inn') }, [tr])), []);
  const car = it('car', '2026-03-04T10:00', TYO, '2026-03-04T18:00', TYO, { id: 'car' });
  assert.deepEqual(moves(japan({ place: P('Park Hotel Tokyo') }, { place: P('Kyoto Inn') }, [car])), []);
  // Positions on both decide, as before (two "named" cities 25 km apart are nearby).
  assert.deepEqual(moves(japan({ place: P('Tokyo Bay Hotel', { lat: 35.62, lon: 139.78 }) }, { place: P('Yokohama Pier Hotel', { lat: 35.45, lon: 139.64 }) })), []);
});

test('positions missing on one stay only: the names still decide', () => {
  const g = moves(japan({ place: P('Park Hotel Tokyo', { lat: 35.66, lon: 139.76 }) }, { place: P('Kyoto Inn') }));
  assert.equal(g.length, 1);
});

test('by zone: two stays in one country on different zones (Sydney then Perth) with no names', () => {
  const items = [
    it('hotel', '2026-03-01T15:00', SYD, '2026-03-03T10:00', SYD, { id: 's1', place: P('Harbour Rooms') }),
    it('hotel', '2026-03-03T15:00', 'Australia/Perth', '2026-03-05T10:00', 'Australia/Perth', { id: 's2', place: P('River Rooms') }),
  ];
  const g = moves(items, { startDate: '2026-03-01', endDate: '2026-03-05' });
  assert.equal(g.length, 1);
  assert.equal(g[0].add?.kind, 'train');
  // Different countries stay with the old rule (flight), not counted twice.
  assert.equal(staysApartByName(items[0], { ...items[1], start: { local: '2026-03-03T15:00', tz: 'Pacific/Auckland' } }), false);
});

test('a city in another country than the stay is a hotel name, not a city; journey ends never count by name', () => {
  // "Paris" is a city in France; on a London stay ("Hotel Paris Rooms") it is just a name.
  const LON = 'Europe/London';
  const v = it('hotel', '2026-03-01T15:00', LON, '2026-03-03T10:00', LON, { place: P('Hotel Paris Rooms') });
  assert.equal(stayCity(v), null);
  assert.equal(stayCity(it('hotel', '2026-03-01T15:00', LON, undefined, undefined, { place: P('Strand Rooms', { address: '1 Strand, London' }) })), 'london');
  assert.equal(staysApartByName(v, it('hotel', '2026-03-03T15:00', LON, undefined, undefined, { place: P('Strand Rooms, London') })), false);
  // Landing at Tokyo Haneda then a stay that names Yokohama: no move (an airport often carries a nearby city's name).
  const items = [
    it('flight', '2026-03-01T09:30', SYD, '2026-03-01T17:45', TYO, { id: 'o', from: P('Sydney'), to: P('Tokyo Haneda') }),
    it('hotel', '2026-03-01T19:30', TYO, '2026-03-05T11:00', TYO, { id: 'y', place: P('Harbour Hotel Yokohama') }),
    it('flight', '2026-03-05T21:30', TYO, '2026-03-06T08:50', SYD, { id: 'b', from: P('Tokyo Haneda'), to: P('Sydney') }),
  ];
  assert.deepEqual(moves(items, { endDate: '2026-03-06' }), []);
});

test('outfit planner: today index only while the trip is on', () => {
  const dates = outfitDates({ startDate: '2026-03-01', endDate: '2026-03-05', items: [] });
  assert.equal(outfitTodayIndex(dates, '2026-03-03'), 2);
  assert.equal(outfitTodayIndex(dates, '2026-03-01'), 0);
  assert.equal(outfitTodayIndex(dates, '2026-02-28'), null);
  assert.equal(outfitTodayIndex(dates, '2026-03-06'), null);
  assert.equal(outfitTodayIndex([], '2026-03-01'), null);
});

test('arrival card focus waits for the scroll, at once with Reduce Motion', () => {
  assert.equal(arrivalFocusDelay(false), ARRIVAL_SCROLL_MS);
  assert.ok(arrivalFocusDelay(true) < ARRIVAL_SCROLL_MS);
});

test('catalogue: f104 keys, the never-copied line names planned outfits; old lines kept, screen uses the new one', () => {
  for (const k of Object.keys(followups104)) assert.ok(k.startsWith('f104.'), k);
  assert.match(followups104['f104.copy.neverBody'], /planned outfits/);
  // Everything the old line named is still named.
  for (const w of ['Booking references', 'receipts', 'journal', 'spending', 'gifts', 'checklist ticks', 'sitter tasks', 'trip rating']) assert.ok(followups104['f104.copy.neverBody'].includes(w), w);
  assert.ok(followups102['f102.copy.neverBody'] && tripcopy['tripcopy.never.body']);
  const screen = readFileSync(new URL('../../app/trip-again/[tripId].tsx', import.meta.url), 'utf8');
  assert.ok(screen.includes("t('f104.copy.neverBody')") && !screen.includes("t('f102.copy.neverBody')"));
});
