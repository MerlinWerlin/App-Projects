// Offline currency converter and bill split (T61). Pure TypeScript, no network: the only rates are the ones the
// traveller typed into the trip's Spending ("1 local = x home", see spending.ts). Money stays in integer minor units
// of its own currency (yen, cents, fils) so nothing drifts, and a currency's decimals come from currencyDigits.
//
// - Converter: a keypad builds the typed amount as text (never more decimals than the currency has), which is
//   converted local -> home or home -> local with the trip's rate. No rate: null, and the screen asks for one.
// - Quick table: 100 / 500 / 1,000 / 5,000 of the local currency in home, scaled up by powers of ten for currencies
//   whose unit is worth very little (JPY, KRW, IDR, VND) so the rows are amounts people actually pay.
// - Rate dates: each rate's last-updated day is kept in trip.ratesUpdated with the rate it stamped (read defensively;
//   absent on older trips; shown only while the rate is unchanged).
// - Bill split: amount + optional tip percent, shared between 2-20 people in minor units; the remainder goes one
//   minor unit at a time to the first people, so no two shares differ by more than one unit and they add up exactly.
import type { Expense, ExpenseCategory, LocalDate, Trip } from './model.ts';
import { convertMinor, currencyDigits, isCurrency, MAX_MINOR, MAX_RATE, rateFor, readSpending, setRate, sortExpenses, type Spending } from './spending.ts';
import { isLocalDateTime } from './tz.ts';

export type Direction = 'toHome' | 'toLocal';
export const swapDirection = (d: Direction): Direction => (d === 'toHome' ? 'toLocal' : 'toHome');

const isRate = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= MAX_RATE;
const isAmount = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= MAX_MINOR;
const isDay = (x: unknown): x is LocalDate => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);

/** The currency pair for a direction: what's typed (`from`) and what's shown (`to`). */
export const pairFor = (local: string, home: string, d: Direction) => (d === 'toHome' ? { from: local, to: home } : { from: home, to: local });

/**
 * Converts `minor` (of `from`) into minor units of `to`, where `rate` is "1 from = rate to". Rounds half away from
 * zero to `to`'s decimals. Null for a missing or invalid rate, a bad amount, or a result too large to hold.
 */
export function convertAmount(minor: number, from: string, to: string, rate: number | null | undefined): number | null {
  if (!isAmount(minor) || !isRate(rate) || !isCurrency(from) || !isCurrency(to)) return null;
  const out = convertMinor(minor, from, rate, to);
  return Number.isSafeInteger(out) && out <= MAX_MINOR ? out : null;
}

/** "1 from = x to" for a direction, from the trip's rates; null when the local currency has no rate (or no home). */
export function directionalRate(local: string, home: string | null, rates: Record<string, number>, d: Direction): number | null {
  const r = rateFor(local, home, rates);
  if (r == null || !isRate(r)) return null;
  return d === 'toHome' ? r : 1 / r;
}

/** Typed amount converted for a direction, or null (no rate / bad amount). */
export function convertFor(minor: number, local: string, home: string | null, rates: Record<string, number>, d: Direction): number | null {
  if (home == null) return null;
  const { from, to } = pairFor(local, home, d);
  return convertAmount(minor, from, to, directionalRate(local, home, rates, d));
}

// ---- keypad ----

export const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export type KeypadKey = '0' | (typeof DIGIT_KEYS)[number] | 'dot' | 'back' | 'clear';
/** Most digits before the decimal mark (keeps every amount below MAX_MINOR in any currency). */
export const MAX_INT_DIGITS = 10;

/**
 * The keypad text after one key: digits, one '.', never more decimals than the currency has (none for JPY / KRW, so
 * 'dot' does nothing there), no leading zeros ("0" then "5" is "5"), at most MAX_INT_DIGITS before the mark.
 */
export function pressKey(text: string, key: KeypadKey, currency: string): string {
  const digits = currencyDigits(currency);
  const s = cleanKeypad(text, currency);
  if (key === 'clear') return '';
  if (key === 'back') return s.slice(0, -1);
  const dot = s.indexOf('.');
  if (key === 'dot') {
    if (digits === 0 || dot >= 0) return s;
    return s === '' ? '0.' : `${s}.`;
  }
  if (!/^[0-9]$/.test(key)) return s;
  if (dot >= 0) return s.length - dot - 1 >= digits ? s : s + key;
  if (s === '0') return key;
  return s.length >= MAX_INT_DIGITS ? s : s + key;
}

/**
 * Keypad text made valid for a currency (used when the direction swaps): anything that isn't a digit or the first
 * '.' is dropped, extra decimals are cut, and a zero-decimal currency loses its fraction ("12.50" in JPY is "12").
 */
