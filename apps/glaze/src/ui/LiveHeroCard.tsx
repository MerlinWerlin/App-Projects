// Hero card at the top of the Themes tab (T30): the way into the Live Lock tab's picker.
// No animation of its own, so nothing to reduce for Reduce Motion; the press feedback is the shared
// SquircleCard ease (timed, no spring).
// T173 (premium UI, docs/PREMIUM_UI.md §3.2): the same surface + eyebrow language as the editorial
// sections and the pack cards. A large card on `surface` (dark mode: `surfaceRaised`, no hairline)
// with the soft card shadow; the glaze gradient survives only as the art tile (drawn with
// react-native-svg, Expo Go safe); an eyebrow ("Live Lock Screen") over the title; the call to
// action is a quiet tint-soft pill. Dynamic Type caps on every Text; one button with its label/hint.
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useT } from '../i18n';
import {
  continuous,
  eyebrowCaseFor,
  fontScaleCap,
  iconTileRadius,
  onArtV2,
  radiusV2,
  sizeV2,
  spaceV2,
  textV2,
  type TypeRoleV2,
} from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';
import { liveContext, localizedHeroSubline } from './liveContext';
import { SquircleCard } from './SquircleCard';

/** The art tile: the glaze gradient with the phone glyph (the card's one piece of colour). */
const ART = 56;

const GlazeTile = memo(function GlazeTile({ from, to, ink }: { from: string; to: string; ink: string }) {
  const r = iconTileRadius(ART);
  return (
    <View style={[styles.art, continuous, { borderRadius: r }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={ART} height={ART} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="liveHeroTile" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={from} stopOpacity={1} />
            <Stop offset="1" stopColor={to} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={ART} height={ART} rx={r} ry={r} fill="url(#liveHeroTile)" />
      </Svg>
      <Feather name="smartphone" size={24} color={ink} />
    </View>
  );
});

export function LiveHeroCard() {
  const { c, scheme } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const type = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const ey = eyebrowCaseFor(script);
  const [glazeA, glazeB] = c.glaze;
  // The light glaze is a pastel (ink glyph); the deep dark glaze keeps a white glyph.
  const glyph = scheme === 'dark' ? onArtV2.ink : c.ink;
  const ctx = useMemo(() => liveContext(), []);
  const sub = localizedHeroSubline(t, ctx.build, ctx.iosMajor);

  return (
    <SquircleCard
      size="large"
      tone={scheme === 'dark' ? 'raised' : 'surface'}
      outline={false}
      padding={spaceV2.inset}
      haptic="select"
      onPress={() => router.push('/live?new=1')}
      accessibilityLabel={t('liveUi.hero.a11y', { detail: sub })}
      accessibilityHint={t('liveUi.hero.hint')}
    >
      <View style={styles.body}>
        <View style={styles.row}>
          <GlazeTile from={glazeA} to={glazeB} ink={glyph} />
          <View style={styles.text}>
            <Text
              maxFontSizeMultiplier={fontScaleCap('eyebrow')}
              style={[...type('eyebrow'), { letterSpacing: ey.letterSpacing, color: c.tint }, ey.upper ? styles.upper : null]}
            >
              {t('liveUi.lock.title')}
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap('title3')} style={[...type('title3'), { color: c.ink }]}>
              {t('liveUi.hero.title')}
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...type('subhead'), { color: c.inkSecondary }]}>
              {t('liveUi.hero.subtitle')}
            </Text>
          </View>
        </View>
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...type('footnote'), { color: c.inkSecondary }]}>
          {sub}
        </Text>
        <View style={[styles.cta, continuous, { backgroundColor: c.tintSoft }]}>
          <Feather name="plus" size={18} color={c.onTintSoft} />
          <Text maxFontSizeMultiplier={fontScaleCap('button')} style={[...type('button'), styles.ctaText, { color: c.onTintSoft }]}>
            {t('liveUi.hero.cta')}
          </Text>
        </View>
      </View>
    </SquircleCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spaceV2.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md },
  art: { width: ART, height: ART, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: spaceV2.xxs },
  upper: { textTransform: 'uppercase' },
  ctaText: { flexShrink: 1 },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
  },
});
