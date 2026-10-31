import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CityCatalog, CityMap } from './citymaps.ts';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import { readiness, toFix } from './readiness.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';
import { toUtc } from './tz.ts';
import { en } from '../i18n/en.ts';
import { todos as todoStrings } from '../i18n/en/todos.ts';
import {
  briefTodos,
  checkinDue,
  departure,
  dismissTodo,
  draftFromTodo,
  dueBefore,
  dueState,
  findTodo,
  isOpenNow,
  mapStops,
  newTodoDraft,
  readFileTodos,
  readTodos,
  removeTodo,
  restoreTodo,
  setTodoDone,
  suggestTodos,
  todoCounts,
  todoFromDraft,
  todoList,
  todosCheck,
  tripCountries,
  upsertTodo,
  validateTodo,
} from './todos.ts';

// Demo trip 3–11 Nov 2026, home Sydney; first booking: flight DA 21 at 09:30 Sydney on 3 Nov.
const trip = demoTrip('2026-11-03', '2026-10-01T00:00:00Z');
let n = 0;
const ids = (p: string) => `${p}_${++n}`;
const at = (local: string, tz = 'Australia/Sydney') => toUtc({ local, tz });
const keys = (t: Trip, now: number) => suggestTodos(t, { now }).map((s) => s.key);

const city = (id: string, name: string, bbox: [number, number, number, number]): CityMap => ({ id, name, country: 'JP', bbox, center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], minzoom: 10, maxzoom: 15, file: `${id}.tar`, bytes: 1 });
const TOKYO = city('tokyo', 'Tokyo', [139.5, 35.5, 140.0, 35.9]);
const KYOTO = city('kyoto', 'Kyoto', [135.6, 34.9, 135.9, 35.1]);
const catalog: CityCatalog = { version: 1, release: 'satchel-maps-v1', built: '2026-10-01', attribution: '© OpenStreetMap contributors', cities: [TOKYO, KYOTO] };

const flight = (over: Partial<Item>): Item => ({
  id: 'f',
  tripId: 't',
  kind: 'flight',
  title: 'Flight',
  start: { local: '2027-01-10T08:00', tz: 'Europe/London' },
  end: { local: '2027-01-10T11:00', tz: 'Europe/Paris' },
  attachments: [],
  ...over,
});

// ------------------------------------------------------------------ suggestion rules

test('suggestions: insurance, entry rules per country, bank, roaming, maps per stop, transfer + check-in per flight, tickets', () => {
  const now = at('2026-10-01T12:00');
  const s = suggestTodos(trip, { now });
  const kinds = s.map((x) => x.kind);
  assert.deepEqual(new Set(kinds), new Set(['insurance', 'entry', 'bank', 'roaming', 'map', 'transfer', 'checkin', 'tickets']));
  assert.deepEqual(s.filter((x) => x.kind === 'entry').map((x) => x.country), ['JP']);
  const flights = trip.items.filter((i) => i.kind === 'flight');
  assert.equal(s.filter((x) => x.kind === 'checkin').length, flights.length, 'one check-in per flight');
  // The flight home lands in the home zone: no airport transfer suggested for it.
  const arrivingAway = flights.filter((f) => f.end && f.end.tz !== trip.homeTz).length;
  assert.equal(s.filter((x) => x.kind === 'transfer').length, arrivingAway);
  assert.ok(s.find((x) => x.kind === 'transfer')?.flight, 'transfer names the flight');
});

test('suggestions: a trip at home has insurance and tickets but no entry rules, bank or roaming', () => {
  const local: Trip = { ...trip, items: [flight({ start: { local: '2027-01-10T08:00', tz: 'Australia/Sydney' }, end: { local: '2027-01-10T09:30', tz: 'Australia/Melbourne' } })] };
  const k = keys(local, at('2027-01-01T00:00'));
  assert.ok(k.includes('insurance'));
  assert.ok(k.includes('tickets'));
  assert.ok(!k.some((x) => x.startsWith('entry:') || x === 'bank' || x === 'roaming'));
  assert.deepEqual(tripCountries(local), []);
});

