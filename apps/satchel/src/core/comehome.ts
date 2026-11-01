// T128 "Coming home": the mirror of Leaving home (T124, src/core/leavehome.ts) for the end of a trip. Pure TypeScript
// (no React Native), read defensively.
//
// - Two lists from a fixed template plus the traveller's own rows: "Before you head home" (check out, hand back keys
//   and cards, find passports, chargers, leftover coins, duty-free and customs) due on the final departure's clock,
//   and "Home again" (unpack, laundry, back up photos, close out spending and settle up, write the recap, rate the
//   trip) for the day after you get back. Template rows can be renamed, removed and put back. The lists and the
//   trip rating live on the Trip as `comingHome` and travel in .satchel files (optional; older trips have none).
// - Final departure: the last journey of the trip by its real instant (flight / train / ferry / bus, compared across
//   their own zones), else the whole of the end date in the home zone. "Today" / "tomorrow" are counted on the
//   departure's own clock (where you are when you leave), never the phone's zone. The "Home again" day is the day
//   after the journey arrives, on the arrival's clock (that is home).
// - The duty-free reminder reads src/content/comehome.json (one official page per home country, an https source
//   and an ISO checked date, always "verify before you fly"); the home country comes from Settings.
import type { Item, LocalDate, Stamp, Trip } from './model.ts';
import { TRANSPORT_KINDS } from './model.ts';
import { span, zonesReadable } from './timeline.ts';
import { addDays, daysBetween, fromUtc, isValidZone, localDate, localTime, toUtc } from './tz.ts';

// ------------------------------------------------------------------ model

export const COME_LISTS = ['before', 'after'] as const;
export type ComeList = (typeof COME_LISTS)[number];

/** Template rows per list, in the order they show. Words live in src/i18n/en/comehome.ts as `comehome.tpl.<id>`. */
export const COME_TEMPLATE = {
  before: ['checkout', 'keys', 'passports', 'chargers', 'coins', 'customs'],
  after: ['unpack', 'laundry', 'photos', 'spending', 'recap', 'rate'],
} as const;
export type ComeTemplateId = (typeof COME_TEMPLATE)[ComeList][number];
const ALL_TPL: readonly ComeTemplateId[] = [...COME_TEMPLATE.before, ...COME_TEMPLATE.after];

/** Where a template row points: another screen of the trip, the allowance card, or the rating stars. */
export type ComeLink = 'cash' | 'customs' | 'spending' | 'recap' | 'rate';
export const COME_LINKS: Partial<Record<ComeTemplateId, ComeLink>> = { coins: 'cash', customs: 'customs', spending: 'spending', recap: 'recap', rate: 'rate' };

/** One row: a template row (`tpl`, optionally renamed by `label`) or the traveller's own (`label` only). */
export type ComeRow = { id: string; list: ComeList; tpl?: ComeTemplateId; label?: string; done: boolean };

export type ComingHome = {
  rows: ComeRow[];
  /** How the trip was, 1 to 5 (the "rate the trip" row). */
  rating?: number;
  updatedAt?: string;
};

export const MAX_ROWS = 60;
export const MAX_TEXT = 500;

const isStr = (x: unknown): x is string => typeof x === 'string';
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isList = (x: unknown): x is ComeList => x === 'before' || x === 'after';
const isTpl = (x: unknown): x is ComeTemplateId => isStr(x) && (ALL_TPL as readonly string[]).includes(x);
const isDate = (x: unknown): x is LocalDate => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x);
const isRating = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5;
const clip = (s: string) => s.slice(0, MAX_TEXT);

/** The list a template row belongs to. */
export const tplList = (tpl: ComeTemplateId): ComeList => ((COME_TEMPLATE.before as readonly string[]).includes(tpl) ? 'before' : 'after');

// ------------------------------------------------------------------ reading (defensive)

function cleanRow(x: unknown): ComeRow | null {
  if (!isObj(x) || !isStr(x.id) || !x.id) return null;
  const tpl = isTpl(x.tpl) ? x.tpl : undefined;
  const label = isStr(x.label) && x.label.trim() ? clip(x.label) : undefined;
  if (!tpl && !label) return null;
  // A template row always sits in its own list; an own row without a readable list goes on "before".
  const list: ComeList = tpl ? tplList(tpl) : isList(x.list) ? x.list : 'before';
  return { ...(x as object), id: x.id, list, ...(tpl ? { tpl } : {}), ...(label ? { label } : {}), done: x.done === true } as ComeRow;
}

