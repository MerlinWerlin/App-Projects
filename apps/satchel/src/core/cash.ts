// Cash on hand (T102): the notes and coins a traveller carries, per currency, kept on the trip (optional Trip.cash).
// Pure TypeScript, all on the phone.
//
// Money is integer minor units of its own currency (spending.ts currencyDigits: JPY 0, USD 2, KWD 3), so nothing drifts.
// Cash left in a currency =
//     starting cash
//   + ATM withdrawals (the cash that came out; the fee is charged to the card, so it never changes cash on hand)
//   + exchanges into the currency - exchanges out of it
//   + "counted" corrections (the tap-to-count result saved as cash on hand)
//   - spending entries marked "paid in cash" that You paid (a companion paying in cash doesn't touch your cash).
// A balance can go below zero when more was marked as cash than was recorded; it is kept (and flagged `short`) so
// the screen can say so rather than hiding the gap.
//
// Home value: each currency at the trip's saved rate (spending.ts rateFor; home itself is 1). No rate, no value:
// that currency is listed in `missing` and never converted with a guess. The rate the bank used on a withdrawal is
// kept for reference only (shown next to the saved rate); values on screen always use the saved rate.
//
// Getting low: from the trip's own cash-paid daily average in that currency (cash spending so far / days of the trip
// so far, today included). The hint shows when what's left won't last the days still to come after today.
// Leftover cash: from the last day of the trip on, every currency with cash left is listed with its home value and
// the traveller's choice (spend it, keep it for next time, exchange it; exchange only for foreign currencies).
//
// Tap to count: DENOMINATIONS lists the common banknotes and coins of a few currencies (TO RE-CHECK, see below). The
// counter multiplies counts by face values in minor units and can save the total as cash on hand (a 'count' move
// holding the difference, so the history still adds up).
//
// Stored rows are read defensively: a malformed row is skipped, never thrown on.
import type { Expense, LocalDate, Trip } from './model.ts';
import { homeCountryFor, tripCountries } from './arrival.ts';
import { currenciesOf, currencyForCountry } from './countrycurrency.ts';
import { convertMinor, currencyDigits, isCurrency, MAX_MINOR, MAX_RATE, parseAmount, parseRate, rateFor, rateToText, readSpending, type Money } from './spending.ts';
import { ME, peopleOf, resolveExpense } from './together.ts';
import { daysBetween, isLocalDateTime } from './tz.ts';

// ---- the stored shape (Trip.cash) ----

/** Cash the traveller set out with in one currency (minor units, 0 or more). */
export type CashStart = { currency: string; amount: number };
/** An ATM withdrawal: the cash that came out, the fee (any currency, often home), the bank's rate if known, where. */
export type CashWithdrawal = {
  id: string;
  kind: 'withdrawal';
  day: LocalDate;
  currency: string;
  amount: number;
  fee?: number;
  feeCurrency?: string;
  /** "1 unit of `currency` = x home" as the bank charged it, for reference. */
  bankRate?: number;
  place?: string;
  createdAt?: string;
};
/** Cash handed over in `currency` (`amount`) for `toAmount` of `toCurrency`. */
export type CashExchange = {
  id: string;
  kind: 'exchange';
  day: LocalDate;
  currency: string;
  amount: number;
  toCurrency: string;
  toAmount: number;
  place?: string;
  createdAt?: string;
};
/** A counted correction: `amount` (signed, not 0) brings the balance to what was counted that day. */
export type CashCount = { id: string; kind: 'count'; day: LocalDate; currency: string; amount: number; createdAt?: string };
export type CashMove = CashWithdrawal | CashExchange | CashCount;
export const LEFTOVER_CHOICES = ['spend', 'keep', 'exchange'] as const;
export type LeftoverChoice = (typeof LEFTOVER_CHOICES)[number];
/** A spending entry marked "paid in cash" (by its expense id, remapped on .satchel import). */
export type CashPaid = { expenseId: string };

export type TripCash = {
  start?: CashStart[];
  moves?: CashMove[];
  paid?: CashPaid[];
  /** What to do with leftover cash, per currency. */
  leftover?: Record<string, LeftoverChoice>;
  /** The currency the tap-to-count opens with (absent: worked out from the trip). */
  local?: string;
};

