import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';
import { useTypography, type Typography } from './typography';
import { darkV2, lightV2, typeV2, type PaletteV2, type TypeName, type TypeStyleV2 } from './tokensV2';

/**
 * Colours for the current scheme plus script-aware typography for the current language (`typo`, see
 * src/theme/typography.ts). Existing callers that only read { c, isDark } are unchanged.
 */
export function useTheme(): { c: Palette; isDark: boolean; typo: Typography } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const typo = useTypography();
  return { c: isDark ? dark : light, isDark, typo };
}

export type TextStyleV2 = TypeStyleV2 & { fontFamily: undefined };

/**
 * Design v2 theme (docs/DESIGN_V2.md): v2 colours for the current scheme, the iOS type scale on the system font
 * with script-aware line heights (`text('headline')`), and the current script's typography. v1 `useTheme()` is
 * unchanged; screens switch to this as they migrate (T74–T76).
 */
export function useThemeV2(): { c: PaletteV2; isDark: boolean; typo: Typography; text: (name: TypeName) => TextStyleV2 } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const typo = useTypography();
  const text = (name: TypeName): TextStyleV2 => {
    const s = typeV2[name];
    // fontFamily undefined = system font (SF Pro on iOS); explicit so it overrides a v1 StyleSheet's Inter.
    return { fontFamily: undefined, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: typo.lhOf(s.lineHeight) };
  };
  return { c: isDark ? darkV2 : lightV2, isDark, typo, text };
}