export function cleanKeypad(text: string, currency: string): string {
  const digits = currencyDigits(currency);
  const raw = text.replace(/[^0-9.]/g, '');
  const at = raw.indexOf('.');
  let int = (at >= 0 ? raw.slice(0, at) : raw).replace(/\./g, '').replace(/^0+(?=[0-9])/, '').slice(0, MAX_INT_DIGITS);
  if (at < 0 || digits === 0) return int;
  const frac = raw.slice(at + 1).replace(/\./g, '').slice(0, digits);
  if (int === '') int = '0';
  return `${int}.${frac}`;
}

/** Keypad text as minor units ('' is null; "12." is 1200 in USD). */
export function keypadMinor(text: string, currency: string): number | null {
  const s = cleanKeypad(text, currency);
  if (s === '' || s !== text) return null;
  const digits = currencyDigits(currency);
  const [int, frac = ''] = s.split('.');
  const minor = Number(int || '0') * 10 ** digits + Number((frac + '0'.repeat(digits)).slice(0, digits) || '0');
  return isAmount(minor) ? minor : null;
}

/**
 * Keypad text for display with the language's grouping and decimal mark, keeping what's being typed ("1234." stays
 * "1,234." and "0.50" keeps its zero). Falls back to plain text when Intl can't format.
 */
export function showKeypad(text: string, lang = 'en'): string {
  if (!/^[0-9]*(\.[0-9]*)?$/.test(text) || text === '') return text === '' ? '0' : text;
  const [int, frac] = text.split('.');
  try {
    const nf = new Intl.NumberFormat(lang, { maximumFractionDigits: 0, useGrouping: true });
    const mark = new Intl.NumberFormat(lang, { minimumFractionDigits: 1 }).format(1.5).replace(/[0-9]/g, '') || '.';
    const head = nf.format(Number(int || '0'));
    return frac === undefined ? head : `${head}${mark}${frac}`;
  } catch {
    return text;
  }
}

// ---- quick table ----

export const QUICK_STEPS = [100, 500, 1000, 5000] as const;

/**
 * The multiplier (a power of ten, 1 or more) for the quick table: the smallest that makes the first row (100 local)
 * worth at least half a home unit. JPY -> AUD at 0.0102 stays 1 (100 / 500 / 1,000 / 5,000); KRW at 0.0011 is 10
 * (1,000 ...); IDR at 0.0000961 is 100 (10,000 ...). Strong currencies keep 1. Null without a valid rate.
 */
export function quickScale(rate: number | null | undefined): number | null {
  if (!isRate(rate)) return null;
  let m = 1;
  while (QUICK_STEPS[0] * m * rate < 0.5 && m < 1e6) m *= 10;
  return m;
}

export type QuickRow = { local: number; home: number };

/** Quick rows in minor units of each side, or [] when there's no usable rate. */
export function quickTable(local: string, home: string | null, rates: Record<string, number>): QuickRow[] {
  if (home == null || local === home) return [];
  const rate = rateFor(local, home, rates);
  const m = quickScale(rate);
  if (m == null || rate == null) return [];
  const out: QuickRow[] = [];
  for (const step of QUICK_STEPS) {
    const localMinor = step * m * 10 ** currencyDigits(local);
    const homeMinor = convertAmount(localMinor, local, home, rate);
    if (homeMinor != null && localMinor <= MAX_MINOR) out.push({ local: localMinor, home: homeMinor });
  }
  return out;
}

// ---- which local currency ----

/**
 * Currencies the converter can show against home: every one with a rate, then the trip's other expense
 * currencies (they need a rate), most recently spent first; never home itself.
 */
export function localChoices(s: Spending, home: string | null): string[] {
  const out: string[] = [];
  const add = (c: string) => {
    if (isCurrency(c) && c !== home && !out.includes(c)) out.push(c);
  };
  for (const e of sortExpenses(s.expenses)) if (s.rates[e.currency] != null) add(e.currency);
  for (const c of Object.keys(s.rates).sort()) add(c);
  for (const e of sortExpenses(s.expenses)) add(e.currency);
  return out;
}

/** Local currency to open with: the last one used here when still offered, else the first choice, else null. */
export function defaultLocal(s: Spending, home: string | null, last?: string | null): string | null {
  const choices = localChoices(s, home);
  if (last && choices.includes(last)) return last;
  return choices[0] ?? null;
}

// ---- rate dates ----

/**
 * Last-updated day of each rate the trip has. A stamp counts only while its rate still equals the trip's rate, so a
 * rate changed somewhere that doesn't stamp (the Spending screen, an older build) shows no date rather than a wrong
 * one. Malformed entries are skipped.
 */
