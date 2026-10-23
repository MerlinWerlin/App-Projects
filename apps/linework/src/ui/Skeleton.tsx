// Shimmer placeholder for waits over ~300 ms (docs/POLISH.md rule 5). Drawn in the final layout's shape.
// A soft highlight band sweeps across on the native driver; it stops when the app is backgrounded and
// becomes a static tint under Reduce Motion.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { useAppActive, useReduceMotion } from '../theme/motion';
import { isRTL } from '../i18n/direction';

export type SkeletonProps = {
  style?: StyleProp<ViewStyle>;
  /** Corner radius; defaults to 14. */
  radius?: number;
};

export function Skeleton({ style, radius = 14 }: SkeletonProps) {
  const { c, isDark } = useTheme();
  const reduce = useReduceMotion();
  const active = useAppActive();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce || !active || w === 0) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, active, w, x]);

  const band = Math.max(80, w * 0.45);
  // The band rests at the start edge; translateX is physical, so right-to-left sweeps from the right edge leftwards.
  const rtl = isRTL();
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: rtl ? [band, -w] : [-band, w] });
  const hi = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.65)';

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: isDark ? c.card : c.line, borderRadius: radius, overflow: 'hidden', opacity: isDark ? 1 : 0.7 }, style]}
    >
      {!reduce && w > 0 ? (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, width: band, transform: [{ translateX }] }}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="sk" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={hi} stopOpacity="0" />
                <Stop offset="0.5" stopColor={hi} stopOpacity="1" />
                <Stop offset="1" stopColor={hi} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#sk)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
