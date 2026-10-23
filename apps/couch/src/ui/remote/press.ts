/**
 * Press feel per remote theme (owner-1017 T56). Pure TS: the theme's press style sets how far a key
 * dips and how heavy its haptic is. Never what the key sends. Power keeps its heavy haptic and
 * selection/success/warning cues keep their meaning in every theme.
 */
import { PRESS_SCALE, type PressStyle } from '../../theme/remoteThemes';

/** Same union as HapticKind in ./haptics (kept here so this file stays free of expo imports). */
export type PressHaptic = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'none';

/** Scale a key dips to while pressed. */
export function keyPressScale(style: PressStyle): number {
  return PRESS_SCALE[style];
}

/**
 * Haptic for a key press under a press style. Only the everyday key weights move:
 * light (keys): soft → selection tick, firm → light, click → medium;
 * medium (OK): soft → light, firm → medium, click → heavy.
 */
export function themedHaptic(kind: PressHaptic, style: PressStyle): PressHaptic {
  if (kind === 'light') return style === 'soft' ? 'selection' : style === 'click' ? 'medium' : 'light';
  if (kind === 'medium') return style === 'soft' ? 'light' : style === 'click' ? 'heavy' : 'medium';
  return kind;
}
