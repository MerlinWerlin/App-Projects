import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Expense, Trip } from './model.ts';
import {
  biggestDays,
  budgetPace,
  cashCardSplit,
  categorySlices,
  cleanReceipts,
  csvField,
  csvFileName,
  dailySeries,
  insightCurrency,
  percentShares,
  RECEIPTS_KEY,
  spendingCsv,
  staleReceipts,
  withoutReceipt,
  withReceipt,
  type CsvLabels,
  type Receipts,
} from './insights.ts';
import { readSpending } from './spending.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';

const ex = (id: string, amount: number, currency: string, day: string, extra: Partial<Expense> = {}): Expense => ({ id, amount, currency, category: 'food', day, ...extra });
const trip = (extra: Partial<Trip> = {}): Trip => ({
  id: 'trip1',
  name: 'Kyoto & Osaka',
  startDate: '2026-04-01',
  endDate: '2026-04-10',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...extra,
});
const LABELS: CsvLabels = {
  date: 'Date',
  category: 'Category',
  note: 'Note',
  amount: 'Amount',
  currency: 'Currency',
  cash: 'Paid in cash',
  home: 'Home amount',
  homeCurrency: 'Home currency',
  yes: 'Yes',
  no: 'No',
  categories: { food: 'Food', transport: 'Transport', stay: 'Stay', activities: 'Activities', shopping: 'Shopping', other: 'Other' },
};

