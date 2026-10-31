// T90 Travel converters: offline unit tables, converters and general clothing / shoe size charts. Pure TS, no
// React Native; app/units.tsx draws it. Nothing is fetched.
// - Linear units convert through a base unit per dimension (metre, km/h, kilogram, litre); temperature is affine.
// - Each tab offers a few unit pairs (metric "a" side, imperial "b" side) with quick-pick values for either side.
// - The default direction puts the result in the traveller's home system: an imperial home (US, LR, MM) converts
//   metric to imperial, a metric home converts imperial to metric.
// - Size charts are general approximations (brands vary): see ops/DECISIONS.md (run 92, T90) for how they were set.

// ---- Tabs ----

export const UNIT_TABS = ['temp', 'distance', 'weight', 'volume', 'sizes'] as const;
export type UnitTab = (typeof UNIT_TABS)[number];
/** AsyncStorage key for the last tab used (usePersisted). */
export const UNITS_TAB_KEY = 'satchel.unitsTab.v1';
export const DEFAULT_UNITS_TAB: UnitTab = 'temp';
export const isUnitTab = (v: unknown): v is UnitTab => typeof v === 'string' && (UNIT_TABS as readonly string[]).includes(v);
/** A stored tab (any earlier build, damaged storage) as a valid tab. */
export const normaliseUnitsTab = (v: unknown): UnitTab => (isUnitTab(v) ? v : DEFAULT_UNITS_TAB);

// ---- Unit systems ----

export type UnitSystem = 'metric' | 'imperial';
/** Countries that mostly use US customary / imperial units day to day (US, Liberia, Myanmar). */
export const IMPERIAL_HOMES = ['US', 'LR', 'MM'] as const;

/**
 * The unit system to show results in: imperial for a US / LR / MM home, metric for any other set home. With no home
 * country set, a Fahrenheit weather setting hints imperial; otherwise metric.
 */
export function defaultSystem(homeIso: string | null | undefined, tempUnit?: string | null): UnitSystem {
  if (typeof homeIso === 'string' && homeIso.trim()) {
    return (IMPERIAL_HOMES as readonly string[]).includes(homeIso.trim().toUpperCase()) ? 'imperial' : 'metric';
  }
  return tempUnit === 'f' ? 'imperial' : 'metric';
}

// ---- Units ----

export type Dimension = 'temp' | 'length' | 'speed' | 'mass' | 'volume';
export const UNIT_IDS = ['c', 'f', 'km', 'mi', 'm', 'ft', 'cm', 'in', 'kmh', 'mph', 'kg', 'lb', 'g', 'oz', 'l', 'usgal', 'ukgal', 'ml', 'floz'] as const;
export type UnitId = (typeof UNIT_IDS)[number];

type UnitDef = { dim: Dimension; system: UnitSystem; /** Size in the dimension's base unit (unused for temperature). */ factor: number };

/** Exact definitions: 1 in = 2.54 cm, 1 lb = 0.45359237 kg, 1 US gal = 3.785411784 l, 1 UK gal = 4.54609 l. */
export const UNITS: Record<UnitId, UnitDef> = {
  c: { dim: 'temp', system: 'metric', factor: 1 },
  f: { dim: 'temp', system: 'imperial', factor: 1 },
  km: { dim: 'length', system: 'metric', factor: 1000 },
  mi: { dim: 'length', system: 'imperial', factor: 1609.344 },
  m: { dim: 'length', system: 'metric', factor: 1 },
  ft: { dim: 'length', system: 'imperial', factor: 0.3048 },
  cm: { dim: 'length', system: 'metric', factor: 0.01 },
  in: { dim: 'length', system: 'imperial', factor: 0.0254 },
  kmh: { dim: 'speed', system: 'metric', factor: 1 },
  mph: { dim: 'speed', system: 'imperial', factor: 1.609344 },
  kg: { dim: 'mass', system: 'metric', factor: 1 },
  lb: { dim: 'mass', system: 'imperial', factor: 0.45359237 },
  g: { dim: 'mass', system: 'metric', factor: 0.001 },
  oz: { dim: 'mass', system: 'imperial', factor: 0.028349523125 },
  l: { dim: 'volume', system: 'metric', factor: 1 },
  usgal: { dim: 'volume', system: 'imperial', factor: 3.785411784 },
  ukgal: { dim: 'volume', system: 'imperial', factor: 4.54609 },
  ml: { dim: 'volume', system: 'metric', factor: 0.001 },
  // US fluid ounce (1/128 US gal), the one printed on most travel-size bottles.
  floz: { dim: 'volume', system: 'imperial', factor: 0.0295735295625 },
};

