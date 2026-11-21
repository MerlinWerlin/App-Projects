// Dreamroom display type (DESIGN.md §3): the Unbounded face for titles and theme names.
// `displayStyle(script, role)` goes LAST in a style array, after the system role and
// textStyleFor(script, ...): in Latin scripts it swaps in Unbounded at the display size; in
// every other script it returns nothing, so the system role (and its script line height) stays.
// fontWeight is 'normal' because the weight lives in the font file (Unbounded_700Bold): a numeric
// weight on a custom family can make iOS fall back to the system font.
import type { TextStyle } from 'react-native';
import { brandFontSupports, type Script } from '../core/i18n';
import { displayFamilyV2, displayV2, type DisplayRoleV2 } from '../theme/tokensV2';

const NONE: TextStyle = Object.freeze({}) as TextStyle;
const cache = new Map<string, TextStyle>();

export function displayStyle(script: Script, role: DisplayRoleV2, weight: 'bold' | 'medium' = 'bold'): TextStyle {
  if (!brandFontSupports(script)) return NONE;
  const key = `${role}:${weight}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const style: TextStyle = { ...displayV2[role], fontFamily: displayFamilyV2[weight], fontWeight: 'normal' };
  cache.set(key, style);
  return style;
}
