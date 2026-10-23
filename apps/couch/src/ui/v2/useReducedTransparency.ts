import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when iOS "Reduce Transparency" is on (BlurMaterial then draws a solid fill).
 * React Native core API (works in Expo Go); Android has no such setting and reports false. Never throws.
 */
export function useReducedTransparency(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then((v) => {
          if (alive) setReduced(Boolean(v));
        })
        .catch(() => {});
    } catch {
      // Not available (web/tests).
    }
    let sub: { remove(): void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v: boolean) => setReduced(Boolean(v)));
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
