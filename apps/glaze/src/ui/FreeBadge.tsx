// Glaze 1.0.41 (owner 2026-11-15: "every free theme shows a tiny 'Premium' tag with 'Free' next to it"):
// the small pill on the ten free themes' cards while the person isn't subscribed. Decorative: the
// card's accessibility note says it (themes.freeNote).
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';

export function FreeBadge() {
  const { c } = useColorsV2();
  const { t } = useT();
  return (
    <View style={[styles.pill, { backgroundColor: c.tint }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Feather name="gift" size={11} color={c.onTint} />
      <Text style={[textV2.caption1, styles.text, { color: c.onTint }]} maxFontSizeMultiplier={1.2}>
        {t('themes.freeBadge')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.xxs, paddingHorizontal: spaceV2.xs, paddingVertical: spaceV2.xxs, borderRadius: radiusV2.pill },
  text: { fontWeight: '700' },
});
