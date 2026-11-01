// Spending insights + receipts (T111). Pure TypeScript, all on the phone.
//
// Insights read the trip's spending (src/core/spending.ts) in one currency, the "base": the home currency when set,
// otherwise the one currency every expense uses (no home and mixed currencies: no charts, nothing guessed).
// Amounts in other currencies convert only with a saved rate; one with no rate is left out and counted in `missing`.
// Everything is integer minor units of the base currency.
//
// Days: an expense belongs to its own `day` (the local date it was entered for, in the place it happened). Nothing
// is converted through the phone's time zone, so spending in Tokyo on the 3rd stays on the 3rd wherever the phone is.
//
// Shares (category ring, cash vs card) are whole percents that add up to exactly 100 (largest remainder).
//
// Budget pace: the trip's budget spread evenly over its days. By the end of today the plan allows
// budget * daysSoFar / tripDays. 'over' = more than the whole budget spent; 'ahead' = spending is running ahead of
// that plan by more than half a day's allowance; otherwise 'on-track'.
//
// Receipts: a photo per expense, stored in Satchel's documents folder (attachments/) and listed in a phone-only map
// (AsyncStorage RECEIPTS_KEY, keyed by expense id). They are never put on the Trip, so .satchel files never carry
// them (tripfile.ts copies the trip's own fields only), and a receipt goes when its expense or trip goes.
//
// CSV: RFC 4180 (comma separated, CRLF line ends, a field with a comma, quote, CR or LF is quoted with its quotes
// doubled). Amounts are plain major units with the currency's own decimals ("1234.50" USD, "1200" JPY,
// "1.500" KWD); the home value is filled only when a home currency is set and there is a rate for the expense.
import type { Expense, ExpenseCategory, LocalDate, Trip } from './model.ts';
import { EXPENSE_CATEGORIES } from './model.ts';
import { convertMinor, minorToText, rateFor, readSpending, sortExpenses, total, type Spending } from './spending.ts';
import { addDays, daysBetween } from './tz.ts';

// ---- the base currency ----

/** The currency insights are shown in: home, else the single currency used, else null. */
export function insightCurrency(s: Spending): string | null {
  if (s.budget) return s.budget.currency;
  const used = new Set(s.expenses.map((e) => e.currency));
  return used.size === 1 ? [...used][0] : null;
}

/** Rates usable for `base`: the saved ones when base is home, none otherwise (base itself converts at 1). */
const ratesFor = (s: Spending, base: string) => (s.budget?.currency === base ? s.rates : {});

/** One expense in base minor units, or null when it has no rate. */
export function inBase(e: Pick<Expense, 'amount' | 'currency'>, base: string, rates: Record<string, number>): number | null {
  const r = rateFor(e.currency, base, rates);
  return r == null ? null : convertMinor(e.amount, e.currency, r, base);
}

// ---- shares ----

/**
 * Whole percents for non-negative values that add up to exactly 100 (all zeros when the total is 0). Largest
 * remainder: everyone gets the floor, then the biggest leftovers get one more; ties go to the earlier value.
 */