const MAX_ROWS = 5000;
const MAX_PLACE = 80;
/** Most pieces of one note or coin the counter takes. */
export const MAX_PIECES = 9999;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isId = (x: unknown): x is string => typeof x === 'string' && x !== '' && x.length <= 100;
const isDay = (x: unknown): x is LocalDate => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && isLocalDateTime(`${x}T00:00`);
const isPos = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0 && x <= MAX_MINOR;
const isAmount0 = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= MAX_MINOR;
const isRate = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= MAX_RATE;
const optStr = (x: unknown, max: number) => x === undefined || (typeof x === 'string' && x.length <= max);

export function isCashMove(x: unknown): x is CashMove {
  if (!isObj(x) || !isId(x.id) || !isDay(x.day) || !isCurrency(x.currency) || !optStr(x.createdAt, 64)) return false;
  if (x.kind === 'withdrawal') {
    if (!isPos(x.amount) || !optStr(x.place, MAX_PLACE * 2)) return false;
    if (x.fee !== undefined && !(isAmount0(x.fee) && isCurrency(x.feeCurrency))) return false;
    if (x.fee === undefined && x.feeCurrency !== undefined) return false;
    return x.bankRate === undefined || isRate(x.bankRate);
  }
  if (x.kind === 'exchange') return isPos(x.amount) && isCurrency(x.toCurrency) && x.toCurrency !== x.currency && isPos(x.toAmount) && optStr(x.place, MAX_PLACE * 2);
  if (x.kind === 'count') return typeof x.amount === 'number' && Number.isSafeInteger(x.amount) && x.amount !== 0 && Math.abs(x.amount) <= MAX_MINOR;
  return false;
}

export type CashData = { start: CashStart[]; moves: CashMove[]; paid: Set<string>; leftover: Record<string, LeftoverChoice>; local: string | null };

/** The trip's cash with anything malformed left out (rows skipped one by one). */
export function readCash(trip: Pick<Trip, 'cash'>): CashData {
  const raw: unknown = trip.cash;
  const c = isObj(raw) ? raw : {};
  const start: CashStart[] = [];
  const seenCur = new Set<string>();
  for (const s of Array.isArray(c.start) ? c.start.slice(0, 200) : []) {
    if (!isObj(s) || !isCurrency(s.currency) || !isAmount0(s.amount) || seenCur.has(s.currency)) continue;
    seenCur.add(s.currency);
    start.push(s as CashStart);
  }
  const moves: CashMove[] = [];
  const seen = new Set<string>();
  for (const m of Array.isArray(c.moves) ? c.moves.slice(0, MAX_ROWS) : []) {
    if (!isCashMove(m) || seen.has(m.id)) continue;
    seen.add(m.id);
    moves.push(m);
  }
  const paid = new Set<string>();
  for (const p of Array.isArray(c.paid) ? c.paid.slice(0, MAX_ROWS) : []) if (isObj(p) && isId(p.expenseId)) paid.add(p.expenseId);
  const leftover: Record<string, LeftoverChoice> = {};
  if (isObj(c.leftover)) for (const [k, v] of Object.entries(c.leftover)) if (isCurrency(k) && (LEFTOVER_CHOICES as readonly unknown[]).includes(v)) leftover[k] = v as LeftoverChoice;
  return { start, moves, paid, leftover, local: isCurrency(c.local) ? c.local : null };
}

/** True when the trip has any cash recorded (start, moves or a cash-paid entry). */
export const hasCash = (trip: Pick<Trip, 'cash'>): boolean => {
  const c = readCash(trip);
  return c.start.length > 0 || c.moves.length > 0 || c.paid.size > 0;
};

/** The stored field for cleaned data; absent fields stay absent (an empty Trip.cash is removed). */
function writeCash(trip: Trip, c: CashData): Trip {
  const out: TripCash = {};
  // Keep anything a newer build stored next to these fields.
  const prev: unknown = trip.cash;
  if (isObj(prev)) for (const [k, v] of Object.entries(prev)) if (!['start', 'moves', 'paid', 'leftover', 'local'].includes(k)) (out as Record<string, unknown>)[k] = v;
  if (c.start.length) out.start = c.start;
  if (c.moves.length) out.moves = c.moves;
  if (c.paid.size) out.paid = [...c.paid].map((expenseId) => ({ expenseId }));
  if (Object.keys(c.leftover).length) out.leftover = c.leftover;
  if (c.local) out.local = c.local;
  const { cash: _c, ...rest } = trip;
  return Object.keys(out).length ? { ...rest, cash: out } : rest;
}

