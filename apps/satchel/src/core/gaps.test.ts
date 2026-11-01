// T135 trip gaps: nights with no stay (zones, midnight, DST, single-day trips, open-ended stays), a change of place
// with no journey, overlapping stays and journeys (the shared clash rules), check-in after the next journey leaves,
// arriving after the stay's check-out day, no journey home, dismissed gaps, the readiness row and the catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Item, ItemKind, Place, Trip } from './model.ts';
import { demoTrip } from './demo.ts';
import {
  coveredNights,
  dismissedFor,
  dismissGap,
  farApart,
  findGaps,
  GAP_KINDS,
  gapsCheck,
  hasWayHome,
  MAX_DISMISSED,
  nightBounds,
  restoreGaps,
  tonightGap,
} from './gaps.ts';
import { readiness, toFix } from './readiness.ts';
import { findConnections } from './layovers.ts';
import { gaps as strings } from '../i18n/en/gaps.ts';

let n = 0;
const P = (name: string, lat?: number, lon?: number): Place => ({ id: `pl_${name}`, name, ...(lat !== undefined && lon !== undefined ? { lat, lon } : {}) });
function it(kind: ItemKind, start: string, tz: string, end?: string, endTz?: string, extra: Partial<Item> = {}): Item {
  n++;
  return {
    id: extra.id ?? `i${n}`,
    tripId: 't',
    kind,
    title: extra.title ?? `${kind} ${n}`,
    start: { local: start, tz },
    ...(end ? { end: { local: end, tz: endTz ?? tz } } : {}),
    attachments: [],
    ...extra,
  };
}
const trip = (items: Item[], over: Partial<Trip> = {}): Trip => ({
  id: 't',
  name: 'Test',
  startDate: '2026-03-01',
  endDate: '2026-03-08',
  homeTz: 'Australia/Sydney',
  items,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});
const kinds = (t: Trip, d: string[] = []) => findGaps(t, d).gaps.map((g) => g.kind);
const SYD = 'Australia/Sydney';
const TYO = 'Asia/Tokyo';

/** Sydney -> Tokyo, stay Tokyo 1..4, train to Kyoto 4th, stay Kyoto 4..7, flight home 7th. */
function base(): Item[] {
  return [
    it('flight', '2026-03-01T09:30', SYD, '2026-03-01T17:45', TYO, { id: 'out', from: P('Sydney'), to: P('Tokyo Haneda') }),
    it('hotel', '2026-03-01T19:30', TYO, '2026-03-04T11:00', TYO, { id: 'h1', place: P('Asakusa Inn', 35.71, 139.79) }),
    it('train', '2026-03-04T12:00', TYO, '2026-03-04T14:15', TYO, { id: 'tr', from: P('Tokyo'), to: P('Kyoto') }),
    it('hotel', '2026-03-04T15:00', TYO, '2026-03-07T10:00', TYO, { id: 'h2', place: P('Gion Inn', 35.0, 135.77) }),
    it('flight', '2026-03-07T21:30', TYO, '2026-03-08T08:50', SYD, { id: 'home', from: P('Osaka Kansai'), to: P('Sydney') }),
  ];
}

test('a complete trip (and the demo trip) has no gaps', () => {
  assert.deepEqual(kinds(trip(base())), []);
  assert.deepEqual(findGaps(demoTrip('2026-12-01')).gaps, []);
  assert.equal(GAP_KINDS.length, 7);
});

test('nights with no stay between the first arrival and the last departure, grouped into runs', () => {
  const items = base().filter((i) => i.id !== 'h2');
  const g = findGaps(trip(items)).gaps;
  assert.equal(g.length, 1);
  assert.equal(g[0].kind, 'night');
  assert.equal(g[0].from, '2026-03-04');
  assert.equal(g[0].to, '2026-03-06');
  assert.equal(g[0].nights, 3);
  assert.equal(g[0].id, 'night:2026-03-04:2026-03-06');
  assert.deepEqual(g[0].add, { kind: 'hotel', date: '2026-03-04', until: '2026-03-07', tz: TYO });
});

