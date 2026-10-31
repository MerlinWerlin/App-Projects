// T72 (run-87 follow-ups): booking positions in the form, transport stops on the trip route, Today vs Your day,
// the licences list, the numbered-pin tracking and the Intl.DisplayNames fallback.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { agendaBesideBrief, dayBrief } from './daybrief.ts';
import { demoTrip } from './demo.ts';
import { todayAgenda } from './glance.ts';
import { coveredPackages, LICENCE_SECTIONS, licenceKeys } from './licences.ts';
import type { Item, Trip } from './model.ts';
import { decodePos, encodePos, formatPos, pickerRegion, positionChoices, roundPos, withPos } from './position.ts';
import { localCountryName } from './travelstats.ts';
import { hasTransportStops, tripRoute } from './triproute.ts';
import { draftChanged, draftFromItem, itemFromDraft, newItemDraft } from './trips.ts';
import { toUtc } from './tz.ts';
import { weatherPlace } from './weather.ts';

const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
const byId = (id: string) => trip.items.find((i) => i.id === id) as Item;
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// ---- position text ----

test('position text: exact round trip, blank and junk read as none, out of range refused', () => {
  assert.equal(encodePos({ lat: 35.6812, lon: 139.7671 }), '35.6812,139.7671');
  assert.deepEqual(decodePos('35.6812,139.7671'), { lat: 35.6812, lon: 139.7671 });
  assert.deepEqual(decodePos(' -33.9366 , 151.1658 '), { lat: -33.9366, lon: 151.1658 });
  for (const bad of ['', '  ', 'abc', '35.6', '91,0', '0,181', '1,2,3', 'NaN,1']) assert.equal(decodePos(bad), null, bad);
  assert.equal(decodePos(undefined), null);
  assert.equal(encodePos(undefined), '');
  assert.equal(encodePos({ lat: 'x', lon: 1 }), '');
  assert.equal(encodePos({ lat: 95, lon: 1 }), '');
  assert.deepEqual(roundPos({ lat: 35.123456789, lon: -0.0000004 }), { lat: 35.123457, lon: -0 });
  assert.equal(formatPos({ lat: 35.6812, lon: 139.7671 }), '35.68120, 139.76710');
});

test('withPos sets a position, and removing it drops stale lat / lon kept from before', () => {
  const p = { id: 'p', name: 'Inn', address: 'A 1', lat: 1, lon: 2 };
  assert.deepEqual(withPos(p, '3,4'), { id: 'p', name: 'Inn', address: 'A 1', lat: 3, lon: 4 });
  assert.deepEqual(withPos(p, ''), { id: 'p', name: 'Inn', address: 'A 1' });
});

// ---- the booking form keeps and edits positions ----

test('editing a journey keeps its from / to positions (itemFromDraft no longer drops them)', () => {
  for (const id of ['demo-f1', 'demo-t1', 'demo-f2']) {
    const it = byId(id);
    const back = itemFromDraft({ ...draftFromItem(it), notes: 'edited' }, trip.id, it);
    assert.deepEqual(back.from, it.from, `${id} from`);
    assert.deepEqual(back.to, it.to, `${id} to`);
  }
  // and the stops and weather still work after the edit
  const t1 = byId('demo-t1');
  const edited = { ...trip, items: trip.items.map((i) => (i.id === 'demo-t1' ? itemFromDraft({ ...draftFromItem(t1), seat: '1A' }, trip.id, t1) : i)) };
  assert.deepEqual(
    tripRoute(edited, { transport: true }).days.flatMap((d) => d.stops.map((s) => s.key)),
    tripRoute(trip, { transport: true }).days.flatMap((d) => d.stops.map((s) => s.key)),
  );
});

test('a position set in the form lands on the booking; removing it takes the place off the map', () => {
  const d = { ...newItemDraft('activity', '2026-11-05', 'Asia/Tokyo'), title: 'Tea ceremony', placeName: 'Tea house', placePos: '35.0116,135.7681' };
  const it = itemFromDraft(d, trip.id);
  assert.equal(it.place?.lat, 35.0116);
  assert.equal(it.place?.lon, 135.7681);
  assert.equal(draftFromItem(it).placePos, '35.0116,135.7681');
  const cleared = itemFromDraft({ ...draftFromItem(it), placePos: '' }, trip.id, it);
  assert.equal(cleared.place?.name, 'Tea house');
  assert.equal('lat' in (cleared.place ?? {}), false);
  assert.equal('lon' in (cleared.place ?? {}), false);
  // a position alone (no name yet) is enough to keep a place, named after the booking
  const onlyPos = itemFromDraft({ ...newItemDraft('hotel', '2026-11-05', 'Asia/Tokyo'), title: 'Inn', endDate: '2026-11-06', endTime: '10:00', placePos: '35,135' }, trip.id);
  assert.deepEqual([onlyPos.place?.name, onlyPos.place?.lat, onlyPos.place?.lon], ['Inn', 35, 135]);
});