// ---- cash-paid spending ----

/** Is this spending entry marked "paid in cash"? */
export const isPaidInCash = (trip: Pick<Trip, 'cash'>, expenseId: string): boolean => readCash(trip).paid.has(expenseId);

/** Marks (or unmarks) a spending entry as paid in cash. */
export function setPaidInCash(trip: Trip, expenseId: string, on: boolean): Trip {
  const c = readCash(trip);
  if (!isId(expenseId) || c.paid.has(expenseId) === on) return trip;
  const paid = new Set(c.paid);
  if (on) paid.add(expenseId);
  else paid.delete(expenseId);
  return writeCash(trip, { ...c, paid });
}

/**
 * T104: ids of the trip's spending entries marked "paid in cash" (whoever paid), for the "Cash" marker on the
 * spending rows. Marks left by a deleted entry are not included.
 */
export function cashPaidIds(trip: Trip): ReadonlySet<string> {
  const { paid } = readCash(trip);
  if (!paid.size) return new Set();
  return new Set(readSpending(trip).expenses.filter((e) => paid.has(e.id)).map((e) => e.id));
}

/** Spending entries marked as cash that You paid (a companion's cash is theirs). */
export function cashExpenses(trip: Trip): Expense[] {
  const { paid } = readCash(trip);
  if (!paid.size) return [];
  const people = peopleOf(trip);
  return readSpending(trip).expenses.filter((e) => paid.has(e.id) && resolveExpense(e, people).payer === ME);
}

// ---- balances ----

export type CashBalance = {
  currency: string;
  /** Cash left, minor units (negative when more was marked as cash than recorded). */
  amount: number;
  start: number;
  withdrawn: number;
  exchangedIn: number;
  exchangedOut: number;
  counted: number;
  spent: number;
  /** Value in home minor units at the saved rate; null with no home or no rate. */
  home: number | null;
  short: boolean;
};
export type CashSummary = {
  home: string | null;
  /** Foreign currencies alphabetical, then home. */
  rows: CashBalance[];
  /** Everything with a rate, in home minor units (left-over cash only: short balances count as 0); null with no home. */
  totalHome: number | null;
  /** Currencies with cash left but no saved rate (left out of totalHome), alphabetical. */
  missing: string[];
};

export function cashSummary(trip: Trip): CashSummary {
  const c = readCash(trip);
  const { budget, rates } = readSpending(trip);
  const home = budget?.currency ?? null;
  const rows = new Map<string, CashBalance>();
  const row = (currency: string) => {
    let r = rows.get(currency);
    if (!r) {
      r = { currency, amount: 0, start: 0, withdrawn: 0, exchangedIn: 0, exchangedOut: 0, counted: 0, spent: 0, home: null, short: false };
      rows.set(currency, r);
    }
    return r;
  };
  for (const s of c.start) row(s.currency).start += s.amount;
  for (const m of c.moves) {
    if (m.kind === 'withdrawal') row(m.currency).withdrawn += m.amount;
    else if (m.kind === 'exchange') {
      row(m.currency).exchangedOut += m.amount;
      row(m.toCurrency).exchangedIn += m.toAmount;
    } else row(m.currency).counted += m.amount;
  }
  for (const e of cashExpenses(trip)) row(e.currency).spent += e.amount;
  let totalHome = 0;
  const missing: string[] = [];
  for (const r of rows.values()) {
    r.amount = r.start + r.withdrawn + r.exchangedIn - r.exchangedOut + r.counted - r.spent;
    r.short = r.amount < 0;
    const rate = rateFor(r.currency, home, rates);
    if (home != null && rate != null) {
      r.home = convertMinor(r.amount, r.currency, rate, home);
      if (r.amount > 0) totalHome += r.home;
    } else if (home != null && r.amount > 0) missing.push(r.currency);
  }
  const list = [...rows.values()].sort((a, b) => (a.currency === home ? 1 : b.currency === home ? -1 : a.currency < b.currency ? -1 : 1));
  return { home, rows: list, totalHome: home == null ? null : totalHome, missing: missing.sort() };
}

/** Cash left in one currency (0 when none recorded). */
export const cashLeft = (trip: Trip, currency: string): number => cashSummary(trip).rows.find((r) => r.currency === currency)?.amount ?? 0;

// ---- withdrawal fees ----

