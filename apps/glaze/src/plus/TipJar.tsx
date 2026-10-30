import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useT } from '../i18n';
import { circleRadius, continuous, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from '../ui/i18nLayout';
import { InsetGroup } from '../ui/InsetGroup';

const TIERS = ['plus.tipJar.small', 'plus.tipJar.kind', 'plus.tipJar.generous'] as const;

/**
 * Tip jar placeholder: optional, unlocks nothing. In-app tips arrive with the store release.
 * T173 (docs/PREMIUM_UI.md §3.7, Settings is inset groups only): an inset group with an editorial
 * title, a butter pastel circle icon and the tiers as quiet pills.
 */
export function TipJar() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  return (
    <InsetGroup title={t('plus.tipJar.title')} footer={t('plus.tipJar.soon')}>
      <View accessible accessibilityLabel={t('plus.tipJar.a11y')} style={styles.body}>
        <View style={styles.head}>
          <View style={[styles.tile, { backgroundColor: c.pastels.butter.fill }]}>
            <Feather name="coffee" size={17} color={c.pastels.butter.ink} />
          </View>
          <Text maxFontSizeMultiplier={fontScaleCap('callout')} style={[...ts('callout'), styles.flex, { color: c.inkSecondary }]}>
            {t('plus.tipJar.body')}
          </Text>
        </View>
        <View style={styles.tiers}>
          {TIERS.map((k) => (
            <View key={k} style={[styles.tier, continuous, { backgroundColor: c.fill }]}>
              <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...ts('subhead'), { color: c.inkSecondary }]}>
                {t(k)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </InsetGroup>
  );
}

const styles = StyleSheet.create({
  body: { gap: spaceV2.sm, paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md },
  tile: {
    width: sizeV2.rowIcon,
    height: sizeV2.rowIcon,
    borderRadius: circleRadius(sizeV2.rowIcon),
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
