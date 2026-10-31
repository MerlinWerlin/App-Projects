import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Expense, Trip } from './model.ts';
import {
  budgetStatus,
  checkFileSpending,
  convertMinor,
  currencyChoices,
  currencyDigits,
  defaultDay,
  draftFromExpense,
  expenseFromDraft,
  foreignCurrencies,
  formatMoney,
  isCurrency,
  minorToText,
  newExpenseDraft,
  parseAmount,
  parseRate,
  rateToText,
  readSpending,
  removeExpense,
  setBudget,
  setRate,
  sortExpenses,
  suggestCurrency,
  total,
  totalsByCategory,
  totalsByDay,
  upsertExpense,
  validateExpense,
} from './spending.ts';

const exp = (id: string, amount: number, currency: string, day = '2026-11-02', category: Expense['category'] = 'food', createdAt = `2026-11-01T0${id.length}:00:00Z`): Expense => ({
  id,
  amount,
  currency,
  category,
  day,
  createdAt,
});

const trip = (extra: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Japan',
  startDate: '2026-11-01',
  endDate: '2026-11-10',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
});

test('currency decimals: JPY 0, USD 2, KWD 3, unknown 2', () => {
  assert.equal(currencyDigits('JPY'), 0);
  assert.equal(currencyDigits('KRW'), 0);
  assert.equal(currencyDigits('USD'), 2);
  assert.equal(currencyDigits('KWD'), 3);
  assert.equal(currencyDigits('BHD'), 3);
  assert.equal(currencyDigits('XYZ'), 2);
  assert.ok(isCurrency('AUD'));
  assert.ok(!isCurrency('aud'));
  assert.ok(!isCurrency('AU'));
  assert.ok(!isCurrency(42));
});

test('parseAmount reads typed amounts into minor units', () => {
  assert.equal(parseAmount('12.5', 'USD'), 1250);
  assert.equal(parseAmount('12,50', 'EUR'), 1250);
  assert.equal(parseAmount(' 0.99 ', 'USD'), 99);
  assert.equal(parseAmount('.5', 'USD'), 50);
  assert.equal(parseAmount('1,234.56', 'USD'), 123456);
  assert.equal(parseAmount('1.234,56', 'EUR'), 123456);
  assert.equal(parseAmount('1 234,5', 'EUR'), 123450);
  assert.equal(parseAmount('1,000,000', 'JPY'), 1000000);
  assert.equal(parseAmount('1,500', 'USD'), 150000, 'three digits after one mark: thousands');
  assert.equal(parseAmount('1.234', 'USD'), 123400, 'same with a dot');
  assert.equal(parseAmount('1200', 'JPY'), 1200);
  assert.equal(parseAmount('1,200', 'JPY'), 1200);
  assert.equal(parseAmount('1.500', 'KWD'), 1500, 'KWD has three decimals');
  assert.equal(parseAmount('1,5', 'KWD'), 1500);
  assert.equal(parseAmount('0.001', 'KWD'), 1);
});

test('parseAmount refuses what is not a positive amount in that currency', () => {
  for (const [text, cur] of [
    ['', 'USD'],
    ['abc', 'USD'],
    ['-5', 'USD'],
    ['0', 'USD'],
    ['0.00', 'USD'],
    ['1.2345', 'USD'],
    ['12.5', 'JPY'],
    ['0.0001', 'KWD'],
    ['1.2.3', 'USD'],
    ['1,23,4.00', 'USD'],
    ['1e5', 'USD'],
    ['.', 'USD'],
    ['99999999999999999', 'USD'],
  ] as const)
    assert.equal(parseAmount(text, cur), null, `${text} ${cur}`);
});

test('minorToText gives the field text back', () => {
  assert.equal(minorToText(123450, 'USD'), '1234.50');
  assert.equal(minorToText(5, 'USD'), '0.05');
  assert.equal(minorToText(1200, 'JPY'), '1200');
  assert.equal(minorToText(1500, 'KWD'), '1.500');
  assert.equal(minorToText(-250, 'EUR'), '-2.50');
  for (const [m, c] of [[1, 'USD'], [999999, 'KWD'], [7, 'JPY']] as const) assert.equal(parseAmount(minorToText(m, c), c), m);
});

