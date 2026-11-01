// T105 Tipping and service guide + tip calculator. Pure TypeScript, all on the phone.
//
// The table: per country, what is usual for restaurants, cafes / bars, taxis, hotel staff and guides, and whether a
// service charge is usually already on the bill. Each norm is a short code read by parseNorm:
//   'no'      not expected
//   'off'     can cause offence (or confusion): best not to
//   'up'      round up / leave the small change
//   'small'   a small note or coin (porters, housekeeping, guides: per bag, night or day, not a share of a bill)
//   'oN'      not expected, about N% for very good service
//   'pN' / 'pA-B'  about N% / A-B% of the bill
// GENERAL GUIDANCE ONLY - customs vary by place, venue and service, and change. Written from general knowledge on
// TIPPING_CHECKED (not from a survey); rows with `recheck: true` are the ones the build was least sure of and must be
// re-checked before relying on them (the screen marks them). The screen always shows "General guidance only - customs
// vary, check locally".
//
// The calculator: a bill in integer minor units of its own currency (spending.ts currencyDigits: JPY 0, USD 2,
// KWD 3), a preset from the country's norm (none / round up / low / typical / generous) or a custom percent, a
// "service already included" switch that zeroes the tip, an optional round-up of the total to a sensible local step
// (a banknote or coin from cash.ts DENOMINATIONS where the table has the currency), and a split between N people
// whose shares add up exactly (together.ts apportion: the first people pay the odd minor units). Home values only
// with a saved rate (convert.ts convertFor); "Add to spending" makes an expense of the total, tip included.
import { apportion, ME, withSplit } from './together.ts';
import { denominationsFor } from './cash.ts';
import { convertFor } from './convert.ts';
import { currencyDigits, isCategory, isCurrency, MAX_MINOR, minorToText } from './spending.ts';
import type { Expense, ExpenseCategory, LocalDate } from './model.ts';

export const TIPPING_CHECKED = '2026-10-31';

export const SERVICES = ['restaurant', 'cafe', 'taxi', 'hotel', 'guide'] as const;
export type TipService = (typeof SERVICES)[number];
/** Is a service charge usually already on a restaurant bill? */
export const SERVICE_CHARGE = ['usual', 'sometimes', 'rare'] as const;
export type ServiceCharge = (typeof SERVICE_CHARGE)[number];

export type NormCode = 'no' | 'off' | 'up' | 'small' | `o${number}` | `p${number}` | `p${number}-${number}`;
export type TipRow = {
  iso2: string;
  restaurant: NormCode;
  cafe: NormCode;
  taxi: NormCode;
  hotel: NormCode;
  guide: NormCode;
  service: ServiceCharge;
  /** ISO YYYY-MM-DD. */
  checked: string;
  /** True when the row needs re-checking before it is relied on. */
  recheck: boolean;
};

const R = (iso2: string, restaurant: NormCode, cafe: NormCode, taxi: NormCode, hotel: NormCode, guide: NormCode, service: ServiceCharge, recheck = false): TipRow => ({
  iso2,
  restaurant,
  cafe,
  taxi,
  hotel,
  guide,
  service,
  checked: TIPPING_CHECKED,
  recheck,
});

