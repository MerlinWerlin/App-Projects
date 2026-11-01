// T118 Plan this trip again: DST-safe day shift across zones, cleared ticks, new ids, no phone-only data, and the
// every-field guard (each Trip / Item / nested field has a rule: copied, cleared, shifted, renewed or excluded).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Budget, Companion, Item, Place, SavedPlace, Trip } from './model.ts';
import type { AirportInfo } from './leaveby.ts';
import type { Idea } from './ideas.ts';
import type { Todo } from './todos.ts';
import type { PackItem, PackList } from './packing.ts';
import type { Bag } from './bags.ts';
import { stayKey } from './staydetails.ts';
import { toUtc } from './tz.ts';
import {
  AIRPORT_RULES,
  ALL_PARTS,
  BAG_RULES,
  BUDGET_RULES,
  COMPANION_RULES,
  COPY_PARTS,
  copyPreview,
  copyTrip,
  IDEA_RULES,
  ITEM_RULES,
  nameForYear,
  PACK_ITEM_RULES,
  PACK_LIST_RULES,
  partCounts,
  PLACE_RULES,
  SAVED_PLACE_RULES,
  sameDayNextYear,
  shiftStamp,
  TODO_RULES,
  TRIP_RULES,
  type CopyParts,
  type Rule,
} from './tripcopy.ts';

const DAY = 86_400_000;
const NOW = '2026-11-01T09:00:00.000Z';

// ---- fixture: every field set (Required<> typing: a new model field is a type error here until it is set) ----

const place = (id: string, name: string, lat: number, lon: number): Required<Place> => ({ id, name, address: `${name} street 1`, localAddress: `${name} 1丁目`, lat, lon, phone: '+81 3 1234 5678' });
const airport: Required<AirportInfo> = { terminal: 'T1', gate: '52', boarding: '20:30', bagDrop: '19:45', scope: 'international', bufferMin: 150, travelMin: 45 };
const flight: Required<Item> = {
  id: 'item_flight',
  tripId: 'trip_full',
  kind: 'flight',
  title: 'Sydney to Tokyo',
  start: { local: '2027-04-01T21:00', tz: 'Australia/Sydney' },
  end: { local: '2027-04-02T05:30', tz: 'Asia/Tokyo' },
  from: place('pl_syd', 'Sydney Airport', -33.9399, 151.1753),
  to: place('pl_hnd', 'Haneda', 35.5494, 139.7798),
  place: place('pl_x', 'Lounge', -33.94, 151.18),
  ref: 'ABC123',
  seat: '42K',
  carrier: 'Example Air',
  number: 'EA 25',
  notes: 'Vegetarian meal',
  airport,
  attachments: [{ id: 'att_1', uri: 'file:///docs/attachments/att_1-boarding.pdf', name: 'boarding.pdf', mime: 'application/pdf', role: 'ticket', qrCropUri: 'file:///docs/attachments/att_1-crop.png' }],
};
const hotel: Required<Item> = {
  ...flight,
  id: 'item_hotel',
  kind: 'hotel',
  title: 'Hotel Asakusa',
  start: { local: '2027-04-02T15:00', tz: 'Asia/Tokyo' },
  end: { local: '2027-04-05T11:00', tz: 'Asia/Tokyo' },
  from: place('pl_hf', 'unused from', 35.1, 139.1),
  to: place('pl_ht', 'unused to', 35.2, 139.2),
  place: place('pl_hotel', 'Hotel Asakusa', 35.7148, 139.7967),
  ref: 'HTL-9',
  seat: 'n/a',
  attachments: [{ id: 'att_2', uri: 'file:///docs/attachments/att_2-voucher.png', name: 'voucher.png', mime: 'image/png', role: 'booking', qrCropUri: 'file:///docs/attachments/att_2-voucher.png' }],
};
const savedPlace: Required<SavedPlace> = { ...place('sp_1', 'Senso-ji', 35.7148, 139.7967), category: 'see', sample: true, savedAt: '2027-03-01T10:00:00.000Z' };
const idea: Required<Idea> = {
  id: 'idea_1',
  name: 'Ramen alley',
  category: 'eat',
  note: 'Go before 11',
  link: 'https://example.com/ramen',
  lat: 35.681,
  lon: 139.767,
  spotName: 'Tokyo Station',
  day: '2027-04-04',
  done: true,
  rank: 0,
  createdAt: '2027-03-02T09:00:00.000Z',
  updatedAt: '2027-03-03T09:00:00.000Z',
};
const todo: Required<Todo> = {
  id: 'todo_1',
  title: 'Book the onsen',
  due: '2027-03-25',
  done: true,
  suggestion: 'roaming',
  dismissed: true,
  createdAt: '2027-03-02T09:00:00.000Z',
  updatedAt: '2027-03-03T09:00:00.000Z',
};
/** A suggestion's row that only holds a tick: left out of the copy (its tick clears). */
const tickedSuggestion: Todo = { id: 'todo_2', title: '', suggestion: 'bank', done: true, createdAt: '2027-03-02T09:00:00.000Z' };
const ownTicked: Todo = { id: 'todo_3', title: 'Renew passport', done: true, createdAt: '2027-03-02T09:00:00.000Z' };
const companion: Required<Companion> = { id: 'c_sam', name: 'Sam' };
const budget: Required<Budget> = { currency: 'AUD', amount: 300000 };

