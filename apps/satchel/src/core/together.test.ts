import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Expense, ExpenseSplit, Trip } from './model.ts';
import { upsertExpense } from './spending.ts';
import {
  addCompanion,
  addSettlement,
  apportion,
  balances,
  cleanFileTogether,
  companionUse,
  convertBalances,
  exactRemaining,
  keepUnknown,
  ME,
  newTogetherDraft,
  peopleOf,
  readCompanions,
  readSettlements,
  readSplit,
  removeCompanion,
  removeSettlement,
  renameCompanion,
  resolveExpense,
  settlePlan,
  settleUp,
  splitAmount,
  splitFromDraft,
  togetherDraftFromExpense,
  togglePerson,
  validateName,
  validateTogether,
  withSplit,
  type Balance,
} from './together.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';

const baseTrip = (extra: Partial<Trip> = {}): Trip => ({
  id: 'trip1',
  name: 'Kyoto',
  startDate: '2026-11-01',
  endDate: '2026-11-08',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: '2026-10-01T00:00:00Z',
  budget: { currency: 'AUD' },
  ...extra,
});
const exp = (id: string, amount: number, currency: string, more: Partial<Expense> = {}): Expense => ({ id, amount, currency, category: 'food', day: '2026-11-02', ...more });
const equal = (...people: string[]): ExpenseSplit => ({ mode: 'equal', parts: people.map((person) => ({ person, value: 1 })) });
const sum = (xs: readonly { amount: number }[]) => xs.reduce((a, b) => a + b.amount, 0);
const withPeople = (extra: Partial<Trip> = {}) => baseTrip({ companions: [{ id: 'sam', name: 'Sam' }, { id: 'alex', name: 'Alex' }], ...extra });

/** Applies transfers to balances: everyone must end at zero. */
const applyTransfers = (list: readonly Balance[], transfers: readonly { from: string; to: string; amount: number }[]) => {
  const m = new Map(list.map((b) => [b.person, b.amount]));
  for (const t of transfers) {
    m.set(t.from, (m.get(t.from) ?? 0) + t.amount);
    m.set(t.to, (m.get(t.to) ?? 0) - t.amount);
  }
  return [...m.values()];
};

test('apportion adds up exactly and gives leftovers to the earliest largest remainders', () => {
  assert.deepEqual(apportion(1000, [1, 1, 1]), [334, 333, 333]);
  assert.deepEqual(apportion(1001, [1, 1, 1]), [334, 334, 333]);
  assert.deepEqual(apportion(100, [2, 1]), [67, 33]);
  assert.deepEqual(apportion(5, [0, 0]), [3, 2]);
  assert.deepEqual(apportion(0, [1, 2]), [0, 0]);
  // large amounts stay exact (no float drift above 2^53 / weights)
  const big = apportion(9_999_999_999_999, [999, 1000, 7]);
  assert.equal(sum(big.map((amount) => ({ amount }))), 9_999_999_999_999);
  for (let amount = 1; amount < 400; amount += 7) {
    for (const w of [[1], [1, 1], [3, 2, 1], [5, 5, 5, 5, 5, 5, 5], [1000, 1, 1]]) {
      const parts = apportion(amount, w);
      assert.equal(parts.reduce((a, b) => a + b, 0), amount, `${amount} ${w}`);
      assert.ok(parts.every((p) => p >= 0));
    }
  }
});

test('splits sum exactly to the amount in every mode and currency', () => {
  const people = [ME, 'sam', 'alex'];
  for (const amount of [1, 2, 100, 1001, 12345, 99_999]) {
    assert.equal(sum(splitAmount(amount, equal(...people))), amount);
    assert.equal(sum(splitAmount(amount, { mode: 'shares', parts: [{ person: ME, value: 2 }, { person: 'sam', value: 1 }, { person: 'alex', value: 3 }] })), amount);
  }
  // equal: no two shares differ by more than one unit, extras go to the first people
  assert.deepEqual(splitAmount(1000, equal(ME, 'sam', 'alex')).map((s) => s.amount), [334, 333, 333]);
  // exact that adds up is kept as typed
  assert.deepEqual(splitAmount(1000, { mode: 'exact', parts: [{ person: ME, value: 700 }, { person: 'sam', value: 300 }] }).map((s) => s.amount), [700, 300]);
  // exact that no longer adds up is read in proportion, still exact
  const off = splitAmount(1000, { mode: 'exact', parts: [{ person: ME, value: 300 }, { person: 'sam', value: 300 }] });
  assert.deepEqual(off.map((s) => s.amount), [500, 500]);
  const hugeOff = splitAmount(5_000_000_000, { mode: 'exact', parts: [{ person: ME, value: 3_000_000_000 }, { person: 'sam', value: 1_000_000_000 }] });
  assert.equal(sum(hugeOff), 5_000_000_000);
  assert.deepEqual(hugeOff.map((s) => s.amount), [3_750_000_000, 1_250_000_000]);
});

