import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import type { EmergencyCard, Item, SavedPlace, TravelDoc, Trip } from './model.ts';
import { newId } from './model.ts';
import type { PackList } from './packing.ts';
import {
  buildTripFile,
  importTripFile,
  uniqueTripName,
  MAX_TRIP_FILE_CHARS,
  parseTripFile,
  parseTripFileText,
  TRIP_FILE_VERSION,
  tripFileName,
  withFiles,
  type Payloads,
  type TripFile,
} from './tripfile.ts';

const NOW = '2026-10-26T09:00:00.000Z';
const PNG = 'iVBORw0KGgo=';
const PDF = 'JVBERi0xLjQK';
const CROP = 'Q1JPUA==';

const place: SavedPlace = { id: 'p1', name: 'Fushimi Inari', lat: 34.9671, lon: 135.7727, category: 'sight', sample: true, savedAt: '2026-10-20T01:00:00Z' };
const pin: SavedPlace = { id: 'p2', name: 'Dropped pin', lat: 35.0, lon: 135.7, savedAt: '2026-10-21T01:00:00Z' };

function sampleTrip(): Trip {
  const base = demoTrip('2026-11-01', NOW);
  const items: Item[] = base.items.map((i, n) =>
    n === 0
      ? {
          ...i,
          attachments: [
            { id: 'a1', uri: 'file:///docs/attachments/a1-ticket.png', name: 'ticket.png', mime: 'image/png', role: 'ticket', qrCropUri: 'file:///docs/attachments/a1-crop.png' },
            { id: 'a2', uri: 'file:///docs/attachments/a2-conf.pdf', name: 'conf.pdf', mime: 'application/pdf', role: 'booking' },
          ],
        }
      : n === 1
        ? { ...i, notes: 'مرحبا — very long note '.repeat(50), attachments: [{ id: 'a3', uri: 'file:///docs/attachments/a3.png', name: 'qr.png', mime: 'image/png', role: 'ticket', qrCropUri: 'file:///docs/attachments/a3.png' }] }
        : i,
  );
  return { ...base, items, places: [place, pin] };
}
const payloads: Payloads = { a1: { data: PNG, crop: CROP }, a2: { data: PDF }, a3: { data: PNG } };
const packing: PackList = { tripId: 'demo', templates: ['city'], items: [{ id: 'k1', label: 'Passport', done: true, category: 'documents' }, { id: 'k2', label: 'Socks', done: false, qty: 4 }] };

let n = 0;
const ids = (prefix: string) => `${prefix}_t${++n}`;

/** export -> JSON text -> parse -> import -> files "written" */
function roundTrip(trip: Trip, pack: PackList | null = packing) {
  const { file, skipped } = buildTripFile(trip, payloads, { packing: pack, now: NOW });
  const parsed = parseTripFileText(JSON.stringify(file));
  assert.ok(parsed.ok, `parse failed: ${!parsed.ok && parsed.error}`);
  const imp = importTripFile(parsed.file, ids, NOW);
  const written = Object.fromEntries(imp.files.map((f) => [f.attachmentId, { uri: `file:///new/${f.attachmentId}`, cropUri: f.crop_base64 ? `file:///new/${f.attachmentId}-crop` : undefined }]));
  return { file, skipped, imp, trip: withFiles(imp.trip, written) };
}

/** A trip with every id and file path blanked, for comparing apart from ids. */
const strip = (t: Trip) => ({
  ...t,
  id: '',
  createdAt: '',
  items: t.items.map(({ id: _i, tripId: _t, from, to, place: pl, attachments, ...rest }) => ({
    ...rest,
    ...(from ? { from: { ...from, id: '' } } : {}),
    ...(to ? { to: { ...to, id: '' } } : {}),
    ...(pl ? { place: { ...pl, id: '' } } : {}),
    attachments: attachments.map(({ id: _a, uri: _u, qrCropUri, ...a }) => ({ ...a, crop: qrCropUri !== undefined })),
  })),
  places: (t.places ?? []).map(({ id: _p, ...p }) => p),
});

test('round trip: export, stringify, parse, import gives the same trip apart from ids', () => {
  const original = sampleTrip();
  const { trip, skipped, imp } = roundTrip(original);
  assert.equal(skipped, 0);
  assert.deepEqual(strip(trip), strip(original));
  assert.equal(trip.demo, true, 'demo flag survives');
  assert.equal(trip.places?.[0].sample, true, 'sample place stays labelled');
  assert.equal(trip.createdAt, NOW);
  // attachment bytes come back unchanged, crops included
  const byName = Object.fromEntries(imp.files.map((f) => [f.name, f]));
  assert.equal(byName['ticket.png'].data_base64, PNG);
  assert.equal(byName['ticket.png'].crop_base64, CROP);
  assert.equal(byName['conf.pdf'].data_base64, PDF);
  assert.equal(byName['qr.png'].crop_base64, undefined);
  const a3 = trip.items[1].attachments[0];
  assert.equal(a3.qrCropUri, a3.uri, 'a crop that was the main file still points at it');
  // packing list comes with its trip
  assert.ok(imp.packing);
  assert.equal(imp.packing.tripId, trip.id);
  assert.deepEqual(imp.packing.items.map(({ id: _id, ...i }) => i), packing.items.map(({ id: _id, ...i }) => i));
  assert.deepEqual(imp.packing.templates, ['city']);
});

