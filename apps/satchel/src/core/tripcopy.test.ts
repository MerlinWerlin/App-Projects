// T118 Plan this trip again: DST-safe day shift across zones, cleared ticks, new ids, no phone-only data, and the
// every-field guard (each Trip / Item / nested field has a rule: copied, cleared, shifted, renewed or excluded).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Budget, Companion, Item, Place, SavedPlace, Trip } from './model.ts';
import type { AirportInfo } from './leaveby.ts';
import type { LegInfo } from './layovers.ts';
import type { CheckinInfo } from './checkin.ts';
import type { Idea } from './ideas.ts';
import type { Todo } from './todos.ts';
import type { PackItem, PackList } from './packing.ts';
import type { Bag } from './bags.ts';
import type { ComeRow, ComingHome } from './comehome.ts';
import type { OutfitDay, OutfitExtra, TripOutfits } from './outfits.ts';
import type { LeaveRow, LeavingHome, SitterNote, SitterTask } from './leavehome.ts';
import { stayKey } from './staydetails.ts';
import { toUtc } from './tz.ts';
import {
  AIRPORT_RULES,
  LEG_INFO_RULES,
  CHECKIN_RULES,
  ALL_PARTS,
  BAG_RULES,
  BUDGET_RULES,
  OUTFITS_RULES,
  OUTFIT_DAY_RULES,
  OUTFIT_EXTRA_RULES,
  COMING_HOME_RULES,
  COME_ROW_RULES,
  COMPANION_RULES,
  COPY_PARTS,
  GIFT_PERSON_RULES,
  LEAVE_ROW_RULES,
  LEAVING_HOME_RULES,
  SITTER_NOTE_RULES,
  SITTER_TASK_RULES,
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
const checkin: Required<CheckinInfo> = { opensH: 30, closesMin: 50, bagDropMin: 70, deskFrom: '08:00', deskTo: '18:30', doneAt: '2027-03-31T10:00:00.000Z', outAt: '2027-04-04T09:30:00.000Z' };
const legInfo: Required<LegInfo> = { depTerminal: 'T1', depGate: '52', arrTerminal: 'T3', arrGate: '114' };
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
  legInfo,
  // T140: the indoor / outdoor mark (activities use it; set here so every path is checked with it).
  setting: 'outdoor',
  checkin,
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
const savedPlace: Required<SavedPlace> = { ...place('sp_1', 'Senso-ji', 35.7148, 139.7967), category: 'see', sample: true, savedAt: '2027-03-01T10:00:00.000Z', setting: 'indoor' }; // T142: the place's own indoor / outdoor mark
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
  // T140: indoor / outdoor mark.
  setting: 'indoor',
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
    leavingHome: { rows: [{ id: 'lh_1', tpl: 'bins', done: true }], note: { address: '1 Home St', bins: 'Tuesday night' }, updatedAt: NOW },
    comingHome: { rows: [{ id: 'ch_1', list: 'before', tpl: 'keys', done: true }], rating: 5, updatedAt: NOW },
    outfits: { extras: [{ id: 'of_1', label: 'Silk scarf', cat: 'accessory' }], cats: { 'p:adapter': 'shoes' }, days: [{ date: '2027-04-02', day: ['of_1'], evening: ['of_1'], laundry: true }], updatedAt: '2026-10-30T09:00:00.000Z' },
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
  assert.deepEqual(keys(LEG_INFO_RULES), keys(legInfo));
  assert.deepEqual(keys(CHECKIN_RULES), keys(checkin));
  assert.equal(CHECKIN_RULES.doneAt, 'drop');
  assert.equal(CHECKIN_RULES.outAt, 'drop');
  assert.deepEqual(keys(IDEA_RULES), keys(idea));
  assert.deepEqual(keys(TODO_RULES), keys(todo));
  assert.deepEqual(keys(COMPANION_RULES), keys(companion));
  assert.deepEqual(keys(BUDGET_RULES), keys(budget));
  assert.deepEqual(keys(PACK_LIST_RULES), keys(packList()));
  assert.deepEqual(keys(PACK_ITEM_RULES), keys(packItem));
  assert.deepEqual(keys(BAG_RULES), keys(ownBag));
  // Same Trip / Item key list the T85 round-trip guard pins today (a new field must be ruled on in both).
  assert.deepEqual(keys(TRIP_RULES), ['budget', 'cash', 'comingHome', 'companions', 'cover', 'createdAt', 'dayPlans', 'demo', 'endDate', 'expenses', 'gifts', 'homeTz', 'id', 'ideas', 'items', 'journal', 'leavingHome', 'name', 'outfits', 'places', 'rates', 'ratesUpdated', 'settlements', 'startDate', 'todos']);
  assert.deepEqual(keys(ITEM_RULES), ['airport', 'attachments', 'carrier', 'checkin', 'end', 'from', 'id', 'kind', 'legInfo', 'notes', 'number', 'place', 'ref', 'seat', 'setting', 'start', 'title', 'to', 'tripId']);
  // Phone-only and money data is never a part the traveller can switch on.
  for (const k of ['expenses', 'settlements', 'rates', 'ratesUpdated', 'journal', 'cash', 'gifts', 'dayPlans', 'demo', 'leavingHome', 'comingHome'] as const) assert.equal(TRIP_RULES[k], 'drop', k);
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
          nested: { from: placeCheck(PLACE_RULES), to: placeCheck(PLACE_RULES), place: placeCheck(PLACE_RULES), airport: placeCheck(AIRPORT_RULES), legInfo: placeCheck(LEG_INFO_RULES), checkin: placeCheck(CHECKIN_RULES) },
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
      outfits: (s, o, p) =>
        checkRules(s as Record<string, unknown>, o as Record<string, unknown>, OUTFITS_RULES as Record<string, Rule>, p, {
          nested: { extras: each<OutfitExtra>(OUTFIT_EXTRA_RULES, (a, b, q) => checkRules(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>, OUTFIT_EXTRA_RULES as Record<string, Rule>, q)) },
        }),
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
  const tripFields: Record<string, string[]> = { bookings: ['items'], packing: ['outfits'], bags: [], ideas: ['ideas', 'places'], todos: ['todos'], companions: ['companions'], budget: ['budget'] };
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
  for (const k of ['expenses', 'settlements', 'rates', 'ratesUpdated', 'journal', 'cash', 'gifts', 'dayPlans', 'demo', 'leavingHome', 'comingHome'] as const) assert.equal(trip[k], undefined, k);
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
  assert.deepEqual(partCounts(fullTrip(), packList()), { bookings: 2, packing: 1, bags: 2, ideas: 2, todos: 2, companions: 1, giftPeople: 1, leavingHome: 1, comingHome: 1, budget: true });
  const bare: Trip = { id: 'b', name: 'B', startDate: '2027-01-01', endDate: '2027-01-02', homeTz: 'UTC', items: [], createdAt: NOW };
  assert.deepEqual(partCounts(bare, null), { bookings: 0, packing: 0, bags: 0, ideas: 0, todos: 0, companions: 0, giftPeople: 0, leavingHome: 0, comingHome: 0, budget: false });
});