/** The trip's lists and rating, cleaned (null when it has none or it's unreadable). Unknown fields are kept. */
export function readComingHome(trip: Pick<Trip, 'comingHome'>): ComingHome | null {
  const raw: unknown = trip.comingHome;
  if (!isObj(raw)) return null;
  const seen = new Set<string>();
  const rows = (Array.isArray(raw.rows) ? raw.rows : [])
    .map(cleanRow)
    .filter((r): r is ComeRow => !!r && !seen.has(r.id) && !!seen.add(r.id))
    .slice(0, MAX_ROWS);
  const { rows: _r, rating, updatedAt, ...rest } = raw;
  return { ...rest, rows, ...(isRating(rating) ? { rating } : {}), ...(isStr(updatedAt) ? { updatedAt } : {}) } as ComingHome;
}

/** A file's `comingHome` (absent on older files), cleaned like the store; undefined when empty. */
export function readFileComingHome(raw: unknown): ComingHome | undefined {
  const ch = readComingHome({ comingHome: raw as ComingHome });
  return ch && (ch.rows.length || ch.rating) ? ch : undefined;
}

export const rowsOf = (ch: ComingHome | null, list: ComeList): ComeRow[] => (ch?.rows ?? []).filter((r) => r.list === list);

// ------------------------------------------------------------------ editing (each returns a new Trip)

type NewId = (prefix: string) => string;

/** A fresh pair of lists from the template (every row open). */
export function templateRows(newId: NewId): ComeRow[] {
  return COME_LISTS.flatMap((list) => COME_TEMPLATE[list].map((tpl) => ({ id: newId('ch'), list, tpl, done: false })));
}

function put(trip: Trip, ch: ComingHome, now: string): Trip {
  return { ...trip, comingHome: { ...ch, updatedAt: now } };
}

const current = (trip: Trip): ComingHome => readComingHome(trip) ?? { rows: [] };

/** Starts both lists from the template (a trip that already has rows keeps them). */
export function startComingHome(trip: Trip, newId: NewId, now = new Date().toISOString()): Trip {
  const ch = readComingHome(trip);
  if (ch && ch.rows.length) return trip;
  return put(trip, { ...(ch ?? {}), rows: templateRows(newId) }, now);
}

export function setRowDone(trip: Trip, id: string, done: boolean, now = new Date().toISOString()): Trip {
  const ch = current(trip);
  return put(trip, { ...ch, rows: ch.rows.map((r) => (r.id === id ? { ...r, done } : r)) }, now);
}

/** Adds the traveller's own row at the end of one list (blank words are ignored). */
export function addOwnRow(trip: Trip, list: ComeList, label: string, newId: NewId, now = new Date().toISOString()): Trip {
  const words = label.trim();
  const ch = current(trip);
  if (!words || !isList(list) || ch.rows.length >= MAX_ROWS) return trip;
  return put(trip, { ...ch, rows: [...ch.rows, { id: newId('ch'), list, label: clip(words), done: false }] }, now);
}

/** Renames a row; blank words put a template row back to its own words (an own row keeps its old words). */
export function renameRow(trip: Trip, id: string, label: string, now = new Date().toISOString()): Trip {
  const words = label.trim();
  const ch = current(trip);
  const rows = ch.rows.map((r) => {
    if (r.id !== id) return r;
    if (words) return { ...r, label: clip(words) };
    if (!r.tpl) return r;
    const { label: _l, ...rest } = r;
    return rest;
  });
  return put(trip, { ...ch, rows }, now);
}

export function removeRow(trip: Trip, id: string, now = new Date().toISOString()): Trip {
  const ch = current(trip);
  return put(trip, { ...ch, rows: ch.rows.filter((r) => r.id !== id) }, now);
}

/** Template rows of one list that aren't on it (removed earlier), in template order. */
export function missingTemplate(ch: ComingHome | null, list: ComeList): ComeTemplateId[] {
  const have = new Set(rowsOf(ch, list).map((r) => r.tpl).filter(Boolean));
  return COME_TEMPLATE[list].filter((t) => !have.has(t));
}

