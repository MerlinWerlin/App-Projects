// Outline style plumbing (T54): the Prepare style travels to /trace as a route param so the sketch
// steps use the same line engine, and the default style is a user setting (D72-1).
// Pure: no React Native imports.

import type { OutlineStyle } from './outline.ts';
import type { PresetId } from './outlinePresets.ts';

export const OUTLINE_STYLES: readonly OutlineStyle[] = ['classic', 'sketch', 'lineart', 'bold'];

/** Default style Prepare starts with: 'classic' is the "Best match" preset (unchanged behaviour). */
export const DEFAULT_OUTLINE_STYLE: OutlineStyle = 'classic';

export function isOutlineStyle(v: unknown): v is OutlineStyle {
  return typeof v === 'string' && (OUTLINE_STYLES as readonly string[]).includes(v);
}

/**
 * Route param (string, string[] from a repeated param, or missing) -> a valid style, else undefined.
 * Case and surrounding spaces are tolerated; anything else is rejected rather than guessed.
 */
export function parseStyleParam(v: unknown): OutlineStyle | undefined {
  const first = Array.isArray(v) ? v[0] : v;
  if (typeof first !== 'string') return undefined;
  const s = first.trim().toLowerCase();
  return isOutlineStyle(s) ? s : undefined;
}

/** The Prepare preset that starts with a style ('classic' -> "Best match"). */
export function presetForStyle(style: OutlineStyle): PresetId {
  switch (style) {
    case 'sketch':
      return 'sketch';
    case 'lineart':
      return 'lineart';
    case 'bold':
      return 'boldlines';
    default:
      return 'best';
  }
}

/** Preset name ids shown for each style in Settings (`prepare.preset.<id>.name`). */
export const STYLE_OPTIONS: readonly { style: OutlineStyle; preset: PresetId }[] = OUTLINE_STYLES.map((style) => ({
  style,
  preset: presetForStyle(style),
}));
