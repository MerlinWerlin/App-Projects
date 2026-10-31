import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DENOMINATIONS, denominationsFor } from './cash.ts';
import { searchCountries, type EmergencyTable } from './emergency.ts';
import type { EssentialsTable } from './essentials.ts';
import type { Trip } from './model.ts';
import { readSpending, upsertExpense } from './spending.ts';
import { balances, ME, resolveExpense } from './together.ts';
import {
  calcTip,
  categoryFor,
  ceilTo,
  coveredOnly,
  defaultPreset,
  findTipping,
  normFor,
  parseNorm,
  pickTipCountry,
  presetsFor,
  roundStep,
  SERVICES,
  tipExpense,
  tipHome,
  TIPPING,
  TIPPING_CHECKED,
  tipRowProblems,
  type Norm,
  type TipInput,
  type TipResult,
} from './tipping.ts';

const essentials = JSON.parse(readFileSync(new URL('../content/country_essentials.json', import.meta.url), 'utf8')) as EssentialsTable;
const emergency = JSON.parse(readFileSync(new URL('../content/emergency_numbers.json', import.meta.url), 'utf8')) as EmergencyTable;

const pct = (low: number, high = low): Norm => ({ kind: 'percent', low, high });
const input = (over: Partial<TipInput>): TipInput => ({ bill: 10000, currency: 'USD', norm: pct(15, 20), mode: 'typical', included: false, roundUp: false, people: 1, ...over });
const ok = (over: Partial<TipInput>): TipResult => {
  const r = calcTip(input(over));
  assert.ok(r.ok, JSON.stringify(r));
  return r.result;
};

// ---- table

test('at least 60 countries, each once, every row has all fields and a valid ISO code', () => {
  assert.ok(TIPPING.length >= 60, String(TIPPING.length));
  assert.equal(new Set(TIPPING.map((r) => r.iso2)).size, TIPPING.length);
  const known = new Set(essentials.countries.map((r) => r.iso2));
  for (const row of TIPPING) {
    assert.deepEqual(tipRowProblems(row), [], row.iso2);
    assert.ok(known.has(row.iso2), `${row.iso2} is an ISO code the essentials table knows`);
    for (const s of SERVICES) assert.ok(parseNorm(row[s]), `${row.iso2} ${s}`);
    assert.equal(typeof row.recheck, 'boolean');
    assert.equal(row.checked, TIPPING_CHECKED);
  }
});

test('every covered country can be found in the shared country search', () => {
  for (const row of TIPPING) assert.ok(searchCountries(emergency, row.iso2).some((r) => r.iso2 === row.iso2), row.iso2);
  const hits = coveredOnly(searchCountries(emergency, 'jap'));
  assert.equal(hits[0]?.iso2, 'JP');
  assert.ok(coveredOnly(searchCountries(emergency, '')).length === TIPPING.length);
});

test('rowProblems catches bad rows', () => {
  const good = TIPPING[0];
  assert.deepEqual(tipRowProblems({ ...good, iso2: 'usa' }), ['iso2']);
  assert.deepEqual(tipRowProblems({ ...good, taxi: 'p20-10' as never }), ['taxi']);
  assert.deepEqual(tipRowProblems({ ...good, service: 'always' as never }), ['service']);
  assert.deepEqual(tipRowProblems({ ...good, checked: '2026-13-01' }), ['checked']);
});

test('well-known rows read as expected (general guidance)', () => {
  assert.equal(normFor('JP', 'restaurant')?.kind, 'offence');
  assert.deepEqual(normFor('us', 'restaurant'), pct(15, 20));
  assert.equal(findTipping('FR')?.service, 'usual');
  assert.equal(normFor('ZZ', 'taxi'), null);
});

test('parseNorm reads every code form and refuses junk', () => {
  assert.deepEqual(parseNorm('p10'), pct(10));
  assert.deepEqual(parseNorm('p10-15'), pct(10, 15));
  assert.deepEqual(parseNorm('o10'), { kind: 'optional', percent: 10 });
  assert.deepEqual(parseNorm('up'), { kind: 'roundup' });
  for (const bad of ['p0', 'p15-10', 'x', '', null, 'p100-200', 'o0']) assert.equal(parseNorm(bad), null, String(bad));
});

// ---- presets

