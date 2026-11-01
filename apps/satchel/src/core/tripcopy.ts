// T118 Plan this trip again (owner-1031 D, deepen Trips). Copies a trip to new dates: the traveller picks a new start
// date and every booking moves by the same whole number of days, keeping its own wall-clock time and its own IANA
// zone (a 21:00 Sydney departure stays 21:00 Sydney, whatever clock change falls in between: DST-safe, because the
// wall clock is shifted, never the UTC instant). The traveller chooses what comes along (bookings, packing list with
// ticks cleared, bags, ideas and saved places, to-dos with ticks cleared, companions, budget).
//
// Never copied: booking references and seats (codes), attachments (tickets, vouchers), stay details (phone-only keys
// per booking id, src/core/staydetails.ts: the copy has new booking ids, so it can never find them), receipts
// (phone-only, keyed by expense id; no expense is copied), journal, spending (expenses, settlements, exchange rates),
// cash and gifts, day plans (they point at the old days and ids) and the demo flag. T120: the gift list's people can
// come along by name only (CopyOptions.giftNames, off by default): new ids, no gifts, prices or budgets.
//
// The every-field guard: each table below is typed Record<keyof Required<X>, Rule>, so a field added to Trip, Item or
// anything copied is a type error (sh ops/typecheck-core.sh) until it is given a rule here, and tripcopy.test.ts checks
// each rule at runtime on a trip with every field set. Copying reads only the fields the tables list ('keep' and the
// others), so an unknown field is never carried by accident. New ids everywhere; the cover is kept; the name gets the
// new year. Pure TypeScript, no React Native imports.
//
// T126: the Leaving home checklist can come along too (CopyOptions.leavingHome, off by default like giftNames): every
// row as the traveller left it (own rows, renamed and removed template rows), all ticks cleared, new ids; the sitter
// note's words and its daily tasks come along, dated tasks never do (they belong to the old days). Codes are
// phone-only and never on a Trip.
import type { Budget, Companion, Item, LocalDate, Place, SavedPlace, Stamp, Trip } from './model.ts';
import type { AirportInfo } from './leaveby.ts';
import type { Idea } from './ideas.ts';
import type { Todo } from './todos.ts';
import type { PackItem, PackList } from './packing.ts';
import type { Bag } from './bags.ts';
import { readGifts, type GiftPerson } from './gifts.ts';
import { readLeavingHome, type LeaveRow, type LeavingHome, type SitterNote, type SitterTask } from './leavehome.ts';
import { addDays, checkWallTime, daysBetween, isLocalDateTime, isValidZone, wallMs, wallString } from './tz.ts';

const DAY = 86_400_000;

/** What the traveller can choose to bring along. */
export const COPY_PARTS = ['bookings', 'packing', 'bags', 'ideas', 'todos', 'companions', 'budget'] as const;
export type CopyPart = (typeof COPY_PARTS)[number];
export type CopyParts = Record<CopyPart, boolean>;
export const ALL_PARTS: CopyParts = Object.freeze({ bookings: true, packing: true, bags: true, ideas: true, todos: true, companions: true, budget: true });

/**
 * keep: copied as it is. new: a fresh id / timestamp. shift: moved by the trip's day shift (wall clock kept).
 * clear: ticks reset. drop: never copied. rename: the name with the new year. undated: only what is not tied to a
 * date comes along (T126: a sitter task 'daily' comes, a dated one does not). A part: copied only when chosen.
 */
export type Rule = 'keep' | 'new' | 'shift' | 'clear' | 'drop' | 'rename' | 'undated' | { part: CopyPart };
type Rules<T> = { readonly [K in keyof Required<T>]: Rule };

export const TRIP_RULES: Rules<Trip> = {
  id: 'new',
  name: 'rename',
  startDate: 'shift',
  endDate: 'shift',
  homeTz: 'keep',
  items: { part: 'bookings' },
  places: { part: 'ideas' },
  demo: 'drop',
  createdAt: 'new',
  budget: { part: 'budget' },
  rates: 'drop',
  ratesUpdated: 'drop',
  expenses: 'drop',
  journal: 'drop',
  ideas: { part: 'ideas' },
  companions: { part: 'companions' },
  settlements: 'drop',
  cover: 'keep',
  todos: { part: 'todos' },
  dayPlans: 'drop',
  cash: 'drop',
  // The gifts themselves never come along; with the giftNames option only the people's names do (GIFT_PERSON_RULES).
  gifts: 'drop',
  // T124: the trip's own checklist (ticks, tasks by date) never comes as it is. T126: with the leavingHome option a
  // fresh copy comes instead, by LEAVING_HOME_RULES (ticks cleared, no dated tasks).
  leavingHome: 'drop',
  // T128: the coming-home ticks and rating belong to the old trip: not copied.
  comingHome: 'drop',
};