export type FeeStats = {
  /** Withdrawals recorded, and how many have a fee typed (0 counts as a fee). */
  withdrawals: number;
  withFee: number;
  /** Average fee per withdrawal with a fee, in home minor units (fees with no rate left out); null with no home or none. */
  avgHome: number | null;
  /** Fees in total as a share of the cash they drew (both at the saved rate), e.g. 0.025; null when not computable. */
  share: number | null;
  /** Fees that couldn't be converted (no rate or no home), summed per currency. */
  unconverted: Money[];
};

export function feeStats(trip: Trip): FeeStats {
  const { moves } = readCash(trip);
  const { budget, rates } = readSpending(trip);
  const home = budget?.currency ?? null;
  const ws = moves.filter((m): m is CashWithdrawal => m.kind === 'withdrawal');
  const withFee = ws.filter((w) => w.fee !== undefined && w.feeCurrency !== undefined);
  let feeSum = 0;
  let n = 0;
  let shareFees = 0;
  let shareCash = 0;
  const un = new Map<string, number>();
  for (const w of withFee) {
    const fc = w.feeCurrency as string;
    const fee = w.fee as number;
    const fr = rateFor(fc, home, rates);
    if (home == null || fr == null) {
      un.set(fc, (un.get(fc) ?? 0) + fee);
      continue;
    }
    const feeHome = convertMinor(fee, fc, fr, home);
    feeSum += feeHome;
    n++;
    const cr = rateFor(w.currency, home, rates);
    if (cr != null) {
      shareFees += feeHome;
      shareCash += convertMinor(w.amount, w.currency, cr, home);
    }
  }
  return {
    withdrawals: ws.length,
    withFee: withFee.length,
    avgHome: n ? Math.round(feeSum / n) : null,
    share: shareCash > 0 ? shareFees / shareCash : null,
    unconverted: [...un].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => (a.currency < b.currency ? -1 : 1)),
  };
}

/** How the bank's rate compares with the saved one: 0.03 = the bank charged 3% more home money per unit. Null without both. */
export function bankRateGap(bankRate: number | undefined, savedRate: number | null): number | null {
  if (!isRate(bankRate) || savedRate == null || !isRate(savedRate)) return null;
  return Number((bankRate / savedRate - 1).toPrecision(10));
}

// ---- getting low ----

export type LowCash = {
  currency: string;
  balance: number;
  /** Cash-paid spending per day so far (minor units, rounded). */
  dailyAvg: number;
  /** Trip days still to come after today. */
  daysLeft: number;
  /** Whole days the cash lasts at that pace. */
  daysCovered: number;
  low: boolean;
};

/**
 * The pace of cash spending per currency during the trip (startDate <= today <= endDate), from cash-paid entries up to
 * today. Empty before or after the trip, or for currencies with no cash spending yet.
 */
export function cashPace(trip: Trip, today: LocalDate): LowCash[] {
  if (!isDay(today) || today < trip.startDate || today > trip.endDate) return [];
  const sofar = daysBetween(trip.startDate, today) + 1;
  const daysLeft = Math.max(0, daysBetween(today, trip.endDate));
  const spent = new Map<string, number>();
  for (const e of cashExpenses(trip)) if (e.day <= today) spent.set(e.currency, (spent.get(e.currency) ?? 0) + e.amount);
  const summary = cashSummary(trip);
  const out: LowCash[] = [];
  for (const r of summary.rows) {
    const s = spent.get(r.currency) ?? 0;
    if (s <= 0) continue;
    const dailyAvg = Math.max(1, Math.round(s / sofar));
    const balance = r.amount;
    const daysCovered = balance > 0 ? Math.floor(balance / dailyAvg) : 0;
    out.push({ currency: r.currency, balance, dailyAvg, daysLeft, daysCovered, low: daysLeft > 0 && balance < dailyAvg * daysLeft });
  }
  return out;
}

/** Only the currencies that are getting low. */
export const lowCash = (trip: Trip, today: LocalDate): LowCash[] => cashPace(trip, today).filter((x) => x.low);

// ---- leftover cash ----

export type LeftoverRow = { currency: string; amount: number; home: number | null; choice: LeftoverChoice | null; foreign: boolean };
export type Leftover = {
  /** True from the last day of the trip on, when any cash is left. */
  show: boolean;
  rows: LeftoverRow[];
  totalHome: number | null;
  missing: string[];
};

