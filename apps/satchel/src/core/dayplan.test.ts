import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addPlaceToDay,
  canMoveStop,
  dayPlan,
  dayPlanRow,
  importDayPlans,
  legBetween,
  legUrl,
  LEAVE_MARGIN_MIN,
  LONG_WALK_M,
  moveStop,
  nearestNeighbour,
  pathLength,
  placesToAdd,
  planDays,
  readDayPlans,
  readFileDayPlans,
  removePlaceFromDay,
  resetDayOrder,
  twoOpt,
  wakeUpHotel,
} from './dayplan.ts';
import type { Idea } from './ideas.ts';
import type { Item, SavedPlace, Trip } from './model.ts';
import { haversineMeters } from './poi.ts';
import { appleMapsWalkUrl } from './toilets.ts';
import { fromUtc, toUtc } from './tz.ts';
import { DETOUR, walkTime } from './wayback.ts';

const DAY = '2027-04-03';
const TZ = 'Asia/Tokyo';
const H = { lat: 35.7, lon: 139.7 };
// About 900 m per 0.01 degree of longitude here, 1.1 km per 0.01 of latitude.
const at = (dLat: number, dLon: number) => ({ lat: H.lat + dLat, lon: H.lon + dLon });

const hotel = (id = 'h1', from = '2027-04-01T15:00', to = '2027-04-05T11:00', p = H): Item => ({
  id,
  tripId: 't',
  kind: 'hotel',
  title: `Hotel ${id}`,
  start: { local: from, tz: TZ },
  end: { local: to, tz: TZ },
  place: { id: `p-${id}`, name: `Hotel ${id}`, ...p },
  attachments: [],
});
const activity = (id: string, local: string, p: { lat: number; lon: number }, tz = TZ): Item => ({
  id,
  tripId: 't',
  kind: 'activity',
  title: `Booking ${id}`,
  start: { local, tz },
  place: { id: `p-${id}`, name: `Place ${id}`, ...p },
  attachments: [],
});
const idea = (id: string, p: { lat: number; lon: number } | null, day = DAY, extra: Partial<Idea> = {}): Idea => ({
  id,
  name: `Idea ${id}`,
  category: 'see',
  ...(p ? p : {}),
  day,
  createdAt: `2027-03-01T00:00:0${id.length % 10}.000Z`,
  ...extra,
});
const trip = (items: Item[], ideas: Idea[] = [], extra: Partial<Trip> = {}): Trip => ({
  id: 't',
  name: 'Tokyo',
  startDate: '2027-04-01',
  endDate: '2027-04-05',
  homeTz: 'Australia/Sydney',
  items,
  ideas,
  createdAt: '2027-01-01T00:00:00.000Z',
  ...extra,
});
const keys = (t: Trip, opts = {}) => dayPlan(t, DAY, opts).stops.map((s) => s.key);

// ---- empty and one-stop days ----

test('empty day: no stops, no walking, still starts from the hotel', () => {
  const p = dayPlan(trip([hotel()]), DAY);
  assert.deepEqual(p.stops, []);
  assert.equal(p.walkM, 0);
  assert.equal(p.minutes, 0);
  assert.equal(p.start?.kind, 'hotel');
  assert.equal(p.manual, false);
});

test('one-stop day: one leg from the hotel; without a start point the stop has no leg', () => {
  const p = dayPlan(trip([hotel()], [idea('a', at(0, 0.01))]), DAY);
  assert.equal(p.stops.length, 1);
  assert.equal(p.stops[0]!.n, 1);
  assert.ok(p.stops[0]!.leg);
  assert.equal(p.stops[0]!.leg!.from.name, 'Hotel h1');
  assert.equal(p.minutes, p.stops[0]!.leg!.minutes);
  const none = dayPlan(trip([], [idea('a', at(0, 0.01))]), DAY);
  assert.equal(none.start, null);
  assert.equal(none.stops[0]!.leg, undefined);
  assert.equal(none.walkM, 0);
});