export function percentShares(values: readonly number[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  if (sum <= 0) return clean.map(() => 0);
  const exact = clean.map((v) => (v * 100) / sum);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

// ---- per day ----

export type DayPoint = { day: LocalDate; amount: number; count: number; missing: number };

/**
 * Base-currency totals for every day of the trip (zero days included, so bars line up with the calendar) plus any
 * day outside it that has spending, in date order. `missing` counts expenses left out for lack of a rate.
 */
export function dailySeries(s: Spending, trip: Pick<Trip, 'startDate' | 'endDate'>, base: string): DayPoint[] {
  const rates = ratesFor(s, base);
  const by = new Map<LocalDate, DayPoint>();
  const span = trip.startDate <= trip.endDate ? daysBetween(trip.startDate, trip.endDate) : -1;
  for (let i = 0; i <= Math.min(span, 365); i++) {
    const day = addDays(trip.startDate, i);
    by.set(day, { day, amount: 0, count: 0, missing: 0 });
  }
  for (const e of s.expenses) {
    const p = by.get(e.day) ?? { day: e.day, amount: 0, count: 0, missing: 0 };
    const v = inBase(e, base, rates);
    if (v == null) p.missing++;
    else p.amount += v;
    p.count++;
    by.set(e.day, p);
  }
  return [...by.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** The `n` days with the most spending (largest first; on a tie, the earlier day). Zero days never count. */
export function biggestDays(series: readonly DayPoint[], n = 3): DayPoint[] {
  return series
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount || (a.day < b.day ? -1 : 1))
    .slice(0, n);
}

// ---- per category ----

export type CategorySlice = { category: ExpenseCategory; amount: number; percent: number };

/** Base-currency totals per category that has convertible spending (fixed category order) with percents adding to 100. */
export function categorySlices(s: Spending, base: string): CategorySlice[] {
  const rates = ratesFor(s, base);
  const sums = EXPENSE_CATEGORIES.map((category) => ({
    category,
    amount: s.expenses.filter((e) => e.category === category).reduce((n, e) => n + (inBase(e, base, rates) ?? 0), 0),
  })).filter((c) => c.amount > 0);
  const pct = percentShares(sums.map((c) => c.amount));
  return sums.map((c, i) => ({ ...c, percent: pct[i] }));
}

// ---- cash vs card ----

export type PaySplit = { cash: number; card: number; cashPercent: number; cardPercent: number };

/** Spending paid in cash vs everything else ("card"), in base minor units. Null when nothing converts. */
export function cashCardSplit(s: Spending, cashIds: ReadonlySet<string>, base: string): PaySplit | null {
  const rates = ratesFor(s, base);
  let cash = 0;
  let card = 0;
  for (const e of s.expenses) {
    const v = inBase(e, base, rates);
    if (v == null) continue;
    if (cashIds.has(e.id)) cash += v;
    else card += v;
  }
  if (cash + card <= 0) return null;
  const [cashPercent, cardPercent] = percentShares([cash, card]);
  return { cash, card, cashPercent, cardPercent };
}

// ---- budget pace ----

export type PaceState = 'on-track' | 'ahead' | 'over';
export type Pace = {
  state: PaceState;
  budget: number;
  spent: number;
  /** What the even plan allows by the end of today (the whole budget once the trip is over). */
  planned: number;
  tripDays: number;
  /** Trip days up to and including today (0 before the trip, tripDays after it). */
  daysSoFar: number;
  /** Trip days from today on (today included while the trip runs). */
  daysLeft: number;
  /** What's left spread over daysLeft (floored), or null when no days are left or nothing is left. */
  perDayLeft: number | null;
  /** Some spending had no rate, so `spent` is a floor. */
  partial: boolean;
};

/** Where spending stands against an even daily plan, or null without a budget amount. */
export function budgetPace(s: Spending, trip: Pick<Trip, 'startDate' | 'endDate'>, today: LocalDate): Pace | null {
  if (!s.budget || s.budget.amount === undefined || trip.endDate < trip.startDate) return null;
  const budget = s.budget.amount;
  const t = total(s.expenses, s.budget.currency, s.rates);
  const spent = t.home ?? 0;
  const tripDays = daysBetween(trip.startDate, trip.endDate) + 1;
  const daysSoFar = today < trip.startDate ? 0 : today > trip.endDate ? tripDays : daysBetween(trip.startDate, today) + 1;
  const daysLeft = today < trip.startDate ? tripDays : today > trip.endDate ? 0 : tripDays - daysSoFar + 1;
  const planned = Math.round((budget * daysSoFar) / tripDays);
  const slack = Math.round(budget / tripDays / 2);
  const state: PaceState = spent > budget ? 'over' : spent > planned + slack ? 'ahead' : 'on-track';
  const left = budget - spent;
  return { state, budget, spent, planned, tripDays, daysSoFar, daysLeft, perDayLeft: daysLeft > 0 && left > 0 ? Math.floor(left / daysLeft) : null, partial: t.missing.length > 0 };
}

// ---- CSV export ----

/** One RFC 4180 field: quoted (with quotes doubled) when it holds a comma, quote, CR or LF. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const csvRow = (fields: readonly string[]): string => fields.map(csvField).join(',');

/** Column titles and words for the CSV, from the string catalogue (src/i18n/en/insights.ts). */
export type CsvLabels = {
  date: string;
  category: string;
  note: string;
  amount: string;
  currency: string;
  cash: string;
  home: string;
  homeCurrency: string;
  yes: string;
  no: string;
  categories: Record<ExpenseCategory, string>;
};

/** The trip's spending as CSV text (oldest first, CRLF line ends, header row first). */
export function spendingCsv(trip: Trip, cashIds: ReadonlySet<string>, labels: CsvLabels): string {
  const s = readSpending(trip);
  const home = s.budget?.currency ?? null;
  const rows = [csvRow([labels.date, labels.category, labels.note, labels.amount, labels.currency, labels.cash, labels.home, labels.homeCurrency])];
  for (const e of [...sortExpenses(s.expenses)].reverse()) {
    const h = home ? inBase(e, home, s.rates) : null;
    rows.push(
      csvRow([
        e.day,
        labels.categories[e.category],
        e.note ?? '',
        minorToText(e.amount, e.currency),
        e.currency,
        cashIds.has(e.id) ? labels.yes : labels.no,
        h == null || !home ? '' : minorToText(h, home),
        h == null || !home ? '' : home,
      ]),
    );
  }
  return rows.join('\r\n') + '\r\n';
}

/** A file name for the export: 'spending-<trip name>.csv' with only safe characters. */
export function csvFileName(tripName: string): string {
  const base = tripName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  return `spending${base ? `-${base}` : ''}.csv`;
}

export const CSV_MIME = 'text/csv';
export const CSV_UTI = 'public.comma-separated-values-text';

// ---- receipts (phone only) ----

export const RECEIPTS_KEY = 'satchel.receipts.v1';
export type Receipt = { tripId: string; uri: string; mime: string; addedAt?: string };
/** Receipt photo per expense id. */
export type Receipts = Record<string, Receipt>;
const MAX_URI = 2048;

const isReceipt = (x: unknown): x is Receipt => {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.tripId === 'string' &&
    r.tripId !== '' &&
    typeof r.uri === 'string' &&
    r.uri !== '' &&
    r.uri.length <= MAX_URI &&
    typeof r.mime === 'string' &&
    r.mime.startsWith('image/') &&
    (r.addedAt === undefined || typeof r.addedAt === 'string')
  );
};

/** The stored map with anything malformed left out. */
export function cleanReceipts(raw: unknown): Receipts {
  const out: Receipts = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [id, r] of Object.entries(raw)) if (id && isReceipt(r)) out[id] = { tripId: r.tripId, uri: r.uri, mime: r.mime, ...(r.addedAt ? { addedAt: r.addedAt } : {}) };
  return out;
}

/** The map with this expense's receipt set (a previous one's file is returned in `replaced` to delete). */
export function withReceipt(map: Receipts, expenseId: string, r: Receipt): { map: Receipts; replaced: string | null } {
  const prev = map[expenseId];
  return { map: { ...map, [expenseId]: r }, replaced: prev && prev.uri !== r.uri ? prev.uri : null };
}

/** The map without this expense's receipt, and the file to delete (null when there was none). */
export function withoutReceipt(map: Receipts, expenseId: string): { map: Receipts; removed: string | null } {
  const prev = map[expenseId];
  if (!prev) return { map, removed: null };
  const { [expenseId]: _gone, ...rest } = map;
  return { map: rest, removed: prev.uri };
}

/** Expense ids whose receipt has lost its trip or its expense (deleted elsewhere), so their files can go. */
export function staleReceipts(map: Receipts, trips: readonly Pick<Trip, 'id' | 'expenses'>[]): string[] {
  const live = new Map(trips.map((t) => [t.id, new Set((Array.isArray(t.expenses) ? t.expenses : []).map((e) => e?.id))]));
  return Object.entries(map)
    .filter(([id, r]) => !live.get(r.tripId)?.has(id))
    .map(([id]) => id)
    .sort();
}
