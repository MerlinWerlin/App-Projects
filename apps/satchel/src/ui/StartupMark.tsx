// Startup mark (T18). Mounted over the first screen at the moment the native splash hides. It starts as an exact
// copy of the splash (same background colour, same 180 pt glyph, centred), so the hand-off has no white frame, then
// lifts the glyph slightly while the whole overlay fades away and unmounts. pointerEvents none: it never blocks a tap.
// Total time on screen stays under ~600 ms. With Reduce Motion on it is skipped entirely (unmounts at once), and if
// the setting cannot be read quickly it is skipped too rather than delay the app.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { duration } from '../theme/motion.ts';
import { brand } from '../theme/tokens.ts';

/** Width of the glyph in the native splash (app.json expo-splash-screen imageWidth). */
export const SPLASH_GLYPH = 180;
/** The splash PNG viewBox inside the 1024 icon grid (scripts/render-icons.mjs, box(760) centred at 512,528). */
const VIEWBOX = '132 148 760 760';
/** Longest we wait for the Reduce Motion answer before giving up on the animation. */
const SETTLE_MS = duration.fast;

type Palette = (typeof brand)['light'] | (typeof brand)['dark'];

/** The satchel / boarding-pass glyph from assets/brand/icon.svg. Notches drawn in the background colour. */
export function BrandGlyph({ size, palette }: { size: number; palette: Palette }) {
  return (
    <Svg width={size} height={size} viewBox={VIEWBOX} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M362 392 V350 A150 104 0 0 1 662 350 V392" fill="none" stroke={palette.body} strokeWidth={64} strokeLinecap="round" />
      <Rect x={212} y={372} width={600} height={470} rx={88} fill={palette.body} />
      <Path d="M212 460 A88 88 0 0 1 300 372 H724 A88 88 0 0 1 812 460 V592 L512 652 L212 592 Z" fill={palette.flap} />
      <Circle cx={212} cy={492} r={40} fill={palette.bg} />
      <Circle cx={812} cy={492} r={40} fill={palette.bg} />
      <Line x1={289} y1={492} x2={735} y2={492} stroke={palette.detail} strokeWidth={14} strokeDasharray={[30, 22]} />
      <Rect x={468} y={620} width={88} height={64} rx={18} fill={palette.detail} />
    </Svg>
  );
}

export function StartupMark({ dark }: { dark: boolean }) {
  const [done, setDone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let alive = true;
    let started = false;
    const finish = () => alive && setDone(true);
    const run = (reduceMotion: boolean) => {
      if (started) return;
      started = true;
      if (reduceMotion) return finish();
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: duration.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 1.08, duration: duration.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(finish);
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then(run)
      .catch(() => run(true));
    // Unknown after SETTLE_MS: skip the animation rather than hold the overlay (Reduce Motion users never see motion).
    const settle = setTimeout(() => run(true), SETTLE_MS);
    // Hard cap: whatever happens, the overlay is gone well before ~600 ms.
    const cap = setTimeout(finish, SETTLE_MS + duration.slow + duration.fast);
    return () => {
      alive = false;
      clearTimeout(settle);
      clearTimeout(cap);
    };
  }, [fade, lift]);

  if (done) return null;
  const palette = dark ? brand.dark : brand.light;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', opacity: fade }]}
    >
      <Animated.View style={{ transform: [{ scale: lift }] }}>
        <BrandGlyph size={SPLASH_GLYPH} palette={palette} />
      </Animated.View>
    </Animated.View>
  );
}
