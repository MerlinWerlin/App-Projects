// T74 airport day. A flight booking can carry its terminal, gate, boarding time and the time bag drop closes, all on
// the departure airport's own clock (the flight's start zone, never the phone's). From the traveller's own travel
// time to the airport plus an airport buffer (general guidance only: 90 minutes domestic, 180 international by
// default, editable per flight and in Settings) Satchel works out "Leave by", and counts down to the next step:
// leave, bag drop closes, boarding, departure. Pure and offline; every stored value is read defensively, so a
// damaged or older booking just shows less.
//
// Times are stored as 'HH:mm' wall times. Each is placed on the calendar day that puts it nearest the departure
// (within 12 hours either side), so 23:40 boarding for a 00:20 departure means the evening before. All maths runs on
// real instants (tz.ts toUtc / fromUtc), so a daylight-saving change between leaving home and take-off is counted
// as the clock actually moves.
import type { Item, LocalDate, LocalDateTime } from './model.ts';
import { addDays, checkWallTime, fromUtc, isLocalDateTime, isValidZone, localDate, toUtc } from './tz.ts';
import { zoneInfo } from './tzsearch.ts';

export const SCOPES = ['domestic', 'international'] as const;
export type FlightScope = (typeof SCOPES)[number];

/** What a flight booking may carry for the airport. Every field is optional; unknown keys are kept as they are. */
export type AirportInfo = {
  terminal?: string;
  gate?: string;
  /** Boarding time, 'HH:mm' on the departure airport's clock. */
  boarding?: string;
  /** Bag drop closes, 'HH:mm' on the departure airport's clock. */
  bagDrop?: string;
  /** Picks the default airport buffer. Absent: guessed from the two airports' countries. */
  scope?: FlightScope;
  /** This flight's airport buffer in minutes (overrides the Settings default for its scope). */
  bufferMin?: number;
  /** This flight's travel time to the airport in minutes (overrides the Settings default). */
  travelMin?: number;
};

/** Settings defaults. travelMin null: not set yet (no leave-by time until the traveller gives one). */
export type AirportPrefs = { travelMin: number | null; domesticMin: number; internationalMin: number };
export const AIRPORT_PREFS_KEY = 'satchel.airport.v1';
export const DEFAULT_AIRPORT_PREFS: AirportPrefs = { travelMin: null, domesticMin: 90, internationalMin: 180 };

export const BUFFER_STEP = 15;

/** T76: the Settings buffer for a flight type ("Use my default" on a flight goes back to it). */
export const defaultBuffer = (prefs: AirportPrefs, scope: FlightScope): number => {
  const p = normaliseAirportPrefs(prefs);
  return scope === 'domestic' ? p.domesticMin : p.internationalMin;
};
export const MAX_BUFFER = 360;
export const TRAVEL_STEP = 5;
export const MAX_TRAVEL = 300;
const MAX_TEXT = 40;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const TIME_RE = /^(\d{2}):(\d{2})$/;
/** True for a 24-hour 'HH:mm'. */
export const isClock = (x: unknown): x is string => typeof x === 'string' && TIME_RE.test(x) && Number(x.slice(0, 2)) < 24 && Number(x.slice(3)) < 60;
const minutesIn = (x: unknown, max: number): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max ? Math.round(x) : undefined;
const text = (x: unknown): string | undefined => {
  if (typeof x !== 'string') return undefined;
  const s = x.trim().slice(0, MAX_TEXT);
  return s || undefined;
};

/**
 * A stored or imported airport value as clean AirportInfo, or undefined when nothing usable is left. Known fields
 * with a bad value are dropped; keys this build doesn't know are kept untouched (a newer Satchel may have written them).
 */
