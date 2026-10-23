// Shared press feedback (docs/POLISH.md rule 3): scales to 0.97 with the spring and fires a haptic that
// follows the Haptics setting. Use for buttons and cards. Accessibility props pass through to the Pressable.
// T84: optional `ripple` colour adds two concentric rings from the touch point (src/ui/v2/Ripple.tsx), off under
// Reduce Motion.
import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { pressScale, springTo, useReduceMotion } from '../theme/motion';
import { select, success, tap } from '../native/haptics';
import { Ripple, type RippleHandle } from './v2/Ripple';

export type PressHaptic = 'tap' | 'select' | 'success' | 'none';

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  /** Style for the animated outer view (layout, size, background, border). */
  style?: StyleProp<ViewStyle>;
  /** Haptic on press: 'tap' (primary actions, default), 'select' (toggles), 'success', or 'none'. */
  haptic?: PressHaptic;
  /** Scale while pressed; default 0.97. */
  scaleTo?: number;
  /** Ring colour for the tap ripple (primary actions); omit for none. Reduce Motion → no ripple. */
  ripple?: string;
};

export function PressableScale({
  children,
  style,
  haptic = 'tap',
  scaleTo = pressScale,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  ripple,
  ...rest
}: PressableScaleProps) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const rippleRef = useRef<RippleHandle>(null);
  const showRipple = !!ripple && !reduce;
  const flat: ViewStyle = StyleSheet.flatten(style) ?? {};
  const rippleRadius = showRipple ? flat.borderRadius : undefined;
  // The Pressable is the parent's flex child, so flex sizing and alignSelf must sit on it too (otherwise a
  // `flex: 1` card or segment in a row stays content-sized and overflows instead of sharing the width).
  const outer: ViewStyle = {};
  if (flat.flex !== undefined) outer.flex = flat.flex;
  if (flat.flexGrow !== undefined) outer.flexGrow = flat.flexGrow;
  if (flat.flexShrink !== undefined) outer.flexShrink = flat.flexShrink;
  if (flat.flexBasis !== undefined) outer.flexBasis = flat.flexBasis;
  if (flat.alignSelf !== undefined) outer.alignSelf = flat.alignSelf;
  return (
    <Pressable
      {...rest}
      style={outer}
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduce) springTo(scale, scaleTo, false).start();
        if (showRipple) rippleRef.current?.startAtPage(e.nativeEvent.pageX, e.nativeEvent.pageY);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        springTo(scale, 1, reduce).start();
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic === 'tap') tap();
        else if (haptic === 'select') select();
        else if (haptic === 'success') success();
        onPress?.(e);
      }}
    >
      {(state) => (
        <Animated.View style={[style, { transform: [{ scale }] }]}>
          {typeof children === 'function' ? children(state) : children}
          {showRipple ? (
            <Ripple ref={rippleRef} color={ripple ?? 'transparent'} borderRadius={typeof rippleRadius === 'number' ? rippleRadius : 0} />
          ) : null}
        </Animated.View>
      )}
    </Pressable>
  );
}
