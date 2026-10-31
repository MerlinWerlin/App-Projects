// T85 (D218-1): one trip with EVERY Trip and Item field set must survive, unchanged, every path that rewrites a
// trip: Edit trip save, Edit booking save, .satchel export + import, and store save + reload.
//
// The guard: the fixtures are typed with Required<...> (and their nested types too), so adding a field to Trip, Item
// or anything a trip carries is a type error here until the fixture sets it (sh ops/typecheck-core.sh), and the
// runtime deep-equals below then fail if any path drops or changes it. Fields left out of .satchel files on purpose
// are listed in FILE_LEAVES_OUT (and ops/DECISIONS.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Attachment, Budget, Companion, Expense, ExpenseSplit, Item, Place, SavedPlace, Settlement, Trip } from './model.ts';
import type { Idea } from './ideas.ts';
import type { Todo } from './todos.ts';
import type { DayPlanRow } from './dayplan.ts';
import type { CashCount, CashExchange, CashPaid, CashStart, CashWithdrawal, TripCash } from './cash.ts';
import type { JournalEntry, JournalPhoto } from './journal.ts';
import type { Gift, GiftPerson } from './gifts.ts';
import { draftFromEntry, entryFromDraft, withJournalFiles } from './journal.ts';
import { draftFromIdea, ideaFromDraft } from './ideas.ts';
import { draftFromGift, draftFromPerson, giftFromDraft, personFromDraft } from './gifts.ts';
import { draftFromExpense, expenseFromDraft } from './spending.ts';
import { keepUnknown, splitFromDraft, togetherDraftFromExpense, withSplit } from './together.ts';
import type { AirportInfo } from './leaveby.ts';
import { airportDraft, withAirport } from './leaveby.ts';
import type { PackItem, PackList } from './packing.ts';
import type { Bag } from './bags.ts';
import { listFor, putList } from './packing.ts';
import { withCover } from './covers.ts';
import { rebaseTrips } from './tickets.ts';
import { buildTripFile, importTripFile, parseTripFileText, withFiles, type Payloads } from './tripfile.ts';
import { draftFromItem, itemFromDraft, parseStoredTrips, tripFromDraft, type TripDraft } from './trips.ts';

const DOCS = 'file:///var/mobile/Containers/Data/Application/A1/Documents/';

// ---- the fixture: every field set ----

const place = (id: string, name: string, lat: number, lon: number): Required<Place> => ({
  id,
  name,
  address: `${name} street 1`,
  localAddress: `${name} 1丁目`,
  lat,
  lon,
  phone: '+81 3 1234 5678',
});

const attachment: Required<Attachment> = {
  id: 'att_1',
  uri: `${DOCS}attachments/att_1-boarding.pdf`,
  name: 'boarding.pdf',
  mime: 'application/pdf',
  role: 'ticket',
  qrCropUri: `${DOCS}attachments/att_1-crop.png`,
};

const airport: Required<AirportInfo> = {
  terminal: 'T1',
  gate: '52',
  boarding: '20:30',
  bagDrop: '19:45',
  scope: 'international',
  bufferMin: 150,
  travelMin: 45,
};

const flight: Required<Item> = {
  id: 'item_flight',
  tripId: 'trip_full',
  kind: 'flight',
  title: 'Sydney to Tokyo',
  start: { local: '2027-04-01T21:00', tz: 'Australia/Sydney' },
  end: { local: '2027-04-02T05:30', tz: 'Asia/Tokyo' },
  from: place('pl_syd', 'Sydney Airport', -33.9399, 151.1753),
  to: place('pl_hnd', 'Haneda', 35.5494, 139.7798),
  // Not a flight's own field (the form drops it on save, like a hidden seat on a hotel), but set so the store and
  // file paths are checked with it.
  place: place('pl_x', 'Lounge', -33.94, 151.18),
  ref: 'ABC123',
  seat: '42K',
  carrier: 'Example Air',
  number: 'EA 25',
  notes: 'Window seat, vegetarian meal',
  airport,
  attachments: [attachment],
};

