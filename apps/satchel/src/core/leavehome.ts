// T124 "Leaving home": a "before you lock the door" checklist per trip, timed to the trip's first departure, and a
// house-sitter / neighbour note shared as plain text. Pure TypeScript (no React Native), read defensively.
//
// - The checklist starts from a fixed template (bins, plants, fridge, heating/cooling, windows, chargers, mail and
//   deliveries, pets, spare key, timer lights, valuables, travel docs and cards) and takes the traveller's own items.
//   Template rows can be removed, renamed and put back. It lives on the Trip as `leavingHome` and travels in .satchel
//   files (optional; older trips and files have none).
// - Due time: the first journey of the trip by its real instant (flight, train, ferry or bus, compared across their own
//   zones), else the first booking, else the start date at 00:00 in the home zone. "Today" / "tomorrow" are counted
//   on the departure's own clock (that is where home is), never the phone's zone.
// - Wi-Fi and alarm codes are phone-only: they live under LEAVEHOME_CODES_KEY (one set for your home, not per trip),
//   never on the Trip. stripPhoneOnly() also removes code-like keys from `leavingHome` before a .satchel file is
//   written or read, so a code can't ride along even if one were put on the trip by mistake (guard test).
import type { Item, LocalDate, Stamp, Trip } from './model.ts';
import { TRANSPORT_KINDS } from './model.ts';
import { span, zonesReadable } from './timeline.ts';
import { addDays, dateRange, daysBetween, fromUtc, isValidZone, localDate, localTime, toUtc } from './tz.ts';
import { zoneCity } from './format.ts';

// ------------------------------------------------------------------ model

/** Template rows in the order they show. Words live in src/i18n/en/leavehome.ts as `leavehome.tpl.<id>`. */
export const LEAVE_TEMPLATE = ['bins', 'plants', 'fridge', 'climate', 'windows', 'chargers', 'mail', 'pets', 'spareKey', 'lights', 'valuables', 'docs'] as const;
export type LeaveTemplateId = (typeof LEAVE_TEMPLATE)[number];

/** One checklist row: a template row (`tpl`, optionally renamed by `label`) or the traveller's own (`label` only). */
export type LeaveRow = { id: string; tpl?: LeaveTemplateId; label?: string; done: boolean };

/** When a sitter task happens: every day, or one date of the trip (in the home zone). */
export type SitterWhen = 'daily' | LocalDate;
export type SitterTask = { id: string; when: SitterWhen; text: string };

/** The house-sitter / neighbour note. No codes here: Wi-Fi and alarm live in HomeCodes on this phone. */
export type SitterNote = {
  address?: string;
  tasks?: SitterTask[];
  pets?: string;
  plants?: string;
  bins?: string;
  contactName?: string;
  contactPhone?: string;
  extra?: string;
};

export type LeavingHome = {
  rows: LeaveRow[];
  note?: SitterNote;
  updatedAt?: string;
};

/** Phone-only codes for the sitter note (one set for your home). Never on a Trip, never in a .satchel file. */
export type HomeCodes = { wifiName?: string; wifiPassword?: string; alarmCode?: string };

/** The one phone-only storage key for the home codes (declared once, here). */
export const LEAVEHOME_CODES_KEY = 'satchel.leavehome.codes.v1';

export const MAX_ROWS = 60;
export const MAX_TASKS = 60;
export const MAX_TEXT = 500;

const isStr = (x: unknown): x is string => typeof x === 'string';
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isTpl = (x: unknown): x is LeaveTemplateId => isStr(x) && (LEAVE_TEMPLATE as readonly string[]).includes(x);
const isDate = (x: unknown): x is LocalDate => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x);
const clip = (s: string) => s.slice(0, MAX_TEXT);

// ------------------------------------------------------------------ phone-only guard

/**
 * Keys that would hold a code. Never kept on `leavingHome` or its note, whatever their spelling in the store or a
 * file: Wi-Fi and alarm codes stay on this phone (HomeCodes).
 */
export const PHONE_ONLY_KEYS = /wifi|wi-fi|wlan|ssid|password|passcode|pin$|alarm|code/i;