test('T118 an unreadable new date leaves the dates as they were (no shift)', () => {
  const r = copyTrip(fullTrip(), null, { startDate: 'not-a-date', parts: ALL_PARTS, newId, now: NOW });
  assert.equal(r.days, 0);
  assert.equal(r.trip.startDate, '2027-04-01');
  assert.equal(r.trip.endDate, '2027-04-06');
});

test('T120 gift people by name only: off by default; on, names with new ids and nothing else', () => {
  assert.equal(copy().trip.gifts, undefined, 'off unless asked');
  const src = fullTrip();
  src.gifts = [
    { id: 'gp_mum', name: 'Mum', budget: { currency: 'AUD', amount: 5000 }, gifts: [{ id: 'gift_1', what: 'Tea towel', status: 'packed', price: 1200, currency: 'JPY', createdAt: NOW }], createdAt: NOW },
    { id: 'gp_sam', name: 'Sam', gifts: [] },
  ];
  const { trip } = copyTrip(src, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, giftNames: true });
  assert.ok(trip.gifts);
  assert.deepEqual(trip.gifts.map((p) => p.name), ['Mum', 'Sam']);
  for (const p of trip.gifts) {
    assert.ok(!['gp_mum', 'gp_sam'].includes(p.id), 'new id');
    assert.deepEqual(p.gifts, []);
    assert.equal(p.budget, undefined);
    assert.equal(p.createdAt, NOW);
    assert.deepEqual(keys(p), ['createdAt', 'gifts', 'id', 'name']);
  }
  // every GiftPerson field has a rule; only the name is kept
  assert.deepEqual(keys(GIFT_PERSON_RULES), ['budget', 'createdAt', 'gifts', 'id', 'name']);
  assert.deepEqual(Object.entries(GIFT_PERSON_RULES).filter(([, r]) => r === 'keep').map(([k]) => k), ['name']);
  // the old trip is untouched
  assert.equal(src.gifts[0].gifts.length, 1);
  // no gift people: nothing added
  assert.equal(copyTrip(fullTrip(), null, { startDate: '2027-10-01', parts: none, newId, now: NOW, giftNames: true }).trip.gifts?.length, 1);
  const bare = { ...fullTrip(), gifts: undefined };
  assert.equal(copyTrip(bare, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, giftNames: true }).trip.gifts, undefined);
});

