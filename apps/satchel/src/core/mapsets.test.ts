import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availablePoiSets, poiSetKey, selectPoiSet } from './mapsets.ts';
import type { PoiSet } from './poi.ts';

const kyoto: PoiSet = { city: 'Kyoto', source: 'pack:kyoto', sample: false, center: { lat: 35, lon: 135.76 }, pois: [] };
const sydney: PoiSet = { ...kyoto, city: 'Sydney', source: 'pack:sydney' };
const sample: PoiSet = { ...kyoto, source: 'demo', sample: true };

test('no download never silently substitutes demo places', () => {
  assert.deepEqual(availablePoiSets([], [sample], false), []);
  assert.equal(selectPoiSet(availablePoiSets([], [sample], false), null), null);
});
test('samples require opt-in and disappear even if they were selected', () => {
  assert.deepEqual(availablePoiSets([kyoto], [sample], true), [kyoto, sample]);
  const realOnly = availablePoiSets([kyoto], [sample], false);
  assert.equal(selectPoiSet(realOnly, poiSetKey(sample), 'kyoto'), kyoto);
  assert.equal(selectPoiSet(realOnly, poiSetKey(sample)), null);
});
test('automatic places follow the visible downloaded city, not the first pack on the phone', () => {
  assert.equal(selectPoiSet([kyoto, sydney], null, 'sydney'), sydney);
  assert.equal(selectPoiSet([kyoto], null, 'sydney'), null);
  assert.equal(selectPoiSet([kyoto], null), null);
});
test('explicit city choice and explicit sample mode remain usable', () => {
  assert.equal(selectPoiSet([kyoto, sydney], poiSetKey(kyoto), 'sydney'), kyoto);
  assert.equal(selectPoiSet([sample], null), sample);
});