const hotel: Required<Item> = {
  id: 'item_hotel',
  tripId: 'trip_full',
  kind: 'hotel',
  title: 'Hotel Asakusa',
  start: { local: '2027-04-02T15:00', tz: 'Asia/Tokyo' },
  end: { local: '2027-04-05T11:00', tz: 'Asia/Tokyo' },
  from: place('pl_hf', 'unused from', 35.1, 139.1),
  to: place('pl_ht', 'unused to', 35.2, 139.2),
  place: place('pl_hotel', 'Hotel Asakusa', 35.7148, 139.7967),
  ref: 'HTL-9',
  seat: 'n/a',
  carrier: 'n/a',
  number: 'n/a',
  notes: 'Late check-in agreed',
  airport,
  attachments: [{ id: 'att_2', uri: `${DOCS}attachments/att_2-voucher.png`, name: 'voucher.png', mime: 'image/png', role: 'booking', qrCropUri: `${DOCS}attachments/att_2-voucher.png` }],
};

const savedPlace: Required<SavedPlace> = { ...place('sp_1', 'Senso-ji', 35.7148, 139.7967), category: 'see', sample: true, savedAt: '2027-03-01T10:00:00.000Z' };

const photo: Required<JournalPhoto> = { id: 'jph_1', uri: `${DOCS}attachments/jph_1.jpg`, name: 'temple.jpg', mime: 'image/jpeg', size: 123456 };

const entry: Required<JournalEntry> = {
  id: 'jrnl_1',
  day: '2027-04-03',
  note: 'Lanterns at dusk.',
  photos: [photo],
  placeId: 'sp_1',
  mood: 'joyful',
  weather: 'partly',
  createdAt: '2027-04-03T10:00:00.000Z',
  updatedAt: '2027-04-03T12:00:00.000Z',
};

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

// T93: an own to-do with every field (a suggestion's row uses `suggestion` / `dismissed` instead of a title).
const todo: Required<Todo> = {
  id: 'todo_1',
  title: 'Book the onsen',
  due: '2027-03-25',
  done: true,
  suggestion: 'checkin:2027-04-01T21:00|Australia/Sydney|ea 25',
  dismissed: true,
  createdAt: '2027-03-02T09:00:00.000Z',
  updatedAt: '2027-03-03T09:00:00.000Z',
};

// T98: a day plan with an added saved place and a stored order naming a booking, an idea and the place (T100: and
// the walk back to the hotel switched on).
const dayPlanRow: Required<DayPlanRow> = {
  day: '2027-04-04',
  places: [{ placeId: 'sp_1' }],
  order: [{ ideaId: 'idea_1' }, { itemId: 'item_hotel', role: 'place' }, { placeId: 'sp_1' }],
  // T100: the walk back to the hotel, remembered for the day.
  backToHotel: true,
  // T104: stop lengths the traveller set (an idea and the saved place).
  stays: [
    { ideaId: 'idea_1', min: 90 },
    { placeId: 'sp_1', min: 45 },
  ],
  updatedAt: '2027-03-04T09:00:00.000Z',
};

const companion: Required<Companion> = { id: 'c_sam', name: 'Sam' };
const split: Required<ExpenseSplit> = { mode: 'shares', parts: [{ person: 'me', value: 2 }, { person: 'c_sam', value: 1 }] };
const expense: Required<Expense> = {
  id: 'exp_1',
  amount: 4500,
  currency: 'JPY',
  category: 'food',
  day: '2027-04-03',
  note: 'Dinner',
  createdAt: '2027-04-03T11:00:00.000Z',
  paidBy: 'c_sam',
  split,
};
const settlement: Required<Settlement> = { id: 'set_1', from: 'me', to: 'c_sam', amount: 1500, currency: 'JPY', day: '2027-04-05', createdAt: '2027-04-05T08:00:00.000Z' };
const budget: Required<Budget> = { currency: 'AUD', amount: 300000 };

