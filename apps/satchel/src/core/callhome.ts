// T114 Call home planner: people back home (name, IANA zone, optional phone, their awake hours) and the traveller's
// own awake hours; for each trip day, in that day's stop zone from the bookings, the stretches when both are awake
// ("good to call"), a 24 h strip of who is awake, "right now it's 03:10 for Mum - asleep", the next good window and
// tel: / sms: / facetime: links. Pure TypeScript (no React Native); zone offsets come from Intl through tz.ts.
//  - Kept on this phone only under CALLHOME_KEY (satchel.callhome.v1), never on the Trip and never in a .satchel
//    file (guard test in callhome.test.ts).
//  - Awake hours are 'HH:mm' to 'HH:mm' on each person's own clock; from later than to wraps midnight (22:00-02:00),
//    '00:00'-'24:00' is all day, and an equal from / to is not allowed.
//  - A trip day's zone is where the bookings put the traveller at 18:00 that day (journal.ts tripZoneAt; evening, when
//    calls home mostly happen, and after most travel-day arrivals), read on the previous day's clock; the day runs from local midnight to the next (23 or 25 h on a clock-change day).
//  - Windows are worked out a minute at a time from each zone's offset pieces (at most one offset change per day,
//    found by binary search), so half-hour and 45-minute zones (Adelaide, India, Nepal) and DST changes are exact.
//  - T116: a trip day's zone can be set by hand (an overnight flight day, a day trip across a border); kept in the
//    same phone-only store under `days` (trip id -> date -> zone), never on the Trip.
//  - T116: one day's result is cached by its inputs (person zone + hours, traveller hours, date + that day's zone),
//    so re-renders each minute and long trips don't redo the minute-by-minute pass on Hermes. Cached days are shared:
//    callers must not change them.
import { tripZoneAt } from './journal.ts';
import type { LocalDate, Trip } from './model.ts';
import { cleanPhone, type SafeContact } from './safecheck.ts';
import { addDays, dateRange, fromUtc, isValidZone, localDate, offsetMinutes, toUtc } from './tz.ts';

const MIN = 60_000;
const DAY_MIN = 1440;

/** The one phone-only storage key for the planner. */
export const CALLHOME_KEY = 'satchel.callhome.v1';
export const MAX_PEOPLE = 8;
export const NAME_MAX = 60;
/** Steppers move awake hours by this much. */
export const HOURS_STEP_MIN = 30;
/** A trip day takes the zone the bookings put the traveller in at this time that day. */
export const ZONE_CHECK_AT = '18:00';

/** Wall-clock awake hours, 'HH:mm' to 'HH:mm' ('24:00' allowed as the end). from > to wraps midnight. */
export type Hours = { from: string; to: string };
export const DEFAULT_HOURS: Hours = { from: '08:00', to: '22:00' };

export type CallPerson = {
  id: string;
  name: string;
  tz: string;
  /** '' when none saved; else digits with an optional leading +. */ phone: string;
  hours: Hours;
};
/** T116: zones set by hand for trip days, date ('YYYY-MM-DD') -> IANA zone. */
export type DayZones = Record<LocalDate, string>;
export type CallHomeStore = {
  people: CallPerson[];
  /** The traveller's own awake hours. */ me: Hours;
  /** T116: trip id -> its days with a zone set by hand. Missing on stores saved before T116. */
  days?: Record<string, DayZones>;
};
/** T116: caps on hand-set day zones (per trip, and trips kept). */
export const MAX_DAY_ZONES = 120;
export const MAX_ZONE_TRIPS = 40;
export const EMPTY_CALLHOME: CallHomeStore = { people: [], me: DEFAULT_HOURS };

// ------------------------------------------------------------------------------------------------- hours

const pad = (n: number) => String(n).padStart(2, '0');
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** 'HH:mm' to minutes after midnight (0..1440); null when not a real time. */
export function hoursMin(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && v <= DAY_MIN ? v : null;
}

/** Minutes after midnight to 'HH:mm'; 1440 stays '24:00'. */
export const clockOf = (min: number): string => (min === DAY_MIN ? '24:00' : `${pad(Math.floor(mod(min, DAY_MIN) / 60))}:${pad(mod(min, DAY_MIN) % 60)}`);

