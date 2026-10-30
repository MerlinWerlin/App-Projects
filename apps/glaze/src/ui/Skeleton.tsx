// Skeleton placeholder for waits over ~300 ms (POLISH rule 5, docs/PREMIUM_UI.md "skeletons, not
// spinners"): drawn in the final layout's shape on the quiet `fill` colour (or a theme's own colour).
// T173: a calm opacity pulse instead of the old sweeping highlight: timed ease-in-out both ways on
// the UI thread (withTiming, never a spring), and a still block when motion is reduced (the Glaze
// setting or the system one). No raw colours: the block is a token colour at reduced opacity.
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useMotionReduced } from '../theme/motion';
import { continuous, radiusV2, spaceV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { useT } from '../i18n';

type Props = {
  width: DimensionValue;
  height: number;
  radius?: number;
  /** Block colour; defaults to the palette's quiet `fill`. */
  colour?: string;
  style?: StyleProp<ViewStyle>;
};

/** One half of the pulse (bright to dim), ms. Slow on purpose: a breath, not a blink. */
export const SKELETON_PULSE_MS = 900;
/** Opacity at the dim end of the pulse; the bright end is 1. */
export const SKELETON_DIM = 0.55;

const pulseEasing = Easing.inOut(Easing.quad);

export function Skeleton({ width, height, radius = radiusV2.control, colour, style }: Props) {
  const { c } = useColorsV2();
  const reduced = useMotionReduced();
  const o = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(o);
      o.value = 1;
      return;
    }
    o.value = 1;
    o.value = withRepeat(withTiming(SKELETON_DIM, { duration: SKELETON_PULSE_MS, easing: pulseEasing }), -1, true);
    return () => cancelAnimation(o);
  }, [reduced, o]);

  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.block, continuous, { width, height, borderRadius: radius, backgroundColor: colour ?? c.fill }, pulse, style]}
    />
  );
}

/** A grid of icon-shaped skeletons (icon rendering waits). */
export function IconGridSkeleton({ count = 8, size = 56, cols = 4 }: { count?: number; size?: number; cols?: number }) {
  const { t } = useT();
  return (
    <View style={styles.grid} accessibilityLabel={t('ui.loadingIcons')} accessible>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.cell, { width: `${100 / cols}%` as DimensionValue }]}>
          <Skeleton width={size} height={size} radius={size * 0.24} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', paddingVertical: spaceV2.sm - spaceV2.xxs },
});
