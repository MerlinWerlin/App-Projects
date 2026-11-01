import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useSettings } from '../store/settings';

/** Haptics that respect the user's setting and never throw. Stable between renders. */
export function useHaptics() {
  const { haptics } = useSettings();
  return useMemo(
    () => ({
      tap: () => {
        if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      },
      select: () => {
        if (haptics) Haptics.selectionAsync().catch(() => {});
      },
      success: () => {
        if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      },
    }),
    [haptics],
  );
}
