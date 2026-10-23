// Opening animation (fb-1022c): the pencil slowly draws the blue brand line, stops at the end of it, then a soft light
// runs along the line and a few sparkles twinkle at the pencil tip until the app has finished loading; then the whole
// thing fades away. Shown over (and before) the app; never takes touches; hidden from VoiceOver.
// Reduce Motion: the finished logo shows at once and simply fades when ready.
import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { INTRO_LINE_D, INTRO_MS, MOTIF, PENCIL_DEG, introLineLength, introSamples } from '../core/introPath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Must equal expo-splash-screen imageWidth in app.json (introPath.test.ts checks). */
export const INTRO_SIZE = 240;

const BRAND = {
  light: { paper: '#F7F3EE', ink: '#3B5BDB' },
  dark: { paper: '#121110', ink: '#91A7FF' },
} as const;

/** Pencil art from the logo, tip at (0,0), body along +x (motif units). */
const PENCIL_LEN = 376;
const PENCIL_H = 80;

function Pencil() {
  return (
    <G>
      <Path d="M 0 0 L 96 -40 L 96 40 Z" fill="#F1D9B5" />
      <Path d="M 0 0 L 34 -14 L 34 14 Z" fill="#1F1D1A" />
      <Rect x={96} y={-40} width={196} height={80} fill="#FFC94D" />
      <Rect x={96} y={-40} width={196} height={26} fill="#FFD978" />
      <Rect x={292} y={-40} width={34} height={80} fill="#B9B2A8" />
      <Path d="M 326 -40 L 350 -40 Q 376 -40 376 -14 L 376 14 Q 376 40 350 40 L 326 40 Z" fill="#FF7AA2" />
    </G>
  );
}

/** A four-point sparkle centred on (0,0), radius 1 (scaled by the caller). */
const SPARK_D = 'M 0 -1 Q 0.12 -0.12 1 0 Q 0.12 0.12 0 1 Q -0.12 0.12 -1 0 Q -0.12 -0.12 0 -1 Z';

