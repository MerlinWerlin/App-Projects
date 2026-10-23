// iOS large-title navigation (docs/DESIGN_V2.md "LargeTitleHeader"). A 34 pt title sits at the top
// of the scroll content; as it scrolls under the bar it fades out, the small centred bar title
// fades in and the bar turns to glass with a hairline. Pulling down stretches the title (up to
// 1.08). All of it runs on the UI thread from a reanimated scroll handler, using the ranges in
// src/core/designV2.ts (largeTitleRanges, tested in Node).
// Reduce Motion: no stretch; bar title + material cross-fade once at the snap point instead.
//
//   <LargeTitleScrollView title={t('tabs.settings')} trailing={<IconButton ... />}>
//     <InsetGroup>...</InsetGroup>
//   </LargeTitleScrollView>
//
// For a FlatList, use useLargeTitleScroll() + <LargeTitleHeader> + <LargeTitle> directly.
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../i18n';
import { durations, useMotionReduced } from '../theme/motion';
import { largeTitleRanges, largeTitleSnapAt, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { GlassBar } from './GlassBar';
import { textStyleFor } from './i18nLayout';

const BLOCK = sizeV2.largeTitleBlock;
const RANGES = largeTitleRanges(BLOCK);
const SNAP_AT = largeTitleSnapAt(BLOCK);

/** Scroll offset shared value + the handler to pass to an Animated.ScrollView / Animated.FlatList. */
export function useLargeTitleScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  return { scrollY, onScroll };
}

/**
 * Collapse progress values for a scroll offset. With reduced motion the bar values are driven by
 * a short timing fade between 0 and 1 at the snap point, and the title never stretches.
 */
function useCollapse(scrollY: SharedValue<number>) {
  const reduced = useMotionReduced();
  const snapped = useSharedValue(0);
  const reducedSV = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    reducedSV.value = reduced ? 1 : 0;
  }, [reduced, reducedSV]);
  useAnimatedReaction(
    () => (scrollY.value >= SNAP_AT ? 1 : 0),
    (now, prev) => {
      if (now !== prev) snapped.value = withTiming(now, { duration: durations.fast });
    },
  );
  const bar = useDerivedValue(() =>
    reducedSV.value === 1
      ? snapped.value
      : interpolate(scrollY.value, RANGES.barOpacity.input, RANGES.barOpacity.output, Extrapolation.CLAMP),
  );
  const inline = useDerivedValue(() =>
    reducedSV.value === 1
      ? snapped.value
      : interpolate(scrollY.value, RANGES.inlineOpacity.input, RANGES.inlineOpacity.output, Extrapolation.CLAMP),
  );
  const large = useDerivedValue(() =>
    reducedSV.value === 1
      ? 1 - snapped.value
      : interpolate(scrollY.value, RANGES.largeOpacity.input, RANGES.largeOpacity.output, Extrapolation.CLAMP),
  );
  const scale = useDerivedValue(() =>
    reducedSV.value === 1
      ? 1
      : interpolate(scrollY.value, RANGES.largeScale.input, RANGES.largeScale.output, Extrapolation.CLAMP),
  );
  return { bar, inline, large, scale };
}

type HeaderProps = {
  title: string;
  scrollY: SharedValue<number>;
  /** Back button or similar, at the reading start. */
  leading?: ReactNode;
  /** Actions (icon buttons, a small pill) at the reading end. */
  trailing?: ReactNode;
};

/** The fixed bar over the scroll view: glass material, inline title, leading/trailing slots. */
export function LargeTitleHeader({ title, scrollY, leading, trailing }: HeaderProps) {
  const { c } = useColorsV2();
  const { script } = useT();
  const insets = useSafeAreaInsets();
  const { bar, inline } = useCollapse(scrollY);
  const inlineStyle = useAnimatedStyle(() => ({ opacity: inline.value }));
  return (
    <GlassBar
      hairline="bottom"
      progress={bar}
      style={[styles.bar, { paddingTop: insets.top, height: insets.top + sizeV2.navBar }]}
    >
      <View style={styles.barRow}>
        <View style={styles.slot}>{leading ?? null}</View>
        <Animated.View
          style={[styles.inlineWrap, inlineStyle]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text numberOfLines={1} style={[textV2.navTitle, textStyleFor(script, textV2.navTitle), { color: c.ink }]}>
            {title}
          </Text>
        </Animated.View>
        <View style={[styles.slot, styles.slotEnd]}>{trailing ?? null}</View>
      </View>
    </GlassBar>
  );
}

type TitleProps = {
  title: string;
  subtitle?: string;
  scrollY: SharedValue<number>;
};

/** The 34 pt title block; place it first inside the scroll content. */
export function LargeTitle({ title, subtitle, scrollY }: TitleProps) {
  const { c } = useColorsV2();
  const { script, isRTL } = useT();
  const { large, scale } = useCollapse(scrollY);
  // Stretch grows from the reading-start edge, like iOS.
  const origin = isRTL ? 'right' : 'left';
  const titleStyle = useAnimatedStyle(() => ({ opacity: large.value, transform: [{ scale: scale.value }] }));
  return (
    <View style={styles.titleBlock}>
      <Animated.View style={[{ transformOrigin: `${origin} bottom` }, titleStyle]}>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[textV2.largeTitle, textStyleFor(script, textV2.largeTitle), { color: c.ink }]}
        >
          {title}
        </Text>
      </Animated.View>
      {subtitle ? (
        <Text style={[textV2.subhead, textStyleFor(script, textV2.subhead), { color: c.inkSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

type ScrollProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** Screen scaffold: grouped background, scroll view, large title and collapsing glass bar. */
export function LargeTitleScrollView({ title, subtitle, leading, trailing, children, contentContainerStyle }: ScrollProps) {
  const { c } = useColorsV2();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useLargeTitleScroll();
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + sizeV2.navBar, paddingBottom: insets.bottom + spaceV2.xxxl },
          contentContainerStyle,
        ]}
      >
        <LargeTitle title={title} subtitle={subtitle} scrollY={scrollY} />
        {children}
      </Animated.ScrollView>
      <LargeTitleHeader title={title} scrollY={scrollY} leading={leading} trailing={trailing} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spaceV2.xl },
  bar: { position: 'absolute', top: 0, start: 0, end: 0 },
  barRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spaceV2.sm },
  slot: { minWidth: sizeV2.touch, flexDirection: 'row', alignItems: 'center' },
  slotEnd: { justifyContent: 'flex-end' },
  inlineWrap: { flex: 1, alignItems: 'center', paddingHorizontal: spaceV2.sm },
  titleBlock: { minHeight: BLOCK, justifyContent: 'flex-end', paddingHorizontal: spaceV2.inset, gap: spaceV2.xs },
});
