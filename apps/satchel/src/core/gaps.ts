// T135 trip gaps: holes and clashes in a trip, found offline from its bookings.
//  - night:       nights with no stay booked, between the first arrival and the last departure, by each night's own
//                 local date (a night is the date you go to sleep on; consecutive nights form one gap)
//  - move:        the trip changes city / country with no journey between two places
//  - stayClash:   two stays that overlap (timeline.overlaps, the same rule as the timeline's clash warning)
//  - legClash:    two journeys that overlap in time (layovers.findConnections clashes, never duplicated here)
//  - checkInLate: a stay's check-in comes after the journey that takes you on from there has left
//  - lateArrival: a journey arrives after the check-out day of the stay it takes you to
//  - noWayHome:   the trip has no journey home
// Every time is read on its own item's IANA zone (tz.ts toUtc / local dates), so DST, half-hour zones and the date
// line are handled; items whose zone this phone can't read are skipped. Dismissed gaps (ids kept per trip on the
// phone, never in the trip or its .satchel file) are left out. Pure TypeScript, offline, Node runs it.
import { countryForZone } from './emergency.ts';
import { findConnections, NEARBY_M, placeMatch } from './layovers.ts';
import { isTransport, type Item, type ItemKind, type LocalDate, type Place, type Trip } from './model.ts';
import { haversineMeters, validLatLon } from './poi.ts';
import type { Check } from './readiness.ts';
import { overlaps, sortItems, zonesReadable } from './timeline.ts';
import { addDays, daysBetween, isLocalDateTime, isValidZone, localDate, toUtc } from './tz.ts';

export const GAP_KINDS = ['night', 'move', 'stayClash', 'legClash', 'checkInLate', 'lateArrival', 'noWayHome'] as const;
export type GapKind = (typeof GAP_KINDS)[number];

/** What the card's add button opens: the add-booking form with this kind, first date, last date and zone. */
export type GapAdd = { kind: Extract<ItemKind, 'hotel' | 'flight' | 'train'>; date: LocalDate; until?: LocalDate; tz: string };

export type Gap = {
  /** Stable for a given set of bookings (changes when the gap itself changes), used to dismiss it. */
  id: string;
  kind: GapKind;
  /** First and last local date the gap is about (night: first and last night; clashes: where they meet). */
  from: LocalDate;
  to: LocalDate;
  /** The bookings involved, in time order (empty for a night gap). */
  items: Item[];
  /** night: how many nights. */
  nights?: number;
  /** legClash / stayClash: minutes the two overlap. checkInLate: minutes the journey leaves before check-in. */
  minutes?: number;
  /** move: the two places (names as typed; '' when none). */
  fromPlace?: string;
  toPlace?: string;
  /** The add-booking button; null for clashes (they are fixed by editing a booking). */
  add: GapAdd | null;
};

/** Longest run of nights looked at (a year), so a broken date can't make a huge loop. */
export const MAX_NIGHTS = 366;
const MIN = 60_000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (d: unknown): d is LocalDate => typeof d === 'string' && DATE_RE.test(d) && isLocalDateTime(`${d}T00:00`);
const startDate = (i: Item) => localDate(i.start.local);
const endDate = (i: Item) => localDate((i.end ?? i.start).local);

/** Journeys (flight, train, ferry, bus) and stays with readable zones, each in real time order. */
function parts(items: readonly Item[]) {
  const usable = items.filter((i) => zonesReadable(i) && isLocalDateTime(i.start.local) && (!i.end || isLocalDateTime(i.end.local)));
  return {
    usable,
    legs: sortItems(usable.filter((i) => isTransport(i.kind))),
    stays: sortItems(usable.filter((i) => i.kind === 'hotel')),
  };
}

const placeName = (p: Place | undefined) => p?.name?.trim() || '';

// ------------------------------------------------------------------ nights with no stay

/**
 * The span the trip needs beds for: from the first journey's arrival date (its own zone) to the last journey's
 * departure date. With one journey only (the way out), up to the trip's end date; with none, the trip's dates.
 */