// ---- T126 Leaving home ----

const ownRow: Required<LeaveRow> = { id: 'lh_own', tpl: 'plants', label: 'Water the fern', done: true };
const dailyTask: Required<SitterTask> = { id: 'lht_1', when: 'daily', text: 'Feed the cat' };
const datedTask: Required<SitterTask> = { id: 'lht_2', when: '2027-04-03', text: 'Bins out' };
const sitterNote: Required<SitterNote> = {
  address: '1 Home St',
  tasks: [dailyTask, datedTask],
  pets: 'Cat food in the pantry',
  plants: 'Fern weekly',
  bins: 'Tuesday night',
  contactName: 'Alex',
  contactPhone: '+61 400 000 000',
  extra: 'Thanks!',
};
const leaving = (): Required<LeavingHome> =>
  structuredClone({
    rows: [{ id: 'lh_1', tpl: 'bins', done: true }, ownRow, { id: 'lh_3', label: 'Cancel the paper', done: true }, { id: 'lh_4', tpl: 'fridge', done: false }],
    note: sitterNote,
    updatedAt: '2027-03-30T09:00:00.000Z',
  });

test('T126 guard: every Leaving home field has a rule; ticks clear, dated tasks never come', () => {
  assert.deepEqual(keys(LEAVING_HOME_RULES), keys(leaving()));
  assert.deepEqual(keys(LEAVE_ROW_RULES), keys(ownRow));
  assert.deepEqual(keys(SITTER_NOTE_RULES), keys(sitterNote));
  assert.deepEqual(keys(SITTER_TASK_RULES), keys(dailyTask));
  assert.equal(LEAVE_ROW_RULES.done, 'clear');
  assert.equal(SITTER_TASK_RULES.when, 'undated');
  assert.equal(SITTER_NOTE_RULES.tasks, 'undated');
  assert.equal(LEAVING_HOME_RULES.updatedAt, 'new');
});

test('T126 Leaving home: off by default; on, rows as left (own, renamed, removed template rows) with ticks cleared, note without dated tasks', () => {
  const src = fullTrip();
  src.leavingHome = leaving();
  assert.equal(copyTrip(src, null, { startDate: '2027-10-01', parts: ALL_PARTS, newId, now: NOW }).trip.leavingHome, undefined, 'off unless asked');
  assert.equal(partCounts(src, null).leavingHome, 4);
  const { trip } = copyTrip(src, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, leavingHome: true });
  const lh = trip.leavingHome;
  assert.ok(lh);
  // Same rows in the same order (removed template rows stay removed), words kept, every tick cleared, new ids.
  assert.deepEqual(
    lh.rows.map((r) => [r.tpl, r.label, r.done]),
    [['bins', undefined, false], ['plants', 'Water the fern', false], [undefined, 'Cancel the paper', false], ['fridge', undefined, false]],
  );
  for (const r of lh.rows) {
    assert.ok(!['lh_1', 'lh_own', 'lh_3', 'lh_4'].includes(r.id), 'new id');
    checkRules(src.leavingHome.rows.find((x) => x.tpl === r.tpl && x.label === r.label) as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>, LEAVE_ROW_RULES as Record<string, Rule>, 'row');
  }
  assert.equal(new Set(lh.rows.map((r) => r.id)).size, lh.rows.length);
  // The note's words come; only the daily task comes, with a new id; the dated one (old trip's day) does not.
  assert.ok(lh.note);
  for (const [k, r] of Object.entries(SITTER_NOTE_RULES)) if (r === 'keep') assert.equal(lh.note[k as keyof SitterNote], sitterNote[k as keyof SitterNote], k);
  assert.deepEqual(lh.note.tasks?.map((t) => [t.when, t.text]), [['daily', 'Feed the cat']]);
  assert.notEqual(lh.note.tasks?.[0].id, 'lht_1');
  assert.equal(lh.updatedAt, NOW);
  assert.ok(!JSON.stringify(trip).includes('2027-04-03'), 'nothing dated from the old trip');
  // The old trip is untouched.
  assert.equal(src.leavingHome.rows[0].done, true);
  assert.equal(src.leavingHome.note?.tasks?.length, 2);
});

