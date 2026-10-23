// Motion constants and pure animation maths for the premium polish (docs/POLISH.md).
// No React Native imports: src/theme/motion.ts turns these into reanimated configs.

/** Durations in ms. Nothing in the app animates longer than MAX_MS. */
export const durations = { fast: 120, base: 200, slow: 320 } as const;
export const MAX_MS = 350;

/** The one spring preset every spring uses. */
export const spring = { damping: 18, stiffness: 220, mass: 1 } as const;

/** Ease-out cubic-bezier control points (used for timing animations). */
export const easeOut = [0.22, 1, 0.36, 1] as const;

/** Pressed scale for PressableScale. */
export const PRESS_SCALE = 0.97;

/** List stagger: 30 ms per item, only the first 8 items are staggered. */
export const STAGGER_MS = 30;
export const STAGGER_MAX = 8;

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

/** Entering delay for list item `index`; items past STAGGER_MAX share the last delay. */
export function staggerDelay(index: number, step: number = STAGGER_MS, max: number = STAGGER_MAX): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(Math.floor(index), Math.max(0, max - 1)) * step;
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Rubber-band an overscroll distance (iOS-style): the further past the edge, the less it moves.
 * `overshoot` is how far past the edge the finger went (signed), `dimension` the view size.
 */
export function rubberBand(overshoot: number, dimension: number, coefficient: number = 0.55): number {
  if (!Number.isFinite(overshoot) || overshoot === 0 || !(dimension > 0)) return 0;
  const sign = overshoot < 0 ? -1 : 1;
  const x = Math.abs(overshoot);
  return sign * (1 - 1 / ((x * coefficient) / dimension + 1)) * dimension;
}

/** Clamp `value` into [lo, hi] but let it stretch past the edges with rubberBand. */
export function rubberClamp(value: number, lo: number, hi: number, dimension: number): number {
  if (value < lo) return lo + rubberBand(value - lo, dimension);
  if (value > hi) return hi + rubberBand(value - hi, dimension);
  return value;
}

export type Parallax = { translateY: number; scale: number };

/**
 * Parallax for a card's artwork as it crosses the viewport centre.
 * `progress` = (cardCentre - viewportCentre) / viewportHeight, roughly -1..1.
 * The artwork drifts against the scroll (up to `maxShift` pt) and is slightly larger at the centre.
 */
export function parallaxAt(progress: number, maxShift: number = 14, maxScale: number = 0.04): Parallax {
  const p = clamp(progress, -1, 1);
  return { translateY: -p * maxShift, scale: 1 + maxScale * (1 - Math.abs(p)) };
}

/**
 * Ripple order for a grid: delay per cell grows with distance from the origin cell (top-left by default),
 * so icons arrive one by one like a wave. Returns delays in ms, row-major, length = count.
 */
export function rippleDelays(count: number, cols: number, step: number = 40, originCol: number = 0, originRow: number = 0): number[] {
  const n = Math.max(0, Math.floor(count));
  const c = Math.max(1, Math.floor(cols));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % c;
    const row = Math.floor(i / c);
    const d = Math.hypot(col - originCol, row - originRow);
    out.push(Math.round(d * step));
  }
  return out;
}

/** Scale ripple delays so the last icon starts no later than `budget` ms. */
export function fitDelays(delays: number[], budget: number): number[] {
  const max = delays.reduce((m, d) => Math.max(m, d), 0);
  if (max <= budget || max === 0) return delays.slice();
  return delays.map((d) => Math.round((d / max) * budget));
}