export function readAirport(raw: unknown): AirportInfo | undefined {
  if (!isObj(raw)) return undefined;
  const known = new Set(['terminal', 'gate', 'boarding', 'bagDrop', 'scope', 'bufferMin', 'travelMin']);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!known.has(k)) out[k] = v;
  const terminal = text(raw.terminal);
  const gate = text(raw.gate);
  if (terminal) out.terminal = terminal;
  if (gate) out.gate = gate;
  if (isClock(raw.boarding)) out.boarding = raw.boarding;
  if (isClock(raw.bagDrop)) out.bagDrop = raw.bagDrop;
  if ((SCOPES as readonly unknown[]).includes(raw.scope)) out.scope = raw.scope;
  const buffer = minutesIn(raw.bufferMin, MAX_BUFFER);
  const travel = minutesIn(raw.travelMin, MAX_TRAVEL);
  if (buffer !== undefined) out.bufferMin = buffer;
  if (travel !== undefined) out.travelMin = travel;
  return Object.keys(out).length ? (out as AirportInfo) : undefined;
}

/** Stored Settings defaults from any build (or damaged storage) as complete, valid prefs. */
export function normaliseAirportPrefs(raw: unknown): AirportPrefs {
  const o = isObj(raw) ? raw : {};
  return {
    travelMin: minutesIn(o.travelMin, MAX_TRAVEL) ?? null,
    domesticMin: minutesIn(o.domesticMin, MAX_BUFFER) ?? DEFAULT_AIRPORT_PREFS.domesticMin,
    internationalMin: minutesIn(o.internationalMin, MAX_BUFFER) ?? DEFAULT_AIRPORT_PREFS.internationalMin,
  };
}

/** One stepper move, snapped to the step grid and kept within 0..max. */
export function stepMinutes(current: number, dir: 1 | -1, step: number, max: number): number {
  const snapped = Math.round(current / step) * step;
  const next = snapped !== current && Math.sign(snapped - current) === dir ? snapped : snapped + dir * step;
  return Math.max(0, Math.min(max, next));
}

/** Domestic when both airports' zones are in the same country; international when they differ or can't be told. */
export function guessScope(item: Pick<Item, 'start' | 'end'>): FlightScope {
  const a = zoneInfo(item.start.tz).country;
  const b = item.end ? zoneInfo(item.end.tz).country : '';
  return a && b && a === b ? 'domestic' : 'international';
}

// ---- the plan ----

export type Moment = { utc: number; local: LocalDateTime };
export type AirportWarning =
  | 'boardingAfterDeparture'
  | 'bagDropAfterDeparture'
  | 'bagDropAfterBoarding'
  | 'boardingSkipped'
  | 'bagDropSkipped';

export type AirportPlan = {
  /** The departure airport's zone: every time below is on its clock. */
  tz: string;
  departure: Moment;
  scope: FlightScope;
  /** True when the scope is a guess from the zones (the traveller hasn't chosen). */
  scopeGuessed: boolean;
  bufferMin: number;
  /** True when the buffer is the Settings default for the scope (not set on this flight). */
  bufferDefault: boolean;
  /** Null when no travel time is set on the flight or in Settings. */
  travelMin: number | null;
  travelDefault: boolean;
  boarding: Moment | null;
  bagDrop: Moment | null;
  /** Departure minus the buffer, or when bag drop closes if that is earlier. */
  arriveBy: Moment;
  arriveByBagDrop: boolean;
  /** Arrive-by minus the travel time; null without a travel time. */
  leaveBy: Moment | null;
  warnings: AirportWarning[];
};

const MIN = 60_000;
const moment = (utc: number, tz: string): Moment => ({ utc, local: fromUtc(utc, tz) });

/**
 * An 'HH:mm' on `tz`'s clock placed on the day nearest `dep` (yesterday, the departure day or tomorrow), with
 * whether daylight saving skips that wall time (it is then read as the time a clock would show).
 */
