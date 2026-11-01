// Opening animation (owner, 23 Oct: "each app ... their own little logo and animation on start up"). T199
// (owner-1101d #2): full screen, premium and calm. T220 (owner-1101e 11:39): same animation he likes, now with the
// Prism figure he picked on 25 Oct (assets/brand/prism-figure.png) instead of the diamond.
// The native splash is the dark screen with the small unlit diamond in the middle; this view takes over on its first
// frame with exactly that picture (same colour, size and place). A thin beam of light sweeps in from the upper left and
// settles on the diamond, the diamond lights up, the light leaves its point as six soft glaze-colour bands fanning
// down to the bottom of the screen, a glint appears (1.1 s), then everything fades to reveal the Themes tab
// (≤ 1.5 s in all). Never takes touches; hidden from VoiceOver.
// Calm motion only (fb-1022c, T151): one linear clock drives every layer through keyframes sampled from sine
// ease-in-out curves in src/core/introGlaze.ts; the only movement is the beam's rotation about the point where it
// enters the gem; everything else is opacity. The fade is the app's `slow` token, eased in-out. No springs,
// overshoot, bounce or size change.
// Reduce Motion (system or the Glaze setting): the finished frame shows at once and simply fades when the app is ready.
import { useEffect, useMemo, useRef } from 'react';
import { whenFirstScreen } from '../core/startupHandoff';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  BAND_OPACITY,
  BRAND,
  FIGURE_GLINT_D,
  INTRO_MS,
  SPLASH_SIZE,
  SPECTRUM,
  canFade,
  introLayout,
  trackKeyframes,
  type Track,
} from '../core/introGlaze';
import { shouldReduceMotion } from '../core/settings';
import { loadSettings } from '../store/settings';
import { paletteFor } from '../theme/tokensV2';

/** Must equal expo-splash-screen imageWidth in app.json and SPLASH_SIZE (introGlaze.test.ts checks). */
export const INTRO_SIZE = SPLASH_SIZE;

/** Sine ease-in-out, the same curve as introGlaze.ease('inOut'). */
const calmInOut = Easing.inOut(Easing.sin);

const BAND_TRACKS: readonly Track[] = ['band0', 'band1', 'band2', 'band3', 'band4', 'band5'];

// T220: the picked Prism figure, unlit (= the native splash image) or lit. Bundled PNGs, no network.
const FIGURE_DIM = require('../../assets/brand/splash-icon.png');
const FIGURE_LIT = require('../../assets/brand/prism-figure.png');

/** The Prism figure in the 1024 canvas, lit or unlit (the unlit one is the native splash image). */
function Figure({ size, mode }: { size: number; mode: 'lit' | 'dim' }) {
  return <Image source={mode === 'lit' ? FIGURE_LIT : FIGURE_DIM} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} />;
}

