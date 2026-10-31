import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Expense, Trip } from './model.ts';
import {
  bankRateGap,
  bumpCount,
  cashLeft,
  cashPaidIds,
  cashPace,
  cashSummary,
  cashTripFor,
  cleanFileCash,
  countCurrencyFor,
  countTotal,
  denominationsFor,
  DENOMINATIONS,
  DENOMINATIONS_CHECKED,
  denomKey,
  draftFromMove,
  feeStats,
  hasCash,
  isPaidInCash,
  leftoverChoicesFor,
  leftoverSummary,
  lowCash,
  moveFromDraft,
  newMoveDraft,
  readCash,
  recordCount,
  removeMove,
  setCountCurrency,
  setLeftoverChoice,
  setPaidInCash,
  setStartCash,
  sortMoves,
  upsertMove,
  validateMove,
  type CashMove,
  type CashWithdrawal,
} from './cash.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';

const NOW = '2027-04-01T00:00:00.000Z';

const base = (extra: Partial<Trip> = {}): Trip => ({
  id: 'trip_1',
  name: 'Tokyo',
  startDate: '2027-04-01',
  endDate: '2027-04-10',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: NOW,
  budget: { currency: 'AUD' },
  rates: { JPY: 0.01, USD: 1.5 },
  ...extra,
});

const exp = (id: string, amount: number, currency: string, day: string, more: Partial<Expense> = {}): Expense => ({ id, amount, currency, category: 'food', day, ...more });

const w = (id: string, amount: number, more: Partial<CashWithdrawal> = {}): CashMove => ({ id, kind: 'withdrawal', day: '2027-04-02', currency: 'JPY', amount, ...more });

test('balances per currency: start + withdrawals + exchanges + counts - cash-paid spending', () => {
  let t = base({ expenses: [exp('e1', 3000, 'JPY', '2027-04-02'), exp('e2', 9999, 'JPY', '2027-04-02'), exp('e3', 500, 'USD', '2027-04-03')] });
  t = setStartCash(t, 'JPY', 10000);
  t = setStartCash(t, 'AUD', 20000);
  t = upsertMove(t, w('w1', 30000, { fee: 300, feeCurrency: 'AUD' }));
  t = upsertMove(t, { id: 'x1', kind: 'exchange', day: '2027-04-03', currency: 'AUD', amount: 5000, toCurrency: 'USD', toAmount: 3300 });
  t = setPaidInCash(t, 'e1', true);
  t = setPaidInCash(t, 'e3', true);
  const s = cashSummary(t);
  const jpy = s.rows.find((r) => r.currency === 'JPY');
  assert.ok(jpy);
  // e2 is not cash, so it doesn't count; the ATM fee is on the card, not in the wallet.
  assert.equal(jpy.amount, 10000 + 30000 - 3000);
  assert.equal(jpy.withdrawn, 30000);
  assert.equal(jpy.spent, 3000);
  assert.equal(cashLeft(t, 'AUD'), 15000);
  assert.equal(cashLeft(t, 'USD'), 2800);
  assert.equal(cashLeft(t, 'EUR'), 0);
  // Foreign alphabetical, home last.
  assert.deepEqual(s.rows.map((r) => r.currency), ['JPY', 'USD', 'AUD']);
  assert.ok(isPaidInCash(t, 'e1'));
  assert.equal(isPaidInCash(t, 'e2'), false);
});

test('home value at the saved rate, and no value (and listed missing) without one', () => {
  let t = base({ rates: { JPY: 0.0102 } });
  t = setStartCash(t, 'JPY', 12345);
  t = setStartCash(t, 'THB', 50000);
  t = setStartCash(t, 'AUD', 1000);
  const s = cashSummary(t);
  assert.equal(s.rows.find((r) => r.currency === 'JPY')?.home, 12592); // ¥12,345 x 0.0102 = A$125.919 -> 125.92
  assert.equal(s.rows.find((r) => r.currency === 'THB')?.home, null);
  assert.equal(s.rows.find((r) => r.currency === 'AUD')?.home, 1000);
  assert.equal(s.totalHome, 12592 + 1000);
  assert.deepEqual(s.missing, ['THB']);
  // No home currency: nothing converts and nothing is called missing.
  const noHome = cashSummary({ ...t, budget: undefined });
  assert.equal(noHome.totalHome, null);
  assert.ok(noHome.rows.every((r) => r.home === null));
  assert.deepEqual(noHome.missing, []);
});

