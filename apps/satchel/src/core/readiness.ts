// T60 trip readiness: the "Ready to go?" checks for one trip and the "Leaving soon" pick for the trips list.
// Pure TypeScript (no React Native, no network). The caller passes everything in (vault documents, packing list,
// emergency card, the offline map catalog and installed cities), so nothing here reads storage, and the result
// carries only statuses, counts, dates and city names: never a document label or number.
// "Today" is the traveller's home-zone date (trip.homeTz), so a phone set to another zone gives the same answer.
import { bboxContains, type CityCatalog, type CityMap } from './citymaps.ts';
import { cardStatus, fold } from './emergency.ts';
import { destinationZone } from './glance.ts';
import type { EmergencyCard, Item, LocalDate, Trip, TravelDoc } from './model.ts';
import { progress, type PackList } from './packing.ts';
import { sortItems, span, tripPhase, zonesReadable } from './timeline.ts';
import { daysBetween, fromUtc, isValidZone, localDate } from './tz.ts';
import { addMonths, isLocalDate, PASSPORT_MONTHS } from './vault.ts';

/**
 * pass: done. warn: worth a look before leaving. fail: will cause trouble (passport expired or runs out on the trip).
 * missing: nothing saved yet. unknown: Satchel can't tell (visa not noted, map catalog not loaded, no hotels): it is
 * shown honestly and never counted against the score.
 */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'missing' | 'unknown';
export type CheckId = 'passport' | 'visa' | 'packing' | 'emergency' | 'hotels' | 'map' | 'todos';
export const CHECK_ORDER: readonly CheckId[] = ['passport', 'visa', 'packing', 'emergency', 'hotels', 'map'];

/** Where the one-tap fix goes. */
export type Fix =
  | { kind: 'vault' }
  | { kind: 'packing'; tripId: string }
  | { kind: 'emergency' }
  | { kind: 'address'; itemId: string }
  | { kind: 'map'; tripId: string }
  | { kind: 'todos'; tripId: string };

/**
 * Why a row has its status (the UI turns it into words). Only dates, counts and city names, never document data.
 * passport: none | noExpiry | expired (before today) | duringTrip (runs out before the trip ends) | sixMonths | ok
 * visa: notNoted | expired (before the trip ends) | noted
 * packing: none | empty | partial | done
 * emergency: empty | partial | complete
 * hotels: noHotels | none | some | all
 * map: noDestination | catalogUnavailable | notInCatalog | notDownloaded | downloaded
 */
export type Reason =
  | 'none'
  | 'noExpiry'
  | 'expired'
  | 'duringTrip'
  | 'sixMonths'
  | 'ok'
  | 'notNoted'
  | 'noted'
  | 'empty'
  | 'partial'
  | 'done'
  | 'complete'
  | 'noHotels'
  | 'some'
  | 'all'
  | 'noDestination'
  | 'catalogUnavailable'
  | 'notInCatalog'
  | 'notDownloaded'
  | 'downloaded'
  // T93 to-dos row (src/core/todos.ts todosCheck): overdue | dueSoon | onTrack | done | none
  | 'overdue'
  | 'dueSoon'
  | 'onTrack';

export type Check = {
  id: CheckId;
  status: CheckStatus;
  reason: Reason;
  /** Done / total for packing, with an address / hotels for address cards. */
  done?: number;
  total?: number;
  /** Passport / visa: the date it must be valid until (trip end, or 6 months after it). Never the expiry itself. */
  until?: LocalDate;
  /** Map: the city the check is about. */
  city?: string;
  fix: Fix | null;
};

export type Overall = 'ready' | 'almost' | 'notYet';
export type Readiness = {
  checks: Check[];
  /** Checks that pass, out of those Satchel can judge (unknown rows are left out of both). */
  passed: number;
  scored: number;
  /** 0..1, for a progress bar. 0 when nothing can be judged. */
  score: number;
  overall: Overall;
  /** The home-zone date the checks were made on, and the trip end they were made against. */
  today: LocalDate;
  tripEnd: LocalDate;
};