/** `leavingHome` without any code-like key (top level and note). Other fields are kept, so a later field travels. */
export function stripPhoneOnly<T>(lh: T): T {
  if (!isObj(lh)) return lh;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(lh)) {
    if (PHONE_ONLY_KEYS.test(k)) continue;
    out[k] = k === 'note' && isObj(v) ? Object.fromEntries(Object.entries(v).filter(([nk]) => !PHONE_ONLY_KEYS.test(nk))) : v;
  }
  return out as T;
}

// ------------------------------------------------------------------ reading (defensive)

function cleanRow(x: unknown): LeaveRow | null {
  if (!isObj(x) || !isStr(x.id) || !x.id) return null;
  const tpl = isTpl(x.tpl) ? x.tpl : undefined;
  const label = isStr(x.label) && x.label.trim() ? clip(x.label) : undefined;
  if (!tpl && !label) return null;
  return { ...(x as object), id: x.id, ...(tpl ? { tpl } : {}), ...(label ? { label } : {}), done: x.done === true } as LeaveRow;
}

function cleanTask(x: unknown): SitterTask | null {
  if (!isObj(x) || !isStr(x.id) || !x.id || !isStr(x.text) || !x.text.trim()) return null;
  const when: SitterWhen = isDate(x.when) ? x.when : 'daily';
  return { ...(x as object), id: x.id, when, text: clip(x.text) } as SitterTask;
}

const NOTE_TEXT = ['address', 'pets', 'plants', 'bins', 'contactName', 'contactPhone', 'extra'] as const;

function cleanNote(x: unknown): SitterNote | undefined {
  if (!isObj(x)) return undefined;
  const out: Record<string, unknown> = { ...x };
  for (const k of NOTE_TEXT) {
    if (isStr(x[k]) && (x[k] as string).trim()) out[k] = clip(x[k] as string);
    else delete out[k];
  }
  const tasks = Array.isArray(x.tasks) ? x.tasks.map(cleanTask).filter((t): t is SitterTask => !!t).slice(0, MAX_TASKS) : [];
  if (tasks.length) out.tasks = tasks;
  else delete out.tasks;
  const note = stripPhoneOnly({ note: out }).note as SitterNote;
  return Object.keys(note).length ? note : undefined;
}

/** The trip's checklist and note, cleaned (null when it has none or it's unreadable). Unknown fields are kept. */
export function readLeavingHome(trip: Pick<Trip, 'leavingHome'>): LeavingHome | null {
  const raw: unknown = trip.leavingHome;
  if (!isObj(raw)) return null;
  const seen = new Set<string>();
  const rows = (Array.isArray(raw.rows) ? raw.rows : [])
    .map(cleanRow)
    .filter((r): r is LeaveRow => !!r && !seen.has(r.id) && !!seen.add(r.id))
    .slice(0, MAX_ROWS);
  const note = cleanNote(raw.note);
  const { note: _n, rows: _r, updatedAt, ...rest } = raw;
  return stripPhoneOnly({ ...rest, rows, ...(note ? { note } : {}), ...(isStr(updatedAt) ? { updatedAt } : {}) } as LeavingHome);
}

/** A file's `leavingHome` (absent on older files), cleaned like the store, codes removed; undefined when empty. */
export function readFileLeavingHome(raw: unknown): LeavingHome | undefined {
  const lh = readLeavingHome({ leavingHome: raw as LeavingHome });
  return lh && (lh.rows.length || lh.note) ? lh : undefined;
}

/** The phone-only codes, cleaned (a damaged store reads as no codes). */
export function cleanCodes(x: unknown): HomeCodes {
  if (!isObj(x)) return {};
  const out: HomeCodes = {};
  for (const k of ['wifiName', 'wifiPassword', 'alarmCode'] as const) if (isStr(x[k]) && (x[k] as string).trim()) out[k] = (x[k] as string).slice(0, 200);
  return out;
}

export const hasCodes = (c: HomeCodes) => !!(c.wifiName || c.wifiPassword || c.alarmCode);

// ------------------------------------------------------------------ editing (each returns a new Trip)

type NewId = (prefix: string) => string;

/** A fresh checklist from the template (every row open). */
export function templateRows(newId: NewId): LeaveRow[] {
  return LEAVE_TEMPLATE.map((tpl) => ({ id: newId('lh'), tpl, done: false }));
}

function put(trip: Trip, lh: LeavingHome, now: string): Trip {
  return { ...trip, leavingHome: { ...lh, updatedAt: now } };
}

const current = (trip: Trip): LeavingHome => readLeavingHome(trip) ?? { rows: [] };

