// T131 connections and layovers. Back-to-back journeys on a trip (flight, train, ferry or bus landing, then the next
// one leaving within 24 h from the same or a nearby place) and how long the change is, minute-exact across each
// leg's own IANA zone (tz.ts toUtc, so daylight-saving changes and the date line are handled). Each change is tight,
// OK or long by the traveller's own limits (Settings; defaults: tight under 60 min, or 90 min when the change crosses
// a border; long over 5 h). Legs that overlap in time are a clash (timeline.overlaps), never a layover.
// Also: the optional arrival / departure terminal and gate typed on a journey (Item.legInfo, carried in .satchel
// files), the readiness row for tight connections and the Your day pick. Pure TypeScript, offline, Node runs it.
import { airportByCode } from './airports.ts';
import { countryForZone, fold } from './emergency.ts';
import { isTransport, type Item, type LocalDate, type Place, type Trip } from './model.ts';
import { haversineMeters, validLatLon } from './poi.ts';
import type { Check } from './readiness.ts';
import { sortItems, zonesReadable } from './timeline.ts';
import { fromUtc, localDate, toUtc } from './tz.ts';

// ------------------------------------------------------------------ terminal and gate on a journey

/**
 * Typed by the traveller, all optional. dep*: where the journey leaves from; arr*: where it lands. A flight's
 * departure terminal and gate live in its airport fields (Item.airport, T74); depTerminal / depGate are only read for
 * a flight when those are empty.
 */
export type LegInfo = { depTerminal?: string; depGate?: string; arrTerminal?: string; arrGate?: string };
export const LEG_INFO_KEYS = ['depTerminal', 'depGate', 'arrTerminal', 'arrGate'] as const;
export type LegInfoKey = (typeof LEG_INFO_KEYS)[number];
/** Longest value kept ("Terminal 2", "B27", "Platform 9"). */
export const LEG_TEXT_MAX = 24;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const clean = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/\s+/g, ' ').trim().slice(0, LEG_TEXT_MAX).trim();
  return s || undefined;
};

/**
 * A stored or imported value as clean LegInfo, or undefined when nothing usable is left. Known keys with a bad value
 * are dropped; keys this build doesn't know are kept untouched (a newer Satchel may have written them).
 */
export function readLegInfo(raw: unknown): LegInfo | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!(LEG_INFO_KEYS as readonly string[]).includes(k)) out[k] = v;
  for (const k of LEG_INFO_KEYS) {
    const v = clean(raw[k]);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? (out as LegInfo) : undefined;
}

export type LegInfoDraft = Record<LegInfoKey, string>;

export function legInfoDraft(info: LegInfo | undefined): LegInfoDraft {
  const i = readLegInfo(info) ?? {};
  return { depTerminal: i.depTerminal ?? '', depGate: i.depGate ?? '', arrTerminal: i.arrTerminal ?? '', arrGate: i.arrGate ?? '' };
}

/**
 * The item to save with the form's terminal / gate fields: kept on a journey (flight, train, ferry, bus), dropped on
 * every other kind. Keys from `prev` this build doesn't know are kept.
 */
export function withLegInfo<I extends Item>(item: I, draft: LegInfoDraft, prev?: LegInfo): I {
  const { legInfo: _old, ...rest } = item;
  if (!isTransport(item.kind)) return rest as I;
  const merged = readLegInfo({ ...(isObj(prev) ? prev : {}), ...draft });
  return (merged ? { ...rest, legInfo: merged } : rest) as I;
}

/** Where the journey leaves from: its own departure terminal (a flight's airport terminal first). */
export function departureTerminal(i: Item): string | undefined {
  return (i.kind === 'flight' ? clean(i.airport?.terminal) : undefined) ?? clean(i.legInfo?.depTerminal);
}
export function departureGate(i: Item): string | undefined {
  return (i.kind === 'flight' ? clean(i.airport?.gate) : undefined) ?? clean(i.legInfo?.depGate);
}
export const arrivalTerminal = (i: Item): string | undefined => clean(i.legInfo?.arrTerminal);
export const arrivalGate = (i: Item): string | undefined => clean(i.legInfo?.arrGate);

/** "T1" / "Terminal 1" -> "1", so a line can say "terminal 1 to 2". Anything else is shown as typed. */
export function terminalLabel(s: string): string {
  const m = /^(?:t|term\.?|terminal)\s*[-.]?\s*([0-9]+[a-z]?|[a-z])$/i.exec(s.trim());
  return m ? m[1].toUpperCase() : s.trim();
}

