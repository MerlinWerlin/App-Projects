// Opening animation (owner, 23 Oct: "each app ... their own little logo and animation on start up"). The native splash
// shows the empty porcelain tile; this view takes over on its first frame at the same size and place, the glaze pours
// over the tile's top edge and runs down in three drips (the longest slowest), a bead forms at its tip, a gloss
// highlight sweeps across, then everything fades to reveal the app. Never takes touches; hidden from VoiceOver.
// Calm motion only (fb-1022c): one linear clock drives every layer through keyframes sampled from sine ease-in-out
// tweens in src/core/introGlaze.ts; the fade is the app's `slow` token, eased in-out. No springs, overshoot or bounce.
// Reduce Motion (system or the Glaze setting): the finished logo shows at once and simply fades when the app is ready.
import { useEffect, useMemo, useRef } from 'react';
import { whenFirstScreen } from '../core/startupHandoff';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  BRAND,
  DRIP_GLINT_D,
  FINAL_STATE,
  GLAZE_PROUD,
  GLOSS_ANGLE,
  GLOSS_BAND_W,
  GLOSS_DOT,
  GLOSS_STREAK_D,
  INTRO_MS,
  TILE,
  TILE_LEFT,
  TILE_RIGHT,
  TILE_TOP,
  UNDER_DY,
  beadCircle,
  canFade,
  glazeKeyframes,
  glazePath,
  squirclePath,
  trackKeyframes,
} from '../core/introGlaze';
import { shouldReduceMotion } from '../core/settings';
import { loadSettings } from '../store/settings';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Must equal expo-splash-screen imageWidth in app.json (introGlaze.test.ts checks). */
export const INTRO_SIZE = 240;

/** Sine ease-in-out, the same curve as introGlaze.ease('inOut'). */
const calmInOut = Easing.inOut(Easing.sin);

