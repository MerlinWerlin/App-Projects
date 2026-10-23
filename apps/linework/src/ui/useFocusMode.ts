// Trace "focus mode" (docs/POLISH.md L1): the glass control clusters fade out after focusIdleMs with no touch
// and fade back on the first tap. The idle decision is the pure focusHidden() from src/core/motion.ts.
// Off while a screen reader is running (VoiceOver/TalkBack users always keep the controls) and paused while
// the app is in the background.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { focusHidden } from '../core/motion';
import { duration, fadeTo, focusIdleMs, useAppActive, useReduceMotion } from '../theme/motion';

export type FocusMode = {
  /** True while the controls are faded out. Hidden clusters must use pointerEvents="none". */
  hidden: boolean;
  /** Native-driven opacity for the control clusters (1 shown, 0 hidden). */
  opacity: Animated.Value;
  /** Call on every touch start/end anywhere on the screen: resets the idle timer and wakes the controls. */
  wake: () => void;
  /** Call on touch move: keeps the controls up during long pinches/drags without re-rendering. */
  nudge: () => void;
};

/** True while VoiceOver / TalkBack is on; follows changes live. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (alive) setOn(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => setOn(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

/**
 * @param wanted  the screen allows focus mode right now (e.g. not behind a sheet or another screen)
 * @param holding a control is being held (opacity slider drag): never hide while true
 */
export function useFocusMode({ wanted, holding }: { wanted: boolean; holding: boolean }): FocusMode {
  const screenReader = useScreenReader();
  const appActive = useAppActive();
  const reduce = useReduceMotion();
  const enabled = wanted && appActive && !screenReader;

  const [hidden, setHidden] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const lastTouchAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef({ enabled, holding });
  live.current = { enabled, holding };

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    clear();
    const { enabled: on, holding: held } = live.current;
    if (!on || held) return;
    const wait = Math.max(0, lastTouchAt.current + focusIdleMs - Date.now());
    timer.current = setTimeout(function check() {
      timer.current = null;
      const now = Date.now();
      const st = live.current;
      if (!st.enabled || st.holding) return; // the hold-end / re-enable path reschedules
      if (focusHidden({ enabled: st.enabled, holding: st.holding, lastTouchAt: lastTouchAt.current, now })) {
        setHidden(true);
      } else {
        timer.current = setTimeout(check, Math.max(16, lastTouchAt.current + focusIdleMs - now));
      }
    }, wait);
  }, [clear]);

  const wake = useCallback(() => {
    lastTouchAt.current = Date.now();
    setHidden(false);
    schedule();
  }, [schedule]);

  const nudge = useCallback(() => {
    lastTouchAt.current = Date.now();
  }, []);

  // Enabling, disabling, holding and returning from the background all restart the idle period from now.
  useEffect(() => {
    lastTouchAt.current = Date.now();
    if (!enabled || holding) {
      clear();
      setHidden(false);
      return;
    }
    schedule();
    return clear;
  }, [enabled, holding, schedule, clear]);

  useEffect(() => clear, [clear]);

  // Fade out slowly, come back quickly. Reduce Motion: fadeTo already shortens to duration.fast.
  useEffect(() => {
    const a = hidden ? fadeTo(opacity, 0, reduce, duration.slow) : fadeTo(opacity, 1, reduce, duration.fast);
    a.start();
    return () => a.stop();
  }, [hidden, reduce, opacity]);

  return { hidden, opacity, wake, nudge };
}
