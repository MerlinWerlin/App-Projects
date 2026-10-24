// Crochet calculators. Pure TS.

import type { Terms } from './terms.ts';

// ---------------------------------------------------------------------------------------------------------
// Increase / decrease evenly

export interface EvenPlan {
  /** Human instruction in US terms, e.g. "[sc 4, inc] x6". */
  text: string;
  /** Number of increases (positive) or decreases (negative). */
  change: number;
  /** Stitch count after the round. */
  result: number;
  /** Groups: how many plain stitches before each inc/dec. */
  groups: number[];
}

function groupsText(groups: number[], op: 'inc' | 'dec'): string {
  // Collapse runs of equal groups: [3,3,3,4,4] -> "[sc 3, inc] x3, [sc 4, inc] x2".
  const parts: string[] = [];
  let i = 0;
  while (i < groups.length) {
    let j = i;
    while (j < groups.length && groups[j] === groups[i]) j++;
    const n = j - i;
    const g = groups[i];
    const body = g === 0 ? op : g === 1 ? `sc, ${op}` : `sc ${g}, ${op}`;
    parts.push(n === 1 ? body : g === 0 ? `${op} x${n}` : `[${body}] x${n}`);
    i = j;
  }
  return parts.join(', ');
}

/** Spread k items as evenly as possible over `slots` positions; returns the gap sizes (sum = total). */
function spread(total: number, k: number): number[] {
  const base = Math.floor(total / k);
  const extra = total - base * k;
  // Put the larger gaps evenly among the smaller ones (Bresenham style) so the shaping stays round.
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < k; i++) {
    const before = Math.floor((acc * extra) / k);
    acc++;
    const after = Math.floor((acc * extra) / k);
    out.push(base + (after - before));
  }
  return out;
}

/**
 * Plan a round going from `current` stitches to `target`. Increases: every group is (g sc, inc), each inc uses 1 st.
 * Decreases: each group is (g sc, dec), each dec uses 2 sts. Returns null when impossible.
 */
export function evenly(current: number, target: number): EvenPlan | null {
  if (!(current > 0 && target > 0) || !Number.isInteger(current) || !Number.isInteger(target)) return null;
  if (target === current) return { text: 'sc in each st around', change: 0, result: current, groups: [] };
  if (target > current) {
    const k = target - current;
    if (k > current) {
      // More than one increase per stitch: can't do with simple inc.
      return null;
    }
    // k incs use k stitches; the other current-k stitches are plain sc spread into k gaps.
    const groups = spread(current - k, k);
    // Sequences that are uniform read better with the gap first: "[sc 2, inc] x6".
    return { text: groupsText(groups, 'inc'), change: k, result: target, groups };
  }
  const k = current - target;
  if (2 * k > current) return null;
  const groups = spread(current - 2 * k, k);
  return { text: groupsText(groups, 'dec'), change: -k, result: target, groups };
}

// ---------------------------------------------------------------------------------------------------------
// Amigurumi ball / round shapes

export interface ShapeOptions {
  /** Stitches added per increase round (6 for a sphere). */
  per?: number;
  /** Increase rounds (largest round = per * incRounds). */
  incRounds: number;
  /** Plain rounds at the widest point. Default = incRounds (a near-round ball). */
  evenRounds?: number;
  /** Decrease back down (ball) or stop after the even rounds (cup, hat). */
  close?: boolean;
  /** Offset the increases on alternate rounds so the shape doesn't go hexagonal. */
  staggered?: boolean;
}

export interface ShapeRound {
  n: number;
  text: string;
  count: number;
}

function incRound(r: number, per: number, staggered: boolean): string {
  // Round r (2-based) goes from per*(r-1) to per*r: (r-2) sc then inc, per times.
  const g = r - 2;
  if (g === 0) return `inc x${per}`;
  if (staggered && r % 2 === 0 && g >= 2) {
    // Split the plain stitches around the inc: sc a, inc, sc b ... keeps the same count.
    const a = Math.floor(g / 2);
    const b = g - a;
    const a1 = a === 1 ? 'sc' : `sc ${a}`;
    const b1 = b === 1 ? 'sc' : `sc ${b}`;
    return `${a1}, [inc, sc ${g}] x${per - 1}, inc, ${b1}`;
  }
  return g === 1 ? `[sc, inc] x${per}` : `[sc ${g}, inc] x${per}`;
}