test('two separate holes are two gaps; the night before the outbound and the night you fly home need nothing', () => {
  const items = base().filter((i) => i.id !== 'h1' && i.id !== 'h2');
  items.push(it('hotel', '2026-03-02T15:00', TYO, '2026-03-03T10:00', TYO, { id: 'mid' }));
  items.push(it('hotel', '2026-03-05T15:00', TYO, '2026-03-06T10:00', TYO, { id: 'mid2' }));
  const g = findGaps(trip(items)).gaps.filter((x) => x.kind === 'night');
  assert.deepEqual(
    g.map((x) => [x.from, x.to, x.nights]),
    [
      ['2026-03-01', '2026-03-01', 1],
      ['2026-03-03', '2026-03-04', 2],
      ['2026-03-06', '2026-03-06', 1],
    ],
  );
});

test('each night is a local date on its own zone: a date-line arrival starts the nights on the arrival date', () => {
  // Sydney 23:30 -> Honolulu lands the previous calendar day (Honolulu -10).
  const items = [
    it('flight', '2026-03-02T23:30', SYD, '2026-03-02T11:00', 'Pacific/Honolulu', { id: 'o' }),
    it('hotel', '2026-03-02T15:00', 'Pacific/Honolulu', '2026-03-05T11:00', 'Pacific/Honolulu', { id: 'hh' }),
    it('flight', '2026-03-05T13:00', 'Pacific/Honolulu', '2026-03-06T20:00', SYD, { id: 'b' }),
  ];
  const t = trip(items, { startDate: '2026-03-02', endDate: '2026-03-06' });
  assert.deepEqual(nightBounds(t), { first: '2026-03-02', last: '2026-03-05' });
  assert.deepEqual(kinds(t), []);
  // Without the stay: the three Honolulu nights (2nd, 3rd, 4th local) and the add form on Honolulu's clock.
  const g = findGaps(trip(items.filter((i) => i.id !== 'hh'), { startDate: '2026-03-02', endDate: '2026-03-06' })).gaps;
  assert.equal(g[0].kind, 'night');
  assert.deepEqual([g[0].from, g[0].to, g[0].nights, g[0].add?.tz], ['2026-03-02', '2026-03-04', 3, 'Pacific/Honolulu']);
});

test('midnight: a 00:05 arrival on the 2nd starts the nights on the 2nd; a check-out at 00:00 frees that night', () => {
  const items = [
    it('flight', '2026-03-01T20:00', SYD, '2026-03-02T00:05', TYO, { id: 'o' }),
    it('hotel', '2026-03-02T00:30', TYO, '2026-03-04T00:00', TYO, { id: 'h' }),
    it('flight', '2026-03-05T10:00', TYO, '2026-03-05T22:00', SYD, { id: 'b' }),
  ];
  const t = trip(items);
  // The red-eye covers the night of the 1st; bounds start on the 2nd. Check-out on the 4th leaves the 4th open.
  assert.deepEqual(nightBounds(t), { first: '2026-03-02', last: '2026-03-05' });
  const g = findGaps(t).gaps;
  assert.deepEqual(g.map((x) => [x.kind, x.from, x.to]), [['night', '2026-03-04', '2026-03-04']]);
});

test('DST: nights across a clock change are still one per calendar date (spring forward and fall back)', () => {
  // Europe/London springs forward on 29 Mar 2026, falls back on 25 Oct 2026.
  const LON = 'Europe/London';
  for (const [a, b] of [
    ['2026-03-27', '2026-03-31'],
    ['2026-10-23', '2026-10-27'],
  ]) {
    const items = [
      it('train', `${a}T09:00`, 'Europe/Paris', `${a}T10:30`, LON, { id: 'in' }),
      it('train', `${b}T18:00`, LON, `${b}T21:20`, 'Europe/Paris', { id: 'outb' }),
    ];
    const g = findGaps(trip(items, { startDate: a, endDate: b, homeTz: 'Europe/Paris' })).gaps;
    assert.equal(g.length, 1, a);
    assert.equal(g[0].nights, 4, a);
    assert.equal(g[0].to < b, true);
  }
});