export function IntroDraw({
  ready,
  dark,
  onReveal,
  onDone,
}: {
  ready: boolean;
  dark: boolean;
  /** Fade-out starts: mount the app underneath now (fb-1023: the app's native screens covered the intro). */
  onReveal?: () => void;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const colors = dark ? BRAND.dark : BRAND.light;
  // Same size and place as the native splash image (app.json imageWidth 240, centred) so the hand-over is seamless.
  const size = Math.min(INTRO_SIZE, width - 32, height - 32);
  const k = size / 1024;

  const L = useMemo(() => introLineLength(), []);
  const samples = useMemo(() => introSamples(40), []);
  const draw = useRef(new Animated.Value(0)).current;
  const light = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const drawn = useRef(false);
  const readyRef = useRef(ready);
  const finishing = useRef(false);
  const loops = useRef<Animated.CompositeAnimation[]>([]);
  readyRef.current = ready;

  const finish = useRef(() => {});
  finish.current = () => {
    if (finishing.current || !drawn.current || !readyRef.current) return;
    finishing.current = true;
    setTimeout(() => {
      onReveal?.();
      Animated.timing(fade, { toValue: 0, duration: INTRO_MS.fadeOut, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(() => {
        for (const l of loops.current) l.stop();
        onDone();
      });
    }, INTRO_MS.settle);
  };

  useEffect(() => {
    let alive = true;
    // The native splash hands over to this view on its first frame.
    requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    const startLights = () => {
      const run = Animated.loop(
        Animated.timing(light, { toValue: 1, duration: INTRO_MS.shimmer, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      );
      const tw = Animated.loop(
        Animated.sequence([
          Animated.timing(twinkle, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(twinkle, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        ]),
      );
      loops.current = [run, tw];
      run.start();
      tw.start();
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        if (reduce) {
          draw.setValue(1);
          drawn.current = true;
          finish.current();
          return;
        }
        Animated.timing(draw, { toValue: 1, duration: INTRO_MS.draw, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(() => {
          if (!alive) return;
          startLights();
          // Always show at least one pass of the light along the line, even when the app is already loaded.
          setTimeout(() => {
            if (!alive) return;
            drawn.current = true;
            finish.current();
          }, INTRO_MS.shimmer);
        });
      });
    return () => {
      alive = false;
      for (const l of loops.current) l.stop();
    };
  }, [draw, light, twinkle]);

  useEffect(() => {
    if (ready) finish.current();
  }, [ready]);

  // Line draws by shrinking its dash offset; the light is a short bright dash travelling start → end.
  const dashOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [L, 0] });
  const SEG = 150;
  const lightOffset = light.interpolate({ inputRange: [0, 1], outputRange: [SEG, -L] });
  const lightOpacity = light.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.6, 0.6, 0] });

  // Pencil tip follows the line (viewBox units → points).
  const inputRange = samples.map((s) => s.t);
  const pw = PENCIL_LEN * MOTIF.s * k;
  const ph = PENCIL_H * MOTIF.s * k;
  const tx = draw.interpolate({ inputRange, outputRange: samples.map((s) => s.x * k - pw) });
  const ty = draw.interpolate({ inputRange, outputRange: samples.map((s) => s.y * k - ph / 2) });
  // A tiny writing wobble while drawing, settling to the logo's angle.
  const rot = draw.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [`${PENCIL_DEG - 4}deg`, `${PENCIL_DEG + 3}deg`, `${PENCIL_DEG - 3}deg`, `${PENCIL_DEG + 2}deg`, `${PENCIL_DEG}deg`],
  });

  const end = samples[samples.length - 1]!;
  const sparkScale = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.host, { backgroundColor: colors.paper, opacity: fade }]}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 1024 1024">
          <G transform={`translate(${MOTIF.tx} ${MOTIF.ty}) scale(${MOTIF.s})`}>
            <AnimatedPath
              d={INTRO_LINE_D}
              fill="none"
              stroke={colors.ink}
              strokeWidth={58}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[L, L]}
              strokeDashoffset={dashOffset}
            />
            <AnimatedPath
              d={INTRO_LINE_D}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={24}
              strokeLinecap="round"
              strokeDasharray={[SEG, L + SEG]}
              strokeDashoffset={lightOffset}
              opacity={lightOpacity}
            />
          </G>
        </Svg>
        {/* Sparkles at the pencil tip once the line is drawn. */}
        {[
          { dx: 40, dy: -70, r: 26, phase: 0 },
          { dx: -60, dy: -40, r: 16, phase: 1 },
          { dx: 70, dy: 30, r: 18, phase: 2 },
        ].map((sp, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: (end.x + sp.dx) * k - sp.r * k, /* rtl-physical-ok: logo art never mirrors */
              top: (end.y + sp.dy) * k - sp.r * k,
              width: sp.r * 2 * k,
              height: sp.r * 2 * k,
              opacity: i === 1 ? Animated.subtract(1, twinkle) : twinkle,
              transform: [{ scale: i === 1 ? Animated.subtract(1.4, sparkScale) : sparkScale }],
            }}
          >
            <Svg width={sp.r * 2 * k} height={sp.r * 2 * k} viewBox="-1 -1 2 2">
              <Path d={SPARK_D} fill={i === 0 ? '#FFC94D' : colors.ink} />
            </Svg>
          </Animated.View>
        ))}
        {/* Pencil: a view twice the pencil's length with the tip at its centre, so it rotates about the tip. */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0, /* rtl-physical-ok: logo art never mirrors */
            top: 0,
            width: pw * 2,
            height: ph,
            transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }],
          }}
        >
          <Svg width={pw * 2} height={ph} viewBox={`${-PENCIL_LEN} ${-PENCIL_H / 2} ${PENCIL_LEN * 2} ${PENCIL_H}`}>
            <Pencil />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});