export const isUnitId = (v: unknown): v is UnitId => typeof v === 'string' && (UNIT_IDS as readonly string[]).includes(v);

/**
 * `value` in `from` as `to`, or null when the units measure different things (km to kg) or the value isn't finite.
 * Temperatures below absolute zero are still converted (the maths is fine; the UI never blocks typing).
 */
export function convertUnit(value: number, from: UnitId, to: UnitId): number | null {
  if (!Number.isFinite(value)) return null;
  const a = UNITS[from];
  const b = UNITS[to];
  if (!a || !b || a.dim !== b.dim) return null;
  if (from === to) return value;
  if (a.dim === 'temp') return from === 'c' ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
  return (value * a.factor) / b.factor;
}

// ---- Pairs (what each tab offers) ----

export type UnitPair = { id: string; tab: Exclude<UnitTab, 'sizes'>; a: UnitId; b: UnitId; /** Quick picks typed in a. */ chipsA: number[]; /** Quick picks typed in b. */ chipsB: number[] };

export const UNIT_PAIRS: readonly UnitPair[] = [
  { id: 'c-f', tab: 'temp', a: 'c', b: 'f', chipsA: [-10, 0, 10, 20, 25, 30, 37, 40], chipsB: [0, 32, 50, 68, 77, 86, 98.6, 104] },
  { id: 'km-mi', tab: 'distance', a: 'km', b: 'mi', chipsA: [1, 5, 10, 21.1, 42.2, 100], chipsB: [1, 3, 5, 10, 26.2, 60] },
  { id: 'kmh-mph', tab: 'distance', a: 'kmh', b: 'mph', chipsA: [30, 50, 80, 100, 110, 130], chipsB: [20, 30, 45, 55, 65, 70] },
  { id: 'm-ft', tab: 'distance', a: 'm', b: 'ft', chipsA: [1, 2, 10, 100, 1000, 3000], chipsB: [1, 6, 100, 1000, 10000, 35000] },
  { id: 'cm-in', tab: 'distance', a: 'cm', b: 'in', chipsA: [1, 10, 30, 40, 55, 170], chipsB: [1, 9, 12, 14, 22, 70] },
  { id: 'kg-lb', tab: 'weight', a: 'kg', b: 'lb', chipsA: [1, 7, 10, 20, 23, 32], chipsB: [1, 15, 22, 40, 50, 70] },
  { id: 'g-oz', tab: 'weight', a: 'g', b: 'oz', chipsA: [100, 250, 500, 1000], chipsB: [1, 4, 8, 16] },
  { id: 'l-usgal', tab: 'volume', a: 'l', b: 'usgal', chipsA: [1, 4, 10, 40, 50], chipsB: [1, 5, 10, 15] },
  { id: 'l-ukgal', tab: 'volume', a: 'l', b: 'ukgal', chipsA: [1, 4.5, 10, 40, 50], chipsB: [1, 5, 10, 15] },
  { id: 'ml-floz', tab: 'volume', a: 'ml', b: 'floz', chipsA: [100, 250, 330, 500, 1000], chipsB: [1, 3.4, 8, 12, 16] },
];

/** The pairs a tab offers, in display order (none for sizes). */
export const pairsFor = (tab: UnitTab): UnitPair[] => UNIT_PAIRS.filter((p) => p.tab === tab);
export const findPair = (id: string | null | undefined): UnitPair | null => UNIT_PAIRS.find((p) => p.id === id) ?? null;

export type Direction = { from: UnitId; to: UnitId };

/** The starting direction: results in the home system (an imperial home converts a to b, a metric home b to a). */
export function defaultDirection(pair: UnitPair, system: UnitSystem): Direction {
  return system === 'imperial' ? { from: pair.a, to: pair.b } : { from: pair.b, to: pair.a };
}

export const swapUnits = (d: Direction): Direction => ({ from: d.to, to: d.from });