// T102: cash on hand with every row kind and every field set; the cash-paid mark points at exp_1 (remapped on import).
const cashStart: Required<CashStart> = { currency: 'JPY', amount: 20000 };
const withdrawal: Required<CashWithdrawal> = {
  id: 'cash_w1',
  kind: 'withdrawal',
  day: '2027-04-02',
  currency: 'JPY',
  amount: 30000,
  fee: 350,
  feeCurrency: 'AUD',
  bankRate: 0.0105,
  place: '7-Eleven Asakusa',
  createdAt: '2027-04-02T09:00:00.000Z',
};
const exchange: Required<CashExchange> = {
  id: 'cash_x1',
  kind: 'exchange',
  day: '2027-04-01',
  currency: 'AUD',
  amount: 10000,
  toCurrency: 'JPY',
  toAmount: 9500,
  place: 'Airport counter',
  createdAt: '2027-04-01T19:00:00.000Z',
};
const counted: Required<CashCount> = { id: 'cash_c1', kind: 'count', day: '2027-04-04', currency: 'JPY', amount: -120, createdAt: '2027-04-04T20:00:00.000Z' };
const cashPaid: Required<CashPaid> = { expenseId: 'exp_1' };
const cash: Required<TripCash> = { start: [cashStart], moves: [withdrawal, exchange, counted], paid: [cashPaid], leftover: { JPY: 'keep' }, local: 'JPY' };

// T107: a person with a budget and a packed gift with every field: its spot, its bag and the spending entry it added.
const gift: Required<Gift> = {
  id: 'gift_1',
  what: 'Tea towel',
  where: 'Market by the station',
  price: 1800,
  currency: 'JPY',
  status: 'packed',
  lat: 35.7101,
  lon: 139.8107,
  spotName: 'Senso-ji',
  bag: 'bag_cam',
  weightG: 120,
  expenseId: 'exp_1',
  createdAt: '2027-04-03T08:00:00.000Z',
  updatedAt: '2027-04-04T08:00:00.000Z',
};
const giftPerson: Required<GiftPerson> = { id: 'gp_mum', name: 'Mum', budget: { currency: 'AUD', amount: 5000 }, gifts: [gift], createdAt: '2027-03-20T08:00:00.000Z' };

const fullTrip = (): Required<Trip> =>
  structuredClone({
    id: 'trip_full',
    name: 'Tokyo spring',
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
    expenses: [expense],
    journal: [entry],
    ideas: [idea],
    companions: [companion],
    settlements: [settlement],
    cover: 'city',
    todos: [todo],
    dayPlans: [dayPlanRow],
    cash,
    gifts: [giftPerson],
  });

// T99: an own hold bag with every field; Carry-on only moved the row out of it (bag + movedFrom), with a weight.
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
const packList: Required<PackList> = {
  tripId: 'trip_full',
  template: 'city',
  items: [packItem],
  templates: ['city', 'cold'],
  dismissed: ['sg_umbrella'],
  laundry: true,
  bags: [{ id: 'carry', kind: 'carry', colour: 'navy', limitG: 7000 }, { id: 'personal', kind: 'personal', colour: 'teal' }, { id: 'checked', kind: 'checked', colour: 'rust', limitG: 23000 }, ownBag],
  carryOnOnly: true,
};

