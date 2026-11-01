// T113 In-flight mode. While a flight booking is in the air (departure <= now < arrival, each stamp read in its own
// IANA zone) Satchel shows an "In the air" hero on Your day and the trip screen, and a full screen
// (app/inflight/[itemId].tsx): an arc from origin to destination with the plane at the elapsed fraction, time left,
// landing time on the destination clock ("set your watch to"), home and destination clocks now, a "when you land"
// checklist built only from what the trip holds, a jet lag tip from src/core/jetlag.ts and the ticket shortcut.
//   - before: within 24 h of departure the same card counts down, with "leave by" from Airport day (leaveby.ts)
//             when a travel time is set
//   - landed: for 6 h after landing; the arrival card (arrival.ts) takes over where the flight landed abroad
// Fully offline from the booking itself: never a flight-status lookup, never the phone's zone for flight times.
// Pure TypeScript; Node runs it directly.
import { homeCountryFor } from './arrival.ts';
import { cashSummary, hasCash } from './cash.ts';
import { bboxContains, type CityMap } from './citymaps.ts';
import { countryForZone, fold } from './emergency.ts';
import { placeCode } from './glance.ts';
import { DEFAULT_BED, DEFAULT_WAKE, homeZone, planLegs, type Direction, type Range } from './jetlag.ts';
import { airportCountdown, airportPlan, DEFAULT_AIRPORT_PREFS, type AirportPrefs, type AirportStep, type Moment } from './leaveby.ts';
import type { Item, LocalDate, LocalDateTime, Trip } from './model.ts';
import { primaryTicket } from './tickets.ts';
import { readTodos, todoList } from './todos.ts';
import { sortItems, span, zonesReadable } from './timeline.ts';
import { daysBetween, fromUtc, isLocalDateTime, localDate, offsetMinutes, toUtc } from './tz.ts';
import { zoneCity } from './travelstats.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
/** The card counts down from this long before departure. */
export const BEFORE_MS = 24 * HOUR;
/** After landing the card stays this long (handing over to the arrival card when the flight landed abroad). */
export const AFTER_MS = 6 * HOUR;
/** A hotel checking in up to this long after landing is the one the checklist points to. */
export const STAY_AHEAD_MS = 48 * HOUR;

export type InflightPhase = 'before' | 'air' | 'landed';

// ------------------------------------------------------------------ times

/** A flight's real departure and arrival instants, or null when it isn't a flight or its times can't be read. */
export function flightTimes(item: Item): { dep: number; arr: number } | null {
  if (item.kind !== 'flight' || !item.end) return null;
  if (!zonesReadable(item) || !isLocalDateTime(item.start.local) || !isLocalDateTime(item.end.local)) return null;
  const dep = toUtc(item.start);
  const arr = toUtc(item.end);
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) return null;
  return { dep, arr };
}

/** How far along the flight is at `now`, clamped to 0..1 (0 before departure, 1 from landing). */
export function elapsedFraction(dep: number, arr: number, now: number): number {
  if (!(arr > dep)) return now >= arr ? 1 : 0;
  const f = (now - dep) / (arr - dep);
  return f <= 0 ? 0 : f >= 1 ? 1 : f;
}

/** The phase of one flight at `now`, or null when it is outside every window. */
export function phaseAt(dep: number, arr: number, now: number): InflightPhase | null {
  if (now >= dep && now < arr) return 'air';
  if (now < dep && now >= dep - BEFORE_MS) return 'before';
  if (now >= arr && now < arr + AFTER_MS) return 'landed';
  return null;
}

export type FlightPick = { item: Item; phase: InflightPhase; dep: number; arr: number };

const RANK: Record<InflightPhase, number> = { air: 0, before: 1, landed: 2 };

/**
 * The flight the card is about: one in the air first; else the next one leaving within 24 h (soonest first);
 * else the one that landed most recently, within 6 h. A connection on the ground therefore shows its next leg.
 */
export function pickFlight(items: readonly Item[], now: number): FlightPick | null {
  let best: FlightPick | null = null;
  for (const item of items) {
    const t = flightTimes(item);
    if (!t) continue;
    const phase = phaseAt(t.dep, t.arr, now);
    if (!phase) continue;
    const pick: FlightPick = { item, phase, dep: t.dep, arr: t.arr };
    if (!best || RANK[phase] < RANK[best.phase]) best = pick;
    else if (phase === best.phase) {
      const better = phase === 'landed' ? t.arr > best.arr : t.dep < best.dep || (t.dep === best.dep && item.id < best.item.id);
      if (better) best = pick;
    }
  }
  return best;
}

// ------------------------------------------------------------------ the arc (drawn by src/ui/InflightArc.tsx)