/** Usable hours: both real times, from below 24:00, and not the same time. */
export function validHours(h: unknown): h is Hours {
  if (!h || typeof h !== 'object') return false;
  const f = hoursMin((h as Hours).from);
  const t = hoursMin((h as Hours).to);
  return f !== null && t !== null && f < DAY_MIN && f !== t;
}

export const cleanHours = (h: unknown, fallback: Hours = DEFAULT_HOURS): Hours =>
  validHours(h) ? { from: (h as Hours).from, to: (h as Hours).to } : { ...fallback };

/** True when `h` crosses midnight (22:00-02:00). */
export const wrapsMidnight = (h: Hours): boolean => (hoursMin(h.from) ?? 0) > (hoursMin(h.to) ?? 0);

/** Awake at `minute` (0..1439) of the local day? */
export function awakeAt(h: Hours, minute: number): boolean {
  const f = hoursMin(h.from) ?? 480;
  const t = hoursMin(h.to) ?? 1320;
  return f < t ? minute >= f && minute < t : minute >= f || minute < t;
}

/** Awake minutes a day (for "14 h awake" hints and tests). */
export function awakeLength(h: Hours): number {
  const f = hoursMin(h.from) ?? 480;
  const t = hoursMin(h.to) ?? 1320;
  return f < t ? t - f : DAY_MIN - f + t;
}

/**
 * Moves one end of the hours by `delta` minutes (stepper), wrapping round the day. An end of '24:00' counts as
 * midnight. Refuses (returns the same hours) when the two ends would meet.
 */
export function stepHours(h: Hours, end: 'from' | 'to', delta: number): Hours {
  const next = mod((hoursMin(h[end]) ?? 0) + delta, DAY_MIN);
  const out: Hours = { ...h, [end]: end === 'to' && next === 0 ? '24:00' : clockOf(next) };
  return validHours(out) ? out : h;
}

// ------------------------------------------------------------------------------------------------- people

const cleanName = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim() : '');

/** Stored value -> store. Damaged people are dropped (no id, no name or an unreadable zone); bad hours go back to the default. */
export function cleanCallHome(raw: unknown): CallHomeStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { people: [], me: { ...DEFAULT_HOURS } };
  const r = raw as Record<string, unknown>;
  const people: CallPerson[] = [];
  const ids = new Set<string>();
  for (const p of Array.isArray(r.people) ? r.people : []) {
    if (people.length >= MAX_PEOPLE) break;
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const name = cleanName(o.name);
    if (typeof o.id !== 'string' || !o.id || ids.has(o.id) || !name || typeof o.tz !== 'string' || !isValidZone(o.tz)) continue;
    ids.add(o.id);
    people.push({ id: o.id, name, tz: o.tz, phone: cleanPhone(o.phone) ?? '', hours: cleanHours(o.hours) });
  }
  return withDays({ people, me: cleanHours(r.me) }, cleanDays(r.days));
}

// ------------------------------------------------------------------------------------------------- day zones (T116)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDays(raw: unknown): Record<string, DayZones> {
  const out: Record<string, DayZones> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [tripId, zones] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_ZONE_TRIPS) break;
    if (!tripId || !zones || typeof zones !== 'object' || Array.isArray(zones)) continue;
    const kept: DayZones = {};
    let n = 0;
    for (const [date, tz] of Object.entries(zones as Record<string, unknown>)) {
      if (n >= MAX_DAY_ZONES) break;
      if (!DATE_RE.test(date) || typeof tz !== 'string' || !isValidZone(tz)) continue;
      kept[date] = tz;
      n++;
    }
    if (n) out[tripId] = kept;
  }
  return out;
}

const NO_ZONES: DayZones = Object.freeze({}) as DayZones;

/** The hand-set day zones of one trip (one shared empty object for none, so memo deps stay put). */
export const dayZonesFor = (store: CallHomeStore, tripId: string): DayZones => (tripId && store.days?.[tripId]) || NO_ZONES;

/**
 * Sets (a real zone) or clears (null) the zone of one trip day. Refuses (same store back) a bad date, an unreadable
 * zone, a stand-in trip without an id, or a new entry past the caps.
 */
