// Tap ripple maths (T84, docs/MARKET.md "Design reference 18 Oct" §3): two concentric rings grow from the touch
// point and fade. Each ring runs a 0 → 1 progress value; scale and opacity are keyframes over that progress
// (Animated interpolations with the native driver). No React Native imports.

export const ripple = {
  /** Number of rings per tap. */
  rings: 2,
  /** Delay between rings (ms). */
  stagger: 110,
  /** Duration of one ring (ms). */
  duration: 520,
  /** Ring scale at progress 0 (a dot at the finger); 1 = the full radius. */
  startScale: 0.08,
  /** Opacity peak of the first ring; later rings are fainter. */
  peakOpacity: 0.4,
  /** Each following ring's peak is this fraction of the previous one. */
  falloff: 0.6,
  /** Ring stroke width (points) at full size. */
  stroke: 2,
} as const;

export type Keyframes = { inputRange: number[]; outputRange: number[] };

/** Touch point inside a w×h box; missing or invalid coordinates fall back to the centre, others are clamped. */
export function rippleOrigin(w: number, h: number, x?: number, y?: number): { x: number; y: number } {
  const W = Number.isFinite(w) && w > 0 ? w : 0;
  const H = Number.isFinite(h) && h > 0 ? h : 0;
  const ox = x !== undefined && Number.isFinite(x) ? Math.min(W, Math.max(0, x)) : W / 2;
  const oy = y !== undefined && Number.isFinite(y) ? Math.min(H, Math.max(0, y)) : H / 2;
  return { x: ox, y: oy };
}

/** Radius that reaches the farthest corner from (x, y), so the rings cover the whole control. At least 1. */
export function rippleRadius(w: number, h: number, x: number, y: number): number {
  const o = rippleOrigin(w, h, x, y);
  const W = Math.max(0, w || 0);
  const H = Math.max(0, h || 0);
  const dx = Math.max(o.x, W - o.x);
  const dy = Math.max(o.y, H - o.y);
  return Math.max(1, Math.hypot(dx, dy));
}

/** Start delay (ms) for each ring. */
export function ringDelays(count: number = ripple.rings, stagger: number = ripple.stagger): number[] {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return Array.from({ length: n }, (_, i) => i * stagger);
}

/** Scale keyframes over a ring's progress: a dot at the finger grows to the full radius. */
export function ringScaleKeys(): Keyframes {
  return { inputRange: [0, 1], outputRange: [ripple.startScale, 1] };
}

/** Peak opacity of ring `i` (0-based). */
export function ringPeak(i: number): number {
  return ripple.peakOpacity * Math.pow(ripple.falloff, Math.max(0, i));
}

/** Opacity keyframes for ring `i`: fades in quickly, then out while it keeps growing. */
export function ringOpacityKeys(i: number): Keyframes {
  return { inputRange: [0, 0.15, 1], outputRange: [0, ringPeak(i), 0] };
}

/** Piecewise-linear evaluation of keyframes (clamped), the same as Animated's interpolate with clamp. */
export function evalKeys(k: Keyframes, t: number): number {
  const { inputRange: xs, outputRange: ys } = k;
  if (!Number.isFinite(t) || t <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (t >= xs[last]) return ys[last];
  for (let i = 1; i <= last; i++) {
    if (t <= xs[i]) {
      const f = (t - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + f * (ys[i] - ys[i - 1]);
    }
  }
  return ys[last];
}

/** Total time a tap's ripple takes (last ring's delay + duration). */
export function rippleTotalMs(count: number = ripple.rings): number {
  const d = ringDelays(count);
  return d.length ? d[d.length - 1] + ripple.duration : 0;
}
