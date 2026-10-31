// T81 "Places to go" (owner feedback "it feels bland ... start expanding"): a per-trip list of ideas. Each idea has a
// name, a category (eat / see / do / shop / other), a note, a link kept as plain text (opened only when it is an
// http(s) address), and an optional map spot picked with the booking form's "Set on map" / saved-place picker
// (src/ui/PositionField.tsx). An idea can be planned for a trip day (the day keys the timeline uses), so it shows on
// that day of the timeline as a "Planned" row and as a stop on See on map (src/core/triproute.ts `ideas` option).
// "Been there" ticks it off; the UI then offers a journal page for that day (never creates one by itself).
// Ideas live on the trip (trip.ideas, saved like the journal) and travel in .satchel files; rows this build can't
// read are dropped on import rather than refusing the file, and fields it doesn't know are kept. No RN imports.
import { defaultJournalDay } from './journal.ts';
import type { LocalDate, Trip } from './model.ts';
import { validLatLon, type LatLon } from './poi.ts';
import { decodePos, encodePos } from './position.ts';
import { groupByDay } from './timeline.ts';
import { daysBetween, isLocalDateTime } from './tz.ts';

export const IDEA_CATEGORIES = ['eat', 'see', 'do', 'shop', 'other'] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

export const MAX_IDEA_NAME = 120;
export const MAX_IDEA_NOTE = 2000;
export const MAX_IDEA_LINK = 2000;
/** Ideas per trip a file may carry (extra rows are left out). */
export const MAX_IDEAS = 1000;

export type Idea = {
  id: string;
  name: string;
  category: IdeaCategory;
  note?: string;
  /** Plain text as typed. Opened only when isWebLink says it is an http(s) address. */
  link?: string;
  /** The map spot, when one was set. */
  lat?: number;
  lon?: number;
  /** Name of the saved place / booking the spot was taken from, if any. */
  spotName?: string;
  /** The trip day it is planned for (a timeline day key). Absent: unplanned. */
  day?: LocalDate;
  /** "Been there". */
  done?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export const isIdeaCategory = (x: unknown): x is IdeaCategory => typeof x === 'string' && (IDEA_CATEGORIES as readonly string[]).includes(x);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isDate = (x: unknown): x is LocalDate => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);

/** A stored row as an Idea, or null when it can't be read. Fields this build doesn't know are kept as they are. */
function readIdea(x: unknown): Idea | null {
  if (!isObj(x) || !isStr(x.id) || !x.id || !isStr(x.name)) return null;
  const { note, link, lat, lon, spotName, day, done, updatedAt, ...rest } = x;
  const out = { ...rest, id: x.id, name: x.name.slice(0, MAX_IDEA_NAME), category: isIdeaCategory(x.category) ? x.category : 'other', createdAt: isStr(x.createdAt) ? x.createdAt : '' } as Idea;
  if (isStr(note) && note) out.note = note.slice(0, MAX_IDEA_NOTE);
  if (isStr(link) && link.trim()) out.link = link.trim().slice(0, MAX_IDEA_LINK);
  if (validLatLon(lat, lon)) {
    out.lat = lat as number;
    out.lon = lon as number;
    if (isStr(spotName) && spotName) out.spotName = spotName;
  }
  if (isDate(day)) out.day = day;
  if (done === true) out.done = true;
  if (isStr(updatedAt)) out.updatedAt = updatedAt;
  return out;
}

/** The trip's ideas, read defensively (absent on older trips; unreadable rows skipped, duplicate ids kept once). */
export function readIdeas(trip: Pick<Trip, 'ideas'>): Idea[] {
  const list = (trip as { ideas?: unknown }).ideas;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Idea[] = [];
  for (const row of list) {
    const idea = readIdea(row);
    if (!idea || seen.has(idea.id)) continue;
    seen.add(idea.id);
    out.push(idea);
  }
  return out;
}

// ---- links ----

/**
 * The link as an address the phone may open, or null. Only http:// and https:// with a host and no spaces count;
 * anything else (a phone number, "ask at the hotel", javascript:, file:) stays plain text.
 */
