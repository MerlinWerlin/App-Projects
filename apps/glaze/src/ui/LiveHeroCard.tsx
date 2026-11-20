// The Live Lock Screen entry under the Themes gallery. White Cube (DESIGN.md §5): a flat panel on
// the wall with a title, one line on what it does, the device/iOS note, and a plain cobalt "New"
// action. No gradient tile, no eyebrow, no tinted icon circle (DESIGN.md §8).
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { fontScaleCap, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';
import { liveContext, localizedHeroSubline } from './liveContext';
import { SquircleCard } from './SquircleCard';

export function LiveHeroCard() {
  const { c, scheme } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const type = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const ctx = useMemo(() => liveContext(), []);
  const sub = localizedHeroSubline(t, ctx.build, ctx.iosMajor);

  return (
    <SquircleCard
      tone={scheme === 'dark' ? 'raised' : 'surface'}
      padding={spaceV2.lg}
      haptic="select"
      onPress={() => router.push('/live?new=1')}
      accessibilityLabel={t('liveUi.hero.a11y', { detail: sub })}
      accessibilityHint={t('liveUi.hero.hint')}
    >
      <View style={styles.body}>
        <View style={styles.text}>
          <Text maxFontSizeMultiplier={fontScaleCap('title3')} style={[...type('title3'), { color: c.ink }]}>
            {t('liveUi.hero.title')}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...type('subhead'), { color: c.inkSecondary }]}>
            {t('liveUi.hero.subtitle')}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...type('footnote'), { color: c.inkTertiary }]}>
            {sub}
          </Text>
        </View>
        <View style={styles.cta}>
          <Feather name="plus" size={18} color={c.tint} />
          <Text maxFontSizeMultiplier={fontScaleCap('button')} style={[...type('button'), styles.ctaText, { color: c.tint }]}>
            {t('liveUi.hero.cta')}
          </Text>
        </View>
      </View>
    </SquircleCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spaceV2.sm },
  text: { gap: spaceV2.xs },
  ctaText: { flexShrink: 1 },
  cta: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spaceV2.xs, minHeight: sizeV2.touch },
});