const sameText = (a: string, b: string) => fold(a).replace(/[^a-z0-9]/g, '') === fold(b).replace(/[^a-z0-9]/g, '');

// ------------------------------------------------------------------ the traveller's limits (Settings)

export type LayoverPrefs = {
  /** Under this many minutes a change is tight. */
  tightMin: number;
  /** ...or under this many when the change crosses a border (passport control, security again). */
  tightCrossMin: number;
  /** Over this many minutes it is a long layover. */
  longMin: number;
};
export const LAYOVER_PREFS_KEY = 'satchel.layovers.v1';
export const DEFAULT_LAYOVER_PREFS: LayoverPrefs = { tightMin: 60, tightCrossMin: 90, longMin: 300 };
export const LAYOVER_STEP = 15;
export const MAX_TIGHT = 360;
export const MIN_LONG = 60;
export const MAX_LONG = 1440;

const minutesIn = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined;

/** Stored Settings from any build (or damaged storage) as complete, valid limits. */
export function normaliseLayoverPrefs(raw: unknown): LayoverPrefs {
  const o = isObj(raw) ? raw : {};
  return {
    tightMin: minutesIn(o.tightMin, 0, MAX_TIGHT) ?? DEFAULT_LAYOVER_PREFS.tightMin,
    tightCrossMin: minutesIn(o.tightCrossMin, 0, MAX_TIGHT) ?? DEFAULT_LAYOVER_PREFS.tightCrossMin,
    longMin: minutesIn(o.longMin, MIN_LONG, MAX_LONG) ?? DEFAULT_LAYOVER_PREFS.longMin,
  };
}

export const sameLayoverPrefs = (a: LayoverPrefs, b: LayoverPrefs) => a.tightMin === b.tightMin && a.tightCrossMin === b.tightCrossMin && a.longMin === b.longMin;

// ------------------------------------------------------------------ same or nearby place

/** Positions this close are the same stop (an airport's terminals, a station's entrances). */
export const SAME_PLACE_M = 2_000;
/** Positions this close are a nearby stop: a change of airport or station within one city. */
export const NEARBY_M = 80_000;

export type PlaceMatch = 'same' | 'nearby';

/** Three-letter codes written in capitals ("Singapore (SIN)", "SIN"), or a name that is only a code. */
function codesIn(name: string): string[] {
  const out = new Set<string>();
  for (const m of name.matchAll(/\b[A-Z]{3}\b/g)) out.add(m[0]);
  const whole = name.trim();
  if (/^[a-z]{3}$/i.test(whole)) out.add(whole.toUpperCase());
  return [...out];
}

const words = (s: string) => fold(s).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean);

/**
 * Whether a journey's arrival place and the next one's departure place are the same stop. Positions, when both are
 * saved, decide (within SAME_PLACE_M: same; within NEARBY_M: nearby; further: not a change). Otherwise the names: the
 * same name, a shared three-letter code, or one name inside the other ("Doha" and "Doha Hamad", or "SIN" and
 * "Singapore Changi" by the airport table) count as the same; names sharing their first word ("London LHR" and
 * "London LGW", "Tokyo Station" and "Tokyo Haneda") as nearby. Null otherwise.
 */
export function placeMatch(a: Place | undefined, b: Place | undefined): PlaceMatch | null {
  if (!a || !b) return null;
  if (validLatLon(a.lat, a.lon) && validLatLon(b.lat, b.lon)) {
    const m = haversineMeters({ lat: a.lat as number, lon: a.lon as number }, { lat: b.lat as number, lon: b.lon as number });
    return m <= SAME_PLACE_M ? 'same' : m <= NEARBY_M ? 'nearby' : null;
  }
  const na = (a.name ?? '').trim();
  const nb = (b.name ?? '').trim();
  if (!na || !nb) return null;
  if (sameText(na, nb)) return 'same';
  const ca = codesIn(na);
  const cb = codesIn(nb);
  if (ca.length && cb.length && ca.some((c) => cb.includes(c))) return 'same';
  const inside = (x: string, y: string) => !!x && !!y && (` ${y} `.includes(` ${x} `) || ` ${x} `.includes(` ${y} `));
  // A bare code ("SIN") reads as its city from the bundled airport table ("Singapore").
  // Otherwise the code itself is left out of the words ("Singapore (SIN)" -> "singapore").
  const label = (name: string, codes: string[]) => {
    if (/^[a-z]{3}$/i.test(name)) return words(airportByCode(codes[0] ?? '')?.city ?? name).join(' ');
    const drop = new Set(codes.map((c) => c.toLowerCase()));
    const w = words(name).filter((x) => !drop.has(x));
    return (w.length ? w : words(name)).join(' ');
  };
  const wa = label(na, ca);
  const wb = label(nb, cb);
  // Two different codes are two different stops, even in one city.
  const twoCodes = ca.length > 0 && cb.length > 0;
  if (!twoCodes && inside(wa, wb)) return 'same';
  const fa = wa.split(' ')[0] ?? '';
  const fb = wb.split(' ')[0] ?? '';
  return fa && fa === fb && fa.length > 3 && !GENERIC_WORDS.has(fa) ? 'nearby' : null;
}