test('a single-day trip needs no night; same-day stay (a day room) covers none', () => {
  const items = [
    it('train', '2026-03-01T08:00', SYD, '2026-03-01T11:00', 'Australia/Melbourne', { id: 'a' }),
    it('hotel', '2026-03-01T12:00', 'Australia/Melbourne', '2026-03-01T17:00', 'Australia/Melbourne', { id: 'day' }),
    it('train', '2026-03-01T18:00', 'Australia/Melbourne', '2026-03-01T21:00', SYD, { id: 'b' }),
  ];
  const t = trip(items, { startDate: '2026-03-01', endDate: '2026-03-01' });
  assert.equal(nightBounds(t), null);
  assert.deepEqual(kinds(t), []);
  assert.equal(coveredNights(items).size, 0);
});

test('open-ended items: a stay with no check-out covers until the next journey leaves; a journey with no arrival is taken at its word', () => {
  const items = base().filter((i) => i.id !== 'h1');
  items.push(it('hotel', '2026-03-01T19:30', TYO, undefined, undefined, { id: 'open' }));
  assert.deepEqual(kinds(trip(items)), []);
  const cov = coveredNights(items);
  assert.ok(cov.has('2026-03-01') && cov.has('2026-03-03') && !cov.has('2026-03-08'));
  // Last stay open-ended: runs to the last departure.
  const items2 = base().filter((i) => i.id !== 'h2');
  items2.push(it('hotel', '2026-03-04T15:00', TYO, undefined, undefined, { id: 'open2' }));
  assert.deepEqual(kinds(trip(items2)), []);
  // A final flight with no arrival time: no "no journey home" and no clash.
  const items3 = base().map((i) => (i.id === 'home' ? { ...i, end: undefined } : i));
  assert.deepEqual(kinds(trip(items3)), []);
  assert.equal(hasWayHome(trip(items3)), true);
});

test('an overnight or multi-day journey gives a bed for the nights it runs', () => {
  const items = base().filter((i) => i.id !== 'h2');
  items.push(it('ferry', '2026-03-04T18:00', TYO, '2026-03-07T08:00', TYO, { id: 'cruise', from: P('Tokyo'), to: P('Osaka') }));
  const cov = coveredNights(items);
  assert.ok(['2026-03-04', '2026-03-05', '2026-03-06'].every((d) => cov.has(d)));
  assert.deepEqual(kinds(trip(items)).filter((k) => k === 'night'), []);
});

test('a change of country with no journey between two stays', () => {
  const items = base().filter((i) => i.id !== 'tr');
  // The second stay is in Seoul now, with no journey from Tokyo.
  const seoul = items.map((i) => (i.id === 'h2' ? { ...i, start: { local: '2026-03-04T15:00', tz: 'Asia/Seoul' }, end: { local: '2026-03-07T10:00', tz: 'Asia/Seoul' }, place: P('Myeongdong Stay') } : i));
  const g = findGaps(trip(seoul)).gaps.filter((x) => x.kind === 'move');
  assert.ok(g.length >= 1);
  assert.equal(g[0].id, 'move:h1>h2');
  assert.deepEqual([g[0].from, g[0].to, g[0].fromPlace, g[0].toPlace], ['2026-03-01', '2026-03-04', 'Asakusa Inn', 'Myeongdong Stay']);
  assert.deepEqual(g[0].add, { kind: 'flight', date: '2026-03-01', tz: TYO });
});

test('a change of city in one country counts by saved positions (over 80 km), not by zone', () => {
  const items = base().filter((i) => i.id !== 'tr');
  const g = findGaps(trip(items)).gaps.filter((x) => x.kind === 'move');
  assert.equal(g.length, 1);
  assert.equal(g[0].add?.kind, 'train');
  // Without positions the two Japanese stays are not known to be apart: no gap.
  const noPos = items.map((i) => (i.kind === 'hotel' ? { ...i, place: P(i.place?.name ?? '') } : i));
  assert.deepEqual(findGaps(trip(noPos)).gaps.filter((x) => x.kind === 'move'), []);
  // A hire car across the change is a way of getting there.
  const car = [...items, it('car', '2026-03-04T10:00', TYO, '2026-03-04T18:00', TYO, { id: 'car' })];
  assert.deepEqual(findGaps(trip(car)).gaps.filter((x) => x.kind === 'move'), []);
  assert.equal(farApart({ place: P('a', 35.68, 139.76), tz: TYO }, { place: P('b', 35.45, 139.64), tz: TYO }), false);
});

