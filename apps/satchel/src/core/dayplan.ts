// T98 "Plan my day" (owner-1031 D): for one trip day, the day's timed bookings that have a map position stay where
// their times put them (anchors), and the day's untimed stops (ideas planned for that day with a map spot, plus
// saved places the traveller added to the day) are fitted between them as a short walking route: each stop goes to
// the gap between anchors where it adds the least walking, then each gap is ordered nearest-neighbour first and
// improved with 2-opt. The walk starts from the hotel the traveller wakes up in that day, or from a single
// position check ("Start from where I am", never stored). Every leg has a straight-line distance, a walking
// distance (straight line x 1.3, the same detour the Find my way back screen uses) and a walking time at 4.8 km/h,
// all labelled approximate. Before each timed booking reached on foot there is a "leave by" time on that booking's
// own clock (a flight with an airport travel time uses the airport plan from leaveby.ts instead).
// The traveller can move untimed stops up / down (past a booking too). That order, and the saved places added to a
// day, are the only things stored: optional trip.dayPlans, read defensively, carried in .satchel files with every
// id remapped. Without a stored order the suggested order is worked out fresh each time. Pure TS, no RN imports.
// T100: an optional last leg back to the hotel the traveller sleeps in that night (DayPlanRow.backToHotel, per day),
// and a "does it fit" check between timed bookings: the walking time plus STOP_VISIT_MIN per untimed stop against
// the time between them (the earlier booking's end time when it has one on that day).
// T104: each untimed stop's length can be set (DayPlanRow.stays, per day, STAY_STEP_MIN steps); a stop without one
// counts STOP_VISIT_MIN (30 min) as before.
import { ideaDayKeys, ideaSpot, ideasOn, type IdeaCategory } from './ideas.ts';
import { airportPlan, DEFAULT_AIRPORT_PREFS, type AirportPrefs } from './leaveby.ts';
import type { Item, ItemKind, LocalDate, LocalDateTime, Trip } from './model.ts';
import { savedPlaces } from './places.ts';
import { haversineMeters, validLatLon, type LatLon } from './poi.ts';
import { appleMapsWalkUrl } from './toilets.ts';
import { tripRoute } from './triproute.ts';
import { fromUtc, isLocalDateTime, isValidZone, localDate, toUtc } from './tz.ts';
import { ARRIVED_M, DETOUR, walkTime } from './wayback.ts';

// ---------------------------------------------------------------------------------------------- stored order

/** Which booking place an anchor is: its own place, or a journey's departure / arrival. */
export type AnchorRole = 'place' | 'from' | 'to';
/** One entry of a stored day order: an idea, a saved place, or a booking anchor (kept so a stop's gap is known). */
export type DayPlanRef = { ideaId: string } | { placeId: string } | { itemId: string; role: AnchorRole };
/** A saved place added to the day's plan. */
export type DayPlanPlace = { placeId: string };
/** T104: how long the traveller means to spend at an untimed stop that day (minutes). */
export type DayPlanStay = ({ ideaId: string } | { placeId: string }) & { min: number };
/**
 * trip.dayPlans row. `places`: saved places added to this day. `order`: the traveller's own order (Move up / Move
 * down); absent means the suggested order. Fields this build doesn't know are kept.
 */
export type DayPlanRow = {
  day: LocalDate;
  places?: DayPlanPlace[];
  order?: DayPlanRef[];
  /** T100: end the day with a walk back to the hotel slept in that night. Absent: off. */
  backToHotel?: true;
  /** T104: stop lengths the traveller set (a stop without one counts STOP_VISIT_MIN). */
  stays?: DayPlanStay[];
  updatedAt?: string;
};

/** A row worth keeping: it adds places, stores an order or turns on the walk back to the hotel. */
const rowHasData = (r: DayPlanRow | null | undefined): boolean =>
  !!r && (!!r.places?.length || !!r.order?.length || r.backToHotel === true || !!r.stays?.length);

/** Rows / refs a trip (or file) may carry; extra ones are left out. */
export const MAX_DAY_PLANS = 400;
export const MAX_PLAN_REFS = 200;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isId = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200;
const isDay = (x: unknown): x is LocalDate => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);
const ROLES: readonly AnchorRole[] = ['place', 'from', 'to'];

function readRef(x: unknown): DayPlanRef | null {
  if (!isObj(x)) return null;
  if (isId(x.ideaId)) return { ideaId: x.ideaId };
  if (isId(x.placeId)) return { placeId: x.placeId };
  if (isId(x.itemId) && ROLES.includes(x.role as AnchorRole)) return { itemId: x.itemId, role: x.role as AnchorRole };
  return null;
}

