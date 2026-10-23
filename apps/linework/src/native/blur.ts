// Blur material adapter (oversight D72-2, closes T79). expo-blur ships in Expo Go and is installed by the trial kit
// (`npx expo install expo-blur expo-linear-gradient`), but it is required lazily inside try/catch so a missing or
// mismatched module can never crash the app: callers then keep the solid AA fallback colour.
import { useEffect, useState, type ComponentType } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export type BlurViewProps = {
  tint?: string;
  intensity?: number;
  style?: unknown;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
};

let cached: ComponentType<BlurViewProps> | null | undefined;

/** The expo-blur BlurView component, or null when the module is unavailable. Never throws. */
export function getBlurView(): ComponentType<BlurViewProps> | null {
  if (cached !== undefined) return cached;
  try {
    const mod = require('expo-blur') as { BlurView?: ComponentType<BlurViewProps> };
    cached = mod && mod.BlurView ? mod.BlurView : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** True while iOS "Reduce Transparency" is on (always false elsewhere). Solid fallback is used then. */
export function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    try {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then((v) => {
          if (alive) setOn(!!v);
        })
        .catch(() => {});
    } catch {
      // ignore
    }
    let sub: { remove?: () => void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v: boolean) => setOn(!!v)) as { remove?: () => void };
    } catch {
      sub = undefined;
    }
    return () => {
      alive = false;
      try {
        sub?.remove?.();
      } catch {
        // ignore
      }
    };
  }, []);
  return on;
}

export { shouldBlur } from '../core/materials.ts';
