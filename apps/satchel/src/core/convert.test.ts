import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampPeople,
  cleanKeypad,
  convertAmount,
  convertFor,
  defaultLocal,
  directionalRate,
  keypadMinor,
  localChoices,
  pairFor,
  parseTip,
  pressKey,
  quickScale,
  quickTable,
  rateDates,
  showKeypad,
  setRateOn,
  splitBill,
  splitExpense,
  swapDirection,
  tipFor,
  validateSplit,
  type KeypadKey,
} from './convert.ts';
import type { Expense, Trip } from './model.ts';
import { isExpense, readSpending, setRate } from './spending.ts';

const trip = (extra: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Tokyo',
  startDate: '2026-11-01',
  endDate: '2026-11-10',
  homeTz: 'Australia/Sydney',
  items: [],
  createdAt: '2026-10-01T00:00:00Z',
  budget: { currency: 'AUD' },
  ...extra,
});
const exp = (id: string, amount: number, currency: string, day = '2026-11-02', createdAt = `${day}T10:00:00Z`): Expense => ({ id, amount, currency, category: 'food', day, createdAt });
const type = (keys: KeypadKey[], currency: string, start = '') => keys.reduce((s, k) => pressKey(s, k, currency), start);

test('convertAmount works in minor units and rounds half away from zero to the target decimals', () => {
  assert.equal(convertAmount(1000, 'JPY', 'AUD', 0.0102), 1020); // ¥1000 -> A$10.20
  assert.equal(convertAmount(1050, 'USD', 'JPY', 150.25), 1578); // $10.50 -> ¥1577.625 -> ¥1578
  assert.equal(convertAmount(1, 'USD', 'EUR', 0.5), 1); // 0.5 cent rounds up
  assert.equal(convertAmount(100500, 'KRW', 'AUD', 0.0011), 11055); // ₩100,500 -> A$110.55
  assert.equal(convertAmount(100505, 'KRW', 'AUD', 0.0011), 11056); // ₩100,505 -> A$110.5555 -> A$110.56
  assert.equal(convertAmount(1500, 'KWD', 'AUD', 4.9), 735); // KWD 1.500 -> A$7.35
  assert.equal(convertAmount(0, 'JPY', 'AUD', 0.0102), 0);
});

test('missing or invalid rate and bad amounts give null, never a guess', () => {
  assert.equal(convertAmount(1000, 'JPY', 'AUD', null), null);
  assert.equal(convertAmount(1000, 'JPY', 'AUD', undefined), null);
  assert.equal(convertAmount(1000, 'JPY', 'AUD', 0), null);
  assert.equal(convertAmount(1000, 'JPY', 'AUD', -1), null);
  assert.equal(convertAmount(1000, 'JPY', 'AUD', Number.NaN), null);
  assert.equal(convertAmount(-5, 'JPY', 'AUD', 0.01), null);
  assert.equal(convertAmount(1.5, 'JPY', 'AUD', 0.01), null);
  assert.equal(convertAmount(100, 'jpy', 'AUD', 0.01), null);
  assert.equal(convertFor(1000, 'THB', 'AUD', { JPY: 0.0102 }, 'toHome'), null);
  assert.equal(convertFor(1000, 'JPY', null, { JPY: 0.0102 }, 'toHome'), null);
  assert.equal(directionalRate('THB', 'AUD', {}, 'toLocal'), null);
});

test('swap converts the other way with the inverse rate', () => {
  const rates = { JPY: 0.0102 };
  assert.equal(swapDirection('toHome'), 'toLocal');
  assert.equal(swapDirection(swapDirection('toHome')), 'toHome');
  assert.deepEqual(pairFor('JPY', 'AUD', 'toHome'), { from: 'JPY', to: 'AUD' });
  assert.deepEqual(pairFor('JPY', 'AUD', 'toLocal'), { from: 'AUD', to: 'JPY' });
  assert.equal(convertFor(1000, 'JPY', 'AUD', rates, 'toHome'), 1020);
  assert.equal(convertFor(1020, 'JPY', 'AUD', rates, 'toLocal'), 1000); // A$10.20 -> ¥1000
  assert.equal(convertFor(5000, 'JPY', 'AUD', rates, 'toLocal'), 4902); // A$50 -> ¥4901.96 -> ¥4902
  assert.equal(directionalRate('JPY', 'AUD', rates, 'toHome'), 0.0102);
  assert.ok(Math.abs((directionalRate('JPY', 'AUD', rates, 'toLocal') ?? 0) - 98.0392) < 1e-3);
});

