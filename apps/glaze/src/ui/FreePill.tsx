// T106: small "Free" pill for free themes in the new collections (Space, Story & Play free six).
// Decorative: the card's accessibility label says "Free theme." (themes.badge.freeA11y).
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';

export function FreePill() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const mint = c.pastels.mint;
  return (
    <View
      style={[styles.pill, { backgroundColor: mint.fill, borderColor: mint.ink }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Feather name="gift" size={11} color={mint.ink} />
      <Text numberOfLines={1} style={[textV2.caption1, textStyleFor(script, textV2.caption1), styles.text, { color: mint.ink }]}>
        {t('themes.badge.free')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.xs,
    alignSelf: 'flex-start',
    borderRadius: radiusV2.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xxs,
  },
  text: { fontWeight: '600' },
});
