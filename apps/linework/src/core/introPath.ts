// Opening animation geometry (fb-1022c): the brand line from assets/brand/splash-icon.svg, sampled by arc length
// so the pencil can travel along it while the line draws behind it. Pure TS (tested in Node).

/** The brand line, in the logo's motif units (same d as assets/brand/splash-icon.svg). */
export const INTRO_LINE_D =
  'M 214 760 C 300 760, 400 700, 470 600 C 540 500, 560 330, 470 300 C 380 270, 340 420, 430 520 C 500 598, 600 600, 662 556';

type P = readonly [number, number];
const START: P = [214, 760];
const SEGMENTS: readonly (readonly [P, P, P])[] = [
  [[300, 760], [400, 700], [470, 600]],
  [[540, 500], [560, 330], [470, 300]],
  [[380, 270], [340, 420], [430, 520]],
  [[500, 598], [600, 600], [662, 556]],
];

/** The motif group's transform in the 1024 viewBox: translate(-155 -96.35) scale(1.15). */
export const MOTIF = { tx: -155, ty: -96.35, s: 1.15 } as const;
/** Pencil angle in the logo (degrees), kept while drawing. */
export const PENCIL_DEG = -38;

function bez(p0: P, p1: P, p2: P, p3: P, t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Dense polyline of the line in motif units. */
function polyline(stepsPerSegment = 64): [number, number][] {
  const pts: [number, number][] = [[START[0], START[1]]];
  let p0: P = START;
  for (const [p1, p2, p3] of SEGMENTS) {
    for (let i = 1; i <= stepsPerSegment; i++) pts.push(bez(p0, p1, p2, p3, i / stepsPerSegment));
    p0 = p3;
  }
  return pts;
}

/** Length of the line in motif units (what strokeDasharray needs). */
export function introLineLength(): number {
  const pts = polyline();
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return len;
}

/** Motif point → 1024 viewBox point. */
export function toViewBox(p: readonly [number, number]): [number, number] {
  return [p[0] * MOTIF.s + MOTIF.tx, p[1] * MOTIF.s + MOTIF.ty];
}

/**
 * `count` points equally spaced along the line (by length), in viewBox units, with their progress 0..1.
 * Used as Animated interpolation stops for the pencil tip.
 */
export function introSamples(count = 40): { t: number; x: number; y: number }[] {
  const pts = polyline();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = cum[cum.length - 1]!;
  const out: { t: number; x: number; y: number }[] = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const t = k / (count - 1);
    const want = t * total;
    while (j < cum.length - 1 && cum[j]! < want) j++;
    const seg = cum[j]! - cum[j - 1]!;
    const f = seg > 0 ? (want - cum[j - 1]!) / seg : 0;
    const a = pts[j - 1]!;
    const b = pts[j]!;
    const [x, y] = toViewBox([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    out.push({ t, x, y });
  }
  return out;
}

/** Timings (ms). The line draws once; the light runs along it until the app is ready. */
export const INTRO_MS = { draw: 1600, shimmer: 1100, settle: 150, fadeOut: 380 } as const;