function readRow(x: unknown): DayPlanRow | null {
  if (!isObj(x) || !isDay(x.day)) return null;
  const { places, order, updatedAt, backToHotel, stays, ...rest } = x;
  const out = { ...rest, day: x.day } as DayPlanRow;
  if (Array.isArray(places)) {
    const seen = new Set<string>();
    const list: DayPlanPlace[] = [];
    for (const p of places.slice(0, MAX_PLAN_REFS)) {
      if (!isObj(p) || !isId(p.placeId) || seen.has(p.placeId)) continue;
      seen.add(p.placeId);
      list.push({ placeId: p.placeId });
    }
    if (list.length) out.places = list;
  }
  if (Array.isArray(order)) {
    const list = order.slice(0, MAX_PLAN_REFS).map(readRef).filter((r): r is DayPlanRef => r !== null);
    if (list.length) out.order = list;
  }
  if (backToHotel === true) out.backToHotel = true;
  if (Array.isArray(stays)) {
    const seen = new Set<string>();
    const list: DayPlanStay[] = [];
    for (const st of stays.slice(0, MAX_PLAN_REFS)) {
      const ref = readRef(st);
      if (!ref || 'itemId' in ref || !isObj(st) || !validStay(st.min)) continue;
      const k = keyOfRef(ref);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push({ ...ref, min: st.min });
    }
    if (list.length) out.stays = list;
  }
  if (typeof updatedAt === 'string') out.updatedAt = updatedAt;
  return rowHasData(out) ? out : null;
}

/** The trip's day plans, read defensively (absent on older trips; unreadable rows skipped; one row per day). */
export function readDayPlans(trip: Pick<Trip, 'dayPlans'>): DayPlanRow[] {
  const list = (trip as { dayPlans?: unknown }).dayPlans;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: DayPlanRow[] = [];
  for (const raw of list.slice(0, MAX_DAY_PLANS)) {
    const row = readRow(raw);
    if (!row || seen.has(row.day)) continue;
    seen.add(row.day);
    out.push(row);
  }
  return out;
}

export const dayPlanRow = (trip: Trip, day: LocalDate): DayPlanRow | undefined => readDayPlans(trip).find((r) => r.day === day);

/** The trip with `day`'s row changed by `edit` (null removes it); an empty list removes the field. */
function withRow(trip: Trip, day: LocalDate, edit: (row: DayPlanRow) => DayPlanRow | null): Trip {
  const rows = readDayPlans(trip);
  const i = rows.findIndex((r) => r.day === day);
  const next = edit(i < 0 ? { day } : rows[i]!);
  const keep = rowHasData(next) ? next : null;
  const list = i < 0 ? (keep ? [...rows, keep] : rows) : keep ? rows.map((r, n) => (n === i ? keep : r)) : rows.filter((_, n) => n !== i);
  const { dayPlans: _d, ...rest } = trip;
  return list.length ? { ...rest, dayPlans: list } : (rest as Trip);
}

/** Adds a saved place to the day's plan (no change when it is already there or isn't a saved place of the trip). */
export function addPlaceToDay(trip: Trip, day: LocalDate, placeId: string, now = new Date().toISOString()): Trip {
  if (!isDay(day) || !savedPlaces(trip).some((p) => p.id === placeId)) return trip;
  if (dayPlanRow(trip, day)?.places?.some((p) => p.placeId === placeId)) return trip;
  return withRow(trip, day, (r) => ({ ...r, places: [...(r.places ?? []), { placeId }], updatedAt: now }));
}

/** Takes a saved place off the day's plan (and out of its stored order). */
export function removePlaceFromDay(trip: Trip, day: LocalDate, placeId: string, now = new Date().toISOString()): Trip {
  const row = dayPlanRow(trip, day);
  if (!row?.places?.some((p) => p.placeId === placeId)) return trip;
  return withRow(trip, day, (r) => {
    const { places, order, stays, ...rest } = r;
    const p = (places ?? []).filter((x) => x.placeId !== placeId);
    const o = (order ?? []).filter((x) => !('placeId' in x && x.placeId === placeId));
    const st = (stays ?? []).filter((x) => !('placeId' in x && x.placeId === placeId));
    return { ...rest, ...(p.length ? { places: p } : {}), ...(o.length ? { order: o } : {}), ...(st.length ? { stays: st } : {}), updatedAt: now };
  });
}

/** Back to the suggested order (the day's added places stay). */
export function resetDayOrder(trip: Trip, day: LocalDate, now = new Date().toISOString()): Trip {
  if (!dayPlanRow(trip, day)?.order) return trip;
  return withRow(trip, day, (r) => {
    const { order: _o, ...rest } = r;
    return { ...rest, updatedAt: now };
  });
}

/** T100: turns the walk back to the hotel at the end of `day` on or off (remembered for that day only). */
export function setBackToHotel(trip: Trip, day: LocalDate, on: boolean, now = new Date().toISOString()): Trip {
  if (!isDay(day) || (dayPlanRow(trip, day)?.backToHotel === true) === on) return trip;
  return withRow(trip, day, (r) => {
    const { backToHotel: _b, ...rest } = r;
    return { ...rest, ...(on ? { backToHotel: true as const } : {}), updatedAt: now };
  });
}

/** T104: shortest and longest stop length the traveller can set, and the step of the - / + buttons (minutes). */
export const STAY_MIN = 15;
export const STAY_MAX = 480;
export const STAY_STEP_MIN = 15;
function validStay(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= STAY_MIN && x <= STAY_MAX && x % STAY_STEP_MIN === 0;
}

/** T104: the next length for a stop's - / + button (null when it can't go further that way). */
export function stepStay(min: number, dir: -1 | 1): number | null {
  const next = Math.round(min / STAY_STEP_MIN) * STAY_STEP_MIN + dir * STAY_STEP_MIN;
  return next < STAY_MIN || next > STAY_MAX ? null : next;
}

