// The one motion file (starter standard): three durations, timed helpers only. Respect Reduce Motion.
// T50: Animated.timing with an ease-out cubic curve. The owner's standing rule is no bounce and no springs on screen;
// T91 removed the unused spring config and src/theme/motion.test.ts fails if any spring / bounce API comes back.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

export const duration = { fast: 120, base: 200, slow: 320 } as const;
export const pressScale = 0.97;
/** Duration to use given the Reduce Motion setting. */
export const dur = (ms: number, reduceMotion: boolean) => (reduceMotion ? 0 : ms);

/** The house curve: quick start, soft landing, never overshoots. */
export const easeOut = Easing.out(Easing.cubic);
/** Distance (pt) a view rises while it fades in. */
export const RISE = 12;

/** A timed tween of `value` to `toValue` (no overshoot). Duration 0 with Reduce Motion. */
export function timed(value: Animated.Value, toValue: number, ms: number = duration.base, reduceMotion = false, delay = 0) {
  return Animated.timing(value, { toValue, duration: dur(ms, reduceMotion), delay: reduceMotion ? 0 : delay, easing: easeOut, useNativeDriver: true });
}

/** Fade a value to 1 (fadeIn) or 0 (fadeOut). */
export const fadeIn = (v: Animated.Value, reduceMotion = false, ms: number = duration.base, delay = 0) => timed(v, 1, ms, reduceMotion, delay);
export const fadeOut = (v: Animated.Value, reduceMotion = false, ms: number = duration.fast) => timed(v, 0, ms, reduceMotion);

/**
 * Opacity + rise for a view that appears on mount: returns a style to put on an Animated.View.
 * With Reduce Motion it starts fully shown and never moves.
 */
export function useFadeRise(reduceMotion: boolean, delay = 0, ms: number = duration.slow) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const a = timed(progress, 1, ms, false, delay);
    a.start();
    return () => a.stop();
  }, [progress, reduceMotion, delay, ms]);
  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) }],
  };
}

/**
 * The system Reduce Motion setting, live. Inside the app prefer useApp().reduceMotion (same value, already read);
 * this hook is for components that may render outside the app provider.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
