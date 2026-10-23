// Hero card at the top of the Themes tab (T30): the way into the Live Lock tab's picker.
// Glaze gradient drawn with react-native-svg (Expo Go safe). No animation, so nothing to
// reduce for Reduce Motion; the press feedback is an opacity change only.
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { continuous, iconTileRadius, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { useT } from '../i18n';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { liveContext, localizedHeroSubline } from './liveContext';

const WHITE = '#FFFFFF';

const BADGE = 44;

/** Design v2 (T56): v2 glaze gradient on a large continuous-corner card, system type, white pill CTA. */
export function LiveHeroCard() {
  const { c, scheme } = useColorsV2();
  // The light glaze is a pastel, so its text is ink; the deep dark glaze keeps white text over a scrim.
  const fg = scheme === 'dark' ? WHITE : c.ink;
  const router = useRouter();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => [textV2[role], textStyleFor(script, textV2[role])];
  const tt = { title: ts('title3'), label: ts('subhead'), small: ts('footnote'), cta: ts('button') };
  const [glazeA, glazeB] = c.glaze;
  const ctx = useMemo(() => liveContext(), []);
  const sub = localizedHeroSubline(t, ctx.build, ctx.iosMajor);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <Pressable
      onPress={() => {
        haptic('select');
        router.push('/live?new=1');
      }}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={t('liveUi.hero.a11y', { detail: sub })}
      accessibilityHint={t('liveUi.hero.hint')}
      style={({ pressed }) => [styles.card, continuous, { backgroundColor: glazeA, opacity: pressed ? 0.85 : 1 }]}
    >
      {size.width > 0 ? (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="liveHero" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0" stopColor={glazeA} stopOpacity={1} />
              <Stop offset="1" stopColor={glazeB} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#liveHero)" />
          {/* Dark scheme: a light scrim keeps white text readable over the orange end of the gradient. */}
          {scheme === 'dark' ? (
            <Rect x={0} y={0} width={size.width} height={size.height} fill="#000000" fillOpacity={0.14} />
          ) : null}
        </Svg>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.badge, continuous]}>
          <Feather name="smartphone" size={22} color={fg} />
        </View>
        <View style={styles.text}>
          <Text style={[...tt.title, { color: fg }]}>{t('liveUi.hero.title')}</Text>
          <Text style={[...tt.label, styles.semibold, { color: fg }]}>{t('liveUi.hero.subtitle')}</Text>
        </View>
      </View>
      <Text style={[...tt.small, styles.sub, { color: fg }]}>{sub}</Text>
      <View style={[styles.cta, continuous]}>
        <Feather name="plus" size={18} color={c.tint} />
        <Text style={[...tt.cta, styles.ctaText, { color: c.tint }]}>{t('liveUi.hero.cta')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radiusV2.cardLarge, overflow: 'hidden', padding: spaceV2.inset, gap: spaceV2.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: iconTileRadius(BADGE),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  text: { flex: 1, gap: spaceV2.xxs },
  semibold: { fontWeight: '600' },
  sub: { opacity: 0.92 },
  ctaText: { flexShrink: 1 },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
    backgroundColor: WHITE,
  },
});