test('cash marked on an expense a companion paid does not come out of your cash; overspend is flagged short', () => {
  let t = base({ companions: [{ id: 'c_sam', name: 'Sam' }], expenses: [exp('e1', 4000, 'JPY', '2027-04-02', { paidBy: 'c_sam', split: { mode: 'equal', parts: [{ person: 'me', value: 1 }, { person: 'c_sam', value: 1 }] } }), exp('e2', 2500, 'JPY', '2027-04-02')] });
  t = setStartCash(t, 'JPY', 2000);
  t = setPaidInCash(setPaidInCash(t, 'e1', true), 'e2', true);
  const r = cashSummary(t).rows[0];
  assert.equal(r.amount, -500);
  assert.equal(r.short, true);
  // A short balance is not counted as cash in the total.
  assert.equal(cashSummary(t).totalHome, 0);
});

test('unmarking and removing: paid marks toggle, a deleted expense no longer counts, removeMove works', () => {
  let t = base({ expenses: [exp('e1', 1000, 'JPY', '2027-04-02')] });
  t = upsertMove(t, w('w1', 5000));
  t = setPaidInCash(t, 'e1', true);
  assert.equal(cashLeft(t, 'JPY'), 4000);
  assert.equal(setPaidInCash(t, 'e1', true), t, 'already marked: unchanged');
  assert.equal(cashLeft(setPaidInCash(t, 'e1', false), 'JPY'), 5000);
  assert.equal(cashLeft({ ...t, expenses: [] }, 'JPY'), 5000);
  const gone = removeMove(setPaidInCash(t, 'e1', false), 'w1');
  assert.equal(gone.cash, undefined, 'nothing left: the field is removed');
  assert.equal(hasCash(gone), false);
});

test('average withdrawal fee in home, its share of the cash drawn, and fees without a rate kept apart', () => {
  let t = base();
  t = upsertMove(t, w('w1', 10000, { fee: 300, feeCurrency: 'AUD' })); // ¥10,000 = A$100, fee A$3
  t = upsertMove(t, w('w2', 20000, { fee: 0, feeCurrency: 'AUD' })); // free
  t = upsertMove(t, w('w3', 5000, { fee: 22000, feeCurrency: 'JPY' })); // ¥220 fee = A$2.20
  t = upsertMove(t, w('w4', 5000)); // fee not known: left out of the average
  t = upsertMove(t, w('w5', 5000, { fee: 100, feeCurrency: 'THB' })); // no THB rate
  const f = feeStats(t);
  assert.equal(f.withdrawals, 5);
  assert.equal(f.withFee, 4);
  assert.equal(f.avgHome, Math.round((300 + 0 + 22000) / 3));
  assert.deepEqual(f.unconverted, [{ currency: 'THB', amount: 100 }]);
  assert.ok(f.share != null && Math.abs(f.share - 22300 / (10000 + 20000 + 5000)) < 1e-9);
  assert.deepEqual(feeStats(base()), { withdrawals: 0, withFee: 0, avgHome: null, share: null, unconverted: [] });
  assert.equal(bankRateGap(0.0103, 0.01), 0.03);
  assert.equal(bankRateGap(undefined, 0.01), null);
  assert.equal(bankRateGap(0.01, null), null);
});

test('getting low: projected from the trip daily average of cash spending', () => {
  let t = base({ expenses: [exp('e1', 3000, 'JPY', '2027-04-01'), exp('e2', 3000, 'JPY', '2027-04-02'), exp('e3', 3000, 'JPY', '2027-04-03'), exp('e9', 99999, 'JPY', '2027-04-09')] });
  t = setStartCash(t, 'JPY', 20000);
  for (const id of ['e1', 'e2', 'e3', 'e9']) t = setPaidInCash(t, id, true);
  // e9 is in the future on 3 April: it lowers the balance but isn't part of the pace so far.
  t = setPaidInCash(t, 'e9', false);
  const [p] = cashPace(t, '2027-04-03');
  assert.equal(p.dailyAvg, 3000); // ¥9,000 over 3 days
  assert.equal(p.balance, 11000);
  assert.equal(p.daysLeft, 7);
  assert.equal(p.daysCovered, 3);
  assert.equal(p.low, true);
  assert.equal(lowCash(t, '2027-04-03').length, 1);
  // Plenty of cash: not low.
  const rich = setStartCash(t, 'JPY', 200000);
  assert.deepEqual(lowCash(rich, '2027-04-03'), []);
  // Last day: no days after today, so never "low" (the leftover summary takes over).
  assert.equal(cashPace(t, '2027-04-10')[0].low, false);
  // Before or after the trip, no pace at all; no cash spending, no pace.
  assert.deepEqual(cashPace(t, '2027-03-30'), []);
  assert.deepEqual(cashPace(t, '2027-04-11'), []);
  assert.deepEqual(cashPace(setStartCash(base(), 'JPY', 1000), '2027-04-03'), []);
});

