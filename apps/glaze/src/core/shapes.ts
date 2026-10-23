// Icon geometry: SVG path strings for each IconShape, gradient vectors and the glyph box.
// Pure TS (no React Native / Expo) so Node can run and test it directly.

import type { IconShape } from './iconspec.ts';
import { seededRandom } from './colour.ts';

export type Point = { x: number; y: number };
export type GradientVector = { x1: number; y1: number; x2: number; y2: number };
export type Box = { x: number; y: number; size: number };

export const SHAPES: readonly IconShape[] = Object.freeze(['squircle', 'circle', 'rounded', 'square', 'blob'] as IconShape[]);

/** Display names (shape picker, segmented controls, summaries). */
export const SHAPE_LABELS: Readonly<Record<IconShape, string>> = Object.freeze({
  squircle: 'Squircle',
  circle: 'Circle',
  rounded: 'Rounded',
  square: 'Square',
  blob: 'Blob',
});

/** Superellipse exponent used for the squircle (iOS-like continuous corners). */
export const SQUIRCLE_N = 5;
/** Corner radius of the rounded square as a fraction of the size. */
export const ROUNDED_RADIUS = 0.22;
/**
 * Corner radius of the plain square. A hair of rounding (4%) so the corners don't look chipped
 * when antialiased in previews; on iPhone the square fills iOS's own rounded-square mask edge to
 * edge (that mask's corners are far larger), so it shows as a standard full-bleed app icon.
 */
export const SQUARE_RADIUS = 0.04;
/**
 * Corner radius of the iOS icon mask as a fraction of the icon size (iOS's well-known ~22.37%).
 * iOS draws continuous ("smoothed") corners; see iosMaskPath.
 */
export const IOS_MASK_RADIUS = 0.2237;
/** How far the smoothed iOS corner curve reaches along each edge, relative to the radius. */
export const IOS_MASK_SMOOTHING = 1.528;
export const GLYPH_SCALE_MIN = 0.2;
export const GLYPH_SCALE_MAX = 0.9;
export const GLYPH_SCALE_DEFAULT = 0.5;

/** Round to 3 decimals and drop trailing zeros (short, stable path strings). */
export function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** FNV-1a 32-bit hash: stable numeric seed for a string (e.g. an app id). */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Closed smooth curve through `pts` (Catmull-Rom converted to cubic Béziers).
 * `tension` 1 = standard Catmull-Rom; smaller values tighten the curve.
 */