export function setDayZone(store: CallHomeStore, tripId: string, date: LocalDate, tz: string | null): CallHomeStore {
  if (!tripId || !DATE_RE.test(date)) return store;
  const all = { ...(store.days ?? {}) };
  const zones = { ...(all[tripId] ?? {}) };
  if (tz === null) {
    if (!(date in zones)) return store;
    delete zones[date];
  } else {
    if (!isValidZone(tz)) return store;
    if (!(date in zones) && Object.keys(zones).length >= MAX_DAY_ZONES) return store;
    if (!(tripId in all) && Object.keys(all).length >= MAX_ZONE_TRIPS) return store;
    zones[date] = tz;
  }
  if (Object.keys(zones).length) all[tripId] = zones;
  else delete all[tripId];
  return withDays(store, all);
}

/** The store with `all` as its day zones (no `days` field when there are none). */
function withDays(store: CallHomeStore, all: Record<string, DayZones>): CallHomeStore {
  const out: CallHomeStore = { people: store.people, me: store.me };
  if (Object.keys(all).length) out.days = all;
  return out;
}

/** Drops the hand-set zones of a trip (e.g. all at once from the planner). */
export function clearDayZones(store: CallHomeStore, tripId: string): CallHomeStore {
  if (!store.days?.[tripId]) return store;
  const all = { ...store.days };
  delete all[tripId];
  return withDays(store, all);
}

export type PersonDraft = { name: string; tz: string; phone: string; hours: Hours };
export type DraftError = 'name' | 'tz' | 'phone' | 'hours';

/** Problems with a draft (empty when it can be saved). An empty phone is fine; a typed one must be dialable. */
export function draftErrors(d: PersonDraft): DraftError[] {
  const out: DraftError[] = [];
  if (!cleanName(d.name)) out.push('name');
  if (!isValidZone(d.tz)) out.push('tz');
  if (d.phone.trim() && !cleanPhone(d.phone)) out.push('phone');
  if (!validHours(d.hours)) out.push('hours');
  return out;
}

export type SaveResult = { ok: true; store: CallHomeStore } | { ok: false; reason: DraftError | 'full' };

/** Adds (no `id` match) or updates a person from a draft. */
export function savePerson(store: CallHomeStore, d: PersonDraft, id: string): SaveResult {
  const err = draftErrors(d)[0];
  if (err) return { ok: false, reason: err };
  const person: CallPerson = { id, name: cleanName(d.name), tz: d.tz, phone: cleanPhone(d.phone) ?? '', hours: { ...d.hours } };
  const at = store.people.findIndex((p) => p.id === id);
  if (at < 0 && store.people.length >= MAX_PEOPLE) return { ok: false, reason: 'full' };
  const people = at < 0 ? [...store.people, person] : store.people.map((p, i) => (i === at ? person : p));
  return { ok: true, store: { ...store, people } };
}

export const removePerson = (store: CallHomeStore, id: string): CallHomeStore => ({ ...store, people: store.people.filter((p) => p.id !== id) });

export const draftOf = (p: CallPerson): PersonDraft => ({ name: p.name, tz: p.tz, phone: p.phone, hours: { ...p.hours } });
export const newDraft = (tz: string): PersonDraft => ({ name: '', tz: isValidZone(tz) ? tz : 'UTC', phone: '', hours: { ...DEFAULT_HOURS } });

/** Trusted contacts (I'm safe) not yet in the planner (matched by phone), for "Import from trusted contacts". */
export function importable(contacts: readonly SafeContact[], store: CallHomeStore): SafeContact[] {
  const have = new Set(store.people.map((p) => p.phone).filter(Boolean));
  return contacts.filter((c) => !have.has(c.phone));
}

/** A draft from one trusted contact: name and phone; the zone starts at the trip's home zone (the person can change it). */
export const draftFromContact = (c: SafeContact, homeTz: string): PersonDraft => ({ ...newDraft(homeTz), name: c.name, phone: c.phone });

// ------------------------------------------------------------------------------------------------- links

export type CallLinks = { call: string; message: string; facetime: string };

/** tel:, sms: and facetime: links for the person's phone; null without a dialable number. */
export function callLinks(phone: string): CallLinks | null {
  const n = cleanPhone(phone);
  if (!n) return null;
  return { call: `tel:${n}`, message: `sms:${n}`, facetime: `facetime:${n}` };
}

// ------------------------------------------------------------------------------------------------- zone maths

type Piece = { from: number; to: number; offset: number };