export function nightBounds(trip: Pick<Trip, 'startDate' | 'endDate' | 'items' | 'homeTz'>): { first: LocalDate; last: LocalDate } | null {
  const { legs } = parts(trip.items ?? []);
  const arrived = legs.find((l) => l.end);
  const first = arrived ? endDate(arrived) : trip.startDate;
  // With no way home the last journey is not the one out, so the trip's end date counts too.
  const lastDep = legs.length >= 2 ? startDate(legs[legs.length - 1]) : trip.endDate;
  const last = legs.length >= 2 && !hasWayHome(trip) && isDate(trip.endDate) && trip.endDate > lastDep ? trip.endDate : lastDep;
  if (!isDate(first) || !isDate(last) || last <= first) return null;
  return { first, last };
}

/**
 * Nights (local dates) a booking gives you a bed for. A stay: check-in date up to, not including, check-out date.
 * A stay with no check-out (open-ended): from check-in until the next journey leaves or the next stay starts, else
 * to `boundEnd`; at least its first night. An overnight or multi-day journey: each date it is under way overnight.
 */
export function coveredNights(items: readonly Item[], boundEnd?: LocalDate): Set<LocalDate> {
  const { legs, stays } = parts(items);
  const out = new Set<LocalDate>();
  const addRange = (a: LocalDate, b: LocalDate) => {
    // [a, b): every night from a up to the day before b, capped.
    for (let d = a, n = 0; d < b && n < MAX_NIGHTS; d = addDays(d, 1), n++) out.add(d);
  };
  for (const s of stays) {
    const ci = startDate(s);
    if (s.end) {
      addRange(ci, endDate(s));
      continue;
    }
    const t = toUtc(s.start);
    const nextLeg = legs.find((l) => toUtc(l.start) > t);
    const nextStay = stays.find((o) => o !== s && toUtc(o.start) > t);
    const ends = [nextLeg ? startDate(nextLeg) : null, nextStay ? startDate(nextStay) : null, boundEnd ?? null].filter((d): d is LocalDate => !!d && d > ci);
    out.add(ci);
    if (ends.length) addRange(ci, ends.sort()[0]);
  }
  for (const l of legs) if (l.end && endDate(l) > startDate(l)) addRange(startDate(l), endDate(l));
  return out;
}

/** The zone you are in on a night: the last journey that has landed by then, else the stay you're at, else home. */
function zoneOn(date: LocalDate, legs: Item[], stays: Item[], homeTz: string): string {
  let zone: string | null = null;
  for (const l of legs) if (l.end && endDate(l) <= date) zone = l.end.tz;
  if (zone) return zone;
  const stay = stays.filter((s) => startDate(s) <= date).pop();
  if (stay) return stay.start.tz;
  const firstArrival = legs.find((l) => l.end)?.end?.tz;
  return firstArrival ?? (isValidZone(homeTz) ? homeTz : 'UTC');
}

function nightGaps(trip: Trip): Gap[] {
  const { legs, stays } = parts(trip.items ?? []);
  // Nothing booked to travel or sleep yet: still planning, no nights to point at.
  if (!legs.length && !stays.length) return [];
  const bounds = nightBounds(trip);
  if (!bounds) return [];
  const covered = coveredNights(trip.items ?? [], bounds.last);
  const out: Gap[] = [];
  let run: LocalDate[] = [];
  const flush = () => {
    if (!run.length) return;
    const from = run[0];
    const to = run[run.length - 1];
    out.push({ id: `night:${from}:${to}`, kind: 'night', from, to, items: [], nights: run.length, add: { kind: 'hotel', date: from, until: addDays(to, 1), tz: zoneOn(from, legs, stays, trip.homeTz) } });
    run = [];
  };
  for (let d = bounds.first, n = 0; d < bounds.last && n < MAX_NIGHTS; d = addDays(d, 1), n++) {
    if (covered.has(d)) flush();
    else run.push(d);
  }
  flush();
  return out;
}

// ------------------------------------------------------------------ a change of place with no journey

