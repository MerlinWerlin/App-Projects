import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { pressedScale, spring } from '../../theme/motion';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { haptic, type HapticKind } from '../remote/haptics';

/**
 * Shared press feedback for every button and card (docs/POLISH.md rule 3):
 * scales to 0.97 with the motion spring on the UI thread (native driver), plays a haptic on press
 * (light by default; 'heavy' for Power, 'selection' for toggles, 'none' to opt out) and keeps
 * the Pressable's accessibility props. Reduce Motion: no scaling, a slight dim instead.
 * `style` goes on the animated wrapper (layout + look), so callers style it like a View.
 */
export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  haptic?: HapticKind;
  /** Scale while pressed (default 0.97 from motion tokens). */
  scaleTo?: number;
};

export function PressableScale({
  children,
  style,
  haptic: kind = 'light',
  scaleTo,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const target = reduce ? 1 : (scaleTo ?? pressedScale(false));

  const to = (v: number) => {
    Animated.spring(scale, { toValue: v, ...spring, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        to(target);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        to(1);
        onPressOut?.(e);
      }}
      onPress={(e: GestureResponderEvent) => {
        haptic(kind);
        onPress?.(e);
      }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            typeof style === 'function' ? style({ pressed }) : style,
            { transform: [{ scale }] },
            reduce && pressed ? { opacity: 0.85 } : null,
            disabled ? { opacity: 0.5 } : null,
          ]}
        >
          {typeof children === 'function' ? children({ pressed }) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