test('ideas without a spot and bookings without a position are listed, not routed', () => {
  const noPos: Item = { ...activity('x', `${DAY}T10:00`, H), place: { id: 'p', name: 'Somewhere' } };
  const p = dayPlan(trip([noPos], [idea('a', null)]), DAY);
  assert.deepEqual(p.stops, []);
  assert.deepEqual(p.unplaced.ideas, [{ id: 'a', name: 'Idea a' }]);
  assert.deepEqual(p.unplaced.bookings, [{ id: 'x', title: 'Booking x' }]);
});

// ---- start point ----

test('start point: the hotel you wake up in (not the one you check into that day), else where you are', () => {
  const a = hotel('a', '2027-04-01T15:00', '2027-04-03T10:00', at(0, 0));
  const b = hotel('b', '2027-04-03T15:00', '2027-04-05T10:00', at(0.02, 0.02));
  const t = trip([a, b]);
  assert.equal(wakeUpHotel(t, '2027-04-01'), null, 'check-in day: not there yet');
  assert.equal(wakeUpHotel(t, '2027-04-02')?.itemId, 'a');
  assert.equal(wakeUpHotel(t, DAY)?.itemId, 'a', 'check-out day: you wake up in a');
  assert.equal(wakeUpHotel(t, '2027-04-04')?.itemId, 'b');
  const here = at(0.05, 0.05);
  const p = dayPlan(t, DAY, { here });
  assert.equal(p.start?.kind, 'here');
  assert.equal(p.hotel?.itemId, 'a', 'the hotel is still offered');
  assert.equal(dayPlan(t, DAY, { here: { lat: 999, lon: 0 } }).start?.kind, 'hotel', 'an unreadable position is ignored');
});

test('starting point changes the order: the nearest stop comes first', () => {
  const t = trip([hotel()], [idea('near', at(0, 0.005)), idea('far', at(0, 0.03))]);
  assert.deepEqual(keys(t), ['idea:near', 'idea:far']);
  assert.deepEqual(keys(t, { here: at(0, 0.035) }), ['idea:far', 'idea:near']);
});

// ---- ordering with anchors ----

test('timed bookings stay in time order and untimed stops go where they add least walking', () => {
  // Hotel -> lunch due east; "before" sits on the way, "after" beyond lunch.
  const lunch = activity('lunch', `${DAY}T12:00`, at(0, 0.02));
  const show = activity('show', `${DAY}T18:00`, at(0, 0.04));
  const t = trip([hotel(), show, lunch], [idea('after', at(0.001, 0.03)), idea('before', at(0.001, 0.01))]);
  const p = dayPlan(t, DAY);
  assert.deepEqual(p.stops.map((s) => s.key), ['idea:before', 'lunch:place', 'idea:after', 'show:place']);
  assert.deepEqual(p.stops.map((s) => s.n), [1, 2, 3, 4]);
  assert.equal(p.stops[1]!.time, '12:00');
});

test('nothing is planned while you are on a journey: no stops between a departure and its arrival', () => {
  const train: Item = {
    id: 'tr',
    tripId: 't',
    kind: 'train',
    title: 'Train',
    start: { local: `${DAY}T10:00`, tz: TZ },
    end: { local: `${DAY}T12:00`, tz: TZ },
    from: { id: 'f', name: 'Station A', ...at(0, 0.01) },
    to: { id: 'g', name: 'Station B', ...at(0.3, 0.3) },
    attachments: [],
  };
  // An idea right between the stations would be cheapest "in transit"; it must go before or after instead.
  const t = trip([hotel(), train], [idea('mid', at(0.15, 0.15))]);
  const p = dayPlan(t, DAY);
  const k = p.stops.map((s) => s.key);
  assert.notEqual(k.indexOf('idea:mid'), k.indexOf('tr:from') + 1);
  const arrive = p.stops.find((s) => s.key === 'tr:to')!;
  assert.equal(arrive.leg?.ride, true, 'the train leg is travelled, not walked');
  assert.equal(arrive.leave, undefined, 'no leave-by for an arrival');
  // Departing with no arrival that day: nothing after it.
  const flight: Item = { ...train, id: 'fl', kind: 'flight', end: { local: '2027-04-04T08:00', tz: 'Europe/London' } };
  const f = dayPlan(trip([hotel(), flight], [idea('x', at(0, 0.02))]), DAY);
  assert.deepEqual(f.stops.map((s) => s.key), ['idea:x', 'fl:from']);
});