test('leftover summary on the last day with home values and choices (no exchange for home)', () => {
  let t = base({ rates: { JPY: 0.01 } });
  t = setStartCash(setStartCash(setStartCash(t, 'JPY', 4321), 'AUD', 2500), 'THB', 10000);
  assert.equal(leftoverSummary(t, '2027-04-09').show, false);
  t = setLeftoverChoice(t, 'JPY', 'exchange');
  t = setLeftoverChoice(t, 'AUD', 'exchange'); // refused for home
  t = setLeftoverChoice(t, 'THB', 'spend');
  const l = leftoverSummary(t, '2027-04-10');
  assert.equal(l.show, true);
  assert.deepEqual(l.rows, [
    { currency: 'JPY', amount: 4321, home: 4321 * 1 /* x 0.01 x 100 */, choice: 'exchange', foreign: true },
    { currency: 'THB', amount: 10000, home: null, choice: 'spend', foreign: true },
    { currency: 'AUD', amount: 2500, home: 2500, choice: null, foreign: false },
  ]);
  assert.equal(l.totalHome, 4321 + 2500);
  assert.deepEqual(l.missing, ['THB']);
  assert.equal(leftoverSummary(t, '2027-04-12').show, true, 'still shown after the trip');
  assert.deepEqual(leftoverChoicesFor('AUD', 'AUD'), ['spend', 'keep']);
  assert.deepEqual(leftoverChoicesFor('JPY', 'AUD'), ['spend', 'keep', 'exchange']);
  assert.equal(setLeftoverChoice(t, 'THB', null).cash?.leftover?.THB, undefined);
  // Nothing left: nothing to show.
  assert.equal(leftoverSummary(base(), '2027-04-10').show, false);
});

test('denomination totals in integer minor units (JPY 0 decimals, USD and EUR cents)', () => {
  assert.equal(DENOMINATIONS_CHECKED.status, 'to re-check');
  let c = {};
  c = bumpCount(c, 'note:10000', 2);
  c = bumpCount(c, 'note:1000', 3);
  c = bumpCount(c, 'coin:500', 1);
  c = bumpCount(c, 'coin:1', 7);
  assert.deepEqual(countTotal('JPY', c), { total: 23507, notes: 23000, coins: 507, pieces: 13 });
  let u = {};
  u = bumpCount(u, 'note:2000', 2); // 2 x $20
  u = bumpCount(u, 'coin:25', 3); // 3 quarters
  u = bumpCount(u, 'coin:1', 4); // 4 cents
  assert.deepEqual(countTotal('USD', u), { total: 4079, notes: 4000, coins: 79, pieces: 9 });
  assert.equal(countTotal('EUR', { 'note:5000': 1, 'coin:2': 3, 'coin:999': 4, 'note:20': 1.5 }).total, 5006, 'unknown keys and bad counts ignored');
  // Steps stay within 0..9999 and zero counts disappear.
  assert.deepEqual(bumpCount({ 'coin:1': 1 }, 'coin:1', -5), {});
  assert.equal(bumpCount({}, 'coin:1', 20000)['coin:1'], 9999);
  // Every table entry is a positive integer, largest first within notes and coins, no repeats.
  for (const [code, list] of Object.entries(DENOMINATIONS)) {
    assert.match(code, /^[A-Z]{3}$/);
    const keys = list.map(denomKey);
    assert.equal(new Set(keys).size, keys.length, code);
    for (const kind of ['note', 'coin'] as const) {
      const v = list.filter((d) => d.kind === kind).map((d) => d.value);
      assert.ok(v.every((x) => Number.isSafeInteger(x) && x > 0), code);
      assert.deepEqual(v, [...v].sort((a, b) => b - a), `${code} ${kind} largest first`);
    }
  }
  assert.equal(denominationsFor('XXX'), null);
  assert.equal(denominationsFor('toString'), null);
});