test('journey positions: set without a name (named after the booking), changed, removed; not kept on a non-journey', () => {
  const base = { ...newItemDraft('train', '2026-11-05', 'Asia/Tokyo'), title: 'Local train', endDate: '2026-11-05', endTime: '11:00' };
  const a = itemFromDraft({ ...base, fromName: 'Kyoto Station', fromPos: '34.9858,135.7588', toPos: '34.6937,135.5023' }, trip.id);
  assert.deepEqual(a.from, { id: a.from?.id, name: 'Kyoto Station', lat: 34.9858, lon: 135.7588 });
  assert.equal(a.to?.name, 'Local train');
  assert.equal(a.to?.lat, 34.6937);
  const b = itemFromDraft({ ...draftFromItem(a), toName: 'Osaka Station', toPos: '' }, trip.id, a);
  assert.equal(b.to?.id, a.to?.id, 'same place id kept');
  assert.equal(b.to?.name, 'Osaka Station');
  assert.equal(b.to?.lat, undefined);
  assert.equal(itemFromDraft({ ...draftFromItem(a), kind: 'activity' }, trip.id, a).from, undefined);
  // a weather place now comes from a user-set arrival, not only the sample trip
  const own: Trip = { id: 'own', name: 'Own', startDate: '2026-11-05', endDate: '2026-11-06', homeTz: 'UTC', items: [a], createdAt: '' };
  assert.equal(weatherPlace(own, toUtc({ local: '2026-11-05T12:00', tz: 'Asia/Tokyo' }))?.name, 'Local train');
});

test('the form’s unsaved-changes check sees a position change', () => {
  const it = byId('demo-a1');
  const d = draftFromItem(it);
  assert.equal(draftChanged(d, { ...d }), false);
  assert.equal(draftChanged(d, { ...d, placePos: '35.1,139.1' }), true);
});

// ---- choices for "Pick a saved place" ----

test('position choices: saved places by name first, then other bookings’ positions, deduplicated, own booking left out', () => {
  const withSaved: Trip = {
    ...trip,
    places: [
      { id: 'z', name: 'Zen garden', lat: 35.0, lon: 135.7, savedAt: '' },
      { id: 'a', name: 'Arcade', lat: 35.6655, lon: 139.7707, savedAt: '', sample: true }, // same spot as demo-a1's place
      { id: 'bad', name: 'Broken', lat: 999, lon: 0, savedAt: '' } as never,
    ],
  };
  const c = positionChoices(withSaved, 'demo-h1');
  assert.deepEqual(c.slice(0, 2).map((x) => [x.name, x.source, x.sample]), [
    ['Arcade', 'saved', true],
    ['Zen garden', 'saved', false],
  ]);
  assert.ok(!c.some((x) => x.name === 'Tsukiji Outer Market'), 'a booking spot already saved is listed once');
  assert.ok(!c.some((x) => x.id.startsWith('item:demo-h1:')), 'the booking being edited is not offered to itself');
  assert.ok(c.some((x) => x.id === 'item:demo-t1:to' && x.name === 'Kyoto Station' && x.booking === 'Tokyo → Kyoto'));
  // Sydney Airport is both demo-f1's from and demo-f2's to: listed once
  assert.equal(c.filter((x) => x.name === 'Sydney Airport T1').length, 1);
  assert.deepEqual(positionChoices({ ...trip, items: [], places: undefined }), []);
});

test('picker region: the current spot, else around the choices, else none', () => {
  assert.deepEqual(pickerRegion({ lat: 1, lon: 2 }, []), { latitude: 1, longitude: 2, latitudeDelta: 0.01, longitudeDelta: 0.01 });
  const r = pickerRegion(null, [{ lat: 35, lon: 139 }, { lat: 35.2, lon: 139.4 }]);
  assert.ok(r && Math.abs(r.latitude - 35.1) < 1e-9 && Math.abs(r.longitude - 139.2) < 1e-9);
  assert.equal(pickerRegion(null, []), null);
});