const fullTrip = (): Required<Trip> =>
  structuredClone({
    id: 'trip_full',
    name: 'Tokyo spring 2027',
    startDate: '2027-04-01',
    endDate: '2027-04-06',
    homeTz: 'Australia/Sydney',
    items: [flight, hotel],
    places: [savedPlace],
    demo: true,
    createdAt: '2027-02-01T00:00:00.000Z',
    budget,
    rates: { JPY: 0.0102 },
    ratesUpdated: { JPY: { day: '2027-03-30', rate: 0.0102 } },
    expenses: [{ id: 'exp_1', amount: 4500, currency: 'JPY', category: 'food', day: '2027-04-03', note: 'Dinner', createdAt: NOW, paidBy: 'c_sam', split: { mode: 'equal', parts: [{ person: 'me', value: 1 }] } }],
    journal: [{ id: 'jrnl_1', day: '2027-04-03', note: 'Lanterns.', photos: [{ id: 'jph_1', uri: 'file:///docs/attachments/jph_1.jpg', name: 'temple.jpg', mime: 'image/jpeg', size: 1 }], createdAt: NOW }],
    ideas: [idea],
    companions: [companion],
    settlements: [{ id: 'set_1', from: 'me', to: 'c_sam', amount: 1500, currency: 'JPY' }],
    cover: 'city',
    todos: [todo, tickedSuggestion, ownTicked],
    dayPlans: [{ day: '2027-04-04', places: [{ placeId: 'sp_1' }], updatedAt: NOW }],
    cash: { start: [{ currency: 'JPY', amount: 20000 }], moves: [], paid: [{ expenseId: 'exp_1' }], leftover: { JPY: 'keep' }, local: 'JPY' },
    gifts: [{ id: 'gp_mum', name: 'Mum', gifts: [{ id: 'gift_1', what: 'Tea towel', status: 'packed', createdAt: NOW }], createdAt: NOW }],
  } as Required<Trip>);

const ownBag: Required<Bag> = { id: 'bag_cam', kind: 'own', name: 'Camera bag', colour: 'plum', hold: true, limitG: 8000 };
const packItem: Required<PackItem> = {
  id: 'pack_1',
  label: 'Adapter',
  done: true,
  category: 'tech',
  qty: 2,
  templateItemId: 'tpl_adapter',
  suggestionId: 'sg_adapter',
  userQty: 3,
  bag: 'carry',
  weightG: 250,
  movedFrom: 'bag_cam',
};
const packList = (): Required<PackList> =>
  structuredClone({
    tripId: 'trip_full',
    template: 'city',
    items: [packItem],
    templates: ['city', 'cold'],
    dismissed: ['sg_umbrella'],
    laundry: true,
    bags: [{ id: 'carry', kind: 'carry', colour: 'navy', limitG: 7000 }, ownBag],
    carryOnOnly: true,
  } as Required<PackList>);