test('readSplit keeps known people once with valid values and drops the rest', () => {
  const known = new Set([ME, 'sam']);
  assert.equal(readSplit(null), null);
  assert.equal(readSplit({ mode: 'thirds', parts: [] }), null);
  assert.equal(readSplit({ mode: 'equal', parts: [{ person: 'ghost', value: 1 }] }, known), null);
  assert.deepEqual(readSplit({ mode: 'equal', parts: [{ person: ME }, { person: ME }, { person: 'sam', value: 9 }, 'x'] }, known), equal(ME, 'sam'));
  assert.deepEqual(readSplit({ mode: 'shares', parts: [{ person: ME, value: 0 }, { person: 'sam', value: 2 }] }, known), { mode: 'shares', parts: [{ person: 'sam', value: 2 }] });
});

test('legacy expenses: paid by You, split with no one, so a solo trip has no balances', () => {
  const trip = baseTrip({ expenses: [exp('a', 1500, 'AUD'), exp('b', 2000, 'JPY')] });
  const r = resolveExpense(trip.expenses![0], peopleOf(trip));
  assert.deepEqual(r, { payer: ME, shares: [{ person: ME, amount: 1500 }], together: false });
  const b = balances(trip);
  assert.equal(b.shared, false);
  assert.deepEqual(b.inHome, [{ person: ME, amount: 0 }]);
  assert.deepEqual(b.apart, []);
  assert.equal(settlePlan(b).settled, true);
  // legacy rows on a trip that now has companions still change nothing
  const later = withPeople({ expenses: trip.expenses });
  assert.ok(balances(later).inHome!.every((x) => x.amount === 0));
});

test('balances sum to zero and the payer is owed by the others', () => {
  const trip = withPeople({ expenses: [exp('a', 9000, 'AUD', { split: equal(ME, 'sam', 'alex') }), exp('b', 3001, 'AUD', { paidBy: 'sam', split: equal(ME, 'sam') })] });
  const b = balances(trip);
  assert.equal(b.shared, true);
  // You paid 90 split 3 ways (+60), Sam paid 30.01 split with You (You -15.01 share: 1501 to You, 1500 to Sam)
  assert.deepEqual(b.inHome, [
    { person: ME, amount: 6000 - 1501 },
    { person: 'sam', amount: -3000 + 3001 - 1500 },
    { person: 'alex', amount: -3000 },
  ]);
  assert.equal(sum(b.inHome!), 0);
});

test('mixed currencies: rated ones convert into home and still sum to zero; unrated ones stay apart', () => {
  const trip = withPeople({
    rates: { JPY: 0.0102, EUR: 1.6543 },
    expenses: [
      exp('a', 1001, 'JPY', { split: equal(ME, 'sam', 'alex') }),
      exp('b', 1999, 'EUR', { paidBy: 'alex', split: equal(ME, 'sam', 'alex') }),
      exp('c', 5000, 'AUD', { paidBy: 'sam', split: equal(ME, 'sam') }),
      exp('d', 30000, 'KRW', { paidBy: 'alex', split: equal(ME, 'alex') }),
    ],
  });
  const b = balances(trip);
  assert.equal(sum(b.inHome!), 0);
  assert.deepEqual(b.apart, [{ currency: 'KRW', balances: [{ person: ME, amount: -15000 }, { person: 'sam', amount: 0 }, { person: 'alex', amount: 15000 }] }]);
  const plan = settlePlan(b);
  assert.deepEqual(plan.apart, [{ currency: 'KRW', transfers: [{ from: ME, to: 'alex', amount: 15000 }] }]);
  assert.ok(applyTransfers(b.inHome!, plan.inHome).every((x) => x === 0));
  // no home currency: nothing is converted, every currency is apart
  const noHome = balances({ ...trip, budget: undefined });
  assert.equal(noHome.inHome, null);
  assert.deepEqual(noHome.apart.map((g) => g.currency), ['AUD', 'EUR', 'JPY', 'KRW']);
  for (const g of noHome.apart) assert.equal(sum(g.balances), 0);
});