/** Quick-pick values for whichever side is the "from" unit. */
export const chipsFor = (pair: UnitPair, from: UnitId): number[] => (from === pair.a ? pair.chipsA : pair.chipsB);

// ---- Typing numbers ----

/** The decimal mark a language writes ('.' or ','), from Intl; '.' when Intl can't tell. */
export function decimalMark(lang: string): '.' | ',' {
  try {
    return (1.5).toLocaleString(lang).includes(',') ? ',' : '.';
  } catch {
    return '.';
  }
}

export const MAX_INPUT = 16;

/**
 * Typed text as a number, or null. Accepts a decimal point or a decimal comma ("12,5"), a leading minus (also the
 * typographic − and en dash), spaces / apostrophes / thin spaces as digit grouping, and both marks together
 * ("1.234,5" or "1,234.5": the last one is the decimal). A single mark followed by exactly three digits ("1,500")
 * is read with the language's own habit: grouping when that language's decimal mark is the other one.
 */
export function parseNumber(text: unknown, mark: '.' | ',' = '.'): number | null {
  if (typeof text !== 'string') return null;
  let s = text.trim().replace(/[\s  '’]/g, '').replace(/^[−–]/, '-');
  if (!s || s.length > MAX_INPUT * 2) return null;
  let sign = 1;
  if (s[0] === '-' || s[0] === '+') {
    if (s[0] === '-') sign = -1;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let norm: string;
  if (dots && commas) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const group = dec === '.' ? ',' : '.';
    if ((s.match(dec === '.' ? /\./g : /,/g) ?? []).length > 1) return null;
    const [int, frac] = s.split(dec);
    if (!validGroups(int, group)) return null;
    norm = `${int.split(group).join('')}.${frac}`;
  } else if (dots + commas === 0) {
    norm = s;
  } else {
    const sep = dots ? '.' : ',';
    const parts = s.split(sep);
    if (parts.length > 2) {
      // Several of one mark: digit grouping only ("1.000.000", "1,000,000").
      if (!validGroups(s, sep)) return null;
      norm = parts.join('');
    } else {
      const grouping = sep !== mark && /^\d{1,3}$/.test(parts[0]) && /^\d{3}$/.test(parts[1]) && parts[0] !== '0';
      norm = grouping ? parts.join('') : `${parts[0]}.${parts[1]}`;
    }
  }
  if (norm.startsWith('.')) norm = `0${norm}`;
  if (norm.endsWith('.')) norm = norm.slice(0, -1);
  if (!/^\d+(\.\d+)?$/.test(norm)) return null;
  const n = sign * Number(norm);
  return Number.isFinite(n) ? (Object.is(n, -0) ? 0 : n) : null;
}

/** "1,234,567" style grouping: first group 1-3 digits, the rest exactly 3. A plain run of digits is fine too. */
function validGroups(int: string, group: string): boolean {
  if (!int.includes(group)) return /^\d*$/.test(int);
  const g = int.split(group);
  return /^\d{1,3}$/.test(g[0]) && g.slice(1).every((x) => /^\d{3}$/.test(x));
}

/** Keeps what's typed to number characters, at most MAX_INPUT long (the field never fills with junk). */
export function cleanInput(text: string): string {
  return text.replace(/[^\d.,\-−–\s]/g, '').slice(0, MAX_INPUT);
}

/** Flips the sign of the typed text ("12" ⇄ "-12"); empty text becomes "-" so the next digits are negative. */
export function toggleSign(text: string): string {
  const s = text.trim();
  if (/^[-−–]/.test(s)) return s.slice(1);
  return `-${s}`;
}

/** A quick-pick value as text in the language's own decimal mark ("21,1" in German). */
export function valueToInput(n: number, mark: '.' | ','): string {
  const s = String(Number(n.toPrecision(12)));
  return mark === ',' ? s.replace('.', ',') : s;
}

// ---- Showing results ----

/** How many decimals a result gets: temperatures 1; others fewer as the number grows (3 under 10, 2 under 100, 1 under 1000, else 0). */
export function resultDigits(n: number, unit: UnitId): number {
  if (UNITS[unit]?.dim === 'temp') return 1;
  const a = Math.abs(n);
  if (a >= 1000) return 0;
  if (a >= 100) return 1;
  if (a >= 10) return 2;
  return 3;
}

/** Rounds to `digits` decimals, never giving -0. */
export function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** A result in the language's own number format ("1,234.6", "1.234,6"), trailing zeros dropped. */
export function formatResult(n: number, unit: UnitId, lang = 'en'): string {
  const digits = resultDigits(n, unit);
  const r = roundTo(n, digits);
  try {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(r);
  } catch {
    return String(r);
  }
}

/** A typed or quick-pick value in the language's number format, up to 3 decimals ("98.6", "21,1", "1,000"). */
export function formatPlain(n: number, lang = 'en'): string {
  const r = roundTo(n, 3);
  try {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: 3 }).format(r);
  } catch {
    return String(r);
  }
}

