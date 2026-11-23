// Lengths, fractions and angles. Everything inside Trammel is millimetres and degrees; this file turns what a
// person types (metric or imperial, tape-measure style) into millimetres and back.
// 1 inch = 25.4 mm exactly (international yard and pound agreement, 1959; NIST SP 811 Appendix B).
// Pure TypeScript, tested in units.test.ts.

export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;

export type UnitSystem = 'metric' | 'imperial';
/** Smallest tape fraction shown in imperial: 1/8, 1/16 or 1/32 of an inch. */
export type FractionDenom = 8 | 16 | 32;

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Parses "3/4", "1 3/4", "1-3/4", "1.75" into a number. null when it isn't one. */
export function parseMixedNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d+)\s*[- ]\s*(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    const den = Number(m[3]);
    if (den === 0) return null;
    return Number(m[1]) + Number(m[2]) / den;
  }
  m = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    const den = Number(m[2]);
    if (den === 0) return null;
    return Number(m[1]) / den;
  }
  if (/^(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  return null;
}

/**
 * Turns typed text into millimetres. A bare number is mm in metric and inches in imperial.
 * Accepted: "2400", "2400mm", "240cm", "2.4m", "2,400", "54 1/2", "54-1/2\"", "4' 6 1/2\"", "4ft 6in", "4'", "3/4in".
 * Returns null for anything else (empty, negative, letters, 1/0).
 */
export function parseLength(raw: string, system: UnitSystem): number | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"').replace(/''/g, '"');
  if (!s || s.startsWith('-')) return null;
  // Thousands separators ("2,400") only when the comma is followed by exactly three digits.
  s = s.replace(/(\d),(?=\d{3}(\D|$))/g, '$1');
  let m = /^(\d+\.?\d*|\.\d+)\s*(mm|cm|m)$/.exec(s);
  if (m) {
    const v = Number(m[1]);
    return m[2] === 'mm' ? v : m[2] === 'cm' ? v * 10 : v * 1000;
  }
  // Feet with optional inches: 4' 6 1/2", 4ft 6in, 4' 6, 4'
  m = /^(\d+\.?\d*)\s*(?:'|ft|feet|foot)\s*(.*)$/.exec(s);
  if (m) {
    const feet = Number(m[1]);
    const rest = m[2].replace(/(?:"|in|inch|inches)\s*$/, '').trim();
    const inches = rest ? parseMixedNumber(rest) : 0;
    if (inches == null) return null;
    return feet * MM_PER_FOOT + inches * MM_PER_INCH;
  }
  m = /^(.*?)\s*(?:"|in|inch|inches)$/.exec(s);
  if (m) {
    const inches = parseMixedNumber(m[1]);
    return inches == null ? null : inches * MM_PER_INCH;
  }
  const n = parseMixedNumber(s);
  if (n == null) return null;
  return system === 'metric' ? n : n * MM_PER_INCH;
}

/** Parses a plain number (angles, counts, percentages). Accepts "45", "45.5", "45°". */
export function parseNumber(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/°$/, '').replace(/,/g, '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export type Fraction = { whole: number; num: number; den: number; /** rounding error in mm (shown value minus true value) */ errorMm: number };

/** Nearest tape fraction of an inch for a length in mm, reduced (8/16 -> 1/2). */
export function toInchFraction(mm: number, denom: FractionDenom = 16): Fraction {
  const inches = mm / MM_PER_INCH;
  const ticks = Math.round(inches * denom);
  const whole = Math.floor(ticks / denom);
  let num = ticks - whole * denom;
  let den: number = denom;
  if (num) {
    const g = gcd(num, den);
    num /= g;
    den /= g;
  } else den = 1;
  return { whole, num, den, errorMm: (ticks / denom) * MM_PER_INCH - mm };
}

/** 54 1/2" style (inches only). */
export function formatInches(mm: number, denom: FractionDenom = 16): string {
  if (!isNum(mm)) return '-';
  const neg = mm < 0;
  const f = toInchFraction(Math.abs(mm), denom);
  const frac = f.num ? `${f.whole ? `${f.whole} ` : ''}${f.num}/${f.den}` : `${f.whole}`;
  return `${neg ? '-' : ''}${frac}"`;
}

/** 4' 6 1/2" style; under a foot it reads 6 1/2". */
export function formatFeetInches(mm: number, denom: FractionDenom = 16): string {
  if (!isNum(mm)) return '-';
  const neg = mm < 0;
  const f = toInchFraction(Math.abs(mm), denom);
  const feet = Math.floor(f.whole / 12);
  const inch = f.whole - feet * 12;
  const inchPart = f.num ? `${inch ? `${inch} ` : ''}${f.num}/${f.den}"` : `${inch}"`;
  const s = feet ? `${feet}' ${inchPart}` : inchPart;
  return `${neg ? '-' : ''}${s}`;
}

/** 2,400 mm (whole mm unless decimals asked for). Uses a thin grouping comma like an Australian tape. */
export function formatMm(mm: number, decimals = 0): string {
  if (!isNum(mm)) return '-';
  const v = Number(mm.toFixed(decimals));
  const [i, d] = Math.abs(v).toFixed(decimals).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${v < 0 ? '-' : ''}${grouped}${d ? `.${d}` : ''} mm`;
}

export function formatLength(mm: number, system: UnitSystem, denom: FractionDenom = 16): string {
  if (system === 'metric') return formatMm(mm);
  return Math.abs(mm) >= MM_PER_FOOT ? formatFeetInches(mm, denom) : formatInches(mm, denom);
}

/** 33.9° (one decimal, the most a mitre saw scale can be read to). */
export function formatDeg(deg: number, decimals = 1): string {
  if (!isNum(deg)) return '-';
  return `${deg.toFixed(decimals)}°`;
}

/** Text the input field starts with for a stored mm value. */
export function lengthToInput(mm: number, system: UnitSystem, denom: FractionDenom = 16): string {
  if (!isNum(mm)) return '';
  if (system === 'metric') return String(Math.round(mm * 10) / 10);
  // Inputs keep 1/32 in so switching units back and forth doesn't drift (255 mm stays 255, not 254).
  return formatInches(mm, denom >= 32 ? denom : 32);
}

/** A formatter bundle so the maths can describe its steps in the person's units. */
export type Fmt = { len: (mm: number) => string; deg: (d: number) => string; num: (x: number, dp?: number) => string };

export function makeFmt(system: UnitSystem, denom: FractionDenom = 16): Fmt {
  return {
    len: (mm) => formatLength(mm, system, denom),
    deg: (d) => formatDeg(d),
    num: (x, dp = 2) => (isNum(x) ? String(Number(x.toFixed(dp))) : '-'),
  };
}

export const METRIC: Fmt = makeFmt('metric');

/**
 * A limit shown in the units in use, rounded the safe way: a minimum rounds up and a maximum down to the tape
 * fraction (or whole mm), so the number shown never lets a cut pass that the code would fail.
 */
export function formatLimit(mm: number, system: UnitSystem, denom: FractionDenom, dir: 'min' | 'max'): string {
  if (!isNum(mm)) return '-';
  if (system === 'metric') return formatMm(dir === 'min' ? Math.ceil(mm - 1e-9) : Math.floor(mm + 1e-9));
  const ticks = (mm / MM_PER_INCH) * denom;
  const t = dir === 'min' ? Math.ceil(ticks - 1e-9) : Math.floor(ticks + 1e-9);
  return formatInches((t / denom) * MM_PER_INCH, denom);
}
