// 1.0.35 (owner TestFlight 2026-11-14 04:02 on the Install icons screen: "This menus confusing we should just have an
// option which takes them to icons or widgets and just shows how... and where the vids"): the screen a theme's flow
// opens first, two big choices and nothing else up front. Each card has one line and its how-to video's poster frame;
// Icons continues into the icon install below it, Widgets goes to the Widgets tab. No new behaviour, layout only.
// Tokens only; no motion beyond PressableScale's press.
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { chromeRadiusV2, continuous, fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { HOW_TO_CLIPS } from './howToClips';
import { Chevron, textStyleFor } from './i18nLayout';
import { PressableScale } from './PressableScale';
import { SectionHeader } from './SectionHeader';

/** Poster thumbnail size (points): the recordings are phone-shaped (590 × 1278). */
const POSTER_W = 64;
const POSTER_H = Math.round((POSTER_W * 1278) / 590);

type Choice = 'icons' | 'widgets';

export function AddChooser({ onIcons, onWidgets }: { onIcons: () => void; onWidgets: () => void }) {
  const { c, scheme } = useColorsV2();
  const { t, script, isRTL } = useT();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const card = (choice: Choice) => {
    const icons = choice === 'icons';
    const title = icons ? t('install.chooser.icons.title') : t('install.chooser.widgets.title');
    const body = icons ? t('install.chooser.icons.body') : t('install.chooser.widgets.body');
    const hint = icons ? t('install.chooser.icons.hint') : t('install.chooser.widgets.hint');
    return (
      <PressableScale
        key={choice}
        onPress={icons ? onIcons : onWidgets}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={[title, body].join(' ')}
        accessibilityHint={hint}
        style={[styles.card, continuous, { backgroundColor: scheme === 'dark' ? c.surfaceRaised : c.surface }]}
      >
        <View style={[styles.poster, continuous, { backgroundColor: c.fill }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ExpoImage source={HOW_TO_CLIPS[choice].poster} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        </View>
        <View style={styles.text}>
          <Text maxFontSizeMultiplier={fontScaleCap('title3')} style={[...label('title3'), { color: c.ink }]}>
            {title}
          </Text>
          <Text maxFontSizeMultiplier={fontScaleCap('subhead')} style={[...label('subhead'), { color: c.inkSecondary }]}>
            {body}
          </Text>
        </View>
        <Feather name={Chevron.forward(isRTL)} size={20} color={c.inkTertiary} />
      </PressableScale>
    );
  };
  return (
    <View style={styles.wrap}>
      <SectionHeader flushTop title={t('install.chooser.title')} body={t('install.chooser.body')} />
      {card('icons')}
      {card('widgets')}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
    padding: spaceV2.md,
    borderRadius: chromeRadiusV2.card,
  },
  poster: { width: POSTER_W, height: POSTER_H, borderRadius: chromeRadiusV2.control, overflow: 'hidden' },
  text: { flex: 1, gap: spaceV2.xs },
});
