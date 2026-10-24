/** Haptics that respect the Haptics setting and never throw (web, simulators). */
import * as Haptics from 'expo-haptics';

export function tap(enabled: boolean): void {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => undefined);
}

export function thud(enabled: boolean): void {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

export function success(enabled: boolean): void {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