export type ReadinessInput = {
  trip: Trip;
  docs: readonly TravelDoc[];
  packing: PackList | null | undefined;
  card: EmergencyCard | null | undefined;
  /** The offline map catalog, or null when it isn't available on this phone (never fetched, or unreadable). */
  catalog: CityCatalog | null;
  installed: readonly CityMap[];
  now: number;
  /** T93: the trip's to-dos row (src/core/todos.ts todosCheck), shown after the others when given. */
  todos?: Check | null;
};

// ------------------------------------------------------------------ dates

/** The traveller's date now, in the trip's home zone (UTC when that zone can't be read). */
export function homeToday(trip: Pick<Trip, 'homeTz'>, now: number): LocalDate {
  return localDate(fromUtc(now, isValidZone(trip.homeTz) ? trip.homeTz : 'UTC'));
}

/**
 * The last day of the trip: its end date, or, when that is missing or not a real date, the latest local date of
 * any booking (its end, else its start), else the start date. Null for a trip with no usable dates at all.
 */
export function tripEnd(trip: Pick<Trip, 'startDate' | 'endDate' | 'items'>): LocalDate | null {
  if (isLocalDate(trip.endDate ?? '')) return trip.endDate;
  let last: LocalDate | null = null;
  for (const i of trip.items ?? []) {
    const d = localDate((i.end ?? i.start).local);
    if (isLocalDate(d) && (!last || d > last)) last = d;
  }
  if (last) return last;
  return isLocalDate(trip.startDate ?? '') ? trip.startDate : null;
}

// ------------------------------------------------------------------ the checks

const latest = (docs: readonly TravelDoc[]) =>
  [...docs].sort((a, b) => {
    const ea = a.expires && isLocalDate(a.expires) ? a.expires : '';
    const eb = b.expires && isLocalDate(b.expires) ? b.expires : '';
    return ea < eb ? 1 : ea > eb ? -1 : 0;
  })[0];

/** Passport validity against the trip end, with the common 6-month reminder. The best passport counts. */
export function passportCheck(docs: readonly TravelDoc[], end: LocalDate, today: LocalDate): Check {
  const fix: Fix = { kind: 'vault' };
  const passports = docs.filter((d) => d.kind === 'passport');
  if (!passports.length) return { id: 'passport', status: 'missing', reason: 'none', fix };
  const dated = passports.filter((d) => d.expires && isLocalDate(d.expires));
  if (!dated.length) return { id: 'passport', status: 'warn', reason: 'noExpiry', fix };
  const exp = latest(dated).expires as LocalDate;
  const six = addMonths(end, PASSPORT_MONTHS);
  if (exp < today) return { id: 'passport', status: 'fail', reason: 'expired', until: end, fix };
  if (exp < end) return { id: 'passport', status: 'fail', reason: 'duringTrip', until: end, fix };
  if (exp < six) return { id: 'passport', status: 'warn', reason: 'sixMonths', until: six, fix };
  return { id: 'passport', status: 'pass', reason: 'ok', until: six, fix: null };
}

/**
 * Satchel can't know whether a destination needs a visa, so with no visa in the vault the row is "not checked"
 * (unknown), never a fail. A visa that runs out before the trip ends is a warning; one with no date counts as noted.
 */
export function visaCheck(docs: readonly TravelDoc[], end: LocalDate): Check {
  const fix: Fix = { kind: 'vault' };
  const visas = docs.filter((d) => d.kind === 'visa');
  if (!visas.length) return { id: 'visa', status: 'unknown', reason: 'notNoted', fix };
  const covers = visas.some((d) => !d.expires || !isLocalDate(d.expires) || d.expires >= end);
  if (!covers) return { id: 'visa', status: 'warn', reason: 'expired', until: end, fix };
  return { id: 'visa', status: 'pass', reason: 'noted', fix: null };
}

export function packingCheck(tripId: string, list: PackList | null | undefined): Check {
  const fix: Fix = { kind: 'packing', tripId };
  if (!list) return { id: 'packing', status: 'missing', reason: 'none', fix };
  const p = progress(list);
  if (!p.total) return { id: 'packing', status: 'missing', reason: 'empty', done: 0, total: 0, fix };
  if (p.done < p.total) return { id: 'packing', status: 'warn', reason: 'partial', done: p.done, total: p.total, fix };
  return { id: 'packing', status: 'pass', reason: 'done', done: p.done, total: p.total, fix: null };
}