let n = 0;
const newId = (prefix: string) => `${prefix}_new${++n}`;
const copy = (parts: CopyParts = ALL_PARTS, startDate = '2027-10-01') => copyTrip(fullTrip(), packList(), { startDate, parts, newId, now: NOW });
const none: CopyParts = { bookings: false, packing: false, bags: false, ideas: false, todos: false, companions: false, budget: false };

/** Every key set, none undefined, all the way down. */
function assertAllSet(x: unknown, path: string) {
  if (Array.isArray(x)) {
    assert.ok(x.length > 0, `${path} is empty`);
    x.forEach((v, i) => assertAllSet(v, `${path}[${i}]`));
  } else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      assert.notEqual(v, undefined, `${path}.${k} is undefined`);
      assertAllSet(v, `${path}.${k}`);
    }
  }
}

const keys = (o: object) => Object.keys(o).sort();

// ---- the every-field guard ----

test('T118 guard: every field of every copied type has exactly one rule (copied, cleared, shifted, renewed or excluded)', () => {
  const t = fullTrip();
  // Every field set; dropped fields need only be present (their contents are never read).
  for (const [k, v] of Object.entries(t)) {
    assert.notEqual(v, undefined, `trip.${k}`);
    if (TRIP_RULES[k as keyof Trip] !== 'drop') assertAllSet(v, `trip.${k}`);
  }
  assertAllSet(packList(), 'packing');
  // Rules cover exactly the fields the fixtures (typed Required<>) have; a new model field fails tsc and then here.
  assert.deepEqual(keys(TRIP_RULES), keys(t));
  assert.deepEqual(keys(ITEM_RULES), keys(flight));
  assert.deepEqual(keys(PLACE_RULES), keys(flight.from));
  assert.deepEqual(keys(SAVED_PLACE_RULES), keys(savedPlace));
  assert.deepEqual(keys(AIRPORT_RULES), keys(airport));
  assert.deepEqual(keys(IDEA_RULES), keys(idea));
  assert.deepEqual(keys(TODO_RULES), keys(todo));
  assert.deepEqual(keys(COMPANION_RULES), keys(companion));
  assert.deepEqual(keys(BUDGET_RULES), keys(budget));
  assert.deepEqual(keys(PACK_LIST_RULES), keys(packList()));
  assert.deepEqual(keys(PACK_ITEM_RULES), keys(packItem));
  assert.deepEqual(keys(BAG_RULES), keys(ownBag));
  // Same Trip / Item key list the T85 round-trip guard pins today (a new field must be ruled on in both).
  assert.deepEqual(keys(TRIP_RULES), ['budget', 'cash', 'companions', 'cover', 'createdAt', 'dayPlans', 'demo', 'endDate', 'expenses', 'gifts', 'homeTz', 'id', 'ideas', 'items', 'journal', 'name', 'places', 'rates', 'ratesUpdated', 'settlements', 'startDate', 'todos']);
  assert.deepEqual(keys(ITEM_RULES), ['airport', 'attachments', 'carrier', 'end', 'from', 'id', 'kind', 'notes', 'number', 'place', 'ref', 'seat', 'start', 'title', 'to', 'tripId']);
  // Phone-only and money data is never a part the traveller can switch on.
  for (const k of ['expenses', 'settlements', 'rates', 'ratesUpdated', 'journal', 'cash', 'gifts', 'dayPlans', 'demo'] as const) assert.equal(TRIP_RULES[k], 'drop', k);
  for (const k of ['ref', 'seat', 'attachments'] as const) assert.equal(ITEM_RULES[k], 'drop', k);
});