test('suggestions: entry rules once per country, in trip order, home left out', () => {
  const t: Trip = { ...trip, homeTz: 'Europe/London', items: [flight({}), flight({ id: 'g', start: { local: '2027-01-12T08:00', tz: 'Europe/Paris' }, end: { local: '2027-01-12T10:00', tz: 'Europe/Rome' } })] };
  assert.deepEqual(tripCountries(t), ['FR', 'IT']);
  assert.deepEqual(keys(t, 0).filter((k) => k.startsWith('entry:')), ['entry:FR', 'entry:IT']);
});

test('suggestions: flights that already left get no check-in or transfer', () => {
  const k = keys(trip, at('2026-11-05T12:00'));
  const flights = trip.items.filter((i) => i.kind === 'flight');
  const left = flights.filter((f) => toUtc(f.start) <= at('2026-11-05T12:00')).length;
  assert.ok(left > 0);
  assert.equal(k.filter((x) => x.startsWith('checkin:')).length, flights.length - left);
});

test('map stops: catalog cities covering the trip (hotels first); without a catalog, the zone city', () => {
  const stops = mapStops(trip, catalog);
  assert.ok(stops.includes('Tokyo'));
  assert.equal(new Set(stops).size, stops.length, 'each city once');
  assert.deepEqual(mapStops(trip, null), ['Tokyo']);
  assert.deepEqual(mapStops(trip, { ...catalog, cities: [] }), [], 'no city in the catalog: nothing to download');
});

test('map: a city already saved on this phone counts as done (auto) and cannot be unticked by a stored row', () => {
  const now = at('2026-10-01T12:00');
  const l = todoList(trip, now, { catalog, installed: [TOKYO] });
  const tokyo = l.done.find((v) => v.key === 'map:tokyo');
  assert.ok(tokyo?.auto);
  assert.ok(!l.open.some((v) => v.key === 'map:tokyo'));
});

// ------------------------------------------------------------------ due-date maths

test('due dates count back from departure in the departure zone', () => {
  const dep = departure(trip);
  assert.deepEqual(dep, { local: '2026-11-03T09:30', tz: 'Australia/Sydney' });
  const s = suggestTodos(trip, { now: 0 });
  const due = (k: string) => s.find((x) => x.key === k)?.due;
  assert.deepEqual(due('insurance'), { date: '2026-10-13', tz: 'Australia/Sydney' });
  assert.deepEqual(due('entry:JP'), { date: '2026-10-04', tz: 'Australia/Sydney' });
  assert.deepEqual(due('bank'), { date: '2026-10-27', tz: 'Australia/Sydney' });
  assert.deepEqual(due('tickets'), { date: '2026-11-02', tz: 'Australia/Sydney' });
});

test('departure: notes are skipped; with no booking it is the start date in the home zone', () => {
  const noted: Trip = { ...trip, items: [{ ...trip.items[0], id: 'n', kind: 'note', start: { local: '2026-10-20T08:00', tz: 'Asia/Tokyo' }, end: undefined }, ...trip.items] };
  assert.equal(departure(noted).local, '2026-11-03T09:30');
  assert.deepEqual(departure({ ...trip, items: [] }), { local: '2026-11-03T00:00', tz: 'Australia/Sydney' });
});

test('check-in opens about 24 h before, on the flight’s own clock, across a DST change', () => {
  // London clocks go forward at 01:00 on 28 Mar 2027: 24 real hours before 28 Mar 12:00 BST is 27 Mar 11:00 GMT.
  const d = checkinDue(flight({ start: { local: '2027-03-28T12:00', tz: 'Europe/London' } }));
  assert.equal(d.date, '2027-03-27');
  assert.equal(d.time, '11:00');
  assert.equal(d.tz, 'Europe/London');
  assert.equal(d.late, toUtc({ local: '2027-03-28T12:00', tz: 'Europe/London' }));
  // Its own clock, not the phone's or home zone: a Tokyo departure reads in Tokyo time.
  assert.deepEqual(checkinDue(flight({ start: { local: '2027-01-10T21:30', tz: 'Asia/Tokyo' } })).time, '21:30');
});