export function leftoverSummary(trip: Trip, today: LocalDate): Leftover {
  const s = cashSummary(trip);
  const { leftover } = readCash(trip);
  const rows = s.rows
    .filter((r) => r.amount > 0)
    .map((r) => {
      const foreign = r.currency !== s.home;
      const stored = leftover[r.currency] ?? null;
      return { currency: r.currency, amount: r.amount, home: r.home, choice: stored === 'exchange' && !foreign ? null : stored, foreign };
    });
  return { show: isDay(today) && today >= trip.endDate && rows.length > 0, rows, totalHome: s.totalHome, missing: s.missing };
}

/** The choices offered for a currency's leftover cash (no "exchange" for the home currency). */
export const leftoverChoicesFor = (currency: string, home: string | null): LeftoverChoice[] => (currency === home ? ['spend', 'keep'] : [...LEFTOVER_CHOICES]);

/** Sets (or with null, clears) what to do with a currency's leftover cash. */
export function setLeftoverChoice(trip: Trip, currency: string, choice: LeftoverChoice | null): Trip {
  if (!isCurrency(currency)) return trip;
  const c = readCash(trip);
  const home = readSpending(trip).budget?.currency ?? null;
  const leftover = { ...c.leftover };
  if (choice == null || !leftoverChoicesFor(currency, home).includes(choice)) delete leftover[currency];
  else leftover[currency] = choice;
  return writeCash(trip, { ...c, leftover });
}

// ---- starting cash ----

/** Sets the cash you set out with in a currency (minor units; null or 0 removes it). */
export function setStartCash(trip: Trip, currency: string, amount: number | null): Trip {
  if (!isCurrency(currency)) return trip;
  const c = readCash(trip);
  const start = c.start.filter((s) => s.currency !== currency);
  if (amount != null && isPos(amount)) start.push({ currency, amount });
  start.sort((a, b) => (a.currency < b.currency ? -1 : 1));
  return writeCash(trip, { ...c, start });
}

// ---- withdrawals and exchanges: the form ----

export type MoveKind = 'withdrawal' | 'exchange';
export type MoveDraft = {
  kind: MoveKind;
  day: LocalDate;
  currency: string;
  amount: string;
  fee: string;
  feeCurrency: string;
  bankRate: string;
  place: string;
  toCurrency: string;
  toAmount: string;
};
export type MoveError = 'amount' | 'currency' | 'day' | 'fee' | 'feeCurrency' | 'bankRate' | 'toCurrency' | 'toAmount' | 'same';

const clean = (s: string) => s.trim().toUpperCase();

export function newMoveDraft(kind: MoveKind, day: LocalDate, currency: string, home: string | null): MoveDraft {
  return { kind, day, currency, amount: '', fee: '', feeCurrency: home ?? currency, bankRate: '', place: '', toCurrency: '', toAmount: '' };
}

const text = (minor: number, currency: string): string => {
  const d = currencyDigits(currency);
  if (d === 0) return String(minor);
  const s = String(Math.abs(minor)).padStart(d + 1, '0');
  return `${s.slice(0, -d)}.${s.slice(-d)}`;
};

export function draftFromMove(m: CashWithdrawal | CashExchange, home: string | null): MoveDraft {
  if (m.kind === 'withdrawal') {
    return {
      kind: 'withdrawal',
      day: m.day,
      currency: m.currency,
      amount: text(m.amount, m.currency),
      fee: m.fee !== undefined && m.feeCurrency ? text(m.fee, m.feeCurrency) : '',
      feeCurrency: m.feeCurrency ?? home ?? m.currency,
      bankRate: m.bankRate !== undefined ? rateToText(m.bankRate) : '',
      place: m.place ?? '',
      toCurrency: '',
      toAmount: '',
    };
  }
  return { kind: 'exchange', day: m.day, currency: m.currency, amount: text(m.amount, m.currency), fee: '', feeCurrency: home ?? m.currency, bankRate: '', place: m.place ?? '', toCurrency: m.toCurrency, toAmount: text(m.toAmount, m.toCurrency) };
}

