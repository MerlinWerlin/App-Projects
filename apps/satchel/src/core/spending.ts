// Trip spending (T54): a per-trip budget, expenses and manual exchange rates, all on the phone. Pure TypeScript.
//
// Money is held as integer minor units of its own currency (cents, yen, fils), so sums never drift. A currency's
// number of decimals comes from CURRENCY_DIGITS (ISO 4217: JPY 0, USD 2, KWD 3; anything unlisted is 2).
// Rates are typed by the traveller: "1 unit of the foreign currency = x home currency". Nothing is fetched and
// nothing is guessed: an expense in a currency with no rate stays out of the home total and is reported in
// `missing`, so the screen can show its own per-currency total and say "add a rate".
// Stored rows are read defensively: a malformed expense, rate or budget is skipped, never thrown on.
import type { Budget, Expense, ExpenseCategory, LocalDate, Trip } from './model.ts';
import { EXPENSE_CATEGORIES } from './model.ts';
import { isLocalDateTime } from './tz.ts';

/** Decimals for currencies that don't use 2 (ISO 4217 minor units). */
const NON_TWO: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

/** Currencies offered as quick picks (the rest are typed as a 3-letter code). */
export const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF', 'CNY', 'HKD', 'SGD', 'THB', 'KRW', 'INR', 'MXN'] as const;

/** Largest amount accepted in minor units (keeps sums well inside safe integers). */
export const MAX_MINOR = 1e13;
/** Rates outside (0, MAX_RATE] are refused. */
export const MAX_RATE = 1e7;
const MAX_NOTE = 200;
const MAX_ROWS = 5000;

/** ISO 4217 shape: three capital letters. */
export const isCurrency = (x: unknown): x is string => typeof x === 'string' && /^[A-Z]{3}$/.test(x);
/** Decimals for a currency (2 when unlisted). */
export const currencyDigits = (code: string): number => NON_TWO[code] ?? 2;
const isDay = (x: unknown): x is LocalDate => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);
const isMinor = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0 && x <= MAX_MINOR;
const isRate = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= MAX_RATE;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
export const isCategory = (x: unknown): x is ExpenseCategory => (EXPENSE_CATEGORIES as readonly unknown[]).includes(x);

// ---- validating stored or imported rows ----

export function isExpense(x: unknown): x is Expense {
  return (
    isObj(x) &&
    typeof x.id === 'string' &&
    x.id !== '' &&
    isMinor(x.amount) &&
    isCurrency(x.currency) &&
    isCategory(x.category) &&
    isDay(x.day) &&
    (x.note === undefined || (typeof x.note === 'string' && x.note.length <= MAX_NOTE * 5)) &&
    (x.createdAt === undefined || typeof x.createdAt === 'string')
  );
}
export const isBudget = (x: unknown): x is Budget => isObj(x) && isCurrency(x.currency) && (x.amount === undefined || isMinor(x.amount));
export const isRates = (x: unknown): x is Record<string, number> => isObj(x) && Object.entries(x).every(([k, v]) => isCurrency(k) && isRate(v));

export type Spending = { budget: Budget | null; rates: Record<string, number>; expenses: Expense[] };

/** The trip's spending with anything malformed left out (rows skipped one by one, never the whole list). */
export function readSpending(trip: Pick<Trip, 'budget' | 'rates' | 'expenses'>): Spending {
  const budget = isBudget(trip.budget) ? trip.budget : null;
  const rates: Record<string, number> = {};
  if (isObj(trip.rates)) for (const [k, v] of Object.entries(trip.rates)) if (isCurrency(k) && isRate(v)) rates[k] = v;
  const seen = new Set<string>();
  const expenses: Expense[] = [];
  for (const e of Array.isArray(trip.expenses) ? trip.expenses.slice(0, MAX_ROWS) : []) {
    if (!isExpense(e) || seen.has(e.id)) continue;
    seen.add(e.id);
    expenses.push(e);
  }
  return { budget, rates, expenses };
}

/** Checks the spending fields of a trip in a .satchel file: absent is fine, present must be valid in full. */
export function checkFileSpending(t: Record<string, unknown>): boolean {
  if (t.budget !== undefined && !isBudget(t.budget)) return false;
  if (t.rates !== undefined && !isRates(t.rates)) return false;
  if (t.expenses === undefined) return true;
  if (!Array.isArray(t.expenses) || t.expenses.length > MAX_ROWS || !t.expenses.every(isExpense)) return false;
  return new Set(t.expenses.map((e: Expense) => e.id)).size === t.expenses.length;
}

