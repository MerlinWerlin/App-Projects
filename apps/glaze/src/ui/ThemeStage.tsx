// Dreamroom stage (DESIGN.md §5 "Stage"): the overview of the Themes tab opens on a few themes'
// art at full size, one large print at a time, in a horizontal row that snaps to the centre. The
// print in the centre is full size and full strength; its neighbours sit a little smaller and
// fainter, and both follow the finger (scroll-driven on the UI thread, so they can be caught
// mid-swipe). Reduce Motion: no scaling or fading, a plain snapping row.
// Art comes from the starters' bundled full-size wallpaper (crisp, offline); a theme without one
// falls back to its catalogue thumbnail. Tapping a print opens /theme/<id>, like every card.
import { Image } from 'expo-image';
import { memo, useCallback, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { isRemoteArtTheme } from '../core/remoteCatalog';
import type { Theme } from '../core/themes';
import { useT } from '../i18n';
import { useMotionReduced } from '../theme/motion';
import { continuous, fontScaleCap, pressV2, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { displayStyle } from './displayType';
import { PressableScale } from './PressableScale';
import { RemoteArtImage } from './RemoteArtImage';
import { ThemeWallpaper } from './ThemeWallpaper';
import { ThemeHomePreview } from './ThemeHomePreview';
import { noMirror, textStyleFor } from './i18nLayout';

/** Share of the screen width one print takes (the neighbours peek in at both sides). */
export const STAGE_WIDTH_RATIO = 0.74;
/** Print height over width: a tall window onto the portrait wallpaper. */
export const STAGE_ART_RATIO = 1.3;
/** How small and faint the neighbours sit (the centre print is 1 / 1). */
const SIDE_SCALE = 0.9;
const SIDE_OPACITY = 0.55;

export type StageTheme = Theme & { stageArt?: number | null };

type Props = {
  themes: readonly StageTheme[];
  /** Screen width (pt). */
  width: number;
  onOpen: (id: string) => void;
  /** Badge over a print (Plus / Free), by theme. */
  badgeFor?: (theme: StageTheme) => ReactNode;
};

export function stageGeometry(width: number): { cardW: number; artH: number; gap: number; side: number; step: number } {
  const w = Number.isFinite(width) && width > 0 ? width : 390;
  const cardW = Math.round(w * STAGE_WIDTH_RATIO);
  const gap = spaceV2.md;
  return { cardW, artH: Math.round(cardW * STAGE_ART_RATIO), gap, side: Math.round((w - cardW) / 2), step: cardW + gap };
}

const StagePrint = memo(function StagePrint({
  theme,
  index,
  scrollX,
  step,
  cardW,
  artH,
  reduced,
  onOpen,
  badge,
}: {
  theme: StageTheme;
  index: number;
  scrollX: SharedValue<number>;
  step: number;
  cardW: number;
  artH: number;
  reduced: boolean;
  onOpen: (id: string) => void;
  badge?: ReactNode;
}) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const breathe = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [{ scale: 1 }] };
    const input = [(index - 1) * step, index * step, (index + 1) * step];
    return {
      opacity: interpolate(scrollX.value, input, [SIDE_OPACITY, 1, SIDE_OPACITY], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(scrollX.value, input, [SIDE_SCALE, 1, SIDE_SCALE], Extrapolation.CLAMP) }],
    };
  }, [reduced, index, step]);
  const label = t('themeUi.card.a11y', { name: theme.name, tagline: theme.tagline });
  let art: ReactNode;
  if (typeof theme.stageArt === 'number') {
    art = <Image source={theme.stageArt} contentFit="cover" cachePolicy="memory" recyclingKey={`stage-${theme.id}`} transition={0} style={{ width: cardW, height: artH }} />;
  } else if (isRemoteArtTheme(theme)) {
    art = <RemoteArtImage theme={theme} width={cardW} height={artH} />;
  } else {
    art = <ThemeWallpaper theme={theme} width={cardW} height={artH} maxGrain={120} />;
  }
  return (
    <Animated.View style={[{ width: cardW }, breathe]}>
      <PressableScale
        onPress={() => onOpen(theme.id)}
        haptic="select"
        pressedScale={pressV2.card}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('themeUi.card.hint')}
        style={styles.press}
      >
        <View
          style={[styles.art, continuous, noMirror, { width: cardW, height: artH, backgroundColor: theme.palette.bg, borderColor: c.separator }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          {art}
          <ThemeHomePreview theme={theme} width={cardW} height={artH} />
          {badge ? <View style={styles.badge}>{badge}</View> : null}
        </View>
        <View style={styles.label}>
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={fontScaleCap('title2')}
            style={[textV2.title2, textStyleFor(script, textV2.title2), displayStyle(script, 'stage'), { color: c.ink }]}
          >
            {theme.name}
          </Text>
          <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap('subhead')} style={[textV2.subhead, textStyleFor(script, textV2.subhead), { color: c.inkSecondary }]}>
            {theme.tagline}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

const stageKey = (item: StageTheme, i: number): string => (item && typeof item.id === 'string' ? item.id : `stage-${i}`);

export const ThemeStage = memo(function ThemeStage({ themes, width, onOpen, badgeFor }: Props) {
  const { t } = useT();
  const reduced = useMotionReduced();
  const { cardW, artH, gap, side, step } = stageGeometry(width);
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      // A UI-thread error is caught, never rethrown (docs/CRASH_1101.md): the stage just stops breathing.
      try {
        scrollX.value = Number.isFinite(e.contentOffset.x) ? e.contentOffset.x : 0;
      } catch {
        // Keep the last value.
      }
    },
  });
  const renderItem: ListRenderItem<StageTheme> = useCallback(
    ({ item, index }) => (
      <StagePrint
        theme={item}
        index={index}
        scrollX={scrollX}
        step={step}
        cardW={cardW}
        artH={artH}
        reduced={reduced}
        onOpen={onOpen}
        badge={badgeFor ? badgeFor(item) : undefined}
      />
    ),
    [scrollX, step, cardW, artH, reduced, onOpen, badgeFor],
  );
  const getItemLayout = useCallback((_: ArrayLike<StageTheme> | null | undefined, index: number) => ({ length: step, offset: side + step * index, index }), [step, side]);
  if (themes.length === 0) return null;
  return (
    <Animated.FlatList
      bounces={false}
      overScrollMode="never"
      data={themes as StageTheme[]}
      renderItem={renderItem}
      keyExtractor={stageKey}
      getItemLayout={getItemLayout}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      onScroll={onScroll}
      scrollEventThrottle={16}
      accessibilityLabel={t('themes.browse.allThemes')}
      contentContainerStyle={[styles.row, { paddingHorizontal: side, gap }]}
      initialNumToRender={3}
      windowSize={5}
    />
  );
});

const styles = StyleSheet.create({
  row: { paddingTop: spaceV2.lg, paddingBottom: spaceV2.sm },
  press: { minHeight: sizeV2.touch },
  art: { overflow: 'hidden', borderRadius: radiusV2.cardLarge, borderWidth: StyleSheet.hairlineWidth },
  badge: { position: 'absolute', top: spaceV2.md, end: spaceV2.md },
  label: { gap: spaceV2.xs, paddingTop: spaceV2.md },
});