/** What the store does to a value (JSON drops undefined keys). */
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Every key set, none undefined, all the way down: the fixture really is "every field". */
function assertAllSet(x: unknown, path = 'trip') {
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

test('T85 fixture: every Trip and Item field is set (Required<> typing + no undefined values)', () => {
  const t = fullTrip();
  assertAllSet(t);
  assertAllSet(packList, 'packing');
  assertAllSet(ownBag, 'bag');
  // Keys Trip has today; a new one must be added to the fixture (tsc) and to this list (here).
  assert.deepEqual(Object.keys(t).sort(), [
    'budget', 'cash', 'companions', 'cover', 'createdAt', 'dayPlans', 'demo', 'endDate', 'expenses', 'gifts', 'homeTz', 'id', 'ideas', 'items', 'journal', 'name', 'places', 'rates', 'ratesUpdated', 'settlements', 'startDate', 'todos',
  ]);
  // T99: PackList / PackItem / Bag keys today (a new one must be added to the fixture and here).
  assert.deepEqual(Object.keys(packList).sort(), ['bags', 'carryOnOnly', 'dismissed', 'items', 'laundry', 'template', 'templates', 'tripId']);
  assert.deepEqual(Object.keys(packItem).sort(), ['bag', 'category', 'done', 'id', 'label', 'movedFrom', 'qty', 'suggestionId', 'templateItemId', 'userQty', 'weightG']);
  assert.deepEqual(Object.keys(ownBag).sort(), ['colour', 'hold', 'id', 'kind', 'limitG', 'name']);
  // T107: Gift / GiftPerson keys today.
  assert.deepEqual(Object.keys(gift).sort(), ['bag', 'createdAt', 'currency', 'expenseId', 'id', 'lat', 'lon', 'price', 'spotName', 'status', 'updatedAt', 'weightG', 'what', 'where']);
  assert.deepEqual(Object.keys(giftPerson).sort(), ['budget', 'createdAt', 'gifts', 'id', 'name']);
  assert.deepEqual(Object.keys(flight).sort(), ['airport', 'attachments', 'carrier', 'end', 'from', 'id', 'kind', 'notes', 'number', 'place', 'ref', 'seat', 'start', 'title', 'to', 'tripId']);
});

// ---- (1) Edit trip save ----

test('T85 (1) Edit trip save with no changes keeps every field', () => {
  const prev = fullTrip();
  const d: TripDraft = { name: prev.name, startDate: prev.startDate, endDate: prev.endDate, homeTz: prev.homeTz };
  // What app/trip-edit.tsx saves: tripFromDraft, the id, then the cover picker's value.
  const saved = withCover({ ...tripFromDraft(d, prev, '2099-01-01T00:00:00.000Z'), id: prev.id }, prev.cover);
  assert.deepEqual(json(saved), json(prev));
});

test('T85 (1) Edit trip save changes only the form fields', () => {
  const prev = fullTrip();
  const saved = tripFromDraft({ name: ' Tokyo again ', startDate: '2027-03-31', endDate: '2027-04-07', homeTz: 'Australia/Perth' }, prev);
  assert.deepEqual(json(saved), json({ ...prev, name: 'Tokyo again', startDate: '2027-03-31', endDate: '2027-04-07', homeTz: 'Australia/Perth' }));
});

test('T85 (1) a trip field added later survives Edit trip save', () => {
  const prev = { ...fullTrip(), futureField: { x: 1 } } as Trip;
  const saved = tripFromDraft({ name: prev.name, startDate: prev.startDate, endDate: prev.endDate, homeTz: prev.homeTz }, prev);
  assert.deepEqual((saved as unknown as { futureField: unknown }).futureField, { x: 1 });
});

// ---- (2) Edit booking save ----

/** What app/item-edit.tsx saves when nothing is changed in the form. */
const editItem = (prev: Item): Item => ({ ...withAirport(itemFromDraft(draftFromItem(prev), prev.tripId, prev), airportDraft(prev.airport), prev.airport), attachments: prev.attachments });

test('T85 (2) Edit booking save keeps every field the kind owns (flight)', () => {
  const prev = structuredClone(flight);
  // A flight has no hotel/activity place: the form drops it on purpose (nothing hidden behind a kind switch).
  const { place: _p, ...expected } = prev;
  assert.deepEqual(json(editItem(prev)), json(expected));
});

test('T85 (2) Edit booking save keeps every field the kind owns (hotel)', () => {
  const prev = structuredClone(hotel);
  const { from: _f, to: _t, seat: _s, carrier: _c, number: _n, airport: _a, ...expected } = prev;
  assert.deepEqual(json(editItem(prev)), json(expected));
});

test('T85 (2) regression: a booking field the form does not know survives Edit booking save', () => {
  // itemFromDraft rebuilt the item from a fixed list, so any field added to Item later was dropped on every edit.
  const prev = { ...structuredClone(flight), futureField: 'kept' } as Item;
  const saved = itemFromDraft(draftFromItem(prev), prev.tripId, prev) as Item & { futureField?: string };
  assert.equal(saved.futureField, 'kept');
  // ...while switching kind still clears what the new kind doesn't show, airport included.
  const asHotel = itemFromDraft({ ...draftFromItem(prev), kind: 'hotel' }, prev.tripId, prev);
  assert.equal(asHotel.seat, undefined);
  assert.equal(asHotel.airport, undefined);
  assert.equal(asHotel.from, undefined);
});

// ---- (2b) the trip's other edit forms: journal page, idea, expense (what each screen saves) ----

const LATER = '2099-01-01T00:00:00.000Z';

test('T85 (2b) saving a journal page, idea or expense unchanged keeps every field (updatedAt aside)', () => {
  const trip = fullTrip();
  const e = trip.journal[0];
  assert.deepEqual(entryFromDraft(draftFromEntry(e), () => 'x', e, LATER), { ...e, updatedAt: LATER });
  const i = trip.ideas[0];
  assert.deepEqual(ideaFromDraft(draftFromIdea(i), () => 'x', i, LATER), { ...i, updatedAt: LATER });
  const x = trip.expenses[0];
  const tg = togetherDraftFromExpense(trip, x);
  const plain = expenseFromDraft(draftFromExpense(x), 'x', x, LATER);
  assert.deepEqual(keepUnknown(x, withSplit(plain, tg.paidBy, splitFromDraft(tg, plain.currency))), x);
});

test('T107 (2b) saving a gift or a gift person unchanged keeps every field (updatedAt aside)', () => {
  const p = fullTrip().gifts[0];
  const g = p.gifts[0];
  assert.deepEqual(giftFromDraft(draftFromGift(g, 'kg'), 'kg', 'en', () => 'x', g, LATER), { ...g, updatedAt: LATER });
  assert.deepEqual(personFromDraft(draftFromPerson(p), 'AUD', () => 'x', p), p);
  // A field a later build adds survives too.
  const future = { ...g, futureField: 1 } as Gift;
  assert.equal((giftFromDraft(draftFromGift(future, 'lb'), 'lb', 'en', () => 'x', future) as Gift & { futureField?: number }).futureField, 1);
});

test('T85 (2b) regression: a journal page field the form does not know survives an edit', () => {
  // entryFromDraft rebuilt the page from a fixed list, so a field added to JournalEntry later was dropped on edit.
  const e = { ...fullTrip().journal[0], futureField: 'kept' } as JournalEntry;
  assert.equal((entryFromDraft(draftFromEntry(e), () => 'x', e) as JournalEntry & { futureField?: string }).futureField, 'kept');
});

// ---- (3) .satchel export + import ----

/**
 * Fields a .satchel file leaves out or renews on purpose (ops/DECISIONS.md, run 91 T85): every id is new on import
 * (so importing twice gives two trips) with references remapped, device file paths are rewritten where the files are
 * saved, and the imported trip's createdAt is the import time. Companion and settlement ids are kept: expenses' payers
 * and splits point at companion ids.
 */
const RENEWED_KEYS = new Set(['id', 'tripId', 'placeId', 'ideaId', 'itemId', 'expenseId', 'uri', 'qrCropUri']);
function blankIds(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(blankIds);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, RENEWED_KEYS.has(k) && typeof v === 'string' ? '#' : blankIds(v)]));
  return x;
}

