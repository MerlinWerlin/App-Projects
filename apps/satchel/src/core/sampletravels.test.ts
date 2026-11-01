import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildBackup, countBackup, parseBackup, serializeBackup, TRIPS_KEY } from './backup.ts';
import { demoTrip } from './demo.ts';
import type { Trip } from './model.ts';
import { stampCollection } from './stamps.ts';
import { travelStats } from './travelstats.ts';
import { canExportTrip, hasSampleTravels, isSampleTravel, SAMPLE_TRAVEL_PREFIX, sampleTravels, stripSampleTravelsText, withoutSampleTravels, withSampleTravels } from './sampletravels.ts';

const TODAY = '2026-11-01';
const NOW = '2026-11-01T09:00:00.000Z';
const own: Trip = { id: 'own1', name: 'My trip', startDate: '2026-12-01', endDate: '2026-12-05', homeTz: 'Australia/Sydney', items: [], createdAt: NOW };

test('two invented past trips, marked sample and demo, ending before today', () => {
  const list = sampleTravels(TODAY, NOW);
  assert.equal(list.length, 2);
  for (const t of list) {
    assert.ok(t.id.startsWith(SAMPLE_TRAVEL_PREFIX));
    assert.ok(isSampleTravel(t));
    assert.equal(t.demo, true);
    assert.ok(t.endDate < TODAY, `${t.name} ends ${t.endDate}`);
    assert.match(t.name, /\(sample\)$/);
    for (const i of t.items) {
      assert.equal(i.tripId, t.id);
      assert.ok(i.id.startsWith(`${t.id}-`));
      if (i.carrier) assert.equal(i.carrier, 'Demo Air');
      if (i.kind === 'hotel') assert.match(i.title, /\(sample\)$/);
    }
  }
  assert.equal(new Set(list.flatMap((t) => t.items.map((i) => i.id))).size, list.reduce((n, t) => n + t.items.length, 0));
});

test('Your travels and the passport stamps fill in once demo trips are included', () => {
  const trips = [...sampleTravels(TODAY, NOW)];
  const off = travelStats(trips, TODAY);
  assert.equal(off.tripsTaken, 0);
  assert.equal(off.demoLeftOut, 2);
  const on = travelStats(trips, TODAY, { includeDemo: true });
  assert.equal(on.tripsTaken, 2);
  assert.deepEqual(on.countries, ['CA', 'PT']);
  assert.ok(on.cities.includes('Lisbon') && on.cities.includes('Porto') && on.cities.includes('Vancouver'), on.cities.join());
  assert.ok(on.flights.legs >= 4 && on.flights.km > 0);
  const stamps = stampCollection(trips, TODAY, { includeDemo: true });
  const places = stamps.stamps.map((s) => (s.kind === 'country' ? s.iso2 : (s.city ?? '')));
  for (const p of ['PT', 'CA', 'Lisbon', 'Porto', 'Vancouver']) assert.ok(places.includes(p), `${p} in ${places.join()}`);
  assert.ok(stamps.stamps.every((s) => s.demo));
  assert.equal(stampCollection(trips, TODAY).stamps.length, 0);
});

test('add replaces older copies; remove takes only the samples in one go', () => {
  const demo = demoTrip('2026-11-04', NOW);
  const once = withSampleTravels([own, demo], TODAY, NOW);
  assert.equal(once.length, 4);
  const twice = withSampleTravels(once, TODAY, NOW);
  assert.equal(twice.length, 4);
  assert.ok(hasSampleTravels(twice));
  const removed = withoutSampleTravels(twice);
  assert.deepEqual(removed.map((t) => t.id), ['own1', 'demo']);
  assert.ok(!hasSampleTravels(removed));
  const plain = [own, demo];
  assert.equal(withoutSampleTravels(plain), plain);
  // the bundled demo trip is a demo but not a sample past trip
  assert.equal(isSampleTravel(demo), false);
  assert.equal(isSampleTravel({ id: 'sample' }), false);
  assert.equal(isSampleTravel(null), false);
});

test('sample trips are never exported as a .satchel file', () => {
  for (const t of sampleTravels(TODAY, NOW)) assert.equal(canExportTrip(t), false);
  assert.equal(canExportTrip(own), true);
  assert.equal(canExportTrip(demoTrip('2026-11-04', NOW)), true);
});

test('backups leave the sample trips out and count only the rest', () => {
  const stored = JSON.stringify(withSampleTravels([own], TODAY, NOW));
  const meta = { app: '0.1.0', created: NOW, docDir: null, includeDocuments: false };
  const b = buildBackup(meta, [[TRIPS_KEY, stored], ['satchel.travels.includeDemo.v1', 'true']], []);
  const kept = JSON.parse(b.keys[TRIPS_KEY]) as Trip[];
  assert.deepEqual(kept.map((t) => t.id), ['own1']);
  assert.equal(b.counts.trips, 1);
  const text = serializeBackup(b);
  assert.ok(!text.includes(SAMPLE_TRAVEL_PREFIX));
  assert.ok(!text.includes('(sample)'));
  const back = parseBackup(text);
  assert.ok(back.ok);
  if (back.ok) assert.equal(countBackup(back.backup.keys, back.backup.files).trips, 1);
});

test('stored text without sample trips, or not a list, is kept byte for byte', () => {
  const plain = JSON.stringify([own]);
  assert.equal(stripSampleTravelsText(plain), plain);
  assert.equal(stripSampleTravelsText('not json'), 'not json');
  assert.equal(stripSampleTravelsText('{"id":"sample-past-1"}'), '{"id":"sample-past-1"}');
  assert.equal(stripSampleTravelsText(JSON.stringify(sampleTravels(TODAY, NOW))), '[]');
});

test('UI wiring: Settings mounts the row, the trip screen hides export, the pass shows a Sample chip', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.match(read('app/settings.tsx'), /<SampleTravelsSection \/>/);
  assert.match(read('app/trip/[id].tsx'), /canExportTrip\(trip\) \? <TripExport trip=\{trip\} \/>/);
  assert.match(read('src/ui/TripPass.tsx'), /isSampleTravel\(trip\) \? t\('demo2\.chip'\)/);
});
