// Shared pressable for buttons and cards (docs/POLISH.md rule 3): eases to 0.97 while pressed
// on the UI thread, fires a haptic that follows the Haptics setting, never blocks input.
// fb-1022c (owner 22 Oct evening: no bounce): press feedback is a short ease-out timing, never a
// spring, so nothing overshoots; `feedback="fade"` dims instead of shrinking (category bubbles).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PRESS_SCALE, durations, easeOutCurve, useMotionReduced } from '../theme/motion';
import { haptic, type HapticKind } from './haptics';

const APressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Haptic on press: 'light' for primary actions, 'select' for toggles/pickers, false for none. */
  haptic?: HapticKind | false;
  /** Pressed scale (default 0.97). */
  pressedScale?: number;
  /** 'scale' (default) eases to `pressedScale`; 'fade' only dims, the size never changes. */
  feedback?: 'scale' | 'fade';
};

/** Press-in / press-out timing: short ease-out, no overshoot. */
const PRESS_TIMING = { duration: durations.fast, easing: easeOutCurve };
/** Opacity while pressed for 'fade' feedback and Reduce Motion. */
const PRESSED_DIM = 0.85;

export function PressableScale({
  children,
  style,
  haptic: kind = false,
  pressedScale = PRESS_SCALE,
  feedback = 'scale',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduced = useMotionReduced();
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);
  // Animated styles override static ones, so fold the caller's opacity (e.g. disabled 0.45) in here.
  const flatOpacity = StyleSheet.flatten(style)?.opacity;
  const baseOpacity = typeof flatOpacity === 'number' ? flatOpacity : 1;
  const animStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }], opacity: dim.value * baseOpacity }),
    [baseOpacity],
  );

  const handleIn = (e: GestureResponderEvent) => {
    if (reduced || feedback === 'fade') dim.value = withTiming(PRESSED_DIM, PRESS_TIMING);
    else scale.value = withTiming(pressedScale, PRESS_TIMING);
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    if (reduced || feedback === 'fade') dim.value = withTiming(1, PRESS_TIMING);
    else scale.value = withTiming(1, PRESS_TIMING);
    onPressOut?.(e);
  };
  const handlePress = (e: GestureResponderEvent) => {
    if (kind) haptic(kind);
    onPress?.(e);
  };

  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      onPress={onPress ? handlePress : undefined}
      style={[animStyle, style]}
    >
      {children}
    </APressable>
  );
}