export function validateMove(d: MoveDraft): MoveError[] {
  const errors: MoveError[] = [];
  const cur = clean(d.currency);
  if (!isCurrency(cur)) errors.push('currency');
  if (parseAmount(d.amount, isCurrency(cur) ? cur : 'USD') == null) errors.push('amount');
  if (!isDay(d.day)) errors.push('day');
  if (d.kind === 'withdrawal') {
    if (d.fee.trim() !== '') {
      const fc = clean(d.feeCurrency);
      if (!isCurrency(fc)) errors.push('feeCurrency');
      else if (!/^0+([.,]0*)?$/.test(d.fee.trim()) && parseAmount(d.fee, fc) == null) errors.push('fee');
    }
    if (d.bankRate.trim() !== '' && parseRate(d.bankRate) == null) errors.push('bankRate');
  } else {
    const to = clean(d.toCurrency);
    if (!isCurrency(to)) errors.push('toCurrency');
    else if (to === cur) errors.push('same');
    if (parseAmount(d.toAmount, isCurrency(to) ? to : 'USD') == null) errors.push('toAmount');
  }
  return errors;
}

/** The move for a valid draft (call validateMove first); keeps the id, createdAt and unknown fields of the one edited. */
export function moveFromDraft(d: MoveDraft, id: string, prev?: CashMove, now = new Date().toISOString()): CashWithdrawal | CashExchange {
  const currency = clean(d.currency);
  const place = d.place.replace(/\s+/g, ' ').trim().slice(0, MAX_PLACE);
  const keep: Record<string, unknown> = {};
  const known = ['id', 'kind', 'day', 'currency', 'amount', 'fee', 'feeCurrency', 'bankRate', 'place', 'createdAt', 'toCurrency', 'toAmount'];
  if (prev) for (const [k, v] of Object.entries(prev)) if (!known.includes(k)) keep[k] = v;
  const base = { ...keep, id: prev?.id ?? id, day: d.day, currency, amount: parseAmount(d.amount, currency) ?? 0 };
  const tail = { ...(place ? { place } : {}), createdAt: prev?.createdAt ?? now };
  if (d.kind === 'withdrawal') {
    const fc = clean(d.feeCurrency);
    const feeText = d.fee.trim();
    const fee = feeText === '' ? undefined : /^0+([.,]0*)?$/.test(feeText) ? 0 : (parseAmount(feeText, fc) ?? undefined);
    const rate = d.bankRate.trim() === '' ? null : parseRate(d.bankRate);
    return { ...base, kind: 'withdrawal', ...(fee !== undefined ? { fee, feeCurrency: fc } : {}), ...(rate != null ? { bankRate: rate } : {}), ...tail } as CashWithdrawal;
  }
  const toCurrency = clean(d.toCurrency);
  return { ...base, kind: 'exchange', toCurrency, toAmount: parseAmount(d.toAmount, toCurrency) ?? 0, ...tail } as CashExchange;
}

/** The trip with this move added, or replacing the one with its id. */
export function upsertMove(trip: Trip, m: CashMove): Trip {
  if (!isCashMove(m)) return trip;
  const c = readCash(trip);
  const at = c.moves.findIndex((x) => x.id === m.id);
  const moves = at >= 0 ? c.moves.map((x, i) => (i === at ? m : x)) : [...c.moves, m];
  return writeCash(trip, { ...c, moves });
}

export function removeMove(trip: Trip, id: string): Trip {
  const c = readCash(trip);
  return writeCash(trip, { ...c, moves: c.moves.filter((m) => m.id !== id) });
}

/** Moves newest day first; within a day, the latest added first. */
export function sortMoves(moves: readonly CashMove[]): CashMove[] {
  return [...moves].sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : (b.createdAt ?? '') < (a.createdAt ?? '') ? -1 : (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : 0));
}

/**
 * Saves a counted total as the cash on hand in a currency: a 'count' move with the difference from the current
 * balance. Unchanged trip when the count already matches.
 */
export function recordCount(trip: Trip, currency: string, counted: number, id: string, day: LocalDate, now = new Date().toISOString()): Trip {
  if (!isCurrency(currency) || !isAmount0(counted) || !isDay(day)) return trip;
  const diff = counted - cashLeft(trip, currency);
  if (diff === 0) return trip;
  return upsertMove(trip, { id, kind: 'count', day, currency, amount: diff, createdAt: now });
}

/** Remembers the currency the counter opens with. */
export function setCountCurrency(trip: Trip, currency: string | null): Trip {
  const c = readCash(trip);
  return writeCash(trip, { ...c, local: currency && isCurrency(currency) ? currency : null });
}

// ---- tap to count: denominations ----

export type Denomination = { kind: 'note' | 'coin'; value: number };

