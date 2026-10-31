import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import {
  arcGlyphs,
  CONTINENT_OF,
  continentFor,
  fitText,
  freshTrip,
  inkSpecks,
  MAX_TILT,
  STAMP_INKS,
  STAMP_SHAPES,
  stampCollection,
  stampDate,
  stampGeometry,
  stampHash,
  stampLook,
  stampPages,
  stampsForTrip,
  stampsText,
} from './stamps.ts';

const item = (id: string, x: Partial<Item> & Pick<Item, 'kind' | 'start'>): Item => ({ id, tripId: 't', title: id, attachments: [], ...x });
const trip = (id: string, x: Partial<Trip> = {}): Trip => ({
  id,
  name: id,
  startDate: '2026-03-01',
  endDate: '2026-03-05',
  homeTz: 'Europe/London',
  items: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...x,
});
const keys = (c: { stamps: { key: string }[] }) => c.stamps.map((s) => s.key).sort();

test('demo trip gives JP + AU stamps (and Sydney, Tokyo, Kyoto cities)', () => {
  const c = stampCollection([demoTrip('2026-01-01')], '2026-02-01', { includeDemo: true });
  assert.deepEqual(keys(c), ['c:AU', 'c:JP', 't:AU:sydney', 't:JP:kyoto', 't:JP:tokyo']);
  assert.deepEqual(c.counts, { countries: 2, cities: 3, continents: 2, stamps: 5 });
  const au = c.stamps.find((s) => s.key === 'c:AU')!;
  assert.equal(au.mark, 'departed');
  assert.equal(au.date, '2026-01-01');
  const jp = c.stamps.find((s) => s.key === 'c:JP')!;
  assert.equal(jp.mark, 'arrived');
  assert.equal(jp.continent, 'asia');
  assert.equal(c.stamps.find((s) => s.key === 't:JP:kyoto')!.date, '2026-01-05');
  assert.ok(c.stamps.every((s) => s.demo && s.tripId === 'demo'));
});

test('demo trips are left out unless asked for', () => {
  const c = stampCollection([demoTrip('2026-01-01')], '2026-02-01');
  assert.equal(c.stamps.length, 0);
  assert.equal(c.demoLeftOut, 1);
});

test('upcoming trips give no stamp; a trip that is on stamps only the stops reached', () => {
  const t = trip('a', {
    startDate: '2026-11-10',
    endDate: '2026-11-20',
    items: [item('f', { kind: 'flight', start: { local: '2026-11-10T09:00', tz: 'Europe/London' }, end: { local: '2026-11-10T12:00', tz: 'Europe/Paris' } })],
  });
  assert.equal(stampCollection([t], '2026-10-31').stamps.length, 0);
  const on = trip('b', {
    startDate: '2026-10-28',
    endDate: '2026-11-05',
    items: [
      item('f1', { kind: 'flight', start: { local: '2026-10-28T09:00', tz: 'Europe/London' }, end: { local: '2026-10-28T12:00', tz: 'Europe/Paris' } }),
      item('f2', { kind: 'flight', start: { local: '2026-11-03T09:00', tz: 'Europe/Paris' }, end: { local: '2026-11-03T13:00', tz: 'Europe/Rome' } }),
    ],
  });
  const c = stampCollection([on], '2026-10-31');
  assert.deepEqual(keys(c), ['c:FR', 'c:GB', 't:FR:paris', 't:GB:london']);
});

test('dedupe across trips: one stamp per place, from the earliest visit, whatever the trip order', () => {
  const early = trip('early', {
    name: 'Spring',
    startDate: '2025-04-01',
    endDate: '2025-04-04',
    items: [item('1', { kind: 'flight', start: { local: '2025-04-01T08:00', tz: 'Europe/London' }, end: { local: '2025-04-01T11:00', tz: 'Europe/Paris' } })],
  });
  const late = trip('late', {
    name: 'Autumn',
    startDate: '2026-09-01',
    endDate: '2026-09-04',
    items: [
      item('2', { kind: 'train', start: { local: '2026-09-01T08:00', tz: 'Europe/London' }, end: { local: '2026-09-01T11:30', tz: 'Europe/Paris' } }),
      item('3', { kind: 'train', start: { local: '2026-09-03T08:00', tz: 'Europe/Paris' }, end: { local: '2026-09-03T10:00', tz: 'Europe/Brussels' } }),
    ],
  });
  const a = stampCollection([early, late], '2026-10-31');
  const b = stampCollection([late, early], '2026-10-31');
  assert.deepEqual(a, b);
  assert.equal(a.stamps.filter((s) => s.key === 'c:FR').length, 1);
  const fr = a.stamps.find((s) => s.key === 'c:FR')!;
  assert.equal(fr.tripId, 'early');
  assert.equal(fr.date, '2025-04-01');
  assert.equal(a.stamps.find((s) => s.key === 'c:BE')!.tripName, 'Autumn');
  assert.deepEqual(a.counts, { countries: 3, cities: 3, continents: 1, stamps: 6 });
  // newest first
  assert.equal(a.stamps[0].key.endsWith('BE') || a.stamps[0].key.endsWith('brussels'), true);
  assert.equal(a.stamps[a.stamps.length - 1].date, '2025-04-01');
});

