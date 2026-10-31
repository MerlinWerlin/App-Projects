// T66 jet lag and time zones. Pure TS (Intl through tz.ts only), no React Native.
//  - Home zone: the trip's saved home zone (trip.homeTz, chosen from the phone's zone when the trip was made), else
//    the phone's zone now. The home-country setting (src/core/settings.ts) stores a country, not a zone, so it is
//    not used here.
//  - Destination zones come only from the bookings' own IANA zones (start / end stamps), never the phone's zone.
//  - The adjust plan is general guidance, not medical advice: it shifts sleep about an hour a day for up to three
//    days before a flight that crosses 3 h or more, and suggests when to seek or avoid bright light on arrival
//    days, from a simple body-clock rule of thumb. It names no medicine and makes no health claim.
import type { Item, LocalDate, Stamp, Trip } from './model.ts';
import { destinationZone } from './glance.ts';
import { sortItems, span, zonesReadable } from './timeline.ts';
import { addDays, fromUtc, isValidZone, localDate, offsetMinutes, toUtc } from './tz.ts';

const MIN = 60_000;
const DAY_MIN = 1440;

/** A flight journey must change the clock by this many minutes (3 h) before Satchel offers a plan. */
export const PLAN_THRESHOLD_MIN = 180;
/** Sleep moves about an hour a day, for at most this many days before departure. */
export const PRE_DAYS = 3;
export const PRE_STEP_MIN = 60;
/** At most this many arrival days get light windows. */
export const ARRIVAL_DAYS = 3;
/** Rule of thumb: the body clock catches up about 1 h a day going east, 1.5 h going west. */
export const CATCH_UP_EAST_MIN = 60;
export const CATCH_UP_WEST_MIN = 90;
/** Length of each seek / avoid light window, before it is clipped to waking hours. */
export const LIGHT_WINDOW_MIN = 300;
/** Windows shorter than this after clipping are dropped. */
const MIN_WINDOW = 30;
/** Flights that leave within this long of the previous landing count as one journey (a connection). */
const CONNECTION_MS = 24 * 3_600_000;

export const DEFAULT_WAKE = '07:00';
export const DEFAULT_BED = '23:00';

export type Direction = 'east' | 'west';
/** A wall-clock range in one zone, 'HH:mm' to 'HH:mm' (to can be '24:00'). */
export type Range = { from: string; to: string };

// ------------------------------------------------------------------ small helpers

const pad = (n: number) => String(n).padStart(2, '0');
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** 'HH:mm' to minutes after midnight; null when it is not a real time. */
export function hm(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 24 && mi < 60 && h * 60 + mi <= DAY_MIN ? h * 60 + mi : null;
}

