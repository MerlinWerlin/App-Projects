// T69 "Trip on the map": a trip's bookings that have a map position, as stops grouped by day and in time order,
// with the straight-line legs between consecutive stops of a day, plus the trip's saved places (which have no
// time, so they never join a day's route). Pure TypeScript; the Map tab draws it (src/ui/TripRouteLayer.tsx).
// A stop's day is the local date in the booking's own zone (a 23:30 Tokyo dinner is on the Tokyo date, whatever
// zone the phone is in), and the order within a day is the real instant, so stops in two zones on the same day
// still come out in the order they happen.
// T72: with `transport` on, a journey whose from / to has a map position adds a departure stop (its start, in the
// start zone) and an arrival stop (its end, in the end zone, on the arrival date), so a day reads "station → hotel".
// Off by default here (older callers and tests unchanged); the Map tab turns it on, with a chip to hide them.
// T81: with `ideas` on, ideas planned for a day that have a map spot join that day after its timed stops (role
// 'idea', no time), so See on map shows the plan too. Off by default (older callers and tests unchanged).
import { plannedSpots, type IdeaCategory } from './ideas.ts';
import { journalToday } from './journal.ts';
import type { Item, ItemKind, LocalDate, Place, Stamp, Trip } from './model.ts';
import { savedPlaces } from './places.ts';
import { haversineMeters, validLatLon, type LatLon } from './poi.ts';
import { sortItems } from './timeline.ts';
import { dateRange, daysBetween, isLocalDateTime, isValidZone, localDate, localTime, toUtc } from './tz.ts';

/** Which of the booking's places a stop is: its own place, or a journey's departure / arrival (T72). */
export type StopRole = 'place' | 'from' | 'to' | 'idea';

/** A booking with a map position (its `place`, or a journey's from / to), numbered 1, 2 … within its day. */
export type RouteStop = LatLon & {
  /** Unique per stop: `${itemId}:${role}`, the same id the Map tab's booking pins use. */
  key: string;
  role: StopRole;
  itemId: string;
  kind: ItemKind;
  /** The booking's title. */
  title: string;
  /** The place's name. */
  name: string;
  day: LocalDate;
  /** 'HH:mm' wall clock in `tz`. */
  time: string;
  tz: string;
  /** 1-based position within the day. */
  n: number;
  /** T81, role 'idea' only: the idea's id and category (itemId is '', time and tz are ''). */
  ideaId?: string;
  category?: IdeaCategory;
};

export type RouteLeg = { from: RouteStop; to: RouteStop; meters: number };

export type RouteDay = {
  date: LocalDate;
  /** 1 for the trip's first day; 0 or less for a booking dated before the trip starts. */
  dayNumber: number;
  stops: RouteStop[];
  legs: RouteLeg[];
  /** Sum of the legs, straight lines. */
  meters: number;
  /** Position in `days`: the UI picks the day's colour from it. */
  index: number;
};

export type RouteSaved = LatLon & { placeId: string; name: string; category?: string; sample: boolean };

export type TripRoute = { days: RouteDay[]; saved: RouteSaved[]; stopCount: number };

/** The day filter: every day, or one date. */
export type RouteDayKey = 'all' | LocalDate;
export const ALL_DAYS = 'all';

/** Legs between consecutive stops, with their straight-line length. */
export function legsOf(stops: readonly RouteStop[]): RouteLeg[] {
  const out: RouteLeg[] = [];
  for (let i = 1; i < stops.length; i++) out.push({ from: stops[i - 1], to: stops[i], meters: haversineMeters(stops[i - 1], stops[i]) });
  return out;
}

const validDate = (d: unknown): d is LocalDate => typeof d === 'string' && isLocalDateTime(`${d}T00:00`);

export type RouteOptions = {
  /** T72: add departure / arrival stops for journeys whose from / to has a map position. */
  transport?: boolean;
  /** T81: add planned ideas that have a map spot, after the day's timed stops. */
  ideas?: boolean;
};

const ROLES: readonly StopRole[] = ['place', 'from', 'to'];

type Raw = Omit<RouteStop, 'n'> & { at: number; seq: number };

function stopOf(it: Item, role: StopRole, p: Place | undefined, when: Stamp | undefined, seq: number): Raw | null {
  if (!p || !validLatLon(p.lat, p.lon)) return null;
  if (!when || typeof when.local !== 'string' || !isLocalDateTime(when.local)) return null;
  // The real instant orders a day's stops; a zone this phone can't read keeps the booking order instead.
  const at = typeof when.tz === 'string' && isValidZone(when.tz) ? toUtc(when) : Number.POSITIVE_INFINITY;
  return {
    key: `${it.id}:${role}`,
    role,
    itemId: it.id,
    kind: it.kind,
    title: it.title,
    name: p.name?.trim() || it.title,
    lat: p.lat as number,
    lon: p.lon as number,
    day: localDate(when.local),
    time: localTime(when.local),
    tz: when.tz,
    at,
    seq,
  };
}

/**
 * The trip as a route. Bookings without a place position, or with an unreadable start, are skipped. Every date of
 * the trip gets a day (empty days included, so the chips run Day 1 … Day N), plus any date a stop falls on outside
 * the trip's dates. With `transport`, a journey's arrival needs an end time to be a stop.
 */
