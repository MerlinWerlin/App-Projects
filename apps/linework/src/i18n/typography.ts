// Script-aware typography maths (pure TS, runs under node --test). The React hook lives in src/theme/typography.ts.
// Fraunces / Inter only cover Latin, so CJK, Devanagari and Arabic use the system font (undefined fontFamily) and
// get taller lines for their glyphs and marks (lineHeightScale in core.ts). See docs/I18N.md "Script typography".
import { lineHeightScale, usesSystemFont, type Script } from './core.ts';

export type FontKind = 'display' | 'displayBold' | 'body' | 'bodyMedium' | 'bodyBold';
export type FontMap = Readonly<Record<FontKind, string>>;

/** Default line height / font size for body text (16 → 23, matching the existing screens). */
export const BODY_LINE_RATIO = 1.45;
/** Tighter ratio for display headings (Fraunces), e.g. 28 → 34 in Latin. */
export const DISPLAY_LINE_RATIO = 1.2;

/** Line height for a font size in a script: round(fontSize × ratio × lineHeightScale(script)). */
export function lineHeightFor(fontSize: number, script: Script, ratio: number = BODY_LINE_RATIO): number {
  if (!(fontSize > 0)) return 0;
  return Math.round(fontSize * ratio * lineHeightScale(script));
}

/** fontFamily for a kind: the Latin brand font, or undefined (system font) for scripts it does not cover. */
export function fontFamilyFor(kind: FontKind, script: Script, latin: FontMap): string | undefined {
  return usesSystemFont(script) ? undefined : latin[kind];
}

/**
 * fontWeight to pair with the system font so headings stay bold when the brand font (whose weight is baked into
 * the family name) is dropped. Latin returns undefined: the family already carries the weight.
 */
export function fontWeightFor(kind: FontKind, script: Script): '400' | '500' | '600' | '700' | undefined {
  if (!usesSystemFont(script)) return undefined;
  switch (kind) {
    case 'displayBold':
      return '700';
    case 'display':
    case 'bodyBold':
      return '600';
    case 'bodyMedium':
      return '500';
    default:
      return '400';
  }
}

export type FontFace = { fontFamily: string | undefined; fontWeight?: '400' | '500' | '600' | '700' };

/**
 * fontFamily (+ fontWeight for the system font) for a kind, without touching size or line height. Latin returns
 * exactly { fontFamily: <brand font> } (no fontWeight key, so nothing else in a merged style changes); other
 * scripts return { fontFamily: undefined, fontWeight } so the system font replaces a StyleSheet's brand font.
 */
export function fontFaceFor(kind: FontKind, script: Script, latin: FontMap): FontFace {
  const face: FontFace = { fontFamily: fontFamilyFor(kind, script, latin) };
  const w = fontWeightFor(kind, script);
  if (w) face.fontWeight = w;
  return face;
}

/**
 * Line height for text whose Latin line height was fixed with its own ratio (e.g. 15 → 21, 11 → 14):
 * round(latinLineHeight × lineHeightScale(script)). Latin returns the value unchanged (pixel-identical). This is
 * lineHeightFor(fontSize, script, latinLineHeight / fontSize) without the floating-point detour.
 */
export function scaledLineHeight(latinLineHeight: number, script: Script): number {
  if (!(latinLineHeight > 0)) return 0;
  return Math.round(latinLineHeight * lineHeightScale(script));
}
