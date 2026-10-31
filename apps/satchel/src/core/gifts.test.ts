// T107 gifts and souvenirs: per-person totals and budget, home values only with a saved rate, status transitions,
// bag weight on packed / unpacked, the spending draft from Bought, share text without prices by default, defensive
// reading and the .satchel round trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Trip } from './model.ts';
import type { PackList } from './packing.ts';
import { bagSummaries, tallyItems } from './bags.ts';
import {
  addGiftSpending,
  canAddSpending,
  draftFromGift,
  findGift,
  giftBagChoices,
  giftFromDraft,
  giftsText,
  giftSummary,
  giftWeightsByBag,
  homeOf,
  linkedExpense,
  newGiftDraft,
  newPersonDraft,
  nextStatus,
  personFromDraft,
  personProgress,
  readGifts,
  removeGift,
  removePerson,
  setGiftBag,
  setGiftStatus,
  spendingDraftFor,
  upsertGift,
  upsertPerson,
  validateGift,
  validatePerson,
  withGiftWeight,
  type Gift,
  type GiftPerson,
  type GiftTextWords,
} from './gifts.ts';
import { expenseFromDraft, readSpending } from './spending.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';

const NOW = '2027-04-03T10:00:00.000Z';
let n = 0;
const ids = (p: string) => `${p}_${++n}`;

const baseTrip = (over: Partial<Trip> = {}): Trip => ({
  id: 'trip_1',
  name: 'Tokyo',
  startDate: '2027-04-01',
  endDate: '2027-04-06',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: NOW,
  ...over,
});

const gift = (id: string, over: Partial<Gift> = {}): Gift => ({ id, what: `Gift ${id}`, status: 'idea', ...over });

const mum: GiftPerson = {
  id: 'p_mum',
  name: 'Mum',
  budget: { currency: 'AUD', amount: 10000 },
  gifts: [
    gift('g1', { price: 2000, currency: 'JPY', status: 'bought' }),
    gift('g2', { price: 3000, currency: 'AUD', status: 'packed' }),
    gift('g3', { price: 1500, currency: 'EUR' }),
    gift('g4'),
  ],
};
const sam: GiftPerson = { id: 'p_sam', name: 'Sam', gifts: [gift('s1', { price: 500, currency: 'JPY', where: 'Asakusa market' })] };

const trip = (over: Partial<Trip> = {}) => baseTrip({ budget: { currency: 'AUD' }, rates: { JPY: 0.01 }, gifts: [mum, sam], ...over });

// ---- totals and budget ----

test('per-person progress counts ideas, bought and packed', () => {
  const p = personProgress(mum, 'AUD', { JPY: 0.01 });
  assert.equal(p.total, 4);
  assert.equal(p.ideas, 2);
  assert.equal(p.bought, 1);
  assert.equal(p.packed, 1);
  assert.equal(p.got, 2);
  assert.equal(p.fraction, 0.5);
  assert.equal(personProgress({ id: 'x', name: 'X', gifts: [] }, 'AUD', {}).fraction, 0);
});

test('per-person totals: per currency as typed, home first, and the home value of what has a rate', () => {
  const p = personProgress(mum, 'AUD', { JPY: 0.01 });
  assert.deepEqual(p.sums.planned, [
    { currency: 'AUD', amount: 3000 },
    { currency: 'EUR', amount: 1500 },
    { currency: 'JPY', amount: 2000 },
  ]);
  assert.deepEqual(p.sums.got, [
    { currency: 'AUD', amount: 3000 },
    { currency: 'JPY', amount: 2000 },
  ]);
  // ¥2000 at 0.01 = A$20.00 (2000 cents) + A$30.00; EUR has no rate so it stays out and is listed.
  assert.equal(p.sums.gotHome, 5000);
  assert.equal(p.sums.plannedHome, 5000);
  assert.deepEqual(p.sums.missing, ['EUR']);
});

test('budget remaining: budget minus bought and packed; leftPlanned counts every idea too', () => {
  const b = personProgress(mum, 'AUD', { JPY: 0.01, EUR: 1.6 }).budget;
  assert.ok(b);
  assert.equal(b.budget, 10000);
  assert.equal(b.spent, 5000);
  assert.equal(b.left, 5000);
  // + €15.00 at 1.6 = A$24.00
  assert.equal(b.planned, 7400);
  assert.equal(b.leftPlanned, 2600);
  assert.equal(b.fraction, 0.5);
  assert.equal(b.over, false);
  assert.equal(b.partial, false);
  const over = personProgress({ ...mum, budget: { currency: 'AUD', amount: 4000 } }, 'AUD', { JPY: 0.01 }).budget;
  assert.equal(over?.over, true);
  assert.equal(over?.left, -1000);
  assert.equal(personProgress(sam, 'AUD', { JPY: 0.01 }).budget, null, 'no budget, no bar');
});

