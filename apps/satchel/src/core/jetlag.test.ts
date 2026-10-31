import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import {
  callWindows,
  clock,
  flightLegs,
  hm,
  homeZone,
  jetLagView,
  normaliseShift,
  planFor,
  planLegs,
  thereZone,
  tripZones,
  windowNow,
  WORKING,
  zoneAt,
  type Leg,
} from './jetlag.ts';
import type { Item, ItemKind, Trip } from './model.ts';
import { toUtc } from './tz.ts';

let n = 0;
function item(kind: ItemKind, start: [string, string], end?: [string, string]): Item {
  n++;
  return { id: `i${n}`, tripId: 't', kind, title: `${kind} ${n}`, start: { local: start[0], tz: start[1] }, end: end ? { local: end[0], tz: end[1] } : undefined, attachments: [] };
}
function trip(homeTz: string, items: Item[], startDate = '2026-12-01', endDate = '2026-12-14'): Trip {
  return { id: 't', name: 'Test', startDate, endDate, homeTz, items, createdAt: '2026-10-01T00:00:00Z' };
}

const LON = 'Europe/London';
const TYO = 'Asia/Tokyo';
const NYC = 'America/New_York';
const LAX = 'America/Los_Angeles';

// London -> Tokyo in December (GMT vs JST: +9 h) and back.
const tokyo = trip(LON, [
  item('flight', ['2026-12-01T19:00', LON], ['2026-12-02T15:00', TYO]),
  item('hotel', ['2026-12-02T16:00', TYO], ['2026-12-13T10:00', TYO]),
  item('flight', ['2026-12-13T11:00', TYO], ['2026-12-13T15:00', LON]),
]);

test('helpers: clock strings, shifts folded into ±12 h', () => {
  assert.equal(hm('07:30'), 450);
  assert.equal(hm('24:00'), 1440);
  assert.equal(hm('25:00'), null);
  assert.equal(hm('7:30'), null);
  assert.equal(clock(-60), '23:00');
  assert.equal(clock(1440), '00:00');
  assert.equal(clock(1440, true), '24:00');
  assert.equal(normaliseShift(780), -660);
  assert.equal(normaliseShift(720), 720);
  assert.equal(normaliseShift(-720), 720);
  assert.equal(normaliseShift(-300), -300);
});

test('home zone: the trip’s saved zone, else the phone’s, else UTC', () => {
  assert.equal(homeZone({ homeTz: LON }, NYC), LON);
  assert.equal(homeZone({ homeTz: 'Mars/Base' }, NYC), NYC);
  assert.equal(homeZone({ homeTz: '' }, 'Nope/Zone'), 'UTC');
});

test('zones come from the items’ own IANA zones, in time order, unreadable ones skipped', () => {
  const t = trip(LON, [
    item('flight', ['2026-12-01T10:00', LON], ['2026-12-01T13:00', NYC]),
    item('note', ['2026-12-02T09:00', 'Bad/Zone']),
    item('flight', ['2026-12-05T08:00', NYC], ['2026-12-05T11:00', LAX]),
  ]);
  assert.deepEqual(tripZones(t), [LON, NYC, LAX]);
  assert.deepEqual(tripZones(trip(LON, [])), []);
});

test('east: London to Tokyo gives an earlier-sleep plan and morning-to-midday light', () => {
  const [out, back] = flightLegs(tokyo, LON);
  assert.equal(out.which, 'outbound');
  assert.equal(out.shift, 540);
  assert.equal(out.direction, 'east');
  assert.equal(out.toTz, TYO);
  const p = planFor(out);
  assert.ok(p);
  assert.deepEqual(
    p.before.map((d) => [d.date, d.bed, d.wake]),
    [
      ['2026-11-28', '22:00', '06:00'],
      ['2026-11-29', '21:00', '05:00'],
      ['2026-11-30', '20:00', '04:00'],
    ],
  );
  assert.equal(p.arrival.length, 3);
  assert.deepEqual(p.arrival[0], { date: '2026-12-02', seek: [{ from: '10:00', to: '15:00' }], avoid: [{ from: '07:00', to: '10:00' }] });
  assert.equal(p.arrival[1].seek[0].from, '09:00');
  // and back west
  assert.equal(back.which, 'return');
  assert.equal(back.fromTz, TYO);
  assert.equal(back.shift, -540);
  assert.equal(back.direction, 'west');
  const pb = planFor(back);
  assert.ok(pb);
  assert.deepEqual(pb.before.map((d) => d.bed), ['00:00', '01:00', '02:00']);
  assert.equal(pb.before[2].date, '2026-12-12');
});