test('presets follow the norm', () => {
  assert.deepEqual(presetsFor(pct(10, 15)), [
    { preset: 'none', percent: 0 },
    { preset: 'roundup', percent: null },
    { preset: 'low', percent: 10 },
    { preset: 'typical', percent: 12.5 },
    { preset: 'generous', percent: 15 },
  ]);
  assert.equal(presetsFor(pct(10)).find((p) => p.preset === 'generous')?.percent, 15);
  assert.deepEqual(presetsFor({ kind: 'offence' }).map((p) => p.preset), ['none', 'roundup']);
  assert.deepEqual(presetsFor({ kind: 'optional', percent: 10 }).map((p) => p.preset), ['none', 'roundup', 'typical']);
  assert.equal(defaultPreset(pct(15, 20)), 'typical');
  assert.equal(defaultPreset({ kind: 'roundup' }), 'roundup');
  assert.equal(defaultPreset({ kind: 'offence' }), 'none');
  assert.equal(defaultPreset({ kind: 'optional', percent: 10 }), 'none');
});

// ---- calculator

test('totals in integer minor units (USD, 2 decimals)', () => {
  const r = ok({ bill: 4567, mode: 'typical' }); // 17.5% of 45.67 = 7.99225
  assert.equal(r.percent, 17.5);
  assert.equal(r.tip, 799);
  assert.equal(r.total, 5366);
  assert.ok(Number.isInteger(r.tip) && Number.isInteger(r.total));
});

test('0-decimal currencies: JPY and KRW stay whole', () => {
  const r = ok({ bill: 3333, currency: 'JPY', norm: pct(10), mode: 'low' });
  assert.equal(r.tip, 333);
  assert.equal(r.total, 3666);
  const k = ok({ bill: 12345, currency: 'KRW', norm: pct(10), mode: 'custom', customPercent: 7 });
  assert.equal(k.tip, 864); // 864.15
  assert.ok(Number.isInteger(k.total));
});

test('3-decimal currencies keep fils', () => {
  const r = ok({ bill: 12345, currency: 'KWD', norm: pct(10), mode: 'low' });
  assert.equal(r.tip, 1235); // 1234.5 rounds half up
  assert.equal(r.total, 13580);
});

test('round up uses a sensible local step', () => {
  assert.equal(roundStep('EUR'), 100);
  assert.equal(roundStep('USD'), 100);
  assert.equal(roundStep('JPY'), 100);
  assert.equal(roundStep('KRW'), 1000);
  assert.equal(roundStep('KWD'), 1000); // one whole dinar
  assert.equal(roundStep('XAF'), 100); // 0 decimals, not in any table
  assert.equal(ceilTo(1201, 100), 1300);
  assert.equal(ceilTo(1200, 100), 1200);

  const r = ok({ bill: 2340, currency: 'EUR', norm: { kind: 'roundup' }, mode: 'roundup' });
  assert.equal(r.total, 2400);
  assert.equal(r.tip, 60);
  assert.equal(r.rounded, true);
  assert.equal(r.percent, null);

  const even = ok({ bill: 2400, currency: 'EUR', norm: { kind: 'roundup' }, mode: 'roundup' });
  assert.equal(even.tip, 0);
  assert.equal(even.rounded, false);

  const y = ok({ bill: 2780, currency: 'JPY', norm: pct(10), mode: 'low', roundUp: true }); // 2780 + 278 = 3058 -> 3100
  assert.equal(y.total, 3100);
  assert.equal(y.tip, 320);
});

test('every round-up step for a currency in the cash table is one of its notes or coins', () => {
  for (const code of Object.keys(DENOMINATIONS)) {
    const step = roundStep(code);
    assert.ok(denominationsFor(code)!.some((d) => d.value === step), `${code} ${step}`);
  }
});

test('service already included zeroes the tip, whatever the preset and round-up', () => {
  for (const mode of ['typical', 'generous', 'roundup', 'custom'] as const) {
    const r = ok({ bill: 4567, mode, customPercent: 20, included: true, roundUp: true });
    assert.equal(r.tip, 0, mode);
    assert.equal(r.total, 4567, mode);
    assert.equal(r.included, true);
  }
  // A bad custom percent doesn't matter once the service is included.
  assert.ok(calcTip(input({ mode: 'custom', customPercent: null, included: true })).ok);
});

test('none leaves no tip', () => {
  const r = ok({ mode: 'none', roundUp: true, bill: 1234 });
  assert.equal(r.tip, 0);
  assert.equal(r.total, 1234);
});

test('split remainder: shares add up exactly and differ by at most one minor unit', () => {
  const r = ok({ bill: 10000, norm: pct(15), mode: 'low', people: 3 }); // 115.00 / 3
  assert.equal(r.total, 11500);
  assert.deepEqual(r.shares, [3834, 3833, 3833]);
  assert.equal(r.extra, 1);
  assert.equal(r.shares.reduce((a, b) => a + b, 0), r.total);

  const y = ok({ bill: 1000, currency: 'JPY', mode: 'none', people: 3 });
  assert.deepEqual(y.shares, [334, 333, 333]);
  for (let n = 1; n <= 20; n++) {
    const s = ok({ bill: 9999, mode: 'typical', people: n });
    assert.equal(s.shares.length, n);
    assert.equal(s.shares.reduce((a, b) => a + b, 0), s.total);
    assert.ok(Math.max(...s.shares) - Math.min(...s.shares) <= 1);
  }
});