/** Insurance (insurer, policy, phone) and one emergency contact. Medical notes are optional and never counted. */
export function emergencyCheck(card: EmergencyCard | null | undefined): Check {
  const fix: Fix = { kind: 'emergency' };
  const s = cardStatus(card);
  if (s.complete) return { id: 'emergency', status: 'pass', reason: 'complete', fix: null };
  const counted = s.filled.filter((f) => f !== 'medicalNotes');
  if (!counted.length) return { id: 'emergency', status: 'missing', reason: 'empty', fix };
  return { id: 'emergency', status: 'warn', reason: 'partial', fix };
}

const hasAddress = (i: Item) => !!(i.place?.address?.trim() || i.place?.localAddress?.trim());

/** Every hotel booking has an address for the taxi card. The fix opens the first one without. */
export function hotelsCheck(trip: Pick<Trip, 'items'>): Check {
  const hotels = sortItems(trip.items.filter((i) => i.kind === 'hotel'));
  if (!hotels.length) return { id: 'hotels', status: 'unknown', reason: 'noHotels', fix: null };
  const done = hotels.filter(hasAddress).length;
  const first = hotels.find((i) => !hasAddress(i));
  const fix: Fix | null = first ? { kind: 'address', itemId: first.id } : null;
  if (done === hotels.length) return { id: 'hotels', status: 'pass', reason: 'all', done, total: hotels.length, fix: null };
  return { id: 'hotels', status: done ? 'warn' : 'missing', reason: done ? 'some' : 'none', done, total: hotels.length, fix };
}

type Point = { lat: number; lon: number };
const pointOf = (p: Item['place']): Point | null =>
  p && typeof p.lat === 'number' && typeof p.lon === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { lat: p.lat, lon: p.lon } : null;

/**
 * Where the traveller will be: hotel places first (where you sleep), then activity / car places, then where
 * journeys arrive outside the home zone. Points without coordinates are skipped.
 */
export function destinationPoints(trip: Pick<Trip, 'items' | 'homeTz'>): Point[] {
  const out: Point[] = [];
  const push = (p: Point | null) => p && out.push(p);
  const items = sortItems(trip.items);
  for (const i of items) if (i.kind === 'hotel') push(pointOf(i.place));
  for (const i of items) if (i.kind === 'activity' || i.kind === 'car') push(pointOf(i.place));
  for (const i of items) if (i.to && i.end && i.end.tz !== trip.homeTz) push(pointOf(i.to));
  return out;
}

const cityName = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ');

/** The city covering the trip's first point that any city covers, else one named like the trip's main zone. */
function cityFor(points: readonly Point[], zoneCity: string | null, cities: readonly CityMap[]): CityMap | null {
  for (const p of points) {
    const hit = cities.find((c) => bboxContains(c.bbox, p.lat, p.lon));
    if (hit) return hit;
  }
  if (zoneCity) {
    const want = fold(zoneCity);
    return cities.find((c) => fold(c.name) === want) ?? null;
  }
  return null;
}

/**
 * An offline city map for the destination. Downloaded beats everything; otherwise the catalog says whether there
 * is one to download. No catalog on the phone is said plainly (unknown), never a fail.
 */
export function mapCheck(trip: Trip, catalog: CityCatalog | null, installed: readonly CityMap[]): Check {
  const fix: Fix = { kind: 'map', tripId: trip.id };
  const points = destinationPoints(trip);
  const zone = destinationZone(trip);
  const zoneCity = zone ? cityName(zone) : null;
  if (!points.length && !zoneCity) return { id: 'map', status: 'unknown', reason: 'noDestination', fix: null };
  const have = cityFor(points, zoneCity, installed);
  if (have) return { id: 'map', status: 'pass', reason: 'downloaded', city: have.name, fix: null };
  if (!catalog) return { id: 'map', status: 'unknown', reason: 'catalogUnavailable', city: zoneCity ?? undefined, fix };
  const listed = cityFor(points, zoneCity, catalog.cities);
  if (!listed) return { id: 'map', status: 'unknown', reason: 'notInCatalog', city: zoneCity ?? undefined, fix: null };
  return { id: 'map', status: 'missing', reason: 'notDownloaded', city: listed.name, fix };
}