test('home value only with a saved rate: no rate, no conversion and the bar says it is partial', () => {
  const p = personProgress(mum, 'AUD', {});
  assert.equal(p.sums.gotHome, 3000, 'only the AUD gift counts');
  assert.deepEqual(p.sums.missing, ['EUR', 'JPY']);
  assert.equal(p.budget?.spent, 3000);
  assert.equal(p.budget?.partial, true);
  // No home currency at all: no home values, nothing missing to list.
  const none = personProgress(sam, null, { JPY: 0.01 });
  assert.equal(none.sums.gotHome, null);
  assert.equal(none.sums.plannedHome, null);
  assert.deepEqual(none.sums.missing, []);
  assert.equal(homeOf(baseTrip()), null);
  assert.equal(homeOf(trip()), 'AUD');
});

test('trip summary adds up every person', () => {
  const s = giftSummary(trip());
  assert.equal(s.people, 2);
  assert.equal(s.total, 5);
  assert.equal(s.got, 2);
  assert.equal(s.packed, 1);
  assert.equal(s.home, 'AUD');
  assert.equal(s.sums.plannedHome, 5500);
  assert.deepEqual(s.sums.missing, ['EUR']);
});

// ---- people and gift editing ----

test('person draft: a name is needed; a budget needs a home currency and must read as an amount', () => {
  assert.deepEqual(validatePerson({ name: '  ', budget: '' }, 'AUD'), ['name']);
  assert.deepEqual(validatePerson({ name: 'Gran', budget: '50' }, null), ['home']);
  assert.deepEqual(validatePerson({ name: 'Gran', budget: 'lots' }, 'AUD'), ['budget']);
  assert.deepEqual(validatePerson({ name: 'Gran', budget: '50.50' }, 'AUD'), []);
  const p = personFromDraft({ ...newPersonDraft(), name: ' Gran ', budget: '50.50' }, 'AUD', ids, undefined, NOW);
  assert.equal(p.name, 'Gran');
  assert.deepEqual(p.budget, { currency: 'AUD', amount: 5050 });
  assert.deepEqual(p.gifts, []);
  const cleared = personFromDraft({ name: 'Gran', budget: '' }, 'AUD', ids, p);
  assert.equal(cleared.budget, undefined);
  assert.equal(cleared.id, p.id);
  let t = upsertPerson(baseTrip(), p);
  assert.equal(readGifts(t).length, 1);
  t = removePerson(t, p.id);
  assert.deepEqual(readGifts(t), []);
});

test('gift draft: what is needed; price with a currency; a spot that reads; a weight in the home unit', () => {
  const d = { ...newGiftDraft('JPY'), what: 'Matcha', price: '1,500', pos: '35.71,139.81', spotName: 'Senso-ji', bag: 'checked', weight: '0.25', where: ' Nakamise ' };
  assert.deepEqual(validateGift(d, 'kg'), []);
  assert.deepEqual(validateGift({ ...d, what: '' }, 'kg'), ['what']);
  assert.deepEqual(validateGift({ ...d, currency: 'JP' }, 'kg'), ['currency']);
  assert.deepEqual(validateGift({ ...d, price: '1.5' }, 'kg'), ['price'], 'yen has no decimals');
  assert.deepEqual(validateGift({ ...d, pos: 'north' }, 'kg'), ['pos']);
  assert.deepEqual(validateGift({ ...d, weight: '-1' }, 'kg'), ['weight']);
  const g = giftFromDraft(d, 'kg', 'en', ids, undefined, NOW);
  assert.equal(g.what, 'Matcha');
  assert.equal(g.where, 'Nakamise');
  assert.equal(g.price, 1500);
  assert.equal(g.currency, 'JPY');
  assert.equal(g.status, 'idea');
  assert.deepEqual([g.lat, g.lon, g.spotName], [35.71, 139.81, 'Senso-ji']);
  assert.equal(g.bag, 'checked');
  assert.equal(g.weightG, 250);
  // Editing keeps id, status and spending link; clearing price / spot / weight removes them.
  const prev = { ...g, status: 'bought' as const, expenseId: 'exp_1' };
  const edited = giftFromDraft({ ...draftFromGift(prev, 'kg'), price: '', pos: '', weight: '', bag: '' }, 'kg', 'en', ids, prev, NOW);
  assert.equal(edited.id, g.id);
  assert.equal(edited.status, 'bought');
  assert.equal(edited.expenseId, 'exp_1');
  assert.equal(edited.price, undefined);
  assert.equal(edited.currency, undefined);
  assert.equal(edited.lat, undefined);
  assert.equal(edited.weightG, undefined);
  assert.equal(edited.bag, undefined);
  // A weight left as the field shows it (rounded in lb) keeps its exact grams.
  const w = giftFromDraft(draftFromGift({ ...g, weightG: 120 }, 'lb'), 'lb', 'en', ids, { ...g, weightG: 120 });
  assert.equal(w.weightG, 120);
});

