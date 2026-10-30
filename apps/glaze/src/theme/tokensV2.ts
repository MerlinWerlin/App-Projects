// Design v2 tokens (docs/DESIGN_V2.md) for React Native: the app's ONE token set (T163; the v1
// tokens.ts is retired). Numbers and colours live in src/core/designV2.ts (tested in Node); this
// file shapes them into RN styles.
//   type scale  typeV2 / textV2 (named steps: largeTitle ... caption2, button, navTitle, eyebrow);
//               Dynamic Type caps fontScaleCapV2 / fontScaleCap(role) (T173); editorialV2 rhythm
//   spacing     spaceV2 (4-pt grid; xxs 2 is the only half step)
//   radii       chromeRadiusV2 card / control / pill (radiusV2 keeps legacy group/cardLarge/sheet);
//               shapes: iconTileRadius(size), circleRadius(size)
//   elevation   shadowV2(level, scheme) (one layered style; elevationV2 levels)
//   artwork     artFontsV2, brandGlazeV2, onArtV2 (mocks and ink over photos, not chrome)
// Raw colours / font sizes / radii in app/ and src/ui are ratcheted by src/core/designGuard.test.ts.
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import {
  androidElevationV2,
  boxShadowFor,
  darkV2,
  lightV2,
  materialColour,
  materialsV2,
  typeV2,
  type ElevationLevel,
  type MaterialName,
  type PaletteV2,
  type TypeRoleV2,
} from '../core/designV2';

export {
  ICON_TILE_RATIO,
  PASTEL_NAMES,
  artFontsV2,
  brandGlazeV2,
  chromeRadiusV2,
  circleRadius,
  darkV2,
  editorialV2,
  elevationV2,
  eyebrowCaseFor,
  fontScaleCap,
  fontScaleCapV2,
  iconTileRadius,
  largeTitleRanges,
  largeTitleSnapAt,
  lightV2,
  materialsV2,
  onArtV2,
  pressV2,
  radiusV2,
  scrimColour,
  scrimV2,
  sizeV2,
  spaceV2,
  typeV2,
} from '../core/designV2';
export type { ElevationLevel, MaterialName, PaletteV2, Pastel, PastelName, TypeRoleV2 } from '../core/designV2';

export type Scheme = 'light' | 'dark';

/** Text styles in the system font (fontFamily left unset = SF Pro / Roboto). */
export const textV2: { [K in TypeRoleV2]: TextStyle } = Object.fromEntries(
  (Object.keys(typeV2) as TypeRoleV2[]).map((k) => {
    const s = typeV2[k];
    return [k, { fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing }];
  }),
) as { [K in TypeRoleV2]: TextStyle };

/** Tabular figures for numbers that change (clock, timings, sizes, counts). */
export const tabularV2: TextStyle = { fontVariant: ['tabular-nums'] };

/** Continuous (squircle) corners on iOS; Android ignores the key and draws circular corners. */
export const continuous: ViewStyle = { borderCurve: 'continuous' };

const shadowCache = new Map<string, ViewStyle>();

/** Soft layered shadow for a level: `boxShadow` (RN 0.76+) on iOS, `elevation` on Android. */
export function shadowV2(level: ElevationLevel, scheme: Scheme): ViewStyle {
  const key = `${level}:${scheme}`;
  const hit = shadowCache.get(key);
  if (hit) return hit;
  const css = boxShadowFor(level, scheme);
  const style: ViewStyle =
    level === 'flat' ? {} : Platform.OS === 'android' ? { elevation: androidElevationV2[level] } : { boxShadow: css };
  shadowCache.set(key, style);
  return style;
}

/** rgba() fill for a glass material, and its opaque fallback. */
export function materialFill(name: MaterialName, scheme: Scheme): { translucent: string; solid: string; blurIntensity: number } {
  const m = materialsV2[scheme][name];
  return { translucent: materialColour(m), solid: m.fallback, blurIntensity: m.blurIntensity };
}

export function paletteFor(scheme: Scheme): PaletteV2 {
  return scheme === 'dark' ? darkV2 : lightV2;
}
