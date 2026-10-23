// Tiny haptics wrapper. Settings can turn haptics off via setHapticsEnabled(false).
import * as Haptics from 'expo-haptics';

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

/** Light tap for primary actions. */
export function tap(): void {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Selection tick for toggles and chips. */
export function select(): void {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => {});
}

/** Success notification for completions (lock engaged, outline ready, saved). */
export function success(): void {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