test('upsert and remove a gift', () => {
  let t = trip();
  t = upsertGift(t, 'p_sam', gift('s2', { what: 'Chopsticks' }));
  assert.deepEqual(readGifts(t)[1].gifts.map((g) => g.id), ['s1', 's2']);
  t = upsertGift(t, 'p_sam', gift('s2', { what: 'Lacquer chopsticks' }));
  assert.equal(findGift(t, 'p_sam', 's2')?.what, 'Lacquer chopsticks');
  t = removeGift(t, 'p_sam', 's1');
  assert.deepEqual(readGifts(t)[1].gifts.map((g) => g.id), ['s2']);
  assert.equal(upsertGift(t, 'nobody', gift('z')), t, 'unknown person: unchanged');
});

// ---- status ----

test('status transitions: idea -> bought -> packed -> idea, any step either way, unknown values refused', () => {
  assert.equal(nextStatus('idea'), 'bought');
  assert.equal(nextStatus('bought'), 'packed');
  assert.equal(nextStatus('packed'), 'idea');
  let t = trip();
  t = setGiftStatus(t, 'p_mum', 'g4', 'bought', NOW);
  assert.equal(findGift(t, 'p_mum', 'g4')?.status, 'bought');
  assert.equal(findGift(t, 'p_mum', 'g4')?.updatedAt, NOW);
  t = setGiftStatus(t, 'p_mum', 'g4', 'packed');
  assert.equal(findGift(t, 'p_mum', 'g4')?.status, 'packed');
  t = setGiftStatus(t, 'p_mum', 'g4', 'idea');
  assert.equal(findGift(t, 'p_mum', 'g4')?.status, 'idea');
  // Straight from idea to packed is fine (bought somewhere along the way).
  t = setGiftStatus(t, 'p_mum', 'g3', 'packed');
  assert.equal(findGift(t, 'p_mum', 'g3')?.status, 'packed');
  assert.equal(setGiftStatus(t, 'p_mum', 'g3', 'packed'), t, 'same status: unchanged');
  assert.equal(setGiftStatus(t, 'p_mum', 'g3', 'lost' as never), t);
  assert.equal(setGiftStatus(t, 'p_mum', 'nope', 'bought'), t);
  // A stored row with an unknown status reads as an idea.
  assert.equal(readGifts(baseTrip({ gifts: [{ id: 'p', name: 'P', gifts: [{ id: 'g', what: 'X', status: 'wrapped' as never }] }] }))[0].gifts[0].status, 'idea');
});

// ---- bags ----

const packList = (): PackList => ({
  tripId: 'trip_1',
  items: [{ id: 'i1', label: 'Shoes', done: true, bag: 'checked', weightG: 1000 }],
  bags: [{ id: 'carry', kind: 'carry', colour: 'sea' }, { id: 'personal', kind: 'personal', colour: 'teal' }, { id: 'checked', kind: 'checked', colour: 'rust', limitG: 1300 }],
});

