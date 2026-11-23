/**
 * Units. Everything inside src/core is metric (metres, m², m³, kg, °C, km/h).
 * Conversion factors are the exact international definitions (NIST SP 811, Appendix B):
 *   1 ft = 0.3048 m, 1 in = 0.0254 m, 1 lb = 0.45359237 kg, 1 mile = 1609.344 m.
 */
export type UnitSystem = 'metric' | 'imperial';

export const FT = 0.3048;
export const IN = 0.0254;
export const FT2 = FT * FT;
export const FT3 = FT * FT * FT; // 0.028316846592 m³
export const YD3 = 27 * FT3; // 0.764554857984 m³
export const LB = 0.45359237;
export const SHORT_TON_KG = 2000 * LB; // 907.18474 kg
export const MILE_KM = 1.609344;
/** 1 t/m³ in lb/ft³ (1000 kg/m³ × FT3 / LB). */
export const TPM3_TO_LBFT3 = (1000 * FT3) / LB;

/**
 * Field kinds. Canonical (metric) value in brackets:
 *  len     long dimensions        [m]    metric m,   imperial ft
 *  thick   depths and thicknesses [m]    metric mm,  imperial in
 *  size    small item sizes       [m]    metric mm,  imperial in
 *  area    [m²] metric m², imperial ft²
 *  vol     [m³] metric m³, imperial yd³
 *  density [t/m³] metric t/m³, imperial lb/ft³
 *  temp    [°C] metric °C, imperial °F
 *  speed   [km/h] metric km/h, imperial mph
 *  kg      [kg] metric kg, imperial lb
 *  count, pct, num: unitless
 */
export type FieldKind = 'len' | 'thick' | 'size' | 'area' | 'vol' | 'svol' | 'tonnes' | 'density' | 'temp' | 'speed' | 'kg' | 'count' | 'pct' | 'num';

export function unitLabel(kind: FieldKind, sys: UnitSystem): string {
  const m = sys === 'metric';
  switch (kind) {
    case 'len': return m ? 'm' : 'ft';
    case 'thick': case 'size': return m ? 'mm' : 'in';
    case 'area': return m ? 'm²' : 'ft²';
    case 'vol': return m ? 'm³' : 'yd³';
    case 'svol': return m ? 'm³' : 'ft³';
    case 'tonnes': return m ? 't' : 'US tons';
    case 'density': return m ? 't/m³' : 'lb/ft³';
    case 'temp': return m ? '°C' : '°F';
    case 'speed': return m ? 'km/h' : 'mph';
    case 'kg': return m ? 'kg' : 'lb';
    case 'pct': return '%';
    default: return '';
  }
}

/** Value typed in the person's units -> canonical metric value. */
export function toMetric(kind: FieldKind, v: number, sys: UnitSystem): number {
  if (sys === 'metric') {
    if (kind === 'thick' || kind === 'size') return v / 1000;
    return v;
  }
  switch (kind) {
    case 'len': return v * FT;
    case 'thick': case 'size': return v * IN;
    case 'area': return v * FT2;
    case 'vol': return v * YD3;
    case 'svol': return v * FT3;
    case 'tonnes': return (v * SHORT_TON_KG) / 1000;
    case 'density': return v / TPM3_TO_LBFT3;
    case 'temp': return ((v - 32) * 5) / 9;
    case 'speed': return v * MILE_KM;
    case 'kg': return v * LB;
    default: return v;
  }
}

/** Canonical metric value -> the person's units. */
export function fromMetric(kind: FieldKind, v: number, sys: UnitSystem): number {
  if (sys === 'metric') {
    if (kind === 'thick' || kind === 'size') return v * 1000;
    return v;
  }
  switch (kind) {
    case 'len': return v / FT;
    case 'thick': case 'size': return v / IN;
    case 'area': return v / FT2;
    case 'vol': return v / YD3;
    case 'svol': return v / FT3;
    case 'tonnes': return (v * 1000) / SHORT_TON_KG;
    case 'density': return v * TPM3_TO_LBFT3;
    case 'temp': return (v * 9) / 5 + 32;
    case 'speed': return v / MILE_KM;
    case 'kg': return v / LB;
    default: return v;
  }
}

/**
 * Parse what someone typed. Accepts "1.5", ".5", "1,5" (comma as the decimal mark when there is no dot)
 * and surrounding spaces. Returns null for empty, partial ("1.2.3", "-", "abc") or non-finite input.
 */
export function parseNumber(text: string | null | undefined): number | null {
  if (text == null) return null;
  let s = String(text).trim().replace(/\s+/g, '');
  if (s === '') return null;
  // "1,500" and "12,500.5" are thousands; a single comma with other than three digits after it is a decimal mark ("1,5").
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (!s.includes('.') && (s.match(/,/g) ?? []).length === 1) s = s.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Fixed decimals with thousands separators and no "-0". */
export function fmt(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '–';
  const fixed = Math.abs(n) < 0.5 * 10 ** -dp ? (0).toFixed(dp) : n.toFixed(dp);
  const [whole, frac] = fixed.split('.');
  const neg = whole!.startsWith('-');
  const digits = neg ? whole!.slice(1) : whole!;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + (frac ? '.' + frac : '');
}

/** Trim trailing zeros for editable field text ("2.500" -> "2.5"). */
export function fmtField(n: number, dp = 3): string {
  if (!Number.isFinite(n)) return '';
  const s = n.toFixed(dp);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Round up to a step without floating-point surprises (ceilTo(2.4, 0.2) === 2.4, not 2.6). */
export function ceilTo(v: number, step: number): number {
  if (step <= 0) return v;
  const q = v / step;
  const r = Math.round(q);
  const n = Math.abs(q - r) < 1e-9 ? r : Math.ceil(q);
  return Number((n * step).toFixed(10));
}

/** Integer ceiling that ignores floating-point dust (ceilCount(3.0000000001) === 3). */
export function ceilCount(v: number): number {
  const r = Math.round(v);
  return Math.abs(v - r) < 1e-9 ? r : Math.ceil(v);
}