type Anchor = { t: number; at: 'arr' | 'stay' | 'dep'; item: Item; place?: Place; tz: string; date: LocalDate };
const AT_ORDER = { arr: 0, stay: 1, dep: 2 } as const;

/** Two anchors are in different places: positions further apart than NEARBY_M, else different countries by zone. */
export function farApart(a: { place?: Place; tz: string }, b: { place?: Place; tz: string }): boolean {
  if (a.place && b.place && validLatLon(a.place.lat, a.place.lon) && validLatLon(b.place.lat, b.place.lon)) {
    return haversineMeters({ lat: a.place.lat as number, lon: a.place.lon as number }, { lat: b.place.lat as number, lon: b.place.lon as number }) > NEARBY_M;
  }
  const ca = countryForZone(a.tz);
  const cb = countryForZone(b.tz);
  return !!ca && !!cb && ca !== cb;
}

function moveGaps(items: readonly Item[]): Gap[] {
  const { usable, legs, stays } = parts(items);
  const cars = usable.filter((i) => i.kind === 'car');
  const anchors: Anchor[] = [];
  for (const l of legs) {
    anchors.push({ t: toUtc(l.start), at: 'dep', item: l, place: l.from, tz: l.start.tz, date: startDate(l) });
    if (l.end) anchors.push({ t: toUtc(l.end), at: 'arr', item: l, place: l.to, tz: l.end.tz, date: endDate(l) });
  }
  for (const s of stays) anchors.push({ t: toUtc(s.start), at: 'stay', item: s, place: s.place, tz: s.start.tz, date: startDate(s) });
  anchors.sort((a, b) => a.t - b.t || AT_ORDER[a.at] - AT_ORDER[b.at]);
  const driven = (a: number, b: number) =>
    cars.some((c) => {
      const s = toUtc(c.start);
      const e = c.end ? toUtc(c.end) : s;
      return s <= b && e >= a;
    });
  const out: Gap[] = [];
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const cur = anchors[i];
    // Leaving on a journey: in transit until it lands (a journey without an arrival time is taken at its word).
    if (prev.at === 'dep' || prev.item === cur.item) continue;
    if (!farApart(prev, cur) || driven(prev.t, cur.t)) continue;
    const abroad = !!countryForZone(prev.tz) && !!countryForZone(cur.tz) && countryForZone(prev.tz) !== countryForZone(cur.tz);
    out.push({
      id: `move:${prev.item.id}>${cur.item.id}`,
      kind: 'move',
      from: prev.date,
      to: cur.date < prev.date ? prev.date : cur.date,
      items: [prev.item, cur.item],
      fromPlace: placeName(prev.place),
      toPlace: placeName(cur.place),
      add: { kind: abroad ? 'flight' : 'train', date: prev.date, tz: prev.tz },
    });
  }
  return out;
}

// ------------------------------------------------------------------ clashes

const nightsBoth = (a: Item, b: Item): number => {
  if (!a.end || !b.end) return 0;
  const from = startDate(a) > startDate(b) ? startDate(a) : startDate(b);
  const to = endDate(a) < endDate(b) ? endDate(a) : endDate(b);
  return Math.max(0, daysBetween(from, to));
};

function stayClashes(items: readonly Item[]): Gap[] {
  const { stays } = parts(items);
  return overlaps(stays).map(([a, b]) => {
    const minutes = Math.round((Math.min(toUtc(a.end ?? a.start), toUtc(b.end ?? b.start)) - Math.max(toUtc(a.start), toUtc(b.start))) / MIN);
    const from = startDate(b) > startDate(a) ? startDate(b) : startDate(a);
    const to = endDate(a) < endDate(b) ? endDate(a) : endDate(b);
    return { id: `stays:${a.id}+${b.id}`, kind: 'stayClash' as const, from, to: to < from ? from : to, items: [a, b], minutes, nights: nightsBoth(a, b), add: null };
  });
}

