/**
 * Drop-in replacement for react-native's Text (owner-1016 R3). Same props. Adapts the style to the
 * active language's script: brand fonts -> system font for CJK / Devanagari / Arabic, taller line
 * heights there, and start-aligned text that follows the layout direction. Text wraps by default;
 * callers that need one line pass numberOfLines themselves (and should prefer wrapping).
 */
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { useLocale } from '../i18n/react';
import { localeInfo } from '../i18n/locales';
import { familyFor, lineHeightFor } from '../theme/typography';
import { roleCap, type TextRole } from '../core/textScale';

export type CouchTextProps = TextProps & {
  /**
   * Single-line glyph labels that must sit on an optical centre (the d-pad OK key, fb-1017-ok):
   * lineHeight is forced to fontSize in every script, with no Android font padding.
   */
  tight?: boolean;
  /**
   * Larger Text role (T74, src/core/textScale.ts): caps how far this Text follows the system text
   * size (RN maxFontSizeMultiplier = roleCap(role)). An explicit maxFontSizeMultiplier wins.
   */
  scaleRole?: TextRole;
};

export function Text({ tight, scaleRole, ...rest }: CouchTextProps) {
  const props: TextProps =
    scaleRole && rest.maxFontSizeMultiplier == null ? { ...rest, maxFontSizeMultiplier: roleCap(scaleRole) } : rest;
  const locale = useLocale();
  const script = localeInfo(locale).script;
  const flat = (StyleSheet.flatten(props.style) ?? {}) as { fontFamily?: string; fontSize?: number; lineHeight?: number };
  const size = flat.fontSize ?? 14;
  const tightStyle = tight
    ? { lineHeight: size, includeFontPadding: false, textAlignVertical: 'center' as const, textAlign: 'center' as const }
    : null;
  if (script === 'latin') return <RNText {...props} style={tight ? [props.style, tightStyle] : props.style} />;
  const fam = familyFor(script, flat.fontFamily);
  const adjusted = tight ? { ...fam, ...tightStyle } : { ...fam, lineHeight: lineHeightFor(script, size, flat.lineHeight) };
  return <RNText {...props} style={[props.style, adjusted]} />;
}

export type { TextProps };