/** Starts the checklist from the template (a trip that already has one keeps it). */
export function startLeavingHome(trip: Trip, newId: NewId, now = new Date().toISOString()): Trip {
  const lh = readLeavingHome(trip);
  if (lh && lh.rows.length) return trip;
  return put(trip, { ...(lh ?? {}), rows: templateRows(newId) }, now);
}

export function setRowDone(trip: Trip, id: string, done: boolean, now = new Date().toISOString()): Trip {
  const lh = current(trip);
  return put(trip, { ...lh, rows: lh.rows.map((r) => (r.id === id ? { ...r, done } : r)) }, now);
}

/** Adds the traveller's own row (blank words are ignored). */
export function addOwnRow(trip: Trip, label: string, newId: NewId, now = new Date().toISOString()): Trip {
  const words = label.trim();
  const lh = current(trip);
  if (!words || lh.rows.length >= MAX_ROWS) return trip;
  return put(trip, { ...lh, rows: [...lh.rows, { id: newId('lh'), label: clip(words), done: false }] }, now);
}

/** Renames a row; blank words put a template row back to its own words (an own row keeps its old words). */
export function renameRow(trip: Trip, id: string, label: string, now = new Date().toISOString()): Trip {
  const words = label.trim();
  const lh = current(trip);
  return put(
    trip,
    {
      ...lh,
      rows: lh.rows.map((r) => {
        if (r.id !== id) return r;
        if (words) return { ...r, label: clip(words) };
        if (!r.tpl) return r;
        const { label: _l, ...rest } = r;
        return rest;
      }),
    },
    now,
  );
}

export function removeRow(trip: Trip, id: string, now = new Date().toISOString()): Trip {
  const lh = current(trip);
  return put(trip, { ...lh, rows: lh.rows.filter((r) => r.id !== id) }, now);
}

/** Template rows not on the list (removed earlier), in template order. */
export function missingTemplate(lh: LeavingHome | null): LeaveTemplateId[] {
  const have = new Set((lh?.rows ?? []).map((r) => r.tpl).filter(Boolean));
  return LEAVE_TEMPLATE.filter((t) => !have.has(t));
}

/** Puts removed template rows back (open), each in its template position among the template rows. */
export function restoreTemplate(trip: Trip, newId: NewId, now = new Date().toISOString()): Trip {
  const lh = current(trip);
  const missing = missingTemplate(lh);
  if (!missing.length) return trip;
  const rows = [...lh.rows];
  for (const tpl of missing) {
    const order = LEAVE_TEMPLATE.indexOf(tpl);
    // Insert before the first template row that comes later in the template, else after the last template row.
    let at = rows.findIndex((r) => r.tpl && LEAVE_TEMPLATE.indexOf(r.tpl) > order);
    if (at < 0) {
      const lastTpl = rows.map((r) => !!r.tpl).lastIndexOf(true);
      at = lastTpl + 1;
    }
    rows.splice(at, 0, { id: newId('lh'), tpl, done: false });
  }
  return put(trip, { ...lh, rows }, now);
}

export function untickAll(trip: Trip, now = new Date().toISOString()): Trip {
  const lh = current(trip);
  return put(trip, { ...lh, rows: lh.rows.map((r) => ({ ...r, done: false })) }, now);
}

/** Saves the note's text fields (blank fields are dropped; tasks are kept). Codes are never taken. */
export function withNote(trip: Trip, note: Omit<SitterNote, 'tasks'>, now = new Date().toISOString()): Trip {
  const lh = current(trip);
  const next = cleanNote({ ...stripPhoneOnly({ note }).note, tasks: lh.note?.tasks });
  const { note: _n, ...rest } = lh;
  return put(trip, { ...rest, ...(next ? { note: next } : {}) }, now);
}

export function addTask(trip: Trip, when: SitterWhen, text: string, newId: NewId, now = new Date().toISOString()): Trip {
  const words = text.trim();
  const lh = current(trip);
  const tasks = lh.note?.tasks ?? [];
  if (!words || tasks.length >= MAX_TASKS) return trip;
  const task: SitterTask = { id: newId('task'), when: isDate(when) ? when : 'daily', text: clip(words) };
  return put(trip, { ...lh, note: { ...(lh.note ?? {}), tasks: [...tasks, task] } }, now);
}