/**
 * Common banknotes and coins in circulation, face values in minor units of the currency, largest first.
 * TO RE-CHECK: written from general knowledge on 2026-10-31 (not from each central bank's current list); rarely
 * used or withdrawn pieces are left out. Verify against the issuing central bank before relying on it, and add or
 * drop pieces as series change. Only used to total what the traveller counts; nothing is assumed about what they hold.
 */
const n = (...values: number[]): Denomination[] => values.map((value) => ({ kind: 'note', value }));
const k = (...values: number[]): Denomination[] => values.map((value) => ({ kind: 'coin', value }));
export const DENOMINATIONS_CHECKED = { status: 'to re-check', written: '2026-10-31' } as const;
export const DENOMINATIONS: Readonly<Record<string, readonly Denomination[]>> = {
  AUD: [...n(10000, 5000, 2000, 1000, 500), ...k(200, 100, 50, 20, 10, 5)],
  CAD: [...n(10000, 5000, 2000, 1000, 500), ...k(200, 100, 25, 10, 5)],
  CHF: [...n(100000, 20000, 10000, 5000, 2000, 1000), ...k(500, 200, 100, 50, 20, 10, 5)],
  CNY: [...n(10000, 5000, 2000, 1000, 500, 100), ...k(100, 50, 10)],
  EUR: [...n(20000, 10000, 5000, 2000, 1000, 500), ...k(200, 100, 50, 20, 10, 5, 2, 1)],
  GBP: [...n(5000, 2000, 1000, 500), ...k(200, 100, 50, 20, 10, 5, 2, 1)],
  HKD: [...n(100000, 50000, 10000, 5000, 2000, 1000), ...k(1000, 500, 200, 100, 50, 20, 10)],
  INR: [...n(50000, 20000, 10000, 5000, 2000, 1000), ...k(2000, 1000, 500, 200, 100)],
  JPY: [...n(10000, 5000, 2000, 1000), ...k(500, 100, 50, 10, 5, 1)],
  KRW: [...n(50000, 10000, 5000, 1000), ...k(500, 100, 50, 10)],
  MXN: [...n(100000, 50000, 20000, 10000, 5000, 2000), ...k(2000, 1000, 500, 200, 100, 50)],
  NZD: [...n(10000, 5000, 2000, 1000, 500), ...k(200, 100, 50, 20, 10)],
  SGD: [...n(10000, 5000, 1000, 500, 200), ...k(100, 50, 20, 10, 5)],
  THB: [...n(100000, 50000, 10000, 5000, 2000), ...k(1000, 500, 200, 100, 50, 25)],
  USD: [...n(10000, 5000, 2000, 1000, 500, 200, 100), ...k(100, 50, 25, 10, 5, 1)],
};

/** The denominations for a currency, or null when the table has none (the counter then isn't offered). */
export const denominationsFor = (currency: string | null | undefined): readonly Denomination[] | null =>
  typeof currency === 'string' && Object.prototype.hasOwnProperty.call(DENOMINATIONS, currency) ? DENOMINATIONS[currency] : null;

/** Counts are keyed "note:1000" / "coin:100". */
export const denomKey = (d: Denomination) => `${d.kind}:${d.value}`;
export type Counts = Record<string, number>;

/** The counts after tapping +1 / -1 (or any step), kept between 0 and MAX_PIECES; zero counts are dropped. */
export function bumpCount(counts: Counts, key: string, delta: number): Counts {
  const next = Math.min(MAX_PIECES, Math.max(0, (Number.isSafeInteger(counts[key]) ? counts[key] : 0) + Math.trunc(delta)));
  const { [key]: _old, ...rest } = counts;
  return next ? { ...rest, [key]: next } : rest;
}

export type CountTotal = { total: number; notes: number; coins: number; pieces: number };

/** Notes and coins counted in a currency, in minor units. Keys not in the table, or bad counts, are ignored. */
export function countTotal(currency: string, counts: Counts): CountTotal {
  const out: CountTotal = { total: 0, notes: 0, coins: 0, pieces: 0 };
  for (const d of denominationsFor(currency) ?? []) {
    const c = counts[denomKey(d)];
    if (!Number.isSafeInteger(c) || c <= 0) continue;
    const pieces = Math.min(c, MAX_PIECES);
    const sum = d.value * pieces;
    if (d.kind === 'note') out.notes += sum;
    else out.coins += sum;
    out.pieces += pieces;
  }
  out.total = out.notes + out.coins;
  return out;
}