test('a counted total saved as cash on hand adds the difference as a count move', () => {
  let t = setStartCash(base(), 'JPY', 10000);
  t = recordCount(t, 'JPY', 9300, 'cnt1', '2027-04-03', NOW);
  assert.equal(cashLeft(t, 'JPY'), 9300);
  assert.deepEqual(readCash(t).moves, [{ id: 'cnt1', kind: 'count', day: '2027-04-03', currency: 'JPY', amount: -700, createdAt: NOW }]);
  assert.equal(recordCount(t, 'JPY', 9300, 'cnt2', '2027-04-03'), t, 'matches already: unchanged');
});

test('the counter opens on the trip country currency from the bookings, or the remembered one', () => {
  const t = base({
    items: [
      { id: 'f', tripId: 'trip_1', kind: 'flight', title: 'SYD-HND', start: { local: '2027-04-01T09:00', tz: 'Australia/Sydney' }, end: { local: '2027-04-01T18:00', tz: 'Asia/Tokyo' }, attachments: [] },
    ],
  });
  assert.equal(countCurrencyFor(t), 'JPY');
  assert.equal(countCurrencyFor(setCountCurrency(t, 'USD')), 'USD');
  assert.equal(countCurrencyFor(base({ budget: undefined })), 'AUD', 'nothing to go on: first in the table');
});

test('move form: validation, drafts and round trip of a withdrawal and an exchange', () => {
  const d = { ...newMoveDraft('withdrawal', '2027-04-02', 'JPY', 'AUD'), amount: '30,000', fee: '3.50', bankRate: '0,0105', place: '  Station   ATM ' };
  assert.deepEqual(validateMove(d), []);
  const m = moveFromDraft(d, 'w1', undefined, NOW);
  assert.deepEqual(m, { id: 'w1', kind: 'withdrawal', day: '2027-04-02', currency: 'JPY', amount: 30000, fee: 350, feeCurrency: 'AUD', bankRate: 0.0105, place: 'Station ATM', createdAt: NOW });
  assert.deepEqual(moveFromDraft(draftFromMove(m, 'AUD'), 'x', m, '2099-01-01'), m, 'edit unchanged keeps every field');
  assert.equal((moveFromDraft({ ...d, fee: '0' }, 'w2') as CashWithdrawal).fee, 0, 'a typed zero fee is kept');
  assert.deepEqual(validateMove({ ...d, amount: '1.5' }), ['amount'], 'no decimals in yen');
  assert.deepEqual(validateMove({ ...d, fee: 'abc' }), ['fee']);
  assert.deepEqual(validateMove({ ...d, bankRate: '-1' }), ['bankRate']);
  assert.deepEqual(validateMove({ ...d, currency: 'ye' }), ['currency']);
  const x = { ...newMoveDraft('exchange', '2027-04-01', 'AUD', 'AUD'), amount: '100', toCurrency: 'jpy', toAmount: '9800' };
  assert.deepEqual(validateMove(x), []);
  const xm = moveFromDraft(x, 'x1', undefined, NOW);
  assert.deepEqual(xm, { id: 'x1', kind: 'exchange', day: '2027-04-01', currency: 'AUD', amount: 10000, toCurrency: 'JPY', toAmount: 9800, createdAt: NOW });
  assert.deepEqual(validateMove({ ...x, toCurrency: 'AUD' }), ['same']);
  assert.deepEqual(validateMove({ ...x, toAmount: '' }), ['toAmount']);
  // A field from a newer build survives an edit.
  const future = { ...m, receipt: 'r1' } as unknown as CashMove;
  assert.equal((moveFromDraft(draftFromMove(m, 'AUD'), 'x', future) as unknown as { receipt: string }).receipt, 'r1');
  assert.deepEqual(sortMoves([{ ...xm }, { ...m }]).map((v) => v.id), ['w1', 'x1']);
});

