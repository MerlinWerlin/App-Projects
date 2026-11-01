// T93 trip to-dos (owner-1031 D, "deepen Trips"): a pre-trip checklist per trip, with due dates counted back from
// departure. Satchel suggests to-dos from the trip itself, offline (travel insurance; entry and visa rules for each
// country on the trip; tell your bank; roaming or an eSIM; the offline city map for each stop; how to get from the
// airport for each arriving flight; online check-in, which opens about 24 h before each flight (general guidance,
// airlines differ); save or print your tickets). Each suggestion can be ticked off or hidden (and shown again), and
// the traveller adds their own to-dos with an optional due date.
//
// Dates: "departure" is the trip's first booking (notes left out), read in its own zone; with no booking it is the
// trip's start date in the home zone. Every due date is a day in the departure zone (check-in: the flight's own
// departure zone and clock), and overdue / due soon are judged against "today" in that same zone, so a phone set to
// another zone gives the same answer.
//
// Storage: one array on the trip (trip.todos). The traveller's own to-dos are full rows; a suggestion is stored only
// once it is ticked or hidden, as a small row naming its key. Keys are built from what the suggestion is about (a
// country code, a city, a flight's departure time, zone and number), never from booking ids, so ticks survive a
// .satchel export + import (which renews every id). Rows this build can't read are dropped; fields it doesn't know
// are kept. Pure TypeScript; no React Native imports.
import { fold } from './emergency.ts';
import { countryForZone } from './emergency.ts';
import { bboxContains, type CityCatalog, type CityMap } from './citymaps.ts';
import { zoneCity } from './format.ts';
import type { Item, LocalDate, Stamp, Trip } from './model.ts';
import { destinationPoints, type Check } from './readiness.ts';
import { sortItems, zonesReadable } from './timeline.ts';
import { readCheckin } from './checkin.ts';
import { addDays, daysBetween, fromUtc, isLocalDateTime, isValidZone, localDate, localTime, toUtc } from './tz.ts';

export const MAX_TODO_TITLE = 200;
/** Rows per trip a file may carry (extra rows are left out). */
export const MAX_TODOS = 500;
/** An open to-do due within this many days (today counts as 0) is "due soon". */
export const DUE_SOON_DAYS = 3;
/** General guidance only: many airlines open online check-in about this many hours before departure. */
export const CHECKIN_OPENS_HOURS = 24;

const HOUR = 3_600_000;

export type Todo = {
  id: string;
  /** The traveller's words. Empty on a suggestion's row (the app words suggestions itself). */
  title: string;
  /** Own to-dos: the day it is due, in the departure zone. */
  due?: LocalDate;
  done?: boolean;
  /** Set on a suggestion's row: the suggestion's key (see suggestTodos). */
  suggestion?: string;
  /** A suggestion the traveller hid. */
  dismissed?: boolean;
  createdAt: string;
  updatedAt?: string;
};

// ------------------------------------------------------------------ reading

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
export const isTodoDate = (x: unknown): x is LocalDate => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);

function readTodo(x: unknown): Todo | null {
  if (!isObj(x) || !isStr(x.id) || !x.id) return null;
  const { title, due, done, suggestion, dismissed, updatedAt, ...rest } = x;
  const sug = isStr(suggestion) && suggestion ? suggestion : undefined;
  const name = isStr(title) ? title.slice(0, MAX_TODO_TITLE) : '';
  if (!sug && !name.trim()) return null;
  const out = { ...rest, id: x.id, title: name, createdAt: isStr(x.createdAt) ? x.createdAt : '' } as Todo;
  if (isTodoDate(due)) out.due = due;
  if (done === true) out.done = true;
  if (sug) out.suggestion = sug;
  if (sug && dismissed === true) out.dismissed = true;
  if (isStr(updatedAt)) out.updatedAt = updatedAt;
  return out;
}