test('T126 Leaving home copy: codes and unknown fields never come; nothing to copy adds nothing', () => {
  const src = fullTrip();
  src.leavingHome = { ...leaving(), wifiPassword: 'hunter2', extraField: 1, note: { ...sitterNote, alarmCode: '1234', tasks: [datedTask] } } as unknown as LeavingHome;
  const { trip } = copyTrip(src, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, leavingHome: true });
  const text = JSON.stringify(trip.leavingHome);
  for (const s of ['hunter2', '1234', 'extraField', 'Bins out']) assert.ok(!text.includes(s), s);
  assert.equal(trip.leavingHome?.note?.tasks, undefined);
  // A note with only dated tasks and no rows: nothing left to copy.
  const empty = { ...fullTrip(), leavingHome: { rows: [], note: { tasks: [datedTask] } } };
  assert.equal(partCounts(empty, null).leavingHome, 0);
  assert.equal(copyTrip(empty, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, leavingHome: true }).trip.leavingHome, undefined);
  const none2 = { ...fullTrip(), leavingHome: undefined };
  assert.equal(copyTrip(none2, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, leavingHome: true }).trip.leavingHome, undefined);
  // A note with words only (no rows) still counts and comes.
  const words = { ...fullTrip(), leavingHome: { rows: [], note: { address: '1 Home St' } } };
  assert.equal(partCounts(words, null).leavingHome, 1);
  assert.deepEqual(copyTrip(words, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, leavingHome: true }).trip.leavingHome, { rows: [], note: { address: '1 Home St' }, updatedAt: NOW });
});

// ---- T130 Coming home ----

const comeOwn: Required<ComeRow> = { id: 'ch_own', list: 'after', tpl: 'photos', label: 'Back up to the NAS', done: true };
const coming = (): Required<ComingHome> =>
  structuredClone({
    rows: [
      { id: 'ch_1', list: 'before', tpl: 'checkout', done: true },
      { id: 'ch_2', list: 'before', label: 'Return the hire car', done: true },
      { id: 'ch_3', list: 'after', tpl: 'unpack', done: false },
      comeOwn,
    ] as ComeRow[],
    rating: 4,
    updatedAt: '2027-04-10T09:00:00.000Z',
  });

test('T130 guard: every Coming home field has a rule; ticks clear, the rating never comes', () => {
  assert.deepEqual(keys(COMING_HOME_RULES), keys(coming()));
  assert.deepEqual(keys(COME_ROW_RULES), keys(comeOwn));
  assert.equal(COME_ROW_RULES.done, 'clear');
  assert.equal(COMING_HOME_RULES.rating, 'drop');
  assert.equal(COMING_HOME_RULES.updatedAt, 'new');
  assert.equal(TRIP_RULES.comingHome, 'drop', 'never copied as it is');
});

test('T130 Coming home: off by default; on, both lists as left (own, renamed, removed template rows) with ticks cleared and no rating', () => {
  const src = fullTrip();
  src.comingHome = coming();
  assert.equal(copyTrip(src, null, { startDate: '2027-10-01', parts: ALL_PARTS, newId, now: NOW, leavingHome: true }).trip.comingHome, undefined, 'off unless asked');
  assert.equal(partCounts(src, null).comingHome, 4);
  const { trip } = copyTrip(src, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, comingHome: true });
  const ch = trip.comingHome;
  assert.ok(ch);
  assert.deepEqual(
    ch.rows.map((r) => [r.list, r.tpl, r.label, r.done]),
    [['before', 'checkout', undefined, false], ['before', undefined, 'Return the hire car', false], ['after', 'unpack', undefined, false], ['after', 'photos', 'Back up to the NAS', false]],
  );
  for (const r of ch.rows) {
    assert.ok(!['ch_1', 'ch_2', 'ch_3', 'ch_own'].includes(r.id), 'new id');
    checkRules(src.comingHome.rows.find((x) => x.tpl === r.tpl && x.label === r.label) as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>, COME_ROW_RULES as Record<string, Rule>, 'row');
  }
  assert.equal(new Set(ch.rows.map((r) => r.id)).size, ch.rows.length);
  assert.equal(ch.rating, undefined);
  assert.equal(ch.updatedAt, NOW);
  // The old trip is untouched.
  assert.equal(src.comingHome.rows[0].done, true);
  assert.equal(src.comingHome.rating, 4);
});

