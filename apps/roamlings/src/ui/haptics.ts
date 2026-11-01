import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useSettings } from '../store/game';

/** Haptics that respect the user's setting and never throw. Stable between renders. */
export function useHaptics() {
  const { haptics } = useSettings();
  return useMemo(
    () => ({
      tap: () => {
        if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      },
      success: () => {
        if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      },
    }),
    [haptics],
  );
}
