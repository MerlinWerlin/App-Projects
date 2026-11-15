// Glaze 1.0.39 (owner 2026-11-15): a short note on the theme page and in its "Use this theme" chooser:
// every theme comes with its own five widget artworks, and a piece from another theme can go on a
// Custom widget (My widget art > … > Add to Custom n).
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';

export function ArtworkNote({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  return (
    <View style={[styles.wrap, style]} accessible accessibilityRole="text">
      <Feather name="image" size={18} color={c.tint} style={styles.icon} />
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...label('subhead'), styles.title, { color: c.ink }]}>
          {t('theme.use.artNoteTitle')}
        </Text>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
          {t('theme.use.artNoteBody')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.sm },
  icon: { marginTop: 2 },
  text: { flex: 1, gap: spaceV2.xxs },
  title: { fontWeight: '600' },
});