function decRound(groupSize: number, per: number, staggered: boolean, r: number): string {
  const g = groupSize;
  if (g === 0) return `dec x${per}`;
  if (staggered && r % 2 === 0 && g >= 2) {
    const a = Math.floor(g / 2);
    const b = g - a;
    const a1 = a === 1 ? 'sc' : `sc ${a}`;
    const b1 = b === 1 ? 'sc' : `sc ${b}`;
    return `${a1}, [dec, sc ${g}] x${per - 1}, dec, ${b1}`;
  }
  return g === 1 ? `[sc, dec] x${per}` : `[sc ${g}, dec] x${per}`;
}

/** Generate a classic amigurumi shape (sphere by default) as rounds, in US terms. */
export function amigurumiShape(o: ShapeOptions): ShapeRound[] {
  const per = o.per ?? 6;
  const inc = Math.max(1, Math.min(30, Math.floor(o.incRounds)));
  const even = Math.max(0, Math.floor(o.evenRounds ?? inc));
  const staggered = o.staggered ?? true;
  const out: ShapeRound[] = [];
  out.push({ n: 1, text: `${per} sc in MR`, count: per });
  for (let r = 2; r <= inc; r++) out.push({ n: r, text: incRound(r, per, staggered), count: per * r });
  const max = per * inc;
  if (even > 0) {
    const a = inc + 1;
    const b = inc + even;
    for (let r = a; r <= b; r++) out.push({ n: r, text: 'sc in each st around', count: max });
  }
  if (o.close ?? true) {
    let n = inc + even;
    for (let k = inc - 1; k >= 1; k--) {
      n++;
      // From per*(k+1) down to per*k: groups of (k-1) sc + dec.
      out.push({ n, text: decRound(k - 1, per, staggered, n), count: per * k });
    }
  }
  return out;
}

export function shapeToText(rounds: ShapeRound[], title = 'Ball'): string {
  const lines = [`${title.toUpperCase()}`];
  for (const r of rounds) lines.push(`Rnd ${r.n}: ${r.text} (${r.count})`);
  lines.push('Fasten off, leaving a tail. Weave through the front loops of the last round and pull closed.');
  return lines.join('\n');
}

/** Approximate finished diameter (cm) of a sphere from its widest round and your gauge (sc per 10 cm). */
export function sphereDiameterCm(maxStitches: number, scPer10cm: number): number {
  if (!(maxStitches > 0 && scPer10cm > 0)) return 0;
  const circumference = (maxStitches / scPer10cm) * 10;
  return circumference / Math.PI;
}

/** Inverse: how many increase rounds (6 per round) for a target diameter. */
export function incRoundsForDiameter(diameterCm: number, scPer10cm: number, per = 6): number {
  if (!(diameterCm > 0 && scPer10cm > 0)) return 0;
  const sts = (diameterCm * Math.PI * scPer10cm) / 10;
  return Math.max(2, Math.round(sts / per));
}

// ---------------------------------------------------------------------------------------------------------
// Gauge

/** Stitches needed for a width, from a swatch: `swSts` stitches measured over `swCm` cm. */
export function stitchesForWidth(widthCm: number, swSts: number, swCm: number): number {
  if (!(widthCm > 0 && swSts > 0 && swCm > 0)) return 0;
  return Math.round((widthCm * swSts) / swCm);
}

export function rowsForLength(lengthCm: number, swRows: number, swCm: number): number {
  return stitchesForWidth(lengthCm, swRows, swCm);
}

/** Resize a pattern number when your gauge differs from the pattern's (stitches per 10 cm each). */
export function rescale(patternCount: number, patternGauge: number, yourGauge: number): number {
  if (!(patternCount > 0 && patternGauge > 0 && yourGauge > 0)) return 0;
  return Math.round((patternCount * yourGauge) / patternGauge);
}

/** Foundation chain for a width: stitches + turning chain for the first row's stitch. */
export function foundationChain(stitches: number, firstRowStitch: 'sc' | 'hdc' | 'dc' | 'tr'): number {
  const tch = { sc: 1, hdc: 2, dc: 3, tr: 4 }[firstRowStitch];
  return stitches + tch;
}

// ---------------------------------------------------------------------------------------------------------
// Yarn reference