test('bag weight is added when a gift is packed and removed when it is unpacked', () => {
  let t = trip();
  t = upsertGift(t, 'p_mum', gift('g5', { weightG: 400, bag: 'checked', status: 'bought' }));
  const list = packList();
  assert.deepEqual(giftWeightsByBag(t, list), {}, 'bought, not packed: nothing in the bag yet');
  t = setGiftStatus(t, 'p_mum', 'g5', 'packed');
  assert.deepEqual(giftWeightsByBag(t, list), { checked: { grams: 400, gifts: 1 } });
  const checked = bagSummaries(list).bags.find((b) => b.bag.id === 'checked');
  assert.ok(checked);
  const withGifts = withGiftWeight(checked.tally, 400);
  assert.equal(withGifts.weightG, 1400);
  assert.equal(withGifts.overG, 100);
  assert.equal(withGifts.leftG, 0);
  assert.equal(withGiftWeight(checked.tally, 0), checked.tally);
  // Unpacked (back to bought): the weight comes out again.
  t = setGiftStatus(t, 'p_mum', 'g5', 'bought');
  assert.deepEqual(giftWeightsByBag(t, list), {});
  // Packed in a bag the list doesn't have (removed since): not counted anywhere.
  t = setGiftStatus(setGiftBag(t, 'p_mum', 'g5', 'bag_gone'), 'p_mum', 'g5', 'packed');
  assert.deepEqual(giftWeightsByBag(t, list), {});
  // Moved to the carry-on: counted there; a packed gift with no weight counts as a gift with 0 g.
  t = setGiftBag(t, 'p_mum', 'g5', 'carry');
  t = upsertGift(t, 'p_mum', gift('g6', { bag: 'carry', status: 'packed' }));
  assert.deepEqual(giftWeightsByBag(t, list), { carry: { grams: 400, gifts: 2 } });
  assert.equal(withGiftWeight(tallyItems([]), 400).limitG, undefined);
});

test('bag choices: the list bags, or the three built-in bags before there is a list', () => {
  assert.deepEqual(giftBagChoices(null).map((b) => b.id), ['carry', 'personal', 'checked']);
  const own: PackList = { ...packList(), bags: [...(packList().bags ?? []), { id: 'bag_tote', kind: 'own', name: 'Tote', colour: 'plum' }] };
  assert.deepEqual(giftBagChoices(own).map((b) => b.id), ['carry', 'personal', 'checked', 'bag_tote']);
});

// ---- spending ----

test('Bought: a spending draft in shopping for the price, then linked so it is never added twice', () => {
  let t = trip();
  const g1 = findGift(t, 'p_mum', 'g1');
  assert.ok(g1);
  const d = spendingDraftFor(g1, '2027-04-03', 'Gift for Mum: Gift g1');
  assert.deepEqual(d, { amount: '2000', currency: 'JPY', category: 'shopping', day: '2027-04-03', note: 'Gift for Mum: Gift g1' });
  assert.equal(spendingDraftFor(gift('x'), '2027-04-03', 'n'), null, 'no price, no draft');
  assert.ok(canAddSpending(t, g1));
  const e = expenseFromDraft(d!, 'exp_g1', undefined, NOW);
  t = addGiftSpending(t, 'p_mum', 'g1', e, NOW);
  assert.equal(readSpending(t).expenses.length, 1);
  assert.equal(readSpending(t).expenses[0].category, 'shopping');
  const after = findGift(t, 'p_mum', 'g1')!;
  assert.equal(after.expenseId, 'exp_g1');
  assert.equal(after.status, 'bought');
  assert.equal(linkedExpense(t, after)?.amount, 2000);
  assert.equal(canAddSpending(t, after), false);
  // An idea "bought" with spending moves to bought; packed stays packed.
  t = addGiftSpending(t, 'p_mum', 'g2', expenseFromDraft(spendingDraftFor(findGift(t, 'p_mum', 'g2')!, '2027-04-03', 'n')!, 'exp_g2'));
  assert.equal(findGift(t, 'p_mum', 'g2')?.status, 'packed');
  // Going back to idea keeps the link (the entry stays in Spending).
  t = setGiftStatus(t, 'p_mum', 'g1', 'idea');
  assert.equal(findGift(t, 'p_mum', 'g1')?.expenseId, 'exp_g1');
  assert.equal(canAddSpending(t, findGift(t, 'p_mum', 'g1')!), false);
  // The entry deleted in Spending: the gift can add one again.
  t = { ...t, expenses: [] };
  assert.equal(canAddSpending(t, findGift(t, 'p_mum', 'g1')!), true);
});

// ---- share text ----

const words: GiftTextWords = {
  title: 'Gifts: Tokyo',
  person: (name, got, total) => `${name} (${got} of ${total})`,
  status: (s) => ({ idea: 'Idea', bought: 'Bought', packed: 'Packed' })[s],
  seenAt: (w) => `seen at ${w}`,
  money: (m) => `${m.currency} ${m.amount}`,
  empty: 'No gifts yet',
};

