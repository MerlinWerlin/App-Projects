import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { shimmerPeriod, skeletonDelay } from '../../theme/motion';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useTheme } from '../../theme/useTheme';
import { useActive } from './useActive';
import { useT } from '../../i18n/react';

/**
 * A placeholder block in the final layout with a soft shimmer sweep (docs/POLISH.md rule 5).
 * Opacity-only pulse on the native driver; paused when the screen is unfocused/backgrounded;
 * static with Reduce Motion. Hidden from screen readers (the parent announces "Loading").
 */
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const active = useActive();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || !active) {
      v.stopAnimation();
      v.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: shimmerPeriod / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: shimmerPeriod / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, active, v]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.block, { backgroundColor: t.keyEdge, opacity }, style]}
    />
  );
}

/**
 * Shows `skeleton` only when `loading` lasts longer than ~300 ms (short loads show nothing),
 * then the content. Never a spinner.
 */
export function WithSkeleton({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!loading) {
      setLate(false);
      return;
    }
    const id = setTimeout(() => setLate(true), skeletonDelay);
    return () => clearTimeout(id);
  }, [loading]);
  if (loading) return late ? <View accessibilityLabel={t('ui.common.loading')}>{skeleton}</View> : null;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  block: { borderRadius: 12, minHeight: 14 },
});