export function rateDates(trip: Pick<Trip, 'rates' | 'ratesUpdated' | 'budget' | 'expenses'>): Record<string, LocalDate> {
  const rates = readSpending(trip).rates;
  const raw: unknown = trip.ratesUpdated;
  const out: Record<string, LocalDate> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null) continue;
    const { day, rate } = v as { day?: unknown; rate?: unknown };
    if (rates[k] != null && rates[k] === rate && isDay(day)) out[k] = day;
  }
  return out;
}

/**
 * Sets (or with null, clears) a rate and stamps the day it changed. A rate setRate refuses (home's own, a bad code
 * or number) leaves the trip as it was. Stamps for rates that no longer exist or no longer match are dropped.
 */
export function setRateOn(trip: Trip, currency: string, rate: number | null, today: LocalDate): Trip {
  const next = setRate(trip, currency, rate);
  const rates = readSpending(next).rates;
  if (rate != null && rates[currency] !== rate) return trip;
  const stamps: Record<string, { day: LocalDate; rate: number }> = {};
  for (const [k, day] of Object.entries(rateDates(next))) stamps[k] = { day, rate: rates[k] };
  if (rate != null && isDay(today)) stamps[currency] = { day: today, rate };
  else delete stamps[currency];
  return { ...next, ratesUpdated: stamps };
}

// ---- bill split ----

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 20;
export const MAX_TIP = 100;
export const TIP_CHOICES = [0, 10, 15, 20] as const;

export type SplitError = 'amount' | 'people' | 'tip';
export type Split = {
  /** The bill before tip, minor units. */
  bill: number;
  tip: number;
  total: number;
  /** One share per person, largest first; they add up to `total` and differ by at most one minor unit. */
  shares: number[];
  /** How many people pay one extra minor unit (the remainder). */
  extra: number;
};

/** Reads a typed tip percent: '' is 0; otherwise 0-100 with up to two decimals ('.' or ','), else null. */
export function parseTip(text: string): number | null {
  const s = text.trim().replace(/%$/, '').trim().replace(',', '.');
  if (s === '') return 0;
  if (!/^[0-9]{1,3}(\.[0-9]{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= MAX_TIP ? n : null;
}

/** People count kept inside 2-20 (for the - / + stepper). */
export const clampPeople = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, Math.round(n))) : MIN_PEOPLE);

/** Tip in minor units: bill * percent / 100, rounded half up. */
export function tipFor(bill: number, percent: number): number {
  const x = Number(((bill * percent) / 100).toPrecision(12));
  return Math.round(x);
}

export function validateSplit(bill: number | null, people: number, tipPercent: number | null): SplitError[] {
  const errors: SplitError[] = [];
  if (bill == null || !Number.isSafeInteger(bill) || bill <= 0 || bill > MAX_MINOR) errors.push('amount');
  if (!Number.isInteger(people) || people < MIN_PEOPLE || people > MAX_PEOPLE) errors.push('people');
  if (tipPercent == null || !Number.isFinite(tipPercent) || tipPercent < 0 || tipPercent > MAX_TIP) errors.push('tip');
  return errors;
}

/** The split, or the reasons it can't be made. */
export function splitBill(bill: number | null, people: number, tipPercent: number | null): { ok: true; split: Split } | { ok: false; errors: SplitError[] } {
  const errors = validateSplit(bill, people, tipPercent);
  if (errors.length || bill == null || tipPercent == null) return { ok: false, errors };
  const tip = tipFor(bill, tipPercent);
  const total = bill + tip;
  if (total > MAX_MINOR) return { ok: false, errors: ['amount'] };
  const base = Math.floor(total / people);
  const extra = total - base * people;
  const shares = Array.from({ length: people }, (_, i) => base + (i < extra ? 1 : 0));
  return { ok: true, split: { bill, tip, total, shares, extra } };
}

/**
 * The expense to add for a split: your share (the first, largest one) or the whole bill with tip, in the bill's
 * currency, on `day`, filed under `category` (food by default) with the note the screen wrote.
 */
export function splitExpense(
  split: Split,
  which: 'share' | 'total',
  opts: { currency: string; day: LocalDate; id: string; note?: string; category?: ExpenseCategory; now?: string },
): Expense {
  const note = (opts.note ?? '').trim().slice(0, 200);
  return {
    id: opts.id,
    amount: which === 'share' ? split.shares[0] : split.total,
    currency: opts.currency,
    category: opts.category ?? 'food',
    day: opts.day,
    ...(note ? { note } : {}),
    createdAt: opts.now ?? new Date().toISOString(),
  };
}