test('2-opt untangles a crossed route', () => {
  const A = at(0, 0);
  const B = at(0, 0.02);
  const C = at(0.01, 0.02);
  const D = at(0.01, 0);
  const crossed = [A, C, B, D];
  const order = twoOpt(crossed, true, false);
  const after = order.map((i) => crossed[i]!);
  assert.ok(pathLength(after) < pathLength(crossed) - 100);
  // As short as the best order with A first (checked by trying them all).
  const perms = [[B, C, D], [B, D, C], [C, B, D], [C, D, B], [D, B, C], [D, C, B]].map((r) => pathLength([A, ...r]));
  assert.ok(Math.abs(pathLength(after) - Math.min(...perms)) < 1);
  assert.equal(order[0], 0, 'fixed start stays first');
  // A fixed end stays last too.
  const o2 = twoOpt([A, C, B, D], true, true);
  assert.equal(o2[0], 0);
  assert.equal(o2[3], 3);
});

test('nearest neighbour picks the closest next stop; without a start it tries every first stop', () => {
  const pts = [at(0, 0.03), at(0, 0.01), at(0, 0.02)];
  assert.deepEqual(nearestNeighbour(pts, H), [1, 2, 0]);
  const open = nearestNeighbour(pts, null).map((i) => pts[i]!);
  assert.ok(Math.abs(pathLength(open) - haversineMeters(pts[1]!, pts[0]!)) < 1);
});

test('the suggested order is never longer than the stops in the order they were planned', () => {
  const ideas = [idea('a', at(0.01, 0.03)), idea('b', at(0, 0.005)), idea('c', at(0.012, 0.01)), idea('d', at(0.002, 0.025)), idea('e', at(0.006, 0.0))];
  const t = trip([hotel()], ideas);
  const p = dayPlan(t, DAY);
  const planned = pathLength([H, ...ideas.map((i) => ({ lat: i.lat!, lon: i.lon! }))]);
  assert.ok(pathLength([H, ...p.stops]) <= planned + 1e-6);
});

// ---- legs ----

test('leg maths: straight line, x1.3 on foot, walking minutes; same spot is 0; long legs flagged', () => {
  const a = { ...at(0, 0), name: 'A' };
  const b = { ...at(0, 0.01), name: 'B' };
  const leg = legBetween(a, b);
  const straight = haversineMeters(a, b);
  assert.ok(Math.abs(leg.straightM - straight) < 1e-6);
  assert.ok(Math.abs(leg.walkM - straight * 1.3) < 1e-6);
  assert.equal(DETOUR, 1.3);
  assert.equal(leg.minutes, walkTime(straight)!.minutes);
  assert.equal(leg.minutes, Math.round((straight * 1.3) / 80));
  assert.equal(leg.long, false);
  const same = legBetween(a, { ...at(0.0001, 0), name: 'A2' });
  assert.equal(same.same, true);
  assert.equal(same.minutes, 0);
  assert.equal(same.walkM, 0);
  const far = legBetween(a, { ...at(0, 0.06), name: 'Far' });
  assert.ok(far.walkM > LONG_WALK_M);
  assert.equal(far.long, true);
  assert.equal(legUrl(leg), appleMapsWalkUrl(b.lat, b.lon, 'B', a));
  assert.match(legUrl(leg), /saddr=35\.7,139\.7&daddr=35\.7,139\.71&dirflg=w&q=B$/);
});

test('totals add the walking legs only', () => {
  const p = dayPlan(trip([hotel()], [idea('a', at(0, 0.01)), idea('b', at(0, 0.02))]), DAY);
  const legs = p.stops.map((s) => s.leg!);
  assert.ok(Math.abs(p.walkM - legs.reduce((m, l) => m + l.walkM, 0)) < 1e-6);
  assert.equal(p.minutes, legs.reduce((m, l) => m + l.minutes, 0));
});