/** Checks each field of `out` against `src` by its rule. `nested` handles fields whose value is copied by its own rules. */
function checkRules(src: Record<string, unknown>, out: Record<string, unknown>, rules: Record<string, Rule>, path: string, opts: { parts?: CopyParts; shifted?: Record<string, unknown>; nested?: Record<string, (s: unknown, o: unknown, p: string) => void>; renamed?: string } = {}) {
  for (const [k, rule] of Object.entries(rules)) {
    const p = `${path}.${k}`;
    const s = src[k];
    const o = out[k];
    if (typeof rule === 'object') {
      if (!opts.parts?.[rule.part]) assert.ok(o === undefined || (Array.isArray(o) && o.length === 0), `${p} copied with ${rule.part} off`);
      else if (opts.nested?.[k]) opts.nested[k](s, o, p);
      else assert.deepEqual(o, s, p);
      continue;
    }
    switch (rule) {
      case 'keep':
        if (opts.nested?.[k]) opts.nested[k](s, o, p);
        else assert.deepEqual(o, s, p);
        break;
      case 'new':
        assert.ok(o !== undefined, `${p} missing`);
        assert.notEqual(o, s, `${p} not renewed`);
        break;
      case 'shift':
        assert.deepEqual(o, opts.shifted?.[k], p);
        break;
      case 'clear':
        assert.ok(o === undefined || o === false, `${p} not cleared`);
        break;
      case 'drop':
        assert.ok(o === undefined || (Array.isArray(o) && o.length === 0), `${p} copied`);
        break;
      case 'rename':
        assert.equal(o, opts.renamed, p);
        break;
    }
  }
}

const each = <T>(rules: Record<string, Rule>, f: (s: T, o: T, p: string) => void) => (s: unknown, o: unknown, p: string) => {
  assert.ok(Array.isArray(s) && Array.isArray(o), p);
  void rules;
  (s as T[]).forEach((x, i) => f(x, (o as T[])[i], `${p}[${i}]`));
};
const placeCheck = (rules: Record<string, Rule>) => (s: unknown, o: unknown, p: string) => checkRules(s as Record<string, unknown>, o as Record<string, unknown>, rules, p);

test('T118 every rule holds on a trip with every field set (all parts on)', () => {
  const src = fullTrip();
  const { trip, packing, days } = copy();
  assert.equal(days, 183);
  checkRules(src as unknown as Record<string, unknown>, trip as unknown as Record<string, unknown>, TRIP_RULES as Record<string, Rule>, 'trip', {
    parts: ALL_PARTS,
    renamed: 'Tokyo spring 2027',
    shifted: { startDate: '2027-10-01', endDate: '2027-10-06' },
    nested: {
      items: each<Item>(ITEM_RULES, (s, o, p) =>
        checkRules(s as unknown as Record<string, unknown>, o as unknown as Record<string, unknown>, ITEM_RULES as Record<string, Rule>, p, {
          shifted: { start: shiftStamp(s.start, 183), end: shiftStamp(s.end!, 183) },
          nested: { from: placeCheck(PLACE_RULES), to: placeCheck(PLACE_RULES), place: placeCheck(PLACE_RULES), airport: placeCheck(AIRPORT_RULES) },
        }),
      ),
      places: each<SavedPlace>(SAVED_PLACE_RULES, (s, o, p) => checkRules(s as unknown as Record<string, unknown>, o as unknown as Record<string, unknown>, SAVED_PLACE_RULES as Record<string, Rule>, p)),
      ideas: each<Idea>(IDEA_RULES, (s, o, p) => checkRules(s as unknown as Record<string, unknown>, o as unknown as Record<string, unknown>, IDEA_RULES as Record<string, Rule>, p, { shifted: { day: '2027-10-04' } })),
      todos: (s, o, p) => {
        // The ticked-only suggestion row is left out; the other two keep their order.
        const kept = (s as Todo[]).filter((t) => t.id !== 'todo_2');
        assert.equal((o as Todo[]).length, kept.length, p);
        kept.forEach((t, i) => checkRules(t as unknown as Record<string, unknown>, (o as Todo[])[i] as unknown as Record<string, unknown>, TODO_RULES as Record<string, Rule>, `${p}[${i}]`, { shifted: { due: t.due ? '2027-09-24' : undefined } }));
      },
      companions: each<Companion>(COMPANION_RULES, (s, o, p) => checkRules(s as unknown as Record<string, unknown>, o as unknown as Record<string, unknown>, COMPANION_RULES as Record<string, Rule>, p)),
      budget: placeCheck(BUDGET_RULES),
    },
  });
  assert.equal(trip.createdAt, NOW);
  assert.ok(packing);
  const srcList = packList();
  checkRules(srcList as unknown as Record<string, unknown>, packing as unknown as Record<string, unknown>, PACK_LIST_RULES as Record<string, Rule>, 'packing', {
    parts: ALL_PARTS,
    nested: {
      items: each<PackItem>(PACK_ITEM_RULES, (s, o, p) => checkRules(s as unknown as Record<string, unknown>, o as unknown as Record<string, unknown>, PACK_ITEM_RULES as Record<string, Rule>, p, { parts: ALL_PARTS })),
      bags: each<Bag>(BAG_RULES, (s, o, p) => checkRules(s as unknown as Record<string, unknown>, o as unknown as Record<string, unknown>, BAG_RULES as Record<string, Rule>, p)),
    },
  });
  assert.equal(packing.tripId, trip.id);
});