test('formatMoney uses the currency decimals', () => {
  const yen = formatMoney(1200, 'JPY', 'en');
  assert.match(yen, /1,200/);
  assert.doesNotMatch(yen, /\.00/);
  assert.match(formatMoney(1500, 'KWD', 'en'), /1\.500/);
  assert.match(formatMoney(123450, 'USD', 'en'), /1,234\.50/);
});

test('parseRate and rateToText', () => {
  assert.equal(parseRate('0.0102'), 0.0102);
  assert.equal(parseRate('1,65'), 1.65);
  assert.equal(parseRate('2'), 2);
  assert.equal(parseRate('0'), null);
  assert.equal(parseRate('-1'), null);
  assert.equal(parseRate('abc'), null);
  assert.equal(parseRate(''), null);
  assert.equal(parseRate('1e3'), null);
  assert.equal(rateToText(1 / 3), '0.33333333');
  assert.equal(rateToText(0.0063), '0.0063');
});

test('convertMinor rounds to the home decimals, across 0/2/3-decimal currencies', () => {
  assert.equal(convertMinor(1000, 'JPY', 0.0102, 'AUD'), 1020, '¥1000 at 0.0102 = A$10.20');
  assert.equal(convertMinor(1050, 'USD', 150, 'JPY'), 1575, '$10.50 at 150 = ¥1575');
  assert.equal(convertMinor(1500, 'KWD', 3.25, 'USD'), 488, 'KWD 1.500 at 3.25 = $4.875 -> $4.88');
  assert.equal(convertMinor(100, 'USD', 0.3077, 'KWD'), 308, '$1.00 at 0.3077 = KWD 0.308 (0.3077 rounds up)');
  assert.equal(convertMinor(1005, 'USD', 0.1, 'EUR'), 101, 'half rounds away from zero despite float noise');
  assert.equal(convertMinor(12345, 'EUR', 1, 'EUR'), 12345);
});

test('total: per currency, home total, and missing rates instead of guesses', () => {
  const list = [exp('a', 1000, 'JPY'), exp('b', 2500, 'JPY'), exp('c', 1250, 'AUD'), exp('d', 999, 'USD')];
  const t = total(list, 'AUD', { JPY: 0.01 });
  assert.deepEqual(t.perCurrency, [
    { currency: 'AUD', amount: 1250 },
    { currency: 'JPY', amount: 3500 },
    { currency: 'USD', amount: 999 },
  ]);
  assert.equal(t.home, 1250 + 3500);
  assert.deepEqual(t.missing, ['USD']);
  assert.equal(t.count, 4);
  const withUsd = total(list, 'AUD', { JPY: 0.01, USD: 1.5 });
  assert.equal(withUsd.home, 1250 + 3500 + 1499);
  assert.deepEqual(withUsd.missing, []);
});

test('total with no home currency keeps per-currency sums only', () => {
  const t = total([exp('a', 100, 'EUR'), exp('b', 200, 'EUR')], null, { EUR: 2 });
  assert.equal(t.home, null);
  assert.deepEqual(t.missing, []);
  assert.deepEqual(t.perCurrency, [{ currency: 'EUR', amount: 300 }]);
  const empty = total([], 'AUD', {});
  assert.equal(empty.home, 0);
  assert.equal(empty.count, 0);
});

test('totals by day and by category', () => {
  const list = [
    exp('a', 1000, 'JPY', '2026-11-03', 'food'),
    exp('b', 500, 'AUD', '2026-11-01', 'transport'),
    exp('c', 2000, 'JPY', '2026-11-03', 'stay'),
    exp('d', 300, 'AUD', '2026-11-01', 'food'),
  ];
  const days = totalsByDay(list, 'AUD', { JPY: 0.01 });
  assert.deepEqual(days.map((d) => [d.day, d.home, d.count]), [
    ['2026-11-01', 800, 2],
    ['2026-11-03', 30 * 100, 2],
  ]);
  const cats = totalsByCategory(list, 'AUD', {});
  assert.deepEqual(cats.map((c) => c.category), ['food', 'transport', 'stay'], 'fixed category order, empty ones left out');
  assert.equal(cats[0].home, 300);
  assert.deepEqual(cats[0].missing, ['JPY']);
  assert.deepEqual(foreignCurrencies(list, 'AUD'), ['JPY']);
  assert.deepEqual(foreignCurrencies(list, null), ['AUD', 'JPY']);
});

