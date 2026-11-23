/**
 * Number input and output helpers shared by every calculator.
 * Pure TypeScript (no React Native) so it runs under `node --test`.
 */

/** Parse what a person typed. Accepts "1.5", "1,5", " 12 ", "-3", ".5". Returns null for anything else. */
export function parseNum(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\s+/g, '');
  if (s === '') return null;
  // A single comma and no dot is a decimal comma (some keyboards); otherwise commas are thousands separators.
  if (s.includes(',') && !s.includes('.') && (s.match(/,/g) ?? []).length === 1 && !/^\d{1,3},\d{3}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Round to `dp` decimal places without "-0" and without float noise. */
export function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  const r = Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** Format with a fixed number of decimals, trimming trailing zeros when `trim` is set. */
export function fmt(n: number, dp = 2, trim = true): string {
  if (!Number.isFinite(n)) return '–';
  const s = round(n, dp).toFixed(dp);
  return trim && dp > 0 ? s.replace(/\.?0+$/, '') : s;
}

/** Significant-figure style formatting for wide-ranging values (Ohm's law, converter). */
export function fmtSig(n: number, sig = 4): string {
  if (!Number.isFinite(n)) return '–';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9 || abs < 1e-4) return n.toExponential(sig - 1).replace(/\.?0+e/, 'e');
  const dp = Math.max(0, sig - 1 - Math.floor(Math.log10(abs)));
  return fmt(n, Math.min(dp, 6));
}

/** Inches as a tape-measure reading to the nearest 1/16": 12.53 -> 12 1/2". */
export function fmtInches(inches: number): string {
  if (!Number.isFinite(inches)) return '–';
  const neg = inches < 0;
  const sixteenths = Math.round(Math.abs(inches) * 16);
  const whole = Math.floor(sixteenths / 16);
  let num = sixteenths % 16;
  let den = 16;
  while (num > 0 && num % 2 === 0) { num /= 2; den /= 2; }
  const frac = num ? `${num}/${den}` : '';
  const body = whole && frac ? `${whole} ${frac}` : whole ? `${whole}` : frac || '0';
  return `${neg ? '-' : ''}${body}"`;
}

export type CalcResult<T> =
  | { ok: true; value: T; steps: string[]; warnings: string[] }
  | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Validate a required positive number. */
export function positive(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}