/** Puts one list's removed template rows back (open), each in its template position among that list's template rows. */
export function restoreTemplate(trip: Trip, list: ComeList, newId: NewId, now = new Date().toISOString()): Trip {
  const ch = current(trip);
  const missing = missingTemplate(ch, list);
  if (!missing.length) return trip;
  const order: readonly string[] = COME_TEMPLATE[list];
  const rows = [...ch.rows];
  for (const tpl of missing) {
    const pos = order.indexOf(tpl);
    let at = rows.findIndex((r) => r.list === list && r.tpl && order.indexOf(r.tpl) > pos);
    if (at < 0) {
      // After the list's last template row, else before its first own row, else at the end of everything.
      const lastTpl = rows.map((r) => r.list === list && !!r.tpl).lastIndexOf(true);
      const firstOwn = rows.findIndex((r) => r.list === list);
      at = lastTpl >= 0 ? lastTpl + 1 : firstOwn >= 0 ? firstOwn : rows.length;
    }
    rows.splice(at, 0, { id: newId('ch'), list, tpl, done: false });
  }
  return put(trip, { ...ch, rows }, now);
}

export function untickList(trip: Trip, list: ComeList, now = new Date().toISOString()): Trip {
  const ch = current(trip);
  return put(trip, { ...ch, rows: ch.rows.map((r) => (r.list === list ? { ...r, done: false } : r)) }, now);
}

/** Sets the trip rating (1-5), or clears it with null. Rating ticks the "rate the trip" row; clearing leaves it. */
export function setRating(trip: Trip, rating: number | null, now = new Date().toISOString()): Trip {
  const ch = current(trip);
  const { rating: _old, ...rest } = ch;
  if (rating === null) return put(trip, rest, now);
  if (!isRating(rating)) return trip;
  return put(trip, { ...rest, rating, rows: rest.rows.map((r) => (r.tpl === 'rate' ? { ...r, done: true } : r)) }, now);
}

// ------------------------------------------------------------------ progress

export type ComeProgress = { done: number; total: number; open: number };

export function comeProgress(ch: ComingHome | null, list: ComeList): ComeProgress {
  const rows = rowsOf(ch, list);
  const done = rows.filter((r) => r.done).length;
  return { done, total: rows.length, open: rows.length - done };
}

// ------------------------------------------------------------------ due time

/**
 * The trip's final departure: when you head home. `item` is absent for the end-date fallback, where `at` is the end
 * of the end date (the whole last day counts as "today"). `home` is the "Home again" day on `homeTz`'s clock.
 */
export type FinalDeparture = { at: number; stamp: Stamp; item?: Item; home: LocalDate; homeTz: string };

/**
 * The last journey by its real start (flight / train / ferry / bus, each read in its own zone; bookings with an
 * unreadable zone are skipped), else the end date in the home zone. Null only when nothing can be placed in time.
 */
export function finalDeparture(trip: Pick<Trip, 'items' | 'endDate' | 'homeTz'>): FinalDeparture | null {
  const journeys = (trip.items ?? []).filter((i) => TRANSPORT_KINDS.includes(i.kind) && zonesReadable(i));
  const item = journeys.reduce<Item | null>((best, i) => (!best || span(i).start > span(best).start || (span(i).start === span(best).start && span(i).end > span(best).end) ? i : best), null);
  if (item) {
    const arrive = item.end ?? item.start;
    return { at: span(item).start, stamp: item.start, item, home: addDays(localDate(arrive.local), 1), homeTz: arrive.tz };
  }
  if (!isDate(trip.endDate)) return null;
  const tz = isValidZone(trip.homeTz) ? trip.homeTz : 'UTC';
  const next = addDays(trip.endDate, 1);
  return { at: toUtc({ local: `${next}T00:00`, tz }), stamp: { local: `${trip.endDate}T00:00`, tz }, home: next, homeTz: tz };
}

/** The last stay that ends by the final departure: "check out of {name} by {time}" (its own clock). */
export type Checkout = { name: string; date: LocalDate; time: string; tz: string };

export function lastCheckout(trip: Pick<Trip, 'items' | 'endDate' | 'homeTz'>, dep: FinalDeparture | null = finalDeparture(trip)): Checkout | null {
  const stays = (trip.items ?? []).filter((i) => i.kind === 'hotel' && i.end && zonesReadable(i) && (!dep || span(i).end <= dep.at + 12 * 3600_000));
  const last = stays.reduce<Item | null>((best, i) => (!best || span(i).end > span(best).end ? i : best), null);
  if (!last || !last.end) return null;
  return { name: last.place?.name?.trim() || last.title.trim(), date: localDate(last.end.local), time: localTime(last.end.local), tz: last.end.tz };
}