test('saved places are in the file and come back', () => {
  const { file, trip } = roundTrip(sampleTrip());
  assert.equal(file.places.length, 2);
  assert.deepEqual(trip.places?.map((p) => p.name), ['Fushimi Inari', 'Dropped pin']);
  const noPlaces = { ...sampleTrip(), places: undefined };
  assert.deepEqual(roundTrip(noPlaces).trip.places, []);
});

test('import gives everything new ids and remaps references', () => {
  const original = sampleTrip();
  const { trip, imp } = roundTrip(original);
  const oldIds = new Set([original.id, ...original.items.map((i) => i.id), ...original.items.flatMap((i) => i.attachments.map((a) => a.id)), ...(original.places ?? []).map((p) => p.id), 'k1', 'k2']);
  const newIds = [trip.id, ...trip.items.map((i) => i.id), ...trip.items.flatMap((i) => i.attachments.map((a) => a.id)), ...(trip.places ?? []).map((p) => p.id), ...(imp.packing?.items ?? []).map((i) => i.id)];
  for (const id of newIds) assert.ok(!oldIds.has(id), `id ${id} reused`);
  assert.equal(new Set(newIds).size, newIds.length, 'new ids are distinct');
  for (const i of trip.items) assert.equal(i.tripId, trip.id);
  const fileAttIds = new Set(imp.files.map((f) => f.attachmentId));
  for (const a of trip.items.flatMap((i) => i.attachments)) assert.ok(fileAttIds.has(a.id), 'each attachment has its file');
  // a place shared by two items keeps pointing at one id after remapping
  const hotel = original.items.find((i) => i.place);
  assert.ok(hotel?.place);
  assert.notEqual(trip.items.find((i) => i.title === hotel.title)?.place?.id, hotel.place.id);
});

test('importing the same file twice gives two separate trips', () => {
  const { file } = buildTripFile(sampleTrip(), payloads, { now: NOW });
  const parsed = parseTripFile(JSON.parse(JSON.stringify(file)));
  assert.ok(parsed.ok);
  const a = importTripFile(parsed.file, newId, NOW).trip;
  const b = importTripFile(parsed.file, newId, NOW).trip;
  assert.notEqual(a.id, b.id);
  const ai = new Set(a.items.map((i) => i.id));
  assert.ok(b.items.every((i) => !ai.has(i.id)));
  assert.notEqual(a.items[0].attachments[0].id, b.items[0].attachments[0].id);
});

test('never includes vault documents, the emergency card or medical notes', () => {
  // Even with private data in scope, the builder only sees the trip and its packing list.
  const vault: TravelDoc[] = [{ id: 'v1', kind: 'passport', label: 'PASSPORT-SECRET-123', attachments: [{ id: 'va', uri: 'file:///docs/vault/va.jpg', name: 'passport.jpg', mime: 'image/jpeg', role: 'other' }] }];
  const card: EmergencyCard = { insurer: 'INSURER-SECRET', policy: 'POLICY-SECRET', contacts: [{ id: 'c1', name: 'CONTACT-SECRET', phone: '000' }], medicalNotes: 'MEDICAL-SECRET' };
  const trip = sampleTrip();
  const { file } = buildTripFile(trip, { ...payloads, va: { data: 'VkFVTFQ=' } }, { packing, now: NOW });
  const text = JSON.stringify(file);
  for (const secret of [vault[0].label, 'passport.jpg', 'VkFVTFQ=', card.insurer!, card.policy!, card.contacts[0].name, card.medicalNotes!, 'medicalNotes', '/vault/'])
    assert.ok(!text.includes(secret), `file contains ${secret}`);
  assert.ok(!text.includes('file:///'), 'no device paths in the file');
});

test('a packing list for another trip is left out', () => {
  const { file } = buildTripFile(sampleTrip(), payloads, { packing: { ...packing, tripId: 'other' }, now: NOW });
  assert.equal(file.packing, undefined);
});

test('an attachment whose file could not be read is left out and counted', () => {
  const { file, skipped } = buildTripFile(sampleTrip(), { a1: { data: PNG } }, { now: NOW });
  assert.equal(skipped, 2);
  assert.equal(file.attachments.length, 1);
  assert.equal(file.items[0].attachments.length, 1);
  assert.ok(parseTripFile(JSON.parse(JSON.stringify(file))).ok);
});

const good = (): TripFile => JSON.parse(JSON.stringify(buildTripFile(sampleTrip(), payloads, { packing, now: NOW }).file));
const err = (x: unknown) => {
  const r = parseTripFile(x);
  return r.ok ? 'ok' : r.error;
};