/**
 * T104: sets how long the traveller means to spend at an untimed stop (`idea:<id>` / `place:<id>`) on `day`.
 * STOP_VISIT_MIN (the default) clears it; an invalid length or a booking key leaves the trip unchanged.
 */
export function setStopStay(trip: Trip, day: LocalDate, key: string, min: number, now = new Date().toISOString()): Trip {
  const ref: { ideaId: string } | { placeId: string } | null = key.startsWith('idea:') ? { ideaId: key.slice(5) } : key.startsWith('place:') ? { placeId: key.slice(6) } : null;
  if (!isDay(day) || !ref || !isId(Object.values(ref)[0]) || !validStay(min)) return trip;
  const row = dayPlanRow(trip, day);
  const current = (row?.stays ?? []).find((x) => keyOfRef(x) === key)?.min ?? STOP_VISIT_MIN;
  if (current === min) return trip;
  return withRow(trip, day, (r) => {
    const { stays, ...rest } = r;
    const others = (stays ?? []).filter((x) => keyOfRef(x) !== key);
    const list = min === STOP_VISIT_MIN ? others : [...others, { ...ref, min }];
    return { ...rest, ...(list.length ? { stays: list } : {}), updatedAt: now };
  });
}

// ------------------------------------------------------------------------------------------------- routing

const dist = (a: LatLon, b: LatLon) => haversineMeters(a, b);