/** The trip's stored rows, read defensively (absent on older trips; unreadable rows skipped; ids and suggestion keys kept once). */
export function readTodos(trip: Pick<Trip, 'todos'>): Todo[] {
  const list = (trip as { todos?: unknown }).todos;
  if (!Array.isArray(list)) return [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  const out: Todo[] = [];
  for (const row of list) {
    const t = readTodo(row);
    if (!t || ids.has(t.id) || (t.suggestion && keys.has(t.suggestion))) continue;
    ids.add(t.id);
    if (t.suggestion) keys.add(t.suggestion);
    out.push(t);
  }
  return out;
}

// ------------------------------------------------------------------ departure and due dates

/** The trip's departure: its first booking's start (notes left out) in its own zone, else the start date at 00:00 in the home zone. */
export function departure(trip: Pick<Trip, 'items' | 'startDate' | 'homeTz'>): Stamp {
  const first = sortItems((trip.items ?? []).filter((i) => i.kind !== 'note')).find(zonesReadable);
  if (first) return first.start;
  const tz = isValidZone(trip.homeTz) ? trip.homeTz : 'UTC';
  return { local: `${isTodoDate(trip.startDate) ? trip.startDate : '1970-01-01'}T00:00`, tz };
}

/**
 * When a to-do is due. `date` is the day, in `tz`. `time`: a wall-clock time that day (check-in opening), else the
 * whole day counts. `late`: the instant after which it is too late (a flight's departure); absent means the end of
 * the due day.
 */
export type Due = { date: LocalDate; tz: string; time?: string; late?: number };

/** The departure-zone day `days` before departure. */
export const dueBefore = (dep: Stamp, days: number): Due => ({ date: addDays(localDate(dep.local), -days), tz: dep.tz });

/** Check-in opens about 24 h before the flight (T143: or the booking's own opening offset), on the flight's departure clock (general guidance). */
export function checkinDue(flight: Item): Due {
  const at = toUtc(flight.start) - (readCheckin(flight.checkin)?.opensH ?? CHECKIN_OPENS_HOURS) * HOUR;
  const wall = fromUtc(at, flight.start.tz);
  return { date: localDate(wall), time: localTime(wall), tz: flight.start.tz, late: toUtc(flight.start) };
}

/** done; overdue; soon (due within DUE_SOON_DAYS, or check-in already open); later; undated (own to-do without a date). */
export type TodoState = 'done' | 'overdue' | 'soon' | 'later' | 'undated';

/** The state of an open (or done) to-do at `now`. */
export function dueState(due: Due | null, done: boolean, now: number): TodoState {
  if (done) return 'done';
  if (!due) return 'undated';
  if (due.late !== undefined) {
    if (now >= due.late) return 'overdue';
    const opens = toUtc({ local: `${due.date}T${due.time ?? '00:00'}`, tz: due.tz });
    if (now >= opens) return 'soon';
  }
  const today = localDate(fromUtc(now, due.tz));
  const left = daysBetween(today, due.date);
  if (left < 0) return due.late !== undefined ? 'soon' : 'overdue';
  return left < DUE_SOON_DAYS ? 'soon' : 'later';
}

/** Days from today (in the due zone) to the due day: 0 today, 1 tomorrow, negative when past. */
export const daysLeft = (due: Due, now: number): number => daysBetween(localDate(fromUtc(now, due.tz)), due.date);

/** True when check-in (a timed due) has opened and the flight hasn't left. */
export function isOpenNow(due: Due | null, now: number): boolean {
  if (!due || due.late === undefined || !due.time) return false;
  return now >= toUtc({ local: `${due.date}T${due.time}`, tz: due.tz }) && now < due.late;
}

// ------------------------------------------------------------------ suggestions

export type SuggestionKind = 'insurance' | 'entry' | 'bank' | 'roaming' | 'map' | 'transfer' | 'checkin' | 'tickets';
/** Display order on the screen for suggestions due the same day. */
export const SUGGESTION_KINDS: readonly SuggestionKind[] = ['insurance', 'entry', 'bank', 'roaming', 'map', 'transfer', 'checkin', 'tickets'];

/** Days before departure each trip-wide suggestion is due. */
export const DUE_DAYS: Record<Exclude<SuggestionKind, 'checkin'>, number> = {
  entry: 30,
  insurance: 21,
  bank: 7,
  transfer: 3,
  roaming: 3,
  map: 2,
  tickets: 1,
};

export type Suggestion = {
  key: string;
  kind: SuggestionKind;
  /** entry: the ISO country code. */
  country?: string;
  /** map: the city name. transfer: where the flight lands. */
  city?: string;
  /** transfer / checkin: the flight's number (else its title), for the words. */
  flight?: string;
  due: Due;
  /** map: the city map is already saved on this phone, so it counts as done. */
  auto?: boolean;
};

export type SuggestInput = {
  /** The offline map catalog, when this phone has one (null: name stops by their zone's city). */
  catalog?: CityCatalog | null;
  installed?: readonly CityMap[];
  now?: number;
};

const zonesOf = (i: Item): string[] => [i.start?.tz, i.end?.tz].filter((z): z is string => isStr(z) && !!z);

const flightLabel = (f: Item): string => (f.number?.trim() || f.title?.trim() || '').slice(0, 60);

/** Built from the flight itself (not its id), so ticks survive an import: departure wall clock, zone and number. */
export const flightKey = (f: Item): string => `${f.start.local}|${f.start.tz}|${fold(f.number?.trim() || f.title?.trim() || '')}`;

/** The countries on the trip other than home, in trip order (from the bookings' zones). */
export function tripCountries(trip: Pick<Trip, 'items' | 'homeTz'>): string[] {
  const home = countryForZone(trip.homeTz);
  const out: string[] = [];
  for (const i of sortItems(trip.items ?? [])) for (const z of zonesOf(i)) {
    const c = countryForZone(z);
    if (c && c !== home && !out.includes(c)) out.push(c);
  }
  return out;
}

const goesAbroad = (trip: Pick<Trip, 'items' | 'homeTz'>): boolean =>
  tripCountries(trip).length > 0 || (trip.items ?? []).some((i) => zonesOf(i).some((z) => z !== trip.homeTz && isValidZone(z) && countryForZone(z) !== countryForZone(trip.homeTz)));

/**
 * The stops that want an offline city map. With a catalog: each catalog city covering a place on the trip (hotels
 * first), in trip order. Without one: the city of each zone the trip sleeps in (else arrives in) away from home.
 */
export function mapStops(trip: Trip, catalog: CityCatalog | null | undefined): string[] {
  const out: string[] = [];
  const push = (name: string) => {
    if (name && !out.some((x) => fold(x) === fold(name))) out.push(name);
  };
  if (catalog) {
    for (const p of destinationPoints(trip)) {
      const c = catalog.cities.find((x) => bboxContains(x.bbox, p.lat, p.lon));
      if (c) push(c.name);
    }
    return out;
  }
  const items = sortItems(trip.items ?? []).filter(zonesReadable);
  for (const i of items) if (i.kind === 'hotel' && i.start.tz !== trip.homeTz) push(zoneCity(i.start.tz));
  if (!out.length) for (const i of items) if (i.end && i.end.tz !== trip.homeTz && i.kind !== 'hotel') push(zoneCity(i.end.tz));
  return out;
}

/**
 * The to-dos Satchel suggests for a trip, built offline from the trip: due dates count back from departure (check-in
 * from each flight). Flights that have already left at `now` get no check-in or airport-transfer suggestion.
 */
export function suggestTodos(trip: Trip, input: SuggestInput = {}): Suggestion[] {
  const dep = departure(trip);
  const out: Suggestion[] = [];
  const before = (k: Exclude<SuggestionKind, 'checkin'>) => dueBefore(dep, DUE_DAYS[k]);
  const abroad = goesAbroad(trip);
  out.push({ key: 'insurance', kind: 'insurance', due: before('insurance') });
  for (const c of tripCountries(trip)) out.push({ key: `entry:${c}`, kind: 'entry', country: c, due: before('entry') });
  if (abroad) {
    out.push({ key: 'bank', kind: 'bank', due: before('bank') });
    out.push({ key: 'roaming', kind: 'roaming', due: before('roaming') });
  }
  const installed = input.installed ?? [];
  for (const city of mapStops(trip, input.catalog)) {
    const have = installed.some((c) => fold(c.name) === fold(city));
    out.push({ key: `map:${fold(city)}`, kind: 'map', city, due: before('map'), ...(have ? { auto: true } : {}) });
  }
  const now = input.now;
  const flights = sortItems((trip.items ?? []).filter((i) => i.kind === 'flight')).filter(zonesReadable);
  for (const f of flights) {
    if (now !== undefined && toUtc(f.start) <= now) continue;
    const label = flightLabel(f);
    if (f.end && f.end.tz !== trip.homeTz) {
      const city = f.to?.name?.trim() || zoneCity(f.end.tz);
      out.push({ key: `transfer:${flightKey(f)}`, kind: 'transfer', city, flight: label, due: { date: addDays(localDate(f.start.local), -DUE_DAYS.transfer), tz: f.start.tz } });
    }
    out.push({ key: `checkin:${flightKey(f)}`, kind: 'checkin', flight: label, due: checkinDue(f) });
  }
  if ((trip.items ?? []).some((i) => i.kind === 'flight' || i.kind === 'train' || i.kind === 'ferry' || i.kind === 'bus')) out.push({ key: 'tickets', kind: 'tickets', due: before('tickets') });
  return out;
}

// ------------------------------------------------------------------ the list

export type TodoView = {
  /** Suggestion key, or `own:<id>`. */
  key: string;
  kind: SuggestionKind | 'own';
  /** Own to-dos: the traveller's words. */
  title: string;
  country?: string;
  city?: string;
  flight?: string;
  due: Due | null;
  state: TodoState;
  done: boolean;
  /** Ticked by Satchel itself (the city map is saved); can't be unticked here. */
  auto: boolean;
  dismissed: boolean;
  /** Own to-dos: the stored row's id. */
  id?: string;
};

export type TodoList = {
  /** Not done and not hidden: overdue first, then by due date (undated last). */
  open: TodoView[];
  done: TodoView[];
  /** Suggestions the traveller hid (can be shown again). */
  hidden: TodoView[];
};

const ownKey = (id: string) => `own:${id}`;

const dueMs = (d: Due | null): number => (d ? toUtc({ local: `${d.date}T${d.time ?? '00:00'}`, tz: d.tz }) : Infinity);
const STATE_RANK: Record<TodoState, number> = { overdue: 0, soon: 1, later: 2, undated: 3, done: 4 };
const kindRank = (k: TodoView['kind']) => (k === 'own' ? SUGGESTION_KINDS.length : SUGGESTION_KINDS.indexOf(k));
const byDue = (a: TodoView, b: TodoView) => STATE_RANK[a.state] - STATE_RANK[b.state] || dueMs(a.due) - dueMs(b.due) || kindRank(a.kind) - kindRank(b.kind) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** Every to-do of the trip at `now`: suggestions merged with their stored ticks, plus the traveller's own. */
export function todoList(trip: Trip, now: number, input: Omit<SuggestInput, 'now'> = {}): TodoList {
  const rows = readTodos(trip);
  const marks = new Map(rows.filter((r) => r.suggestion).map((r) => [r.suggestion as string, r]));
  const dep = departure(trip);
  const views: TodoView[] = [];
  for (const s of suggestTodos(trip, { ...input, now })) {
    const m = marks.get(s.key);
    const done = s.auto === true || m?.done === true;
    views.push({
      key: s.key,
      kind: s.kind,
      title: '',
      ...(s.country ? { country: s.country } : {}),
      ...(s.city ? { city: s.city } : {}),
      ...(s.flight ? { flight: s.flight } : {}),
      due: s.due,
      state: dueState(s.due, done, now),
      done,
      auto: s.auto === true,
      dismissed: !done && m?.dismissed === true,
    });
  }
  for (const r of rows) {
    if (r.suggestion) continue;
    const due: Due | null = r.due ? { date: r.due, tz: dep.tz } : null;
    const done = r.done === true;
    views.push({ key: ownKey(r.id), kind: 'own', title: r.title, due, state: dueState(due, done, now), done, auto: false, dismissed: false, id: r.id });
  }
  views.sort(byDue);
  return { open: views.filter((v) => !v.done && !v.dismissed), done: views.filter((v) => v.done), hidden: views.filter((v) => v.dismissed) };
}

export type TodoCounts = { open: number; overdue: number; soon: number; done: number; hidden: number };

export function todoCounts(l: TodoList): TodoCounts {
  return { open: l.open.length, overdue: l.open.filter((v) => v.state === 'overdue').length, soon: l.open.filter((v) => v.state === 'soon').length, done: l.done.length, hidden: l.hidden.length };
}

// ------------------------------------------------------------------ changes

const stamp = (row: Todo, now: string): Todo => ({ ...row, updatedAt: now });

function putRow(trip: Trip, row: Todo): Trip {
  const list = readTodos(trip);
  const i = list.findIndex((x) => x.id === row.id);
  return { ...trip, todos: i < 0 ? [...list, row] : list.map((x, n) => (n === i ? row : x)) };
}

const markFor = (trip: Trip, key: string): Todo | undefined => readTodos(trip).find((r) => r.suggestion === key);

/** Changes a suggestion's stored row (made on first use). A row left with nothing to say is removed. */
function markSuggestion(trip: Trip, key: string, change: { done?: boolean; dismissed?: boolean }, newId: (p: string) => string, now: string): Trip {
  const prev = markFor(trip, key);
  const { done: _d, dismissed: _x, ...base } = prev ?? { id: newId('todo'), title: '', suggestion: key, createdAt: now };
  const done = change.done ?? prev?.done === true;
  const dismissed = change.dismissed ?? prev?.dismissed === true;
  if (!done && !dismissed) return { ...trip, todos: readTodos(trip).filter((r) => r.suggestion !== key) };
  return putRow(trip, stamp({ ...base, ...(done ? { done: true } : {}), ...(dismissed && !done ? { dismissed: true } : {}) }, now));
}

/** Ticks a to-do on or off by its view key (a suggestion key or own:<id>). */
export function setTodoDone(trip: Trip, key: string, done: boolean, newId: (p: string) => string, now = new Date().toISOString()): Trip {
  if (key.startsWith('own:')) {
    const id = key.slice(4);
    const prev = readTodos(trip).find((r) => r.id === id && !r.suggestion);
    if (!prev) return trip;
    const { done: _d, ...rest } = prev;
    return putRow(trip, stamp({ ...rest, ...(done ? { done: true } : {}) }, now));
  }
  return markSuggestion(trip, key, { done, ...(done ? { dismissed: false } : {}) }, newId, now);
}

/** Hides a suggestion (it moves to "Hidden", from where it can be shown again). */
export const dismissTodo = (trip: Trip, key: string, newId: (p: string) => string, now = new Date().toISOString()): Trip =>
  key.startsWith('own:') ? trip : markSuggestion(trip, key, { dismissed: true, done: false }, newId, now);

/** Shows a hidden suggestion again. */
export const restoreTodo = (trip: Trip, key: string, newId: (p: string) => string, now = new Date().toISOString()): Trip =>
  key.startsWith('own:') ? trip : markSuggestion(trip, key, { dismissed: false }, newId, now);

// ---- the traveller's own

export type TodoDraft = { title: string; due: LocalDate | '' };
export type TodoError = 'title' | 'due';

export const newTodoDraft = (): TodoDraft => ({ title: '', due: '' });

export function draftFromTodo(t: Todo): TodoDraft {
  return { title: t.title, due: t.due ?? '' };
}

export function validateTodo(d: TodoDraft): TodoError[] {
  const out: TodoError[] = [];
  if (!d.title.trim()) out.push('title');
  if (d.due !== '' && !isTodoDate(d.due)) out.push('due');
  return out;
}

/** The own to-do a draft saves as (new when `prev` is absent). Fields of `prev` this build doesn't know are kept. */
export function todoFromDraft(d: TodoDraft, newId: (p: string) => string, prev?: Todo, now = new Date().toISOString()): Todo {
  const { due: _d, updatedAt: _u, ...kept } = prev ?? ({} as Partial<Todo>);
  const out = { ...kept, id: prev?.id ?? newId('todo'), title: d.title.trim().slice(0, MAX_TODO_TITLE), createdAt: prev?.createdAt ?? now } as Todo;
  if (prev) out.updatedAt = now;
  if (d.due && isTodoDate(d.due)) out.due = d.due;
  return out;
}

export const findTodo = (trip: Trip, id: string): Todo | undefined => readTodos(trip).find((r) => r.id === id && !r.suggestion);

export const upsertTodo = (trip: Trip, todo: Todo): Trip => putRow(trip, todo);

export const removeTodo = (trip: Trip, id: string): Trip => ({ ...trip, todos: readTodos(trip).filter((r) => r.id !== id) });

// ------------------------------------------------------------------ elsewhere in the app

/** "Due soon" on the Your day card: overdue and due-soon open to-dos, the first one to name. Null when there are none. */
export function briefTodos(trip: Trip, now: number, input: Omit<SuggestInput, 'now'> = {}): { overdue: number; soon: number; first: TodoView } | null {
  const open = todoList(trip, now, input).open.filter((v) => v.state === 'overdue' || v.state === 'soon');
  if (!open.length) return null;
  return { overdue: open.filter((v) => v.state === 'overdue').length, soon: open.filter((v) => v.state === 'soon').length, first: open[0]! };
}

/**
 * The to-dos row of the Trip readiness check. warn when any open to-do is overdue (reason overdue) or due soon
 * (dueSoon), with that count as `done` and the open count as `total`; pass when the rest are not due yet (onTrack)
 * or all are ticked (done); unknown when there is nothing on the list.
 */
export function todosCheck(trip: Trip, now: number, input: Omit<SuggestInput, 'now'> = {}): Check {
  const c = todoCounts(todoList(trip, now, input));
  const fix = { kind: 'todos', tripId: trip.id } as const;
  if (c.overdue) return { id: 'todos', status: 'warn', reason: 'overdue', done: c.overdue, total: c.open, fix };
  if (c.soon) return { id: 'todos', status: 'warn', reason: 'dueSoon', done: c.soon, total: c.open, fix };
  if (c.open) return { id: 'todos', status: 'pass', reason: 'onTrack', done: c.open, total: c.open, fix };
  if (c.done) return { id: 'todos', status: 'pass', reason: 'done', done: c.done, total: c.done, fix: null };
  return { id: 'todos', status: 'unknown', reason: 'none', fix };
}

// ------------------------------------------------------------------ .satchel files

/** A file's `todos` (absent on older files), cleaned: unreadable rows left out, never refusing the file. Undefined when none. */
export function readFileTodos(raw: unknown): Todo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = readTodos({ todos: raw.slice(0, MAX_TODOS) as Todo[] });
  return list.length ? list : undefined;
}

/** Imported to-dos get new ids, like everything else in an imported trip. Suggestion keys need no remapping. */
export function importTodos(list: readonly Todo[] | undefined, newId: (p: string) => string): Todo[] | undefined {
  if (!list || !list.length) return undefined;
  return list.map((t) => ({ ...t, id: newId('todo') }));
}