/**
 * The currency the counter opens with: the remembered one, else the first trip country's currency (from the
 * bookings' zones, src/core/countrycurrency.ts) that the table covers, else the first foreign currency with cash,
 * else the home currency when covered, else the first in the table.
 */
export function countCurrencyFor(trip: Trip): string {
  const c = readCash(trip);
  if (c.local && denominationsFor(c.local)) return c.local;
  const home = readSpending(trip).budget?.currency ?? null;
  for (const code of arrivalCountryList(trip)) if (code !== home && denominationsFor(code)) return code;
  for (const r of cashSummary(trip).rows) if (r.currency !== home && denominationsFor(r.currency)) return r.currency;
  if (home && denominationsFor(home)) return home;
  return Object.keys(DENOMINATIONS)[0];
}

/** Currencies for the counter's picker: the opening one, ones with cash, then the rest of the table. */
export function countCurrencies(trip: Trip): string[] {
  const out: string[] = [];
  const add = (x: string) => {
    if (denominationsFor(x) && !out.includes(x)) out.push(x);
  };
  add(countCurrencyFor(trip));
  for (const r of cashSummary(trip).rows) add(r.currency);
  for (const x of Object.keys(DENOMINATIONS)) add(x);
  return out;
}

/** Currencies for the move form's quick picks: trip-country currencies, ones with cash, home, rates. */
export function cashCurrencyChoices(trip: Trip, max = 8): string[] {
  const out: string[] = [];
  const add = (x: string | null | undefined) => {
    if (x && isCurrency(x) && !out.includes(x)) out.push(x);
  };
  const s = readSpending(trip);
  for (const code of arrivalCountryList(trip)) add(code);
  for (const r of cashSummary(trip).rows) add(r.currency);
  for (const code of Object.keys(s.rates).sort()) add(code);
  add(s.budget?.currency);
  return out.slice(0, max);
}

/** The currency a new withdrawal starts in: the first trip-country currency, else the first foreign with cash, else home, else ''. */
export function suggestCashCurrency(trip: Trip): string {
  const choices = cashCurrencyChoices(trip);
  const home = readSpending(trip).budget?.currency ?? null;
  return choices.find((x) => x !== home) ?? home ?? '';
}

/** Currencies of the countries the trip's bookings visit (home country left out), in visiting order. */
export function arrivalCountryList(trip: Trip): string[] {
  const out: string[] = [];
  let countries: { iso2: string }[] = [];
  try {
    countries = tripCountries(trip, homeCountryFor(trip, null));
  } catch {
    countries = [];
  }
  for (const c of countries) {
    const row = currencyForCountry(c.iso2);
    if (row) for (const code of currenciesOf(row)) if (!out.includes(code)) out.push(code);
  }
  return out;
}

// ---- which trip the Wallet card shows ----

/** The trip in progress or next up, else the latest-ended trip with cash recorded; null when neither. */
export function cashTripFor(trips: readonly Trip[], today: LocalDate): Trip | null {
  const live = trips.filter((t) => t.endDate >= today).sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  if (live[0]) return live[0];
  const past = trips.filter((t) => hasCash(t)).sort((a, b) => (a.endDate < b.endDate ? 1 : -1));
  return past[0] ?? null;
}

// ---- .satchel files ----

/**
 * The cash field of a trip in a .satchel file, made safe: unreadable rows are dropped (never the trip), a field with
 * nothing usable left is removed. Valid rows keep fields this build doesn't know.
 */
export function cleanFileCash<T extends Record<string, unknown>>(t: T): T {
  if (!('cash' in t)) return t;
  const { cash: _c, ...rest } = t;
  const cleaned = writeCash({ ...(rest as unknown as Trip), cash: t.cash as TripCash }, readCash({ cash: t.cash as TripCash }));
  return cleaned as unknown as T;
}

/** Cash for an imported trip: moves get new ids, cash-paid marks follow their expenses' new ids (others dropped). */
export function importCash(cash: TripCash | undefined, expenseIds: ReadonlyMap<string, string>, newId: (prefix: string) => string): TripCash | undefined {
  if (!cash) return undefined;
  const c = readCash({ cash });
  const paid = new Set<string>();
  for (const id of c.paid) {
    const to = expenseIds.get(id);
    if (to) paid.add(to);
  }
  const moved = writeCash({ cash } as Trip, { ...c, moves: c.moves.map((m) => ({ ...m, id: newId('cash') })), paid });
  return moved.cash;
}
