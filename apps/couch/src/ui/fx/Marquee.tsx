import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { onFx } from './bus';
import { MARQUEE } from './glow';

/**
 * Theatre-marquee dots (premium polish P1 extra): a row of tiny dim lights along the top edge of the
 * remote that ripple once, left to right, when the TV connects (fx 'connected'). Reduce Motion: all
 * dots brighten and fade together. Still otherwise (no idle loop). Decoration only.
 */
export function Marquee({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const dots = useRef(Array.from({ length: MARQUEE.dots }, () => new Animated.Value(MARQUEE.rest))).current;

  useEffect(() => {
    let running: Animated.CompositeAnimation | null = null;
    const off = onFx((e) => {
      if (e.type !== 'connected') return;
      running?.stop();
      const blink = (v: Animated.Value) =>
        Animated.sequence([
          Animated.timing(v, { toValue: MARQUEE.peak, duration: MARQUEE.up, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: MARQUEE.rest, duration: MARQUEE.down, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]);
      running = reduce ? Animated.parallel(dots.map(blink)) : Animated.stagger(MARQUEE.stagger, dots.map(blink));
      running.start();
    });
    return () => {
      off();
      running?.stop();
    };
  }, [reduce, dots]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, style]}
    >
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { backgroundColor: color, opacity: v }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 6, paddingHorizontal: 28 },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
});