test('T118 with every part off: dates, name, home zone and cover only; no packing list', () => {
  const { trip, packing } = copy(none);
  assert.deepEqual(keys(trip), ['cover', 'createdAt', 'endDate', 'homeTz', 'id', 'items', 'name', 'startDate']);
  assert.deepEqual(trip.items, []);
  assert.equal(trip.cover, 'city');
  assert.equal(packing, null);
});

test('T118 each part on its own brings only its own fields', () => {
  const tripFields: Record<string, string[]> = { bookings: ['items'], packing: [], bags: [], ideas: ['ideas', 'places'], todos: ['todos'], companions: ['companions'], budget: ['budget'] };
  const base = ['cover', 'createdAt', 'endDate', 'homeTz', 'id', 'items', 'name', 'startDate'];
  for (const part of COPY_PARTS) {
    const { trip, packing } = copy({ ...none, [part]: true });
    assert.deepEqual(keys(trip), [...new Set([...base, ...tripFields[part]])].sort(), part);
    if (part === 'bookings') assert.equal(trip.items.length, 2);
    else assert.deepEqual(trip.items, [], part);
    if (part === 'packing') {
      assert.equal(packing?.items.length, 1);
      assert.equal(packing?.bags, undefined, 'no bags without the bags part');
      assert.equal(packing?.carryOnOnly, undefined);
      assert.equal(packing?.items[0].bag, undefined, 'row bag link dropped with bags off');
      assert.equal(packing?.items[0].movedFrom, undefined);
      assert.equal(packing?.items[0].weightG, 250, 'weight stays with the row');
    } else if (part === 'bags') {
      assert.deepEqual(packing?.items, [], 'bags alone bring no rows');
      assert.deepEqual(packing?.bags?.map((b) => b.id), ['carry', 'bag_cam']);
      assert.equal(packing?.carryOnOnly, true);
    } else assert.equal(packing, null, part);
  }
});

// ---- DST-safe shift across zones ----

test('T118 shift keeps each booking’s own wall clock and zone across clock changes (Sydney, Tokyo)', () => {
  const src = fullTrip();
  const { trip } = copy();
  const [f, h] = trip.items;
  assert.deepEqual(f.start, { local: '2027-10-01T21:00', tz: 'Australia/Sydney' });
  assert.deepEqual(f.end, { local: '2027-10-02T05:30', tz: 'Asia/Tokyo' });
  assert.deepEqual(h.start, { local: '2027-10-02T15:00', tz: 'Asia/Tokyo' });
  assert.deepEqual(h.end, { local: '2027-10-05T11:00', tz: 'Asia/Tokyo' });
  // 1 Apr 2027 Sydney is on daylight time (+11), 1 Oct on standard (+10): the instant moves 183 days and 1 hour,
  // because the wall clock is what is shifted (an instant shift would have shown 20:00).
  assert.equal(toUtc(f.start) - toUtc(src.items[0].start), 183 * DAY + 3_600_000);
  // Tokyo has no daylight time: exactly 183 days.
  assert.equal(toUtc(h.start) - toUtc(src.items[1].start), 183 * DAY);
  // The flight is now 9 h 30 long instead of 8 h 30 (Sydney +10, Tokyo +9).
  assert.equal(toUtc(f.end!) - toUtc(f.start), 9.5 * 3_600_000);
});

