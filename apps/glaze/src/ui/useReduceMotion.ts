// True when animations should be reduced: the Glaze setting (on/off) wins, otherwise the
// iOS/Android "Reduce Motion" preference. Re-renders when either changes.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { shouldReduceMotion } from '../core/settings';
import { useSettings } from '../store/settings';

export function useReduceMotion(): boolean {
  const { settings } = useSettings();
  const [system, setSystem] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setSystem(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      if (alive) setSystem(v);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return shouldReduceMotion(settings, system);
}
