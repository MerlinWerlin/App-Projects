/**
 * Units. Every length is stored in millimetres and every area in square metres, whatever the country.
 * Conversions are exact by definition: 1 in = 25.4 mm (international yard and pound agreement, 1959),
 * 1 ft = 304.8 mm, 1 sq ft = 0.09290304 m², 1 lb = 0.45359237 kg, 1 US gal = 3.785411784 L
 * (NIST Handbook 44, Appendix C: https://www.nist.gov/pml/owm/nist-handbook-44-current-edition).
 */
export type UnitSystem = 'metric' | 'imperial';

export const MM_PER_IN = 25.4;
export const MM_PER_FT = 304.8;
export const M2_PER_SQFT = 0.09290304;
export const KG_PER_LB = 0.45359237;
export const L_PER_USGAL = 3.785411784;

/** What a typed number means when it has no unit: rooms are feet in imperial, small sizes are inches; metric is always mm. */
export type LengthKind = 'room' | 'tile' | 'joint';

const FRACTION = /^(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+))?$/;

/** "1 1/2", "3/16", "2.5" -> number; null if not a plain positive amount. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = FRACTION.exec(s);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  let v = m[1] !== undefined ? Number(m[1]) : 0;
  if (m[2] !== undefined) {
    const d = Number(m[3]);
    if (!d) return null;
    // "3/16" alone, or "1 1/2" (whole + fraction). "1.5 1/2" is nonsense.
    if (m[1] !== undefined && m[1].includes('.')) return null;
    v += Number(m[2]) / d;
  }
  return Number.isFinite(v) ? v : null;
}

/**
 * Parse a typed length into mm. Accepts unit suffixes in either system so a tiler can type what is on the tape:
 * metric "2400", "2400mm", "2.4m", "240cm"; imperial "12' 6\"", "12'6", "12ft 6in", "150\"", "3/16", "1 1/2 in".
 * Returns null for empty, negative, zero-only-when-not-allowed, or unreadable input.
 */
export function parseLength(raw: string, kind: LengthKind, system: UnitSystem, allowZero = false): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase().replace(/,/g, '').replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  if (!s) return null;
  if (s.startsWith('-')) return null;
  let mm: number | null = null;
  const metric = /^(\d+(?:\.\d+)?)\s*(mm|cm|m)$/.exec(s);
  const ftIn = /^(?:(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot))\s*(?:(.+?)\s*(?:"|in|inch|inches)?)?$/.exec(s);
  const inOnly = /^(.+?)\s*(?:"|in|inch|inches)$/.exec(s);
  if (metric) {
    const v = Number(metric[1]);
    mm = metric[2] === 'mm' ? v : metric[2] === 'cm' ? v * 10 : v * 1000;
  } else if (ftIn) {
    const ft = Number(ftIn[1]);
    const inches = ftIn[2] ? parseAmount(ftIn[2]) : 0;
    if (inches === null) return null;
    mm = ft * MM_PER_FT + inches * MM_PER_IN;
  } else if (inOnly) {
    const v = parseAmount(inOnly[1]);
    if (v === null) return null;
    mm = v * MM_PER_IN;
  } else {
    const v = parseAmount(s);
    if (v === null) return null;
    if (system === 'metric') mm = v;
    else mm = kind === 'room' ? v * MM_PER_FT : v * MM_PER_IN;
  }
  if (!Number.isFinite(mm) || mm < 0) return null;
  if (mm === 0 && !allowZero) return null;
  return mm;
}

const round = (v: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

/** Nearest 1/16 inch as "5 3/8". */
export function inchesText(totalIn: number): string {
  const sixteenths = Math.round(totalIn * 16);
  const whole = Math.floor(sixteenths / 16);
  let num = sixteenths % 16;
  let den = 16;
  while (num && num % 2 === 0) { num /= 2; den /= 2; }
  if (!num) return `${whole}`;
  return whole ? `${whole} ${num}/${den}` : `${num}/${den}`;
}

/** Display a length: metric always in mm (how tilers mark out), imperial as ft-in for rooms and inches for small sizes. */
export function formatLength(mm: number, system: UnitSystem, kind: LengthKind = 'room'): string {
  if (!Number.isFinite(mm)) return '–';
  if (system === 'metric') {
    const v = round(mm, mm < 20 ? 1 : 0);
    return `${v.toLocaleString('en-US')} mm`;
  }
  const totalIn = mm / MM_PER_IN;
  if (kind !== 'room' || totalIn < 12) return `${inchesText(totalIn)}″`;
  const sixteenths = Math.round(totalIn * 16);
  const ft = Math.floor(sixteenths / (12 * 16));
  const rest = (sixteenths - ft * 12 * 16) / 16;
  return rest ? `${ft}′ ${inchesText(rest)}″` : `${ft}′`;
}

/** The value as it would be typed back into a field (no unit symbol): mm, feet-and-inches, or inches. */
export function editableLength(mm: number, system: UnitSystem, kind: LengthKind): string {
  if (system === 'metric') return String(round(mm, 1));
  const totalIn = mm / MM_PER_IN;
  if (kind !== 'room') return inchesText(totalIn);
  const sixteenths = Math.round(totalIn * 16);
  const ft = Math.floor(sixteenths / 192);
  const rest = (sixteenths - ft * 192) / 16;
  return rest ? `${ft}' ${inchesText(rest)}"` : `${ft}'`;
}

export function formatArea(m2: number, system: UnitSystem): string {
  if (!Number.isFinite(m2)) return '–';
  return system === 'metric' ? `${round(m2, 2).toFixed(2)} m²` : `${round(m2 / M2_PER_SQFT, 1).toFixed(1)} sq ft`;
}

export function formatMass(kg: number, system: UnitSystem): string {
  return system === 'metric' ? `${round(kg, 1)} kg` : `${round(kg / KG_PER_LB, 1)} lb`;
}

export function formatVolume(litres: number, system: UnitSystem): string {
  return system === 'metric' ? `${round(litres, 1)} L` : `${round(litres / L_PER_USGAL, 2)} gal`;
}

export const unitLabel = (system: UnitSystem, kind: LengthKind) =>
  system === 'metric' ? 'mm' : kind === 'room' ? 'ft-in' : 'in';