export function IntroGlaze({
  ready,
  dark,
  onReveal,
  onDone,
}: {
  ready: boolean;
  dark: boolean;
  /** Fade-out starts: mount the app underneath now (a store build's native screens would cover the intro). */
  onReveal?: () => void;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const scheme = dark ? 'dark' : 'light';
  const c = BRAND[scheme];
  // Same size and place as the native splash image (app.json imageWidth, centred) so the hand-over is seamless.
  const size = Math.min(INTRO_SIZE, width - 32, height - 32);

  const art = useMemo(() => {
    const glaze = glazeKeyframes(32);
    const bead = trackKeyframes('bead');
    const gx = trackKeyframes('glossX');
    const go = trackKeyframes('glossOpacity');
    const streak = trackKeyframes('streak');
    return {
      tile: squirclePath(0),
      clip: squirclePath(GLAZE_PROUD),
      finalGlaze: glazePath(FINAL_STATE),
      bead: beadCircle(1),
      glaze,
      beadR: bead,
      glossX: gx,
      glossOpacity: go,
      streak,
    };
  }, []);

  const clock = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const poured = useRef(false);
  const readyRef = useRef(ready);
  const finishing = useRef(false);
  const onRevealRef = useRef(onReveal);
  const onDoneRef = useRef(onDone);
  readyRef.current = ready;
  onRevealRef.current = onReveal;
  onDoneRef.current = onDone;

  const finish = useRef(() => {});
  finish.current = () => {
    if (finishing.current || !canFade(poured.current, readyRef.current)) return;
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
          poured.current = true;
          finish.current();
          return;
        }
        // One linear clock; every layer's calm easing is baked into its keyframes.
        Animated.timing(clock, { toValue: 1, duration: INTRO_MS.total, easing: Easing.linear, useNativeDriver: false }).start(() => {
          if (!alive) return;
          poured.current = true;
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

  const glazeD = clock.interpolate({ inputRange: art.glaze.t, outputRange: art.glaze.d, extrapolate: 'clamp' });
  const beadR = clock.interpolate({ inputRange: art.beadR.t, outputRange: art.beadR.v, extrapolate: 'clamp' });
  const glossX = clock.interpolate({ inputRange: art.glossX.t, outputRange: art.glossX.v, extrapolate: 'clamp' });
  const glossOpacity = clock.interpolate({ inputRange: art.glossOpacity.t, outputRange: art.glossOpacity.v, extrapolate: 'clamp' });
  const streak = clock.interpolate({ inputRange: art.streak.t, outputRange: art.streak.v, extrapolate: 'clamp' });
  const b = art.bead;

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.host, { backgroundColor: c.bg, opacity: fade }]}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 1024 1024">
          <Defs>
            <LinearGradient id="introTile" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.tile[0]} />
              <Stop offset="1" stopColor={c.tile[1]} />
            </LinearGradient>
            <LinearGradient id="introBase" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.6" stopColor={c.shadow} stopOpacity={0} />
              <Stop offset="1" stopColor={c.shadow} stopOpacity={dark ? 0.25 : 0.07} />
            </LinearGradient>
            <RadialGradient id="introShadow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={c.shadow} stopOpacity={dark ? 0.5 : 0.22} />
              <Stop offset="1" stopColor={c.shadow} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient
              id="introGlaze"
              x1={TILE_LEFT}
              y1={TILE_TOP}
              x2={TILE_RIGHT}
              y2={TILE_TOP + 460}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={c.glaze[0]} />
              <Stop offset="1" stopColor={c.glaze[1]} />
            </LinearGradient>
            <LinearGradient id="introSheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="introBand" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <ClipPath id="introClip">
              <Path d={art.clip} />
            </ClipPath>
            <ClipPath id="introGlazeClip">
              <Path d={art.finalGlaze} />
            </ClipPath>
          </Defs>
          {/* The empty tile: identical to assets/brand/splash-icon(-dark).png. */}
          <Ellipse cx={TILE.cx} cy={TILE.cy + TILE.b + 34} rx={TILE.a * 0.92} ry={44} fill="url(#introShadow)" />
          <Path d={art.tile} fill="url(#introTile)" stroke={c.tileRim} strokeWidth={3} />
          <Path d={art.tile} fill="url(#introBase)" />
          <G clipPath="url(#introClip)">
            <G transform={`translate(0 ${UNDER_DY})`}>
              <AnimatedPath d={glazeD} fill={c.under} />
              <AnimatedCircle cx={b.cx} cy={b.cy} r={beadR} fill={c.under} />
            </G>
            <AnimatedPath d={glazeD} fill="url(#introGlaze)" />
            <AnimatedCircle cx={b.cx} cy={b.cy} r={beadR} fill="url(#introGlaze)" />
            <AnimatedPath d={glazeD} fill="url(#introSheen)" />
            <G clipPath="url(#introGlazeClip)">
              <G transform={`rotate(${GLOSS_ANGLE} ${TILE.cx} ${TILE.cy})`}>
                <AnimatedRect x={glossX} y={-300} width={GLOSS_BAND_W} height={1600} fill="url(#introBand)" opacity={glossOpacity} />
              </G>
            </G>
          </G>
          {/* The resting gloss, as in the app icon. */}
          <AnimatedG opacity={streak}>
            <Path d={GLOSS_STREAK_D} fill="none" stroke="#FFFFFF" strokeWidth={22} strokeLinecap="round" opacity={0.85} />
            <Circle cx={GLOSS_DOT.cx} cy={GLOSS_DOT.cy} r={GLOSS_DOT.r} fill="#FFFFFF" opacity={0.85} />
            <Path d={DRIP_GLINT_D} fill="none" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" opacity={0.45} />
            <Circle cx={b.cx - b.r * 0.38} cy={b.cy - b.r * 0.32} r={b.r * 0.2} fill="#FFFFFF" opacity={0.7} />
          </AnimatedG>
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});