// ---- Clothing and shoe sizes ----

export const SIZE_SYSTEMS = ['eu', 'uk', 'us', 'jp', 'intl'] as const;
export type SizeSystem = (typeof SIZE_SYSTEMS)[number];
export const SIZE_CHART_IDS = ['womenTops', 'menTops', 'womenShoes', 'menShoes'] as const;
export type SizeChartId = (typeof SIZE_CHART_IDS)[number];
export type SizeRow = Partial<Record<SizeSystem, string>>;
export type SizeChart = { id: SizeChartId; systems: SizeSystem[]; rows: SizeRow[] };

/** AsyncStorage key for the last size chart opened. */
export const SIZE_CHART_KEY = 'satchel.unitsSizeChart.v1';
export const normaliseSizeChart = (v: unknown): SizeChartId =>
  typeof v === 'string' && (SIZE_CHART_IDS as readonly string[]).includes(v) ? (v as SizeChartId) : 'womenTops';

const row = (systems: SizeSystem[], values: (string | number)[]): SizeRow => Object.fromEntries(systems.map((s, i) => [s, String(values[i])]));

const WT: SizeSystem[] = ['intl', 'eu', 'uk', 'us', 'jp'];
const MT: SizeSystem[] = ['intl', 'eu', 'uk', 'us', 'jp'];
const SH: SizeSystem[] = ['eu', 'uk', 'us', 'jp'];

/**
 * General charts, approximate (brands vary). Women's tops / dresses: EU = UK + 28, US = UK − 4, JP = UK − 1.
 * Men's tops: UK / US chest in inches, EU jacket size = chest + 10, JP letters run one size up. Shoes: JP is foot
 * length in cm; UK = US − 2.5 (women) or US − 1 (men).
 */
export const SIZE_CHARTS: Record<SizeChartId, SizeChart> = {
  womenTops: {
    id: 'womenTops',
    systems: WT,
    rows: [
      row(WT, ['XXS', 32, 4, 0, 3]),
      row(WT, ['XS', 34, 6, 2, 5]),
      row(WT, ['S', 36, 8, 4, 7]),
      row(WT, ['M', 38, 10, 6, 9]),
      row(WT, ['M', 40, 12, 8, 11]),
      row(WT, ['L', 42, 14, 10, 13]),
      row(WT, ['L', 44, 16, 12, 15]),
      row(WT, ['XL', 46, 18, 14, 17]),
      row(WT, ['XXL', 48, 20, 16, 19]),
    ],
  },
  menTops: {
    id: 'menTops',
    systems: MT,
    rows: [
      row(MT, ['XS', 44, 34, 34, 'S']),
      row(MT, ['S', 46, 36, 36, 'M']),
      row(MT, ['M', 48, 38, 38, 'L']),
      row(MT, ['L', 50, 40, 40, 'LL']),
      row(MT, ['XL', 52, 42, 42, '3L']),
      row(MT, ['XXL', 54, 44, 44, '4L']),
      row(MT, ['3XL', 56, 46, 46, '5L']),
    ],
  },
  womenShoes: {
    id: 'womenShoes',
    systems: SH,
    rows: [
      row(SH, [35, 2.5, 5, 22]),
      row(SH, [36, 3.5, 6, 23]),
      row(SH, [37, 4, 6.5, 23.5]),
      row(SH, [38, 5, 7.5, 24]),
      row(SH, [39, 6, 8.5, 25]),
      row(SH, [40, 6.5, 9, 25.5]),
      row(SH, [41, 7.5, 10, 26]),
      row(SH, [42, 8, 10.5, 26.5]),
      row(SH, [43, 9, 11.5, 27.5]),
    ],
  },
  menShoes: {
    id: 'menShoes',
    systems: SH,
    rows: [
      row(SH, [39, 6, 7, 24.5]),
      row(SH, [40, 6.5, 7.5, 25]),
      row(SH, [41, 7.5, 8.5, 26]),
      row(SH, [42, 8, 9, 26.5]),
      row(SH, [43, 9, 10, 27.5]),
      row(SH, [44, 9.5, 10.5, 28]),
      row(SH, [45, 10.5, 11.5, 29]),
      row(SH, [46, 11, 12, 29.5]),
      row(SH, [47, 12, 13, 30.5]),
    ],
  },
};