export interface YarnWeight {
  cyc: number;
  us: string;
  uk: string;
  au: string;
  hookMm: [number, number];
  /** Wraps per inch (typical). */
  wpi: string;
  /** Single crochet stitches per 10 cm (typical range). */
  scPer10: [number, number];
  /** Metres of yarn per cm² of fabric in single crochet (rough). */
  mPerCm2: number;
}

export const YARN_WEIGHTS: ReadonlyArray<YarnWeight> = [
  { cyc: 0, us: 'Lace', uk: '1-2 ply', au: '2 ply', hookMm: [1.5, 2.25], wpi: '30-40+', scPer10: [32, 42], mPerCm2: 0.2 },
  { cyc: 1, us: 'Fingering / sock', uk: '4 ply', au: '4 ply', hookMm: [2.25, 3.5], wpi: '14-30', scPer10: [21, 32], mPerCm2: 0.14 },
  { cyc: 2, us: 'Sport', uk: '5 ply', au: '5 ply', hookMm: [3.5, 4.5], wpi: '12-18', scPer10: [16, 20], mPerCm2: 0.12 },
  { cyc: 3, us: 'DK / light worsted', uk: 'DK', au: '8 ply', hookMm: [4.5, 5.5], wpi: '11-15', scPer10: [12, 17], mPerCm2: 0.1 },
  { cyc: 4, us: 'Worsted / aran', uk: 'Aran', au: '10 ply', hookMm: [5.5, 6.5], wpi: '9-12', scPer10: [11, 14], mPerCm2: 0.085 },
  { cyc: 5, us: 'Bulky / chunky', uk: 'Chunky', au: '12 ply', hookMm: [6.5, 9], wpi: '6-9', scPer10: [8, 11], mPerCm2: 0.06 },
  { cyc: 6, us: 'Super bulky', uk: 'Super chunky', au: '14 ply', hookMm: [9, 15], wpi: '5-6', scPer10: [6, 9], mPerCm2: 0.04 },
  { cyc: 7, us: 'Jumbo', uk: 'Jumbo', au: 'Jumbo', hookMm: [15, 25], wpi: '1-4', scPer10: [1, 5], mPerCm2: 0.025 },
];

export interface HookSize {
  mm: number;
  us?: string;
  uk?: string;
  jp?: string;
}

export const HOOK_SIZES: ReadonlyArray<HookSize> = [
  { mm: 0.75, us: 'Steel 14', jp: '0' },
  { mm: 1.0, us: 'Steel 12' },
  { mm: 1.25, us: 'Steel 10', jp: '2' },
  { mm: 1.5, us: 'Steel 8', jp: '4' },
  { mm: 1.75, us: 'Steel 6', jp: '6' },
  { mm: 2.0, uk: '14', jp: '2/0' },
  { mm: 2.25, us: 'B-1', uk: '13' },
  { mm: 2.5, uk: '12', jp: '4/0' },
  { mm: 2.75, us: 'C-2', uk: '11' },
  { mm: 3.0, uk: '11', jp: '5/0' },
  { mm: 3.25, us: 'D-3', uk: '10' },
  { mm: 3.5, us: 'E-4', uk: '9', jp: '6/0' },
  { mm: 3.75, us: 'F-5' },
  { mm: 4.0, us: 'G-6', uk: '8', jp: '7/0' },
  { mm: 4.5, us: '7', uk: '7', jp: '7.5/0' },
  { mm: 5.0, us: 'H-8', uk: '6', jp: '8/0' },
  { mm: 5.5, us: 'I-9', uk: '5' },
  { mm: 6.0, us: 'J-10', uk: '4', jp: '10/0' },
  { mm: 6.5, us: 'K-10½', uk: '3' },
  { mm: 7.0, uk: '2', jp: '7mm' },
  { mm: 8.0, us: 'L-11', uk: '0', jp: '8mm' },
  { mm: 9.0, us: 'M/N-13', uk: '00' },
  { mm: 10.0, us: 'N/P-15', uk: '000', jp: '10mm' },
  { mm: 12.0 },
  { mm: 15.0, us: 'P/Q' },
  { mm: 16.0, us: 'Q' },
  { mm: 19.0, us: 'S' },
  { mm: 25.0, us: 'T/U/X' },
];

export function hookLabel(mm: number): string {
  const h = HOOK_SIZES.find((x) => Math.abs(x.mm - mm) < 0.01);
  const mmText = `${Number.isInteger(mm) ? mm.toFixed(1) : String(mm)} mm`;
  return h?.us ? `${mmText} (US ${h.us})` : mmText;
}

