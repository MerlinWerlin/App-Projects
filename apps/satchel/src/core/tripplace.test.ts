import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Item, Trip } from './model.ts';
import { destinationLine, headlinePlace, titleNamesPlace, tripPlace, type TripPlace } from './tripplace.ts';

const NAMES: Record<string, string> = { JP: 'Japan', KR: 'South Korea', TW: 'Taiwan', TH: 'Thailand', VN: 'Vietnam', AU: 'Australia' };
const nameOf = (iso2: string) => NAMES[iso2] ?? iso2;

function stay(id: string, tz: string, day: string): Item {
  return { id, kind: 'hotel', title: `Hotel ${id}`, start: { local: `${day}T15:00`, tz }, end: { local: `${day}T23:00`, tz } } as Item;
}
function trip(name: string, items: Item[]): Trip {
  return { id: 't', name, startDate: '2026-11-20', endDate: '2026-11-28', homeTz: 'Australia/Sydney', items, createdAt: '2026-11-01T00:00:00Z' };
}
const more = (n: number) => `+${n}`;

test('tripPlace: countries from the bookings in visit order, home left out, never from the title', () => {
  const p = tripPlace(trip('Girls trip', [{ ...stay('a', 'Asia/Tokyo', '2026-11-20'), title: 'Tokyo Station Hotel' }, stay('a2', 'Asia/Tokyo', '2026-11-21'), stay('b', 'Asia/Seoul', '2026-11-24'), stay('c', 'Australia/Sydney', '2026-11-28')]), 'AU', nameOf);
  assert.deepEqual(p.countries, ['Japan', 'South Korea']);
  assert.equal(p.city, 'Tokyo');
  assert.equal(destinationLine(p, more), 'Japan · South Korea');
  assert.equal(titleNamesPlace('Girls trip', p), false);
  assert.equal(headlinePlace(p), 'Tokyo');
});

test('tripPlace: no bookings abroad gives no destination', () => {
  const p = tripPlace(trip('Girls trip', []), 'AU', nameOf);
  assert.deepEqual(p, { countries: [], city: null });
  assert.equal(destinationLine(p, more), '');
  assert.equal(headlinePlace(p), null);
});

test('destinationLine: more than three countries ends with a count', () => {
  const p: TripPlace = { countries: ['Japan', 'South Korea', 'Taiwan', 'Thailand', 'Vietnam'], city: 'Tokyo' };
  assert.equal(destinationLine(p, more), 'Japan · South Korea · Taiwan +2');
});

test('titleNamesPlace: a title that names the place is not repeated, any case or accent', () => {
  const p: TripPlace = { countries: ['Japan'], city: 'Tokyo' };
  assert.equal(titleNamesPlace('Japan in spring', p), true);
  assert.equal(titleNamesPlace('tokyo & kyoto', p), true);
  assert.equal(titleNamesPlace('Girls trip', p), false);
  assert.equal(titleNamesPlace('Café crawl', { countries: ['Cafe'], city: null }), true);
});

test('tripPlace: the zone city is used only when the bookings mention it (Bali is in the Asia/Makassar zone)', () => {
  const bali = trip('Bali with Mum', [stay('u', 'Asia/Makassar', '2026-11-20'), stay('u2', 'Asia/Makassar', '2026-11-21')]);
  const p = tripPlace(bali, 'AU', (iso) => (iso === 'ID' ? 'Indonesia' : iso));
  assert.equal(p.city, null);
  assert.equal(headlinePlace(p), 'Indonesia');
  const named = trip('Bali with Mum', [{ ...stay('m', 'Asia/Makassar', '2026-11-20'), title: 'Makassar harbour hotel' }]);
  assert.equal(tripPlace(named, 'AU', nameOf).city, 'Makassar');
});