/** Length of a path through the points in order (straight lines, metres). */
export function pathLength(points: readonly LatLon[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += dist(points[i - 1]!, points[i]!);
  return m;
}

/**
 * Nearest-neighbour order of `points` (indices), starting from `from` (not part of the result). Without `from`,
 * every point is tried as the first and the shortest path wins (ties: the earlier point).
 */
export function nearestNeighbour(points: readonly LatLon[], from: LatLon | null): number[] {
  const greedy = (first: LatLon, rest: number[]): number[] => {
    const out: number[] = [];
    const left = rest.slice();
    let at = first;
    while (left.length) {
      let best = 0;
      for (let k = 1; k < left.length; k++) if (dist(at, points[left[k]!]!) < dist(at, points[left[best]!]!)) best = k;
      const [i] = left.splice(best, 1);
      out.push(i!);
      at = points[i!]!;
    }
    return out;
  };
  const all = points.map((_, i) => i);
  if (from) return greedy(from, all);
  let best: number[] = all;
  let bestLen = Infinity;
  for (const i of all) {
    const order = [i, ...greedy(points[i]!, all.filter((j) => j !== i))];
    const len = pathLength(order.map((k) => points[k]!));
    if (len < bestLen - 1e-9) {
      best = order;
      bestLen = len;
    }
  }
  return best;
}

/**
 * 2-opt on a path: reverses stretches while that makes it shorter. `fixedStart` / `fixedEnd` keep the first / last
 * point where it is (a start point or a booking). Returns the new order as indices into `path`.
 */
export function twoOpt(path: readonly LatLon[], fixedStart: boolean, fixedEnd: boolean): number[] {
  let order = path.map((_, i) => i);
  const n = order.length;
  const lo = fixedStart ? 1 : 0;
  const hi = fixedEnd ? n - 2 : n - 1;
  const len = (o: number[]) => pathLength(o.map((k) => path[k]!));
  let best = len(order);
  for (let pass = 0; pass < 50; pass++) {
    let improved = false;
    for (let i = lo; i < hi; i++) {
      for (let j = i + 1; j <= hi; j++) {
        const next = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        const l = len(next);
        if (l < best - 0.01) {
          order = next;
          best = l;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return order;
}

/** Orders a gap's stops between `prev` and `next` (either may be missing): nearest neighbour, then 2-opt. */
function orderGap<P extends LatLon>(stops: readonly P[], prev: LatLon | null, next: LatLon | null): P[] {
  if (stops.length < 2) return stops.slice();
  let first: P[];
  if (prev) first = nearestNeighbour(stops, prev).map((i) => stops[i]!);
  else if (next) first = nearestNeighbour(stops, next).map((i) => stops[i]!).reverse();
  else first = nearestNeighbour(stops, null).map((i) => stops[i]!);
  const path: LatLon[] = [...(prev ? [prev] : []), ...first, ...(next ? [next] : [])];
  const order = twoOpt(path, !!prev, !!next);
  const off = prev ? 1 : 0;
  return order.filter((k) => k >= off && k < off + first.length).map((k) => first[k - off]!);
}

/** Extra walking (metres) for visiting `x` between prev and next. */
function detour(x: LatLon, prev: LatLon | null, next: LatLon | null): number {
  if (prev && next) return dist(prev, x) + dist(x, next) - dist(prev, next);
  if (prev) return dist(prev, x);
  if (next) return dist(x, next);
  return 0;
}

// ---------------------------------------------------------------------------------------------- the plan

export type PlanStopKind = 'booking' | 'idea' | 'place';

/** A stop of the day, numbered 1, 2 … in walking order. */
export type PlanStop = LatLon & {
  /** `${itemId}:${role}` for a booking (as on See on map), `idea:${id}`, `place:${id}`. */
  key: string;
  kind: PlanStopKind;
  /** The place's name. */
  name: string;
  n: number;
  /** Bookings: the booking, which of its places, its title, and when (wall clock 'HH:mm' in `tz`, real instant `at`). */
  itemId?: string;
  role?: AnchorRole;
  itemKind?: ItemKind;
  title?: string;
  time?: string;
  tz?: string;
  /** Real instant (ms); absent when the booking's zone can't be read on this phone. */
  at?: number;
  ideaId?: string;
  category?: IdeaCategory;
  done?: boolean;
  placeId?: string;
  /** T104, untimed stops: minutes the traveller means to spend there (STOP_VISIT_MIN unless set). */
  stayMin?: number;
  /** The way here from the start point or the previous stop; absent for the first stop without a start point. */
  leg?: PlanLeg;
  /** Bookings reached on foot: when to set off. */
  leave?: LeaveBy;
  /** T100, timed bookings after an earlier timed booking: whether the walk and the stops in between fit the time. */
  fit?: GapFit;
};

/**
 * T100 "does it fit": between two timed bookings, the approximate walking minutes plus STOP_VISIT_MIN for each
 * untimed stop in between, against the minutes from the earlier booking (its end when it has one that day) to this
 * one. `ok` false: it can't fit (the screen shows a warning line). `far`: a leg is too far to walk, so the walking
 * time isn't known (not flagged on that account; the leg already suggests transport).
 */
export type GapFit = { ok: boolean; freeMin: number; needMin: number; walkMin: number; stops: number; visitMin: number; far: boolean; after: string };

/** Where the walk starts: the hotel the traveller wakes up in, or where they are now. */
export type StartPoint = LatLon & { kind: 'hotel' | 'here'; name: string; itemId?: string };

export type PlanLeg = {
  from: LatLon & { name: string };
  to: LatLon & { name: string };
  /** Straight line, metres. */
  straightM: number;
  /** Approximate walk: straight line x DETOUR (0 for the same spot). */
  walkM: number;
  /** Approximate minutes on foot (0 for the same spot). */
  minutes: number;
  /** Closer than ARRIVED_M: the same spot. */
  same: boolean;
  /** A journey's own departure -> arrival: travelled, not walked (not in the totals, no directions). */
  ride: boolean;
  /** Longer than LONG_WALK_M on foot: the screen suggests transport; left out of the totals and leave-by. */
  long: boolean;
};

/** "Leave <from> by <local>" on the booking's own clock. `tight`: that is before the previous booking's time. */
export type LeaveBy = { kind: 'walk' | 'airport'; utc: number; local: LocalDateTime; tz: string; from: string; tight: boolean };

export type DayPlan = {
  day: LocalDate;
  start: StartPoint | null;
  /** The hotel the traveller wakes up in that day (offered even while starting from here). */
  hotel: StartPoint | null;
  stops: PlanStop[];
  /** Approximate walking metres and minutes, rides and too-far legs left out. */
  walkM: number;
  minutes: number;
  /** How many legs are too far to walk (left out of the totals). */
  longLegs: number;
  /** The traveller's own order is in use. */
  manual: boolean;
  /** T100: the hotel slept in that night (offered for "Back to hotel" whether it is on or off). */
  night: StartPoint | null;
  /** T100: "Back to hotel" is on for this day. */
  backToHotel: boolean;
  /** T100: the last leg, from the last stop (or the start) back to `night`; only while it is on and possible. */
  back?: PlanLeg;
  /** T100: how many timed gaps can't fit their walk and stops. */
  noFit: number;
  /** Planned ideas without a map spot and bookings of the day without a map position: listed, not routed. */
  unplaced: { ideas: { id: string; name: string }[]; bookings: { id: string; title: string }[] };
};

/** Beyond this (approximate walking metres) a leg is "too far to walk": no walking time in the totals, no leave-by. */
export const LONG_WALK_M = 5000;
/** Leave-by times include this margin (minutes) so you arrive a little early. */
export const LEAVE_MARGIN_MIN = 5;
/** T100: minutes allowed at each untimed stop when checking whether a gap between bookings fits (approximate). T104: the default when the traveller hasn't set a stop's length. */
export const STOP_VISIT_MIN = 30;
/** T100: no walk back to the hotel is offered from further than this (metres, straight line): another city. */
export const BACK_MAX_M = 50_000;
const MIN = 60_000;

/** The hotel the traveller wakes up in on `day`: a stay checked in before that day and checked out on or after it. */
export function wakeUpHotel(trip: Trip, day: LocalDate): StartPoint | null {
  let best: { s: StartPoint; from: string } | null = null;
  for (const it of Array.isArray(trip.items) ? trip.items : []) {
    if (it.kind !== 'hotel' || !it.place || !validLatLon(it.place.lat, it.place.lon)) continue;
    if (typeof it.start?.local !== 'string' || !isLocalDateTime(it.start.local)) continue;
    const from = localDate(it.start.local);
    const to = it.end && typeof it.end.local === 'string' && isLocalDateTime(it.end.local) ? localDate(it.end.local) : from;
    if (!(from < day && day <= to)) continue;
    if (best && best.from >= from) continue;
    best = { from, s: { kind: 'hotel', name: it.place.name?.trim() || it.title, lat: it.place.lat as number, lon: it.place.lon as number, itemId: it.id } };
  }
  return best?.s ?? null;
}

/** T100: the hotel slept in on the night of `day`: checked in on or before that day, checked out after it. */
export function nightHotel(trip: Trip, day: LocalDate): StartPoint | null {
  let best: { s: StartPoint; from: string } | null = null;
  for (const it of Array.isArray(trip.items) ? trip.items : []) {
    if (it.kind !== 'hotel' || !it.place || !validLatLon(it.place.lat, it.place.lon)) continue;
    if (typeof it.start?.local !== 'string' || !isLocalDateTime(it.start.local)) continue;
    if (!it.end || typeof it.end.local !== 'string' || !isLocalDateTime(it.end.local)) continue;
    const from = localDate(it.start.local);
    const to = localDate(it.end.local);
    if (!(from <= day && day < to)) continue;
    // The latest check-in wins (a move to a new hotel that day).
    if (best && best.from > from) continue;
    best = { from, s: { kind: 'hotel', name: it.place.name?.trim() || it.title, lat: it.place.lat as number, lon: it.place.lon as number, itemId: it.id } };
  }
  return best?.s ?? null;
}

function keyOfRef(r: DayPlanRef): string {
  return 'ideaId' in r ? `idea:${r.ideaId}` : 'placeId' in r ? `place:${r.placeId}` : `${r.itemId}:${r.role}`;
}
const refOf = (s: PlanStop): DayPlanRef =>
  s.kind === 'idea' ? { ideaId: s.ideaId! } : s.kind === 'place' ? { placeId: s.placeId! } : { itemId: s.itemId!, role: s.role! };

type Anchor = PlanStop & { kind: 'booking' };

/** The day's bookings with a map position (journeys' departures and arrivals too), in time order. */
function anchorsOf(trip: Trip, day: LocalDate): Anchor[] {
  const route = tripRoute(trip, { transport: true });
  const d = route.days.find((x) => x.date === day);
  if (!d) return [];
  return d.stops
    .filter((s) => s.role !== 'idea')
    .map((s) => {
      const local = `${s.day}T${s.time}`;
      const at = isValidZone(s.tz) && isLocalDateTime(local) ? toUtc({ local, tz: s.tz }) : undefined;
      return {
        key: s.key,
        kind: 'booking' as const,
        name: s.name,
        n: 0,
        lat: s.lat,
        lon: s.lon,
        itemId: s.itemId,
        role: s.role as AnchorRole,
        itemKind: s.kind,
        title: s.title,
        time: s.time,
        tz: s.tz,
        ...(at === undefined ? {} : { at }),
      };
    });
}

/** The day's untimed stops: planned ideas with a map spot, then saved places added to the day. */
function freeStopsOf(trip: Trip, day: LocalDate, row: DayPlanRow | undefined): { stops: PlanStop[]; noSpot: { id: string; name: string }[] } {
  const stops: PlanStop[] = [];
  const noSpot: { id: string; name: string }[] = [];
  const stays = new Map((row?.stays ?? []).map((x) => [keyOfRef(x), x.min]));
  const stayOf = (key: string) => stays.get(key) ?? STOP_VISIT_MIN;
  for (const i of ideasOn(trip, day)) {
    const at = ideaSpot(i);
    if (!at) {
      noSpot.push({ id: i.id, name: i.name });
      continue;
    }
    stops.push({ key: `idea:${i.id}`, kind: 'idea', name: i.name, n: 0, lat: at.lat, lon: at.lon, ideaId: i.id, category: i.category, ...(i.done ? { done: true } : {}), stayMin: stayOf(`idea:${i.id}`) });
  }
  const saved = new Map(savedPlaces(trip).map((p) => [p.id, p]));
  for (const ref of row?.places ?? []) {
    const p = saved.get(ref.placeId);
    if (p) stops.push({ key: `place:${p.id}`, kind: 'place', name: p.name, n: 0, lat: p.lat, lon: p.lon, placeId: p.id, stayMin: stayOf(`place:${p.id}`) });
  }
  return { stops, noSpot };
}

/**
 * Gap g lies before anchors[g] (g = anchors.length: after the last). A gap is "in transit", and gets no stops, right
 * after a journey's departure when the next anchor is that journey's arrival or there is none, and before a first
 * anchor that is an arrival (you are still on the way).
 */
function blockedGaps(anchors: readonly Anchor[]): boolean[] {
  const out = anchors.map(() => false).concat(false);
  if (anchors[0]?.role === 'to') out[0] = true;
  for (let g = 1; g <= anchors.length; g++) {
    const prev = anchors[g - 1]!;
    const next = anchors[g];
    if (prev.role === 'from' && (!next || (next.itemId === prev.itemId && next.role === 'to'))) out[g] = true;
  }
  if (out.every(Boolean)) return out.map(() => false);
  return out;
}

const gapEnds = (g: number, anchors: readonly Anchor[], start: LatLon | null): [LatLon | null, LatLon | null] => [g === 0 ? start : anchors[g - 1]!, anchors[g] ?? null];

/** The best gap (and position in it) to add `x`: least extra walking, never a blocked gap. */
function bestInsert(x: LatLon, gaps: PlanStop[][], anchors: readonly Anchor[], start: LatLon | null, blocked: readonly boolean[]): [number, number] {
  let best: [number, number] = [-1, 0];
  let cost = Infinity;
  for (let g = 0; g < gaps.length; g++) {
    if (blocked[g]) continue;
    const [a, b] = gapEnds(g, anchors, start);
    const pts: (LatLon | null)[] = [a, ...gaps[g]!, b];
    for (let k = 0; k < pts.length - 1; k++) {
      const c = detour(x, pts[k]!, pts[k + 1]!);
      if (c < cost - 1e-9) {
        cost = c;
        best = [g, k];
      }
    }
  }
  return best[0] < 0 ? [0, gaps[0]!.length] : best;
}

export type PlanOptions = {
  /** A position from "Start from where I am" (session only); otherwise the walk starts at the wake-up hotel. */
  here?: LatLon | null;
  /** Airport travel time and buffers (Settings), for a flight's leave-by. */
  airportPrefs?: AirportPrefs;
};

/** The plan for `day`: anchors in time order, untimed stops fitted between them, legs, leave-by times. */
export function dayPlan(trip: Trip, day: LocalDate, opts: PlanOptions = {}): DayPlan {
  const hotel = wakeUpHotel(trip, day);
  const here = opts.here && validLatLon(opts.here.lat, opts.here.lon) ? opts.here : null;
  const start: StartPoint | null = here ? { kind: 'here', name: '', lat: here.lat, lon: here.lon } : hotel;
  const row = dayPlanRow(trip, day);
  const anchors = anchorsOf(trip, day);
  const { stops: free, noSpot } = freeStopsOf(trip, day, row);
  const blocked = blockedGaps(anchors);
  const gaps: PlanStop[][] = blocked.map(() => []);
  const manual = !!row?.order?.length;

  if (manual) {
    // The stored order: each untimed stop stays in the gap after the booking it followed, in the stored order.
    const byKey = new Map(free.map((s) => [s.key, s]));
    const anchorAt = new Map(anchors.map((a, i) => [a.key, i]));
    const used = new Set<string>();
    let g = 0;
    for (const ref of row!.order!) {
      const k = keyOfRef(ref);
      const ai = anchorAt.get(k);
      if (ai !== undefined) {
        g = Math.max(g, ai + 1);
        continue;
      }
      const s = byKey.get(k);
      if (!s || used.has(k)) continue;
      used.add(k);
      let gg = g;
      while (gg > 0 && blocked[gg]) gg--;
      while (gg < gaps.length - 1 && blocked[gg]) gg++;
      gaps[gg]!.push(s);
    }
    // Stops planned since (or a stored gap that no longer exists): where they add least walking.
    for (const s of free) {
      if (used.has(s.key)) continue;
      const [gg, k] = bestInsert(s, gaps, anchors, start, blocked);
      gaps[gg]!.splice(k, 0, s);
    }
  } else {
    for (const s of free) gaps[bestInsert(s, gaps.map(() => []), anchors, start, blocked)[0]]!.push(s);
    for (let g = 0; g < gaps.length; g++) {
      const [a, b] = gapEnds(g, anchors, start);
      gaps[g] = orderGap(gaps[g]!, a, b);
    }
  }

  const seq: PlanStop[] = [];
  for (let g = 0; g < gaps.length; g++) {
    for (const s of gaps[g]!) seq.push({ ...s });
    if (anchors[g]) seq.push({ ...anchors[g]! });
  }

  const items = new Map((Array.isArray(trip.items) ? trip.items : []).map((i) => [i.id, i]));
  let walkM = 0;
  let minutes = 0;
  let longLegs = 0;
  let lastTimed: PlanStop | null = null;
  seq.forEach((s, i) => {
    s.n = i + 1;
    const prev: (LatLon & { name: string; itemId?: string; role?: AnchorRole }) | null = i === 0 ? (start ? { ...start, name: start.name } : null) : seq[i - 1]!;
    if (prev) {
      const leg = legBetween(prev, s, !!prev.itemId && prev.itemId === s.itemId && prev.role === 'from' && s.role === 'to');
      s.leg = leg;
      if (!leg.ride && !leg.long) {
        walkM += leg.walkM;
        minutes += leg.minutes;
      }
      if (leg.long) longLegs++;
    }
    if (s.kind === 'booking') {
      if (s.role !== 'to' && s.at !== undefined && s.tz) s.leave = leaveFor(s, items.get(s.itemId!), opts.airportPrefs, lastTimed);
      if (s.at !== undefined) lastTimed = s;
    }
  });
  // T100: does each gap between timed bookings fit its walk and stops?
  let noFit = 0;
  let prevTimed = -1;
  seq.forEach((s, i) => {
    if (s.kind !== 'booking' || s.at === undefined) return;
    if (prevTimed >= 0) {
      const f = gapFit(seq, prevTimed, i, items);
      if (f) {
        s.fit = f;
        if (!f.ok) noFit++;
      }
    }
    prevTimed = i;
  });

  // T100: the walk back to the hotel slept in that night (not after a departure: you are on the way somewhere).
  const night = nightHotel(trip, day);
  const backToHotel = row?.backToHotel === true;
  let back: PlanLeg | undefined;
  const last = seq[seq.length - 1];
  const from: (LatLon & { name: string }) | null = last ?? (start ? { ...start, name: start.name } : null);
  if (backToHotel && night && from && !(last?.kind === 'booking' && last.role === 'from') && !(last?.kind === 'booking' && last.itemId === night.itemId)) {
    const leg = legBetween(from, night);
    // Further than BACK_MAX_M: the day ends in another city (a flight or train away), so no way back to offer.
    if (leg.straightM <= BACK_MAX_M) {
      back = leg;
      if (!leg.long) {
        walkM += leg.walkM;
        minutes += leg.minutes;
      } else longLegs++;
    }
  }

  const routed = new Set(anchors.map((a) => a.itemId));
  const bookings = (Array.isArray(trip.items) ? trip.items : [])
    .filter((it) => it.kind !== 'note' && typeof it.start?.local === 'string' && localDate(it.start.local) === day && !routed.has(it.id))
    .map((it) => ({ id: it.id, title: it.title }));
  return { day, start, hotel, stops: seq, walkM, minutes, longLegs, manual, night, backToHotel, ...(back ? { back } : {}), noFit, unplaced: { ideas: noSpot, bookings } };
}

/** A leg's maths: straight line, x DETOUR on foot, minutes at walking pace (wayback.walkTime). */
export function legBetween(from: LatLon & { name: string }, to: LatLon & { name: string }, ride = false): PlanLeg {
  const straightM = dist(from, to);
  const same = straightM < ARRIVED_M;
  const minutes = same || ride ? 0 : (walkTime(straightM)?.minutes ?? 0);
  const walkM = same || ride ? 0 : straightM * DETOUR;
  return { from: { lat: from.lat, lon: from.lon, name: from.name }, to: { lat: to.lat, lon: to.lon, name: to.name }, straightM, walkM, minutes, same, ride, long: !ride && walkM > LONG_WALK_M };
}

/** The earlier booking's end on its own clock when it has one later the same day (a tour, a table), else its start. */
function freeFrom(s: PlanStop, item: Item | undefined): number {
  const at = s.at!;
  if (s.role !== 'place' || !item?.end || typeof item.end.local !== 'string' || !isLocalDateTime(item.end.local) || !s.tz) return at;
  const tz = isValidZone(item.end.tz) ? item.end.tz : s.tz;
  if (typeof item.start?.local !== 'string' || localDate(item.end.local) !== localDate(item.start.local)) return at;
  const end = toUtc({ local: item.end.local, tz });
  return Number.isFinite(end) && end > at ? end : at;
}

/** T100: the fit of the gap between timed bookings seq[a] and seq[b] (null for a ride: a journey's own two ends). */
function gapFit(seq: readonly PlanStop[], a: number, b: number, items: ReadonlyMap<string, Item>): GapFit | null {
  const prev = seq[a]!;
  const next = seq[b]!;
  if (prev.role === 'from') return null;
  let walkMin = 0;
  let stops = 0;
  let visitMin = 0;
  let far = false;
  for (let k = a + 1; k <= b; k++) {
    const s = seq[k]!;
    if (s.leg?.ride) return null;
    if (s.leg?.long) far = true;
    else if (s.leg) walkMin += s.leg.minutes;
    if (k < b && s.kind !== 'booking') {
      stops++;
      visitMin += s.stayMin ?? STOP_VISIT_MIN;
    }
  }
  const freeMin = Math.floor((next.at! - freeFrom(prev, items.get(prev.itemId!))) / MIN);
  const needMin = walkMin + visitMin;
  return { ok: freeMin >= needMin, freeMin, needMin, walkMin, stops, visitMin, far, after: prev.title ?? prev.name };
}

function leaveFor(s: PlanStop, item: Item | undefined, prefs: AirportPrefs | undefined, lastTimed: PlanStop | null): LeaveBy | undefined {
  const tight = (utc: number) => !!lastTimed && lastTimed.at !== undefined && utc < lastTimed.at;
  const from = s.leg && !s.leg.ride ? s.leg.from.name : '';
  // A flight with a travel time set: the airport plan's own leave-by (its buffer included).
  if (item && s.role === 'from' && item.kind === 'flight') {
    const plan = airportPlan(item, prefs ?? DEFAULT_AIRPORT_PREFS);
    if (plan?.leaveBy) return { kind: 'airport', utc: plan.leaveBy.utc, local: plan.leaveBy.local, tz: plan.tz, from, tight: tight(plan.leaveBy.utc) };
  }
  // Too far to walk: a walking leave-by would be meaningless (the screen suggests transport instead).
  if (!s.leg || s.leg.ride || s.leg.same || s.leg.long || s.at === undefined || !s.tz) return undefined;
  const utc = s.at - (s.leg.minutes + LEAVE_MARGIN_MIN) * MIN;
  return { kind: 'walk', utc, local: fromUtc(utc, s.tz), tz: s.tz, from, tight: tight(utc) };
}

// ------------------------------------------------------------------------------------------ moving stops

const isBooking = (s: PlanStop) => s.kind === 'booking';

/** Gap index of each position in a sequence: the number of bookings before it. */
const gapsOf = (seq: readonly PlanStop[]) => {
  let g = 0;
  return seq.map((s) => (isBooking(s) ? g++ : g));
};

/** The sequence with `key` moved one place up (-1) / down (+1), skipping in-transit gaps; null when it can't move. */
function movedSeq(plan: DayPlan, key: string, dir: -1 | 1): PlanStop[] | null {
  const seq = plan.stops;
  const from = seq.findIndex((s) => s.key === key);
  if (from < 0 || isBooking(seq[from]!)) return null;
  const anchors = seq.filter(isBooking) as Anchor[];
  const blocked = blockedGaps(anchors);
  const rest = seq.filter((_, i) => i !== from);
  for (let to = from + dir; to >= 0 && to <= rest.length; to += dir) {
    const next = [...rest.slice(0, to), seq[from]!, ...rest.slice(to)];
    if (!blocked[gapsOf(next)[to]!]) return next;
  }
  return null;
}

/** Whether an untimed stop can move up / down in the plan. Bookings never move. */
export function canMoveStop(plan: DayPlan, key: string): { up: boolean; down: boolean } {
  return { up: movedSeq(plan, key, -1) !== null, down: movedSeq(plan, key, 1) !== null };
}

/** Moves an untimed stop one place and stores the whole day's order (the trip unchanged when it can't move). */
export function moveStop(trip: Trip, plan: DayPlan, key: string, dir: -1 | 1, now = new Date().toISOString()): Trip {
  const next = movedSeq(plan, key, dir);
  if (!next) return trip;
  return withRow(trip, plan.day, (r) => ({ ...r, order: next.map(refOf), updatedAt: now }));
}

// ------------------------------------------------------------------------------------------ helpers for the UI

/** The days a plan can be made for (the timeline's day keys) and the ones either side of `day`. */
export function planDays(trip: Trip, day: LocalDate): { days: LocalDate[]; prev: LocalDate | null; next: LocalDate | null } {
  const days = ideaDayKeys(trip);
  const i = days.indexOf(day);
  return { days, prev: i > 0 ? days[i - 1]! : null, next: i >= 0 && i < days.length - 1 ? days[i + 1]! : null };
}

/** Apple Maps walking directions for a leg, from its start to its end. */
export const legUrl = (leg: PlanLeg): string => appleMapsWalkUrl(leg.to.lat, leg.to.lon, leg.to.name, leg.from);

/** Saved places of the trip not yet on the day's plan, by name. */
export function placesToAdd(trip: Trip, day: LocalDate): { id: string; name: string }[] {
  const on = new Set((dayPlanRow(trip, day)?.places ?? []).map((p) => p.placeId));
  return savedPlaces(trip)
    .filter((p) => !on.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every point on the plan's map, start first. */
export const planPoints = (plan: DayPlan): LatLon[] => [
  ...(plan.start ? [{ lat: plan.start.lat, lon: plan.start.lon }] : []),
  ...plan.stops.map((s) => ({ lat: s.lat, lon: s.lon })),
  // T100: the walk back to the hotel ends the line.
  ...(plan.back ? [{ lat: plan.back.to.lat, lon: plan.back.to.lon }] : []),
];

// ------------------------------------------------------------------------------------------ .satchel files

/** A file's `dayPlans` (absent on older files), cleaned like the store. Undefined when there are none. */
export function readFileDayPlans(raw: unknown): DayPlanRow[] | undefined {
  const list = readDayPlans({ dayPlans: raw as DayPlanRow[] });
  return list.length ? list : undefined;
}

export type DayPlanIdMaps = { ideas: ReadonlyMap<string, string>; items: ReadonlyMap<string, string>; places: ReadonlyMap<string, string> };

/** Imported day plans point at the imported trip's new ids; a reference to something not imported is left out. */
export function importDayPlans(list: readonly DayPlanRow[] | undefined, ids: DayPlanIdMaps): DayPlanRow[] | undefined {
  if (!list || !list.length) return undefined;
  const out: DayPlanRow[] = [];
  for (const row of list) {
    const { places, order, stays, ...rest } = row;
    const st = (stays ?? []).flatMap((x): DayPlanStay[] => {
      if ('ideaId' in x) return ids.ideas.has(x.ideaId) ? [{ ...x, ideaId: ids.ideas.get(x.ideaId)! }] : [];
      return ids.places.has(x.placeId) ? [{ ...x, placeId: ids.places.get(x.placeId)! }] : [];
    });
    const p = (places ?? []).flatMap((x) => (ids.places.has(x.placeId) ? [{ ...x, placeId: ids.places.get(x.placeId)! }] : []));
    const o = (order ?? []).flatMap((r): DayPlanRef[] => {
      if ('ideaId' in r) return ids.ideas.has(r.ideaId) ? [{ ...r, ideaId: ids.ideas.get(r.ideaId)! }] : [];
      if ('placeId' in r) return ids.places.has(r.placeId) ? [{ ...r, placeId: ids.places.get(r.placeId)! }] : [];
      return ids.items.has(r.itemId) ? [{ ...r, itemId: ids.items.get(r.itemId)! }] : [];
    });
    if (!p.length && !o.length && !st.length && rest.backToHotel !== true) continue;
    out.push({ ...rest, ...(p.length ? { places: p } : {}), ...(o.length ? { order: o } : {}), ...(st.length ? { stays: st } : {}) });
  }
  return out.length ? out : undefined;
}