function legClashes(items: readonly Item[]): Gap[] {
  const { legs } = parts(items);
  return findConnections(legs).clashes.map((c) => ({
    id: `legs:${c.first.id}+${c.second.id}`,
    kind: 'legClash' as const,
    from: startDate(c.second),
    to: startDate(c.second),
    items: [c.first, c.second],
    minutes: c.overlapMin,
    add: null,
  }));
}

/**
 * A stay's check-in after the journey that takes you on from there has left. The journey that brought you is the
 * last one landing on or before the check-in date (its own zone); the one after it (by departure) takes you on.
 */
function checkInLate(items: readonly Item[]): Gap[] {
  const { legs, stays } = parts(items);
  const out: Gap[] = [];
  for (const s of stays) {
    const ci = startDate(s);
    let brought = -1;
    let latest = -Infinity;
    legs.forEach((l, i) => {
      if (!l.end || endDate(l) > ci) return;
      const t = toUtc(l.end);
      if (t >= latest) {
        latest = t;
        brought = i;
      }
    });
    const next = legs[brought + 1];
    if (!next) continue;
    const leaves = toUtc(next.start);
    const checkIn = toUtc(s.start);
    if (leaves >= checkIn) continue;
    out.push({ id: `checkin:${s.id}>${next.id}`, kind: 'checkInLate', from: startDate(next), to: ci < startDate(next) ? startDate(next) : ci, items: [next, s], minutes: Math.round((checkIn - leaves) / MIN), add: null });
  }
  return out;
}

/** A journey landing after the check-out day of its stay: the first stay checking in at or after it leaves. */
function lateArrivals(items: readonly Item[]): Gap[] {
  const { legs, stays } = parts(items);
  const out: Gap[] = [];
  for (const l of legs) {
    if (!l.end) continue;
    const leaves = toUtc(l.start);
    const stay = stays.find((s) => toUtc(s.start) >= leaves);
    if (!stay?.end) continue;
    if (endDate(l) <= endDate(stay)) continue;
    out.push({ id: `arrive:${l.id}>${stay.id}`, kind: 'lateArrival', from: endDate(stay), to: endDate(l), items: [l, stay], add: null });
  }
  return out;
}

// ------------------------------------------------------------------ the way home

/**
 * True when the trip ends with a journey home. Abroad (any booking in a country other than home, by zone): the last
 * journey lands in the home country. A trip at home: it lands where the first journey left from (same place or
 * zone), or in the home zone. A last journey with no arrival time is taken at its word. A trip with no journeys
 * needs one home only when it has bookings abroad.
 */
export function hasWayHome(trip: Pick<Trip, 'homeTz' | 'items'>): boolean {
  const { usable, legs } = parts(trip.items ?? []);
  const home = countryForZone(trip.homeTz);
  const zones = usable.flatMap((i) => [i.start.tz, ...(i.end ? [i.end.tz] : [])]);
  const abroad = !!home && zones.some((z) => {
    const c = countryForZone(z);
    return !!c && c !== home;
  });
  if (!legs.length) return !abroad;
  const last = legs[legs.length - 1];
  if (!last.end) return true;
  const lands = countryForZone(last.end.tz);
  if (abroad) return lands === home;
  const first = legs[0];
  if (legs.length > 1 && placeMatch(last.to, first.from)) return true;
  return last.end.tz === trip.homeTz || (legs.length > 1 && last.end.tz === first.start.tz);
}

function wayHomeGap(trip: Trip): Gap[] {
  const { usable, legs } = parts(trip.items ?? []);
  if (!usable.some((i) => isTransport(i.kind) || i.kind === 'hotel')) return [];
  if (hasWayHome(trip)) return [];
  const last = legs[legs.length - 1];
  const lastBooked = usable.map(endDate).sort().pop() ?? trip.endDate;
  const date = isDate(trip.endDate) && trip.endDate > lastBooked ? trip.endDate : lastBooked;
  const tz = last ? (last.end ?? last.start).tz : (usable[usable.length - 1]?.start.tz ?? trip.homeTz);
  const home = countryForZone(trip.homeTz);
  const there = countryForZone(tz);
  return [{ id: 'home', kind: 'noWayHome', from: date, to: date, items: last ? [last] : [], add: { kind: home && there && home !== there ? 'flight' : 'train', date, tz: isValidZone(tz) ? tz : 'UTC' } }];
}