function exportImport(trip: Trip, packing: PackList | null) {
  const payloads: Payloads = {};
  for (const it of trip.items) for (const a of it.attachments) payloads[a.id] = { data: 'QUJD', ...(a.qrCropUri && a.qrCropUri !== a.uri ? { crop: 'REVG' } : {}) };
  const photoBytes: Record<string, string> = {};
  for (const e of trip.journal ?? []) for (const p of e.photos) photoBytes[p.id] = 'SkFQRw==';
  const built = buildTripFile(trip, payloads, { packing, journalPhotos: photoBytes, now: '2027-03-10T00:00:00.000Z' });
  assert.equal(built.skipped, 0);
  assert.equal(built.photosSkipped, 0);
  const parsed = parseTripFileText(JSON.stringify(built.file));
  assert.ok(parsed.ok, parsed.ok ? '' : `${parsed.error} ${parsed.detail}`);
  let n = 0;
  const imp = importTripFile(parsed.file, (p) => `${p}_new${++n}`, '2027-03-11T00:00:00.000Z');
  // The UI writes the files, then fills in their paths (src/state/tripTransfer.ts); give each the original path back.
  const oldAtts = trip.items.flatMap((i) => i.attachments);
  const newAtts = imp.trip.items.flatMap((i) => i.attachments);
  const written: Record<string, { uri: string; cropUri?: string }> = {};
  newAtts.forEach((a, i) => (written[a.id] = { uri: oldAtts[i].uri, ...(oldAtts[i].qrCropUri !== oldAtts[i].uri ? { cropUri: oldAtts[i].qrCropUri } : {}) }));
  const oldPhotos = (trip.journal ?? []).flatMap((e) => e.photos);
  const photoUris: Record<string, string> = {};
  imp.journalFiles.forEach((f, i) => (photoUris[f.photoId] = oldPhotos[i].uri));
  return { imp, trip: withJournalFiles(withFiles(imp.trip, written), photoUris) };
}