test('keypad: digits, one decimal mark, never more decimals than the currency has', () => {
  assert.equal(type(['1', '2', 'dot', '5', '0', '9'], 'USD'), '12.50');
  assert.equal(type(['dot', '5'], 'USD'), '0.5');
  assert.equal(type(['1', 'dot', 'dot', '2'], 'EUR'), '1.2');
  assert.equal(type(['0', '0', '7'], 'USD'), '7');
  assert.equal(type(['1', 'dot', '2', '3', '4', '5'], 'KWD'), '1.234');
  assert.equal(type(['1', 'back', 'back'], 'USD'), '');
  assert.equal(type(['9', '9', 'clear'], 'USD'), '');
  assert.equal(type(Array(14).fill('9') as KeypadKey[], 'USD'), '9'.repeat(10));
});

test('keypad: zero-decimal currencies (JPY, KRW) ignore the decimal mark', () => {
  assert.equal(type(['1', 'dot', '5'], 'JPY'), '15');
  assert.equal(type(['dot', '0', '5'], 'KRW'), '5');
  assert.equal(keypadMinor('1500', 'JPY'), 1500);
  assert.equal(keypadMinor('1500', 'KRW'), 1500);
});

test('keypadMinor reads keypad text into minor units; cleanKeypad fits text to a currency on swap', () => {
  assert.equal(keypadMinor('12.5', 'USD'), 1250);
  assert.equal(keypadMinor('12.', 'USD'), 1200);
  assert.equal(keypadMinor('0.05', 'USD'), 5);
  assert.equal(keypadMinor('1.5', 'KWD'), 1500);
  assert.equal(keypadMinor('', 'USD'), null);
  assert.equal(keypadMinor('1.234', 'USD'), null);
  assert.equal(keypadMinor('abc', 'USD'), null);
  assert.equal(keypadMinor('9999999999.99', 'USD'), 999999999999);
  assert.equal(cleanKeypad('12.50', 'JPY'), '12');
  assert.equal(cleanKeypad('1.234', 'USD'), '1.23');
  assert.equal(cleanKeypad('1500', 'USD'), '1500');
  assert.equal(cleanKeypad('.5', 'USD'), '0.5');
  assert.equal(cleanKeypad('1,5x', 'USD'), '15');
});

test('quick table: 100 / 500 / 1,000 / 5,000 local, scaled up for low-value currencies', () => {
  assert.equal(quickScale(0.0102), 1); // JPY -> AUD
  assert.equal(quickScale(0.0011), 10); // KRW -> AUD
  assert.equal(quickScale(0.0000961), 100); // IDR -> AUD
  assert.equal(quickScale(0.62), 1); // AUD -> EUR-ish
  assert.equal(quickScale(4.9), 1); // KWD
  assert.equal(quickScale(null), null);
  assert.equal(quickScale(0), null);

  const jpy = quickTable('JPY', 'AUD', { JPY: 0.0102 });
  assert.deepEqual(jpy, [
    { local: 100, home: 102 },
    { local: 500, home: 510 },
    { local: 1000, home: 1020 },
    { local: 5000, home: 5100 },
  ]);
  const krw = quickTable('KRW', 'AUD', { KRW: 0.0011 });
  assert.deepEqual(krw.map((r) => r.local), [1000, 5000, 10000, 50000]);
  const idr = quickTable('IDR', 'AUD', { IDR: 0.0000961 });
  assert.deepEqual(idr.map((r) => r.local), [1000000, 5000000, 10000000, 50000000]); // IDR has 2 decimals: Rp10,000 ...
  assert.equal(idr[0].home, 96); // Rp10,000 -> A$0.96
  const usd = quickTable('USD', 'JPY', { USD: 150 });
  assert.deepEqual(usd[0], { local: 10000, home: 15000 }); // $100 -> ¥15,000
});

