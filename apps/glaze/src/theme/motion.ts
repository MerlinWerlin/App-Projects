// Motion system (docs/POLISH.md rule 1). Every animation in the app reads these values.
// Numbers and maths live in src/core/motion.ts (tested in Node); this file adds reanimated configs.
import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useReduceMotion } from '../ui/useReduceMotion';
import { durations, easeOut, spring as springPreset, staggerDelay } from '../core/motion';

export { durations, MAX_MS, PRESS_SCALE, STAGGER_MS, STAGGER_MAX, staggerDelay } from '../core/motion';

/** The one spring (withSpring config). */
export const springConfig = { damping: springPreset.damping, stiffness: springPreset.stiffness, mass: springPreset.mass };

/** Ease-out curve for withTiming. */
export const easeOutCurve = Easing.bezier(easeOut[0], easeOut[1], easeOut[2], easeOut[3]);

export const timing = {
  fast: { duration: durations.fast, easing: easeOutCurve },
  base: { duration: durations.base, easing: easeOutCurve },
  slow: { duration: durations.slow, easing: easeOutCurve },
} as const;

/**
 * True when movement should be replaced by a fade (or nothing): the Glaze "Reduce motion" setting
 * wins, otherwise the system preference (reanimated's useReducedMotion and AccessibilityInfo).
 */
export function useMotionReduced(): boolean {
  const app = useReduceMotion();
  const sys = useReducedMotion();
  return app || sys;
}

/**
 * Entering animation for list item `index` on first mount: FadeInDown staggered 30 ms (max 8),
 * or a short fade when motion is reduced. Pass `undefined` after first mount to skip.
 */
export function staggerIn(index: number, reduced: boolean) {
  if (reduced) return FadeIn.duration(durations.fast);
  return FadeInDown.delay(staggerDelay(index)).duration(durations.base).easing(easeOutCurve);
}

/** Layout transition for add/remove in lists (none when reduced). */
export function listLayout(reduced: boolean) {
  return reduced ? undefined : LinearTransition.duration(durations.base).easing(easeOutCurve);
}

export const fadeIn = FadeIn.duration(durations.base);
export const fadeOut = FadeOut.duration(durations.fast);