test('west: London to Los Angeles moves sleep later and puts light in the evening', () => {
  const t = trip(LON, [item('flight', ['2026-12-01T10:00', LON], ['2026-12-01T13:30', LAX])]);
  const [leg] = flightLegs(t, LON);
  assert.equal(leg.shift, -480);
  assert.equal(leg.direction, 'west');
  const p = planFor(leg);
  assert.ok(p);
  assert.deepEqual(p.before.map((d) => d.moved), [60, 120, 180]);
  assert.deepEqual(p.arrival[0].seek, [{ from: '18:00', to: '23:00' }]);
  assert.deepEqual(p.arrival[0].avoid, []);
  for (const d of p.arrival) for (const r of [...d.seek, ...d.avoid]) assert.ok(r.from >= '07:00' && r.to <= '23:00', JSON.stringify(r));
});

test('over 12 h east is planned as the shorter way west', () => {
  const t = trip(LON, [item('flight', ['2026-12-01T21:00', LON], ['2026-12-03T05:00', 'Pacific/Auckland'])]);
  const [leg] = flightLegs(t, LON);
  assert.equal(leg.shift, -660);
  assert.equal(leg.direction, 'west');
});

test('under 3 h gives no plan (demo trip Sydney to Tokyo is 2 h)', () => {
  const demo = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
  assert.deepEqual(planLegs(demo, demo.homeTz), []);
  const paris = trip(LON, [item('flight', ['2026-12-01T10:00', LON], ['2026-12-01T12:20', 'Europe/Paris'])]);
  assert.deepEqual(planLegs(paris, LON), []);
  const leg: Leg = { which: 'outbound', fromTz: LON, toTz: 'Asia/Dubai', departs: { local: '2026-12-01T10:00', tz: LON }, arrives: { local: '2026-12-01T20:00', tz: 'Asia/Dubai' }, shift: 179, direction: 'east' };
  assert.equal(planFor(leg), null);
  assert.ok(planFor({ ...leg, shift: 180 }));
});

test('trains and buses never make a plan: only flights count', () => {
  const t = trip(LON, [item('train', ['2026-12-01T10:00', LON], ['2026-12-03T12:00', TYO])]);
  assert.deepEqual(planLegs(t, LON), []);
});

test('DST edge: the shift is measured at landing, with each zone’s real offset that day', () => {
  // London left summer time on 25 Oct 2026, New York only on 1 Nov: a 4 h week.
  const oct = trip(LON, [item('flight', ['2026-10-28T10:00', LON], ['2026-10-28T13:00', NYC])]);
  const nov = trip(LON, [item('flight', ['2026-11-05T10:00', LON], ['2026-11-05T13:00', NYC])]);
  assert.equal(flightLegs(oct, LON)[0].shift, -240);
  assert.equal(flightLegs(nov, LON)[0].shift, -300);
  // Moscow has no summer time: 2 h from London in July (no plan), 3 h in December (plan).
  const july = trip(LON, [item('flight', ['2026-07-10T09:00', LON], ['2026-07-10T15:50', 'Europe/Moscow'])]);
  const dec = trip(LON, [item('flight', ['2026-12-10T09:00', LON], ['2026-12-10T15:50', 'Europe/Moscow'])]);
  assert.deepEqual(planLegs(july, LON), []);
  const [p] = planLegs(dec, LON);
  assert.equal(p.leg.shift, 180);
  assert.equal(p.before.length, 3);
  assert.equal(p.arrival.length, 0);
  assert.equal(p.settled, true);
});

test('a connection counts as one journey from the first flight', () => {
  const t = trip(LON, [
    item('flight', ['2026-12-01T21:00', LON], ['2026-12-02T07:00', 'Asia/Dubai']),
    item('flight', ['2026-12-02T09:30', 'Asia/Dubai'], ['2026-12-03T06:00', 'Australia/Sydney']),
    item('hotel', ['2026-12-03T14:00', 'Australia/Sydney'], ['2026-12-10T10:00', 'Australia/Sydney']),
  ]);
  const [leg] = flightLegs(t, LON);
  assert.equal(leg.departs.local, '2026-12-01T21:00');
  assert.equal(leg.toTz, 'Australia/Sydney');
  assert.equal(leg.shift, 660);
  assert.equal(planFor(leg)?.before[2].date, '2026-11-30');
});