test('quick table is empty without a rate, without home, or for home itself', () => {
  assert.deepEqual(quickTable('JPY', 'AUD', {}), []);
  assert.deepEqual(quickTable('JPY', null, { JPY: 0.01 }), []);
  assert.deepEqual(quickTable('AUD', 'AUD', {}), []);
});

test('localChoices: rated currencies first (recently spent first), then unrated expense currencies; never home', () => {
  const t = trip({
    rates: { THB: 0.042, JPY: 0.0102 },
    expenses: [exp('a', 500, 'JPY', '2026-11-02'), exp('b', 100, 'VND', '2026-11-05'), exp('c', 100, 'AUD', '2026-11-06'), exp('d', 100, 'THB', '2026-11-03')],
  });
  const s = readSpending(t);
  assert.deepEqual(localChoices(s, 'AUD'), ['THB', 'JPY', 'VND']);
  assert.equal(defaultLocal(s, 'AUD'), 'THB');
  assert.equal(defaultLocal(s, 'AUD', 'JPY'), 'JPY');
  assert.equal(defaultLocal(s, 'AUD', 'GBP'), 'THB');
  assert.equal(defaultLocal(readSpending(trip()), 'AUD'), null);
});

test('setRateOn saves the rate back to the trip with its day; clearing drops the day', () => {
  let t = setRateOn(trip(), 'JPY', 0.0102, '2026-11-02');
  assert.equal(t.rates?.JPY, 0.0102);
  assert.deepEqual(rateDates(t), { JPY: '2026-11-02' });
  t = setRateOn(t, 'JPY', 0.0105, '2026-11-04');
  assert.deepEqual(rateDates(t), { JPY: '2026-11-04' });
  t = setRateOn(t, 'THB', 0.042, '2026-11-05');
  assert.deepEqual(rateDates(t), { JPY: '2026-11-04', THB: '2026-11-05' });
  t = setRateOn(t, 'JPY', null, '2026-11-06');
  assert.equal(t.rates?.JPY, undefined);
  assert.deepEqual(rateDates(t), { THB: '2026-11-05' });
});

test('setRateOn refuses home, bad codes and bad numbers without changing anything', () => {
  const t = setRateOn(trip(), 'JPY', 0.0102, '2026-11-02');
  assert.equal(setRateOn(t, 'AUD', 1.2, '2026-11-03'), t);
  assert.equal(setRateOn(t, 'jpy', 1.2, '2026-11-03'), t);
  assert.equal(setRateOn(t, 'JPY', -1, '2026-11-03'), t);
  assert.equal(setRateOn(t, 'JPY', Number.POSITIVE_INFINITY, '2026-11-03'), t);
});

test('a rate changed elsewhere (no stamp) shows no date rather than a stale one; junk stamps are ignored', () => {
  const stamped = setRateOn(trip(), 'JPY', 0.0102, '2026-11-02');
  const changed = setRate(stamped, 'JPY', 0.011);
  assert.deepEqual(rateDates(changed), {});
  const junk = { ...trip({ rates: { JPY: 0.01, THB: 0.04, EUR: 1.6 } }), ratesUpdated: { JPY: 'x', THB: { day: '2026-13-40', rate: 0.04 }, EUR: { day: '2026-11-01', rate: 1.6 }, GBP: { day: '2026-11-01', rate: 2 } } } as unknown as Trip;
  assert.deepEqual(rateDates(junk), { EUR: '2026-11-01' });
  assert.deepEqual(rateDates({ ...trip(), ratesUpdated: [] as unknown as Trip['ratesUpdated'] }), {});
});