test('percentShares: largest remainder sums to exactly 100', () => {
  assert.deepEqual(percentShares([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(percentShares([2, 1]), [67, 33]);
  assert.deepEqual(percentShares([0, 0]), [0, 0]);
  assert.deepEqual(percentShares([5]), [100]);
  for (const v of [[1, 2, 3, 4, 5, 6], [999, 1, 1], [7, 7, 7, 7, 7, 7, 7], [123457, 33, 9876, 1]]) {
    assert.equal(percentShares(v).reduce((a, b) => a + b, 0), 100, String(v));
  }
  // remainders 0.5/0.5: the earlier one wins the spare point
  assert.deepEqual(percentShares([1, 1]), [50, 50]);
  assert.deepEqual(percentShares([1, 2, 1, 2]), [17, 33, 17, 33]);
});

test('dailySeries groups by the expense’s own day, never the phone or createdAt zone', () => {
  const s = readSpending(
    trip({
      budget: { currency: 'AUD' },
      rates: { JPY: 0.0102 },
      expenses: [
        // entered at 23:30 in Tokyo on the 3rd = 14:30Z, and one entered "early" in UTC terms on the 4th
        ex('a', 1000, 'JPY', '2026-04-03', { createdAt: '2026-04-03T14:30:00Z' }),
        ex('b', 2000, 'JPY', '2026-04-04', { createdAt: '2026-04-03T15:30:00Z' }),
        ex('c', 500, 'AUD', '2026-04-03'),
        ex('d', 999, 'USD', '2026-04-03'),
        ex('e', 100, 'AUD', '2026-03-30'),
      ],
    }),
  );
  const series = dailySeries(s, trip(), 'AUD');
  assert.equal(series.length, 11); // 10 trip days + one day before
  assert.equal(series[0].day, '2026-03-30');
  const d3 = series.find((d) => d.day === '2026-04-03');
  assert.deepEqual(d3, { day: '2026-04-03', amount: 1020 + 500, count: 3, missing: 1 });
  assert.equal(series.find((d) => d.day === '2026-04-04')?.amount, 2040);
  assert.equal(series.find((d) => d.day === '2026-04-05')?.amount, 0);
  assert.deepEqual(biggestDays(series, 2).map((d) => d.day), ['2026-04-04', '2026-04-03']);
});

test('insightCurrency: home, else a single used currency, else none', () => {
  assert.equal(insightCurrency(readSpending(trip({ budget: { currency: 'NZD' } }))), 'NZD');
  assert.equal(insightCurrency(readSpending(trip({ expenses: [ex('a', 1, 'JPY', '2026-04-01'), ex('b', 2, 'JPY', '2026-04-02')] }))), 'JPY');
  assert.equal(insightCurrency(readSpending(trip({ expenses: [ex('a', 1, 'JPY', '2026-04-01'), ex('b', 2, 'USD', '2026-04-02')] }))), null);
  // no home: other currencies don't convert even if rates linger
  const s = readSpending(trip({ rates: { USD: 1.5 }, expenses: [ex('a', 100, 'JPY', '2026-04-01'), ex('b', 100, 'USD', '2026-04-01')] }));
  assert.equal(dailySeries(s, trip(), 'JPY').find((d) => d.day === '2026-04-01')?.missing, 1);
});

test('categorySlices percents add to 100 and leave out what has no rate', () => {
  const s = readSpending(
    trip({
      budget: { currency: 'USD' },
      expenses: [
        ex('a', 100, 'USD', '2026-04-01', { category: 'food' }),
        ex('b', 100, 'USD', '2026-04-01', { category: 'stay' }),
        ex('c', 100, 'USD', '2026-04-01', { category: 'transport' }),
        ex('d', 5000, 'EUR', '2026-04-01', { category: 'shopping' }),
      ],
    }),
  );
  const slices = categorySlices(s, 'USD');
  assert.deepEqual(slices.map((c) => [c.category, c.percent]), [['food', 34], ['transport', 33], ['stay', 33]]);
});

test('cashCardSplit uses paid-in-cash ids', () => {
  const s = readSpending(trip({ budget: { currency: 'USD' }, expenses: [ex('a', 300, 'USD', '2026-04-01'), ex('b', 700, 'USD', '2026-04-02')] }));
  assert.deepEqual(cashCardSplit(s, new Set(['a']), 'USD'), { cash: 300, card: 700, cashPercent: 30, cardPercent: 70 });
  assert.equal(cashCardSplit(readSpending(trip()), new Set(), 'USD'), null);
});

test('budgetPace: on track, ahead, over, before and after the trip', () => {
  // 10 days, budget 1000.00 -> 100.00 a day
  const t = (spent: number) => trip({ budget: { currency: 'USD', amount: 100000 }, expenses: spent ? [ex('a', spent, 'USD', '2026-04-01')] : [] });
  const p = (spent: number, today: string) => budgetPace(readSpending(t(spent)), trip(), today);
  assert.equal(p(30000, '2026-04-03')?.state, 'on-track'); // plan 300
  assert.equal(p(34999, '2026-04-03')?.state, 'on-track'); // within half a day
  assert.equal(p(35001, '2026-04-03')?.state, 'ahead');
  assert.equal(p(100001, '2026-04-05')?.state, 'over');
  const mid = p(30000, '2026-04-03');
  assert.equal(mid?.daysSoFar, 3);
  assert.equal(mid?.daysLeft, 8);
  assert.equal(mid?.perDayLeft, Math.floor(70000 / 8));
  const before = p(0, '2026-03-20');
  assert.deepEqual([before?.state, before?.daysSoFar, before?.daysLeft, before?.planned], ['on-track', 0, 10, 0]);
  assert.equal(p(10000, '2026-03-20')?.state, 'ahead'); // booked ahead of the trip
  const after = p(90000, '2026-05-01');
  assert.deepEqual([after?.state, after?.daysLeft, after?.perDayLeft, after?.planned], ['on-track', 0, null, 100000]);
  assert.equal(budgetPace(readSpending(trip({ budget: { currency: 'USD' } })), trip(), '2026-04-03'), null);
  assert.equal(budgetPace(readSpending(trip()), trip(), '2026-04-03'), null);
});

test('csvField quotes commas, quotes and newlines (RFC 4180)', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('line1\nline2'), '"line1\nline2"');
  assert.equal(csvField('cr\rhere'), '"cr\rhere"');
  assert.equal(csvField(''), '');
});

test('spendingCsv: major units per currency (0 and 3 decimals), home value only with a rate', () => {
  const tr = trip({
    budget: { currency: 'USD' },
    rates: { JPY: 0.0067 },
    expenses: [
      ex('a', 1200, 'JPY', '2026-04-02', { note: 'Ramen, extra "egg"', createdAt: '2026-04-02T01:00:00Z' }),
      ex('b', 1500, 'KWD', '2026-04-01', { category: 'transport' }),
      ex('c', 123450, 'USD', '2026-04-03', { category: 'stay', note: 'two\nlines' }),
    ],
  });
  const csv = spendingCsv(tr, new Set(['a']), LABELS);
  assert.ok(csv.endsWith('\r\n'));
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'Date,Category,Note,Amount,Currency,Paid in cash,Home amount,Home currency');
  assert.equal(lines[1], '2026-04-01,Transport,,1.500,KWD,No,,');
  assert.equal(lines[2], '2026-04-02,Food,"Ramen, extra ""egg""",1200,JPY,Yes,8.04,USD');
  assert.equal(lines[3], '2026-04-03,Stay,"two\nlines",1234.50,USD,No,1234.50,USD');
  // no home currency: no home column values
  const noHome = spendingCsv(trip({ expenses: [ex('a', 1200, 'JPY', '2026-04-02')] }), new Set(), LABELS).split('\r\n');
  assert.equal(noHome[1], '2026-04-02,Food,,1200,JPY,No,,');
});