test('cities dedupe without case or accents, and hotel towns win over the zone city', () => {
  const t1 = trip('h1', {
    startDate: '2026-05-01',
    endDate: '2026-05-06',
    items: [
      item('f', { kind: 'flight', start: { local: '2026-05-01T07:00', tz: 'Europe/London' }, end: { local: '2026-05-01T09:30', tz: 'Europe/Zurich' } }),
      item('h', { kind: 'hotel', start: { local: '2026-05-01T15:00', tz: 'Europe/Zurich' }, place: { id: 'p', name: 'Inn', address: 'Rue 2, 1204 Genève' } }),
    ],
  });
  const t2 = trip('h2', {
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    items: [item('h', { kind: 'hotel', start: { local: '2026-06-01T15:00', tz: 'Europe/Zurich' }, place: { id: 'p', name: 'Inn', address: 'Quai 9, GENEVE' } })],
  });
  const c = stampCollection([t1, t2], '2026-10-31');
  const swissCities = c.stamps.filter((s) => s.kind === 'city' && s.iso2 === 'CH');
  assert.deepEqual(
    swissCities.map((s) => s.city),
    ['Genève'],
  );
  assert.equal(swissCities[0].tripId, 'h1');
});

test('first-arrival date is read in the stop’s own zone (an overnight flight lands the next day)', () => {
  const t = trip('n', {
    startDate: '2026-03-01',
    endDate: '2026-03-10',
    homeTz: 'America/Los_Angeles',
    items: [item('f', { kind: 'flight', start: { local: '2026-03-01T23:30', tz: 'America/Los_Angeles' }, end: { local: '2026-03-03T05:10', tz: 'Asia/Tokyo' } })],
  });
  const c = stampCollection([t], '2026-10-31');
  assert.equal(c.stamps.find((s) => s.key === 'c:JP')!.date, '2026-03-03');
  assert.equal(c.stamps.find((s) => s.key === 'c:US')!.date, '2026-03-01');
  assert.equal(c.stamps.find((s) => s.key === 'c:US')!.mark, 'departed');
});

test('earliest visit is by real instant, not wall clock, when two trips touch a place the same day', () => {
  const a = trip('a', { startDate: '2026-03-02', items: [item('1', { kind: 'activity', start: { local: '2026-03-02T09:00', tz: 'Europe/Paris' } })] });
  const b = trip('b', { startDate: '2026-03-02', items: [item('2', { kind: 'activity', start: { local: '2026-03-02T08:30', tz: 'Europe/Paris' } })] });
  assert.equal(stampCollection([a, b], '2026-10-31').stamps.find((s) => s.key === 'c:FR')!.tripId, 'b');
});

test('deterministic pick: the same place always gets the same shape, tilt and ink (fixed values across runs)', () => {
  assert.equal(stampHash(''), 0x811c9dc5);
  assert.equal(stampHash('c:JP'), stampHash('c:JP'));
  assert.deepEqual(stampLook('c:JP'), { shape: 'round', tilt: 9, ink: 'teal', seed: 9361 });
  assert.deepEqual(stampLook('c:AU'), { shape: 'round', tilt: -6, ink: 'rust', seed: 9076 });
  assert.deepEqual(stampLook('t:JP:tokyo'), { shape: 'hexagon', tilt: -5, ink: 'crimson', seed: 9135 });
  const seen = new Set<string>();
  const inks = new Set<string>();
  for (const code of Object.keys(CONTINENT_OF)) {
    const l = stampLook(`c:${code}`);
    assert.ok(STAMP_SHAPES.includes(l.shape));
    assert.ok(STAMP_INKS.includes(l.ink));
    assert.ok(Number.isInteger(l.tilt) && l.tilt !== 0 && Math.abs(l.tilt) <= MAX_TILT, String(l.tilt));
    seen.add(l.shape);
    inks.add(l.ink);
  }
  assert.equal(seen.size, STAMP_SHAPES.length);
  assert.equal(inks.size, STAMP_INKS.length);
  // a stamp's look does not depend on the trip it came from
  const one = stampCollection([demoTrip('2026-01-01')], '2026-02-01', { includeDemo: true }).stamps.find((s) => s.key === 'c:JP')!;
  const two = stampCollection([demoTrip('2024-06-10')], '2026-02-01', { includeDemo: true }).stamps.find((s) => s.key === 'c:JP')!;
  assert.deepEqual([one.shape, one.tilt, one.ink], [two.shape, two.tilt, two.ink]);
});