test('budget status: progress, near, over, partial when a rate is missing', () => {
  const base = { rates: { JPY: 0.01 } as Record<string, number> };
  assert.equal(budgetStatus({ budget: null, rates: {}, expenses: [] }), null);
  assert.equal(budgetStatus({ budget: { currency: 'AUD' }, rates: {}, expenses: [] }), null, 'home currency without a limit');
  const s = budgetStatus({ ...base, budget: { currency: 'AUD', amount: 10000 }, expenses: [exp('a', 5000, 'JPY'), exp('b', 3000, 'AUD')] });
  assert.ok(s);
  assert.equal(s.spent, 8000);
  assert.equal(s.left, 2000);
  assert.equal(s.fraction, 0.8);
  assert.ok(s.near && !s.over && !s.partial);
  const over = budgetStatus({ ...base, budget: { currency: 'AUD', amount: 5000 }, expenses: [exp('a', 6000, 'AUD'), exp('b', 10, 'USD')] });
  assert.ok(over?.over && !over.near && over.partial);
  assert.equal(over.left, -1000);
});

test('readSpending skips malformed stored rows one by one', () => {
  const raw = {
    budget: { currency: 'aud', amount: 5 },
    rates: { JPY: 0.01, EUR: -1, usd: 1.5, GBP: 'x', CHF: Infinity },
    expenses: [
      exp('ok', 100, 'JPY'),
      { ...exp('neg', -5, 'JPY') },
      { ...exp('frac', 1.5, 'USD') },
      { ...exp('cur', 100, 'yen') },
      { ...exp('cat', 100, 'JPY'), category: 'rocket' },
      { ...exp('day', 100, 'JPY'), day: '2026-02-30' },
      { ...exp('note', 100, 'JPY'), note: 7 },
      null,
      'junk',
      exp('ok', 200, 'JPY'),
      exp('ok2', 300, 'EUR'),
    ],
  } as unknown as Trip;
  const s = readSpending(raw);
  assert.equal(s.budget, null);
  assert.deepEqual(s.rates, { JPY: 0.01 });
  assert.deepEqual(s.expenses.map((e) => e.id), ['ok', 'ok2'], 'duplicate ids keep the first');
  assert.deepEqual(readSpending(trip()), { budget: null, rates: {}, expenses: [] });
  assert.deepEqual(readSpending({ expenses: 'nope', rates: [1] } as unknown as Trip).expenses, []);
});

test('checkFileSpending: absent is fine, present must be valid in full', () => {
  assert.ok(checkFileSpending({}));
  assert.ok(checkFileSpending({ budget: { currency: 'AUD', amount: 100 }, rates: { JPY: 0.01 }, expenses: [exp('a', 1, 'JPY')] }));
  assert.ok(checkFileSpending({ budget: { currency: 'AUD' } }));
  assert.ok(!checkFileSpending({ budget: { currency: 'AUD', amount: 1.5 } }));
  assert.ok(!checkFileSpending({ rates: { JPY: 0 } }));
  assert.ok(!checkFileSpending({ rates: [] }));
  assert.ok(!checkFileSpending({ expenses: {} }));
  assert.ok(!checkFileSpending({ expenses: [exp('a', 1, 'JPY'), { id: 'b' }] }));
  assert.ok(!checkFileSpending({ expenses: [exp('a', 1, 'JPY'), exp('a', 2, 'JPY')] }), 'duplicate ids');
});

test('expense drafts: validate, build, edit back', () => {
  const d = newExpenseDraft('2026-11-02', 'JPY', 'transport');
  assert.deepEqual(validateExpense(d), ['amount']);
  assert.deepEqual(validateExpense({ ...d, amount: '1.5' }), ['amount'], 'yen has no decimals');
  assert.deepEqual(validateExpense({ ...d, amount: '5', currency: 'yen!' }), ['currency']);
  assert.deepEqual(validateExpense({ ...d, amount: '5', day: '2026-13-01' }), ['day']);
  const ok = { ...d, amount: '1,200', currency: ' jpy ', note: '  Shinkansen snack  ' };
  assert.deepEqual(validateExpense(ok), []);
  const e = expenseFromDraft(ok, 'exp_1', undefined, '2026-11-02T01:00:00Z');
  assert.deepEqual(e, { id: 'exp_1', amount: 1200, currency: 'JPY', category: 'transport', day: '2026-11-02', note: 'Shinkansen snack', createdAt: '2026-11-02T01:00:00Z' });
  const back = draftFromExpense(e);
  assert.equal(back.amount, '1200');
  const edited = expenseFromDraft({ ...back, amount: '900', note: '' }, 'exp_other', e, 'later');
  assert.equal(edited.id, 'exp_1');
  assert.equal(edited.createdAt, e.createdAt);
  assert.equal(edited.note, undefined);
});