/** Item.attachments is required by the model, so 'drop' leaves it an empty list. */
export const ITEM_RULES: Rules<Item> = {
  id: 'new',
  tripId: 'new',
  kind: 'keep',
  title: 'keep',
  start: 'shift',
  end: 'shift',
  from: 'keep',
  to: 'keep',
  place: 'keep',
  ref: 'drop',
  seat: 'drop',
  carrier: 'keep',
  number: 'keep',
  notes: 'keep',
  airport: 'keep',
  attachments: 'drop',
};

/** A booking's places get new ids (like a .satchel import); the place's own phone is public info and stays. */
export const PLACE_RULES: Rules<Place> = { id: 'new', name: 'keep', address: 'keep', localAddress: 'keep', lat: 'keep', lon: 'keep', phone: 'keep' };
export const SAVED_PLACE_RULES: Rules<SavedPlace> = { ...PLACE_RULES, lat: 'keep', lon: 'keep', category: 'keep', sample: 'keep', savedAt: 'new' };
/** The gate is this flight's, on that day; terminal and the usual times and buffers come along. */
export const AIRPORT_RULES: Rules<AirportInfo> = { terminal: 'keep', gate: 'drop', boarding: 'keep', bagDrop: 'keep', scope: 'keep', bufferMin: 'keep', travelMin: 'keep' };
export const IDEA_RULES: Rules<Idea> = {
  id: 'new',
  name: 'keep',
  category: 'keep',
  note: 'keep',
  link: 'keep',
  lat: 'keep',
  lon: 'keep',
  spotName: 'keep',
  day: 'shift',
  done: 'clear',
  rank: 'keep',
  createdAt: 'new',
  updatedAt: 'drop',
};
/** A suggestion's row that only held a tick is left out (ticks clear); a hidden suggestion stays hidden. */
export const TODO_RULES: Rules<Todo> = { id: 'new', title: 'keep', due: 'shift', done: 'clear', suggestion: 'keep', dismissed: 'keep', createdAt: 'new', updatedAt: 'drop' };
export const COMPANION_RULES: Rules<Companion> = { id: 'new', name: 'keep' };
/** T120 gift people by name only (the giftNames option): a fresh id and date, an empty gift list, no budget. */
export const GIFT_PERSON_RULES: Rules<GiftPerson> = { id: 'new', name: 'keep', budget: 'drop', gifts: 'clear', createdAt: 'new' };
/** T126 Leaving home (the leavingHome option): rows by LEAVE_ROW_RULES, the note by SITTER_NOTE_RULES, a new date. */
export const LEAVING_HOME_RULES: Rules<LeavingHome> = { rows: 'keep', note: 'undated', updatedAt: 'new' };
/** Own rows, renamed and template rows as the traveller left them (removed template rows stay removed); ticks clear. */
export const LEAVE_ROW_RULES: Rules<LeaveRow> = { id: 'new', tpl: 'keep', label: 'keep', done: 'clear' };
export const SITTER_NOTE_RULES: Rules<SitterNote> = {
  address: 'keep',
  tasks: 'undated',
  pets: 'keep',
  plants: 'keep',
  bins: 'keep',
  contactName: 'keep',
  contactPhone: 'keep',
  extra: 'keep',
};
/** A daily task comes along with a new id; a task on a date of the old trip does not. */
export const SITTER_TASK_RULES: Rules<SitterTask> = { id: 'new', when: 'undated', text: 'keep' };
export const BUDGET_RULES: Rules<Budget> = { currency: 'keep', amount: 'keep' };
export const PACK_LIST_RULES: Rules<PackList> = {
  tripId: 'new',
  template: 'keep',
  items: { part: 'packing' },
  templates: 'keep',
  dismissed: 'keep',
  laundry: 'keep',
  bags: { part: 'bags' },
  carryOnOnly: { part: 'bags' },
};
export const PACK_ITEM_RULES: Rules<PackItem> = {
  id: 'new',
  label: 'keep',
  done: 'clear',
  category: 'keep',
  qty: 'keep',
  templateItemId: 'keep',
  suggestionId: 'keep',
  userQty: 'keep',
  bag: { part: 'bags' },
  weightG: 'keep',
  movedFrom: { part: 'bags' },
};
/** Bag ids are local to the list (rows point at them), so they are kept, as a .satchel import keeps them. */
export const BAG_RULES: Rules<Bag> = { id: 'keep', kind: 'keep', name: 'keep', colour: 'keep', hold: 'keep', limitG: 'keep' };