test('split: equal shares when it divides, remainder spread one minor unit at a time', () => {
  const even = splitBill(9000, 3, 0);
  assert.ok(even.ok);
  if (even.ok) assert.deepEqual(even.split, { bill: 9000, tip: 0, total: 9000, shares: [3000, 3000, 3000], extra: 0 });

  const odd = splitBill(10000, 3, 0); // $100 / 3
  assert.ok(odd.ok);
  if (odd.ok) {
    assert.deepEqual(odd.split.shares, [3334, 3333, 3333]);
    assert.equal(odd.split.extra, 1);
    assert.equal(odd.split.shares.reduce((a, b) => a + b, 0), 10000);
  }
  const many = splitBill(1001, 7, 0); // ¥1001 / 7 = 143 each
  assert.ok(many.ok && many.split.shares.every((x) => x === 143));
  const yen = splitBill(1000, 6, 0); // ¥1000 / 6: four pay ¥167, two pay ¥166
  assert.ok(yen.ok);
  if (yen.ok) {
    assert.deepEqual(yen.split.shares, [167, 167, 167, 167, 166, 166]);
    assert.ok(Math.max(...yen.split.shares) - Math.min(...yen.split.shares) <= 1);
  }
  const twenty = splitBill(1, 20, 0);
  assert.ok(twenty.ok);
  if (twenty.ok) assert.deepEqual(twenty.split.shares, [1, ...Array(19).fill(0)]);
});

test('split with a tip: tip rounded half up in minor units and shared too', () => {
  assert.equal(tipFor(10000, 15), 1500);
  assert.equal(tipFor(1005, 10), 101); // 100.5 rounds up
  assert.equal(tipFor(333, 12.5), 42); // 41.625
  const r = splitBill(8550, 4, 10); // $85.50 + $8.55 = $94.05 over 4
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.split.tip, 855);
    assert.equal(r.split.total, 9405);
    assert.deepEqual(r.split.shares, [2352, 2351, 2351, 2351]);
  }
});

test('split refuses invalid input with the reasons', () => {
  assert.deepEqual(splitBill(null, 3, 0), { ok: false, errors: ['amount'] });
  assert.deepEqual(splitBill(0, 3, 0), { ok: false, errors: ['amount'] });
  assert.deepEqual(splitBill(1000, 1, 0), { ok: false, errors: ['people'] });
  assert.deepEqual(splitBill(1000, 21, 0), { ok: false, errors: ['people'] });
  assert.deepEqual(splitBill(1000, 2.5, 0), { ok: false, errors: ['people'] });
  assert.deepEqual(splitBill(1000, 2, null), { ok: false, errors: ['tip'] });
  assert.deepEqual(splitBill(1000, 2, 101), { ok: false, errors: ['tip'] });
  assert.deepEqual(validateSplit(-1, 0, -5), ['amount', 'people', 'tip']);
  assert.deepEqual(splitBill(1e13, 2, 50), { ok: false, errors: ['amount'] });
});

test('parseTip and clampPeople', () => {
  assert.equal(parseTip(''), 0);
  assert.equal(parseTip('15'), 15);
  assert.equal(parseTip('12,5'), 12.5);
  assert.equal(parseTip('10 %'), 10);
  assert.equal(parseTip('100'), 100);
  assert.equal(parseTip('101'), null);
  assert.equal(parseTip('-5'), null);
  assert.equal(parseTip('abc'), null);
  assert.equal(parseTip('1.234'), null);
  assert.equal(clampPeople(1), 2);
  assert.equal(clampPeople(25), 20);
  assert.equal(clampPeople(4), 4);
  assert.equal(clampPeople(Number.NaN), 2);
});

test('splitExpense makes a valid expense for your share or the whole bill', () => {
  const r = splitBill(10000, 3, 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  const mine = splitExpense(r.split, 'share', { currency: 'USD', day: '2026-11-03', id: 'exp-1', note: '  Bill split · 3 people ', now: '2026-11-03T12:00:00Z' });
  assert.deepEqual(mine, { id: 'exp-1', amount: 3334, currency: 'USD', category: 'food', day: '2026-11-03', note: 'Bill split · 3 people', createdAt: '2026-11-03T12:00:00Z' });
  assert.ok(isExpense(mine));
  const all = splitExpense(r.split, 'total', { currency: 'USD', day: '2026-11-03', id: 'exp-2', category: 'other' });
  assert.equal(all.amount, 10000);
  assert.equal(all.category, 'other');
  assert.equal(all.note, undefined);
  assert.ok(isExpense(all));
});

test('showKeypad groups digits and keeps what is being typed', () => {
  assert.equal(showKeypad(''), '0');
  assert.equal(showKeypad('1234567'), '1,234,567');
  assert.equal(showKeypad('1234.'), '1,234.');
  assert.equal(showKeypad('0.50'), '0.50');
  assert.equal(showKeypad('1234.5', 'de'), '1.234,5');
});