/** Offset pieces of `tz` over [a, b): one piece, or two when the clock changes inside (found to the minute). */
function pieces(tz: string, a: number, b: number): Piece[] {
  const oa = offsetMinutes(tz, a);
  const ob = offsetMinutes(tz, b - MIN);
  if (oa === ob) return [{ from: a, to: b, offset: oa }];
  let lo = a;
  let hi = b - MIN;
  while (hi - lo > MIN) {
    const mid = lo + Math.floor((hi - lo) / MIN / 2) * MIN;
    if (offsetMinutes(tz, mid) === oa) lo = mid;
    else hi = mid;
  }
  return [
    { from: a, to: hi, offset: oa },
    { from: hi, to: b, offset: ob },
  ];
}

/** Local minute of the day for each minute of [a, b) in `tz`. */
function localMinutes(tz: string, a: number, b: number): Int16Array {
  const n = Math.round((b - a) / MIN);
  const out = new Int16Array(n);
  for (const p of pieces(tz, a, b)) {
    for (let t = p.from; t < p.to; t += MIN) {
      const k = Math.round((t - a) / MIN);
      out[k] = mod(Math.floor(t / MIN) + p.offset, DAY_MIN);
    }
  }
  return out;
}

/** Strip states: who is awake. */
export type Awake = 'both' | 'you' | 'them' | 'neither';
export type Run = { startUtc: number; endUtc: number; state: Awake };

/** Runs of who-is-awake over [a, b) for the traveller in `meTz` and a person in `themTz`. */
export function awakeRuns(a: number, b: number, meTz: string, me: Hours, themTz: string, them: Hours): Run[] {
  if (!(b > a) || !isValidZone(meTz) || !isValidZone(themTz)) return [];
  const mine = localMinutes(meTz, a, b);
  const theirs = localMinutes(themTz, a, b);
  const runs: Run[] = [];
  for (let k = 0; k < mine.length; k++) {
    const y = awakeAt(me, mine[k]);
    const th = awakeAt(them, theirs[k]);
    const state: Awake = y && th ? 'both' : y ? 'you' : th ? 'them' : 'neither';
    const t = a + k * MIN;
    const last = runs[runs.length - 1];
    if (last && last.state === state) last.endUtc = t + MIN;
    else runs.push({ startUtc: t, endUtc: t + MIN, state });
  }
  return runs;
}

// ------------------------------------------------------------------------------------------------- days

export type CallWindow = {
  startUtc: number;
  endUtc: number;
  /** On the traveller's clock that day ('24:00' when it runs to the end of the day). */
  youFrom: string;
  youTo: string;
  /** On the person's clock. */
  themFrom: string;
  themTo: string;
  /** Carried on from the evening before / carries on past midnight into the next day. */
  fromBefore: boolean;
  intoNext: boolean;
};

export type CallDay = {
  date: LocalDate;
  /** The traveller's zone that day. */
  tz: string;
  startUtc: number;
  endUtc: number;
  runs: Run[];
  windows: CallWindow[];
  /** T116: the zone was set by hand for this day (not from the bookings). */
  manual?: boolean;
};

/** The traveller's zone on `date`: where the bookings put them at 18:00, read on the clock of `prevTz`. */
export function zoneOnDate(trip: Trip, date: LocalDate, prevTz: string): string {
  const base = isValidZone(prevTz) ? prevTz : isValidZone(trip.homeTz) ? trip.homeTz : 'UTC';
  return tripZoneAt(trip, toUtc({ local: `${date}T${ZONE_CHECK_AT}`, tz: base }));
}

/** T116: cache of worked-out days by their inputs; oldest entries go first past the cap. */
const DAY_CACHE_MAX = 512;
const dayCache = new Map<string, CallDay>();

/** Empties the day cache (tests). */
export function clearCallDayCache(): void {
  dayCache.clear();
}
/** Days held in the cache (tests). */
export const callDayCacheSize = (): number => dayCache.size;

/** Who is awake and the good windows for one local day in `tz` (cached by its inputs; don't change the result). */
export function callDay(date: LocalDate, tz: string, me: Hours, person: Pick<CallPerson, 'tz' | 'hours'>): CallDay {
  const key = `${date}|${tz}|${me.from}-${me.to}|${person.tz}|${person.hours.from}-${person.hours.to}`;
  const hit = dayCache.get(key);
  if (hit) return hit;
  const day = computeDay(date, tz, me, person);
  if (dayCache.size >= DAY_CACHE_MAX) dayCache.delete(dayCache.keys().next().value as string);
  dayCache.set(key, day);
  return day;
}

