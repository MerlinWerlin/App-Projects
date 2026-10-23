// SheenButton (docs/POLISH.md G3): a PillButton (T84; was the legacy Button) that can play a one-off "glaze drip" sheen, a soft
// glaze[0] → white → glaze[1] band (v2 glaze gradient, T83) that sweeps across it once (~600 ms). Change `sheenKey` to replay;
// the first render never plays. Reduced motion: a short highlight fade instead of the sweep.
// The overlay ignores touches and is hidden from screen readers, so it never blocks input.
// The pill always fills the wrapper (block) so the sweep covers exactly the pill; size the
// wrapper with `style`. Variant defaults to filled, the primary CTA.
import { useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { durations, useMotionReduced } from '../theme/motion';
import { radiusV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PillButton } from './PillButton';

/** The single sheen sweep (the one animation allowed past MAX_MS, played once). */
export const SHEEN_MS = 600;

export type SheenButtonProps = Omit<ComponentProps<typeof PillButton>, 'style' | 'block'> & {
  /** Change to play the sheen once; the initial value never plays. */
  sheenKey?: string | number;
  /** Applied to the outer wrapper (layout: flex, margins). */
  style?: StyleProp<ViewStyle>;
};

export function SheenButton({ sheenKey, style, disabled, ...rest }: SheenButtonProps) {
  const { c } = useColorsV2();
  const reduced = useMotionReduced();
  const rawId = useId();
  const gid = `sheen${rawId.replace(/[^A-Za-z0-9_-]/g, '')}`;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const progress = useSharedValue(1); // 0 → 1 sweep; 1 means idle (hidden)
  const flash = useSharedValue(0);
  const lastKey = useRef(sheenKey);

  useEffect(() => {
    if (lastKey.current === sheenKey) return;
    lastKey.current = sheenKey;
    if (disabled) return;
    if (reduced) {
      flash.value = withSequence(
        withTiming(0.22, { duration: durations.fast }),
        withTiming(0, { duration: durations.base }),
      );
      return;
    }
    progress.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: SHEEN_MS, easing: Easing.inOut(Easing.quad) }),
    );
    // Shared values are stable; only a new key replays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheenKey]);

  const bandW = Math.max(48, box.w * 0.45);
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: progress.value <= 0 || progress.value >= 1 ? 0 : 1,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-bandW * 1.4, box.w + bandW * 0.4]) },
      { skewX: '-18deg' },
    ],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  };

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      <PillButton {...rest} disabled={disabled} block />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, styles.clip]}
      >
        {box.w > 0 ? (
          <Animated.View style={[styles.band, { width: bandW, height: box.h }, sweepStyle]}>
            <Svg width={bandW} height={box.h}>
              <Defs>
                <LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0" stopColor={c.glaze[0]} stopOpacity={0} />
                  <Stop offset="0.3" stopColor={c.glaze[0]} stopOpacity={0.35} />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.6} />
                  <Stop offset="0.7" stopColor={c.glaze[1]} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={c.glaze[1]} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={bandW} height={box.h} fill={`url(#${gid})`} />
            </Svg>
          </Animated.View>
        ) : null}
        <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  clip: { borderRadius: radiusV2.pill, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, left: 0 },
  flash: { backgroundColor: '#FFFFFF' },
});
