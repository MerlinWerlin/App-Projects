// Shape morph (polish G2): when the icon shape changes, preview icons morph their outline from
// the old shape to the new one. Every shape outline is sampled to the same number of points by
// casting rays from the icon centre at fixed angles (all Glaze shapes are star-shaped around the
// centre), so point i of one shape lines up with point i of any other and a plain lerp morphs.
// Pure TS (no React Native) so Node can run and test it; IconCanvas drives the animation and
// swaps back to the exact shapePath() string when the morph ends. Captures never morph.

import type { IconShape } from './iconspec.ts';
import { clamp, durations, easeOut, lerp } from './motion.ts';
import { blobPoints, fmt, ROUNDED_RADIUS, SQUARE_RADIUS, SQUIRCLE_N, superellipsePoints, type Point } from './shapes.ts';

/** Points per sampled outline. A multiple of 8 so rays hit the exact corners and edge midpoints. */
export const MORPH_POINTS = 96;
/** Morph length in ms (the motion system's slow duration, within MAX_MS). */
export const MORPH_MS: number = durations.slow;

const TAU = Math.PI * 2;

/** Dense polygon of a rounded square (radius as a fraction of size), clockwise from the top edge. */
function roundedRectOutline(size: number, radiusFraction: number, perCorner: number = 16): Point[] {
  const r = clamp(radiusFraction, 0, 0.5) * size;
  const s = size;
  const corners: { cx: number; cy: number; start: number }[] = [
    { cx: s - r, cy: r, start: -Math.PI / 2 },
    { cx: s - r, cy: s - r, start: 0 },
    { cx: r, cy: s - r, start: Math.PI / 2 },
    { cx: r, cy: r, start: Math.PI },
  ];
  const out: Point[] = [];
  for (const k of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const t = k.start + (i / perCorner) * (Math.PI / 2);
      out.push({ x: k.cx + r * Math.cos(t), y: k.cy + r * Math.sin(t) });
    }
  }
  return out;
}

/** Dense polygon along the same Catmull-Rom curve smoothClosedPath draws (tension 1). */
function smoothClosedOutline(pts: Point[], stepsPerSegment: number = 12): Point[] {
  const n = pts.length;
  const k = 1 / 6;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
    const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
    for (let j = 0; j < stepsPerSegment; j++) {
      const t = j / stepsPerSegment;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      out.push({
        x: a * p1.x + b * c1.x + c * c2.x + d * p2.x,
        y: a * p1.y + b * c1.y + c * c2.y + d * p2.y,
      });
    }
  }
  return out;
}

/** A dense closed polygon tracing `shape` in a size×size box (same geometry as shapePath). */
export function shapeOutline(shape: IconShape, size: number, seed: number | string = 0): Point[] {
  const s = Math.max(1, Number.isFinite(size) ? size : 1);
  switch (shape) {
    case 'circle': {
      const r = s / 2;
      const out: Point[] = [];
      for (let i = 0; i < 192; i++) {
        const t = (i / 192) * TAU;
        out.push({ x: r + r * Math.cos(t), y: r + r * Math.sin(t) });
      }
      return out;
    }
    case 'rounded':
      return roundedRectOutline(s, ROUNDED_RADIUS);
    case 'square':
      return roundedRectOutline(s, SQUARE_RADIUS, 6);
    case 'blob':
      return smoothClosedOutline(blobPoints(s, seed));
    case 'squircle':
    default:
      return superellipsePoints(s, SQUIRCLE_N, 256);
  }
}

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

/**
 * Resample a closed polygon (star-shaped around `c`) to `n` points: point i is where the ray at
 * angle -90° + 360°·i/n (top, then clockwise on screen) leaves the polygon.
 */
export function radialSample(poly: Point[], n: number, c: Point): Point[] {
  const count = Math.max(3, Math.floor(n));
  const out: Point[] = [];
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (i / count) * TAU;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let best = 0;
    for (let j = 0; j < poly.length; j++) {
      const p = poly[j];
      const q = poly[(j + 1) % poly.length];
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const denom = cross(dx, dy, ex, ey);
      if (Math.abs(denom) < 1e-12) continue;
      const wx = p.x - c.x;
      const wy = p.y - c.y;
      const t = cross(wx, wy, ex, ey) / denom;
      const u = cross(wx, wy, dx, dy) / denom;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t > best) best = t;
    }
    out.push({ x: c.x + dx * best, y: c.y + dy * best });
  }
  return out;
}

/** `shape` sampled to `n` aligned points (see radialSample). */
export function sampleShape(shape: IconShape, size: number, seed: number | string = 0, n: number = MORPH_POINTS): Point[] {
  const s = Math.max(1, Number.isFinite(size) ? size : 1);
  return radialSample(shapeOutline(shape, s, seed), n, { x: s / 2, y: s / 2 });
}

/** Point-wise lerp of two outlines with the same point count. */
export function lerpPoints(a: Point[], b: Point[], t: number): Point[] {
  if (a.length !== b.length) throw new Error('lerpPoints needs outlines with the same point count');
  const k = Number.isFinite(t) ? t : 0;
  return a.map((p, i) => ({ x: lerp(p.x, b[i].x, k), y: lerp(p.y, b[i].y, k) }));
}

/** Closed polyline path string through `pts`. */
export function pointsToPath(pts: Point[]): string {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join('') + 'Z';
}

/** SVG path of the outline `t` of the way from `from` to `to`. */
export function morphPath(from: Point[], to: Point[], t: number): string {
  return pointsToPath(lerpPoints(from, to, t));
}

/** CSS-style cubic-bezier easing (x1, x2 in 0..1) as a function of progress 0..1. */
export function cubicBezierEase(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bez = (t: number, a: number, b: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  const dBez = (t: number, a: number, b: number) => {
    const u = 1 - t;
    return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
  };
  return (x: number) => {
    const p = clamp(x, 0, 1);
    if (p === 0 || p === 1) return p;
    // Newton first, bisection fallback (x(t) is monotonic for x1, x2 in 0..1).
    let t = p;
    for (let i = 0; i < 8; i++) {
      const err = bez(t, x1, x2) - p;
      if (Math.abs(err) < 1e-7) return bez(t, y1, y2);
      const d = dBez(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = p;
    for (let i = 0; i < 40; i++) {
      const v = bez(t, x1, x2);
      if (Math.abs(v - p) < 1e-7) break;
      if (v < p) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return bez(t, y1, y2);
  };
}

/** The motion system's ease-out curve. */
export const morphEase: (t: number) => number = cubicBezierEase(easeOut[0], easeOut[1], easeOut[2], easeOut[3]);

/** Eased morph progress (0..1) after `elapsedMs`; 1 once `durationMs` has passed. */
export function morphProgress(elapsedMs: number, durationMs: number = MORPH_MS): number {
  if (!(durationMs > 0)) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return morphEase(Math.min(1, elapsedMs / durationMs));
}