/** General guidance only. Columns: restaurant, cafe / bar, taxi, hotel staff, guide, service charge on the bill. */
export const TIPPING: readonly TipRow[] = [
  // Americas
  R('US', 'p15-20', 'small', 'p15-20', 'small', 'p10-20', 'rare'),
  R('CA', 'p15-20', 'small', 'p10-15', 'small', 'p10-15', 'rare'),
  R('MX', 'p10-15', 'p10', 'no', 'small', 'p10-15', 'sometimes'),
  R('GT', 'p10', 'up', 'no', 'small', 'small', 'sometimes', true),
  R('CR', 'up', 'no', 'no', 'small', 'small', 'usual'),
  R('PA', 'p10', 'up', 'no', 'small', 'small', 'sometimes', true),
  R('CO', 'p10', 'up', 'no', 'small', 'small', 'usual'),
  R('EC', 'up', 'no', 'no', 'small', 'small', 'usual', true),
  R('PE', 'p10', 'up', 'no', 'small', 'small', 'sometimes', true),
  R('BR', 'up', 'no', 'up', 'small', 'small', 'usual'),
  R('AR', 'p10', 'up', 'up', 'small', 'small', 'rare', true),
  R('CL', 'p10', 'up', 'no', 'small', 'small', 'sometimes'),
  R('UY', 'p10', 'up', 'up', 'small', 'small', 'rare', true),
  R('DO', 'p10', 'up', 'no', 'small', 'small', 'usual', true),
  R('JM', 'p10-15', 'up', 'p10', 'small', 'small', 'sometimes', true),
  // Europe
  R('GB', 'p10-15', 'no', 'up', 'small', 'small', 'sometimes'),
  R('IE', 'p10-15', 'no', 'up', 'small', 'small', 'sometimes'),
  R('FR', 'up', 'up', 'up', 'small', 'small', 'usual'),
  R('BE', 'up', 'up', 'up', 'small', 'small', 'usual'),
  R('NL', 'p5-10', 'up', 'up', 'small', 'small', 'rare'),
  R('LU', 'up', 'up', 'up', 'small', 'small', 'usual', true),
  R('DE', 'p5-10', 'up', 'up', 'small', 'small', 'rare'),
  R('AT', 'p5-10', 'up', 'up', 'small', 'small', 'rare'),
  R('CH', 'up', 'up', 'up', 'small', 'small', 'usual'),
  R('IT', 'up', 'no', 'up', 'small', 'small', 'sometimes'),
  R('ES', 'p5-10', 'up', 'up', 'small', 'small', 'rare'),
  R('PT', 'p5-10', 'up', 'up', 'small', 'small', 'rare'),
  R('MT', 'p5-10', 'up', 'up', 'small', 'small', 'rare', true),
  R('GR', 'p5-10', 'up', 'up', 'small', 'small', 'rare'),
  R('CY', 'p5-10', 'up', 'up', 'small', 'small', 'sometimes', true),
  R('DK', 'up', 'no', 'no', 'no', 'small', 'usual'),
  R('SE', 'up', 'no', 'up', 'no', 'small', 'usual'),
  R('NO', 'up', 'no', 'up', 'no', 'small', 'usual'),
  R('FI', 'up', 'no', 'no', 'no', 'small', 'usual'),
  R('IS', 'no', 'no', 'no', 'no', 'no', 'usual'),
  R('PL', 'p10', 'up', 'up', 'small', 'small', 'rare'),
  R('CZ', 'p10', 'up', 'up', 'small', 'small', 'rare'),
  R('SK', 'p5-10', 'up', 'up', 'small', 'small', 'rare', true),
  R('HU', 'p10-15', 'up', 'p10', 'small', 'small', 'sometimes'),
  R('SI', 'p5-10', 'up', 'up', 'small', 'small', 'rare', true),
  R('HR', 'p10', 'up', 'up', 'small', 'small', 'rare'),
  R('RO', 'p10', 'up', 'up', 'small', 'small', 'rare', true),
  R('BG', 'p10', 'up', 'up', 'small', 'small', 'rare', true),
  R('EE', 'p5-10', 'up', 'up', 'no', 'small', 'rare', true),
  R('LV', 'p10', 'up', 'up', 'small', 'small', 'rare', true),
  R('LT', 'p10', 'up', 'up', 'small', 'small', 'rare', true),
  R('TR', 'p5-10', 'up', 'up', 'small', 'small', 'sometimes'),
  // Middle East and Africa
  R('IL', 'p10-15', 'up', 'no', 'small', 'small', 'sometimes'),
  R('JO', 'up', 'up', 'up', 'small', 'small', 'usual', true),
  R('AE', 'p10-15', 'up', 'up', 'small', 'small', 'sometimes', true),
  R('QA', 'p10', 'up', 'up', 'small', 'small', 'sometimes', true),
  R('SA', 'p10', 'up', 'up', 'small', 'small', 'rare', true),
  R('EG', 'p5-10', 'small', 'up', 'small', 'small', 'usual', true),
  R('MA', 'p5-10', 'up', 'up', 'small', 'small', 'rare', true),
  R('TN', 'p10', 'up', 'up', 'small', 'small', 'rare', true),
  R('ZA', 'p10-15', 'p10', 'p10', 'small', 'small', 'rare'),
  R('KE', 'p10', 'up', 'up', 'small', 'small', 'sometimes', true),
  R('TZ', 'p5-10', 'up', 'up', 'small', 'small', 'rare', true),
  // Asia and the Pacific
  R('JP', 'off', 'no', 'no', 'no', 'no', 'sometimes'),
  R('KR', 'no', 'no', 'no', 'no', 'no', 'sometimes'),
  R('CN', 'no', 'no', 'no', 'small', 'small', 'sometimes', true),
  R('HK', 'up', 'no', 'up', 'small', 'small', 'usual'),
  R('TW', 'no', 'no', 'up', 'small', 'small', 'sometimes', true),
  R('SG', 'no', 'no', 'no', 'small', 'small', 'usual'),
  R('MY', 'up', 'no', 'up', 'small', 'small', 'sometimes', true),
  R('TH', 'up', 'up', 'up', 'small', 'small', 'sometimes'),
  R('VN', 'up', 'no', 'up', 'small', 'small', 'sometimes', true),
  R('KH', 'up', 'no', 'up', 'small', 'small', 'rare', true),
  R('ID', 'up', 'no', 'up', 'small', 'small', 'usual', true),
  R('PH', 'up', 'no', 'up', 'small', 'small', 'usual', true),
  R('IN', 'p10', 'up', 'up', 'small', 'small', 'sometimes'),
  R('NP', 'up', 'up', 'up', 'small', 'small', 'usual', true),
  R('LK', 'up', 'up', 'up', 'small', 'small', 'usual', true),
  R('AU', 'o10', 'no', 'no', 'no', 'no', 'rare'),
  R('NZ', 'o10', 'no', 'no', 'no', 'no', 'rare'),
  R('FJ', 'no', 'no', 'no', 'no', 'no', 'rare', true),
];