test('convertBalances rounds by largest remainder so the result sums to zero', () => {
  const out = convertBalances([{ person: 'a', amount: 333 }, { person: 'b', amount: 333 }, { person: 'c', amount: -666 }], 'JPY', 0.0105, 'AUD');
  assert.equal(sum(out), 0);
  for (let n = 1; n < 200; n += 3) {
    const list = [{ person: 'a', amount: n * 7 }, { person: 'b', amount: n * 3 }, { person: 'c', amount: -n * 10 }];
    for (const [from, rate] of [['JPY', 0.0103], ['KWD', 4.97], ['USD', 1.5371]] as const) assert.equal(sum(convertBalances(list, from, rate, 'AUD')), 0);
  }
});

test('greedy settle-up settles everyone in at most n-1 transfers, deterministically', () => {
  assert.deepEqual(settleUp([{ person: ME, amount: 0 }]), []);
  const list = [{ person: ME, amount: 5000 }, { person: 'sam', amount: -2000 }, { person: 'alex', amount: -3000 }];
  assert.deepEqual(settleUp(list), [{ from: 'alex', to: ME, amount: 3000 }, { from: 'sam', to: ME, amount: 2000 }]);
  // ties go to the earlier person
  assert.deepEqual(settleUp([{ person: 'a', amount: 100 }, { person: 'b', amount: 100 }, { person: 'c', amount: -200 }]), [
    { from: 'c', to: 'a', amount: 100 },
    { from: 'c', to: 'b', amount: 100 },
  ]);
  // random-ish groups
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 200; k++) {
    const n = 2 + Math.floor(rnd() * 7);
    const amounts = Array.from({ length: n - 1 }, () => Math.floor(rnd() * 20001) - 10000);
    amounts.push(-amounts.reduce((a, b) => a + b, 0));
    const bal = amounts.map((amount, i) => ({ person: `p${i}`, amount }));
    const tr = settleUp(bal);
    assert.ok(tr.length <= Math.max(0, bal.filter((b) => b.amount !== 0).length - 1));
    assert.ok(tr.every((t) => t.amount > 0 && t.from !== t.to));
    assert.ok(applyTransfers(bal, tr).every((x) => x === 0));
  }
});

test('settlements adjust balances, can be undone, and are read defensively', () => {
  let trip = withPeople({ expenses: [exp('a', 9000, 'AUD', { split: equal(ME, 'sam', 'alex') })] });
  const plan = settlePlan(balances(trip));
  assert.deepEqual(plan.inHome, [{ from: 'sam', to: ME, amount: 3000 }, { from: 'alex', to: ME, amount: 3000 }]);
  trip = addSettlement(trip, plan.inHome[0], 'AUD', 's1', '2026-11-03', 'NOW');
  assert.deepEqual(readSettlements(trip), [{ id: 's1', from: 'sam', to: ME, amount: 3000, currency: 'AUD', day: '2026-11-03', createdAt: 'NOW' }]);
  assert.deepEqual(balances(trip).inHome, [{ person: ME, amount: 3000 }, { person: 'sam', amount: 0 }, { person: 'alex', amount: -3000 }]);
  trip = addSettlement(trip, settlePlan(balances(trip)).inHome[0], 'AUD', 's2');
  assert.equal(settlePlan(balances(trip)).settled, true);
  trip = removeSettlement(trip, 's2');
  assert.equal(settlePlan(balances(trip)).inHome.length, 1);
  // a settlement in an unrated currency settles that currency's own balances
  let jp = withPeople({ expenses: [exp('j', 3000, 'JPY', { paidBy: 'sam', split: equal(ME, 'sam') })] });
  const jplan = settlePlan(balances(jp));
  assert.deepEqual(jplan.apart, [{ currency: 'JPY', transfers: [{ from: ME, to: 'sam', amount: 1500 }] }]);
  jp = addSettlement(jp, jplan.apart[0].transfers[0], 'JPY', 'sj');
  assert.equal(settlePlan(balances(jp)).settled, true);
  // malformed rows are skipped
  const bad = { ...trip, settlements: [...(trip.settlements ?? []), { id: 'x', from: 'sam', to: 'sam', amount: 5, currency: 'AUD' }, { id: 's1', from: ME, to: 'sam', amount: 1, currency: 'AUD' }, null] } as unknown as Trip;
  assert.deepEqual(readSettlements(bad).map((s) => s.id), ['s1']);
});

