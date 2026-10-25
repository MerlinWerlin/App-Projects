// Opening animation (owner, 23 Oct: "each app ... their own little logo and animation on start up"; mark = Prism,
// fb-1025 G). The native splash shows the tile with the crystal unlit; this view takes over on its first frame at the
// same size and place, the beam of light fades in, the crystal lights up, the spectrum fans out ray by ray, a gloss
// highlight sweeps across the crystal and the sparkle settles, then everything fades to reveal the app. Never takes
// touches; hidden from VoiceOver.
// Calm motion only (fb-1022c): one linear clock drives every layer through keyframes sampled from sine ease-in-out
// tweens in src/core/introGlaze.ts; the fade is the app's `slow` token, eased in-out. No springs, overshoot or bounce.
// Reduce Motion (system or the Glaze setting): the finished logo shows at once and simply fades when the app is ready.
import { useEffect, useMemo, useRef } from 'react';
import { whenFirstScreen } from '../core/startupHandoff';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  BEAM_D,
  BEAM_HALO_D,
  BRAND,
  FACETS,
  FAN,
  GEM,
  GEM_EDGES,
  GEM_OUTLINE,
  GLOSS_ANGLE,
  GLOSS_BAND_W,
  GLOSS_STREAK_D,
  INTRO_MS,
  SPECTRUM,
  TILE,
  canFade,
  polyPath,
  rayPath,
  sparklePath,
  squirclePath,
  trackKeyframes,
} from '../core/introGlaze';
import { shouldReduceMotion } from '../core/settings';
import { loadSettings } from '../store/settings';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Must equal expo-splash-screen imageWidth in app.json (introGlaze.test.ts checks). */
export const INTRO_SIZE = 240;

/** Sine ease-in-out, the same curve as introGlaze.ease('inOut'). */
const calmInOut = Easing.inOut(Easing.sin);

type Keyframes = { t: number[]; v: number[] };

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

  const art = useMemo(
    () => ({
      tile: squirclePath(0),
      outline: polyPath(GEM_OUTLINE),
      edges: GEM_EDGES.map(([p, q]) => `M${p[0]} ${p[1]} L${q[0]} ${q[1]}`).join(' '),
      facets: FACETS.map((fc) => ({ ...fc, d: polyPath(fc.pts) })),
      rays: SPECTRUM.map((color, i) => ({ color, d: rayPath(i), kf: trackKeyframes(`ray${i}`) })),
      sparkle: sparklePath(),
      beam: trackKeyframes('beam'),
      lit: trackKeyframes('lit'),
      glossX: trackKeyframes('glossX'),
      glossOpacity: trackKeyframes('glossOpacity'),
      sparkleIn: trackKeyframes('sparkle'),
    }),
    [],
  );

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

  const track = (kf: Keyframes) => clock.interpolate({ inputRange: kf.t, outputRange: kf.v, extrapolate: 'clamp' });
  const beam = track(art.beam);
  const lit = track(art.lit);
  const glossX = track(art.glossX);
  const glossOpacity = track(art.glossOpacity);
  const sparkle = track(art.sparkleIn);
  const [tx, ty] = GEM.T;

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
            <LinearGradient id="introBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.iconBg[0]} />
              <Stop offset="1" stopColor={c.iconBg[1]} />
            </LinearGradient>
            <RadialGradient id="introGlow" cx="512" cy="430" r="430" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={c.glow} stopOpacity={0.55} />
              <Stop offset="1" stopColor={c.glow} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="introShadow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={c.shadow} stopOpacity={dark ? 0.6 : 0.28} />
              <Stop offset="1" stopColor={c.shadow} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="introBeam" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.95} />
            </LinearGradient>
            <RadialGradient id="introTip" cx={tx} cy={ty} r="90" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="introFadeG" cx={tx} cy={ty} r={FAN.length} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.55" stopColor="#B4B4B4" />
              <Stop offset="1" stopColor="#000000" />
            </RadialGradient>
            <Mask id="introFade" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
              <Rect width="1024" height="1024" fill="url(#introFadeG)" />
            </Mask>
            <LinearGradient id="introBand" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            {art.facets.map((fc) => (
              <LinearGradient key={`d-${fc.id}`} id={`introDim-${fc.id}`} x1="0" y1="0" x2="0.35" y2="1">
                <Stop offset="0" stopColor={fc.dim[0]} />
                <Stop offset="1" stopColor={fc.dim[1]} />
              </LinearGradient>
            ))}
            {art.facets.map((fc) => (
              <LinearGradient key={`l-${fc.id}`} id={`introLit-${fc.id}`} x1="0" y1="0" x2="0.35" y2="1">
                <Stop offset="0" stopColor={fc.lit[0]} />
                <Stop offset="1" stopColor={fc.lit[1]} />
              </LinearGradient>
            ))}
            <ClipPath id="introClip">
              <Path d={art.tile} />
            </ClipPath>
            <ClipPath id="introGemClip">
              <Path d={art.outline} />
            </ClipPath>
          </Defs>
          {/* The unlit tile: identical to assets/brand/splash-icon(-dark).png. */}
          <Ellipse cx={TILE.cx} cy={TILE.cy + TILE.b + 30} rx={TILE.a * 0.86} ry={34} fill="url(#introShadow)" />
          <G clipPath="url(#introClip)">
            <Rect width={1024} height={1024} fill="url(#introBg)" />
            <Rect width={1024} height={1024} fill="url(#introGlow)" />
            <AnimatedG opacity={beam}>
              <Path d={BEAM_HALO_D} fill="url(#introBeam)" opacity={0.22} />
              <Path d={BEAM_D} fill="url(#introBeam)" />
            </AnimatedG>
            <G mask="url(#introFade)" opacity={0.92}>
              {art.rays.map((ray, i) => (
                <AnimatedPath key={i} d={ray.d} fill={ray.color} opacity={track(ray.kf)} />
              ))}
            </G>
            {art.facets.map((fc) => (
              <Path key={fc.id} d={fc.d} fill={`url(#introDim-${fc.id})`} />
            ))}
            <Path d={art.edges} fill="none" stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={3} strokeLinecap="round" />
            <Path d={art.outline} fill="none" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={5} strokeLinejoin="round" />
            <AnimatedG opacity={lit}>
              {art.facets.map((fc) => (
                <Path key={fc.id} d={fc.d} fill={`url(#introLit-${fc.id})`} />
              ))}
              <Path d={art.edges} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" />
              <Path d={art.outline} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={5} strokeLinejoin="round" />
              <Circle cx={tx} cy={ty} r={90} fill="url(#introTip)" />
            </AnimatedG>
            <G clipPath="url(#introGemClip)">
              <G transform={`rotate(${GLOSS_ANGLE} 512 420)`}>
                <AnimatedRect x={glossX} y={-300} width={GLOSS_BAND_W} height={1600} fill="url(#introBand)" opacity={glossOpacity} />
              </G>
            </G>
            {/* The resting gloss and sparkle, as in the app icon. */}
            <AnimatedG opacity={sparkle}>
              <Path d={GLOSS_STREAK_D} fill="none" stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" opacity={0.75} />
              <Path d={art.sparkle} fill="#FFFFFF" />
            </AnimatedG>
          </G>
          <Path d={art.tile} fill="none" stroke={c.tileRim} strokeWidth={3} />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});