// ---- transport stops on the trip route ----

test('trip route: journeys add departure and arrival stops only when asked', () => {
  const plain = tripRoute(trip);
  assert.ok(plain.days.every((d) => d.stops.every((s) => s.role === 'place')));
  const r = tripRoute(trip, { transport: true });
  const day = (date: string) => r.days.find((d) => d.date === date)?.stops.map((s) => `${s.n}:${s.key}@${s.time}`);
  // Train day (day 5): leave Tokyo Station, arrive Kyoto Station, check in at the inn, in time order.
  assert.deepEqual(day('2026-11-07'), ['1:demo-t1:from@12:03', '2:demo-t1:to@14:18', '3:demo-h2:place@15:00']);
  // The overnight flight home arrives on the next date, in Sydney's own clock.
  assert.deepEqual(day('2026-11-11'), ['1:demo-f2:to@08:50']);
  const arr = r.days.flatMap((d) => d.stops).find((s) => s.key === 'demo-f2:to');
  assert.equal(arr?.tz, 'Australia/Sydney');
  assert.equal(arr?.role, 'to');
  // legs join a day's stops in order
  const d5 = r.days.find((d) => d.date === '2026-11-07');
  assert.equal(d5?.legs.length, 2);
  assert.ok((d5?.meters ?? 0) > 300_000, 'Tokyo to Kyoto in a straight line');
  assert.equal(r.stopCount, plain.stopCount + 6);
  assert.equal(hasTransportStops(trip), true);
  assert.equal(hasTransportStops({ ...trip, items: trip.items.filter((i) => i.kind === 'hotel') }), false);
});

test('trip route: an arrival needs an end time; departure and arrival in different zones order by the real instant', () => {
  const mk = (x: Partial<Item> & Pick<Item, 'id' | 'start'>): Item => ({ tripId: 't', kind: 'activity', title: x.id, attachments: [], ...x });
  const t: Trip = {
    id: 't',
    name: 'T',
    startDate: '2026-11-02',
    endDate: '2026-11-02',
    homeTz: 'UTC',
    createdAt: '',
    items: [
      // 10:00 London = 11:00 Paris: before the 10:30 Paris lunch
      mk({ id: 'lunch', start: { local: '2026-11-02T10:30', tz: 'Europe/Paris' }, place: { id: 'l', name: 'Lunch', lat: 48.85, lon: 2.35 } }),
      mk({ id: 'ferry', kind: 'ferry', start: { local: '2026-11-02T10:00', tz: 'Europe/London' }, from: { id: 'f', name: 'Dock', lat: 51.5, lon: 0 }, to: { id: 'g', name: 'Pier', lat: 50, lon: 1 } }),
    ],
  };
  const stops = tripRoute(t, { transport: true }).days[0].stops.map((s) => s.key);
  assert.deepEqual(stops, ['lunch:place', 'ferry:from'], 'no end: no arrival stop');
  const bad = { ...t, items: [mk({ id: 'odd', start: { local: '2026-11-02T09:00', tz: 'Not/AZone' }, place: { id: 'o', name: 'Odd', lat: 1, lon: 1 } }), ...t.items] };
  assert.deepEqual(tripRoute(bad, { transport: true }).days[0].stops.map((s) => s.key), ['lunch:place', 'ferry:from', 'odd:place'], 'an unreadable zone goes last, never throws');
});

// ---- Today card vs Your day (decision in ops/DECISIONS.md) ----

test('Today card gives way to Your day for the brief’s trip, and only shows other trips’ rows', () => {
  const now = toUtc({ local: '2026-11-04T06:00', tz: 'Asia/Tokyo' });
  assert.ok(dayBrief([trip], now));
  assert.ok(todayAgenda([trip], now).length > 0, 'the plain agenda has today’s market');
  assert.deepEqual(agendaBesideBrief([trip], now), [], 'hidden: Your day already shows it');
  const other: Trip = {
    id: 'other',
    name: 'Work trip',
    startDate: '2026-12-01',
    endDate: '2026-12-02',
    homeTz: 'Asia/Tokyo',
    createdAt: '',
    items: [{ id: 'o1', tripId: 'other', kind: 'activity', title: 'Call', start: { local: '2026-11-04T09:00', tz: 'Asia/Tokyo' }, attachments: [] }],
  };
  assert.deepEqual(agendaBesideBrief([trip, other], now).map((r) => r.item.id), ['o1']);
  // No trip on today: the plain agenda, unchanged.
  const before = toUtc({ local: '2026-10-31T09:00', tz: 'Asia/Tokyo' });
  assert.deepEqual(agendaBesideBrief([trip, other], before), todayAgenda([trip, other], before));
  assert.match(read('../ui/TripPass.tsx'), /agendaBesideBrief\(trips, now\)/);
});

