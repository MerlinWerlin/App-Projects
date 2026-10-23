/**
 * Motion tokens (premium polish, docs/POLISH.md rule 1). Every animation in the app reads these.
 * Pure TS (no React Native import) so it is unit-tested in Node; components turn the values into
 * RN Animated configs (useNativeDriver: true, transform/opacity only).
 */

/** Durations in ms. */
export const duration = { fast: 120, base: 200, slow: 320 } as const;

/** The one spring preset (RN Animated.spring accepts stiffness/damping/mass). */
export const spring = { damping: 18, stiffness: 220, mass: 1 } as const;

/** Ease-out curve as cubic-bezier control points: Easing.bezier(...easeOut). */
export const easeOut = [0.22, 1, 0.36, 1] as const;

/** Press feedback: buttons and cards scale to this while held. */
export const pressScale = 0.97;

/** Navigation: tab cross-fade and the ceiling for any screen transition. */
export const nav = { tabFade: 150, maxTransition: 350 } as const;

/** List entrance: staggered FadeInDown on first mount only. */
export const list = { stagger: 30, maxStaggered: 8, rise: 8 } as const;

/** Loading over this long shows a skeleton (shorter loads show nothing). */
export const skeletonDelay = 300;
/** Shimmer sweep period. */
export const shimmerPeriod = 1200;

/** Delay for the i-th list item's entrance: 30 ms steps, capped after 8 items (later items enter with the 8th). */
export function staggerDelay(index: number): number {
  const i = Math.max(0, Math.floor(Number.isFinite(index) ? index : 0));
  return Math.min(i, list.maxStaggered - 1) * list.stagger;
}

/** An entrance with Reduce Motion: no movement, a short fade only. */
export interface Entrance {
  delay: number;
  duration: number;
  /** Starting translateY in px (0 = no movement). */
  fromY: number;
}

export function entrance(index: number, reduceMotion: boolean): Entrance {
  if (reduceMotion) return { delay: 0, duration: duration.fast, fromY: 0 };
  return { delay: staggerDelay(index), duration: duration.base, fromY: list.rise };
}

/** Effective press scale (no scaling with Reduce Motion: opacity feedback only). */
export function pressedScale(reduceMotion: boolean): number {
  return reduceMotion ? 1 : pressScale;
}