test('stored data read defensively: malformed rows skipped, not thrown on', () => {
  const t = base({
    cash: {
      start: [{ currency: 'JPY', amount: 100 }, { currency: 'JPY', amount: 5 }, { currency: 'jpy', amount: 1 }, { currency: 'USD', amount: -1 }] as never,
      moves: [w('w1', 100), w('w1', 200), { id: 'bad', kind: 'withdrawal', day: '2027-04-02', currency: 'JPY', amount: 1.5 }, { id: 'f', kind: 'withdrawal', day: '2027-04-02', currency: 'JPY', amount: 1, feeCurrency: 'AUD' }, { id: 'z', kind: 'teleport' }] as never,
      paid: [{ expenseId: 'e1' }, { nope: 1 }, 'e2'] as never,
      leftover: { JPY: 'keep', AUD: 'burn', usd: 'spend' } as never,
      local: 'yen',
    },
  });
  const c = readCash(t);
  assert.deepEqual(c.start, [{ currency: 'JPY', amount: 100 }]);
  assert.deepEqual(c.moves.map((m) => m.id), ['w1']);
  assert.deepEqual([...c.paid], ['e1']);
  assert.deepEqual(c.leftover, { JPY: 'keep' });
  assert.equal(c.local, null);
  assert.deepEqual(readCash(base({ cash: 'junk' as never })).moves, []);
  // .satchel cleaning keeps the good rows and drops the field when nothing is left.
  assert.equal('cash' in cleanFileCash({ name: 'x', cash: { moves: [{ id: 'z', kind: 'teleport' }] } }), false);
  assert.deepEqual((cleanFileCash({ name: 'x', cash: t.cash }) as { cash: unknown }).cash, { start: [{ currency: 'JPY', amount: 100 }], moves: [w('w1', 100)], paid: [{ expenseId: 'e1' }], leftover: { JPY: 'keep' } });
});

test('round trip through a .satchel file: moves get new ids, paid marks follow the new expense ids', () => {
  let t = base({ expenses: [exp('e1', 3000, 'JPY', '2027-04-02'), exp('e2', 1000, 'JPY', '2027-04-02')] });
  t = setStartCash(t, 'JPY', 10000);
  t = upsertMove(t, w('w1', 5000, { fee: 300, feeCurrency: 'AUD', bankRate: 0.0101, place: 'ATM' }));
  t = setPaidInCash(t, 'e1', true);
  t = setLeftoverChoice(t, 'JPY', 'keep');
  t = setCountCurrency(t, 'JPY');
  const before = cashSummary(t);
  const parsed = parseTripFileText(JSON.stringify(buildTripFile(t, {}).file));
  assert.ok(parsed.ok);
  let n = 0;
  const imp = importTripFile(parsed.file, (p) => `${p}_n${++n}`).trip;
  const c = readCash(imp);
  assert.notEqual(c.moves[0].id, 'w1');
  const newE1 = imp.expenses?.find((e) => e.amount === 3000)?.id;
  assert.ok(newE1 && newE1 !== 'e1');
  assert.deepEqual([...c.paid], [newE1]);
  assert.deepEqual(cashSummary(imp), before, 'same balances after import');
  assert.deepEqual(c.leftover, { JPY: 'keep' });
  assert.equal(c.local, 'JPY');
  // A damaged cash field in a file never refuses the trip.
  const file = JSON.parse(JSON.stringify(buildTripFile(t, {}).file));
  file.trip.cash = { moves: 'nope', paid: [{ expenseId: 'missing' }] };
  const p2 = parseTripFileText(JSON.stringify(file));
  assert.ok(p2.ok);
  assert.equal(importTripFile(p2.file, (p) => `${p}_m`).trip.cash, undefined, 'a mark for an expense not in the file is dropped');
});

test('the Wallet card trip: in progress or next, else the latest ended trip with cash', () => {
  const a = base({ id: 'a', startDate: '2027-01-01', endDate: '2027-01-05' });
  const b = setStartCash(base({ id: 'b', startDate: '2027-02-01', endDate: '2027-02-05' }), 'JPY', 100);
  const c = base({ id: 'c', startDate: '2027-06-01', endDate: '2027-06-05' });
  assert.equal(cashTripFor([a, b, c], '2027-03-01')?.id, 'c');
  assert.equal(cashTripFor([a, b], '2027-03-01')?.id, 'b');
  assert.equal(cashTripFor([a], '2027-03-01'), null);
});

test('T104: the Cash marker covers entries marked paid in cash (a companion\'s too), not stale marks', () => {
  let t = base({ companions: [{ id: 'c_sam', name: 'Sam' }], expenses: [exp('e1', 1000, 'JPY', '2027-04-02'), exp('e2', 500, 'JPY', '2027-04-02', { paidBy: 'c_sam' }), exp('e3', 700, 'JPY', '2027-04-03')] });
  assert.equal(cashPaidIds(t).size, 0);
  t = setPaidInCash(setPaidInCash(t, 'e1', true), 'e2', true);
  assert.deepEqual([...cashPaidIds(t)].sort(), ['e1', 'e2']);
  // A mark left behind by a deleted entry is not shown.
  const gone = { ...t, expenses: t.expenses!.filter((e) => e.id !== 'e1') };
  assert.deepEqual([...cashPaidIds(gone)], ['e2']);
  assert.equal(cashPaidIds(setPaidInCash(t, 'e2', false)).has('e2'), false);
});
