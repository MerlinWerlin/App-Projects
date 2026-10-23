// Script- and direction-aware layout helpers (docs/I18N.md "Layout rules").
// - textStyleFor(script, base): taller line heights for CJK/Devanagari/Arabic and the system font
//   for scripts Unbounded/Manrope cannot draw.
// - localizedTypeV2(script): v1 role names on the v2 system type scale (T83; the v1 scale went in T84).
// - Chevron: Feather chevron/arrow names that point the right way in RTL.
// - noMirror / noMirrorText: keep phone mocks, artwork, icon previews, wallpapers and the clock LTR.
import type { TextStyle, ViewStyle } from 'react-native';
import { brandFontSupports, lineHeightScale, type Script } from '../core/i18n';
import { textV2 } from '../theme/tokensV2';

type BaseText = { fontSize?: number; lineHeight?: number; fontFamily?: string };

/**
 * Overrides to merge after a type token: `style={[type.body, textStyleFor(script, type.body)]}`.
 * Latin returns {} (brand fonts, token line heights). Other scripts scale the line height and set
 * `fontFamily: undefined` so the system font (with full CJK/Devanagari/Arabic coverage) is used.
 */
export function textStyleFor(script: Script, base?: BaseText): TextStyle {
  if (script === 'latin') return {};
  const out: TextStyle = {};
  if (!brandFontSupports(script)) out.fontFamily = undefined;
  const lh = base?.lineHeight ?? (base?.fontSize ? base.fontSize * 1.3 : undefined);
  if (lh) out.lineHeight = Math.round(lh * lineHeightScale(script));
  return out;
}

/**
 * The v1 type role names mapped onto the v2 system type scale (docs/DESIGN_V2.md §3),
 * with the same script adjustments, so a screen can move to v2 type without renaming every
 * style: hero → largeTitle, title → title2, heading → headline, body → body, label → subhead
 * (600), small → footnote. Memoised per script.
 */
export type TypeScaleV2 = Record<'hero' | 'title' | 'heading' | 'body' | 'label' | 'small', TextStyle>;

const cacheV2 = new Map<Script, TypeScaleV2>();

export function localizedTypeV2(script: Script): TypeScaleV2 {
  const hit = cacheV2.get(script);
  if (hit) return hit;
  const role = (base: TextStyle, extra?: TextStyle): TextStyle => ({ ...base, ...extra, ...textStyleFor(script, base as BaseText) });
  const out: TypeScaleV2 = {
    hero: role(textV2.largeTitle),
    title: role(textV2.title2),
    heading: role(textV2.headline),
    body: role(textV2.body),
    label: role(textV2.subhead, { fontWeight: '600' }),
    small: role(textV2.footnote),
  };
  cacheV2.set(script, out);
  return out;
}

/** Feather icon names for directional chevrons and arrows. `forward` = towards the reading end. */
export const Chevron = {
  forward: (rtl: boolean) => (rtl ? 'chevron-left' : 'chevron-right'),
  back: (rtl: boolean) => (rtl ? 'chevron-right' : 'chevron-left'),
  arrowForward: (rtl: boolean) => (rtl ? 'arrow-left' : 'arrow-right'),
  arrowBack: (rtl: boolean) => (rtl ? 'arrow-right' : 'arrow-left'),
} as const;

/** Mirror any other directional glyph (e.g. a custom SVG arrow) in RTL. */
export function flipInRTL(rtl: boolean): ViewStyle {
  return rtl ? { transform: [{ scaleX: -1 }] } : {};
}

/**
 * Put on the root view of anything that depicts the phone itself or artwork: HomeMock, LockMock,
 * PhoneFrame, icon previews, wallpapers, the clock. Their layout never mirrors in RTL.
 */
export const noMirror: ViewStyle = { direction: 'ltr' };

/** For Text that must read left-to-right (clock, numbers in mocks). */
export const noMirrorText: TextStyle = { writingDirection: 'ltr' };