// ---- leave by ----

test('a stop too far to walk gets no walking leave-by and stays out of the walking total', () => {
  const far = activity('far', `${DAY}T12:00`, at(0, 0.2));
  const near = activity('near', `${DAY}T15:00`, at(0, 0.21));
  const p = dayPlan(trip([hotel(), far, near]), DAY);
  assert.equal(p.stops[0]!.leg!.long, true);
  assert.equal(p.stops[0]!.leave, undefined);
  assert.equal(p.longLegs, 1);
  assert.ok(Math.abs(p.walkM - p.stops[1]!.leg!.walkM) < 1e-6);
  assert.equal(p.stops[1]!.leave?.kind, 'walk');
});

test("leave-by before a timed booking: walk time plus a margin, on the booking's own clock", () => {
  const lunch = activity('lunch', `${DAY}T12:00`, at(0, 0.02));
  const p = dayPlan(trip([hotel(), lunch], [idea('a', at(0, 0.01))]), DAY);
  const s = p.stops.find((x) => x.key === 'lunch:place')!;
  const mins = s.leg!.minutes;
  assert.equal(s.leave?.kind, 'walk');
  assert.equal(s.leave?.tz, TZ);
  assert.equal(s.leave?.from, 'Idea a');
  assert.equal(s.leave?.local, fromUtc(toUtc({ local: `${DAY}T12:00`, tz: TZ }) - (mins + LEAVE_MARGIN_MIN) * 60_000, TZ));
  assert.equal(s.leave?.tight, false);
  // An untimed stop has no leave-by.
  assert.equal(p.stops[0]!.leave, undefined);
});

test('leave-by uses the zone of the booking, whatever the zone of the rest of the day', () => {
  const H2 = { lat: 51.5, lon: -0.12 };
  const london: Item = { ...hotel('lh', '2027-03-28T15:00', '2027-03-29T11:00', H2), start: { local: '2027-03-28T15:00', tz: 'Europe/London' }, end: { local: '2027-03-29T11:00', tz: 'Europe/London' } };
  // 28 → 29 March 2027: the UK clocks go forward at 01:00 on the 28th; the booking is at 09:00 on the 29th.
  const tea = activity('tea', '2027-03-29T09:00', { lat: 51.5, lon: -0.1 }, 'Europe/London');
  const t = trip([london, tea], [], { startDate: '2027-03-28', endDate: '2027-03-29' });
  const s = dayPlan(t, '2027-03-29').stops[0]!;
  assert.equal(s.leave?.tz, 'Europe/London');
  const expect = new Date(Date.UTC(2027, 2, 29, 8, 0) - (s.leg!.minutes + LEAVE_MARGIN_MIN) * 60_000);
  assert.equal(s.leave?.local, fromUtc(expect.getTime(), 'Europe/London'));
  assert.equal(s.leave?.local.slice(0, 10), '2027-03-29');
});

test('a leave-by earlier than the booking before it is flagged tight', () => {
  const a = activity('a', `${DAY}T10:00`, at(0, 0));
  const b = activity('b', `${DAY}T10:10`, at(0, 0.03));
  const p = dayPlan(trip([a, b]), DAY);
  assert.equal(p.stops[1]!.leave?.tight, true);
});

test('a flight with an airport travel time uses the airport plan for leave-by', () => {
  const flight: Item = {
    id: 'fl',
    tripId: 't',
    kind: 'flight',
    title: 'Home',
    start: { local: `${DAY}T18:00`, tz: TZ },
    end: { local: '2027-04-04T06:00', tz: 'Australia/Sydney' },
    from: { id: 'f', name: 'Haneda', ...at(-0.15, 0.08) },
    to: { id: 'g', name: 'Sydney', lat: -33.9, lon: 151.2 },
    airport: { travelMin: 60, bufferMin: 120 },
    attachments: [],
  };
  const s = dayPlan(trip([hotel(), flight]), DAY).stops.find((x) => x.key === 'fl:from')!;
  assert.equal(s.leave?.kind, 'airport');
  assert.equal(s.leave?.local, `${DAY}T15:00`);
  assert.equal(s.leave?.tz, TZ);
});

