// Shimmer skeleton for waits over ~300 ms (POLISH rule 5): drawn in the final layout's shape,
// a soft highlight sweeps across on the UI thread. Reduced motion: a static block.
// Design v2 (T83): quiet `fill` block with squircle corners.
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { easeOutCurve, useMotionReduced } from '../theme/motion';
import { radiusV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { useT } from '../i18n';

type Props = {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

const SWEEP_MS = 1100;
const BAND = 120;

export function Skeleton({ width, height, radius = radiusV2.control, style }: Props) {
  const { c } = useColorsV2();
  const reduced = useMotionReduced();
  const x = useSharedValue(-BAND);

  useEffect(() => {
    if (reduced) return;
    x.value = -BAND;
    x.value = withRepeat(withTiming(400, { duration: SWEEP_MS, easing: easeOutCurve }), -1, false);
    return () => cancelAnimation(x);
  }, [reduced, x]);

  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: c.fill, overflow: 'hidden', borderCurve: 'continuous' }, style]}
    >
      {reduced ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, { width: BAND }, sweep]} pointerEvents="none">
          <Svg width={BAND} height={height}>
            <Defs>
              <LinearGradient id="sk" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.35} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={BAND} height={height} fill="url(#sk)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** A grid of icon-shaped skeletons (icon rendering waits). */
export function IconGridSkeleton({ count = 8, size = 56, cols = 4 }: { count?: number; size?: number; cols?: number }) {
  const { t } = useT();
  return (
    <View style={styles.grid} accessibilityLabel={t('ui.loadingIcons')} accessible>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: `${100 / cols}%` as DimensionValue, alignItems: 'center', paddingVertical: 6 }}>
          <Skeleton width={size} height={size} radius={size * 0.24} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
