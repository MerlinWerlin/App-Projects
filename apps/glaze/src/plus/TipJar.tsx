import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useT } from '../i18n';
import { continuous, iconTileRadius, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from '../ui/i18nLayout';
import { SquircleCard } from '../ui/SquircleCard';

const TIERS = ['plus.tipJar.small', 'plus.tipJar.kind', 'plus.tipJar.generous'] as const;

/**
 * Tip jar placeholder: optional, unlocks nothing. In-app tips arrive with the store release.
 * Design v2 (T56): a surface squircle card with a butter icon tile and the tiers as quiet pills.
 */
export function TipJar() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  return (
    <SquircleCard tone="surface">
      <View accessible accessibilityLabel={t('plus.tipJar.a11y')} style={styles.body}>
        <View style={styles.head}>
          <View style={[styles.tile, continuous, { backgroundColor: c.pastels.butter.fill }]}>
            <Feather name="coffee" size={17} color={c.pastels.butter.ink} />
          </View>
          <Text style={[...ts('headline'), styles.flex, { color: c.ink }]}>{t('plus.tipJar.title')}</Text>
        </View>
        <Text style={[...ts('callout'), { color: c.inkSecondary }]}>{t('plus.tipJar.body')}</Text>
        <View style={styles.tiers}>
          {TIERS.map((k) => (
            <View key={k} style={[styles.tier, continuous, { backgroundColor: c.fill }]}>
              <Text style={[...ts('subhead'), { color: c.inkSecondary }]}>{t(k)}</Text>
            </View>
          ))}
        </View>
        <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('plus.tipJar.soon')}</Text>
      </View>
    </SquircleCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spaceV2.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md },
  tile: {
    width: sizeV2.rowIcon,
    height: sizeV2.rowIcon,
    borderRadius: iconTileRadius(sizeV2.rowIcon),
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, flexShrink: 1 },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  tier: {
    borderRadius: radiusV2.pill,
    paddingHorizontal: spaceV2.md,
    paddingVertical: spaceV2.xs,
  },
});