/** Minutes after midnight to 'HH:mm' (wraps round the day; exactly 1440 stays '24:00' only when `end`). */
export function clock(min: number, end = false): string {
  if (end && min === DAY_MIN) return '24:00';
  const m = mod(Math.round(min), DAY_MIN);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** A clock shift folded into (−12 h, +12 h]: 13 h east is easier taken as 11 h west. */
export function normaliseShift(min: number): number {
  let s = Math.round(min);
  while (s > 720) s -= DAY_MIN;
  while (s <= -720) s += DAY_MIN;
  return s;
}

/** Minutes the clock in `toTz` is ahead of `fromTz` at the instant (normalised; + means travelling east). */
export const shiftAt = (fromTz: string, toTz: string, utc: number) => normaliseShift(offsetMinutes(toTz, utc) - offsetMinutes(fromTz, utc));

export const directionOf = (shift: number): Direction => (shift > 0 ? 'east' : 'west');

// ------------------------------------------------------------------ zones

/** The traveller's home zone: the trip's saved one when readable, else the phone's, else UTC. */
export function homeZone(trip: Pick<Trip, 'homeTz'>, phoneZone: string): string {
  if (trip.homeTz && isValidZone(trip.homeTz)) return trip.homeTz;
  if (phoneZone && isValidZone(phoneZone)) return phoneZone;
  return 'UTC';
}

/** Every readable zone the bookings use (start, then end), in time order, each once. */
export function tripZones(trip: Pick<Trip, 'items'>): string[] {
  const out: string[] = [];
  for (const i of sortItems(trip.items)) {
    if (!zonesReadable(i)) continue;
    for (const tz of [i.start.tz, i.end?.tz]) if (tz && !out.includes(tz)) out.push(tz);
  }
  return out;
}

/** The zone the trip mostly sits in (glance.destinationZone, with the resolved home zone excluded). */
export const mainZone = (trip: Trip, home: string): string | null => destinationZone({ ...trip, homeTz: home });

/** Where the traveller is at `now` by the bookings: the arrival zone once a journey lands, else the booking's own zone. */
export function zoneAt(trip: Pick<Trip, 'items'>, now: number): string | null {
  let here: string | null = null;
  for (const i of sortItems(trip.items)) {
    if (!zonesReadable(i) || i.kind === 'note') continue;
    const s = span(i);
    if (s.start > now) break;
    here = i.end && s.end <= now && i.kind !== 'hotel' ? i.end.tz : i.start.tz;
  }
  return here;
}

export type There = { tz: string; kind: 'here' | 'destination' };

/**
 * The second clock: "here" (where the bookings put you now) while the trip is under way, else the trip's main
 * destination zone. Null when the trip never leaves the home zone.
 */
export function thereZone(trip: Trip, home: string, now: number): There | null {
  const timed = sortItems(trip.items).filter((i) => zonesReadable(i) && i.kind !== 'note');
  if (timed.length) {
    const first = span(timed[0]).start;
    const last = Math.max(...timed.map((i) => span(i).end));
    if (now >= first && now <= last) {
      const tz = zoneAt(trip, now);
      if (tz && tz !== home) return { tz, kind: 'here' };
    }
  }
  const dest = mainZone(trip, home);
  return dest ? { tz: dest, kind: 'destination' } : null;
}

// ------------------------------------------------------------------ flight journeys

export type Leg = {
  which: 'outbound' | 'return';
  /** The zone the body clock is on before the journey, and the zone it lands in. */
  fromTz: string;
  toTz: string;
  /** Start of the journey's first flight and end of the flight that lands in toTz (each in its own zone). */
  departs: Stamp;
  arrives: Stamp;
  /** Minutes toTz is ahead of fromTz at landing (normalised, + = east). */
  shift: number;
  direction: Direction;
};

const flightsOf = (trip: Pick<Trip, 'items'>): Item[] => sortItems(trip.items).filter((i) => i.kind === 'flight' && !!i.end && zonesReadable(i));

/** Index of the first flight of the journey that ends with flights[idx] (walks back over connections). */
function journeyStart(flights: Item[], idx: number): number {
  let k = idx;
  while (k > 0 && span(flights[k]).start - span(flights[k - 1]).end <= CONNECTION_MS) k--;
  return k;
}

function legOf(which: Leg['which'], flights: Item[], startIdx: number, endIdx: number, fromTz: string): Leg {
  const last = flights[endIdx];
  const end = last.end as Stamp;
  const shift = shiftAt(fromTz, end.tz, toUtc(end));
  return { which, fromTz, toTz: end.tz, departs: flights[startIdx].start, arrives: end, shift, direction: directionOf(shift) };
}

/**
 * The trip's long flight journeys: out to the main destination and back to a zone on home time. Only flights
 * count. Legs are returned whatever their size; `planLegs` keeps the ones of 3 h or more.
 */
export function flightLegs(trip: Trip, home: string): Leg[] {
  const flights = flightsOf(trip);
  if (!flights.length) return [];
  const dest = mainZone(trip, home);
  const landing = (i: Item) => toUtc(i.end as Stamp);
  let outIdx = dest ? flights.findIndex((f) => f.end?.tz === dest) : -1;
  if (outIdx < 0) outIdx = flights.findIndex((f) => f.end!.tz !== home && Math.abs(shiftAt(home, f.end!.tz, landing(f))) >= PLAN_THRESHOLD_MIN);
  if (outIdx < 0) return [];
  const legs: Leg[] = [legOf('outbound', flights, journeyStart(flights, outIdx), outIdx, home)];
  let backIdx = -1;
  for (let k = flights.length - 1; k > outIdx; k--) {
    if (shiftAt(home, flights[k].end!.tz, landing(flights[k])) === 0) {
      backIdx = k;
      break;
    }
  }
  if (backIdx > outIdx) {
    const startIdx = Math.max(outIdx + 1, journeyStart(flights, backIdx));
    const from = flights[startIdx].start.tz;
    legs.push(legOf('return', flights, startIdx, backIdx, from === home ? legs[0].toTz : from));
  }
  return legs;
}

// ------------------------------------------------------------------ the plan

export type SleepDay = { date: LocalDate; /** minutes moved so far (+ = later, − = earlier) */ moved: number; bed: string; wake: string };
export type LightDay = { date: LocalDate; seek: Range[]; avoid: Range[] };
export type LegPlan = { leg: Leg; before: SleepDay[]; arrival: LightDay[]; /** body clock still this far behind/ahead after the plan days */ settled: boolean };

/** Pieces of the circular range [start, start+len) that fall within waking hours [wake, bed]. */
function clipToDay(start: number, len: number, wake: number, bed: number): Range[] {
  const out: Range[] = [];
  const a0 = mod(start, DAY_MIN);
  for (const a of [a0 - DAY_MIN, a0, a0 + DAY_MIN]) {
    const from = Math.max(a, wake);
    const to = Math.min(a + len, bed);
    if (to - from >= MIN_WINDOW) out.push({ from: clock(from), to: clock(to, true) });
  }
  return out.sort((x, y) => (x.from < y.from ? -1 : 1));
}

/**
 * Sleep and light plan for one leg, or null under 3 h. Before: bed and wake times on the origin clock for up to
 * three days before departure, an hour more each day in the travel direction. Arrival: light windows on the local
 * clock for up to three days, from where the body clock would be (low point about 3 h before usual waking).
 */
export function planFor(leg: Leg, wakeAt = DEFAULT_WAKE, bedAt = DEFAULT_BED): LegPlan | null {
  if (Math.abs(leg.shift) < PLAN_THRESHOLD_MIN) return null;
  const wake = hm(wakeAt) ?? (hm(DEFAULT_WAKE) as number);
  const bedRaw = hm(bedAt) ?? (hm(DEFAULT_BED) as number);
  const bed = bedRaw > wake ? bedRaw : bedRaw + DAY_MIN;
  const sign = leg.shift > 0 ? 1 : -1;
  const n = Math.min(PRE_DAYS, Math.floor(Math.abs(leg.shift) / PRE_STEP_MIN));
  const departDate = localDate(leg.departs.local);
  const before: SleepDay[] = [];
  for (let k = 1; k <= n; k++) {
    const moved = -sign * k * PRE_STEP_MIN;
    before.push({ date: addDays(departDate, k - n - 1), moved, bed: clock(bed + moved), wake: clock(wake + moved) });
  }
  const rate = sign > 0 ? CATCH_UP_EAST_MIN : CATCH_UP_WEST_MIN;
  let residual = leg.shift - sign * n * PRE_STEP_MIN;
  const arrival: LightDay[] = [];
  const arriveDate = localDate(leg.arrives.local);
  const wakeEnd = Math.min(bed, DAY_MIN);
  for (let k = 0; k < ARRIVAL_DAYS && Math.abs(residual) >= 60; k++) {
    const low = wake - 180 + residual;
    const after = clipToDay(low, LIGHT_WINDOW_MIN, wake, wakeEnd);
    const beforeLow = clipToDay(low - LIGHT_WINDOW_MIN, LIGHT_WINDOW_MIN, wake, wakeEnd);
    arrival.push({ date: addDays(arriveDate, k), seek: residual > 0 ? after : beforeLow, avoid: residual > 0 ? beforeLow : after });
    residual = residual > 0 ? Math.max(0, residual - rate) : Math.min(0, residual + rate);
  }
  return { leg, before, arrival, settled: Math.abs(residual) < 60 };
}

/** Plans for every flight journey of 3 h or more (outbound first). Empty when none crosses 3 h. */
export function planLegs(trip: Trip, home: string, wakeAt = DEFAULT_WAKE, bedAt = DEFAULT_BED): LegPlan[] {
  return flightLegs(trip, home)
    .map((l) => planFor(l, wakeAt, bedAt))
    .filter((p): p is LegPlan => !!p);
}

// ------------------------------------------------------------------ good time to call home

export type CallWindow = { startUtc: number; endUtc: number; home: Range; there: Range };
export const AWAKE: Range = { from: '08:00', to: '22:00' };
export const WORKING: Range = { from: '09:00', to: '17:00' };
const STEP_MIN = 15;

/**
 * Stretches of the home calendar day `date` when the clock in both zones reads within `hours` (default
 * 08:00–22:00), in 15-minute steps so half- and quarter-hour zones work. Follows the real length of the home day
 * (23 or 25 h at a daylight-saving change). Empty means there is no overlap that day.
 */
export function callWindows(homeTz: string, thereTz: string, date: LocalDate, hours: Range = AWAKE): CallWindow[] {
  if (!isValidZone(homeTz) || !isValidZone(thereTz)) return [];
  const lo = hm(hours.from) ?? 480;
  const hi = hm(hours.to) ?? 1320;
  const start = toUtc({ local: `${date}T00:00`, tz: homeTz });
  const end = toUtc({ local: `${addDays(date, 1)}T00:00`, tz: homeTz });
  const minuteOf = (utc: number, tz: string) => {
    const w = fromUtc(utc, tz);
    return Number(w.slice(11, 13)) * 60 + Number(w.slice(14, 16));
  };
  const ok = (utc: number) =>
    [homeTz, thereTz].every((tz) => {
      const m = minuteOf(utc, tz);
      return m >= lo && m + STEP_MIN <= hi;
    });
  const out: CallWindow[] = [];
  let open: number | null = null;
  for (let t = start; t <= end; t += STEP_MIN * MIN) {
    const good = t < end && ok(t);
    if (good && open === null) open = t;
    if (!good && open !== null) {
      out.push(windowOf(open, t, homeTz, thereTz));
      open = null;
    }
  }
  return out;
}

function windowOf(a: number, b: number, homeTz: string, thereTz: string): CallWindow {
  const r = (tz: string): Range => ({ from: fromUtc(a, tz).slice(11, 16), to: fromUtc(b, tz).slice(11, 16) });
  return { startUtc: a, endUtc: b, home: r(homeTz), there: r(thereTz) };
}

/**
 * T68: the awake hours the call finder uses, from the usual-sleep setting: wake time to bedtime on each clock. A
 * bedtime after midnight (00:30) is cut at midnight, since a call window can't run past the end of the day.
 */
export function awakeHours(wakeAt = DEFAULT_WAKE, bedAt = DEFAULT_BED): Range {
  const wake = hm(wakeAt);
  const bed = hm(bedAt);
  if (wake === null || bed === null || wake >= DAY_MIN) return awakeHours(DEFAULT_WAKE, DEFAULT_BED);
  return { from: clock(wake), to: bed > wake ? clock(bed, true) : '24:00' };
}

/** T68: the call finder looks this many days past today (today plus the next three home days). */
export const CALL_DAYS_AHEAD = 3;

export type CallDay = { date: LocalDate; windows: CallWindow[] };

/** Call windows for the home day `today` and the CALL_DAYS_AHEAD days after it, a day with no overlap included (empty). */
export function callDays(homeTz: string, thereTz: string, today: LocalDate, hours: Range = AWAKE, ahead = CALL_DAYS_AHEAD): CallDay[] {
  const out: CallDay[] = [];
  for (let k = 0; k <= ahead; k++) {
    const date = addDays(today, k);
    out.push({ date, windows: callWindows(homeTz, thereTz, date, hours) });
  }
  return out;
}

/** The next window that hasn't ended by `now` (the one under way counts), and its home date; null when none in range. */
export function nextCall(days: readonly CallDay[], now: number): { date: LocalDate; window: CallWindow } | null {
  for (const d of days) for (const w of d.windows) if (w.endUtc > now) return { date: d.date, window: w };
  return null;
}

/** The window `now` falls in, if any. */
export const windowNow = (ws: readonly CallWindow[], now: number): CallWindow | null => ws.find((w) => now >= w.startUtc && now < w.endUtc) ?? null;

// ------------------------------------------------------------------ everything the card needs

export type JetLagView = {
  home: string;
  there: There | null;
  /** Minutes "there" is ahead of home right now (not normalised: the real clock difference). */
  diffNow: number;
  plans: LegPlan[];
};

/** What the trip screen shows. Null when the trip never leaves the home zone's clock. */
export function jetLagView(trip: Trip, phoneZone: string, now: number, wakeAt = DEFAULT_WAKE, bedAt = DEFAULT_BED): JetLagView | null {
  const home = homeZone(trip, phoneZone);
  const there = thereZone(trip, home, now);
  const plans = planLegs(trip, home, wakeAt, bedAt);
  if (!there && !plans.length) return null;
  const diffNow = there ? offsetMinutes(there.tz, now) - offsetMinutes(home, now) : 0;
  return { home, there, diffNow, plans };
}