export function IntroGlaze({
  ready,
  onReveal,
  onDone,
}: {
  ready: boolean;
  /** System appearance (kept for the caller; the intro itself is dark in both, like the native splash). */
  dark: boolean;
  /** Fade-out starts: mount the app underneath now (a store build's native screens would cover the intro). */
  onReveal?: () => void;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  // T199: the intro and the native splash are the dark `bg` token in both appearances (first frame = splash, no
  // flash); the fade then reveals the Themes tab on its own background.
  const bg = paletteFor('dark').bg;
  // Same size and place as the native splash image (app.json imageWidth = SPLASH_SIZE, centred).
  const lay = useMemo(() => introLayout(width, height), [width, height]);
  const size = lay.size;

  const kf = useMemo(
    () => ({
      beam: trackKeyframes('beam'),
      sweep: trackKeyframes('sweep'),
      ignite: trackKeyframes('ignite'),
      glint: trackKeyframes('glint'),
      bands: BAND_TRACKS.map((t) => trackKeyframes(t)),
    }),
    [],
  );

  const clock = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const played = useRef(false);
  const readyRef = useRef(ready);
  const finishing = useRef(false);
  const onRevealRef = useRef(onReveal);
  const onDoneRef = useRef(onDone);
  readyRef.current = ready;
  onRevealRef.current = onReveal;
  onDoneRef.current = onDone;

  const finish = useRef(() => {});
  finish.current = () => {
    if (finishing.current || !canFade(played.current, readyRef.current)) return;
    finishing.current = true;
    setTimeout(() => {
      // Mount the app under the (still opaque) intro, then fade only once its first screen has laid out, so no route
      // name, header or blank frame ever shows between the two (fb-1024 A). Capped so it can never hang.
      onRevealRef.current?.();
      whenFirstScreen(() => {
        Animated.timing(fade, { toValue: 0, duration: INTRO_MS.fadeOut, easing: calmInOut, useNativeDriver: true }).start(() => {
          onDoneRef.current();
        });
      });
    }, INTRO_MS.settle);
  };

  useEffect(() => {
    let alive = true;
    // The native splash hands over to this view on its first frame.
    requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    const systemReduce = AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    const appSetting = loadSettings().catch(() => null);
    Promise.all([systemReduce, appSetting])
      .then(([sys, settings]) => (settings ? shouldReduceMotion(settings, sys) : sys))
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        if (reduce) {
          clock.setValue(1);
          played.current = true;
          finish.current();
          return;
        }
        // One linear clock; every layer's calm curve is baked into its keyframes.
        Animated.timing(clock, { toValue: 1, duration: INTRO_MS.total, easing: Easing.linear, useNativeDriver: true }).start(() => {
          if (!alive) return;
          played.current = true;
          finish.current();
        });
      });
    return () => {
      alive = false;
      clock.stopAnimation();
    };
  }, [clock]);

  useEffect(() => {
    if (ready) finish.current();
  }, [ready]);

  const track = (k: { t: number[]; v: number[] }) => clock.interpolate({ inputRange: k.t, outputRange: k.v, extrapolate: 'clamp' });
  const beamIn = track(kf.beam);
  const sweep = clock.interpolate({ inputRange: kf.sweep.t, outputRange: kf.sweep.v.map((v) => `${v}deg`), extrapolate: 'clamp' });
  const ignite = track(kf.ignite);
  const glint = track(kf.glint);
  const bands = kf.bands.map(track);

  const { entry, tip, len, beam } = lay;

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.host, { backgroundColor: bg, opacity: fade }]}
    >
      {/* A soft violet bloom behind the figure while it is lit. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: ignite }]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="introBloom" cx={tip[0]} cy={tip[1] - size * 0.15} r={Math.max(width, height) * 0.45} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={BRAND.glow} stopOpacity={0.5} />
              <Stop offset="1" stopColor={BRAND.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#introBloom)" />
        </Svg>
      </Animated.View>
      {/* The six glaze colours fanning out of the point, soft bands that fade before the screen edge. */}
      {lay.bands.map((b, i) => (
        <Animated.View key={b.color} style={[StyleSheet.absoluteFill, { opacity: bands[i] }]}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={`introBand${i}`} x1={tip[0]} y1={tip[1]} x2={b.x2} y2={b.y2} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={SPECTRUM[i]} stopOpacity={BAND_OPACITY} />
                <Stop offset="0.55" stopColor={SPECTRUM[i]} stopOpacity={BAND_OPACITY * 0.35} />
                <Stop offset="1" stopColor={SPECTRUM[i]} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={b.d} fill={`url(#introBand${i})`} />
          </Svg>
        </Animated.View>
      ))}
      {/* The beam: a thin line of light (with a faint halo) in a square centred on its entry point, rotated there. */}
      <Animated.View
        style={[
          styles.abs,
          { left: entry[0] - len, top: entry[1] - len, width: 2 * len, height: 2 * len, opacity: beamIn, transform: [{ rotate: sweep }] },
        ]}
      >
        <Svg width={2 * len} height={2 * len}>
          <Defs>
            <LinearGradient id="introBeam" x1={beam.x2} y1={beam.y2} x2={beam.x1} y2={beam.y1} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.95} />
            </LinearGradient>
          </Defs>
          <Path d={`M${beam.x2} ${beam.y2} L${beam.x1} ${beam.y1}`} stroke="url(#introBeam)" strokeWidth={14} strokeLinecap="round" opacity={0.22} />
          <Path d={`M${beam.x2} ${beam.y2} L${beam.x1} ${beam.y1}`} stroke="url(#introBeam)" strokeWidth={3} strokeLinecap="round" />
        </Svg>
      </Animated.View>
      {/* The Prism figure: unlit (assets/brand/splash-icon.png, the native splash), with the lit one and the glint faded in over it. */}
      <View style={[styles.abs, { left: lay.ox, top: lay.oy, width: size, height: size }]}>
        <Figure size={size} mode="dim" />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: ignite }]}>
          <Figure size={size} mode="lit" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glint }]}>
          <Svg width={size} height={size} viewBox="0 0 1024 1024">
            <Path d={FIGURE_GLINT_D} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { zIndex: 100, overflow: 'hidden' },
  abs: { position: 'absolute' },
});