/** Before you leave: today / tomorrow / later. After the departure: travelling (not home yet a day), home (the day after), done. */
export type ComeWhen = 'today' | 'tomorrow' | 'later' | 'travelling' | 'home' | 'done';

export type ComeDue = {
  when: ComeWhen;
  /** Whole days from today to the departure day, on the departure's clock (negative once it's past). */
  days: number;
  dep: FinalDeparture;
  /** Departure time on its own clock ('HH:mm'), empty for the end-date fallback. */
  time: string;
  before: ComeProgress;
  after: ComeProgress;
  started: boolean;
};

export function comeDue(trip: Trip, now: number): ComeDue | null {
  const dep = finalDeparture(trip);
  if (!dep) return null;
  const today = localDate(fromUtc(now, dep.stamp.tz));
  const days = daysBetween(today, localDate(dep.stamp.local));
  let when: ComeWhen;
  if (now < dep.at) when = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : 'later';
  else {
    const homeToday = localDate(fromUtc(now, dep.homeTz));
    when = homeToday < dep.home ? 'travelling' : homeToday === dep.home ? 'home' : 'done';
  }
  const ch = readComingHome(trip);
  return { when, days, dep, time: dep.item ? localTime(dep.stamp.local) : '', before: comeProgress(ch, 'before'), after: comeProgress(ch, 'after'), started: !!ch && ch.rows.length > 0 };
}

/**
 * The trip card pill / Your day nudge: "Heading home today / tomorrow" while the "Before you head home" list isn't
 * finished (or not started). Nothing once you've left, or when that list is all ticked.
 */
export function comeNudge(trip: Trip, now: number): ComeDue | null {
  const d = comeDue(trip, now);
  if (!d || (d.when !== 'today' && d.when !== 'tomorrow')) return null;
  if (d.started && d.before.total > 0 && d.before.open === 0) return null;
  return d;
}

/** The "Home again" nudge: the day after you get back, while that list isn't finished. */
export function homeAgainNudge(trip: Trip, now: number): ComeDue | null {
  const d = comeDue(trip, now);
  if (!d || d.when !== 'home') return null;
  if (d.started && d.after.total > 0 && d.after.open === 0) return null;
  return d;
}

// ------------------------------------------------------------------ duty-free reminder (src/content/comehome.json)

export type AllowanceRow = { id: string; countries: string[]; authority: string; url: string; checked: LocalDate; verify: true; summary: string };
export type AllowanceTable = { version: number; checked: LocalDate; rule: string; allowances: AllowanceRow[] };

/** The official page for a home country (ISO 3166 alpha-2 from Settings), or null when none is listed or none is set. */
export function allowanceFor(table: AllowanceTable, homeIso: string | null | undefined): AllowanceRow | null {
  if (!isStr(homeIso)) return null;
  const iso = homeIso.trim().toUpperCase();
  return table.allowances.find((r) => r.countries.includes(iso)) ?? null;
}

/** What's wrong with an allowance row (empty when it's fine): https source, ISO date, verify flag, short words. */
export function allowanceProblems(r: AllowanceRow): string[] {
  const out: string[] = [];
  if (!isStr(r.id) || !r.id) out.push('id');
  if (!Array.isArray(r.countries) || !r.countries.length || !r.countries.every((c) => /^[A-Z]{2}$/.test(c))) out.push('countries');
  if (!isStr(r.authority) || !r.authority.trim()) out.push('authority');
  if (!isStr(r.url) || !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//.test(r.url)) out.push('url');
  if (!isDate(r.checked) || Number.isNaN(Date.parse(`${r.checked}T00:00:00Z`))) out.push('checked');
  if (r.verify !== true) out.push('verify');
  if (!isStr(r.summary) || !r.summary.trim() || r.summary.length > 200) out.push('summary');
  return out;
}

/** The source's host for the "Source: abf.gov.au" line. */
export function allowanceHost(r: AllowanceRow): string {
  const m = /^https:\/\/(?:www\.)?([^/]+)/.exec(r.url);
  return m ? m[1] : '';
}