test('T130 Coming home copy: unknown fields and broken rows never come; a rating alone adds nothing', () => {
  const src = fullTrip();
  src.comingHome = { ...coming(), extraField: 'secret', rows: [...coming().rows, { id: 'bad' }, { id: 'ch_x', list: 'after', label: 'Ok', done: true, junk: 'zzz' }] } as unknown as ComingHome;
  const { trip } = copyTrip(src, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, comingHome: true });
  const text = JSON.stringify(trip.comingHome);
  for (const s of ['secret', 'extraField', 'junk', 'zzz', '"rating"']) assert.ok(!text.includes(s), s);
  assert.equal(trip.comingHome?.rows.length, 5);
  const rated = { ...fullTrip(), comingHome: { rows: [], rating: 5 } };
  assert.equal(partCounts(rated, null).comingHome, 0);
  assert.equal(copyTrip(rated, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, comingHome: true }).trip.comingHome, undefined);
  const bare = { ...fullTrip(), comingHome: undefined };
  assert.equal(copyTrip(bare, null, { startDate: '2027-10-01', parts: none, newId, now: NOW, comingHome: true }).trip.comingHome, undefined);
});

test('T136 outfit plan: the wardrobe comes with the packing part, planned days never do', () => {
  const src = fullTrip();
  const outfits = src.outfits as Required<TripOutfits>;
  assert.deepEqual(keys(OUTFITS_RULES), keys(outfits));
  assert.deepEqual(keys(OUTFIT_EXTRA_RULES), keys(outfits.extras[0]));
  assert.deepEqual(keys(OUTFIT_DAY_RULES), keys(outfits.days[0] as Required<OutfitDay>));
  for (const r of Object.values(OUTFIT_DAY_RULES)) assert.equal(r, 'drop');
  const none = { bookings: false, packing: false, bags: false, ideas: false, todos: false, companions: false, budget: false } as const;
  assert.equal(copyTrip(src, null, { startDate: '2027-10-01', parts: none, newId, now: NOW }).trip.outfits, undefined, 'off without packing');
  const { trip } = copyTrip(src, null, { startDate: '2027-10-01', parts: { ...none, packing: true }, newId, now: NOW });
  const id = trip.outfits?.extras?.[0].id ?? '';
  assert.match(id, /^of_new/);
  assert.deepEqual(trip.outfits, { extras: [{ id, label: 'Silk scarf', cat: 'accessory' }], cats: { 'p:adapter': 'shoes' }, updatedAt: NOW });
  // A category choice for an own piece follows its new id; one for a piece that has gone is left behind.
  const withCats = { ...fullTrip(), outfits: { ...outfits, cats: { of_1: 'shoes', of_gone: 'top', 'p:hat': 'accessory' } } } as Trip;
  const c = copyTrip(withCats, null, { startDate: '2027-10-01', parts: { ...none, packing: true }, newId, now: NOW }).trip.outfits;
  assert.deepEqual(c?.cats, { [c?.extras?.[0].id ?? '']: 'shoes', 'p:hat': 'accessory' });
  // Only days: nothing to bring.
  const daysOnly = { ...fullTrip(), outfits: { days: outfits.days } };
  assert.equal(copyTrip(daysOnly, null, { startDate: '2027-10-01', parts: { ...none, packing: true }, newId, now: NOW }).trip.outfits, undefined);
  // Unknown fields and broken rows never come.
  const junk = { ...fullTrip(), outfits: { extras: [{ id: 'of_9', label: 'Hat', cat: 'accessory', secret: 1 }, { id: 3 }], wifi: 'x' } } as unknown as Trip;
  const j = copyTrip(junk, null, { startDate: '2027-10-01', parts: { ...none, packing: true }, newId, now: NOW }).trip.outfits;
  assert.deepEqual(j, { extras: [{ id: j?.extras?.[0].id, label: 'Hat', cat: 'accessory' }], updatedAt: NOW });
});