test('T85 (3) .satchel export + import keeps every field (ids renewed, references remapped)', () => {
  const src = fullTrip();
  const { imp, trip } = exportImport(src, packList);
  assert.equal(imp.journalPhotosLeftOut, 0);
  // Everything except the renewed ids, paths and createdAt is identical.
  assert.deepEqual(blankIds({ ...json(trip), createdAt: '' }), blankIds({ ...json(src), createdAt: '' }));
  assert.equal(trip.createdAt, '2027-03-11T00:00:00.000Z');
  // Paths came back where the UI wrote them.
  assert.deepEqual(trip.items.map((i) => i.attachments.map((a) => [a.uri, a.qrCropUri])), src.items.map((i) => i.attachments.map((a) => [a.uri, a.qrCropUri])));
  assert.deepEqual(trip.journal?.[0].photos.map((p) => p.uri), [photo.uri]);
  // New ids everywhere, links kept.
  assert.notEqual(trip.id, src.id);
  for (const it of trip.items) assert.equal(it.tripId, trip.id);
  assert.notEqual(trip.items[0].id, flight.id);
  assert.notEqual(trip.items[0].attachments[0].id, attachment.id);
  assert.notEqual(trip.places?.[0].id, savedPlace.id);
  assert.equal(trip.journal?.[0].placeId, trip.places?.[0].id, 'journal page still points at its saved place');
  assert.notEqual(trip.journal?.[0].photos[0].id, photo.id);
  assert.notEqual(trip.ideas?.[0].id, idea.id);
  assert.notEqual(trip.todos?.[0].id, todo.id);
  assert.deepEqual(trip.dayPlans?.[0].order, [{ ideaId: trip.ideas?.[0].id }, { itemId: trip.items[1].id, role: 'place' }, { placeId: trip.places?.[0].id }], 'day plan points at the new ids');
  assert.deepEqual(trip.dayPlans?.[0].places, [{ placeId: trip.places?.[0].id }]);
  assert.equal(trip.dayPlans?.[0].backToHotel, true, 'back to hotel travels with the day plan');
  assert.deepEqual(trip.dayPlans?.[0].stays, [{ ideaId: trip.ideas?.[0].id, min: 90 }, { placeId: trip.places?.[0].id, min: 45 }], 'stop lengths follow the new ids');
  assert.notEqual(trip.expenses?.[0].id, expense.id);
  // T102: cash moves get new ids and the cash-paid mark follows its expense's new id.
  assert.deepEqual(trip.cash?.paid, [{ expenseId: trip.expenses?.[0].id }], 'cash-paid mark points at the new expense id');
  assert.notEqual(trip.cash?.moves?.[0].id, withdrawal.id);
  assert.deepEqual(trip.cash?.start, src.cash.start);
  // T107: people and gifts get new ids; the gift's spending link follows its expense; its bag id is kept (bag ids are
  // local to the packing list, which keeps them).
  assert.notEqual(trip.gifts?.[0].id, giftPerson.id);
  assert.notEqual(trip.gifts?.[0].gifts[0].id, gift.id);
  assert.equal(trip.gifts?.[0].gifts[0].expenseId, trip.expenses?.[0].id, 'gift points at the new expense id');
  assert.equal(trip.gifts?.[0].gifts[0].bag, 'bag_cam');
  assert.ok(imp.packing?.bags?.some((b) => b.id === trip.gifts?.[0].gifts[0].bag), 'the gift bag is on the imported list');
  assert.deepEqual(trip.companions, src.companions, 'companion ids kept: payers and splits refer to them');
  assert.deepEqual(trip.settlements, src.settlements);
  // The packing list travels too, with new row ids.
  assert.ok(imp.packing);
  assert.equal(imp.packing.tripId, imp.trip.id);
  assert.deepEqual(blankIds(json(imp.packing)), blankIds(json(packList)));
  // T99: bag ids are kept (they are local to the list), so the row still points at its bags.
  assert.deepEqual(imp.packing.bags, packList.bags);
  assert.equal(imp.packing.items[0].bag, 'carry');
  assert.equal(imp.packing.items[0].movedFrom, 'bag_cam');
  assert.equal(imp.packing.carryOnOnly, true);
});