test('continent table and counts', () => {
  assert.equal(continentFor('JP'), 'asia');
  assert.equal(continentFor('au'), 'oceania');
  assert.equal(continentFor('BR'), 'southAmerica');
  assert.equal(continentFor('MX'), 'northAmerica');
  assert.equal(continentFor('KE'), 'africa');
  assert.equal(continentFor('FR'), 'europe');
  assert.equal(continentFor('AQ'), 'antarctica');
  assert.equal(continentFor('ZZ', 'Europe/Nowhere'), 'europe');
  assert.equal(continentFor('ZZ'), null);
  const t = trip('w', {
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    items: [
      item('1', { kind: 'flight', start: { local: '2026-01-01T09:00', tz: 'Europe/London' }, end: { local: '2026-01-01T20:00', tz: 'America/New_York' } }),
      item('2', { kind: 'flight', start: { local: '2026-01-05T09:00', tz: 'America/New_York' }, end: { local: '2026-01-05T20:00', tz: 'America/Sao_Paulo' } }),
      item('3', { kind: 'flight', start: { local: '2026-01-10T09:00', tz: 'America/Sao_Paulo' }, end: { local: '2026-01-11T06:00', tz: 'Africa/Johannesburg' } }),
      item('4', { kind: 'activity', start: { local: '2026-01-12T09:00', tz: 'Africa/Johannesburg' } }),
    ],
  });
  const c = stampCollection([t], '2026-10-31');
  assert.deepEqual(c.counts, { countries: 4, cities: 4, continents: 4, stamps: 8 });
});

test('recap stamps: the trip’s places as lifetime stamps, firsts marked', () => {
  const early = trip('early', { startDate: '2025-04-01', items: [item('1', { kind: 'activity', start: { local: '2025-04-01T09:00', tz: 'Europe/Paris' } })] });
  const late = trip('late', {
    startDate: '2026-09-01',
    items: [
      item('2', { kind: 'activity', start: { local: '2026-09-01T09:00', tz: 'Europe/Paris' } }),
      item('3', { kind: 'activity', start: { local: '2026-09-02T09:00', tz: 'Europe/Madrid' } }),
    ],
  });
  const all = stampCollection([early, late], '2026-10-31');
  const r = stampsForTrip(all, late, '2026-10-31');
  assert.deepEqual(r.stamps.map((s) => s.key).sort(), ['c:ES', 'c:FR', 't:ES:madrid', 't:FR:paris']);
  assert.deepEqual([...r.firsts].sort(), ['c:ES', 't:ES:madrid']);
  assert.equal(r.stamps.find((s) => s.key === 'c:FR')!.date, '2025-04-01');
});

test('fresh trip: the newly finished trip with first stamps, within the window', () => {
  const t = trip('new', { startDate: '2026-10-20', endDate: '2026-10-25', items: [item('1', { kind: 'activity', start: { local: '2026-10-21T09:00', tz: 'Europe/Lisbon' } })] });
  const c = stampCollection([t], '2026-10-31');
  assert.equal(freshTrip(c, [t], '2026-10-31')?.tripId, 'new');
  assert.equal(freshTrip(c, [t], '2026-10-31')?.stamps.length, 2);
  assert.equal(freshTrip(c, [t], '2026-12-31'), null);
  assert.equal(freshTrip(c, [t], '2026-10-24'), null); // still on
});

test('pages, dates, text fitting and share text', () => {
  assert.deepEqual(stampPages([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5, 6], [7]]);
  assert.deepEqual(stampPages([], 6), []);
  assert.equal(stampDate('2026-03-03', 'en-GB'), '03 MAR 2026');
  const f = fitText('Llanfairpwllgwyngyll Station Square', 60, 10);
  assert.ok(f.text.endsWith('…') && f.size >= 7);
  assert.deepEqual(fitText('Rome', 80, 10), { text: 'ROME', size: 10 });
  const g = arcGlyphs('Tokyo', 46, 46, 'top', 10);
  assert.equal(g.glyphs.length, 5);
  assert.ok(g.glyphs[2].y < 20 && Math.abs(g.glyphs[2].rotate) < 1);
  const b = arcGlyphs('Arrived', 46, 46, 'bottom', 10);
  assert.ok(b.glyphs[0].x < b.glyphs[6].x, 'bottom text reads left to right');
  for (const s of STAMP_SHAPES) assert.match(stampGeometry(s).outer, /^M.*Z$/);
  assert.deepEqual(inkSpecks(42), inkSpecks(42));
  const c = stampCollection([demoTrip('2026-01-01')], '2026-02-01', { includeDemo: true });
  const text = stampsText(
    c.stamps,
    { heading: 'My passport', counts: (n) => `${n.countries} countries`, line: (p, d, m) => `${p} · ${d} · ${m}`, footer: 'Satchel' },
    (s) => s.city ?? s.iso2,
    (d) => d,
  );
  assert.match(text, /^My passport\n2 countries\n/);
  assert.match(text, /Sydney · 2026-01-01 · departed/);
  assert.doesNotMatch(text, /DMO4KX|34K/);
});