test('companions: add, rename, validate names, and removal reassigns to You', () => {
  let trip = baseTrip();
  assert.deepEqual(peopleOf(trip), [ME]);
  assert.equal(validateName(trip, '  ', 'You'), 'empty');
  assert.equal(validateName(trip, 'you', 'You'), 'duplicate');
  assert.equal(validateName(trip, 'x'.repeat(41), 'You'), 'long');
  trip = addCompanion(trip, '  Sam   Lee ', 'sam');
  assert.deepEqual(readCompanions(trip), [{ id: 'sam', name: 'Sam Lee' }]);
  assert.equal(validateName(trip, 'sam lee', 'You'), 'duplicate');
  assert.equal(validateName(trip, 'Sam Lee', 'You', 'sam'), null);
  trip = renameCompanion(addCompanion(trip, 'Alex', 'alex'), 'sam', 'Sammy');
  assert.deepEqual(readCompanions(trip).map((c) => c.name), ['Sammy', 'Alex']);
  trip = upsertExpense(trip, exp('a', 900, 'AUD', { paidBy: 'sam', split: equal(ME, 'sam', 'alex') }));
  trip = upsertExpense(trip, exp('b', 600, 'AUD', { split: equal('sam') }));
  trip = upsertExpense(trip, exp('c', 1000, 'AUD', { split: { mode: 'exact', parts: [{ person: ME, value: 400 }, { person: 'sam', value: 600 }] } }));
  trip = addSettlement(trip, { from: ME, to: 'sam', amount: 100 }, 'AUD', 's1');
  assert.deepEqual(companionUse(trip, 'sam'), { expenses: 3, settlements: 1 });
  assert.deepEqual(companionUse(trip, 'alex'), { expenses: 1, settlements: 0 });
  const after = removeCompanion(trip, 'sam');
  assert.deepEqual(peopleOf(after), [ME, 'alex']);
  const [a, b, c] = after.expenses!;
  assert.equal(a.paidBy, undefined);
  assert.deepEqual(a.split, equal(ME, 'alex'));
  assert.equal(b.split, undefined);
  assert.deepEqual(splitAmount(1000, c.split!).map((s) => s.amount), [1000]);
  assert.deepEqual(after.settlements, []);
  assert.equal(sum(balances(after).inHome!), 0);
  // corrupt companion rows are skipped
  assert.deepEqual(readCompanions({ companions: [{ id: ME, name: 'x' }, { id: 'a', name: '' }, { id: 'b', name: 'B' }, { id: 'b', name: 'B2' }] as never }), [{ id: 'b', name: 'B' }]);
});