test('share text lists people and gifts with no prices by default', () => {
  const text = giftsText(trip(), words);
  assert.equal(
    text,
    'Gifts: Tokyo\n\nMum (2 of 4)\n☑ Gift g1 · Bought\n☑ Gift g2 · Packed\n☐ Gift g3 · Idea\n☐ Gift g4 · Idea\n\nSam (0 of 1)\n☐ Gift s1 · Idea · seen at Asakusa market\n',
  );
  assert.ok(!/JPY|AUD|EUR/.test(text), 'no prices');
  const priced = giftsText(trip(), words, { prices: true });
  assert.match(priced, /Gift g1 · Bought · JPY 2000/);
  assert.match(priced, /Gift s1 · Idea · seen at Asakusa market · JPY 500/);
  assert.equal(giftsText(baseTrip(), words), 'Gifts: Tokyo\n\nNo gifts yet\n');
});

// ---- reading ----

test('stored rows are read defensively: junk skipped, unknown fields kept, half a price dropped', () => {
  const raw = [
    null,
    { id: 'p1', name: '  ', gifts: [] },
    {
      id: 'p2',
      name: 'Dad',
      budget: { currency: 'aud', amount: 100 },
      futurePerson: 1,
      gifts: [
        { id: 'a', what: 'Sake', price: 100, status: 'bought', futureGift: true },
        { id: 'a', what: 'Duplicate' },
        { what: 'No id' },
        { id: 'b', what: 'Fan', lat: 99, lon: 0, weightG: -5, bag: '' },
      ],
    },
    { id: 'p2', name: 'Dad again', gifts: [] },
  ];
  const people = readGifts(baseTrip({ gifts: raw as never }));
  assert.equal(people.length, 1);
  const [dad] = people;
  assert.equal(dad.budget, undefined, 'lower-case currency is not a budget');
  assert.equal((dad as GiftPerson & { futurePerson?: number }).futurePerson, 1);
  assert.deepEqual(dad.gifts.map((g) => g.id), ['a', 'b']);
  assert.equal(dad.gifts[0].price, undefined, 'a price without a currency is dropped');
  assert.equal((dad.gifts[0] as Gift & { futureGift?: boolean }).futureGift, true);
  assert.deepEqual(dad.gifts[1], { id: 'b', what: 'Fan', status: 'idea' });
  assert.deepEqual(readGifts(baseTrip()), []);
  assert.deepEqual(readGifts(baseTrip({ gifts: 'x' as never })), []);
});

// ---- .satchel ----

test('round trip through a .satchel file: new ids, spending link remapped, bag kept, unreadable rows dropped', () => {
  let t = trip();
  const e = expenseFromDraft(spendingDraftFor(findGift(t, 'p_mum', 'g1')!, '2027-04-03', 'Gift for Mum')!, 'exp_g1');
  t = addGiftSpending(t, 'p_mum', 'g1', e);
  t = setGiftBag(t, 'p_mum', 'g2', 'checked');
  const built = buildTripFile(t, {}, { packing: packList() });
  // A row this build can't read in the file is left out, never refusing the file.
  (built.file.trip.gifts as unknown[]).push({ id: 'junk' });
  const parsed = parseTripFileText(JSON.stringify(built.file));
  assert.ok(parsed.ok);
  let k = 0;
  const imp = importTripFile(parsed.file, (p) => `${p}_n${++k}`);
  const people = readGifts(imp.trip);
  assert.equal(people.length, 2);
  assert.notEqual(people[0].id, 'p_mum');
  assert.notEqual(people[0].gifts[0].id, 'g1');
  assert.deepEqual(people[0].budget, mum.budget);
  assert.equal(people[0].gifts[0].expenseId, imp.trip.expenses?.[0].id, 'link follows the new expense id');
  assert.equal(people[0].gifts[1].bag, 'checked');
  assert.deepEqual(
    people.map((p) => p.gifts.map((g) => [g.what, g.status, g.price, g.currency, g.where])),
    [mum, sam].map((p) => p.gifts.map((g) => [g.what, g.status, g.price, g.currency, g.where])),
  );
  // A file with no gifts imports with none.
  const plain = parseTripFileText(JSON.stringify(buildTripFile(baseTrip(), {}).file));
  assert.ok(plain.ok);
  assert.equal(importTripFile(plain.file, (p) => `${p}_m${++k}`).trip.gifts, undefined);
  // A link to an expense that isn't in the file is dropped.
  const orphan = trip({ gifts: [{ id: 'p', name: 'P', gifts: [gift('g', { expenseId: 'exp_missing' })] }] });
  const op = parseTripFileText(JSON.stringify(buildTripFile(orphan, {}).file));
  assert.ok(op.ok);
  assert.equal(readGifts(importTripFile(op.file, (p) => `${p}_o${++k}`).trip)[0].gifts[0].expenseId, undefined);
});