function computeDay(date: LocalDate, tz: string, me: Hours, person: Pick<CallPerson, 'tz' | 'hours'>): CallDay {
  const startUtc = toUtc({ local: `${date}T00:00`, tz });
  const endUtc = toUtc({ local: `${addDays(date, 1)}T00:00`, tz });
  const runs = awakeRuns(startUtc, endUtc, tz, me, person.tz, person.hours);
  // Both awake at one minute (for whether a window runs on past either end of the day).
  const both = (utc: number) => {
    const m = (z: string) => mod(Math.floor(utc / MIN) + offsetMinutes(z, utc), DAY_MIN);
    return awakeAt(me, m(tz)) && awakeAt(person.hours, m(person.tz));
  };
  const windows: CallWindow[] = runs
    .filter((r) => r.state === 'both')
    .map((r) => ({
      startUtc: r.startUtc,
      endUtc: r.endUtc,
      youFrom: fromUtc(r.startUtc, tz).slice(11, 16),
      youTo: r.endUtc === endUtc ? '24:00' : fromUtc(r.endUtc, tz).slice(11, 16),
      themFrom: fromUtc(r.startUtc, person.tz).slice(11, 16),
      themTo: fromUtc(r.endUtc, person.tz).slice(11, 16),
      fromBefore: r.startUtc === startUtc && both(startUtc - MIN),
      intoNext: r.endUtc === endUtc && both(endUtc),
    }));
  return { date, tz, startUtc, endUtc, runs, windows };
}

/** A day in the hand-set zone when there is one (flagged `manual`), else the cached day as it is. */
function dayIn(date: LocalDate, booked: string, zones: DayZones, me: Hours, person: Pick<CallPerson, 'tz' | 'hours'>): CallDay {
  const set = zones[date];
  if (set && set !== booked && isValidZone(set)) return { ...callDay(date, set, me, person), manual: true };
  return callDay(date, booked, me, person);
}

/**
 * Every trip day (start to end date), each in its own stop zone, or the zone set by hand for that day (T116; it
 * also becomes the clock the next day's 18:00 check is read on). Empty for a trip without real dates.
 */
export function tripCallDays(trip: Trip, me: Hours, person: Pick<CallPerson, 'tz' | 'hours'>, zones: DayZones = {}): CallDay[] {
  if (!(trip.startDate <= trip.endDate) || !DATE_RE.test(trip.startDate) || !DATE_RE.test(trip.endDate)) return [];
  let prev = isValidZone(trip.homeTz) ? trip.homeTz : 'UTC';
  return dateRange(trip.startDate, trip.endDate).map((date) => {
    const day = dayIn(date, zoneOnDate(trip, date, prev), zones, me, person);
    prev = day.tz;
    return day;
  });
}

/** Today (where the bookings put the traveller now) and the following days, each in its own zone. */
export function daysFrom(trip: Trip, now: number, me: Hours, person: Pick<CallPerson, 'tz' | 'hours'>, count = 2, zones: DayZones = {}): CallDay[] {
  let prev = tripZoneAt(trip, now);
  const today = localDate(fromUtc(now, prev));
  const out: CallDay[] = [];
  for (let k = 0; k < count; k++) {
    const date = addDays(today, k);
    const day = dayIn(date, k === 0 ? prev : zoneOnDate(trip, date, prev), zones, me, person);
    prev = day.tz;
    out.push(day);
  }
  return out;
}

export type Span = { startUtc: number; endUtc: number };

/** All windows of the days as real stretches, overlapping or touching ones (across midnight) joined. */
export function joinedWindows(days: readonly CallDay[]): Span[] {
  const all = days.flatMap((d) => d.windows.map((w) => ({ startUtc: w.startUtc, endUtc: w.endUtc }))).sort((a, b) => a.startUtc - b.startUtc);
  const out: Span[] = [];
  for (const w of all) {
    const last = out[out.length - 1];
    if (last && w.startUtc <= last.endUtc) last.endUtc = Math.max(last.endUtc, w.endUtc);
    else out.push({ ...w });
  }
  return out;
}