test('form fields: defaults, validation, exact remaining and round trip through an expense', () => {
  assert.deepEqual(newTogetherDraft(baseTrip()).people, [ME]);
  const trip = withPeople();
  const order = peopleOf(trip);
  let d = newTogetherDraft(trip);
  assert.deepEqual(d, { paidBy: ME, mode: 'equal', people: [ME, 'sam', 'alex'], shares: {}, exact: {} });
  d = togglePerson(togglePerson(d, 'sam', order), 'sam', order);
  assert.deepEqual(d.people, [ME, 'sam', 'alex']);
  assert.deepEqual(validateTogether({ ...d, people: [] }, 1000, 'AUD'), ['people']);
  assert.deepEqual(validateTogether({ ...d, mode: 'shares', shares: { sam: '0' } }, 1000, 'AUD'), ['shares']);
  assert.deepEqual(validateTogether({ ...d, mode: 'shares', shares: { sam: '2' } }, 1000, 'AUD'), []);
  const ex = { ...d, mode: 'exact' as const, exact: { me: '5', sam: '3.50', alex: '' } };
  assert.equal(exactRemaining(ex, 1000, 'AUD'), 150);
  assert.deepEqual(validateTogether(ex, 1000, 'AUD'), ['exactSum']);
  assert.deepEqual(validateTogether({ ...ex, exact: { ...ex.exact, alex: 'abc' } }, 1000, 'AUD'), ['exact']);
  const ok = { ...ex, exact: { ...ex.exact, alex: '1.5' } };
  assert.deepEqual(validateTogether(ok, 1000, 'AUD'), []);
  const split = splitFromDraft(ok, 'AUD');
  assert.deepEqual(split, { mode: 'exact', parts: [{ person: ME, value: 500 }, { person: 'sam', value: 350 }, { person: 'alex', value: 150 }] });
  const e = withSplit(exp('z', 1000, 'AUD'), 'sam', split);
  assert.deepEqual(togetherDraftFromExpense(trip, e), { paidBy: 'sam', mode: 'exact', people: [ME, 'sam', 'alex'], shares: {}, exact: { me: '5.00', sam: '3.50', alex: '1.50' } });
  // solo "You paid, only You" stores nothing, like before
  assert.deepEqual(withSplit(exp('z', 1000, 'AUD', { paidBy: 'sam' }), ME, equal(ME)), exp('z', 1000, 'AUD'));
  // a legacy expense opens as You paid, only You
  assert.deepEqual(togetherDraftFromExpense(trip, exp('y', 5, 'AUD')), { paidBy: ME, mode: 'equal', people: [ME], shares: {}, exact: {} });
  // unknown fields on an edited expense are kept
  assert.deepEqual(keepUnknown({ ...exp('k', 1, 'AUD', { note: 'old' }), future: 1 } as Expense, exp('k', 2, 'AUD')), { future: 1, ...exp('k', 2, 'AUD') });
});

test('.satchel files carry companions, payers, splits and settlements, and older files still import', () => {
  const trip = withPeople({
    expenses: [exp('a', 9000, 'AUD', { paidBy: 'sam', split: { ...equal(ME, 'sam', 'alex'), future: true } as ExpenseSplit })],
    settlements: [{ id: 's1', from: ME, to: 'sam', amount: 1000, currency: 'AUD', day: '2026-11-03' }],
  });
  const { file } = buildTripFile(trip, {}, { now: 'NOW' });
  const parsed = parseTripFileText(JSON.stringify(file));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  let n = 0;
  const imp = importTripFile(parsed.file, (p) => `${p}_${++n}`, 'NOW');
  assert.deepEqual(readCompanions(imp.trip), readCompanions(trip));
  assert.deepEqual(readSettlements(imp.trip), readSettlements(trip));
  assert.equal(imp.trip.expenses![0].paidBy, 'sam');
  assert.equal((imp.trip.expenses![0].split as unknown as { future: boolean }).future, true);
  assert.deepEqual(balances(imp.trip).inHome, balances(trip).inHome);
  // an older file (no T82 fields) imports unchanged
  const old = { ...file, trip: { ...file.trip, companions: undefined, settlements: undefined, expenses: [exp('a', 9000, 'AUD')] } };
  const oldParsed = parseTripFileText(JSON.stringify(old));
  assert.ok(oldParsed.ok);
  if (oldParsed.ok) {
    assert.equal('companions' in oldParsed.file.trip, false);
    assert.deepEqual(oldParsed.file.trip.expenses, [exp('a', 9000, 'AUD')]);
  }
  // garbage T82 fields are dropped, never the trip
  const junk = { ...file, trip: { ...file.trip, companions: 'nope', settlements: [{ id: 1 }], expenses: [{ ...exp('a', 9000, 'AUD'), paidBy: 7, split: { mode: 'x' } }] } };
  const junkParsed = parseTripFileText(JSON.stringify(junk));
  assert.ok(junkParsed.ok);
  if (junkParsed.ok) {
    assert.equal('companions' in junkParsed.file.trip, false);
    assert.equal('settlements' in junkParsed.file.trip, false);
    assert.deepEqual(junkParsed.file.trip.expenses, [exp('a', 9000, 'AUD')]);
  }
  // cleanFileTogether keeps unknown fields on valid rows
  assert.deepEqual(cleanFileTogether({ companions: [{ id: 'a', name: 'A', colour: 3 }] }), { companions: [{ id: 'a', name: 'A', colour: 3 }] });
});