export const findTipping = (iso2: string | null | undefined): TipRow | null => {
  const code = typeof iso2 === 'string' ? iso2.trim().toUpperCase() : '';
  return TIPPING.find((r) => r.iso2 === code) ?? null;
};
export const hasTipping = (iso2: string | null | undefined): boolean => findTipping(iso2) !== null;

// ---------------------------------------------------------------- norms

export type Norm =
  | { kind: 'none' }
  | { kind: 'offence' }
  | { kind: 'roundup' }
  | { kind: 'small' }
  | { kind: 'optional'; percent: number }
  | { kind: 'percent'; low: number; high: number };

/** Largest percent a norm, preset or custom tip may use. */
export const MAX_TIP_PERCENT = 100;

/** The norm a code stands for, or null when the code is malformed. */
export function parseNorm(code: unknown): Norm | null {
  if (code === 'no') return { kind: 'none' };
  if (code === 'off') return { kind: 'offence' };
  if (code === 'up') return { kind: 'roundup' };
  if (code === 'small') return { kind: 'small' };
  if (typeof code !== 'string') return null;
  const o = /^o(\d{1,2})$/.exec(code);
  if (o) {
    const p = Number(o[1]);
    return p > 0 ? { kind: 'optional', percent: p } : null;
  }
  const m = /^p(\d{1,2})(?:-(\d{1,2}))?$/.exec(code);
  if (!m) return null;
  const low = Number(m[1]);
  const high = m[2] === undefined ? low : Number(m[2]);
  return low > 0 && high >= low && high <= MAX_TIP_PERCENT ? { kind: 'percent', low, high } : null;
}

/** Everything wrong with a row; empty means it may be shown. */
export function tipRowProblems(row: TipRow): string[] {
  const out: string[] = [];
  if (!/^[A-Z]{2}$/.test(String(row.iso2))) out.push('iso2');
  for (const s of SERVICES) if (!parseNorm(row[s])) out.push(s);
  if (!(SERVICE_CHARGE as readonly string[]).includes(row.service)) out.push('service');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.checked)) || Number.isNaN(Date.parse(`${row.checked}T00:00:00Z`))) out.push('checked');
  if (typeof row.recheck !== 'boolean') out.push('recheck');
  return out;
}