// ---- moving stops ----

test('Move up / Move down: stops pass each other and bookings; the order is stored and kept; reset goes back', () => {
  const lunch = activity('lunch', `${DAY}T12:00`, at(0, 0.02));
  const t0 = trip([hotel(), lunch], [idea('a', at(0, 0.005)), idea('b', at(0, 0.01))]);
  const p0 = dayPlan(t0, DAY);
  assert.deepEqual(p0.stops.map((s) => s.key), ['idea:a', 'idea:b', 'lunch:place']);
  assert.deepEqual(canMoveStop(p0, 'idea:a'), { up: false, down: true });
  assert.deepEqual(canMoveStop(p0, 'lunch:place'), { up: false, down: false }, 'bookings never move');
  const t1 = moveStop(t0, p0, 'idea:a', 1, 'now');
  const p1 = dayPlan(t1, DAY);
  assert.deepEqual(p1.stops.map((s) => s.key), ['idea:b', 'idea:a', 'lunch:place']);
  assert.equal(p1.manual, true);
  // Past the booking: into the afternoon.
  const t2 = moveStop(t1, p1, 'idea:a', 1, 'now');
  const p2 = dayPlan(t2, DAY);
  assert.deepEqual(p2.stops.map((s) => s.key), ['idea:b', 'lunch:place', 'idea:a']);
  assert.deepEqual(canMoveStop(p2, 'idea:a'), { up: true, down: false });
  assert.equal(moveStop(t2, p2, 'idea:a', 1), t2, 'already last: unchanged');
  // A new idea planned later joins the stored order where it adds least walking.
  const t3 = { ...t2, ideas: [...(t2.ideas ?? []), idea('c', at(0, 0.003))] };
  assert.deepEqual(keys(t3), ['idea:c', 'idea:b', 'lunch:place', 'idea:a']);
  const back = resetDayOrder(t2, DAY);
  assert.equal(dayPlan(back, DAY).manual, false);
  assert.deepEqual(keys(back), ['idea:a', 'idea:b', 'lunch:place']);
  assert.equal(back.dayPlans, undefined, 'an empty row is removed');
});

test('moving never puts a stop between a departure and its arrival', () => {
  const train: Item = {
    id: 'tr',
    tripId: 't',
    kind: 'train',
    title: 'Train',
    start: { local: `${DAY}T10:00`, tz: TZ },
    end: { local: `${DAY}T12:00`, tz: TZ },
    from: { id: 'f', name: 'A', ...at(0, 0.01) },
    to: { id: 'g', name: 'B', ...at(0, 0.03) },
    attachments: [],
  };
  const t = trip([hotel(), train], [idea('x', at(0, 0.005))]);
  const p = dayPlan(t, DAY);
  assert.deepEqual(p.stops.map((s) => s.key), ['idea:x', 'tr:from', 'tr:to']);
  const moved = dayPlan(moveStop(t, p, 'idea:x', 1), DAY);
  assert.deepEqual(moved.stops.map((s) => s.key), ['tr:from', 'tr:to', 'idea:x']);
});

// ---- saved places ----

const sp = (id: string, p: { lat: number; lon: number }): SavedPlace => ({ id, name: `Saved ${id}`, ...p, savedAt: '2027-03-01T00:00:00.000Z' });

test('saved places can be added to a day and taken off again', () => {
  const t0 = trip([hotel()], [], { places: [sp('s1', at(0, 0.01)), sp('s2', at(0, 0.02))] });
  assert.deepEqual(placesToAdd(t0, DAY).map((p) => p.id), ['s1', 's2']);
  const t1 = addPlaceToDay(t0, DAY, 's2', 'now');
  assert.deepEqual(keys(t1), ['place:s2']);
  assert.deepEqual(placesToAdd(t1, DAY).map((p) => p.id), ['s1']);
  assert.equal(addPlaceToDay(t1, DAY, 's2'), t1, 'already there');
  assert.equal(addPlaceToDay(t1, DAY, 'nope'), t1, 'not a saved place');
  assert.deepEqual(keys(t1, {}), ['place:s2']);
  assert.deepEqual(dayPlan(t1, '2027-04-04').stops, [], 'only on that day');
  const t2 = removePlaceFromDay(t1, DAY, 's2');
  assert.deepEqual(keys(t2), []);
  assert.equal(t2.dayPlans, undefined);
  // A deleted saved place just drops off the plan.
  assert.deepEqual(keys({ ...t1, places: [] }), []);
});