export type Pt = { x: number; y: number };
export type Arc = { p0: Pt; p1: Pt; p2: Pt };

/** A quadratic arc across a w x h box, origin bottom-left, destination bottom-right, apex near the top. */
export function arcFor(w: number, h: number, pad = 16): Arc {
  const base = h - pad;
  return { p0: { x: pad, y: base }, p1: { x: w / 2, y: base - 2 * (base - pad) }, p2: { x: w - pad, y: base } };
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const clamp01 = (t: number) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);

/** The point at fraction t along the arc and the heading there in degrees (0 = pointing right, + = clockwise). */
export function arcPoint(arc: Arc, t: number): Pt & { angle: number } {
  const u = clamp01(t);
  const a = lerp(arc.p0, arc.p1, u);
  const b = lerp(arc.p1, arc.p2, u);
  const p = lerp(a, b, u);
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return { x: p.x, y: p.y, angle: Math.abs(angle) < 1e-9 ? 0 : angle };
}

/** The part of the arc already flown (0..t) as its own quadratic (de Casteljau split). */
export function arcFlown(arc: Arc, t: number): Arc {
  const u = clamp01(t);
  const a = lerp(arc.p0, arc.p1, u);
  const p = arcPoint(arc, u);
  return { p0: arc.p0, p1: a, p2: { x: p.x, y: p.y } };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
/** SVG path data for an arc. */
export const arcPath = (a: Arc): string => `M ${r1(a.p0.x)} ${r1(a.p0.y)} Q ${r1(a.p1.x)} ${r1(a.p1.y)} ${r1(a.p2.x)} ${r1(a.p2.y)}`;

// ------------------------------------------------------------------ the "when you land" checklist

export type LandingCheck =
  /** The flight lands in another country: the arrival card has local time, money, plugs and numbers. */
  | { kind: 'arrival'; iso2: string }
  /** Stay details (room, codes, Wi-Fi) are saved for the stay you're heading to. */
  | { kind: 'stay'; itemId: string; name: string }
  /** The stay has an address: the address card to show a taxi driver. */
  | { kind: 'address'; itemId: string; name: string }
  /** Cash on hand recorded on this trip (positive balances only). */
  | { kind: 'cash'; rows: { currency: string; amount: number }[] }
  /** An offline city map saved on this phone covers where you land. */
  | { kind: 'map'; city: string }
  /** Toilets come from the same offline city map. */
  | { kind: 'toilets'; city: string }
  /** The trip's eSIM / roaming to-do (Satchel's suggestion or the traveller's own), not hidden. */
  | { kind: 'roaming'; done: boolean };

export type LandingCheckKind = LandingCheck['kind'];

const ROAMING_WORDS = /\b(e-?sim|sim card|sim|roaming|data plan)\b/i;
const pointOf = (p: Item['place']): Pt | null =>
  p && typeof p.lat === 'number' && typeof p.lon === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { x: p.lon, y: p.lat } : null;

/** The stay you're heading to: the first hotel still running after landing that checks in within 48 h of it. */
export function landingStay(trip: Pick<Trip, 'items'>, arr: number): Item | null {
  for (const i of sortItems(trip.items)) {
    if (i.kind !== 'hotel' || !zonesReadable(i)) continue;
    const s = span(i);
    if (s.end > arr && s.start < arr + STAY_AHEAD_MS) return i;
  }
  return null;
}

/** An installed city map covering the stay's position, else where the flight lands, else named like the landing city. */
export function landingMap(flight: Item, stay: Item | null, installed: readonly CityMap[]): CityMap | null {
  for (const p of [pointOf(stay?.place), pointOf(flight.to)]) {
    if (!p) continue;
    const hit = installed.find((c) => bboxContains(c.bbox, p.y, p.x));
    if (hit) return hit;
  }
  const names = [flight.end ? zoneCity(flight.end.tz) : '', flight.to?.name ?? ''].map((n) => fold(n.trim())).filter(Boolean);
  return installed.find((c) => names.includes(fold(c.name))) ?? null;
}

/** The eSIM / roaming to-do, when the trip has one that isn't hidden. */
export function roamingTodo(trip: Trip, now: number): { done: boolean } | null {
  const list = todoList(trip, now);
  const shown = [...list.open, ...list.done];
  const sug = shown.find((v) => v.kind === 'roaming');
  if (sug) return { done: sug.done };
  const own = readTodos(trip).find((r) => !r.suggestion && ROAMING_WORDS.test(r.title));
  return own ? { done: own.done === true } : null;
}

export type ChecklistInput = {
  /** Home country set in Settings (else the trip's home zone decides). */
  homeIso2?: string | null;
  /** Stay details are saved on this phone for the landing stay (src/state/stay.ts). */
  stayDetails?: boolean;
  /** Offline city maps installed on this phone. */
  installed?: readonly CityMap[];
};

/** What waits for you on landing, built only from what this trip and phone actually hold. Order is the card's order. */
export function landingChecklist(trip: Trip, flight: Item, arr: number, now: number, input: ChecklistInput = {}): LandingCheck[] {
  const out: LandingCheck[] = [];
  const endTz = flight.end?.tz;
  const iso2 = endTz ? countryForZone(endTz) : null;
  const home = homeCountryFor(trip, input.homeIso2);
  if (iso2 && iso2 !== home) out.push({ kind: 'arrival', iso2 });

  const stay = landingStay(trip, arr);
  if (stay && input.stayDetails) out.push({ kind: 'stay', itemId: stay.id, name: stay.title });
  if (stay && (stay.place?.address?.trim() || stay.place?.localAddress?.trim())) out.push({ kind: 'address', itemId: stay.id, name: stay.place?.name?.trim() || stay.title });

  if (hasCash(trip)) {
    const rows = cashSummary(trip)
      .rows.filter((r) => r.amount > 0)
      .map((r) => ({ currency: r.currency, amount: r.amount }));
    if (rows.length) out.push({ kind: 'cash', rows });
  }

  const map = landingMap(flight, stay, input.installed ?? []);
  if (map) {
    out.push({ kind: 'map', city: map.name });
    out.push({ kind: 'toilets', city: map.name });
  }

  const roam = iso2 && iso2 !== home ? roamingTodo(trip, now) : null;
  if (roam) out.push({ kind: 'roaming', done: roam.done });
  return out;
}

// ------------------------------------------------------------------ jet lag tip

export type JetlagTip = {
  direction: Direction;
  /** Minutes the destination clock is ahead of where the journey started (normalised, + = east). */
  shift: number;
  /** Landing day's light windows on the destination clock (first of each); null when there is none. */
  seek: Range | null;
  avoid: Range | null;
};

/** The tip for this flight, from the jet lag plan of the journey it belongs to; null under 3 h of clock change. */
export function jetlagTip(trip: Trip, flight: Item, home: string, wake = DEFAULT_WAKE, bed = DEFAULT_BED): JetlagTip | null {
  const t = flightTimes(flight);
  if (!t) return null;
  for (const p of planLegs(trip, home, wake, bed)) {
    const a = toUtc(p.leg.departs);
    const b = toUtc(p.leg.arrives);
    if (t.dep < a || t.arr > b) continue;
    const day = p.arrival[0];
    return { direction: p.leg.direction, shift: p.leg.shift, seek: day?.seek[0] ?? null, avoid: day?.avoid[0] ?? null };
  }
  return null;
}

// ------------------------------------------------------------------ the view

export type Clock = { tz: string; city: string; time: string };
export type BeforeInfo = {
  /** Minutes to departure, rounded up. */
  minutes: number;
  /** Leave-by from Airport day, on the departure airport's clock; null without a travel time. */
  leaveBy: Moment | null;
  leavePassed: boolean;
  /** The next Airport day step still ahead (leave, bag drop, boarding, departure). */
  next: { step: AirportStep; at: Moment; minutes: number } | null;
};

export type InflightView = {
  tripId: string;
  tripName: string;
  itemId: string;
  phase: InflightPhase;
  /** Carrier + number, else the booking's title. */
  flight: string;
  fromCode: string;
  toCode: string;
  fromCity: string;
  toCity: string;
  fromTz: string;
  toTz: string;
  dep: number;
  arr: number;
  departsLocal: LocalDateTime;
  /** Landing on the destination's clock, its date and how many days after the departure date (−1 across the date line). */
  landsLocal: LocalDateTime;
  landsDay: LocalDate;
  landsDayShift: number;
  durationMin: number;
  fraction: number;
  /** air: minutes left (rounded up). before: minutes to departure. landed: 0. */
  minutesLeft: number;
  /** landed: minutes since landing. */
  minutesSince: number;
  /** "Set your watch to": the destination clock now and how far it is ahead of the departure clock (real, not normalised). */
  watch: { time: string; diffMinutes: number };
  home: Clock;
  destination: Clock;
  before: BeforeInfo | null;
  checklist: LandingCheck[];
  jetlag: JetlagTip | null;
  /** The ticket view shortcut: a saved ticket file, or a booking ref / seat to show. */
  ticket: { itemId: string; attachmentId: string | null } | null;
  /** landed abroad: the arrival card takes over from this card. */
  handover: boolean;
};

export type InflightOptions = ChecklistInput & {
  now: number;
  phoneZone: string;
  prefs?: AirportPrefs;
  wake?: string;
  bed?: string;
};

const nameOf = (p: Item['from'], tz: string) => p?.name?.trim() || zoneCity(tz);
const codeOf = (p: Item['from'], tz: string) => placeCode(nameOf(p, tz));
const clockOf = (tz: string, now: number): Clock => ({ tz, city: zoneCity(tz), time: fromUtc(now, tz).slice(11, 16) });

/** Everything the card and screen show for one picked flight. */
export function viewFor(trip: Trip, pick: FlightPick, opts: InflightOptions): InflightView {
  const { item, phase, dep, arr } = pick;
  const now = opts.now;
  const fromTz = item.start.tz;
  const toTz = (item.end ?? item.start).tz;
  const landsLocal = fromUtc(arr, toTz);
  const hz = homeZone(trip, opts.phoneZone);
  const checklist = landingChecklist(trip, item, arr, now, opts);

  let before: BeforeInfo | null = null;
  if (phase === 'before') {
    const plan = airportPlan(item, opts.prefs ?? DEFAULT_AIRPORT_PREFS);
    const cd = plan ? airportCountdown(plan, now) : null;
    before = {
      minutes: Math.ceil((dep - now) / MIN),
      leaveBy: plan?.leaveBy ?? null,
      leavePassed: !!plan?.leaveBy && plan.leaveBy.utc <= now,
      next: cd ? { step: cd.step, at: cd.at, minutes: cd.minutes } : null,
    };
  }
  const att = primaryTicket(item);
  const hasTicket = !!att || !!item.ref?.trim() || !!item.seat?.trim();
  const label = [item.carrier?.trim(), item.number?.trim()].filter(Boolean).join(' ') || item.title;
  return {
    tripId: trip.id,
    tripName: trip.name,
    itemId: item.id,
    phase,
    flight: label,
    fromCode: codeOf(item.from, fromTz),
    toCode: codeOf(item.to, toTz),
    fromCity: nameOf(item.from, fromTz),
    toCity: nameOf(item.to, toTz),
    fromTz,
    toTz,
    dep,
    arr,
    departsLocal: item.start.local,
    landsLocal,
    landsDay: localDate(landsLocal),
    landsDayShift: daysBetween(localDate(item.start.local), localDate(landsLocal)),
    durationMin: Math.round((arr - dep) / MIN),
    fraction: elapsedFraction(dep, arr, now),
    minutesLeft: phase === 'air' ? Math.ceil((arr - now) / MIN) : phase === 'before' ? Math.ceil((dep - now) / MIN) : 0,
    minutesSince: phase === 'landed' ? Math.floor((now - arr) / MIN) : 0,
    watch: { time: fromUtc(now, toTz).slice(11, 16), diffMinutes: offsetMinutes(toTz, now) - offsetMinutes(fromTz, now) },
    home: clockOf(hz, now),
    destination: clockOf(toTz, now),
    before,
    checklist,
    jetlag: jetlagTip(trip, item, hz, opts.wake, opts.bed),
    ticket: hasTicket ? { itemId: item.id, attachmentId: att?.id ?? null } : null,
    handover: phase === 'landed' && checklist.some((c) => c.kind === 'arrival'),
  };
}

/** The card for one trip at `now`, or null when no flight of it is within a window. */
export function inflightView(trip: Trip, opts: InflightOptions): InflightView | null {
  const pick = pickFlight(trip.items, opts.now);
  return pick ? viewFor(trip, pick, opts) : null;
}

/** Your day: across trips, a flight in the air first, then the soonest departure, then the latest landing. */
export function inflightForTrips(trips: readonly Trip[], opts: InflightOptions): InflightView | null {
  let best: { trip: Trip; pick: FlightPick } | null = null;
  for (const trip of trips) {
    const pick = pickFlight(trip.items, opts.now);
    if (!pick) continue;
    if (!best || RANK[pick.phase] < RANK[best.pick.phase]) best = { trip, pick };
    else if (pick.phase === best.pick.phase && (pick.phase === 'landed' ? pick.arr > best.pick.arr : pick.dep < best.pick.dep)) best = { trip, pick };
  }
  return best ? viewFor(best.trip, best.pick, opts) : null;
}

/** The view for one booking by id (the full screen), whatever the phase; null when it is outside every window. */
export function inflightForItem(trips: readonly Trip[], itemId: string, opts: InflightOptions): InflightView | null {
  for (const trip of trips) {
    const item = trip.items.find((i) => i.id === itemId);
    if (!item) continue;
    const t = flightTimes(item);
    const phase = t ? phaseAt(t.dep, t.arr, opts.now) : null;
    return t && phase ? viewFor(trip, { item, phase, dep: t.dep, arr: t.arr }, opts) : null;
  }
  return null;
}
