/**
 * Length units. Everything inside Spigot is millimetres; inches exist only at the edges (typing and display).
 * 1 inch = 25.4 mm exactly (international yard and pound agreement, 1959; NIST SP 811 Appendix B).
 */
export type UnitSystem = 'metric' | 'imperial';

export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

const NUM = String.raw`\d+(?:\.\d+)?|\.\d+`;

/** Parses a plain decimal ("12", "12.5", ".5"). Commas are accepted as decimal separators (some keyboards). */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!new RegExp(`^(?:${NUM})$`).test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a length typed by a person.
 * - metric: millimetres ("1250", "1250.5"); a trailing "m" means metres ("1.25m"), "mm" is allowed.
 * - imperial: inches with an optional fraction ("12", "12.375", "12 3/8", "3/8") and optional feet
 *   ("4' 2 1/2", "4'", "4ft 2in"). Returns millimetres.
 */
export function parseLength(raw: string, unit: UnitSystem): ParseResult {
  const s = raw.trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ');
  if (s === '') return { ok: false, error: 'Enter a length' };
  if (s.startsWith('-')) return { ok: false, error: 'Lengths can’t be negative' };
  if (unit === 'metric') {
    const m = s.match(new RegExp(`^(${NUM}) ?(mm|m|cm)?$`));
    if (!m) return { ok: false, error: 'Not a number' };
    const n = Number(m[1]);
    const factor = m[2] === 'm' ? 1000 : m[2] === 'cm' ? 10 : 1;
    return { ok: true, value: n * factor };
  }
  // Imperial: [feet ' | ft] [whole] [num/den] [" | in]
  const re = new RegExp(
    `^(?:(${NUM}) ?(?:'|ft|’) ?)?(?:(${NUM})(?: (\\d+)/(\\d+))?|(\\d+)/(\\d+))? ?(?:"|in|”)?$`,
  );
  const m = s.match(re);
  if (!m || s === "'" || s === '"') return { ok: false, error: 'Try 12 3/8 or 4\' 2 1/2' };
  const feet = m[1] ? Number(m[1]) : 0;
  let inches = 0;
  if (m[2] !== undefined) {
    inches = Number(m[2]);
    if (m[3] !== undefined) {
      if (m[2].includes('.')) return { ok: false, error: 'Use 12 3/8 or 12.375, not both' };
      const den = Number(m[4]);
      if (den === 0) return { ok: false, error: 'Can’t divide by zero' };
      inches += Number(m[3]) / den;
    }
  } else if (m[5] !== undefined) {
    const den = Number(m[6]);
    if (den === 0) return { ok: false, error: 'Can’t divide by zero' };
    inches = Number(m[5]) / den;
  } else if (m[1] === undefined) {
    return { ok: false, error: 'Not a number' };
  }
  const mm = feet * MM_PER_FOOT + inches * MM_PER_INCH;
  return Number.isFinite(mm) ? { ok: true, value: mm } : { ok: false, error: 'Not a number' };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Inches as whole + nearest 1/den fraction ("12 3/8"). den is a power of two (default 16). */
export function formatInches(inchesIn: number, den = 16): string {
  const neg = inchesIn < 0;
  const total = Math.round(Math.abs(inchesIn) * den);
  const whole = Math.floor(total / den);
  let num = total % den;
  let d = den;
  if (num !== 0) {
    const g = gcd(num, d);
    num /= g;
    d /= g;
  }
  const frac = num === 0 ? '' : `${num}/${d}`;
  const body = whole === 0 && frac ? frac : frac ? `${whole} ${frac}` : `${whole}`;
  return `${neg ? '−' : ''}${body}″`;
}

/** Feet and inches for long runs ("5′ 3 7/16″"). */
export function formatFeetInches(mm: number, den = 16): string {
  const neg = mm < 0;
  const totalSixteenths = Math.round((Math.abs(mm) / MM_PER_INCH) * den);
  const perFoot = 12 * den;
  const feet = Math.floor(totalSixteenths / perFoot);
  const rest = (totalSixteenths - feet * perFoot) / den;
  const inches = formatInches(rest, den);
  if (feet === 0) return `${neg ? '−' : ''}${inches}`;
  return `${neg ? '−' : ''}${feet}′ ${inches}`;
}

/** Groups thousands with a thin space, Australian style ("12 500"). */
function group(n: string): string {
  const [i, f] = n.split('.');
  const g = (i ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return f ? `${g}.${f}` : g;
}

export interface LengthFormat {
  /** Metric: decimals for mm (default 0; 1 under 100 mm). */
  decimals?: number;
  /** Metric: show metres for values of 1000 mm and more. */
  metres?: boolean;
  /** Imperial: fraction denominator (default 16). */
  den?: number;
}

export function formatLength(mm: number, unit: UnitSystem, opts: LengthFormat = {}): string {
  if (!Number.isFinite(mm)) return '—';
  if (unit === 'imperial') {
    const inches = mm / MM_PER_INCH;
    return Math.abs(inches) >= 36 ? formatFeetInches(mm, opts.den) : formatInches(inches, opts.den);
  }
  if (opts.metres && Math.abs(mm) >= 1000) return `${group(String(Number((mm / 1000).toFixed(3))))} m`;
  const decimals = opts.decimals ?? (Math.abs(mm) < 100 && Math.round(mm) !== mm ? 1 : 0);
  const fixed = mm.toFixed(decimals);
  return `${group(fixed === '-0' ? '0' : fixed)} mm`;
}

/** Value for an input field in the person's units (no unit suffix), e.g. "1250" or "49 3/16". */
export function lengthToInput(mm: number, unit: UnitSystem): string {
  if (unit === 'metric') return String(Math.round(mm * 10) / 10);
  return formatInches(mm / MM_PER_INCH).replace('″', '');
}

export const unitLabel = (unit: UnitSystem) => (unit === 'metric' ? 'mm' : 'in');