test('upsert, remove, rates and budget on a trip', () => {
  let t = trip({ expenses: [exp('bad', -1, 'JPY') as Expense] });
  t = upsertExpense(t, exp('a', 100, 'JPY'));
  t = upsertExpense(t, exp('b', 200, 'AUD'));
  assert.deepEqual(t.expenses?.map((e) => e.id), ['a', 'b'], 'malformed row dropped on write');
  t = upsertExpense(t, { ...exp('a', 150, 'JPY') });
  assert.equal(t.expenses?.[0].amount, 150);
  t = removeExpense(t, 'b');
  assert.deepEqual(t.expenses?.map((e) => e.id), ['a']);

  t = setBudget(t, { currency: 'AUD', amount: 200000 });
  assert.deepEqual(t.budget, { currency: 'AUD', amount: 200000 });
  t = setRate(t, 'JPY', 0.0102);
  t = setRate(t, 'AUD', 2);
  assert.deepEqual(t.rates, { JPY: 0.0102 }, 'home never gets a rate');
  t = setRate(t, 'EUR', -3);
  assert.equal(t.rates?.EUR, undefined);
  t = setRate(t, 'JPY', null);
  assert.deepEqual(t.rates, {});
  t = setRate(t, 'EUR', 1.6);
  t = setRate(t, 'USD', 1.5);
  t = setBudget(t, { currency: 'AUD', amount: 100 });
  assert.deepEqual(t.rates, { EUR: 1.6, USD: 1.5 }, 'same home keeps its rates');
  t = setBudget(t, { currency: 'EUR' });
  assert.deepEqual(t.budget, { currency: 'EUR' });
  assert.deepEqual(t.rates, {}, 'a new home currency clears rates typed into the old one');
  const first = setBudget({ ...trip(), rates: { JPY: 0.01, EUR: 2 } }, { currency: 'EUR' });
  assert.deepEqual(first.rates, { JPY: 0.01 }, 'first home keeps rates but never its own');
  t = setBudget(t, null);
  assert.equal(t.budget, undefined);
  assert.equal(setBudget(t, { currency: 'nope' }).budget, undefined);
});

test('sorting, suggestions and the default day', () => {
  const list = [exp('a', 1, 'JPY', '2026-11-01', 'food', '1'), exp('b', 1, 'EUR', '2026-11-03', 'food', '2'), exp('c', 1, 'USD', '2026-11-03', 'food', '3')];
  assert.deepEqual(sortExpenses(list).map((e) => e.id), ['c', 'b', 'a']);
  assert.equal(suggestCurrency({ budget: { currency: 'AUD' }, rates: {}, expenses: list }, 'GBP'), 'USD');
  assert.equal(suggestCurrency({ budget: { currency: 'AUD' }, rates: {}, expenses: [] }, 'GBP'), 'AUD');
  assert.equal(suggestCurrency({ budget: null, rates: {}, expenses: [] }, 'GBP'), 'GBP');
  assert.equal(suggestCurrency({ budget: null, rates: {}, expenses: [] }, null), '');
  const choices = currencyChoices({ budget: { currency: 'AUD' }, rates: {}, expenses: list }, 'GBP', 6);
  assert.deepEqual(choices, ['AUD', 'USD', 'EUR', 'JPY', 'GBP', 'CAD'], 'home, used on the trip, phone, then common; no repeats');
  const t = { startDate: '2026-11-01', endDate: '2026-11-10' };
  assert.equal(defaultDay(t, '2026-10-20'), '2026-11-01');
  assert.equal(defaultDay(t, '2026-11-05'), '2026-11-05');
  assert.equal(defaultDay(t, '2026-12-01'), '2026-11-10');
});
