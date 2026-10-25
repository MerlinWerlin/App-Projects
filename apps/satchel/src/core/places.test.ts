import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import type { Trip } from './model.ts';
import { activeTrip, addPlace, findSaved, placesByName, removePlace, savedPins, savedPlaces, saveTargets, scopeTrips, validatePlace } from './places.ts';
import { tripFromDraft } from './trips.ts';

const NOW = '2026-10-24T00:00:00Z';
const trip = demoTrip('2026-11-03', NOW);
const spot = { name: 'Sample pharmacy', lat: 35.71234567, lon: 139.79654321, category: 'pharmacy', sample: true };

test('validatePlace: needs a name and a real position', () => {
  assert.deepEqual(validatePlace(spot), []);
  assert.deepEqual(validatePlace({ ...spot, name: '   ' }), ['name']);
  assert.deepEqual(validatePlace({ ...spot, lat: 91 }), ['position']);
  assert.deepEqual(validatePlace({ name: '', lat: Number.NaN, lon: 0 }), ['name', 'position']);
});

test('addPlace saves on the trip, trims the name, rounds coordinates and keeps the sample label', () => {
  assert.equal(savedPlaces(trip).length, 0);
  const r = addPlace(trip, { ...spot, name: '  Sample   pharmacy  ' }, NOW, 'place_1');
  assert.ok(r.ok);
  assert.equal(r.updated, false);
  assert.deepEqual(r.place, { id: 'place_1', name: 'Sample pharmacy', lat: 35.712346, lon: 139.796543, savedAt: NOW, category: 'pharmacy', sample: true });
  assert.deepEqual(savedPlaces(r.trip), [r.place]);
  assert.equal(savedPlaces(trip).length, 0, 'input trip untouched');
  assert.equal(r.trip.items, trip.items);
});

test('addPlace at the same spot updates instead of duplicating; a dropped pin has no category', () => {
  const a = addPlace(trip, spot, NOW, 'place_1');
  assert.ok(a.ok);
  const b = addPlace(a.trip, { name: 'Late-night chemist', lat: spot.lat + 0.00002, lon: spot.lon }, '2026-11-01T00:00:00Z', 'place_2');
  assert.ok(b.ok);
  assert.equal(b.updated, true);
  assert.equal(savedPlaces(b.trip).length, 1);
  assert.equal(b.place.id, 'place_1');
  assert.equal(b.place.name, 'Late-night chemist');
  assert.equal(b.place.savedAt, NOW);
  assert.equal(b.place.category, 'pharmacy');
  const c = addPlace(b.trip, { name: 'Dropped pin', lat: 35.0, lon: 135.0 }, NOW, 'place_3');
  assert.ok(c.ok);
  assert.equal(savedPlaces(c.trip).length, 2);
  assert.equal(c.place.category, undefined);
  assert.equal(c.place.sample, undefined);
  assert.equal(findSaved(c.trip, { lat: 35.00001, lon: 135.0 })?.id, 'place_3');
  assert.equal(findSaved(c.trip, { lat: 35.01, lon: 135.0 }), null);
});

test('addPlace rejects bad input without changing the trip', () => {
  const r = addPlace(trip, { name: '', lat: 0, lon: 200 });
  assert.deepEqual(r, { ok: false, errors: ['name', 'position'] });
});

test('removePlace drops only that place; unknown ids are a no-op', () => {
  const a = addPlace(trip, spot, NOW, 'place_1');
  assert.ok(a.ok);
  const b = addPlace(a.trip, { name: 'Pin', lat: 35, lon: 135 }, NOW, 'place_2');
  assert.ok(b.ok);
  assert.deepEqual(savedPlaces(removePlace(b.trip, 'place_1')).map((p) => p.id), ['place_2']);
  assert.equal(savedPlaces(removePlace(b.trip, 'nope')).length, 2);
});

test('savedPlaces skips malformed stored rows', () => {
  const bad = { ...trip, places: [{ id: 'x', name: 'ok', lat: 1, lon: 2, savedAt: NOW }, { id: 'y', name: '', lat: 1, lon: 2 }, { id: 'z', name: 'n' }, null] } as unknown as Trip;
  assert.deepEqual(savedPlaces(bad).map((p) => p.id), ['x']);
});

test('editing a trip keeps its saved places', () => {
  const a = addPlace(trip, spot, NOW, 'place_1');
  assert.ok(a.ok);
  const edited = tripFromDraft({ name: 'Renamed', startDate: a.trip.startDate, endDate: a.trip.endDate, homeTz: a.trip.homeTz }, a.trip, NOW);
  assert.deepEqual(edited.places, a.trip.places);
  assert.equal('places' in tripFromDraft({ name: 'New', startDate: '2026-12-01', endDate: '2026-12-02', homeTz: 'UTC' }, undefined, NOW), false);
});

test('activeTrip and saveTargets choose the trip to save to', () => {
  const t = (id: string, startDate: string, endDate: string): Trip => ({ id, name: id, startDate, endDate, homeTz: 'UTC', items: [], createdAt: NOW });
  const trips = [t('past', '2026-01-01', '2026-01-05'), t('later', '2026-12-01', '2026-12-09'), t('now', '2026-10-20', '2026-10-30'), t('older', '2025-05-01', '2025-05-02')];
  assert.equal(activeTrip(trips, '2026-10-24')?.id, 'now');
  assert.equal(activeTrip(trips, '2026-11-15'), null);
  assert.deepEqual(saveTargets(trips, '2026-10-24').map((x) => x.id), ['now', 'later', 'past', 'older']);
});

test('savedPins: one per saved place, with trip and sample flag', () => {
  const a = addPlace(trip, spot, NOW, 'place_1');
  assert.ok(a.ok);
  const b = addPlace(a.trip, { name: 'Pin', lat: 35, lon: 135 }, NOW, 'place_2');
  assert.ok(b.ok);
  const pins = savedPins([b.trip, { ...trip, id: 'empty' }]);
  assert.deepEqual(
    pins.map((p) => [p.id, p.tripId, p.tripName, p.name, p.category ?? null, p.sample]),
    [
      ['demo:place_1', 'demo', trip.name, 'Sample pharmacy', 'pharmacy', true],
      ['demo:place_2', 'demo', trip.name, 'Pin', null, false],
    ],
  );
});

test('scopeTrips: a Trip map shows one trip; a missing or unknown id shows them all', () => {
  const other = { ...trip, id: 'other', name: 'Other' };
  const all = [trip, other];
  assert.deepEqual(scopeTrips(all, 'other'), { trips: [other], scoped: other });
  assert.deepEqual(scopeTrips(all, 'gone'), { trips: all, scoped: null });
  assert.deepEqual(scopeTrips(all, undefined), { trips: all, scoped: null });
  assert.deepEqual(scopeTrips(all, ''), { trips: all, scoped: null });
});

test('placesByName lists a trip’s saved places alphabetically', () => {
  const a = addPlace(trip, { name: 'Zen garden', lat: 35, lon: 135 }, NOW, 'place_1');
  assert.ok(a.ok);
  const b = addPlace(a.trip, { name: 'Arcade', lat: 36, lon: 136 }, NOW, 'place_2');
  assert.ok(b.ok);
  assert.deepEqual(placesByName(b.trip).map((p) => p.name), ['Arcade', 'Zen garden']);
  assert.deepEqual(placesByName(trip), []);
});
