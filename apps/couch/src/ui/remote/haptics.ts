import * as Haptics from 'expo-haptics';

/**
 * Haptics pref gate. PrefsProvider (src/state/prefs.tsx) calls setHapticsEnabled
 * whenever the "Haptics" setting changes; default on, like the prototype.
 * Kinds (docs/POLISH.md rule 3): light impact on primary actions, heavy for Power,
 * selection on toggles/sliders/steps, success on completions, warning on problems.
 * Every call is gated and never throws.
 */
let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'none';

function safe(run: () => Promise<unknown> | void): void {
  if (!enabled) return;
  try {
    const p = run();
    if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(() => {});
  } catch {
    // Haptics unavailable (web, simulator): ignore.
  }
}

/** Play a haptic of the given kind. */
export function haptic(kind: HapticKind): void {
  switch (kind) {
    case 'none':
      return;
    case 'light':
      return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    case 'medium':
      return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    case 'heavy':
      return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    case 'selection':
      return safe(() => Haptics.selectionAsync());
    case 'success':
      return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    case 'warning':
      return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }
}

/** A light tap on every key press (prototype "Haptics" setting). Never throws. */
export function tap(): void {
  haptic('light');
}