/** The norm for one service in a country (null when the country isn't covered). */
export const normFor = (iso2: string | null | undefined, service: TipService): Norm | null => {
  const row = findTipping(iso2);
  return row ? parseNorm(row[service]) : null;
};

// ---------------------------------------------------------------- presets

export const PRESETS = ['none', 'roundup', 'low', 'typical', 'generous'] as const;
export type Preset = (typeof PRESETS)[number];
export type PresetChoice = { preset: Preset; percent: number | null };

/** Generous when a norm gives one figure: that figure plus this. */
const GENEROUS_EXTRA = 5;

/**
 * The presets a norm offers, in PRESETS order. "None" and "Round up" are always there; percentages only where the
 * norm has them: a range gives low / typical (its middle, to the half percent) / generous (its top, or +5 when it is
 * one figure); "about N% for great service" gives typical N; "a small amount" gives low 5 and typical 10; "round up"
 * gives low 5. "Not expected" and "can cause offence" give no percentages (a custom percent is still possible).
 */
export function presetsFor(norm: Norm): PresetChoice[] {
  const out: PresetChoice[] = [
    { preset: 'none', percent: 0 },
    { preset: 'roundup', percent: null },
  ];
  if (norm.kind === 'percent') {
    out.push({ preset: 'low', percent: norm.low });
    out.push({ preset: 'typical', percent: Math.round(norm.low + norm.high) / 2 });
    out.push({ preset: 'generous', percent: Math.min(MAX_TIP_PERCENT, norm.high > norm.low ? norm.high : norm.high + GENEROUS_EXTRA) });
  } else if (norm.kind === 'optional') {
    out.push({ preset: 'typical', percent: norm.percent });
  } else if (norm.kind === 'small') {
    out.push({ preset: 'low', percent: 5 });
    out.push({ preset: 'typical', percent: 10 });
  } else if (norm.kind === 'roundup') {
    out.push({ preset: 'low', percent: 5 });
  }
  return out;
}

/** The preset the calculator opens on for a norm. */
export function defaultPreset(norm: Norm): Preset {
  switch (norm.kind) {
    case 'percent':
      return 'typical';
    case 'roundup':
      return 'roundup';
    case 'small':
      return 'low';
    default:
      return 'none';
  }
}

// ---------------------------------------------------------------- round-up steps

/**
 * A sensible amount to round a total up to, in minor units. TO RE-CHECK with DENOMINATIONS: each is a banknote or
 * coin of the currency in src/core/cash.ts where that table lists it (tested), else a well-known small unit.
 */
const ROUND_STEPS: Readonly<Record<string, number>> = {
  AUD: 100, CAD: 100, CHF: 100, CNY: 100, EUR: 100, GBP: 100, HKD: 1000, INR: 1000, JPY: 100, KRW: 1000, MXN: 1000,
  NZD: 100, SGD: 100, THB: 1000, USD: 100,
  // Not in the denomination table: one of the common small notes or coins.
  BRL: 100, CZK: 1000, HUF: 10000, IDR: 100000, ISK: 100, PLN: 100, TRY: 1000, VND: 10000, ZAR: 1000, CLP: 100,
  COP: 100000, PHP: 1000, MYR: 100, TWD: 1000, ARS: 10000, DKK: 100, SEK: 100, NOK: 100,
};

/**
 * T108: curated steps written from general knowledge, not checked against the issuing central bank's current notes
 * and coins (no cash-table row for them yet). The screen says "check this step locally" next to the round-up switch.
 * Take a code out only once its step has been checked against the central bank's published denominations.
 */
export const ROUND_STEP_RECHECK: readonly string[] = ['BRL', 'HUF', 'IDR', 'VND'];

/** True when roundStep(currency) is a curated step still marked to re-check (and the cash table doesn't settle it). */
export function roundStepNeedsRecheck(currency: string): boolean {
  if (!ROUND_STEP_RECHECK.includes(currency)) return false;
  const denoms = denominationsFor(currency);
  return !(denoms && denoms.some((d) => d.value === roundStep(currency)));
}