test('bad input is reported, never guessed', () => {
  const bad = (over: Partial<TipInput>) => {
    const r = calcTip(input(over));
    assert.equal(r.ok, false);
    return r.ok ? [] : r.errors;
  };
  assert.deepEqual(bad({ bill: null }), ['amount']);
  assert.deepEqual(bad({ bill: 0 }), ['amount']);
  assert.deepEqual(bad({ bill: 1.5 }), ['amount']);
  assert.deepEqual(bad({ people: 0 }), ['people']);
  assert.deepEqual(bad({ people: 21 }), ['people']);
  assert.deepEqual(bad({ currency: 'usd' }), ['currency']);
  assert.deepEqual(bad({ mode: 'custom', customPercent: 120 }), ['percent']);
  // A preset the norm doesn't offer.
  assert.deepEqual(bad({ norm: { kind: 'offence' }, mode: 'generous' }), ['percent']);
});

test('home value only with a saved rate', () => {
  const r = ok({ bill: 2340, currency: 'EUR', norm: { kind: 'roundup' }, mode: 'roundup' });
  assert.equal(tipHome(r, 'EUR', 'GBP', {}), null);
  assert.equal(tipHome(r, 'EUR', null, { EUR: 0.85 }), null);
  assert.deepEqual(tipHome(r, 'EUR', 'GBP', { EUR: 0.85 }), { tip: 51, total: 2040, share: 2040 });
  const y = ok({ bill: 3000, currency: 'JPY', norm: pct(10), mode: 'low' });
  assert.deepEqual(tipHome(y, 'JPY', 'USD', { JPY: 0.0067 }), { tip: 201, total: 2211, share: 2211 });
});

// ---- add to spending

const trip = (over: Partial<Trip> = {}): Trip =>
  ({ id: 't1', name: 'Test', startDate: '2026-11-01', endDate: '2026-11-10', homeTz: 'Europe/London', items: [], ...over }) as Trip;

test('add-to-spending draft amount: the bill with the tip included', () => {
  const r = ok({ bill: 4567, mode: 'typical', people: 2 });
  const e = tipExpense(r, { currency: 'USD', day: '2026-11-02', id: 'exp1', category: 'food', note: 'Dinner ', now: '2026-11-02T20:00:00Z' });
  assert.equal(e.amount, 5366);
  assert.equal(e.currency, 'USD');
  assert.equal(e.category, 'food');
  assert.equal(e.note, 'Dinner');
  assert.equal(e.split, undefined);
  const mine = tipExpense(r, { currency: 'USD', day: '2026-11-02', id: 'exp2', category: 'food', split: 'mine' });
  assert.equal(mine.amount, 2683);
  const s = readSpending(upsertExpense(trip(), e));
  assert.equal(s.expenses.length, 1);
  assert.equal(s.expenses[0].amount, 5366);
});

test('add-to-spending with companions: whole total, split equally in Travelling together', () => {
  const t = trip({ companions: [{ id: 'c1', name: 'Sam' }, { id: 'c2', name: 'Ana' }] } as Partial<Trip>);
  const r = ok({ bill: 10000, norm: pct(15), mode: 'low', people: 3 });
  const e = tipExpense(r, { currency: 'USD', day: '2026-11-02', id: 'exp1', category: 'food', split: [ME, 'c1', 'c2'] });
  assert.equal(e.amount, 11500);
  const res = resolveExpense(e, [ME, 'c1', 'c2']);
  assert.equal(res.payer, ME);
  assert.deepEqual(res.shares.map((s) => s.amount), r.shares);
  const b = balances(upsertExpense(t, e));
  assert.ok(b);
});

test('category comes from context, else from the service', () => {
  assert.equal(categoryFor('taxi'), 'transport');
  assert.equal(categoryFor('hotel'), 'stay');
  assert.equal(categoryFor('guide'), 'activities');
  assert.equal(categoryFor('cafe'), 'food');
  assert.equal(categoryFor('restaurant', 'shopping'), 'shopping');
  assert.equal(categoryFor('restaurant', 'nonsense'), 'food');
});

test('country pick: current stop, else home, else none (the list)', () => {
  assert.equal(pickTipCountry(['JP', 'GB']), 'JP');
  assert.equal(pickTipCountry([null, 'gb']), 'GB');
  assert.equal(pickTipCountry(['AQ', undefined, 'DE']), 'DE');
  assert.equal(pickTipCountry([null, undefined]), null);
});