test('T85 (3) a trip or booking field added later survives .satchel export + import', () => {
  const src = fullTrip() as Trip & { futureTrip?: string };
  src.futureTrip = 'kept';
  (src.items[0] as Item & { futureItem?: number }).futureItem = 7;
  const { trip } = exportImport(src, null);
  assert.equal((trip as typeof src).futureTrip, 'kept');
  assert.equal((trip.items[0] as Item & { futureItem?: number }).futureItem, 7);
});

test('T85 (3) regression: attachment, journal page and journal photo fields added later survive .satchel export + import', () => {
  // The file used to write attachments, journal pages and journal photos from fixed field lists.
  const src = fullTrip();
  Object.assign(src.items[0].attachments[0], { pages: 2 });
  Object.assign(src.journal[0], { pinned: true });
  Object.assign(src.journal[0].photos[0], { takenAt: '2027-04-03T09:00:00.000Z' });
  const { trip } = exportImport(src, null);
  assert.equal((trip.items[0].attachments[0] as Attachment & { pages?: number }).pages, 2);
  assert.equal((trip.journal?.[0] as JournalEntry & { pinned?: boolean }).pinned, true);
  assert.equal((trip.journal?.[0].photos[0] as JournalPhoto & { takenAt?: string }).takenAt, '2027-04-03T09:00:00.000Z');
  assert.equal('uri' in (buildTripFile(src, { att_1: { data: 'QUJD' }, att_2: { data: 'QUJD' } }).file.items[0].attachments[0] as object), false, 'no device path in the file');
});

test('T85 (3) without "Include journal photos" the photos stay on the phone and are counted', () => {
  const src = fullTrip();
  const built = buildTripFile(src, { att_1: { data: 'QUJD', crop: 'REVG' }, att_2: { data: 'QUJD' } });
  const parsed = parseTripFileText(JSON.stringify(built.file));
  assert.ok(parsed.ok);
  const imp = importTripFile(parsed.file, (p) => `${p}_n`);
  assert.equal(imp.journalPhotosLeftOut, 1);
  assert.deepEqual(imp.trip.journal?.[0].photos, []);
  assert.equal(imp.trip.journal?.[0].note, entry.note);
});

// ---- (4) store save + reload ----

test('T85 (4) store save + reload keeps every field', () => {
  const src = fullTrip();
  const reloaded = parseStoredTrips(JSON.stringify([src]));
  assert.ok(reloaded);
  // Load also rebases file paths onto this install's documents folder: same folder, nothing moves.
  const list = rebaseTrips(reloaded, DOCS);
  assert.deepEqual(list, [json(src)]);
});

test('T85 (4) store reload after an app update moves only the file paths', () => {
  const src = fullTrip();
  const moved = 'file:///var/mobile/Containers/Data/Application/B2/Documents/';
  const [t] = rebaseTrips(parseStoredTrips(JSON.stringify([src])) ?? [], moved);
  const swap = (x: unknown) => JSON.parse(JSON.stringify(x).split(DOCS).join(moved));
  assert.deepEqual(t, swap(src));
});

test('T85 (4) packing store save + reload keeps every field', () => {
  const stored = JSON.parse(JSON.stringify(putList({}, packList)));
  assert.deepEqual(listFor(stored, packList.tripId), json(packList));
});

test('T85 (4) a field added later survives store save + reload', () => {
  const src = { ...fullTrip(), futureTrip: [1, 2] } as Trip;
  (src.items[1] as Item & { futureItem?: boolean }).futureItem = true;
  const [t] = parseStoredTrips(JSON.stringify([src])) ?? [];
  assert.deepEqual(t, json(src));
});