// ---- amounts: text <-> minor units ----

/**
 * Reads a typed amount in a currency into minor units, or null when it isn't a positive amount with no more decimals
 * than the currency has. Accepts '.' or ',' as the decimal mark and spaces, apostrophes or the other mark as
 * thousands separators ("1,234.50", "1.234,50", "1 234,5"). One mark followed by exactly three digits is a thousands
 * separator unless the currency has three decimals ("1,500" USD = 1500.00; "1,500" KWD = 1.500).
 */
export function parseAmount(text: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const s = text.trim().replace(/[\s  ']/g, '');
  if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let intPart = s;
  let frac = '';
  if (lastDot >= 0 && lastComma >= 0) {
    const mark = lastDot > lastComma ? '.' : ',';
    const other = mark === '.' ? ',' : '.';
    const at = s.lastIndexOf(mark);
    if (s.indexOf(mark) !== at) return null;
    intPart = s.slice(0, at);
    frac = s.slice(at + 1);
    if (!thousandsOk(intPart, other)) return null;
    intPart = intPart.split(other).join('');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const mark = lastDot >= 0 ? '.' : ',';
    const parts = s.split(mark);
    if (parts.length > 2) {
      if (!thousandsOk(s, mark)) return null;
      intPart = parts.join('');
    } else if (parts[1].length === 3 && digits !== 3 && parts[0] !== '' && parts[0] !== '0') {
      intPart = parts.join('');
    } else {
      intPart = parts[0];
      frac = parts[1];
    }
  }
  if (!/^[0-9]*$/.test(intPart) || !/^[0-9]*$/.test(frac) || (intPart === '' && frac === '')) return null;
  if (frac.length > digits) return null;
  const minor = Number(intPart || '0') * 10 ** digits + Number((frac + '0'.repeat(digits)).slice(0, digits) || '0');
  return isMinor(minor) ? minor : null;
}

/** "1,234,567" style grouping: first group 1-3 digits, the rest exactly 3. */
const thousandsOk = (s: string, sep: string) => {
  const g = s.split(sep);
  return /^[0-9]{1,3}$/.test(g[0]) && g.slice(1).every((x) => /^[0-9]{3}$/.test(x));
};

/** Minor units as a plain decimal string for editing: 123450 USD -> "1234.50", 1200 JPY -> "1200", 1500 KWD -> "1.500". */
export function minorToText(minor: number, currency: string): string {
  const d = currencyDigits(currency);
  const neg = minor < 0;
  const abs = Math.abs(Math.round(minor));
  if (d === 0) return `${neg ? '-' : ''}${abs}`;
  const s = String(abs).padStart(d + 1, '0');
  return `${neg ? '-' : ''}${s.slice(0, -d)}.${s.slice(-d)}`;
}

/** Display string with the currency, e.g. "$1,234.50", "¥1,200", "KWD 1.500". Falls back to "CODE 1234.50". */
export function formatMoney(minor: number, currency: string, lang = 'en'): string {
  const d = currencyDigits(currency);
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(minor / 10 ** d);
  } catch {
    return `${currency} ${minorToText(minor, currency)}`;
  }
}

/** Reads a typed rate ("1 foreign = x home"): a positive decimal with '.' or ',' as the mark, or null. */
export function parseRate(text: string): number | null {
  const s = text.trim().replace(/[\s  ']/g, '').replace(',', '.');
  if (!/^[0-9]*\.?[0-9]+$|^[0-9]+\.$/.test(s)) return null;
  const n = Number(s);
  return isRate(n) ? n : null;
}

/** A rate as text for its field, without float noise: 0.0063 -> "0.0063", 1/3 -> "0.33333333". */
export const rateToText = (rate: number): string => String(Number(rate.toPrecision(8)));

/**
 * An amount converted to home minor units with the rate, rounded half away from zero to the home currency's
 * decimals. 1000 JPY (¥1000) at 0.0102 to AUD -> 1020 (A$10.20).
 */
export function convertMinor(minor: number, from: string, rate: number, home: string): number {
  const x = (minor * rate * 10 ** (currencyDigits(home) - currencyDigits(from)));
  // toPrecision clears binary noise such as 1.005 * 100 = 100.49999 before rounding.
  const clean = Number(x.toPrecision(12));
  return Math.sign(clean) * Math.round(Math.abs(clean));
}

// ---- totals ----

export type Money = { currency: string; amount: number };
export type Total = {
  /** Sum in each currency as entered, largest first. */
  perCurrency: Money[];
  /** Everything that could be converted, in home minor units; null when no home currency is set. */
  home: number | null;
  /** Currencies with no rate (left out of `home`), alphabetical. Empty when everything converted. */
  missing: string[];
  count: number;
};

/** The rate for a currency into home: 1 for home itself, the stored rate, or null. */
export const rateFor = (currency: string, home: string | null, rates: Record<string, number>): number | null =>
  home == null ? null : currency === home ? 1 : isRate(rates[currency]) ? rates[currency] : null;

export function total(expenses: readonly Expense[], home: string | null, rates: Record<string, number>): Total {
  const per = new Map<string, number>();
  for (const e of expenses) per.set(e.currency, (per.get(e.currency) ?? 0) + e.amount);
  let homeSum = 0;
  const missing: string[] = [];
  for (const [cur, amount] of per) {
    const r = rateFor(cur, home, rates);
    if (r == null) missing.push(cur);
    else homeSum += convertMinor(amount, cur, r, home as string);
  }
  const perCurrency = [...per].map(([currency, amount]) => ({ currency, amount }));
  perCurrency.sort((a, b) => (a.currency === home ? -1 : b.currency === home ? 1 : a.currency < b.currency ? -1 : 1));
  return { perCurrency, home: home == null ? null : homeSum, missing: home == null ? [] : missing.sort(), count: expenses.length };
}

export type DayTotal = Total & { day: LocalDate };
export type CategoryTotal = Total & { category: ExpenseCategory };

/** Totals for each day that has spending, in date order. */
export function totalsByDay(expenses: readonly Expense[], home: string | null, rates: Record<string, number>): DayTotal[] {
  const by = new Map<LocalDate, Expense[]>();
  for (const e of expenses) by.set(e.day, [...(by.get(e.day) ?? []), e]);
  return [...by.keys()].sort().map((day) => ({ day, ...total(by.get(day) ?? [], home, rates) }));
}

/** Totals for each category that has spending, in the fixed category order. */
export function totalsByCategory(expenses: readonly Expense[], home: string | null, rates: Record<string, number>): CategoryTotal[] {
  return EXPENSE_CATEGORIES.flatMap((category) => {
    const list = expenses.filter((e) => e.category === category);
    return list.length ? [{ category, ...total(list, home, rates) }] : [];
  });
}

/** Every currency the trip's expenses use apart from home, alphabetical (the rates the trip needs). */
export function foreignCurrencies(expenses: readonly Expense[], home: string | null): string[] {
  return [...new Set(expenses.map((e) => e.currency))].filter((c) => c !== home).sort();
}

export type BudgetStatus = {
  budget: number;
  spent: number;
  /** spent / budget, not capped (1.2 = 20% over). */
  fraction: number;
  /** budget - spent; negative when over. */
  left: number;
  over: boolean;
  /** Near the limit: 80% or more spent but not over. */
  near: boolean;
  /** Some spending couldn't be converted (no rate), so `spent` is a floor. */
  partial: boolean;
};

/** Where the trip stands against its budget, or null when there's no budget amount. */
export function budgetStatus(s: Spending): BudgetStatus | null {
  if (!s.budget || s.budget.amount === undefined) return null;
  const t = total(s.expenses, s.budget.currency, s.rates);
  const spent = t.home ?? 0;
  const budget = s.budget.amount;
  const fraction = budget > 0 ? spent / budget : 0;
  return { budget, spent, fraction, left: budget - spent, over: spent > budget, near: spent <= budget && fraction >= 0.8, partial: t.missing.length > 0 };
}

// ---- editing ----

export type ExpenseDraft = { amount: string; currency: string; category: ExpenseCategory; day: LocalDate; note: string };
export type ExpenseError = 'amount' | 'currency' | 'day';

export function newExpenseDraft(day: LocalDate, currency: string, category: ExpenseCategory = 'food'): ExpenseDraft {
  return { amount: '', currency, category, day, note: '' };
}
export const draftFromExpense = (e: Expense): ExpenseDraft => ({ amount: minorToText(e.amount, e.currency), currency: e.currency, category: e.category, day: e.day, note: e.note ?? '' });

/** Normalises what was typed in the currency field: trimmed capitals. */
export const cleanCurrency = (s: string) => s.trim().toUpperCase();

export function validateExpense(d: ExpenseDraft): ExpenseError[] {
  const errors: ExpenseError[] = [];
  const cur = cleanCurrency(d.currency);
  if (!isCurrency(cur)) errors.push('currency');
  if (parseAmount(d.amount, isCurrency(cur) ? cur : 'USD') == null) errors.push('amount');
  if (!isDay(d.day)) errors.push('day');
  return errors;
}

/** The expense for a valid draft (call validateExpense first); keeps the id and createdAt of the one being edited. */
export function expenseFromDraft(d: ExpenseDraft, id: string, prev?: Expense, now = new Date().toISOString()): Expense {
  const currency = cleanCurrency(d.currency);
  const note = d.note.trim().slice(0, MAX_NOTE);
  return {
    id: prev?.id ?? id,
    amount: parseAmount(d.amount, currency) ?? 0,
    currency,
    category: d.category,
    day: d.day,
    ...(note ? { note } : {}),
    createdAt: prev?.createdAt ?? now,
  };
}

/** The trip with this expense added, or replacing the one with its id. Malformed stored rows are dropped on the way. */
export function upsertExpense(trip: Trip, e: Expense): Trip {
  const list = readSpending(trip).expenses;
  const at = list.findIndex((x) => x.id === e.id);
  const expenses = at >= 0 ? list.map((x, i) => (i === at ? e : x)) : [...list, e];
  return { ...trip, expenses };
}

export function removeExpense(trip: Trip, id: string): Trip {
  return { ...trip, expenses: readSpending(trip).expenses.filter((x) => x.id !== id) };
}

/** Sets (or with null, clears) the rate for one currency. Home's own rate is never stored. */
export function setRate(trip: Trip, currency: string, rate: number | null): Trip {
  const rates = { ...readSpending(trip).rates };
  if (rate == null || !isRate(rate) || !isCurrency(currency) || currency === trip.budget?.currency) delete rates[currency];
  else rates[currency] = rate;
  return { ...trip, rates };
}

/**
 * Sets the home currency and budget amount (minor units of that currency; undefined for no limit), or clears both
 * with null. Rates were typed into the old home currency, so a different home currency clears them rather than
 * converting with numbers that no longer mean anything (the screen then asks for new rates).
 */
export function setBudget(trip: Trip, budget: Budget | null): Trip {
  const { budget: _b, ...rest } = trip;
  if (!budget || !isBudget(budget)) return rest;
  const prevHome = isBudget(trip.budget) ? trip.budget.currency : null;
  const rates = prevHome === null || prevHome === budget.currency ? { ...readSpending(trip).rates } : {};
  delete rates[budget.currency];
  return { ...rest, budget: budget.amount === undefined ? { currency: budget.currency } : { currency: budget.currency, amount: budget.amount }, rates };
}

/** Expenses newest day first; within a day, the latest added first. */
export function sortExpenses(expenses: readonly Expense[]): Expense[] {
  return [...expenses].sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : (b.createdAt ?? '') < (a.createdAt ?? '') ? -1 : (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : 0));
}

/** Currency to start a new expense in: the last one used on this trip, else home, else the phone's, else ''. */
export function suggestCurrency(s: Spending, phone: string | null): string {
  const last = sortExpenses(s.expenses)[0];
  if (last) return last.currency;
  if (s.budget) return s.budget.currency;
  return phone && isCurrency(phone) ? phone : '';
}

/** Quick-pick currencies for the form: home, ones used on this trip, then the common list (no repeats, at most `max`). */
export function currencyChoices(s: Spending, phone: string | null, max = 8): string[] {
  const out: string[] = [];
  const add = (c: string | null | undefined) => {
    if (c && isCurrency(c) && !out.includes(c)) out.push(c);
  };
  add(s.budget?.currency);
  for (const e of sortExpenses(s.expenses)) add(e.currency);
  add(phone);
  for (const c of COMMON_CURRENCIES) add(c);
  return out.slice(0, max);
}

/** The day to put a new expense on: today when it falls in the trip, else the trip's first day (or last, once it's over). */
export function defaultDay(trip: Pick<Trip, 'startDate' | 'endDate'>, today: LocalDate): LocalDate {
  if (today < trip.startDate) return trip.startDate;
  if (today > trip.endDate) return trip.endDate;
  return today;
}