/** First words that say nothing about the city ("Port", "Saint", "Central"). */
const GENERIC_WORDS = new Set(['port', 'saint', 'santa', 'santo', 'north', 'south', 'east', 'west', 'gare', 'central', 'airport', 'station', 'terminal', 'pier', 'ferry', 'main', 'grand', 'great', 'upper', 'lower', 'little']);

// ------------------------------------------------------------------ connections

/** The next journey must leave within this many minutes of the last one landing. */
export const MAX_CONNECTION_MIN = 24 * 60;

export type ConnectionStatus = 'tight' | 'ok' | 'long';

export type Connection = {
  /** `${arrive.id}>${depart.id}`, stable for keys. */
  id: string;
  arrive: Item;
  depart: Item;
  /** Real minutes between landing and leaving (each on its own zone's clock). */
  minutes: number;
  status: ConnectionStatus;
  /** The tight limit that applied (tightCrossMin when crossBorder). */
  limit: number;
  /** The two legs touch more than one country (by their zones). */
  crossBorder: boolean;
  /** 'nearby': a different station or airport, get across in the time. */
  match: PlaceMatch;
  /** The place to name ("Change at Singapore"). */
  place: string;
  /** Country (ISO 3166-1 alpha-2) of the change, by the departing leg's zone; null when unknown. */
  country: string | null;
  terminal: { from?: string; to?: string; change: boolean };
  gate: { from?: string; to?: string };
  arriveUtc: number;
  departUtc: number;
};

/** Two journeys that overlap in time: a clash to fix (shown by the timeline), never a layover. */
export type LegClash = { first: Item; second: Item; overlapMin: number };

const MIN = 60_000;

const journeys = (items: readonly Item[]) => sortItems(items.filter((i) => isTransport(i.kind) && zonesReadable(i)));

/** Tight / OK / long for a change of `minutes`, by the traveller's limits. */
export function classify(minutes: number, crossBorder: boolean, prefs: LayoverPrefs): { status: ConnectionStatus; limit: number } {
  const p = normaliseLayoverPrefs(prefs);
  const limit = crossBorder ? p.tightCrossMin : p.tightMin;
  if (minutes < limit) return { status: 'tight', limit };
  if (minutes > p.longMin) return { status: 'long', limit };
  return { status: 'ok', limit };
}

/** True when the two legs' zones put them in more than one country (unknown zones don't count either way). */
export function crossesBorder(a: Item, b: Item): boolean {
  const set = new Set<string>();
  for (const s of [a.start, a.end, b.start, b.end]) {
    const c = s ? countryForZone(s.tz) : null;
    if (c) set.add(c);
  }
  return set.size > 1;
}

/**
 * The trip's connections, in time order, and the journeys that clash. Each journey is paired with the one that leaves
 * next after it (by real start). A pair counts when the first has an arrival time, the second leaves no earlier than
 * that and within 24 h, and the arrival and departure places match (placeMatch). A journey that overlaps another
 * journey forms no connection at all: the trip shows the clash instead.
 */
