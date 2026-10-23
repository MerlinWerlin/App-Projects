// Translucent "glass" material for navigation bars, tab bars, floating pill bars and sheets
// (docs/DESIGN_V2.md "Materials"). The material tint and alpha come from src/core/designV2.ts,
// where a test proves text on it stays WCAG AA over a pure black or white backdrop.
//
// Blur (oversight D72-1): expo-blur is in package.json and the trial kit runs
// `npx expo install expo-blur expo-linear-gradient` for the SDK-correct pins; Expo Go ships the
// module. BlurView sits under the translucent tint, so text contrast is still proven by the tint
// alone. With iOS "Reduce Transparency" on, no blur is drawn and the solid AA fallback is used.
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { materialFill, type MaterialName } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';

/** True while the system "Reduce Transparency" setting is on (iOS; always false elsewhere). */
export function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((v) => {
        if (alive) setOn(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v: boolean) => {
      if (alive) setOn(v);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

type Props = {
  children?: ReactNode;
  /** bar: nav/tab bars · thick: sheets · chrome: floating controls over photos. */
  material?: MaterialName;
  /** Hairline on this edge (a bar over content draws it on the edge facing the content). */
  hairline?: 'top' | 'bottom' | 'none';
  /**
   * 0-1 visibility of the material + hairline (e.g. a large-title bar is clear at rest and turns
   * to glass once content scrolls under it). Children are never faded.
   */
  progress?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

export function GlassBar({ children, material = 'bar', hairline = 'none', progress, style }: Props) {
  const { c, scheme } = useColorsV2();
  const solidOnly = useReduceTransparency();
  const fill = materialFill(material, scheme);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress ? progress.value : 1 }), [progress]);
  return (
    <View style={style}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backdropStyle]}>
        {solidOnly ? null : <BlurView intensity={fill.blurIntensity} tint={scheme} style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: solidOnly ? fill.solid : fill.translucent }]} />
        {hairline === 'none' ? null : (
          <View style={[styles.hairline, hairline === 'top' ? styles.top : styles.bottom, { backgroundColor: c.separator }]} />
        )}
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hairline: { position: 'absolute', start: 0, end: 0, height: StyleSheet.hairlineWidth },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
