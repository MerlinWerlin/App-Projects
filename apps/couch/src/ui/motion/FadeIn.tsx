import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, UIManager, type StyleProp, type ViewStyle } from 'react-native';
import { duration, easeOut, entrance } from '../../theme/motion';
import { useReducedMotion } from '../../theme/useReducedMotion';

/**
 * Staggered FadeInDown on first mount only (docs/POLISH.md rule 4): item `index` waits
 * 30 ms * index (capped at 8) and rises 8 px while fading in. Re-renders never replay it.
 * Reduce Motion: a short fade, no movement. Native driver (opacity + translateY).
 */
export function FadeIn({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const e = entrance(index, reduce);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      delay: e.delay,
      duration: e.duration,
      easing: Easing.bezier(...easeOut),
      useNativeDriver: true,
    }).start();
    // First mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [e.fromY, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

let layoutEnabled = false;

/**
 * Call right before a list add/remove/reorder state change so items glide to their new places
 * (the LinearTransition of rule 4, via React Native's built-in LayoutAnimation). No-op with Reduce Motion.
 */
export function animateNextLayout(reduceMotion: boolean): void {
  if (reduceMotion) return;
  try {
    if (!layoutEnabled && Platform.OS === 'android') {
      // Old-architecture Android needs this; harmless no-op on the new architecture.
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
    layoutEnabled = true;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(duration.base, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
  } catch {
    // Layout animation unavailable: change instantly.
  }
}
