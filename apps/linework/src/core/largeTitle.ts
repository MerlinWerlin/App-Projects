// Large-title collapse maths (docs/DESIGN_V2.md §5): the title goes 34 → 17 pt over the first 52 pt of scroll and
// the GlassBar fades in behind the inline title. Pure TS: the UI turns these into Animated.interpolate configs
// (transform scale + opacity, so the native driver can run them); node tests check the numbers.

export const LARGE_TITLE = { from: 34, to: 17, distance: 52 } as const;

/** Collapse progress 0 (expanded) … 1 (collapsed) for a scroll offset; negative (overscroll) and NaN give 0. */
export function collapseProgress(scrollY: number, distance: number = LARGE_TITLE.distance): number {
  if (!Number.isFinite(scrollY) || !(distance > 0)) return 0;
  return Math.min(1, Math.max(0, scrollY / distance));
}

/** Title font size at a progress (linear 34 → 17). */
export function titleFontSize(progress: number, from: number = LARGE_TITLE.from, to: number = LARGE_TITLE.to): number {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return from + (to - from) * p;
}

/** The same as a scale factor on the large title (1 → 0.5), which the native driver can animate. */
export function titleScale(progress: number): number {
  return titleFontSize(progress) / LARGE_TITLE.from;
}

/** True once the inline title should be the one read by screen readers / shown under Reduce Motion. */
export function isCollapsed(scrollY: number, distance: number = LARGE_TITLE.distance): boolean {
  return collapseProgress(scrollY, distance) >= 1;
}

export type Interp = { inputRange: number[]; outputRange: number[] };
export type CollapseInterpolation = {
  /** Large title scale (transform). */
  largeScale: Interp;
  /** Large title opacity. */
  largeOpacity: Interp;
  /** Inline (collapsed) title and GlassBar opacity. */
  barOpacity: Interp;
};

/**
 * Interpolation configs for an Animated scroll value (use with extrapolate: 'clamp').
 * Reduce Motion: no scaling; the large title and the bar swap at the end of the distance (a 1 pt step, which
 * reads as an instant swap rather than an animation).
 */
export function collapseInterpolation(reduce: boolean, distance: number = LARGE_TITLE.distance): CollapseInterpolation {
  const d = distance > 1 ? distance : 1;
  if (reduce) {
    const step = [d - 1, d];
    return {
      largeScale: { inputRange: [0, d], outputRange: [1, 1] },
      largeOpacity: { inputRange: step, outputRange: [1, 0] },
      barOpacity: { inputRange: step, outputRange: [0, 1] },
    };
  }
  return {
    largeScale: { inputRange: [0, d], outputRange: [1, titleScale(1)] },
    // the large title fades over the last 40% so it hands over to the inline title without a double image
    largeOpacity: { inputRange: [0, d * 0.6, d], outputRange: [1, 1, 0] },
    barOpacity: { inputRange: [d * 0.6, d], outputRange: [0, 1] },
  };
}