export function smoothClosedPath(pts: Point[], tension: number = 1): string {
  const n = pts.length;
  if (n < 3) throw new Error('smoothClosedPath needs at least 3 points');
  const k = tension / 6;
  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    d += `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d + 'Z';
}

/** Sample points of a superellipse |x/a|^n + |y/a|^n = 1 filling a size×size box. */
export function superellipsePoints(size: number, n: number = SQUIRCLE_N, samples: number = 64): Point[] {
  const a = size / 2;
  const e = 2 / n;
  const out: Point[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    out.push({
      x: a + a * Math.sign(c) * Math.pow(Math.abs(c), e),
      y: a + a * Math.sign(s) * Math.pow(Math.abs(s), e),
    });
  }
  return out;
}

export function squirclePath(size: number, n: number = SQUIRCLE_N): string {
  return smoothClosedPath(superellipsePoints(size, n, 64), 1);
}

export function circlePath(size: number): string {
  const r = size / 2;
  return `M0 ${fmt(r)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(size)} ${fmt(r)}A${fmt(r)} ${fmt(r)} 0 1 0 0 ${fmt(r)}Z`;
}

export function roundedRectPath(size: number, radiusFraction: number = ROUNDED_RADIUS): string {
  const r = Math.max(0, Math.min(0.5, radiusFraction)) * size;
  const s = size;
  const R = fmt(r);
  return (
    `M${R} 0H${fmt(s - r)}A${R} ${R} 0 0 1 ${fmt(s)} ${R}` +
    `V${fmt(s - r)}A${R} ${R} 0 0 1 ${fmt(s - r)} ${fmt(s)}` +
    `H${R}A${R} ${R} 0 0 1 0 ${fmt(s - r)}` +
    `V${R}A${R} ${R} 0 0 1 ${R} 0Z`
  );
}

/** Control points of an organic blob: 6–8 points, deterministic per seed. */
export function blobPoints(size: number, seed: number | string): Point[] {
  const rnd = seededRandom(typeof seed === 'number' ? seed >>> 0 : hashSeed(seed));
  const count = 6 + Math.floor(rnd() * 3); // 6..8
  const c = size / 2;
  const rot = rnd() * Math.PI * 2;
  const out: Point[] = [];
  for (let i = 0; i < count; i++) {
    const jitter = (rnd() - 0.5) * (Math.PI / count) * 0.6;
    const ang = rot + (i / count) * Math.PI * 2 + jitter;
    // Radius between 0.40 and 0.47 of the size keeps the curve inside the box after smoothing.
    const r = size * (0.4 + rnd() * 0.07);
    out.push({ x: c + r * Math.cos(ang), y: c + r * Math.sin(ang) });
  }
  return out;
}

export function blobPath(size: number, seed: number | string): string {
  return smoothClosedPath(blobPoints(size, seed), 1);
}

/** SVG path for `shape` in a size×size box. `seed` only affects the blob (use the app id). */
export function shapePath(shape: IconShape, size: number, seed: number | string = 0): string {
  switch (shape) {
    case 'circle':
      return circlePath(size);
    case 'rounded':
      return roundedRectPath(size);
    case 'square':
      return roundedRectPath(size, SQUARE_RADIUS);
    case 'blob':
      return blobPath(size, seed);
    case 'squircle':
    default:
      return squirclePath(size);
  }
}

// ---------------------------------------------------------------- iOS web-clip mask

/**
 * Points of the iOS icon mask: a continuous-corner rounded rect. Each corner is a quarter of a
 * superellipse (same maths as the squircle, exponent SQUIRCLE_N) reaching IOS_MASK_RADIUS ×
 * IOS_MASK_SMOOTHING along each edge, joined by straight edges. Clockwise from the top edge.
 */
export function iosMaskPoints(size: number, perCorner: number = 16): Point[] {
  const s = Math.max(0, size);
  const reach = Math.min(0.5, IOS_MASK_RADIUS * IOS_MASK_SMOOTHING) * s;
  const e = 2 / SQUIRCLE_N;
  const steps = Math.max(2, Math.floor(perCorner));
  // Corner centres and the start angle of each quarter (clockwise: top-right, bottom-right, bottom-left, top-left).
  const corners: { cx: number; cy: number; start: number }[] = [
    { cx: s - reach, cy: reach, start: -Math.PI / 2 },
    { cx: s - reach, cy: s - reach, start: 0 },
    { cx: reach, cy: s - reach, start: Math.PI / 2 },
    { cx: reach, cy: reach, start: Math.PI },
  ];
  const out: Point[] = [];
  for (const k of corners) {
    for (let i = 0; i <= steps; i++) {
      const t = k.start + (i / steps) * (Math.PI / 2);
      // Snap float dust (cos(π/2) ≈ 6e-17) so the fractional power can't turn it into a visible nudge.
      const c = Math.abs(Math.cos(t)) < 1e-12 ? 0 : Math.cos(t);
      const sn = Math.abs(Math.sin(t)) < 1e-12 ? 0 : Math.sin(t);
      out.push({
        x: k.cx + reach * Math.sign(c) * Math.pow(Math.abs(c), e),
        y: k.cy + reach * Math.sign(sn) * Math.pow(Math.abs(sn), e),
      });
    }
  }
  return out;
}

/** SVG path of the iOS icon mask in a size×size box (straight edges + smoothed corners). */
export function iosMaskPath(size: number): string {
  const pts = iosMaskPoints(size);
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join('') + 'Z';
}

/** One-line explanation shown with the "How it looks on iPhone" toggle. */
export const IOS_MASK_EXPLAINER =
  'iOS shows every added icon inside its own rounded square; circle and blob shapes appear as artwork inside that square on your chosen backdrop.';

/** Label for previews drawn without the iOS mask. */
export const GLAZE_PREVIEW_LABEL = 'Glaze preview';

/** True when iOS's rounded-square mask visibly changes how this shape looks on the Home Screen. */
export function shapeChangesOnIphone(shape: IconShape): boolean {
  return shape === 'circle' || shape === 'blob';
}

/** What the shape looks like once iOS has masked it (never claims a true circle). */
export function shapeOnIphoneNote(shape: IconShape): string {
  switch (shape) {
    case 'square':
      return 'Square fills iOS’s rounded square edge to edge, like a standard app icon.';
    case 'squircle':
      return 'Squircle is close to iOS’s own shape, so iPhone shows it almost exactly as previewed.';
    case 'rounded':
      return 'Rounded is close to iOS’s own shape, so iPhone shows it almost exactly as previewed.';
    case 'circle':
      return 'On iPhone, your circle sits inside iOS’s rounded square on your backdrop colour.';
    case 'blob':
    default:
      return 'On iPhone, your blob sits inside iOS’s rounded square on your backdrop colour.';
  }
}

/**
 * Gradient end points (0..1, objectBoundingBox units) for a CSS-style angle in degrees:
 * 0 = bottom→top, 90 = left→right, 180 = top→bottom, 270 = right→left.
 */
export function gradientVector(angle: number): GradientVector {
  const deg = Number.isFinite(angle) ? angle : 180;
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a) / 2;
  const dy = -Math.cos(a) / 2;
  const r = (v: number) => Math.round(v * 1e6) / 1e6 + 0; // avoid -0 and float dust
  return { x1: r(0.5 - dx), y1: r(0.5 - dy), x2: r(0.5 + dx), y2: r(0.5 + dy) };
}

export function clampGlyphScale(scale: number): number {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return GLYPH_SCALE_DEFAULT;
  return Math.max(GLYPH_SCALE_MIN, Math.min(GLYPH_SCALE_MAX, scale));
}

/** Square box for the glyph, centred in a size×size icon. */
export function glyphBox(size: number, glyphScale: number): Box {
  const g = size * clampGlyphScale(glyphScale);
  const off = (size - g) / 2;
  return { x: off, y: off, size: g };
}

/** Hairline stroke width for glass backgrounds at a given icon size. */
export function hairline(size: number): number {
  return Math.max(1, size / 180);
}