test('csvFileName is safe', () => {
  assert.equal(csvFileName('Kyoto & Osaka'), 'spending-kyoto-osaka.csv');
  assert.equal(csvFileName('Café / Zürich'), 'spending-cafe-zurich.csv');
  assert.equal(csvFileName('***'), 'spending.csv');
});

test('receipts map: clean, set, remove, stale', () => {
  const raw = { a: { tripId: 't', uri: 'file:///doc/attachments/rcp1-a.jpg', mime: 'image/jpeg' }, b: { tripId: 't', uri: '', mime: 'image/jpeg' }, c: { tripId: 't', uri: 'x', mime: 'application/pdf' }, d: 'nope' };
  const map = cleanReceipts(raw);
  assert.deepEqual(Object.keys(map), ['a']);
  assert.deepEqual(cleanReceipts(null), {});
  assert.deepEqual(cleanReceipts([1]), {});
  const set = withReceipt(map, 'a', { tripId: 't', uri: 'file:///new.jpg', mime: 'image/jpeg' });
  assert.equal(set.replaced, 'file:///doc/attachments/rcp1-a.jpg');
  assert.equal(withReceipt(map, 'z', { tripId: 't', uri: 'u', mime: 'image/png' }).replaced, null);
  const gone = withoutReceipt(set.map, 'a');
  assert.equal(gone.removed, 'file:///new.jpg');
  assert.deepEqual(gone.map, {});
  assert.equal(withoutReceipt({}, 'a').removed, null);
  const m: Receipts = { e1: { tripId: 't1', uri: 'u1', mime: 'image/jpeg' }, e2: { tripId: 't1', uri: 'u2', mime: 'image/jpeg' }, e3: { tripId: 'gone', uri: 'u3', mime: 'image/jpeg' } };
  assert.deepEqual(staleReceipts(m, [{ id: 't1', expenses: [ex('e1', 1, 'USD', '2026-04-01')] }]), ['e2', 'e3']);
});

test('receipt files never reach .satchel exports', () => {
  const uri = 'file:///var/mobile/Containers/Data/Application/X/Documents/attachments/rcp_9-receipt.jpg';
  const tr = trip({ budget: { currency: 'USD' }, expenses: [ex('e1', 500, 'USD', '2026-04-02', { note: 'Lunch' })] });
  const receipts: Receipts = { e1: { tripId: tr.id, uri, mime: 'image/jpeg' } };
  assert.equal(RECEIPTS_KEY, 'satchel.receipts.v1');
  // the Trip itself has no receipt field
  assert.equal(JSON.stringify(tr).includes('rcp_'), false);
  const built = buildTripFile(tr, {}, { now: '2026-04-05T00:00:00Z' });
  const text = JSON.stringify(built.file);
  assert.equal(text.includes(uri), false);
  assert.equal(text.includes('rcp_'), false);
  assert.equal(/receipt/i.test(text), false);
  assert.equal(built.file.attachments.length, 0);
  // and an import brings back the expense with no receipt
  const parsed = parseTripFileText(text);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  let n = 0;
  const imported = importTripFile(parsed.file, (p) => `${p}_${++n}`);
  assert.equal(imported.trip.expenses?.length, 1);
  assert.equal(/receipt/i.test(JSON.stringify(imported.trip)), false);
  assert.ok(receipts.e1); // the receipt stays only in the phone map
});
