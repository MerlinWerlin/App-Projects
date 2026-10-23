/**
 * Large-title collapse maths (market-1018 M3, docs/DESIGN_V2.md). Pure TS, tested in Node.
 *
 * The large title scrolls with the content and slides under the translucent bar. When it is about to
 * disappear, the inline (small) title and the bar's material + hairline fade in over FADE pt of scroll.
 * Pulling down (overscroll) grows the large title slightly from its start edge, as on iOS.
 * Reduce Motion: the swap is a step (no fade band) and the overscroll growth is off.
 *
 * Ranges are for Animated.Value.interpolate with extrapolate 'clamp' (inputRange strictly increasing).
 */

/** Scroll distance over which the inline title and bar fade in. */
export const FADE = 12;
/** Overscroll distance (pt) at which the large title reaches MAX_GROW. */
export const PULL = 120;
export const MAX_GROW = 1.1;

export interface Range {
  inputRange: number[];
  outputRange: number[];
}

export interface CollapseRanges {
  /** Opacity of the inline title in the bar. */
  inlineOpacity: Range;
  /** Opacity of the bar material and hairline. */
  barOpacity: Range;
  /** Scale of the large title (overscroll growth). */
  largeScale: Range;
}

/**
 * Scroll offset at which the header counts as collapsed: the large title's measured height (it grows
 * with Dynamic Type and wraps, so it is measured, never assumed). At least 1.
 */
export function collapseThreshold(largeTitleHeight: number): number {
  return Number.isFinite(largeTitleHeight) && largeTitleHeight > 1 ? Math.round(largeTitleHeight) : 1;
}

/** 0 (expanded) .. 1 (collapsed) for a scroll offset. */
export function collapseProgress(scrollY: number, threshold: number, reduceMotion = false): number {
  const t = collapseThreshold(threshold);
  const y = Number.isFinite(scrollY) ? scrollY : 0;
  if (reduceMotion) return y >= t ? 1 : 0;
  const fade = Math.min(FADE, t);
  return Math.max(0, Math.min(1, (y - (t - fade)) / fade));
}

/** True once the large title is under the bar (for accessibility and haptic-free state). */
export function isCollapsed(scrollY: number, threshold: number): boolean {
  return collapseProgress(scrollY, threshold, true) === 1;
}

export function collapseRanges(threshold: number, reduceMotion: boolean): CollapseRanges {
  const t = collapseThreshold(threshold);
  const fade = reduceMotion ? 0.5 : Math.min(FADE, t);
  const start = t - fade;
  const fadeIn: Range = { inputRange: [start, t], outputRange: [0, 1] };
  return {
    inlineOpacity: fadeIn,
    barOpacity: { inputRange: [start, t], outputRange: [0, 1] },
    largeScale: reduceMotion ? { inputRange: [-PULL, 0], outputRange: [1, 1] } : { inputRange: [-PULL, 0], outputRange: [MAX_GROW, 1] },
  };
}

/** Evaluate a clamped range at x (the same maths Animated.interpolate does, for tests and fallbacks). */
export function evaluate(range: Range, x: number): number {
  const { inputRange: i, outputRange: o } = range;
  if (i.length === 0 || o.length !== i.length) return 0;
  if (x <= i[0]!) return o[0]!;
  for (let k = 1; k < i.length; k++) {
    if (x <= i[k]!) {
      const a = i[k - 1]!;
      const b = i[k]!;
      const f = b === a ? 1 : (x - a) / (b - a);
      return o[k - 1]! + f * (o[k]! - o[k - 1]!);
    }
  }
  return o[o.length - 1]!;
}

/** transformOrigin that keeps the large title pinned to its start edge while it grows (RTL-safe). */
export function startOrigin(isRtl: boolean): string {
  return isRtl ? 'right top' : 'left top';
}
