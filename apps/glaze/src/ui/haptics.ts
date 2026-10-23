// Haptic feedback that respects the "Haptics" setting (src/store/settings.ts).
// The setting is read from the in-memory cache, which the store refreshes on every change.
import * as Haptics from 'expo-haptics';
import { getSettings } from '../store/settings';

/** light: primary actions · select: toggles/pickers · success: completions · warning. */
export type HapticKind = 'light' | 'select' | 'success' | 'warning';

/** Fire-and-forget haptic; does nothing when haptics are off or unsupported. */
export function haptic(kind: HapticKind = 'select'): void {
  if (!getSettings().haptics) return;
  let p: Promise<void>;
  switch (kind) {
    case 'success':
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'warning':
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'light':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    default:
      p = Haptics.selectionAsync();
  }
  p.catch(() => {});
}