test('rejects files that are not Satchel trips, or come from a newer version', () => {
  assert.equal(err(null), 'format');
  assert.equal(err([]), 'format');
  assert.equal(err('hello'), 'format');
  assert.equal(err({ ...good(), format: 'other-app' }), 'format');
  assert.equal(err({ ...good(), version: TRIP_FILE_VERSION + 1 }), 'version');
  assert.equal(err({ ...good(), version: 0 }), 'damaged');
  assert.equal(err({ ...good(), version: '1' }), 'damaged');
  assert.equal(parseTripFileText('not json {').ok, false);
  const r = parseTripFileText('{"format":"satchel-trip"');
  assert.equal(r.ok ? 'ok' : r.error, 'format');
  const big = parseTripFileText(' '.repeat(MAX_TRIP_FILE_CHARS + 1));
  assert.equal(big.ok ? 'ok' : big.error, 'too-large');
});

test('rejects damaged files whole (no partial import)', () => {
  const g = good();
  assert.equal(err(g), 'ok');
  assert.equal(err({ ...g, trip: undefined }), 'damaged');
  assert.equal(err({ ...g, trip: { ...g.trip, startDate: '2026-02-31' } }), 'damaged');
  assert.equal(err({ ...g, trip: { ...g.trip, name: 7 } }), 'damaged');
  assert.equal(err({ ...g, items: 'x' }), 'damaged');
  assert.equal(err({ ...g, items: [...g.items, { id: 'x', kind: 'rocket', title: 'x', start: g.items[0].start, attachments: [] }] }), 'damaged');
  assert.equal(err({ ...g, items: [{ ...g.items[0], start: { local: '2026-13-01T10:00', tz: 'UTC' } }] }), 'damaged');
  assert.equal(err({ ...g, places: [{ ...g.places[0], lat: 'north' }] }), 'damaged');
  assert.equal(err({ ...g, attachments: g.attachments.slice(1) }), 'damaged', 'attachment bytes missing');
  assert.equal(err({ ...g, attachments: [{ ...g.attachments[0], data_base64: 'not base64!!' }, ...g.attachments.slice(1)] }), 'damaged');
  assert.equal(err({ ...g, attachments: [...g.attachments, g.attachments[0]] }), 'damaged', 'duplicate payload');
  assert.equal(err({ ...g, packing: { items: [{ id: 1 }] } }), 'damaged');
});

test('keeps unreadable zones and long or right-to-left text as they are', () => {
  const g = good();
  g.trip.homeTz = 'Mars/Olympus';
  g.items[0].start.tz = 'Not/AZone';
  const r = parseTripFile(g);
  assert.ok(r.ok);
  const t = importTripFile(r.file, ids, NOW).trip;
  assert.equal(t.homeTz, 'Mars/Olympus');
  assert.equal(t.items[0].start.tz, 'Not/AZone');
  assert.ok(t.items[1].notes?.startsWith('مرحبا'));
  const noZone = parseTripFile({ ...g, trip: { ...g.trip, homeTz: undefined } });
  assert.ok(noZone.ok && noZone.file.trip.homeTz === 'UTC');
});

test('a trip field in the file cannot smuggle in items or a non-boolean demo flag', () => {
  const g = good() as unknown as { trip: Record<string, unknown> };
  g.trip.items = [{ junk: true }];
  g.trip.demo = 'yes';
  const r = parseTripFile(g);
  assert.ok(r.ok);
  const t = importTripFile(r.file, ids, NOW).trip;
  assert.equal(t.demo, undefined);
  assert.equal(t.items.length, sampleTrip().items.length);
});

test('file names are safe for Files and AirDrop', () => {
  assert.equal(tripFileName('Tokyo & Kyoto (demo)'), 'Tokyo & Kyoto (demo).satchel');
  assert.equal(tripFileName('a/b:c?'), 'a b c.satchel');
  assert.equal(tripFileName('   '), 'Trip.satchel');
  assert.equal(tripFileName('..hidden'), 'hidden.satchel');
  assert.ok(tripFileName('x'.repeat(200)).length <= 60 + '.satchel'.length);
});

// ---- T45: '(copy)' names ----

const copyName = (name: string, n: number) => (n === 1 ? `${name} (copy)` : `${name} (copy ${n})`);

test('uniqueTripName keeps a name no trip has', () => {
  assert.equal(uniqueTripName('Lisbon', ['Tokyo', 'Kyoto'], copyName), 'Lisbon');
  assert.equal(uniqueTripName('Lisbon', [], copyName), 'Lisbon');
});

test('uniqueTripName adds (copy), then (copy 2), ignoring case and spaces', () => {
  assert.equal(uniqueTripName('Tokyo', ['tokyo '], copyName), 'Tokyo (copy)');
  assert.equal(uniqueTripName('Tokyo', ['Tokyo', 'Tokyo (copy)'], copyName), 'Tokyo (copy 2)');
  assert.equal(uniqueTripName('Tokyo', ['Tokyo', 'TOKYO (COPY)', 'Tokyo (copy 2)'], copyName), 'Tokyo (copy 3)');
});