/** The sizes a chart lists for one system, in chart order without repeats (women's "M" covers two rows). */
export function sizeOptions(chart: SizeChart, system: SizeSystem): string[] {
  const out: string[] = [];
  for (const r of chart.rows) {
    const v = r[system];
    if (v != null && !out.includes(v)) out.push(v);
  }
  return out;
}

/** The default "from" system for a chart: the home country's (US / UK / JP), else EU. */
export function homeSizeSystem(homeIso: string | null | undefined, chart: SizeChart): SizeSystem {
  const iso = (homeIso ?? '').toUpperCase();
  const s: SizeSystem = iso === 'US' || iso === 'LR' ? 'us' : iso === 'GB' || iso === 'IE' ? 'uk' : iso === 'JP' ? 'jp' : 'eu';
  return chart.systems.includes(s) ? s : chart.systems[0];
}

const isNumericSize = (v: string) => /^\d+(\.\d+)?$/.test(v);
const cleanSize = (v: string) => v.trim().replace(',', '.').toUpperCase().replace(/^XXXL$/, '3XL');

/** Every row whose size in `system` is exactly `value` ("38", "38,0", "m" all match); [] when none. */
export function findSizes(chart: SizeChart, system: SizeSystem, value: string): SizeRow[] {
  const want = cleanSize(value);
  if (!want) return [];
  const num = parseNumber(want);
  return chart.rows.filter((r) => {
    const v = r[system];
    if (v == null) return false;
    if (num != null && isNumericSize(v)) return Number(v) === num;
    return v.toUpperCase() === want;
  });
}

export type SizeMatch = { rows: SizeRow[]; exact: boolean; /** The chart's size in `system` that was matched. */ size: string };

/**
 * The chart row(s) for a typed size: exact when listed, otherwise the nearest numeric size in that system (a tie
 * goes up a size: the larger one is the safer try-on for shoes). null for an empty / unknown letter size, or a number
 * further than two chart steps outside the chart.
 */
export function lookupSize(chart: SizeChart, system: SizeSystem, value: string): SizeMatch | null {
  const exact = findSizes(chart, system, value);
  if (exact.length) return { rows: exact, exact: true, size: exact[0][system] as string };
  const n = parseNumber(cleanSize(value));
  if (n == null) return null;
  const nums = sizeOptions(chart, system)
    .filter(isNumericSize)
    .map(Number);
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const step = sorted.length > 1 ? Math.max(...sorted.slice(1).map((v, i) => v - sorted[i])) : 1;
  if (n < sorted[0] - 2 * step || n > sorted[sorted.length - 1] + 2 * step) return null;
  let best = sorted[0];
  for (const v of sorted) {
    const d = Math.abs(v - n);
    const bd = Math.abs(best - n);
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && v > best)) best = v;
  }
  const rows = findSizes(chart, system, String(best));
  return rows.length ? { rows, exact: false, size: String(best) } : null;
}

/** The size in `to` for a size in `from`, or null (several rows give a range like "38–40"). */
export function convertSize(chart: SizeChart, from: SizeSystem, value: string, to: SizeSystem): string | null {
  const m = lookupSize(chart, from, value);
  if (!m) return null;
  const vals = m.rows.map((r) => r[to]).filter((v): v is string => v != null);
  const uniq = vals.filter((v, i) => vals.indexOf(v) === i);
  if (!uniq.length) return null;
  return uniq.length === 1 ? uniq[0] : `${uniq[0]}–${uniq[uniq.length - 1]}`;
}