test('overlapping stays use the timeline clash rule and count the shared nights', () => {
  const items = base().map((i) => (i.id === 'h1' ? { ...i, end: { local: '2026-03-06T11:00', tz: TYO } } : i));
  const g = findGaps(trip(items)).gaps.filter((x) => x.kind === 'stayClash');
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].id, g[0].from, g[0].to, g[0].nights], ['stays:h1+h2', '2026-03-04', '2026-03-06', 2]);
  assert.equal(g[0].add, null);
  // Back to back (check-out 11:00, next check-in 15:00 the same day) is fine.
  assert.deepEqual(findGaps(trip(base())).gaps.filter((x) => x.kind === 'stayClash'), []);
});

test('two journeys overlapping in time reuse the connections clash list (minutes on each own zone)', () => {
  const items = [...base(), it('bus', '2026-03-04T13:00', TYO, '2026-03-04T16:00', TYO, { id: 'bus', from: P('Tokyo'), to: P('Nikko') })];
  const g = findGaps(trip(items)).gaps.filter((x) => x.kind === 'legClash');
  const shared = findConnections(items).clashes;
  assert.equal(g.length, shared.length);
  assert.equal(g[0].id, 'legs:tr+bus');
  assert.equal(g[0].minutes, 75);
  // Across zones: Sydney 10:00 (+11) to Tokyo, and a Tokyo 09:30 (+9) departure overlap by 30 min of real time.
  const x = [
    it('flight', '2026-03-01T10:00', SYD, '2026-03-01T19:00', TYO, { id: 'f1' }),
    it('flight', '2026-03-01T18:30', TYO, '2026-03-01T20:00', 'Asia/Seoul', { id: 'f2' }),
  ];
  assert.equal(findGaps(trip(x)).gaps.find((y) => y.kind === 'legClash')?.minutes, 30);
});

test('a stay that checks in after the next journey has left', () => {
  // Kyoto check-in typed as the 7th 23:00, after the flight home leaves at 21:30.
  const items = base().map((i) => (i.id === 'h2' ? { ...i, start: { local: '2026-03-07T23:00', tz: TYO }, end: { local: '2026-03-08T10:00', tz: TYO } } : i));
  const g = findGaps(trip(items)).gaps.filter((x) => x.kind === 'checkInLate');
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].id, g[0].minutes, g[0].from], ['checkin:h2>home', 90, '2026-03-07']);
  // A day trip before check-in (out and back the same day) is not that.
  const day = [
    ...base(),
    it('bus', '2026-03-04T14:30', TYO, '2026-03-04T14:50', TYO, { id: 'b1', from: P('Kyoto'), to: P('Kyoto Station') }),
  ].map((i) => (i.id === 'h2' ? { ...i, start: { local: '2026-03-04T15:00', tz: TYO } } : i));
  assert.deepEqual(findGaps(trip(day)).gaps.filter((x) => x.kind === 'checkInLate'), []);
});

test('a journey that lands after its stay\'s check-out day', () => {
  // The train to Kyoto typed as arriving on the 8th, after the Kyoto stay ends on the 7th.
  const items = base().map((i) => (i.id === 'tr' ? { ...i, end: { local: '2026-03-08T14:15', tz: TYO } } : i));
  const g = findGaps(trip(items)).gaps.filter((x) => x.kind === 'lateArrival');
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].id, g[0].from, g[0].to], ['arrive:tr>h2', '2026-03-07', '2026-03-08']);
  // Landing on the check-out day itself is not flagged.
  const ok = base().map((i) => (i.id === 'tr' ? { ...i, end: { local: '2026-03-07T09:00', tz: TYO } } : i));
  assert.deepEqual(findGaps(trip(ok)).gaps.filter((x) => x.kind === 'lateArrival'), []);
});

