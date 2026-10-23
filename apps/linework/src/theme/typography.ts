// Script-aware typography for screens (docs/I18N.md "Script typography"). Latin keeps Fraunces / Inter; CJK,
// Devanagari and Arabic use the system font with taller line heights. The maths is pure in src/i18n/typography.ts.
//
//   const ty = useTypography();
//   <Text style={[styles.title, ty.font('display', 28, DISPLAY_LINE_RATIO)]}>…</Text>
//   <Text style={{ fontFamily: ty.family('body'), fontSize: 16, lineHeight: ty.lh(16) }}>…</Text>
//   <Text style={{ ...ty.face('bodyMedium'), fontSize: 15, lineHeight: ty.lhOf(21) }}>…</Text>   // own Latin ratio
//
// Module-level StyleSheets that use `fonts.*` keep working; apply ty.font(...) after them to override per script.
import type { TextStyle } from 'react-native';
import { useT } from '../i18n';
import type { Script } from '../i18n/core.ts';
import {
  BODY_LINE_RATIO,
  DISPLAY_LINE_RATIO,
  fontFaceFor,
  fontFamilyFor,
  fontWeightFor,
  lineHeightFor,
  scaledLineHeight,
  type FontFace,
  type FontKind,
} from '../i18n/typography.ts';
import { fonts } from './tokens';

export { BODY_LINE_RATIO, DISPLAY_LINE_RATIO, type FontKind };

export type Typography = {
  script: Script;
  /** fontFamily for a kind, or undefined = system font (CJK / Devanagari / Arabic). */
  family: (kind: FontKind) => string | undefined;
  /** fontWeight to pair with the system font (undefined for Latin: the family carries the weight). */
  weight: (kind: FontKind) => TextStyle['fontWeight'];
  /** Line height: round(fontSize × ratio × script scale); ratio defaults to BODY_LINE_RATIO (16 → 23 in Latin). */
  lh: (fontSize: number, ratio?: number) => number;
  /** Ready-made style: fontFamily / fontWeight / fontSize / lineHeight for this script. */
  font: (kind: FontKind, fontSize: number, ratio?: number) => TextStyle;
  /**
   * Just the face: { fontFamily } for Latin (identical to `fonts.*`), { fontFamily: undefined, fontWeight } for the
   * system font. Spread it where a style used `fontFamily: fonts.x` and keep the rest of the style as it was.
   */
  face: (kind: FontKind) => FontFace;
  /** A line height fixed for Latin (e.g. 21 for 15 pt), scaled for this script; Latin returns it unchanged. */
  lhOf: (latinLineHeight: number) => number;
};

/** Pure (non-hook) version for a given script, e.g. for tests or code outside components. */
export function typographyFor(script: Script): Typography {
  const family = (kind: FontKind): string | undefined => fontFamilyFor(kind, script, fonts);
  const weight = (kind: FontKind): TextStyle['fontWeight'] => fontWeightFor(kind, script);
  const lh = (fontSize: number, ratio: number = BODY_LINE_RATIO): number => lineHeightFor(fontSize, script, ratio);
  return {
    script,
    family,
    weight,
    lh,
    font: (kind, fontSize, ratio) => {
      const style: TextStyle = { fontSize, lineHeight: lh(fontSize, ratio) };
      const f = family(kind);
      // System font: set fontFamily undefined explicitly so it overrides a StyleSheet's Inter / Fraunces.
      style.fontFamily = f;
      const w = weight(kind);
      if (w) style.fontWeight = w;
      return style;
    },
    face: (kind) => fontFaceFor(kind, script, fonts),
    lhOf: (latinLineHeight) => scaledLineHeight(latinLineHeight, script),
  };
}

/** Hook: typography for the current language; re-renders when the language changes. */
export function useTypography(): Typography {
  const { info } = useT();
  return typographyFor(info.script);
}