/** Weight for a hook size, by the CYC ranges. */
export function weightForHook(mm: number): YarnWeight | undefined {
  return YARN_WEIGHTS.find((w) => mm >= w.hookMm[0] && mm < w.hookMm[1]) ?? (mm >= 15 ? YARN_WEIGHTS[7] : undefined);
}

// ---------------------------------------------------------------------------------------------------------
// Yarn estimate

export type StitchFamily = 'sc' | 'hdc' | 'dc' | 'granny' | 'textured' | 'mesh';

const STITCH_FACTOR: Record<StitchFamily, number> = {
  sc: 1,
  hdc: 0.95,
  dc: 0.85,
  granny: 0.85,
  textured: 1.4,
  mesh: 0.6,
};

export interface YarnEstimate {
  metres: number;
  /** Rounded up, with the extra ball crocheters always want. */
  balls?: number;
  low: number;
  high: number;
}

/** Rough yarn needed for a flat piece. ±20%; the UI says so. */
export function estimateYarn(
  widthCm: number,
  lengthCm: number,
  cyc: number,
  stitch: StitchFamily,
  metresPerBall?: number,
): YarnEstimate {
  const w = YARN_WEIGHTS.find((y) => y.cyc === cyc) ?? YARN_WEIGHTS[4];
  const area = Math.max(0, widthCm) * Math.max(0, lengthCm);
  const metres = Math.round(area * w.mPerCm2 * STITCH_FACTOR[stitch]);
  const low = Math.round(metres * 0.8);
  const high = Math.round(metres * 1.2);
  const balls = metresPerBall && metresPerBall > 0 ? Math.ceil(high / metresPerBall) : undefined;
  return { metres, low, high, balls };
}

export interface SizeRef {
  group: 'Blanket' | 'Baby' | 'Hat' | 'Scarf';
  name: string;
  widthCm: number;
  lengthCm: number;
}

/** Common finished sizes (cm). Hats: circumference x height. */
export const SIZES: ReadonlyArray<SizeRef> = [
  { group: 'Blanket', name: 'Lovey / security', widthCm: 30, lengthCm: 30 },
  { group: 'Blanket', name: 'Baby / stroller', widthCm: 76, lengthCm: 91 },
  { group: 'Blanket', name: 'Lapghan', widthCm: 91, lengthCm: 122 },
  { group: 'Blanket', name: 'Throw', widthCm: 127, lengthCm: 152 },
  { group: 'Blanket', name: 'Single / twin', widthCm: 168, lengthCm: 229 },
  { group: 'Blanket', name: 'Double / full', widthCm: 203, lengthCm: 229 },
  { group: 'Blanket', name: 'Queen', widthCm: 229, lengthCm: 254 },
  { group: 'Blanket', name: 'King', widthCm: 274, lengthCm: 254 },
  { group: 'Hat', name: 'Newborn', widthCm: 33, lengthCm: 15 },
  { group: 'Hat', name: 'Baby 3-6 m', widthCm: 41, lengthCm: 17 },
  { group: 'Hat', name: 'Toddler', widthCm: 46, lengthCm: 19 },
  { group: 'Hat', name: 'Child', widthCm: 48, lengthCm: 20 },
  { group: 'Hat', name: 'Teen / adult S', widthCm: 53, lengthCm: 22 },
  { group: 'Hat', name: 'Adult M', widthCm: 56, lengthCm: 23 },
  { group: 'Hat', name: 'Adult L', widthCm: 58, lengthCm: 24 },
  { group: 'Scarf', name: 'Child scarf', widthCm: 13, lengthCm: 110 },
  { group: 'Scarf', name: 'Adult scarf', widthCm: 18, lengthCm: 160 },
  { group: 'Scarf', name: 'Wrap / shawl', widthCm: 50, lengthCm: 180 },
];

/** Hat crown: flat circle diameter for a head circumference (knock off ~2.5 cm for stretch). */
export function hatCrownDiameterCm(headCm: number): number {
  if (!(headCm > 0)) return 0;
  return Math.round(((headCm - 2.5) / Math.PI) * 10) / 10;
}

export function termsLabel(t: Terms): string {
  return t === 'US' ? 'US terms' : 'UK terms';
}