/**
 * The round-up step for a currency: the curated step when it is one of the currency's listed notes or coins (or the
 * table has none for it), else the smallest listed note; with no curated step, one whole unit (100 for currencies
 * without decimals, where one unit is usually worth very little).
 */
export function roundStep(currency: string): number {
  const denoms = denominationsFor(currency);
  const curated = Object.prototype.hasOwnProperty.call(ROUND_STEPS, currency) ? ROUND_STEPS[currency] : null;
  if (denoms && denoms.length) {
    if (curated != null && denoms.some((d) => d.value === curated)) return curated;
    const notes = denoms.filter((d) => d.kind === 'note').map((d) => d.value);
    return notes.length ? Math.min(...notes) : Math.max(...denoms.map((d) => d.value));
  }
  if (curated != null) return curated;
  const digits = currencyDigits(currency);
  return digits === 0 ? 100 : 10 ** digits;
}

/** `amount` rounded up to the next multiple of `step` (unchanged when it already is one). */
export function ceilTo(amount: number, step: number): number {
  if (!(step > 0)) return amount;
  return Math.ceil(amount / step) * step;
}

// ---------------------------------------------------------------- calculator

export const MIN_SPLIT = 1;
export const MAX_SPLIT = 20;

export type TipMode = Preset | 'custom';
export type TipInput = {
  /** Bill in minor units of `currency`; null when the field doesn't read as an amount. */
  bill: number | null;
  currency: string;
  norm: Norm;
  mode: TipMode;
  /** The typed percent, for mode 'custom'. */
  customPercent?: number | null;
  /** Service already on the bill: the tip is zero. */
  included: boolean;
  /** Round the total (bill + tip) up to roundStep(currency). */
  roundUp: boolean;
  /** How many people pay, 1-20. */
  people: number;
};
export type TipError = 'amount' | 'currency' | 'percent' | 'people';
export type TipResult = {
  bill: number;
  /** The percent used (null for none, round up and service included). */
  percent: number | null;
  tip: number;
  total: number;
  step: number;
  /** True when the total was rounded up to the step. */
  rounded: boolean;
  /** One per person, largest first; they add up to `total` and differ by at most one minor unit. */
  shares: number[];
  /** How many people pay one extra minor unit. */
  extra: number;
  /** True when the service switch zeroed the tip. */
  included: boolean;
};

/** Percent for a mode under a norm, or null when that mode has no percent there (the screen hides it). */
export function percentFor(norm: Norm, mode: TipMode, custom?: number | null): number | null {
  if (mode === 'custom') return typeof custom === 'number' && Number.isFinite(custom) && custom >= 0 && custom <= MAX_TIP_PERCENT ? custom : null;
  return presetsFor(norm).find((p) => p.preset === mode)?.percent ?? null;
}

/** Tip of `percent` on `bill` minor units, rounded half up (same as the bill splitter's tipFor). */
export function tipOn(bill: number, percent: number): number {
  return Math.round(Number(((bill * percent) / 100).toPrecision(12)));
}

export function calcTip(input: TipInput): { ok: true; result: TipResult } | { ok: false; errors: TipError[] } {
  const errors: TipError[] = [];
  const { bill, currency, people } = input;
  if (bill == null || !Number.isSafeInteger(bill) || bill <= 0 || bill > MAX_MINOR) errors.push('amount');
  if (!isCurrency(currency)) errors.push('currency');
  if (!Number.isInteger(people) || people < MIN_SPLIT || people > MAX_SPLIT) errors.push('people');
  const pct = input.mode === 'none' || input.mode === 'roundup' ? null : percentFor(input.norm, input.mode, input.customPercent);
  if (!input.included && input.mode !== 'none' && input.mode !== 'roundup' && pct == null) errors.push('percent');
  if (errors.length || bill == null) return { ok: false, errors };

  const step = roundStep(currency);
  let total = bill;
  let percent: number | null = null;
  let rounded = false;
  if (!input.included) {
    if (input.mode === 'roundup') {
      total = ceilTo(bill, step);
      rounded = total !== bill;
    } else if (pct != null && input.mode !== 'none') {
      percent = pct;
      total = bill + tipOn(bill, pct);
      if (input.roundUp) {
        const up = ceilTo(total, step);
        rounded = up !== total;
        total = up;
      }
    }
    // "None" leaves no tip even with round-up on.
  }
  if (total > MAX_MINOR) return { ok: false, errors: ['amount'] };
  const shares = apportion(total, Array.from({ length: people }, () => 1));
  const extra = total % people;
  return { ok: true, result: { bill, percent, tip: total - bill, total, step, rounded, shares, extra, included: input.included } };
}