test('T118 shift backwards and over a London spring-forward night: same clock, clock note in the preview', () => {
  const t: Trip = {
    id: 'tl',
    name: 'London',
    startDate: '2026-11-07',
    endDate: '2026-11-09',
    homeTz: 'Europe/London',
    createdAt: NOW,
    items: [
      { id: 'tr', tripId: 'tl', kind: 'train', title: 'Night train', start: { local: '2026-11-07T01:30', tz: 'Europe/London' }, end: { local: '2026-11-07T07:00', tz: 'Europe/Paris' }, attachments: [] },
      { id: 'nt', tripId: 'tl', kind: 'note', title: 'Late dinner', start: { local: '2026-11-08T21:00', tz: 'America/New_York' }, attachments: [] },
    ],
  };
  // 28 Mar 2027: British Summer Time starts at 01:00, so 01:30 doesn't happen in London that night.
  const pv = copyPreview(t, '2027-03-28');
  assert.equal(pv.days, 141);
  assert.equal(pv.endDate, '2027-03-30');
  assert.deepEqual(pv.rows.map((r) => r.newStart.local), ['2027-03-28T01:30', '2027-03-29T21:00']);
  assert.deepEqual(pv.rows[0].newEnd, { local: '2027-03-28T07:00', tz: 'Europe/Paris' });
  assert.deepEqual(pv.clockNotes, [{ itemId: 'tr', title: 'Night train', which: 'start', local: '2027-03-28T01:30', tz: 'Europe/London', kind: 'skipped', usedLocal: '2027-03-28T02:30' }]);
  // Backwards: earlier dates work the same way.
  const back = copyTrip(t, null, { startDate: '2026-10-25', parts: ALL_PARTS, newId, now: NOW });
  assert.equal(back.days, -13);
  assert.deepEqual(back.trip.items[0].start, { local: '2026-10-25T01:30', tz: 'Europe/London' });
  assert.deepEqual(copyPreview(t, '2026-10-25').clockNotes.map((c) => c.kind), ['repeated'], 'fall-back night: 01:30 happens twice');
  // A month-end shift lands on real dates (no 31 Feb).
  assert.deepEqual(shiftStamp({ local: '2027-01-31T08:00', tz: 'Asia/Tokyo' }, 28), { local: '2027-02-28T08:00', tz: 'Asia/Tokyo' });
});

// ---- ticks, ids, phone-only data ----

test('T118 ticks clear: packing rows, own to-dos, ideas; a ticked-only suggestion row is left out, a hidden one stays hidden', () => {
  const { trip, packing } = copy();
  assert.ok(packing!.items.every((i) => i.done === false));
  assert.deepEqual(trip.todos!.map((t) => [t.title, t.suggestion ?? null, t.done ?? null, t.dismissed ?? null]), [
    ['Book the onsen', 'roaming', null, true],
    ['Renew passport', null, null, null],
  ]);
  assert.ok(trip.ideas!.every((i) => !i.done));
});

/** Every `id` value anywhere in x. */
function ids(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((v) => ids(v, out));
  else if (x && typeof x === 'object')
    for (const [k, v] of Object.entries(x)) {
      if (k === 'id' && typeof v === 'string') out.push(v);
      ids(v, out);
    }
  return out;
}

test('T118 new ids everywhere (bag ids stay list-local), each one unique; the old trip is unchanged', () => {
  const src = fullTrip();
  const before = structuredClone(src);
  const list = packList();
  const { trip, packing } = copyTrip(src, list, { startDate: '2027-10-01', parts: ALL_PARTS, newId, now: NOW });
  assert.deepEqual(src, before, 'source trip untouched');
  assert.deepEqual(list, packList(), 'source packing list untouched');
  const old = new Set([...ids(src), ...ids(list)]);
  const fresh = [...ids(trip), ...ids(packing!.items)];
  assert.equal(new Set(fresh).size, fresh.length, 'no id used twice');
  for (const id of fresh) assert.ok(!old.has(id), `old id ${id} reused`);
  assert.ok(trip.items.every((i) => i.tripId === trip.id));
  // Nothing shared by reference with the source.
  trip.items[0].from!.name = 'changed';
  assert.equal(src.items[0].from?.name, 'Sydney Airport');
});