// ------------------------------------------------------------------ the whole list

const KIND_ORDER = Object.fromEntries(GAP_KINDS.map((k, i) => [k, i])) as Record<GapKind, number>;

export type GapsResult = { gaps: Gap[]; /** How many were found but dismissed on this phone. */ dismissed: number };

/** Every gap in the trip, by date then kind, without the ones dismissed on this phone. */
export function findGaps(trip: Trip, dismissed: readonly string[] = []): GapsResult {
  const items = trip.items ?? [];
  const all = [...nightGaps(trip), ...moveGaps(items), ...stayClashes(items), ...legClashes(items), ...checkInLate(items), ...lateArrivals(items), ...wayHomeGap(trip)];
  all.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  const off = new Set(dismissed);
  const gaps = all.filter((g) => !off.has(g.id));
  return { gaps, dismissed: all.length - gaps.length };
}

/** The night gap that includes `today` (a night's own local date), when tonight has no stay; else null. */
export function tonightGap(trip: Trip, today: LocalDate, dismissed: readonly string[] = []): Gap | null {
  return findGaps(trip, dismissed).gaps.find((g) => g.kind === 'night' && g.from <= today && today <= g.to) ?? null;
}

// ------------------------------------------------------------------ dismissals (phone only)

/** AsyncStorage key: { [tripId]: gap ids dismissed }. Never part of the trip or its .satchel file. */
export const GAPS_DISMISSED_KEY = 'satchel.gaps.dismissed.v1';
export type GapDismissals = Record<string, string[]>;
export const NO_DISMISSALS: GapDismissals = {};
/** Most ids kept per trip (oldest go first). */
export const MAX_DISMISSED = 200;

/** A trip's dismissed ids from stored data of any shape (bad entries dropped). */
export function dismissedFor(store: unknown, tripId: string): string[] {
  if (!store || typeof store !== 'object' || Array.isArray(store)) return [];
  const list = (store as Record<string, unknown>)[tripId];
  return Array.isArray(list) ? [...new Set(list.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200))] : [];
}

const tidy = (store: unknown): GapDismissals => {
  const out: GapDismissals = {};
  if (store && typeof store === 'object' && !Array.isArray(store)) for (const k of Object.keys(store)) {
    const list = dismissedFor(store, k);
    if (list.length) out[k] = list;
  }
  return out;
};

export function dismissGap(store: unknown, tripId: string, gapId: string): GapDismissals {
  const out = tidy(store);
  const list = [...dismissedFor(out, tripId).filter((x) => x !== gapId), gapId];
  out[tripId] = list.slice(-MAX_DISMISSED);
  return out;
}

/** Shows every dismissed gap of the trip again. */
export function restoreGaps(store: unknown, tripId: string): GapDismissals {
  const out = tidy(store);
  delete out[tripId];
  return out;
}

// ------------------------------------------------------------------ readiness

/**
 * The readiness row: warn with how many gaps (`done`) when there are any, pass when none. Null for a trip with no
 * journeys or stays yet (nothing to judge). The fix opens the first gap's add form, or its first booking.
 */
export function gapsCheck(trip: Trip, dismissed: readonly string[] = []): Check | null {
  const { usable } = parts(trip.items ?? []);
  if (!usable.some((i) => isTransport(i.kind) || i.kind === 'hotel')) return null;
  const { gaps } = findGaps(trip, dismissed);
  if (!gaps.length) return { id: 'gaps', status: 'pass', reason: 'ok', done: 0, total: 0, fix: null };
  const g = gaps[0];
  return {
    id: 'gaps',
    status: 'warn',
    reason: 'found',
    done: gaps.length,
    total: gaps.length,
    fix: { kind: 'gap', tripId: trip.id, ...(g.add ? { add: g.add } : g.items[0] ? { itemId: g.items[0].id } : {}) },
  };
}