test('no journey home: abroad by country, at home by place or zone, none without bookings', () => {
  const oneWay = base().filter((i) => i.id !== 'home');
  const g = findGaps(trip(oneWay)).gaps.filter((x) => x.kind === 'noWayHome');
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].add, { kind: 'flight', date: '2026-03-08', tz: TYO });
  // Home is a country, not a city: landing in Melbourne still counts.
  const mel = base().map((i) => (i.id === 'home' ? { ...i, end: { local: '2026-03-08T08:50', tz: 'Australia/Melbourne' } } : i));
  assert.equal(hasWayHome(trip(mel)), true);
  // A trip at home: Sydney -> Melbourne by train with nothing back.
  const dom = [it('train', '2026-03-01T08:00', SYD, '2026-03-01T19:00', 'Australia/Melbourne', { id: 'd1', from: P('Sydney'), to: P('Melbourne') })];
  const dg = findGaps(trip(dom)).gaps.find((x) => x.kind === 'noWayHome');
  assert.equal(dg?.add?.kind, 'train');
  dom.push(it('train', '2026-03-04T08:00', 'Australia/Melbourne', '2026-03-04T19:00', SYD, { id: 'd2', from: P('Melbourne'), to: P('Sydney') }));
  assert.equal(hasWayHome(trip(dom)), true);
  // No journeys: only a stay abroad needs a way home; notes and activities alone need nothing.
  assert.equal(hasWayHome(trip([it('hotel', '2026-03-02T15:00', TYO, '2026-03-04T10:00', TYO)])), false);
  assert.equal(hasWayHome(trip([it('hotel', '2026-03-02T15:00', SYD, '2026-03-04T10:00', SYD)])), true);
  assert.deepEqual(findGaps(trip([it('note', '2026-03-02T15:00', TYO)])).gaps, []);
  assert.deepEqual(findGaps(trip([])).gaps, []);
});

test('items with an unreadable zone or a broken time are skipped, never thrown on', () => {
  const items = [...base(), it('hotel', '2026-03-02T15:00', 'Mars/Olympus', '2026-03-03T10:00', 'Mars/Olympus'), it('train', 'not a time', TYO)];
  assert.deepEqual(kinds(trip(items)), []);
  assert.doesNotThrow(() => findGaps(trip(base(), { startDate: 'bad', endDate: '' })));
});

test('dismissed gaps are left out and counted; a changed gap comes back with a new id', () => {
  const items = base().filter((i) => i.id !== 'h2' && i.id !== 'home');
  const t = trip(items);
  const all = findGaps(t).gaps;
  assert.deepEqual(all.map((g) => g.kind), ['night', 'noWayHome']);
  const r = findGaps(t, ['home']);
  assert.deepEqual(r.gaps.map((g) => g.kind), ['night']);
  assert.equal(r.dismissed, 1);
  assert.equal(findGaps(t, all.map((g) => g.id)).gaps.length, 0);
  // Book one of the three nights: the run changes, so its old dismissal no longer hides it.
  const more = [...items, it('hotel', '2026-03-05T15:00', TYO, '2026-03-06T10:00', TYO)];
  const left = findGaps(trip(more), all.map((g) => g.id)).gaps;
  assert.deepEqual(left.map((g) => g.id), ['night:2026-03-04:2026-03-04', 'night:2026-03-06:2026-03-07']);
});