test('T118 no phone-only data: no codes, seats, files, gate, stay keys, receipts, journal, spending, cash or gifts', () => {
  const { trip, packing } = copy();
  const text = JSON.stringify({ trip, packing });
  for (const s of ['ABC123', 'HTL-9', '42K', 'file:///', 'att_1', 'att_2', 'boarding.pdf', '"gate"', 'satchel.stay', 'exp_1', 'jrnl_1', 'Lanterns', 'set_1', 'Tea towel', 'JPY', 'leftover']) {
    assert.ok(!text.includes(s), `copy carries ${s}`);
  }
  assert.ok(trip.items.every((i) => i.attachments.length === 0 && i.ref === undefined && i.seat === undefined));
  // Stay details are keyed by booking id on this phone: the copy's bookings can never read the old ones.
  const oldKeys = new Set(fullTrip().items.map((i) => stayKey(i.id)));
  for (const i of trip.items) assert.ok(!oldKeys.has(stayKey(i.id)));
  for (const k of ['expenses', 'settlements', 'rates', 'ratesUpdated', 'journal', 'cash', 'gifts', 'dayPlans', 'demo'] as const) assert.equal(trip[k], undefined, k);
});

test('T118 a packing list of another trip is never copied', () => {
  const other = { ...packList(), tripId: 'someone_else' };
  assert.equal(copyTrip(fullTrip(), other, { startDate: '2027-10-01', parts: ALL_PARTS, newId, now: NOW }).packing, null);
  assert.equal(partCounts(fullTrip(), other).packing, 0);
});

// ---- name, default date, counts ----

test('T118 the name gets the new year', () => {
  assert.equal(nameForYear('Tokyo spring 2027', 2028), 'Tokyo spring 2028');
  assert.equal(nameForYear('Tokyo spring', 2028), 'Tokyo spring 2028');
  assert.equal(nameForYear('2026 Lisbon 2026 (redo)', 2028), '2026 Lisbon 2028 (redo)');
  assert.equal(nameForYear('Flat 12345 week', 2028), 'Flat 12345 week 2028', 'not a year inside a longer number');
  assert.equal(nameForYear('  ', 2028), '2028');
  assert.equal(copy(ALL_PARTS, '2028-04-01').trip.name, 'Tokyo spring 2028');
  assert.equal(copyTrip(fullTrip(), null, { startDate: '2028-04-01', parts: ALL_PARTS, newId, name: '  Back to Tokyo ' }).trip.name, 'Back to Tokyo');
});

test('T118 the picker starts on the same day next year; 29 Feb goes to 28 Feb', () => {
  assert.equal(sameDayNextYear('2027-04-01'), '2028-04-01');
  assert.equal(sameDayNextYear('2028-02-29'), '2029-02-28');
  assert.equal(sameDayNextYear('junk'), 'junk');
});

test('T118 part counts for the choice list', () => {
  assert.deepEqual(partCounts(fullTrip(), packList()), { bookings: 2, packing: 1, bags: 2, ideas: 2, todos: 2, companions: 1, budget: true });
  const bare: Trip = { id: 'b', name: 'B', startDate: '2027-01-01', endDate: '2027-01-02', homeTz: 'UTC', items: [], createdAt: NOW };
  assert.deepEqual(partCounts(bare, null), { bookings: 0, packing: 0, bags: 0, ideas: 0, todos: 0, companions: 0, budget: false });
});

test('T118 an unreadable new date leaves the dates as they were (no shift)', () => {
  const r = copyTrip(fullTrip(), null, { startDate: 'not-a-date', parts: ALL_PARTS, newId, now: NOW });
  assert.equal(r.days, 0);
  assert.equal(r.trip.startDate, '2027-04-01');
  assert.equal(r.trip.endDate, '2027-04-06');
});