test('states: later, soon (within 3 days, today counts), overdue after the due day, all in the due zone', () => {
  const due = { date: '2026-11-10', tz: 'Asia/Tokyo' };
  assert.equal(dueState(due, false, toUtc({ local: '2026-11-07T12:00', tz: 'Asia/Tokyo' })), 'later');
  assert.equal(dueState(due, false, toUtc({ local: '2026-11-08T00:00', tz: 'Asia/Tokyo' })), 'soon');
  assert.equal(dueState(due, false, toUtc({ local: '2026-11-10T23:59', tz: 'Asia/Tokyo' })), 'soon');
  assert.equal(dueState(due, false, toUtc({ local: '2026-11-11T00:00', tz: 'Asia/Tokyo' })), 'overdue');
  // 10 Nov 23:30 in Sydney is still 10 Nov 21:30 in Tokyo: not overdue there.
  assert.equal(dueState(due, false, toUtc({ local: '2026-11-10T23:30', tz: 'Australia/Sydney' })), 'soon');
  assert.equal(dueState(due, true, toUtc({ local: '2026-12-01T00:00', tz: 'Asia/Tokyo' })), 'done');
  assert.equal(dueState(null, false, 0), 'undated');
});

test('check-in state: soon while open, overdue only once the flight has left', () => {
  const f = flight({ start: { local: '2027-01-10T08:00', tz: 'Europe/London' } });
  const d = checkinDue(f);
  const lon = (l: string) => toUtc({ local: l, tz: 'Europe/London' });
  assert.equal(dueState(d, false, lon('2027-01-01T08:00')), 'later');
  assert.equal(dueState(d, false, lon('2027-01-09T09:00')), 'soon');
  assert.ok(isOpenNow(d, lon('2027-01-09T09:00')));
  assert.ok(!isOpenNow(d, lon('2027-01-09T07:00')));
  assert.equal(dueState(d, false, lon('2027-01-10T07:59')), 'soon');
  assert.equal(dueState(d, false, lon('2027-01-10T08:00')), 'overdue');
});

test('own to-dos are due in the departure zone', () => {
  const t = upsertTodo(trip, todoFromDraft({ title: 'Book onsen', due: '2026-11-01' }, ids, undefined, 'x'));
  const v = todoList(t, at('2026-10-01T00:00')).open.find((x) => x.kind === 'own');
  assert.deepEqual(v?.due, { date: '2026-11-01', tz: 'Australia/Sydney' });
  assert.equal(v?.title, 'Book onsen');
});

test('the list: overdue first, then by due date; undated own to-dos last', () => {
  let t = upsertTodo(trip, todoFromDraft({ title: 'Someday', due: '' }, ids, undefined, 'x'));
  t = upsertTodo(t, todoFromDraft({ title: 'Late one', due: '2026-10-01' }, ids, undefined, 'x'));
  const l = todoList(t, at('2026-10-20T12:00'));
  const states = l.open.map((v) => v.state);
  const rank = { overdue: 0, soon: 1, later: 2, undated: 3, done: 4 } as const;
  assert.deepEqual(states, [...states].sort((a, b) => rank[a] - rank[b]));
  assert.equal(l.open[l.open.length - 1]?.title, 'Someday');
  assert.equal(l.open[0]?.state, 'overdue');
});

// ------------------------------------------------------------------ tick, dismiss, restore

test('tick a suggestion on and off; it is stored by key only while it says something', () => {
  const now = at('2026-10-01T12:00');
  const on = setTodoDone(trip, 'insurance', true, ids, 'x');
  assert.equal(readTodos(on).length, 1);
  assert.ok(todoList(on, now).done.some((v) => v.key === 'insurance'));
  const off = setTodoDone(on, 'insurance', false, ids, 'y');
  assert.equal(readTodos(off).length, 0);
  assert.ok(todoList(off, now).open.some((v) => v.key === 'insurance'));
});