export function webLink(link: string | undefined): string | null {
  if (!isStr(link)) return null;
  const s = link.trim();
  if (!/^https?:\/\/[^\s/?#]+\.[^\s/?#]+([/?#]\S*)?$/i.test(s)) return null;
  return s;
}
export const isWebLink = (link: string | undefined) => webLink(link) !== null;

// ---- the map spot ----

export const ideaSpot = (i: Idea): LatLon | null => (validLatLon(i.lat, i.lon) ? { lat: i.lat as number, lon: i.lon as number } : null);

// ---- days ----

/** The days an idea can be planned for: the timeline's day keys (every trip date plus any booking date outside them). */
export const ideaDayKeys = (trip: Trip): LocalDate[] => groupByDay(trip).map((d) => d.date);

/** "Day 3" number for a date, or null when it falls outside the trip's dates. */
export function ideaDayNumber(trip: Trip, day: LocalDate): number | null {
  return day >= trip.startDate && day <= trip.endDate ? daysBetween(trip.startDate, day) + 1 : null;
}

// ---- editing ----

/** The form keeps text only (the "unsaved changes" check stays a plain compare). `pos` is "lat,lon" or ''. */
export type IdeaDraft = { name: string; category: IdeaCategory; note: string; link: string; pos: string; spotName: string; day: LocalDate | ''; done: boolean };
export type IdeaError = 'name' | 'day' | 'pos';

export const newIdeaDraft = (day: LocalDate | '' = '', category: IdeaCategory = 'see'): IdeaDraft => ({ name: '', category, note: '', link: '', pos: '', spotName: '', day, done: false });

export function draftFromIdea(i: Idea): IdeaDraft {
  return { name: i.name, category: i.category, note: i.note ?? '', link: i.link ?? '', pos: encodePos(i), spotName: i.spotName ?? '', day: i.day ?? '', done: i.done === true };
}

export const sameIdeaDraft = (a: IdeaDraft, b: IdeaDraft) =>
  a.name === b.name && a.category === b.category && a.note === b.note && a.link === b.link && a.pos === b.pos && a.spotName === b.spotName && a.day === b.day && a.done === b.done;

/** Problems with a draft: it needs a name; a day, when set, must be a real date; a spot, when set, must read. */
export function validateIdea(d: IdeaDraft): IdeaError[] {
  const out: IdeaError[] = [];
  if (!d.name.trim()) out.push('name');
  if (d.day !== '' && !isDate(d.day)) out.push('day');
  if (d.pos !== '' && !decodePos(d.pos)) out.push('pos');
  return out;
}

/** The idea a draft saves as (new when `prev` is absent). Fields of `prev` this build doesn't know are kept. */
export function ideaFromDraft(d: IdeaDraft, newId: (prefix: string) => string, prev?: Idea, now = new Date().toISOString()): Idea {
  const { note: _n, link: _l, lat: _a, lon: _o, spotName: _s, day: _d, done: _x, updatedAt: _u, ...kept } = prev ?? ({} as Partial<Idea>);
  const out = { ...kept, id: prev?.id ?? newId('idea'), name: d.name.trim().slice(0, MAX_IDEA_NAME), category: isIdeaCategory(d.category) ? d.category : 'other', createdAt: prev?.createdAt ?? now } as Idea;
  if (prev) out.updatedAt = now;
  const note = d.note.trim();
  if (note) out.note = note.slice(0, MAX_IDEA_NOTE);
  const link = d.link.trim();
  if (link) out.link = link.slice(0, MAX_IDEA_LINK);
  const at = decodePos(d.pos);
  if (at) {
    out.lat = at.lat;
    out.lon = at.lon;
    if (d.spotName.trim()) out.spotName = d.spotName.trim();
  }
  if (d.day && isDate(d.day)) out.day = d.day;
  if (d.done) out.done = true;
  return out;
}

/** The trip with `idea` added, or replacing the idea with the same id. */
export function upsertIdea(trip: Trip, idea: Idea): Trip {
  const list = readIdeas(trip);
  const i = list.findIndex((x) => x.id === idea.id);
  return { ...trip, ideas: i < 0 ? [...list, idea] : list.map((x, n) => (n === i ? idea : x)) };
}

export const removeIdea = (trip: Trip, id: string): Trip => ({ ...trip, ideas: readIdeas(trip).filter((x) => x.id !== id) });

export const findIdea = (trip: Trip, id: string): Idea | undefined => readIdeas(trip).find((x) => x.id === id);

/** Ticks "Been there" on or off. */
export function setIdeaDone(trip: Trip, id: string, done: boolean, now = new Date().toISOString()): Trip {
  const prev = findIdea(trip, id);
  if (!prev) return trip;
  const { done: _d, ...rest } = prev;
  return upsertIdea(trip, { ...rest, ...(done ? { done: true } : {}), updatedAt: now });
}

/** Plans an idea for a day, or (null) takes it off the plan. */
export function planIdea(trip: Trip, id: string, day: LocalDate | null, now = new Date().toISOString()): Trip {
  const prev = findIdea(trip, id);
  if (!prev) return trip;
  const { day: _d, ...rest } = prev;
  return upsertIdea(trip, { ...rest, ...(day && isDate(day) ? { day } : {}), updatedAt: now });
}

/** The journal day "Been there" offers: the day it was planned for, else today on the trip (or its first / last day). */
export const ideaJournalDay = (trip: Trip, idea: Idea, now = Date.now()): LocalDate => idea.day ?? defaultJournalDay(trip, now);

// ---- lists ----

/** Not yet visited first, then the order they were added. */
function byOpenThenAdded(a: Idea, b: Idea): number {
  const da = a.done ? 1 : 0;
  const db = b.done ? 1 : 0;
  if (da !== db) return da - db;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export type IdeaFilter = 'all' | IdeaCategory;

export type IdeaGroup = {
  /** 'unplanned' or the planned day. */
  key: 'unplanned' | LocalDate;
  day: LocalDate | null;
  /** "Day N" for a day within the trip's dates; null for Unplanned or a day outside them. */
  dayNumber: number | null;
  ideas: Idea[];
};

/** The Ideas screen: Unplanned first, then each planned day in date order; empty groups left out. */
export function groupIdeas(trip: Trip, filter: IdeaFilter = 'all'): IdeaGroup[] {
  const list = readIdeas(trip).filter((i) => filter === 'all' || i.category === filter);
  const unplanned = list.filter((i) => !i.day).sort(byOpenThenAdded);
  const byDay = new Map<LocalDate, Idea[]>();
  for (const i of list) {
    if (!i.day) continue;
    const l = byDay.get(i.day);
    if (l) l.push(i);
    else byDay.set(i.day, [i]);
  }
  const out: IdeaGroup[] = [];
  if (unplanned.length) out.push({ key: 'unplanned', day: null, dayNumber: null, ideas: unplanned });
  for (const day of [...byDay.keys()].sort()) out.push({ key: day, day, dayNumber: ideaDayNumber(trip, day), ideas: byDay.get(day)!.sort(byOpenThenAdded) });
  return out;
}

/** Ideas planned for a day (the timeline's "Planned" rows). */
export const ideasOn = (trip: Trip, day: LocalDate): Idea[] => readIdeas(trip).filter((i) => i.day === day).sort(byOpenThenAdded);

export function ideaStats(trip: Trip): { total: number; planned: number; done: number } {
  const list = readIdeas(trip);
  return { total: list.length, planned: list.filter((i) => !!i.day).length, done: list.filter((i) => i.done).length };
}

/** The few the trip screen's card shows: not yet visited first (unplanned before planned), newest last. */
export function topIdeas(trip: Trip, n = 3): Idea[] {
  return readIdeas(trip)
    .slice()
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.day ? 1 : 0) - (b.day ? 1 : 0) || byOpenThenAdded(a, b))
    .slice(0, Math.max(0, n));
}

/** Category counts for the filter chips. */
export function categoryCounts(trip: Trip): Record<IdeaCategory, number> {
  const out = { eat: 0, see: 0, do: 0, shop: 0, other: 0 } as Record<IdeaCategory, number>;
  for (const i of readIdeas(trip)) out[i.category]++;
  return out;
}

// ---- the trip on the map ----

export type PlannedSpot = LatLon & { ideaId: string; name: string; category: IdeaCategory; day: LocalDate; done: boolean };

/** Planned ideas that have a map spot, in the order they were added (triproute appends them to their day). */
export function plannedSpots(trip: Pick<Trip, 'ideas'>): PlannedSpot[] {
  return readIdeas(trip)
    .filter((i) => i.day && ideaSpot(i))
    .sort((a, b) => (a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? -1 : 1) : a.id < b.id ? -1 : 1))
    .map((i) => ({ ideaId: i.id, name: i.name, category: i.category, day: i.day as LocalDate, lat: i.lat as number, lon: i.lon as number, done: i.done === true }));
}

// ---- .satchel files ----

/**
 * A file's `ideas` (absent on older files), cleaned: unreadable rows are left out (never refusing the whole file),
 * an unknown category becomes Other, and fields this build doesn't know are kept. Undefined when there are none.
 */
export function readFileIdeas(raw: unknown): Idea[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = readIdeas({ ideas: raw.slice(0, MAX_IDEAS) as Idea[] });
  return list.length ? list : undefined;
}

/** Imported ideas get new ids, like everything else in an imported trip. */
export function importIdeas(list: readonly Idea[] | undefined, newId: (prefix: string) => string): Idea[] | undefined {
  if (!list || !list.length) return undefined;
  return list.map((i) => ({ ...i, id: newId('idea') }));
}