export function tripRoute(trip: Trip, opts: RouteOptions = {}): TripRoute {
  const raw: Raw[] = [];
  let seq = 0;
  for (const it of sortItems(Array.isArray(trip.items) ? trip.items : [])) {
    for (const role of ROLES) {
      if (role !== 'place' && !opts.transport) continue;
      const s = role === 'place' ? stopOf(it, role, it.place, it.start, seq) : role === 'from' ? stopOf(it, role, it.from, it.start, seq) : stopOf(it, role, it.to, it.end, seq);
      seq++;
      if (s) raw.push(s);
    }
  }
  raw.sort((a, b) => (a.at === b.at ? a.seq - b.seq : a.at < b.at ? -1 : 1));
  const byDay = new Map<LocalDate, RouteStop[]>();
  for (const { at: _at, seq: _seq, ...s } of raw) {
    const list = byDay.get(s.day) ?? [];
    list.push({ ...s, n: list.length + 1 });
    byDay.set(s.day, list);
  }
  if (opts.ideas) {
    for (const p of plannedSpots(trip)) {
      const list = byDay.get(p.day) ?? [];
      list.push({ key: `idea:${p.ideaId}`, role: 'idea', itemId: '', kind: 'activity', title: p.name, name: p.name, lat: p.lat, lon: p.lon, day: p.day, time: '', tz: '', n: list.length + 1, ideaId: p.ideaId, category: p.category });
      byDay.set(p.day, list);
    }
  }
  const dates = new Set<LocalDate>(byDay.keys());
  if (validDate(trip.startDate) && validDate(trip.endDate) && trip.startDate <= trip.endDate) for (const d of dateRange(trip.startDate, trip.endDate)) dates.add(d);
  const sorted = [...dates].sort();
  const first = validDate(trip.startDate) ? trip.startDate : (sorted[0] ?? '');
  const days = sorted.map((date, index) => {
    const stops = byDay.get(date) ?? [];
    const legs = legsOf(stops);
    return { date, dayNumber: first ? daysBetween(first, date) + 1 : index + 1, stops, legs, meters: legs.reduce((s, l) => s + l.meters, 0), index };
  });
  const saved = savedPlaces(trip).map((p) => ({ placeId: p.id, name: p.name, lat: p.lat, lon: p.lon, ...(p.category ? { category: p.category } : {}), sample: p.sample === true }));
  return { days, saved, stopCount: days.reduce((s, d) => s + d.stops.length, 0) };
}

/** True when the trip has a journey with a positioned from / to (so the Map tab offers its stations chip). */
export function hasTransportStops(trip: Trip): boolean {
  return (Array.isArray(trip.items) ? trip.items : []).some(
    (it) => (it.from && validLatLon(it.from.lat, it.from.lon)) || (it.to && validLatLon(it.to.lat, it.to.lon) && !!it.end),
  );
}

export type RouteView = {
  /** The days on show (one, or every day). */
  days: RouteDay[];
  stops: RouteStop[];
  /** Legs within each shown day (never from one day's last stop to the next day's first). */
  legs: RouteLeg[];
  meters: number;
  /** Saved places show with every day; the camera frames them only on All days. */
  framePoints: LatLon[];
};

/** What the map shows for a day filter. An unknown date shows nothing (not every day). */
export function routeView(route: TripRoute, key: RouteDayKey): RouteView {
  const days = key === ALL_DAYS ? route.days : route.days.filter((d) => d.date === key);
  const stops = days.flatMap((d) => d.stops);
  const legs = days.flatMap((d) => d.legs);
  const framePoints: LatLon[] = stops.map(({ lat, lon }) => ({ lat, lon }));
  if (key === ALL_DAYS || stops.length === 0) for (const s of route.saved) framePoints.push({ lat: s.lat, lon: s.lon });
  return { days, stops, legs, meters: legs.reduce((s, l) => s + l.meters, 0), framePoints };
}

export type Bounds = { south: number; west: number; north: number; east: number };

/** The box around the points, or null for none. */
export function boundsOf(points: readonly LatLon[]): Bounds | null {
  if (points.length === 0) return null;
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lon);
    east = Math.max(east, p.lon);
  }
  return { south, west, north, east };
}

/** How the camera should frame the points: nothing, one spot (zoom to it), or fit them all. */
export type RouteCamera = { kind: 'none' } | { kind: 'point'; at: LatLon } | { kind: 'fit'; points: LatLon[] };

/** Points closer than this (about 10 m) count as one spot for the camera. */
const SAME_SPOT_DEG = 0.0001;

export function cameraFor(points: readonly LatLon[]): RouteCamera {
  const b = boundsOf(points);
  if (!b) return { kind: 'none' };
  if (b.north - b.south < SAME_SPOT_DEG && b.east - b.west < SAME_SPOT_DEG) return { kind: 'point', at: { lat: (b.north + b.south) / 2, lon: (b.east + b.west) / 2 } };
  return { kind: 'fit', points: points.map(({ lat, lon }) => ({ lat, lon })) };
}

/** Today where the traveller is on this trip (their own zone, see journal.ts), or null when the trip isn't on. */
export function routeToday(trip: Trip, now = Date.now()): LocalDate | null {
  const today = journalToday(trip, now);
  return today >= trip.startDate && today <= trip.endDate ? today : null;
}

/** The filter the map opens on: today when the trip is on and today is a day of the route, else every day. */
export function defaultRouteDay(route: TripRoute, today: LocalDate | null): RouteDayKey {
  return today && route.days.some((d) => d.date === today && d.stops.length > 0) ? today : ALL_DAYS;
}

/** The day (local date in its own zone) each booking starts on, by item id: lets the map hide other days' pins. */
export function itemDays(trip: Trip): Map<string, LocalDate> {
  const m = new Map<string, LocalDate>();
  for (const it of Array.isArray(trip.items) ? trip.items : []) if (it.start && isLocalDateTime(it.start.local)) m.set(it.id, localDate(it.start.local));
  return m;
}