test('dismiss hides a suggestion; restore shows it again; ticking a hidden one un-hides it', () => {
  const now = at('2026-10-01T12:00');
  const hid = dismissTodo(trip, 'bank', ids, 'x');
  const l = todoList(hid, now);
  assert.ok(l.hidden.some((v) => v.key === 'bank'));
  assert.ok(!l.open.some((v) => v.key === 'bank'));
  assert.equal(todoCounts(l).hidden, 1);
  const back = restoreTodo(hid, 'bank', ids, 'y');
  assert.equal(readTodos(back).length, 0);
  assert.ok(todoList(back, now).open.some((v) => v.key === 'bank'));
  const ticked = setTodoDone(hid, 'bank', true, ids, 'z');
  assert.ok(todoList(ticked, now).done.some((v) => v.key === 'bank'));
  assert.equal(readTodos(ticked)[0]?.dismissed, undefined);
  assert.equal(dismissTodo(trip, 'own:x', ids), trip, 'own to-dos are deleted, not hidden');
});

test('own to-dos: validate, add, edit (unknown fields kept), tick, remove', () => {
  assert.deepEqual(validateTodo(newTodoDraft()), ['title']);
  assert.deepEqual(validateTodo({ title: 'x', due: '2026-02-30' }), ['due']);
  assert.deepEqual(validateTodo({ title: ' Pick up yen ', due: '2026-11-01' }), []);
  const a = todoFromDraft({ title: ' Pick up yen ', due: '2026-11-01' }, ids, undefined, 'c');
  assert.equal(a.title, 'Pick up yen');
  let t = upsertTodo(trip, { ...a, future: 1 } as typeof a);
  const prev = findTodo(t, a.id)!;
  const edited = todoFromDraft({ ...draftFromTodo(prev), due: '' }, ids, prev, 'e');
  assert.equal(edited.due, undefined);
  assert.equal((edited as unknown as { future: number }).future, 1);
  assert.equal(edited.updatedAt, 'e');
  t = upsertTodo(t, edited);
  t = setTodoDone(t, `own:${a.id}`, true, ids, 'f');
  assert.equal(findTodo(t, a.id)?.done, true);
  assert.equal(readTodos(removeTodo(t, a.id)).length, 0);
});

test('stored rows are read defensively: junk dropped, duplicate ids and keys kept once, unknown fields kept', () => {
  const raw = [null, 3, { id: '' }, { id: 'a', title: '   ' }, { id: 'b', title: 'Ok', due: 'soon', extra: true }, { id: 'b', title: 'Dup' }, { id: 'c', suggestion: 'bank', dismissed: true }, { id: 'd', suggestion: 'bank', done: true }];
  const list = readTodos({ todos: raw as never });
  assert.deepEqual(list.map((x) => x.id), ['b', 'c']);
  assert.equal(list[0]?.due, undefined);
  assert.equal((list[0] as unknown as { extra: boolean }).extra, true);
  assert.deepEqual(readTodos({}), []);
});

// ------------------------------------------------------------------ readiness row and Your day

test('readiness: the to-dos row is added only when given, last, and counts like any other row', () => {
  const base = { trip, docs: [], packing: null, card: null, catalog: null, installed: [] as CityMap[], now: at('2026-10-31T12:00') };
  assert.ok(!readiness(base).checks.some((c) => c.id === 'todos'));
  const row = todosCheck(trip, base.now);
  assert.equal(row.status, 'warn');
  assert.equal(row.reason, 'overdue');
  assert.ok((row.done ?? 0) > 0);
  assert.deepEqual(row.fix, { kind: 'todos', tripId: trip.id });
  const r = readiness({ ...base, todos: row });
  assert.equal(r.checks[r.checks.length - 1]?.id, 'todos');
  assert.equal(toFix(r)[toFix(r).length - 1]?.id, 'todos', 'warn rows after missing ones');
});