// ------------------------------------------------------------------ the whole card

export function readiness(input: ReadinessInput): Readiness {
  const { trip, docs, packing, card, catalog, installed, now } = input;
  const today = homeToday(trip, now);
  const end = tripEnd(trip) ?? today;
  const checks: Check[] = [
    passportCheck(docs, end, today),
    visaCheck(docs, end),
    packingCheck(trip.id, packing),
    emergencyCheck(card),
    hotelsCheck(trip),
    mapCheck(trip, catalog, installed),
    ...(input.todos ? [input.todos] : []),
  ];
  const judged = checks.filter((c) => c.status !== 'unknown');
  const passed = judged.filter((c) => c.status === 'pass').length;
  const scored = judged.length;
  const bad = judged.some((c) => c.status === 'fail' || c.status === 'missing');
  const overall: Overall = passed === scored ? 'ready' : bad ? 'notYet' : 'almost';
  return { checks, passed, scored, score: scored ? passed / scored : 0, overall, today, tripEnd: end };
}

/** Card order; the T93 to-dos row comes last. */
const order = (id: CheckId) => (id === 'todos' ? CHECK_ORDER.length : CHECK_ORDER.indexOf(id));

/** The rows that still want something done, worst first (fail, missing, warn), then card order. */
export function toFix(r: Readiness): Check[] {
  const rank: Record<CheckStatus, number> = { fail: 0, missing: 1, warn: 2, unknown: 3, pass: 4 };
  return r.checks
    .filter((c) => c.status !== 'pass' && c.status !== 'unknown')
    .sort((a, b) => rank[a.status] - rank[b.status] || order(a.id) - order(b.id));
}

/** The card shows for trips that have not ended (in the traveller's home zone). */
export const showReadiness = (trip: Trip, now: number) => {
  const end = tripEnd(trip);
  if (!end) return true;
  return tripPhase({ ...trip, endDate: end }, homeToday(trip, now)) !== 'past';
};

// ------------------------------------------------------------------ leaving soon

/** A trip starting within this many days (today counts as 0) gets the "Leaving soon" banner. */
export const LEAVING_SOON_DAYS = 3;

export type LeavingSoon = { trip: Trip; days: number; departs: number | null };

/** The first booking's real start (UTC ms), or null when the trip has no booking with a readable zone. */
export function departureOf(trip: Pick<Trip, 'items'>): number | null {
  const first = sortItems(trip.items.filter((i) => i.kind !== 'note')).find(zonesReadable);
  return first ? span(first).start : null;
}

/**
 * Days until the trip starts, counted in its home zone (0 = today), when that is 0..3 and the first booking has not
 * already left. Null otherwise (too far, already under way, or no usable start date).
 */
export function leavingSoon(trip: Trip, now: number): LeavingSoon | null {
  if (!isLocalDate(trip.startDate ?? '')) return null;
  const today = homeToday(trip, now);
  const days = daysBetween(today, trip.startDate);
  if (days < 0 || days > LEAVING_SOON_DAYS) return null;
  const departs = departureOf(trip);
  if (departs !== null && departs <= now) return null;
  return { trip, days, departs };
}

/** The trip leaving soonest (ties: earliest first booking, then name), or null. Demo trips count: they're for trying. */
export function nextLeaving(trips: readonly Trip[], now: number): LeavingSoon | null {
  const soon = trips.map((t) => leavingSoon(t, now)).filter((x): x is LeavingSoon => !!x);
  soon.sort((a, b) => a.days - b.days || (a.departs ?? Infinity) - (b.departs ?? Infinity) || a.trip.name.localeCompare(b.trip.name));
  return soon[0] ?? null;
}

/** Hours until the first booking leaves, rounded down (for "leaves in 5 h" on the day). Null without one. */
export const hoursUntil = (s: LeavingSoon, now: number): number | null => (s.departs === null ? null : Math.max(0, Math.floor((s.departs - now) / 3_600_000)));

