/**
 * Units and number formatting. Every calculation runs in millimetres, square metres and degrees;
 * only input parsing and display change with the country's unit system.
 *
 * Pitch conversions (trigonometry of a right triangle, rise over run):
 *   ratio x:12  = 12 · tan(θ)          (US/Canada "rise per 12 inches of run")
 *   percent     = 100 · tan(θ)
 *   θ           = atan(rise / run)
 */
export type UnitSystem = 'metric' | 'imperial';
export type PitchStyle = 'deg' | 'x12';

export const MM_PER_IN = 25.4;
export const MM_PER_FT = 304.8;
export const SQFT_PER_M2 = 10.7639104167;
export const MAX_PITCH_DEG = 75;

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function degFromRiseRun(rise: number, run: number): number | null {
  if (!Number.isFinite(rise) || !Number.isFinite(run) || run <= 0 || rise < 0) return null;
  return toDeg(Math.atan(rise / run));
}
export const riseOver12 = (deg: number) => 12 * Math.tan(toRad(deg));
export const degFromX12 = (x: number) => toDeg(Math.atan(x / 12));
export const percentFromDeg = (deg: number) => 100 * Math.tan(toRad(deg));
export const degFromPercent = (p: number) => toDeg(Math.atan(p / 100));
/** "1 in N" (run per unit of rise) as used for low-slope sheet roofs, e.g. 1:12 ≈ 4.76°. */
export const oneInFromDeg = (deg: number) => (deg > 0 ? 1 / Math.tan(toRad(deg)) : Infinity);

/** Pitch factor: slope length ÷ plan length for a plane at θ (1 / cos θ). */
export const pitchFactor = (deg: number) => 1 / Math.cos(toRad(deg));

export function isPitch(deg: number): boolean {
  return Number.isFinite(deg) && deg >= 0 && deg <= MAX_PITCH_DEG;
}