/** The window under way at `now`, else the next one; null when none in the days given. */
export function nextWindow(days: readonly CallDay[], now: number): (Span & { now: boolean }) | null {
  const w = joinedWindows(days).find((s) => s.endUtc > now);
  return w ? { ...w, now: now >= w.startUtc } : null;
}

// ------------------------------------------------------------------------------------------------- right now

export type PersonNow = { time: string; awake: boolean; /** Their calendar day against the traveller's: -1, 0 or +1. */ dayDiff: number };

/** "It's 03:10 for Mum - asleep": their clock, awake by their hours, and whether it's already tomorrow there. */
export function personNow(person: Pick<CallPerson, 'tz' | 'hours'>, youTz: string, now: number): PersonNow | null {
  if (!isValidZone(person.tz)) return null;
  const wall = fromUtc(now, person.tz);
  const minute = Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
  const mine = localDate(fromUtc(now, isValidZone(youTz) ? youTz : 'UTC'));
  const theirs = localDate(wall);
  return { time: wall.slice(11, 16), awake: awakeAt(person.hours, minute), dayDiff: theirs > mine ? 1 : theirs < mine ? -1 : 0 };
}

// ------------------------------------------------------------------------------------------------- Your day row

export type BriefCall = {
  person: CallPerson;
  kind: 'now' | 'later' | 'none';
  /** Traveller's clock: until when (now) or from when (later). */
  at: string;
  /** 0 today, 1 tomorrow (later only). */
  dayOffset: number;
};

/**
 * One line for "Your day": the first person callable now ("Good time to call Mum until 21:00"), else the person with
 * the soonest window today or tomorrow, else "no good time" for the first person. Null with nobody saved.
 */
export function briefCall(trip: Trip, store: CallHomeStore, now: number): BriefCall | null {
  if (!store.people.length) return null;
  let best: { p: CallPerson; w: Span & { now: boolean }; tz: string; today: LocalDate } | null = null;
  for (const p of store.people) {
    const days = daysFrom(trip, now, store.me, p, 2, dayZonesFor(store, trip.id));
    const w = nextWindow(days, now);
    if (!w) continue;
    if (!best || (w.now && !best.w.now) || (w.now === best.w.now && w.startUtc < best.w.startUtc)) best = { p, w, tz: days[0].tz, today: days[0].date };
  }
  if (!best) return { person: store.people[0], kind: 'none', at: '', dayOffset: 0 };
  const { p, w, tz, today } = best;
  if (w.now) {
    const endWall = fromUtc(w.endUtc, tz);
    const at = localDate(endWall) > today && endWall.slice(11, 16) === '00:00' ? '24:00' : endWall.slice(11, 16);
    return { person: p, kind: 'now', at, dayOffset: 0 };
  }
  const startWall = fromUtc(w.startUtc, tz);
  return { person: p, kind: 'later', at: startWall.slice(11, 16), dayOffset: localDate(startWall) > today ? 1 : 0 };
}

// ------------------------------------------------------------------------------------------------- strip helpers

/** Where a UTC instant sits along a day's strip, 0..1. */
export const stripAt = (day: Pick<CallDay, 'startUtc' | 'endUtc'>, utc: number): number =>
  Math.min(1, Math.max(0, (utc - day.startUtc) / (day.endUtc - day.startUtc || 1)));

/** Hour marks for the strip (00, 06, 12, 18 on the day's own clock; a skipped hour is left out). */
export function stripTicks(day: Pick<CallDay, 'date' | 'tz' | 'startUtc' | 'endUtc'>): { label: string; at: number }[] {
  return ['00:00', '06:00', '12:00', '18:00']
    .map((label) => {
      const utc = toUtc({ local: `${day.date}T${label}`, tz: day.tz });
      return { label, at: stripAt(day, utc), ok: fromUtc(utc, day.tz).slice(11, 16) === label };
    })
    .filter((x) => x.ok)
    .map(({ label, at }) => ({ label, at }));
}

/** Hours a day lasts on the traveller's clock (23 / 24 / 25). */
export const dayHours = (day: Pick<CallDay, 'startUtc' | 'endUtc'>): number => Math.round((day.endUtc - day.startUtc) / 3_600_000);
