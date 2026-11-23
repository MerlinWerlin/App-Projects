/**
 * Units and number formatting. Every calculation in src/core works in millimetres, degrees and kilograms;
 * only the screens convert to and from inches / pounds.
 * 1 in = 25.4 mm exactly (International yard and pound agreement, 1959; NIST SP 811 appendix B).
 * 1 lb = 0.45359237 kg exactly (same agreement).
 */
export type UnitSystem = 'metric' | 'imperial';

export const MM_PER_IN = 25.4;
export const KG_PER_LB = 0.45359237;
export const DEG = Math.PI / 180;

export function toMm(value: number, units: UnitSystem): number {
  return units === 'imperial' ? value * MM_PER_IN : value;
}
export function fromMm(mm: number, units: UnitSystem): number {
  return units === 'imperial' ? mm / MM_PER_IN : mm;
}

/** Parses a typed number. Accepts "12.5", "12,5", "3 1/2", "1/4" and a leading minus. NaN for anything else. */
export function parseNum(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  if (raw == null) return NaN;
  const s = String(raw).trim().replace(',', '.');
  if (s === '') return NaN;
  const mixed = /^(-?)(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) {
    const den = Number(mixed[4]);
    if (den === 0) return NaN;
    const v = Number(mixed[2]) + Number(mixed[3]) / den;
    return mixed[1] ? -v : v;
  }
  const frac = /^(-?)(\d+)\/(\d+)$/.exec(s);
  if (frac) {
    const den = Number(frac[3]);
    if (den === 0) return NaN;
    const v = Number(frac[2]) / den;
    return frac[1] ? -v : v;
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

/** Rounds away float noise (e.g. 0.1 + 0.2) before display. */
export function round(v: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((v + Number.EPSILON * Math.sign(v)) * f) / f;
}

export function fmt(v: number, dp = 1): string {
  if (!Number.isFinite(v)) return '–';
  const r = round(v, dp);
  return (Object.is(r, -0) ? 0 : r).toFixed(dp);
}

/** Nearest 1/16 inch as a tape-measure string, e.g. 3.53 -> "3 1/2". */
export function inchFraction(inches: number, denominator = 16): string {
  if (!Number.isFinite(inches)) return '–';
  const neg = inches < 0;
  let whole = Math.floor(Math.abs(inches));
  let num = Math.round((Math.abs(inches) - whole) * denominator);
  if (num === denominator) { whole += 1; num = 0; }
  let den = denominator;
  while (num > 0 && num % 2 === 0) { num /= 2; den /= 2; }
  const body = num === 0 ? `${whole}` : whole === 0 ? `${num}/${den}` : `${whole} ${num}/${den}`;
  return (neg && (whole > 0 || num > 0) ? '-' : '') + body;
}

/** A length for display: "123.5 mm" or `4.862 in (4 7/8")`. */
/** fmt with thousands separators for display only (12,345.6). Never written back into an input field. */
export function fmtGrouped(v: number, dp = 1): string {
  const s = fmt(v, dp);
  const [int, dec] = s.split('.');
  const neg = int.startsWith('-');
  const digits = neg ? int.slice(1) : int;
  if (digits.length < 5) return s;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${grouped}${dec !== undefined ? `.${dec}` : ''}`;
}

export function len(mm: number, units: UnitSystem, dp = 1): string {
  if (!Number.isFinite(mm)) return '–';
  if (units === 'imperial') {
    const inches = mm / MM_PER_IN;
    return `${fmtGrouped(inches, 3)} in (${inchFraction(inches)}")`;
  }
  return `${fmtGrouped(mm, dp)} mm`;
}

/** Short length (no fraction), for tables. */
export function lenShort(mm: number, units: UnitSystem, dp = 1): string {
  return units === 'imperial' ? fmt(mm / MM_PER_IN, 3) : fmt(mm, dp);
}

export function unitLabel(units: UnitSystem): string {
  return units === 'imperial' ? 'in' : 'mm';
}

export function mass(kg: number, units: UnitSystem): string {
  if (!Number.isFinite(kg)) return '–';
  if (units === 'imperial') return `${fmtGrouped(kg / KG_PER_LB, kg / KG_PER_LB < 10 ? 2 : 1)} lb`;
  return `${fmtGrouped(kg, kg < 10 ? 2 : 1)} kg`;
}

/** One line of the "show the working" list on every result. */
export interface Step {
  label: string;
  /** The formula as written, e.g. "A = z² / 2" */
  formula?: string;
  /** The formula with the numbers put in and the result, e.g. "6² / 2 = 18.0 mm²" */
  value: string;
}

export type Result<T> = { ok: true; value: T; steps: Step[]; warnings: string[] } | { ok: false; error: string };

export function fail<T>(error: string): Result<T> {
  return { ok: false, error };
}

export function positive(name: string, v: number): string | null {
  if (!Number.isFinite(v)) return `Enter ${name}.`;
  if (v <= 0) return `${name[0].toUpperCase()}${name.slice(1)} must be more than 0.`;
  return null;
}