/** The tip, total and one share in the home currency at the saved rate; null when there is no home or no rate. */
export function tipHome(r: TipResult, currency: string, home: string | null, rates: Record<string, number>): { tip: number; total: number; share: number } | null {
  if (!home) return null;
  const tip = convertFor(r.tip, currency, home, rates, 'toHome');
  const total = convertFor(r.total, currency, home, rates, 'toHome');
  const share = convertFor(r.shares[0], currency, home, rates, 'toHome');
  return tip == null || total == null || share == null ? null : { tip, total, share };
}

// ---------------------------------------------------------------- add to spending

/** Where a tip lands in Spending when nothing else says: food for meals and drinks, transport, stay, activities. */
export const SERVICE_CATEGORY: Readonly<Record<TipService, ExpenseCategory>> = {
  restaurant: 'food',
  cafe: 'food',
  taxi: 'transport',
  hotel: 'stay',
  guide: 'activities',
};

/** The expense category: the one the screen was opened from (an expense form), else the service's. */
export const categoryFor = (service: TipService, context?: unknown): ExpenseCategory => (isCategory(context) ? context : SERVICE_CATEGORY[service]);

export type TipExpenseOpts = {
  currency: string;
  day: LocalDate;
  id: string;
  category: ExpenseCategory;
  note?: string;
  /**
   * Who shares it: companion ids (ME included) for an equal split recorded in Travelling together, which keeps the
   * whole total; or 'mine' to record only your share (split between N people who aren't on the trip); or undefined
   * for the whole total, yours alone.
   */
  split?: readonly string[] | 'mine';
  now?: string;
};

/** The expense "Add to spending" saves: the bill with the tip included (or your share of it). */
export function tipExpense(r: TipResult, o: TipExpenseOpts): Expense {
  const note = (o.note ?? '').trim().slice(0, 200);
  const base: Expense = {
    id: o.id,
    amount: o.split === 'mine' ? r.shares[0] : r.total,
    currency: o.currency,
    category: o.category,
    day: o.day,
    ...(note ? { note } : {}),
    createdAt: o.now ?? new Date().toISOString(),
  };
  if (Array.isArray(o.split) && o.split.length > 1) {
    const people = [...new Set(o.split)];
    return withSplit(base, ME, { mode: 'equal', parts: people.map((person) => ({ person, value: 1 })) });
  }
  return base;
}

// ---------------------------------------------------------------- back to an open expense form (T108)

/** What "Use this total" hands back to the expense form that opened the calculator. */
export type TipFill = { amount: string; currency: string };

/** The tip-included total (or your share of it) as the expense form's amount text, in the calculator's currency. */
export function tipFill(r: TipResult, currency: string, which: 'total' | 'mine' = 'total'): TipFill | null {
  if (!isCurrency(currency)) return null;
  const minor = which === 'mine' ? r.shares[0] : r.total;
  if (!(typeof minor === 'number' && Number.isSafeInteger(minor) && minor > 0)) return null;
  return { amount: minorToText(minor, currency), currency };
}

/** The open form's draft with the filled amount and currency; category, day and note stay as the traveller left them. */
export function applyTipFill<D extends { amount: string; currency: string }>(draft: D, fill: TipFill): D {
  return { ...draft, amount: fill.amount, currency: fill.currency };
}

// ---------------------------------------------------------------- which country

/** The first candidate (current trip stop, home, a passed country) that the table covers; null means "pick one". */
export function pickTipCountry(candidates: readonly (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    const row = findTipping(c);
    if (row) return row.iso2;
  }
  return null;
}

/** Search results (src/core/emergency.ts searchCountries, the list Settings and essentials use) kept to covered countries. */
export const coveredOnly = <T extends { iso2: string }>(rows: readonly T[]): T[] => rows.filter((r) => hasTipping(r.iso2));