export function placeNear(time: string, dep: Moment, tz: string): { at: Moment; skipped: boolean } {
  const day = localDate(dep.local);
  let best: { at: Moment; skipped: boolean } | null = null;
  for (const d of [addDays(day, -1), day, addDays(day, 1)]) {
    const stamp = { local: `${d}T${time}`, tz };
    const utc = toUtc(stamp);
    if (!best || Math.abs(utc - dep.utc) < Math.abs(best.at.utc - dep.utc)) best = { at: moment(utc, tz), skipped: checkWallTime(stamp).kind === 'skipped' };
  }
  return best as { at: Moment; skipped: boolean };
}

/** The airport plan for a flight, or null for other kinds and for a departure that can't be placed in time. */
export function airportPlan(item: Pick<Item, 'kind' | 'start' | 'end'> & { airport?: unknown }, prefs: AirportPrefs = DEFAULT_AIRPORT_PREFS): AirportPlan | null {
  if (item.kind !== 'flight') return null;
  const tz = item.start?.tz;
  if (typeof tz !== 'string' || !isValidZone(tz) || typeof item.start.local !== 'string' || !isLocalDateTime(item.start.local)) return null;
  const p = normaliseAirportPrefs(prefs);
  const a = readAirport(item.airport) ?? {};
  const departure = moment(toUtc(item.start), tz);
  const endOk = !!item.end && typeof item.end.tz === 'string' && isValidZone(item.end.tz);
  const scope = a.scope ?? guessScope({ start: item.start, end: endOk ? item.end : undefined });
  const bufferMin = a.bufferMin ?? defaultBuffer(p, scope);
  const travelMin = a.travelMin ?? p.travelMin;
  const warnings: AirportWarning[] = [];

  const b = a.boarding ? placeNear(a.boarding, departure, tz) : null;
  const g = a.bagDrop ? placeNear(a.bagDrop, departure, tz) : null;
  if (b?.skipped) warnings.push('boardingSkipped');
  if (g?.skipped) warnings.push('bagDropSkipped');
  if (b && b.at.utc >= departure.utc) warnings.push('boardingAfterDeparture');
  if (g && g.at.utc >= departure.utc) warnings.push('bagDropAfterDeparture');
  else if (g && b && b.at.utc < departure.utc && g.at.utc > b.at.utc) warnings.push('bagDropAfterBoarding');

  // A bag-drop time after departure is a typo; it never moves the arrive-by time later.
  const byBuffer = departure.utc - bufferMin * MIN;
  const arriveByBagDrop = !!g && g.at.utc < departure.utc && g.at.utc < byBuffer;
  const arriveBy = arriveByBagDrop && g ? g.at : moment(byBuffer, tz);
  return {
    tz,
    departure,
    scope,
    scopeGuessed: !a.scope,
    bufferMin,
    bufferDefault: a.bufferMin === undefined,
    travelMin,
    travelDefault: a.travelMin === undefined,
    boarding: b?.at ?? null,
    bagDrop: g?.at ?? null,
    arriveBy,
    arriveByBagDrop,
    leaveBy: travelMin === null ? null : moment(arriveBy.utc - travelMin * MIN, tz),
    warnings,
  };
}

// ---- countdown ----

export type AirportStep = 'leave' | 'bagDrop' | 'boarding' | 'departure';
export type Countdown = { step: AirportStep; at: Moment; minutes: number; leavePassed: boolean };

/**
 * The next step still ahead ("Leave in 1h 10m", "Boarding in 25m"), or null once the flight has left. Minutes are
 * rounded up, so "in 1m" shows until the minute itself. leavePassed: the leave-by time has gone but the flight hasn't.
 */
export function airportCountdown(plan: AirportPlan, now: number): Countdown | null {
  const steps: Array<[AirportStep, Moment | null]> = [
    ['leave', plan.leaveBy],
    ['bagDrop', plan.warnings.includes('bagDropAfterDeparture') ? null : plan.bagDrop],
    ['boarding', plan.warnings.includes('boardingAfterDeparture') ? null : plan.boarding],
    ['departure', plan.departure],
  ];
  for (const [step, at] of steps) {
    if (at && at.utc > now) return { step, at, minutes: Math.ceil((at.utc - now) / MIN), leavePassed: !!plan.leaveBy && plan.leaveBy.utc <= now };
  }
  return null;
}