// ------------------------------------------------------------------ helpers

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The 'keep' fields of `src` per `rules` (undefined values left out), deep-cloned so the copy shares nothing. */
function kept<T>(src: T, rules: Rules<T>): Partial<T> {
  const out: Record<string, unknown> = {};
  if (!isObj(src)) return out as Partial<T>;
  for (const [k, r] of Object.entries(rules)) {
    if (r !== 'keep') continue;
    const v = src[k];
    if (v !== undefined) out[k] = structuredClone(v);
  }
  return out as Partial<T>;
}

/** The trip's day shift: whole days from the old start to the new one. */
export const shiftDays = (trip: Pick<Trip, 'startDate'>, newStart: LocalDate): number => daysBetween(trip.startDate, newStart);

/** A wall-clock time moved by whole days, same clock time and zone (never through the UTC instant). */
export function shiftStamp(s: Stamp, days: number): Stamp {
  if (!isLocalDateTime(s.local)) return { ...s };
  return { local: wallString(wallMs(s.local) + days * DAY), tz: s.tz };
}

const isDay = (d: unknown): d is LocalDate => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && isLocalDateTime(`${d}T00:00`);
const shiftDay = (d: LocalDate | undefined, days: number): LocalDate | undefined => (isDay(d) ? addDays(d, days) : undefined);

/** The name with the new year: the last 19xx / 20xx in it becomes `year`, else the year is added at the end. */
export function nameForYear(name: string, year: number): string {
  const y = String(year);
  const base = name.trim();
  const matches = [...base.matchAll(/(?<![\d])(19|20)\d{2}(?![\d])/g)];
  if (!matches.length) return base ? `${base} ${y}` : y;
  const m = matches[matches.length - 1];
  const at = m.index ?? 0;
  return `${base.slice(0, at)}${y}${base.slice(at + m[0].length)}`;
}