/** Plain decimal with locale-free separators, trimming trailing zeros. */
export function num(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '–';
  const fixed = n.toFixed(dp);
  return dp > 0 ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** Group thousands with a thin space (works for every English locale; no comma/period confusion). */
export function grouped(n: number, dp = 0): string {
  if (!Number.isFinite(n)) return '–';
  const [i, d] = n.toFixed(dp).split('.');
  const int = (i ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return d ? `${int}.${d}` : int;
}

/** Nearest 1/8 inch, as a tape measure reads. */
export function feetInches(mm: number): string {
  if (!Number.isFinite(mm)) return '–';
  const sign = mm < 0 ? '-' : '';
  let eighths = Math.round((Math.abs(mm) / MM_PER_IN) * 8);
  const ft = Math.floor(eighths / 96);
  eighths -= ft * 96;
  const inch = Math.floor(eighths / 8);
  let frac = eighths - inch * 8;
  let fracText = '';
  if (frac) {
    let den = 8;
    while (frac % 2 === 0) { frac /= 2; den /= 2; }
    fracText = ` ${frac}/${den}`;
  }
  return ft ? `${sign}${ft}′ ${inch}${fracText}″` : `${sign}${inch}${fracText}″`;
}

export function formatLength(mm: number, sys: UnitSystem): string {
  if (!Number.isFinite(mm)) return '–';
  if (sys === 'imperial') return feetInches(mm);
  return Math.abs(mm) >= 10_000 ? `${num(mm / 1000, 2)} m` : `${grouped(Math.round(mm))} mm`;
}

/** Long runs (lineal totals): metres or feet. */
export function formatRun(mm: number, sys: UnitSystem): string {
  if (!Number.isFinite(mm)) return '–';
  return sys === 'imperial' ? `${grouped(mm / MM_PER_FT, 1)} ft` : `${grouped(mm / 1000, 2)} m`;
}

export function formatArea(m2: number, sys: UnitSystem): string {
  if (!Number.isFinite(m2)) return '–';
  if (sys === 'imperial') {
    const sqft = m2 * SQFT_PER_M2;
    return `${grouped(sqft, 0)} sq ft (${num(sqft / 100, 2)} squares)`;
  }
  return `${grouped(m2, 2)} m²`;
}

export function formatPitch(deg: number, style: PitchStyle): string {
  if (!Number.isFinite(deg)) return '–';
  return style === 'x12' ? `${num(riseOver12(deg), 2)}:12` : `${num(deg, 1)}°`;
}

/** Both forms, primary first, e.g. "22.5° (4.97:12)". */
export function formatPitchBoth(deg: number, style: PitchStyle): string {
  const other: PitchStyle = style === 'x12' ? 'deg' : 'x12';
  return `${formatPitch(deg, style)} (${formatPitch(deg, other)})`;
}

const FRACTION = /^(\d+)\s*\/\s*(\d+)$/;

function parseNumberish(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const f = FRACTION.exec(t);
  if (f) {
    const d = Number(f[2]);
    return d ? Number(f[1]) / d : null;
  }
  // "6 1/2" → 6.5
  const mixed = /^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (mixed) {
    const d = Number(mixed[3]);
    return d ? Number(mixed[1]) + Number(mixed[2]) / d : null;
  }
  const n = Number(t.replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

/** A number typed by the user ("4.5", "4,5", "1/2"); null if blank or not a number. */
export function parseNumber(input: string): number | null {
  return parseNumberish(input.replace(/\s+/g, ' '));
}

/**
 * Parse a typed length into millimetres.
 * metric: "4215" (in `defaultUnit`), "4215mm", "4.215 m", "421.5cm".
 * imperial: "12' 6"", "12ft 6in", "12 6" (feet then inches), "150"" (inches), "12.5'" and "6 1/2"" fractions.
 * Bare numbers use `defaultUnit`. Returns null for blank, negative or unreadable input.
 */
export function parseLength(input: string, sys: UnitSystem, defaultUnit: 'mm' | 'm' | 'ft' | 'in'): number | null {
  const s = input.trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"').replace(/,/g, '.');
  if (!s || s.startsWith('-')) return null;
  const metric = /^(\d+(?:\.\d+)?)\s*(mm|cm|m)?$/.exec(s);
  if (metric && (sys === 'metric' || metric[2])) {
    const n = Number(metric[1]);
    const unit = metric[2] ?? defaultUnit;
    if (unit === 'mm') return n;
    if (unit === 'cm') return n * 10;
    if (unit === 'm') return n * 1000;
    if (unit === 'ft') return n * MM_PER_FT;
    if (unit === 'in') return n * MM_PER_IN;
  }
  // feet and inches
  const fi = /^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?(?:\s+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+)\s*(?:"|in|inch|inches)?)?$/.exec(s);
  if (fi) {
    const inch = fi[2] ? parseNumberish(fi[2]) : 0;
    if (inch === null) return null;
    return Number(fi[1]) * MM_PER_FT + inch * MM_PER_IN;
  }
  const inchOnly = /^(\d+(?:\.\d+)?(?:\s+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+)\s*(?:"|in|inch|inches)$/.exec(s);
  if (inchOnly) {
    const inch = parseNumberish(inchOnly[1] ?? '');
    return inch === null ? null : inch * MM_PER_IN;
  }
  // "12 6" → 12 ft 6 in (imperial only, feet default)
  const pair = /^(\d+)\s+(\d+(?:\.\d+)?)$/.exec(s);
  if (pair && sys === 'imperial' && defaultUnit === 'ft') return Number(pair[1]) * MM_PER_FT + Number(pair[2]) * MM_PER_IN;
  const bare = parseNumberish(s);
  if (bare === null || bare < 0) return null;
  switch (defaultUnit) {
    case 'mm': return bare;
    case 'm': return bare * 1000;
    case 'ft': return bare * MM_PER_FT;
    case 'in': return bare * MM_PER_IN;
  }
}

/** Value shown back in an input box for a stored length (so edits round-trip). */
export function lengthInputText(mm: number, sys: UnitSystem, unit: 'mm' | 'm' | 'ft' | 'in'): string {
  if (!Number.isFinite(mm)) return '';
  if (sys === 'imperial' && unit === 'ft') {
    const total = mm / MM_PER_IN;
    let ft = Math.floor(total / 12);
    let inch = Math.round((total - ft * 12) * 8) / 8;
    if (inch >= 12) { ft += 1; inch -= 12; }
    return inch ? `${ft}' ${num(inch, 3)}"` : `${ft}'`;
  }
  if (unit === 'in') return num(mm / MM_PER_IN, 3);
  if (unit === 'ft') return num(mm / MM_PER_FT, 3);
  if (unit === 'm') return num(mm / 1000, 3);
  return num(mm, 1);
}

/** Parse a pitch typed as degrees ("22.5", "22.5°"), x:12 ("6:12", "6/12", "6 in 12") or percent ("25%"). */
export function parsePitch(input: string, style: PitchStyle): number | null {
  const s = input.trim().toLowerCase().replace('°', '').replace(/deg(rees)?/, '').trim();
  if (!s) return null;
  const ratio = /^(\d+(?:\.\d+)?)\s*(?::|\/|in)\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (ratio) {
    const run = Number(ratio[2]);
    const deg = degFromRiseRun(Number(ratio[1]), run);
    return deg !== null && isPitch(deg) ? deg : null;
  }
  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(s);
  if (pct) {
    const deg = degFromPercent(Number(pct[1]));
    return isPitch(deg) ? deg : null;
  }
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  const deg = style === 'x12' ? degFromX12(n) : n;
  return isPitch(deg) ? deg : null;
}

export function pitchInputText(deg: number, style: PitchStyle): string {
  return style === 'x12' ? num(riseOver12(deg), 2) : num(deg, 2);
}

export const ceilTo = (n: number, step: number) => Math.ceil(n / step - 1e-9) * step;