// ---- the "Your day" line ----

/**
 * The flight to mention on the Your day card for `today` (read in `zone`, the zone the traveller is in): the first
 * flight not yet gone that leaves today, or whose leave-by time falls today (a flight just after midnight).
 */
export function flightToday(items: readonly Item[], zone: string, today: LocalDate, now: number, prefs: AirportPrefs = DEFAULT_AIRPORT_PREFS): { item: Item; plan: AirportPlan } | null {
  if (!isValidZone(zone)) return null;
  const from = toUtc({ local: `${today}T00:00`, tz: zone });
  const to = toUtc({ local: `${addDays(today, 1)}T00:00`, tz: zone });
  const inDay = (m: Moment | null) => !!m && m.utc >= from && m.utc < to;
  let best: { item: Item; plan: AirportPlan } | null = null;
  for (const item of items) {
    const plan = airportPlan(item, prefs);
    if (!plan || plan.departure.utc <= now) continue;
    if (!inDay(plan.departure) && !inDay(plan.leaveBy)) continue;
    if (!best || plan.departure.utc < best.plan.departure.utc) best = { item, plan };
  }
  return best;
}

// ---- the form ----

/** The form's airport fields as text (blank: not set), so the unsaved-changes check compares them like the rest. */
export type AirportDraft = { terminal: string; gate: string; boarding: string; bagDrop: string; scope: string; bufferMin: string; travelMin: string };

export function airportDraft(raw: unknown): AirportDraft {
  const a = readAirport(raw) ?? {};
  return {
    terminal: a.terminal ?? '',
    gate: a.gate ?? '',
    boarding: a.boarding ?? '',
    bagDrop: a.bagDrop ?? '',
    scope: a.scope ?? '',
    bufferMin: a.bufferMin === undefined ? '' : String(a.bufferMin),
    travelMin: a.travelMin === undefined ? '' : String(a.travelMin),
  };
}

const num = (s: string) => (s.trim() && /^\d+$/.test(s.trim()) ? Number(s.trim()) : undefined);

/**
 * The airport value to save from the form, keeping keys this build doesn't know from `prev`. Undefined when the form
 * is empty and nothing unknown was there.
 */
export function airportFromDraft(d: AirportDraft, prev?: unknown): AirportInfo | undefined {
  const keep: Record<string, unknown> = {};
  if (isObj(prev)) {
    const known = new Set(['terminal', 'gate', 'boarding', 'bagDrop', 'scope', 'bufferMin', 'travelMin']);
    for (const [k, v] of Object.entries(prev)) if (!known.has(k)) keep[k] = v;
  }
  return readAirport({ ...keep, terminal: d.terminal, gate: d.gate, boarding: d.boarding, bagDrop: d.bagDrop, scope: d.scope, bufferMin: num(d.bufferMin), travelMin: num(d.travelMin) });
}

/**
 * The item the form saves with its airport fields: set on a flight (or removed when empty), dropped on other kinds
 * (like the seat: switching a draft from flight to hotel leaves nothing hidden behind).
 */
export function withAirport<I extends Item>(item: I, d: AirportDraft, prev?: unknown): I {
  const { airport: _old, ...rest } = item as I & { airport?: unknown };
  if (item.kind !== 'flight') return rest as I;
  const airport = airportFromDraft(d, prev);
  return (airport ? { ...rest, airport } : rest) as I;
}

/** A typed boarding or bag-drop time that isn't HH:mm (the picker fallback): it is not saved, so the form says so. */
export const badClock = (s: string) => !!s.trim() && !isClock(s.trim());