export function removeTask(trip: Trip, id: string, now = new Date().toISOString()): Trip {
  const lh = current(trip);
  const tasks = (lh.note?.tasks ?? []).filter((t) => t.id !== id);
  const { tasks: _t, ...noteRest } = lh.note ?? {};
  const note: SitterNote = tasks.length ? { ...noteRest, tasks } : noteRest;
  const { note: _n, ...rest } = lh;
  return put(trip, { ...rest, ...(Object.keys(note).length ? { note } : {}) }, now);
}

// ------------------------------------------------------------------ progress

export type LeaveProgress = { done: number; total: number; open: number };

export function leaveProgress(lh: LeavingHome | null): LeaveProgress {
  const rows = lh?.rows ?? [];
  const done = rows.filter((r) => r.done).length;
  return { done, total: rows.length, open: rows.length - done };
}

// ------------------------------------------------------------------ due time

/** The trip's first departure: when you leave home. `item` is absent for the start-date fallback. */
export type Departure = { at: number; stamp: Stamp; item?: Item };

/**
 * The first journey by its real instant (flight / train / ferry / bus, each start read in its own zone), else the
 * first booking that isn't a note, else the start date at 00:00 in the home zone. Bookings with an unreadable zone
 * are skipped. Null only when nothing can be placed in time.
 */
export function firstDeparture(trip: Pick<Trip, 'items' | 'startDate' | 'homeTz'>): Departure | null {
  const timed = (trip.items ?? []).filter((i) => i.kind !== 'note' && zonesReadable(i));
  const earliest = (list: Item[]) => list.reduce<Item | null>((best, i) => (!best || span(i).start < span(best).start ? i : best), null);
  const item = earliest(timed.filter((i) => TRANSPORT_KINDS.includes(i.kind))) ?? earliest(timed);
  if (item) return { at: span(item).start, stamp: item.start, item };
  if (!isDate(trip.startDate)) return null;
  const tz = isValidZone(trip.homeTz) ? trip.homeTz : 'UTC';
  const stamp: Stamp = { local: `${trip.startDate}T00:00`, tz };
  return { at: toUtc(stamp), stamp };
}

/** today / tomorrow / later (2+ days away) / gone (departure has passed). */
export type LeaveWhen = 'today' | 'tomorrow' | 'later' | 'gone';

export type LeaveDue = {
  when: LeaveWhen;
  /** Whole days from today to departure day, on the departure's clock. */
  days: number;
  dep: Departure;
  /** Departure time on its own clock ('HH:mm'), empty for the start-date fallback. */
  time: string;
  progress: LeaveProgress;
  started: boolean;
};

export function leaveDue(trip: Trip, now: number): LeaveDue | null {
  const dep = firstDeparture(trip);
  if (!dep) return null;
  const tz = dep.stamp.tz;
  const today = localDate(fromUtc(now, tz));
  const days = daysBetween(today, localDate(dep.stamp.local));
  const when: LeaveWhen = now >= dep.at ? 'gone' : days <= 0 ? 'today' : days === 1 ? 'tomorrow' : 'later';
  const lh = readLeavingHome(trip);
  return { when, days, dep, time: dep.item ? localTime(dep.stamp.local) : '', progress: leaveProgress(lh), started: !!lh && lh.rows.length > 0 };
}

/**
 * The trip card / Your day nudge: departure is today or tomorrow and the checklist isn't finished (or not started).
 * A trip whose list is all ticked, or whose departure has passed, has none.
 */
export function leaveNudge(trip: Trip, now: number): LeaveDue | null {
  const d = leaveDue(trip, now);
  if (!d || (d.when !== 'today' && d.when !== 'tomorrow')) return null;
  if (d.started && d.progress.open === 0) return null;
  return d;
}

/** The soonest nudge across trips (for the Trips tab), with its trip. */
export function nextLeaveNudge(trips: readonly Trip[], now: number): { trip: Trip; due: LeaveDue } | null {
  let best: { trip: Trip; due: LeaveDue } | null = null;
  for (const trip of trips) {
    const due = leaveNudge(trip, now);
    if (due && (!best || due.dep.at < best.due.dep.at)) best = { trip, due };
  }
  return best;
}

// ------------------------------------------------------------------ the sitter note as plain text

/** A stop for "Where we'll be": a stay (hotel) with its dates on its own clock. */
export type Stop = { name: string; city: string; from: LocalDate; to: LocalDate; phone?: string };

