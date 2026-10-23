// Shared motion for the premium polish (docs/POLISH.md rule 1). Every animation reads these values.
// Uses React Native's Animated with the native driver (transform/opacity on the UI thread); no reanimated.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing } from 'react-native';
import {
  duration,
  easeOutBezier,
  focusIdleMs,
  opacityDetents,
  pressScale,
  pressScaleV2,
  selectPop,
  spring,
  stagger,
  staggerDelay,
} from '../core/motion';

export { duration, focusIdleMs, opacityDetents, pressScale, pressScaleV2, selectPop, spring, stagger, staggerDelay };

/** Ease-out curve for timing animations. */
export const easeOut = Easing.bezier(easeOutBezier[0], easeOutBezier[1], easeOutBezier[2], easeOutBezier[3]);

/** Spring config for Animated.spring (always pair with useNativeDriver: true on transform/opacity). */
export const springConfig = { damping: spring.damping, stiffness: spring.stiffness, mass: spring.mass, useNativeDriver: true };

/**
 * True while the OS "Reduce Motion" setting is on (iOS Reduce Motion, Android "Remove animations").
 * Starts false until the async query resolves, then follows changes live.
 * With it on: movement is replaced by a short fade (duration.fast) or nothing.
 */
// Last known value, so components mounted after the first answer (list items, press feedback, entrances that
// read it on their first frame) start correct instead of animating once with the default.
let lastReduce = false;

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(lastReduce);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        lastReduce = v;
        if (alive) setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      lastReduce = v;
      setReduce(v);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** True while the app is in the foreground. Idle/looping animations pause when this is false. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** Fade (0 → 1) on a native-driven value. Reduced motion: a short fade. */
export function fadeTo(v: Animated.Value, toValue: number, reduce: boolean, ms: number = duration.base): Animated.CompositeAnimation {
  return Animated.timing(v, { toValue, duration: reduce ? duration.fast : ms, easing: easeOut, useNativeDriver: true });
}

/**
 * Selection pop (design v2): 1 → selectPop.peak → 1 with the spring. Reduced motion: nothing moves (the value
 * snaps to 1); the selected state is shown by colour and ring alone.
 */
export function popTo(v: Animated.Value, reduce: boolean): Animated.CompositeAnimation {
  if (reduce) return Animated.timing(v, { toValue: 1, duration: 0, useNativeDriver: true });
  return Animated.sequence([
    Animated.timing(v, { toValue: selectPop.peak, duration: duration.fast, easing: easeOut, useNativeDriver: true }),
    Animated.spring(v, { toValue: 1, ...springConfig }),
  ]);
}

/** Spring to a value; reduced motion jumps with a short timing instead. */
export function springTo(v: Animated.Value, toValue: number, reduce: boolean): Animated.CompositeAnimation {
  if (reduce) return Animated.timing(v, { toValue, duration: 0, useNativeDriver: true });
  return Animated.spring(v, { toValue, ...springConfig });
}

/**
 * Entrance value for a list item: animates 0 → 1 once on first mount, delayed by its stagger slot.
 * Items past the stagger cap (or with reduced motion) start at 1. Use as opacity and for an 8 pt rise:
 *   style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [stagger.rise, 0] }) }] }}
 */
export function useEntrance(index: number, enabled: boolean = true): Animated.Value {
  const reduce = useReduceMotion();
  const delay = staggerDelay(index);
  const start = enabled && delay !== null ? 0 : 1;
  const v = useRef(new Animated.Value(start)).current;
  useEffect(() => {
    if (start === 1) return;
    // `reduce` here is the first-render value: correct once any screen has resolved the setting (lastReduce).
    const a = Animated.timing(v, {
      toValue: 1,
      duration: reduce ? duration.fast : duration.base,
      delay: reduce ? 0 : delay ?? 0,
      easing: easeOut,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
    // first mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

/** Style for an entrance value (fade + rise; rise dropped under reduced motion by the caller passing reduce). */
export function entranceStyle(v: Animated.Value, reduce: boolean = false) {
  return reduce
    ? { opacity: v }
    : { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [stagger.rise, 0] }) }] };
}