// ---- licences screen ----

test('licences list: OSM (ODbL) and MET Norway (CC BY 4.0) with their credit lines, every key in the catalogue', () => {
  const all = LICENCE_SECTIONS.flatMap((s) => s.entries);
  const osm = all.find((e) => e.id === 'osm');
  const met = all.find((e) => e.id === 'metno');
  assert.equal(osm?.licence, 'ODbL 1.0');
  assert.equal(osm?.url, 'https://www.openstreetmap.org/copyright');
  assert.match(en[osm?.credit as keyof typeof en], /© OpenStreetMap contributors/);
  assert.equal(met?.licence, 'CC BY 4.0');
  assert.match(en[met?.credit as keyof typeof en], /MET Norway/);
  for (const k of licenceKeys()) assert.ok(k in en, k);
  assert.equal(new Set(all.map((e) => e.id)).size, all.length, 'unique ids');
  for (const e of all) if (e.url) assert.match(e.url, /^https:\/\//, e.id);
});

test('licences list covers every app dependency in package.json, and docs/THIRD_PARTY.md names each source', () => {
  const pkg = JSON.parse(read('../../package.json')) as { dependencies: Record<string, string> };
  const covered = new Set(coveredPackages());
  for (const dep of Object.keys(pkg.dependencies)) assert.ok(covered.has(dep), `${dep} has no row in src/core/licences.ts`);
  for (const p of covered) assert.ok(p in pkg.dependencies, `${p} is listed but not a dependency`);
  const doc = read('../../docs/THIRD_PARTY.md');
  for (const name of ['OpenStreetMap', 'Protomaps', 'MET Norway', 'NOAA', 'Inter', 'Space Grotesk', 'Ionicons', 'react-native-maps', 'datetimepicker']) assert.ok(doc.includes(name), name);
  assert.match(read('../../app/settings.tsx'), /router\.push\('\/licences'\)/);
});

// ---- numbered pins ----

test('numbered stop markers stop tracking view changes after their first frame', () => {
  const src = read('../native/maps.tsx');
  assert.match(src, /tracksViewChanges=\{tracking\}/);
  assert.doesNotMatch(src, /tracksViewChanges\s*\n/, 'no marker tracks its view for ever');
  assert.match(src, /setTimeout\(\(\) => setTracking\(false\), BADGE_TRACK_MS\)/);
});

// ---- Intl.DisplayNames fallback ----

test('country names: a safe fallback when Intl.DisplayNames is missing, throws, or returns nothing useful', () => {
  const I = Intl as unknown as Record<string, unknown>;
  const saved = I.DisplayNames;
  try {
    I.DisplayNames = undefined;
    assert.equal(localCountryName('JP', 't72-missing', 'Japan'), 'Japan');
    I.DisplayNames = function () {
      throw new RangeError('unsupported');
    };
    assert.equal(localCountryName('JP', 't72-throws', 'Japan'), 'Japan');
    I.DisplayNames = class {
      of(code: string) {
        return code; // echoes the code back
      }
    };
    assert.equal(localCountryName('JP', 't72-echo', 'Japan'), 'Japan');
    I.DisplayNames = class {
      of(): string {
        throw new TypeError('bad');
      }
    };
    assert.equal(localCountryName('JP', 't72-of-throws', 'Japan'), 'Japan');
    I.DisplayNames = class {
      of(code: string) {
        return code === 'JP' ? 'Giappone' : 'Regione sconosciuta';
      }
    };
    assert.equal(localCountryName('JP', 't72-it', 'Japan'), 'Giappone');
    assert.equal(localCountryName('QQ', 't72-it', 'Nowhere'), 'Nowhere', '"Unknown Region" style answers fall back');
    assert.equal(localCountryName('J', 't72-it', 'Japan'), 'Japan', 'not a two-letter code');
  } finally {
    I.DisplayNames = saved;
  }
});
