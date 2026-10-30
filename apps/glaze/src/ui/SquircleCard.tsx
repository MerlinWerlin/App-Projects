// Continuous-corner card (docs/DESIGN_V2.md "SquircleCard"): big soft rounded surface with a
// layered shadow. Pressable cards ease to 0.97 (PressableScale); `selected` eases the card to
// 1.04 and draws a tint ring. Reduce Motion: no size change, the ring still shows.
// fb-1022c: timing with an ease-out curve, never a spring, so nothing overshoots.
// T118 (fb-1024 B): a card that mounts unselected starts no animation (it used to run a 1 -> 1
// timing per card on mount, e.g. 24 at once when a grid mounts).
// T173 (docs/PREMIUM_UI.md "depth from layered surfaces, not lines"): `outline={false}` drops the
// dark-mode hairline; pair it with tone="raised" so the card lifts by surface instead. Default
// unchanged for screens the premium pass has not reached yet.
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { durations, easeOutCurve, useMotionReduced } from '../theme/motion';
import {
  continuous,
  pressV2,
  radiusV2,
  shadowV2,
  spaceV2,
  type ElevationLevel,
  type PastelName,
} from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { HapticKind } from './haptics';
import { PressableScale } from './PressableScale';

type Props = {
  children?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** surface (default), raised, or one of the six pastel fills. */
  tone?: 'surface' | 'raised' | PastelName;
  size?: 'regular' | 'large';
  elevation?: ElevationLevel;
  /** Inner padding (default 16). Use 0 for edge-to-edge artwork; content is clipped to the corners. */
  padding?: number;
  selected?: boolean;
  /** Dark-mode hairline border when not selected (default true). T173 premium screens pass false. */
  outline?: boolean;
  haptic?: HapticKind | false;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function SquircleCard({
  children,
  onPress,
  onLongPress,
  tone = 'surface',
  size = 'regular',
  elevation = 'card',
  padding = spaceV2.lg,
  selected = false,
  outline = true,
  haptic = 'light',
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { c, scheme } = useColorsV2();
  const reduced = useMotionReduced();
  const pop = useSharedValue(1);
  const mounted = useRef(false);
  useEffect(() => {
    const target = selected && !reduced ? pressV2.selectedPop : 1;
    const first = !mounted.current;
    mounted.current = true;
    // Already at rest on mount: nothing to animate.
    if (first && target === 1) return;
    pop.value = withTiming(target, { duration: reduced ? durations.fast : durations.base, easing: easeOutCurve });
  }, [selected, reduced, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const radius = size === 'large' ? radiusV2.cardLarge : radiusV2.card;
  const bg = tone === 'surface' ? c.surface : tone === 'raised' ? c.surfaceRaised : c.pastels[tone].fill;
  // The shadow sits on the outer view; the inner view clips content to the continuous corners.
  const outer: StyleProp<ViewStyle> = [{ borderRadius: radius }, continuous, shadowV2(elevation, scheme)];
  const inner: StyleProp<ViewStyle> = [
    styles.inner,
    continuous,
    { borderRadius: radius, backgroundColor: bg, padding },
    selected ? { borderColor: c.tint, borderWidth: 2 } : scheme === 'dark' && outline ? { borderColor: c.separator, borderWidth: StyleSheet.hairlineWidth } : null,
  ];

  return (
    <Animated.View style={[popStyle, style]}>
      {onPress || onLongPress ? (
        <PressableScale
          onPress={onPress}
          onLongPress={onLongPress}
          haptic={haptic}
          pressedScale={pressV2.card}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ selected }}
          style={outer}
        >
          <View style={inner}>{children}</View>
        </PressableScale>
      ) : (
        <View style={outer} accessibilityLabel={accessibilityLabel}>
          <View style={inner}>{children}</View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: { overflow: 'hidden' },
});