/** The same calendar day a year after `date` (29 Feb goes to 28 Feb): the date picker's starting value. */
export function sameDayNextYear(date: LocalDate): LocalDate {
  if (!isDay(date)) return date;
  const [y, m, d] = date.split('-').map(Number);
  const next = `${String(y + 1).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isDay(next) ? next : `${String(y + 1).padStart(4, '0')}-${String(m).padStart(2, '0')}-28`;
}

// ------------------------------------------------------------------ preview

/** A booking time that, on its new day, falls in a clock change in its own zone ('skipped': read as `usedLocal`). */
export type ClockNote = { itemId: string; title: string; which: 'start' | 'end'; local: string; tz: string; kind: 'skipped' | 'repeated'; usedLocal?: string };
export type PreviewRow = { itemId: string; title: string; kind: Item['kind']; start: Stamp; newStart: Stamp; end?: Stamp; newEnd?: Stamp };
export type CopyPreview = { startDate: LocalDate; endDate: LocalDate; days: number; rows: PreviewRow[]; clockNotes: ClockNote[] };

function clockNote(item: Item, which: 'start' | 'end', s: Stamp): ClockNote | null {
  if (!isValidZone(s.tz) || !isLocalDateTime(s.local)) return null;
  const c = checkWallTime(s);
  if (c.kind === 'normal') return null;
  return { itemId: item.id, title: item.title, which, local: s.local, tz: s.tz, kind: c.kind, ...(c.kind === 'skipped' ? { usedLocal: c.usedLocal } : {}) };
}

const byStart = (a: Item, b: Item) => (a.start.local < b.start.local ? -1 : a.start.local > b.start.local ? 1 : 0);

/** The new dates and each booking's old and new time, in the order of their (wall-clock) start. */
export function copyPreview(trip: Trip, newStart: LocalDate): CopyPreview {
  const days = isDay(newStart) && isDay(trip.startDate) ? shiftDays(trip, newStart) : 0;
  const length = isDay(trip.startDate) && isDay(trip.endDate) ? Math.max(0, daysBetween(trip.startDate, trip.endDate)) : 0;
  const startDate = isDay(newStart) ? newStart : trip.startDate;
  const rows: PreviewRow[] = [];
  const clockNotes: ClockNote[] = [];
  for (const item of [...(trip.items ?? [])].sort(byStart)) {
    const newS = shiftStamp(item.start, days);
    const newE = item.end ? shiftStamp(item.end, days) : undefined;
    rows.push({ itemId: item.id, title: item.title, kind: item.kind, start: item.start, newStart: newS, ...(item.end && newE ? { end: item.end, newEnd: newE } : {}) });
    const a = clockNote(item, 'start', newS);
    if (a) clockNotes.push(a);
    const b = newE ? clockNote(item, 'end', newE) : null;
    if (b) clockNotes.push(b);
  }
  return { startDate, endDate: isDay(newStart) ? addDays(newStart, length) : trip.endDate, days, rows, clockNotes };
}

/** How much each part would bring along (0 / false: nothing to copy, the screen hides that choice). */
export type PartCounts = Record<Exclude<CopyPart, 'budget'>, number> & { budget: boolean; giftPeople: number; leavingHome: number };
export function partCounts(trip: Trip, packing: PackList | null | undefined): PartCounts {
  const list = packing && packing.tripId === trip.id ? packing : null;
  return {
    bookings: trip.items?.length ?? 0,
    packing: list?.items?.length ?? 0,
    // Bags saved on the list (absent: the three built-in bags, nothing of the traveller's own to copy).
    bags: list?.bags?.length ?? 0,
    ideas: (trip.ideas?.length ?? 0) + (trip.places?.length ?? 0),
    todos: (trip.todos ?? []).filter((t) => !t.suggestion || t.dismissed).length,
    companions: trip.companions?.length ?? 0,
    giftPeople: readGifts(trip).length,
    // T126: checklist rows (a note with no rows has nothing to tick, but its words can still come: count it as one).
    leavingHome: leavingHomeCount(trip),
    budget: !!trip.budget && typeof trip.budget.currency === 'string' && !!trip.budget.currency,
  };
}

// ------------------------------------------------------------------ copying

export type CopyOptions = {
  startDate: LocalDate;
  parts: CopyParts;
  newId: (prefix: string) => string;
  now?: string;
  /** The traveller's own name for the copy; absent or blank: nameForYear. */
  name?: string;
  /** T120: bring the gift list's people by name only (no gifts, prices or budgets). Off unless set. */
  giftNames?: boolean;
  /** T126: bring the Leaving home checklist (ticks cleared) and the sitter note without dated tasks. Off unless set. */
  leavingHome?: boolean;
};
export type CopyResult = { trip: Trip; packing: PackList | null; days: number };

function copyPlace<P extends Place>(p: P | undefined, rules: Rules<P>, newId: (prefix: string) => string, now: string): P | undefined {
  if (!isObj(p)) return undefined;
  const out = kept(p, rules) as P;
  out.id = newId('place');
  if ('savedAt' in rules) (out as unknown as SavedPlace).savedAt = now;
  return out;
}

function copyItem(item: Item, tripId: string, days: number, newId: (prefix: string) => string, now: string): Item {
  const out = { ...kept(item, ITEM_RULES), id: newId('item'), tripId, start: shiftStamp(item.start, days), attachments: [] } as Item;
  if (item.end) out.end = shiftStamp(item.end, days);
  for (const k of ['from', 'to', 'place'] as const) {
    const p = copyPlace(item[k], PLACE_RULES, newId, now);
    if (p) out[k] = p;
    else delete out[k];
  }
  if (item.airport) {
    const a = kept(item.airport, AIRPORT_RULES);
    if (Object.keys(a).length) out.airport = a;
    else delete out.airport;
  }
  return out;
}

function copyIdea(i: Idea, days: number, newId: (prefix: string) => string, now: string): Idea {
  const out = { ...kept(i, IDEA_RULES), id: newId('idea'), createdAt: now } as Idea;
  const day = shiftDay(i.day, days);
  if (day) out.day = day;
  return out;
}

function copyTodo(t: Todo, days: number, newId: (prefix: string) => string, now: string): Todo | null {
  if (t.suggestion && !t.dismissed) return null;
  const out = { ...kept(t, TODO_RULES), id: newId('todo'), createdAt: now } as Todo;
  if (typeof out.title !== 'string') out.title = '';
  const due = shiftDay(t.due, days);
  if (due) out.due = due;
  return out;
}

function leavingHomeCount(trip: Trip): number {
  const lh = readLeavingHome(trip);
  if (!lh) return 0;
  return lh.rows.length || (copyNote(lh.note, () => '') ? 1 : 0);
}

function copyNote(note: SitterNote | undefined, newId: (prefix: string) => string): SitterNote | undefined {
  if (!isObj(note)) return undefined;
  const out = kept(note, SITTER_NOTE_RULES);
  const tasks = (note.tasks ?? [])
    .filter((t) => t.when === 'daily')
    .map((t) => ({ ...kept(t, SITTER_TASK_RULES), id: newId('lht'), when: 'daily' }) as SitterTask);
  if (tasks.length) out.tasks = tasks;
  return Object.keys(out).length ? out : undefined;
}

/** T126: a fresh Leaving home for the copy (read through readLeavingHome, so codes and broken rows never come). */
export function copyLeavingHome(trip: Trip, newId: (prefix: string) => string, now: string): LeavingHome | undefined {
  const lh = readLeavingHome(trip);
  if (!lh) return undefined;
  const rows = lh.rows.map((r) => ({ ...kept(r, LEAVE_ROW_RULES), id: newId('lh'), done: false }) as LeaveRow);
  const note = copyNote(lh.note, newId);
  if (!rows.length && !note) return undefined;
  return { rows, ...(note ? { note } : {}), updatedAt: now };
}

function copyPacking(list: PackList, tripId: string, parts: CopyParts, newId: (prefix: string) => string): PackList | null {
  if (!parts.packing && !parts.bags) return null;
  const out = { ...kept(list, PACK_LIST_RULES), tripId, items: [] } as PackList;
  if (parts.packing)
    out.items = (list.items ?? []).map((i) => {
      const row = { ...kept(i, PACK_ITEM_RULES), id: newId('pack'), done: false } as PackItem;
      if (typeof row.label !== 'string') row.label = '';
      if (parts.bags) {
        if (i.bag !== undefined) row.bag = i.bag;
        if (i.movedFrom !== undefined) row.movedFrom = i.movedFrom;
      }
      return row;
    });
  if (parts.bags) {
    if (Array.isArray(list.bags)) out.bags = list.bags.map((b) => kept(b, BAG_RULES) as Bag);
    if (list.carryOnOnly !== undefined) out.carryOnOnly = list.carryOnOnly;
  }
  return out;
}

/**
 * The new trip (and its packing list) on the new dates. Nothing of the old trip is changed and nothing in the result
 * is shared with it. `packing` is the old trip's own list (a list for another trip is ignored).
 */
export function copyTrip(trip: Trip, packing: PackList | null | undefined, opts: CopyOptions): CopyResult {
  const now = opts.now ?? new Date().toISOString();
  const { parts, newId } = opts;
  const days = isDay(opts.startDate) && isDay(trip.startDate) ? shiftDays(trip, opts.startDate) : 0;
  const id = newId('trip');
  const startDate = isDay(opts.startDate) ? opts.startDate : trip.startDate;
  const length = isDay(trip.startDate) && isDay(trip.endDate) ? Math.max(0, daysBetween(trip.startDate, trip.endDate)) : 0;
  const year = Number(startDate.slice(0, 4));
  const own = opts.name?.trim();
  const out: Trip = {
    ...(kept(trip, TRIP_RULES) as Partial<Trip>),
    id,
    name: own || nameForYear(trip.name ?? '', year),
    startDate,
    endDate: isDay(opts.startDate) ? addDays(startDate, length) : trip.endDate,
    items: parts.bookings ? (trip.items ?? []).map((i) => copyItem(i, id, days, newId, now)) : [],
    createdAt: now,
  } as Trip;
  if (parts.ideas) {
    const places = (trip.places ?? []).map((p) => copyPlace(p, SAVED_PLACE_RULES, newId, now)).filter((p): p is SavedPlace => !!p);
    if (places.length) out.places = places;
    const ideas = (trip.ideas ?? []).map((i) => copyIdea(i, days, newId, now));
    if (ideas.length) out.ideas = ideas;
  }
  if (parts.todos) {
    const todos = (trip.todos ?? []).map((t) => copyTodo(t, days, newId, now)).filter((t): t is Todo => !!t);
    if (todos.length) out.todos = todos;
  }
  if (parts.companions) {
    const companions = (trip.companions ?? []).map((c) => ({ ...kept(c, COMPANION_RULES), id: newId('comp') }) as Companion);
    if (companions.length) out.companions = companions;
  }
  if (opts.giftNames === true) {
    const people = readGifts(trip).map((p) => ({ ...kept(p, GIFT_PERSON_RULES), id: newId('gp'), gifts: [], createdAt: now }) as GiftPerson);
    if (people.length) out.gifts = people;
  }
  if (opts.leavingHome === true) {
    const lh = copyLeavingHome(trip, newId, now);
    if (lh) out.leavingHome = lh;
  }
  if (parts.budget && trip.budget) {
    const b = kept(trip.budget, BUDGET_RULES) as Budget;
    if (typeof b.currency === 'string' && b.currency) out.budget = b;
  }
  const list = packing && packing.tripId === trip.id ? copyPacking(packing, id, parts, newId) : null;
  return { trip: out, packing: list, days };
}
