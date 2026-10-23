import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when the phone's Reduce Motion setting is on (docs/POLISH.md rule 1).
 * Built on AccessibilityInfo (in React Native core, works in Expo Go). Never throws.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((v) => {
          if (alive) setReduced(Boolean(v));
        })
        .catch(() => {});
    } catch {
      // Not available (web/tests): keep motion on.
    }
    let sub: { remove(): void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => setReduced(Boolean(v)));
    } catch {
      sub = undefined;
    }
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}