test('dismissal store: per trip, de-duplicated, capped, damaged storage read safely, restore clears one trip', () => {
  let s = dismissGap(undefined, 't', 'home');
  s = dismissGap(s, 't', 'home');
  s = dismissGap(s, 'u', 'night:2026-03-04:2026-03-04');
  assert.deepEqual(dismissedFor(s, 't'), ['home']);
  assert.deepEqual(dismissedFor(s, 'u'), ['night:2026-03-04:2026-03-04']);
  assert.deepEqual(dismissedFor('junk', 't'), []);
  assert.deepEqual(dismissedFor({ t: [1, null, 'a', 'a'] }, 't'), ['a']);
  assert.deepEqual(restoreGaps(s, 't'), { u: ['night:2026-03-04:2026-03-04'] });
  let big: unknown = {};
  for (let i = 0; i < MAX_DISMISSED + 5; i++) big = dismissGap(big, 't', `g${i}`);
  assert.equal(dismissedFor(big, 't').length, MAX_DISMISSED);
  assert.equal(dismissedFor(big, 't')[0], 'g5');
});

test('tonight with no stay, for Your day', () => {
  const t = trip(base().filter((i) => i.id !== 'h2'));
  assert.equal(tonightGap(t, '2026-03-05')?.id, 'night:2026-03-04:2026-03-06');
  assert.equal(tonightGap(t, '2026-03-02'), null);
  assert.equal(tonightGap(t, '2026-03-07'), null);
  assert.equal(tonightGap(t, '2026-03-05', ['night:2026-03-04:2026-03-06']), null);
});

test('readiness row: none without journeys or stays, pass when clean, warn with the first gap as the fix', () => {
  assert.equal(gapsCheck(trip([])), null);
  assert.deepEqual(gapsCheck(trip(base()))?.status, 'pass');
  const t = trip(base().filter((i) => i.id !== 'h2'));
  const c = gapsCheck(t);
  assert.equal(c?.status, 'warn');
  assert.equal(c?.reason, 'found');
  assert.equal(c?.done, 1);
  assert.deepEqual(c?.fix, { kind: 'gap', tripId: 't', add: { kind: 'hotel', date: '2026-03-04', until: '2026-03-07', tz: TYO } });
  assert.equal(gapsCheck(t, ['night:2026-03-04:2026-03-06'])?.status, 'pass');
  // A clash's fix opens its first booking.
  const clash = trip([...base(), it('bus', '2026-03-04T13:00', TYO, '2026-03-04T16:00', TYO, { id: 'bus' })]);
  assert.deepEqual(gapsCheck(clash)?.fix, { kind: 'gap', tripId: 't', itemId: 'tr' });
  // In the card it sits after the map row, scored, and is listed to fix.
  const r = readiness({ trip: t, docs: [], packing: null, card: null, catalog: null, installed: [], now: Date.parse('2026-02-20T00:00:00Z'), gaps: c, todos: null });
  assert.equal(r.checks[r.checks.length - 1].id, 'gaps');
  assert.ok(toFix(r).some((x) => x.id === 'gaps'));
});

test('every gap kind has its strings, all prefixed gaps.', () => {
  for (const k of Object.keys(strings)) assert.ok(k.startsWith('gaps.'), k);
  for (const k of GAP_KINDS) {
    assert.ok(`gaps.reason.${k}` in strings, k);
    assert.ok(`gaps.title.${k}` in strings, k);
  }
  const src = readFileSync(new URL('./gaps.ts', import.meta.url), 'utf8');
  assert.ok(!/from '(react|expo)/.test(src));
});

test('wired in: trip screen card, readiness row, Your day row, and the add form takes the dates and zone', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.match(read('app/trip/[id].tsx'), /<TripGapsCard trip=\{trip\} \/>/);
  assert.match(read('src/ui/ReadinessCard.tsx'), /gaps: gapsCheck\(trip, gapDismissed\)/);
  assert.match(read('src/ui/DayBriefCard.tsx'), /<GapsBriefRow trip=\{b\.trip\} today=\{b\.today\} \/>/);
  const edit = read('app/item-edit.tsx');
  assert.match(edit, /until\?: string; tz\?: string/);
  assert.match(edit, /isValidZone\(params\.tz\)/);
  // Dismissals live in AsyncStorage on this phone, never as a Trip field.
  assert.ok(!/gaps/i.test(read('src/core/model.ts')));
  const ui = read('src/ui/gaps.tsx');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(ui), 'tokens only');
  assert.ok(!/spring/i.test(ui.replace(/\/\/.*$/gm, '')), 'no springs');
});