export function findConnections(items: readonly Item[], prefs: LayoverPrefs = DEFAULT_LAYOVER_PREFS): { connections: Connection[]; clashes: LegClash[] } {
  const legs = journeys(items);
  const clashes: LegClash[] = [];
  const clashing = new Set<string>();
  for (let i = 0; i < legs.length; i++) {
    const a = legs[i];
    if (!a.end) continue;
    const aEnd = toUtc(a.end);
    for (let j = i + 1; j < legs.length; j++) {
      const b = legs[j];
      const bStart = toUtc(b.start);
      if (bStart >= aEnd) break;
      clashes.push({ first: a, second: b, overlapMin: Math.round((aEnd - bStart) / MIN) });
      clashing.add(a.id);
      clashing.add(b.id);
    }
  }
  const out: Connection[] = [];
  for (let i = 0; i + 1 < legs.length; i++) {
    const a = legs[i];
    const b = legs[i + 1];
    if (!a.end || clashing.has(a.id) || clashing.has(b.id)) continue;
    const arriveUtc = toUtc(a.end);
    const departUtc = toUtc(b.start);
    const minutes = Math.round((departUtc - arriveUtc) / MIN);
    if (minutes < 0 || minutes > MAX_CONNECTION_MIN) continue;
    const match = placeMatch(a.to, b.from);
    if (!match) continue;
    const crossBorder = crossesBorder(a, b);
    const { status, limit } = classify(minutes, crossBorder, prefs);
    const from = arrivalTerminal(a);
    const to = departureTerminal(b);
    out.push({
      id: `${a.id}>${b.id}`,
      arrive: a,
      depart: b,
      minutes,
      status,
      limit,
      crossBorder,
      match,
      place: b.from?.name?.trim() || a.to?.name?.trim() || '',
      country: countryForZone(b.start.tz),
      terminal: { ...(from ? { from } : {}), ...(to ? { to } : {}), change: !!(from && to && !sameText(terminalLabel(from), terminalLabel(to))) },
      gate: { ...(arrivalGate(a) ? { from: arrivalGate(a) } : {}), ...(departureGate(b) ? { to: departureGate(b) } : {}) },
      arriveUtc,
      departUtc,
    });
  }
  return { connections: out, clashes };
}

export const connections = (items: readonly Item[], prefs: LayoverPrefs = DEFAULT_LAYOVER_PREFS): Connection[] => findConnections(items, prefs).connections;

/** The connection that starts when this journey lands, by the arriving leg's id. */
export function connectionAfter(list: readonly Connection[], arriveId: string): Connection | undefined {
  return list.find((c) => c.arrive.id === arriveId);
}

/** The local date (arrival leg's own zone) the timeline shows the connection card on: the day the first leg lands. */
export const connectionDay = (c: Connection): LocalDate => localDate((c.arrive.end ?? c.arrive.start).local);

/** Whole hours and the minutes left over, for "1 h 25 min". */
export function splitMinutes(min: number): { h: number; m: number } {
  const t = Math.max(0, Math.round(min));
  return { h: Math.floor(t / 60), m: t % 60 };
}

/** Terminals for a line: a change ("1" to "2"), the same one, or nothing known. */
export type TerminalNote = { kind: 'change'; from: string; to: string } | { kind: 'same'; terminal: string } | null;
export function terminalNote(c: Connection): TerminalNote {
  const { from, to } = c.terminal;
  if (from && to) return c.terminal.change ? { kind: 'change', from: terminalLabel(from), to: terminalLabel(to) } : { kind: 'same', terminal: terminalLabel(to) };
  return null;
}

// ------------------------------------------------------------------ long layover ideas

/** Generic ideas, in this order. 'leave' always says it depends on the entry rules there. */
export const LONG_IDEAS = ['rest', 'eat', 'walk', 'leave'] as const;
export type LongIdea = (typeof LONG_IDEAS)[number];

// ------------------------------------------------------------------ readiness and Your day

/**
 * The readiness row: warn when any connection is tight (`done` = how many, `city` = their places, `minutes` = the
 * shortest), pass when every connection is OK or long. Null when the trip has no connections (no row at all).
 * The fix opens the departing leg of the first tight change.
 */
export function connectionsCheck(trip: Pick<Trip, 'items'>, prefs: LayoverPrefs = DEFAULT_LAYOVER_PREFS): Check | null {
  const list = connections(trip.items ?? [], prefs);
  if (!list.length) return null;
  const tight = list.filter((c) => c.status === 'tight');
  if (!tight.length) return { id: 'connections', status: 'pass', reason: 'ok', done: list.length, total: list.length, fix: null };
  const places = [...new Set(tight.map((c) => c.place).filter(Boolean))];
  return {
    id: 'connections',
    status: 'warn',
    reason: 'tight',
    done: tight.length,
    total: list.length,
    city: places.join(', '),
    minutes: Math.min(...tight.map((c) => c.minutes)),
    fix: { kind: 'connection', itemId: tight[0].depart.id },
  };
}

/**
 * Connections for the Your day card: the next leg has not left yet, and the landing or the leaving falls on `today`
 * in `zone` (the zone the traveller is in).
 */
export function briefConnections(trip: Pick<Trip, 'items'>, zone: string, today: LocalDate, now: number, prefs: LayoverPrefs = DEFAULT_LAYOVER_PREFS): Connection[] {
  return connections(trip.items ?? [], prefs).filter((c) => c.departUtc > now && (localDate(fromUtc(c.arriveUtc, zone)) === today || localDate(fromUtc(c.departUtc, zone)) === today));
}