test('call windows: both clocks within 08:00–22:00, across a DST change, and honestly none', () => {
  const before = callWindows(LON, NYC, '2026-10-24');
  assert.deepEqual(before.map((w) => [w.home, w.there]), [[{ from: '13:00', to: '22:00' }, { from: '08:00', to: '17:00' }]]);
  // 25 Oct: London's clocks go back at 02:00, New York's not yet, so the gap is 4 h for the rest of the day.
  const change = callWindows(LON, NYC, '2026-10-25');
  assert.deepEqual(change.map((w) => [w.home, w.there]), [[{ from: '12:00', to: '22:00' }, { from: '08:00', to: '18:00' }]]);
  // 11 h apart in July (BST vs NZST): two short windows, one each end of the home day.
  const far = callWindows(LON, 'Pacific/Auckland', '2026-07-01');
  assert.deepEqual(far.map((w) => [w.home, w.there]), [
    [{ from: '08:00', to: '11:00' }, { from: '19:00', to: '22:00' }],
    [{ from: '21:00', to: '22:00' }, { from: '08:00', to: '09:00' }],
  ]);
  // half-hour zone
  const india = callWindows(LON, 'Asia/Kolkata', '2026-12-01');
  assert.deepEqual(india.map((w) => w.home), [{ from: '08:00', to: '16:30' }]);
  // working hours London vs Sydney: no overlap at all
  assert.deepEqual(callWindows(LON, 'Australia/Sydney', '2026-12-01', WORKING), []);
  assert.deepEqual(callWindows(LON, 'Bad/Zone', '2026-12-01'), []);
  // same zone: the whole 08:00–22:00
  assert.deepEqual(callWindows(LON, LON, '2026-12-01').map((w) => w.home), [{ from: '08:00', to: '22:00' }]);
});

test('windowNow finds the window the moment falls in', () => {
  const ws = callWindows(LON, NYC, '2026-12-01');
  assert.equal(windowNow(ws, toUtc({ local: '2026-12-01T15:00', tz: LON })), ws[0]);
  assert.equal(windowNow(ws, toUtc({ local: '2026-12-01T09:00', tz: LON })), null);
});

test('here vs destination: the second clock follows the bookings during the trip', () => {
  const before = toUtc({ local: '2026-11-20T12:00', tz: LON });
  const during = toUtc({ local: '2026-12-05T12:00', tz: TYO });
  const inAir = toUtc({ local: '2026-12-01T23:00', tz: LON });
  assert.deepEqual(thereZone(tokyo, LON, before), { tz: TYO, kind: 'destination' });
  assert.deepEqual(thereZone(tokyo, LON, during), { tz: TYO, kind: 'here' });
  assert.equal(zoneAt(tokyo, inAir), LON);
  assert.equal(zoneAt(tokyo, before), null);
  const home = trip(LON, [item('hotel', ['2026-12-01T15:00', LON], ['2026-12-03T10:00', LON])]);
  assert.equal(thereZone(home, LON, during), null);
});

test('jetLagView puts it together and stays empty for a trip at home', () => {
  const v = jetLagView(tokyo, NYC, toUtc({ local: '2026-11-20T12:00', tz: LON }));
  assert.ok(v);
  assert.equal(v.home, LON);
  assert.equal(v.there?.tz, TYO);
  assert.equal(v.diffNow, 540);
  assert.equal(v.plans.length, 2);
  assert.equal(jetLagView(trip(LON, [item('activity', ['2026-12-01T10:00', LON])]), LON, Date.now()), null);
});

test('strings: every plan carries the disclaimer and the copy makes no medical claims', async () => {
  const { en } = await import('../i18n/en.ts');
  const all = Object.entries(en).filter(([k]) => k.startsWith('jetlag.'));
  assert.ok(all.length > 20);
  assert.equal(en['jetlag.plan.disclaimer'], 'General guidance, not medical advice.');
  for (const [k, v] of all) assert.doesNotMatch(v, /melatonin|pill|tablet|medicat|cure|prevent|treat|guarantee|sleeping aid/i, k);
});