export function tripStops(trip: Pick<Trip, 'items'>): Stop[] {
  return (trip.items ?? [])
    .filter((i) => i.kind === 'hotel')
    .slice()
    .sort((a, b) => (zonesReadable(a) && zonesReadable(b) ? span(a).start - span(b).start : a.start.local < b.start.local ? -1 : 1))
    .map((i) => ({
      name: i.place?.name?.trim() || i.title.trim(),
      city: zoneCity(i.start.tz),
      from: localDate(i.start.local),
      to: localDate((i.end ?? i.start).local),
      ...(i.place?.phone?.trim() ? { phone: i.place.phone.trim() } : {}),
    }));
}

/** Trip dates a sitter task can be pinned to (start to end, at most 45 days). */
export function taskDays(trip: Pick<Trip, 'startDate' | 'endDate'>): LocalDate[] {
  if (!isDate(trip.startDate) || !isDate(trip.endDate) || trip.endDate < trip.startDate) return [];
  return dateRange(trip.startDate, trip.endDate > addDays(trip.startDate, 44) ? addDays(trip.startDate, 44) : trip.endDate);
}

export type NoteWords = {
  title: string;
  away: (range: string) => string;
  range: (from: LocalDate, to: LocalDate) => string;
  day: (date: LocalDate) => string;
  address: string;
  everyDay: string;
  tasks: string;
  pets: string;
  plants: string;
  bins: string;
  wifi: string;
  wifiName: (name: string) => string;
  wifiPassword: (pw: string) => string;
  alarm: (code: string) => string;
  call: string;
  stops: string;
  stop: (s: Stop, range: string) => string;
  extra: string;
  empty: string;
};

export type NoteOptions = {
  /** Phone-only codes to put in this one shared text (the sender's choice each time). */
  codes?: HomeCodes | null;
  wifi?: boolean;
  alarm?: boolean;
};

/**
 * The note as plain text for the share sheet: when you're away, the address, sitter tasks (every day, then by date),
 * pets, plants, bins, Wi-Fi and alarm (only when the sender switches them on for this share), who to call and where
 * you'll be by stop. Nothing is written for empty fields.
 */
export function sitterNoteText(trip: Trip, w: NoteWords, opts: NoteOptions = {}): string {
  const note = readLeavingHome(trip)?.note ?? {};
  const blocks: string[] = [w.title.trim()];
  if (isDate(trip.startDate) && isDate(trip.endDate)) blocks.push(w.away(w.range(trip.startDate, trip.endDate)));
  const section = (head: string, body: string | undefined) => {
    if (body && body.trim()) blocks.push(`${head}\n${body.trim()}`);
  };
  section(w.address, note.address);
  const tasks = note.tasks ?? [];
  if (tasks.length) {
    const lines: string[] = [w.tasks];
    const daily = tasks.filter((t) => t.when === 'daily');
    if (daily.length) lines.push(`${w.everyDay}:`, ...daily.map((t) => `- ${t.text}`));
    const dated = [...new Set(tasks.filter((t) => t.when !== 'daily').map((t) => t.when))].sort();
    for (const d of dated) lines.push(`${w.day(d)}:`, ...tasks.filter((t) => t.when === d).map((t) => `- ${t.text}`));
    blocks.push(lines.join('\n'));
  }
  section(w.pets, note.pets);
  section(w.plants, note.plants);
  section(w.bins, note.bins);
  const codes = opts.codes ? cleanCodes(opts.codes) : {};
  const wifi = opts.wifi === true ? [codes.wifiName ? w.wifiName(codes.wifiName) : '', codes.wifiPassword ? w.wifiPassword(codes.wifiPassword) : ''].filter(Boolean) : [];
  if (wifi.length) blocks.push(`${w.wifi}\n${wifi.join('\n')}`);
  if (opts.alarm === true && codes.alarmCode) blocks.push(w.alarm(codes.alarmCode));
  section(w.call, [note.contactName, note.contactPhone].filter((x) => x && x.trim()).join(' · '));
  const stops = tripStops(trip);
  if (stops.length) blocks.push([w.stops, ...stops.map((s) => w.stop(s, w.range(s.from, s.to)))].join('\n'));
  section(w.extra, note.extra);
  if (blocks.length === 1) blocks.push(w.empty);
  return `${blocks.join('\n\n')}\n`;
}