test('readiness row: on track far ahead, due soon close in, done when all ticked, nothing to judge when all hidden', () => {
  const early = todosCheck(trip, at('2026-08-01T12:00'));
  assert.equal(early.status, 'pass');
  assert.equal(early.reason, 'onTrack');
  const t = { ...trip, startDate: '2026-11-03', items: [] };
  const soon = todosCheck(t, at('2026-10-11T12:00'));
  assert.equal(soon.reason, 'dueSoon', 'insurance is due 13 Oct');
  let all: Trip = setTodoDone(t, 'insurance', true, ids, 'x');
  assert.equal(todosCheck(all, at('2026-10-11T12:00')).reason, 'done');
  all = dismissTodo(t, 'insurance', ids, 'x');
  assert.equal(todosCheck(all, 0).status, 'unknown');
});

test('Your day: due-soon and overdue to-dos, the first to name; none when nothing is close', () => {
  const now = at('2026-11-05T12:00');
  const b = briefTodos(trip, now);
  assert.ok(b);
  assert.ok(b.overdue > 0);
  assert.equal(b.first.state, 'overdue');
  let done = trip;
  for (const v of todoList(trip, now).open) done = setTodoDone(done, v.key, true, ids, 'x');
  assert.equal(briefTodos(done, now), null);
});

// ------------------------------------------------------------------ .satchel files

test('.satchel: to-dos travel with the trip, with new ids; suggestion ticks still match after import', () => {
  const flight1 = trip.items.find((i) => i.kind === 'flight')!;
  const ck = suggestTodos(trip, { now: 0 }).find((s) => s.kind === 'checkin' && s.flight === flight1.number)!.key;
  let t = setTodoDone(trip, ck, true, ids, 'a');
  t = dismissTodo(t, 'roaming', ids, 'a');
  t = upsertTodo(t, todoFromDraft({ title: 'Buy yen', due: '2026-11-01' }, ids, undefined, 'a'));
  const payloads = Object.fromEntries(t.items.flatMap((i) => i.attachments.map((a) => [a.id, { data: 'QUJD' }])));
  const built = buildTripFile(t, payloads);
  const parsed = parseTripFileText(JSON.stringify(built.file));
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, (p) => `${p}_new${++n}`);
  const got = readTodos(imp.trip);
  assert.equal(got.length, 3);
  assert.ok(got.every((r) => r.id.includes('_new')));
  const l = todoList(imp.trip, at('2026-10-01T12:00'));
  assert.ok(l.done.some((v) => v.key === ck), 'the flight’s check-in tick survived new booking ids');
  assert.ok(l.hidden.some((v) => v.key === 'roaming'));
  assert.ok(l.open.some((v) => v.title === 'Buy yen'));
});

test('.satchel: unreadable to-do rows are left out, never refusing the file; older files have none', () => {
  assert.equal(readFileTodos(undefined), undefined);
  assert.equal(readFileTodos('x'), undefined);
  assert.deepEqual(readFileTodos([{ id: 'a', title: 'Ok' }, 'junk'])?.map((x) => x.id), ['a']);
  const built = buildTripFile({ ...trip, todos: [{ id: 'z' } as never] }, Object.fromEntries(trip.items.flatMap((i) => i.attachments.map((a) => [a.id, { data: 'QUJD' }]))));
  const parsed = parseTripFileText(JSON.stringify(built.file));
  assert.ok(parsed.ok);
  assert.equal(importTripFile(parsed.file, (p) => `${p}_${++n}`).trip.todos, undefined);
});

// ------------------------------------------------------------------ strings

test('strings: every to-do key lives in src/i18n/en/todos.ts; check-in is labelled general guidance', () => {
  const mine = Object.keys(todoStrings);
  assert.ok(mine.length > 20);
  for (const k of mine) assert.ok(k.startsWith('todos.'), k);
  for (const k of mine) assert.equal((en as Record<string, string>)[k], (todoStrings as Record<string, string>)[k], `${k} reaches the catalogue`);
  const s = todoStrings as Record<string, string>;
  assert.match(s['todos.kind.checkin.note'] ?? '', /general guidance/i);
  assert.match(s['todos.kind.checkin.note'] ?? '', /airlines differ/i);
  assert.ok(dueBefore(departure(trip), 0).date === '2026-11-03');
});