// ---- stored data and files ----

test('day plans are read defensively and fields this build does not know are kept', () => {
  const rows = readDayPlans({
    dayPlans: [
      { day: DAY, places: [{ placeId: 's1' }, { placeId: 's1' }, { nope: 1 }], order: [{ ideaId: 'a' }, { itemId: 'h', role: 'boat' }, 7], extra: 'kept' },
      { day: DAY, places: [{ placeId: 'dupe-day' }] },
      { day: 'not a day', places: [{ placeId: 's' }] },
      { day: '2027-04-04' },
      'junk',
    ] as unknown as Trip['dayPlans'],
  });
  assert.deepEqual(rows, [{ day: DAY, places: [{ placeId: 's1' }], order: [{ ideaId: 'a' }], extra: 'kept' } as unknown as (typeof rows)[number]]);
  assert.deepEqual(readDayPlans({}), []);
  assert.equal(readFileDayPlans('nope'), undefined);
  assert.equal(readFileDayPlans([]), undefined);
});

test('importing remaps every id and leaves out references to things not imported', () => {
  const rows = importDayPlans(
    [
      { day: DAY, places: [{ placeId: 's1' }, { placeId: 'gone' }], order: [{ ideaId: 'a' }, { itemId: 'h', role: 'place' }, { placeId: 's1' }, { ideaId: 'gone' }] },
      { day: '2027-04-04', order: [{ ideaId: 'gone' }] },
    ],
    { ideas: new Map([['a', 'A']]), items: new Map([['h', 'H']]), places: new Map([['s1', 'S1']]) },
  );
  assert.deepEqual(rows, [{ day: DAY, places: [{ placeId: 'S1' }], order: [{ ideaId: 'A' }, { itemId: 'H', role: 'place' }, { placeId: 'S1' }] }]);
  assert.equal(importDayPlans(undefined, { ideas: new Map(), items: new Map(), places: new Map() }), undefined);
});

test('planDays: the timeline days with the ones either side', () => {
  const t = trip([]);
  assert.deepEqual(planDays(t, DAY), { days: ['2027-04-01', '2027-04-02', DAY, '2027-04-04', '2027-04-05'], prev: '2027-04-02', next: '2027-04-04' });
  assert.equal(planDays(t, '2027-04-01').prev, null);
  assert.equal(planDays(t, '2027-04-05').next, null);
});

test('dayPlanRow finds the stored row for a day', () => {
  const t = addPlaceToDay(trip([], [], { places: [sp('s1', H)] }), DAY, 's1', 'now');
  assert.deepEqual(dayPlanRow(t, DAY), { day: DAY, places: [{ placeId: 's1' }], updatedAt: 'now' });
});

// ---- strings ----

test('every Plan my day string is in src/i18n/en/dayplan.ts, prefixed dayplan.', async () => {
  const { readFileSync } = await import('node:fs');
  const { dayplan } = await import('../i18n/en/dayplan.ts');
  const root = new URL('../../', import.meta.url);
  for (const k of Object.keys(dayplan)) assert.match(k, /^dayplan\./);
  for (const f of ['app/dayplan/[tripId].tsx', 'src/ui/PlanDayButton.tsx']) {
    const src = readFileSync(new URL(f, root), 'utf8');
    for (const [, k] of src.matchAll(/'(dayplan\.[A-Za-z.]+)'/g)) assert.ok(k! in dayplan, `${f}: ${k} missing from the catalogue`);
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${f}: raw colour`);
  }
});
