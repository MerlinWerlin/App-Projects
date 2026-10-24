// Haptics that respect the Settings switch.
import * as Haptics from 'expo-haptics';
import { getSettings } from '../store/settings';

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'heavy';

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
    case 'tap':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'heavy':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    default:
      p = Haptics.selectionAsync();
  }
  p.catch(() => {});
}
