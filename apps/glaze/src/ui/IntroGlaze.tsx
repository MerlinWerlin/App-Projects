// Opening animation (owner, 23 Oct: "each app ... their own little logo and animation on start up"; mark = Prism, the
// little prism creature since owner-1101 item 8, T190). The native splash shows Prism asleep in its tile; this view
// takes over on its first frame at the same size and place. The rainbow arch fades in, Prism opens its eyes, floats up
// a few points and settles, a shimmer crosses its glass, it blinks once and the sparkles appear (≤ 1.6 s), then
// everything fades to reveal the app. Never takes touches; hidden from VoiceOver.
// Calm motion only (fb-1022c, T151): one linear clock drives every layer through keyframes sampled from sine
// ease-in-out / raised-cosine curves in src/core/introGlaze.ts; the float is a plain vertical translate (no size
// change); the fade is the app's `slow` token, eased in-out. No springs, overshoot or bounce.
// Reduce Motion (system or the Glaze setting): the finished frame (awake, arch and sparkles) shows at once and simply
// fades when the app is ready.
import { useEffect, useMemo, useRef } from 'react';
import { whenFirstScreen } from '../core/startupHandoff';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  ARM,
  ARMS,
  BLUSH,
  BLUSH_R,
  BODY_D,
  BRAND,
  CLOUDS_D,
  CLOUD_FILL,
  EYE,
  EYES,
  FACETS,
  FACET_EDGES_D,
  FEET,
  FOOT,
  GLASS,
  GLOSS_STREAK_D,
  INTRO_MS,
  MOUTH_D,
  SHADOW,
  SHEEN_OPACITY,
  SHIMMER_ANGLE,
  SHIMMER_BAND_W,
  SPARKLES_D,
  SPECTRUM,
  TILE,
  archPath,
  canFade,
  closedEyePath,
  polyPath,
  sheenPath,
  squirclePath,
  trackKeyframes,
} from '../core/introGlaze';
import { shouldReduceMotion } from '../core/settings';
import { loadSettings } from '../store/settings';
import { paletteFor } from '../theme/tokensV2';

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
  // T173 (PREMIUM_UI §3.1): the host reads the same `bg` token as every screen (Themes, the "/" redirect), so the
  // last frame of the fade and the Themes background are one colour in light and dark.
  const bg = paletteFor(scheme).bg;
  // Same size and place as the native splash image (app.json imageWidth, centred) so the hand-over is seamless.
  const size = Math.min(INTRO_SIZE, width - 32, height - 32);

  const art = useMemo(
    () => ({
      tile: squirclePath(0),
      facets: FACETS.map((fc) => ({ ...fc, d: polyPath(fc.pts) })),
      arches: SPECTRUM.map((color, i) => ({ color, d: archPath(i) })),
      sheen: SPECTRUM.map((color, i) => ({ color, d: sheenPath(i) })),
      closedEyes: EYES.map((e) => closedEyePath(e.cx, e.cy)).join(' '),
      arch: trackKeyframes('arch'),
      eyesClosed: trackKeyframes('eyesClosed'),
      float: trackKeyframes('float'),
      shimmerX: trackKeyframes('shimmerX'),
      shimmerOpacity: trackKeyframes('shimmerOpacity'),
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
        // One linear clock; every layer's calm curve is baked into its keyframes.
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

  const track = (kf: Keyframes, map?: (v: number) => number) =>
    clock.interpolate({ inputRange: kf.t, outputRange: map ? kf.v.map(map) : kf.v, extrapolate: 'clamp' });
  const archIn = track(art.arch);
  const eyesShut = track(art.eyesClosed);
  const eyesOpen = track(art.eyesClosed, (v) => 1 - v);
  // Icon units → points, upward.
  const lift = track(art.float, (v) => -(v * size) / 1024);
  const shimmerX = track(art.shimmerX);
  const shimmerOpacity = track(art.shimmerOpacity);
  const sparkle = track(art.sparkleIn);

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.host, { backgroundColor: bg, opacity: fade }]}
    >
      <View style={{ width: size, height: size }}>
        {/* The tile, its ground, the arch and the sparkles (still). Identical to assets/brand/splash-icon(-dark).png
            while the arch and sparkles are at 0. */}
        <Svg width={size} height={size} viewBox="0 0 1024 1024">
          <Defs>
            <LinearGradient id="introBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.iconBg[0]} />
              <Stop offset="1" stopColor={c.iconBg[1]} />
            </LinearGradient>
            <RadialGradient id="introGlow" cx="512" cy="520" r="440" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={c.glow} stopOpacity={0.6} />
              <Stop offset="1" stopColor={c.glow} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="introTileShadow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={c.shadow} stopOpacity={dark ? 0.6 : 0.28} />
              <Stop offset="1" stopColor={c.shadow} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="introShadow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.45} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0} />
            </RadialGradient>
            <ClipPath id="introClip">
              <Path d={art.tile} />
            </ClipPath>
          </Defs>
          <Ellipse cx={TILE.cx} cy={TILE.cy + TILE.b + 30} rx={TILE.a * 0.86} ry={34} fill="url(#introTileShadow)" />
          <G clipPath="url(#introClip)">
            <Rect width={1024} height={1024} fill="url(#introBg)" />
            <Rect width={1024} height={1024} fill="url(#introGlow)" />
            <AnimatedG opacity={archIn}>
              <G opacity={0.9}>
                {art.arches.map((a) => (
                  <Path key={a.color} d={a.d} fill="none" stroke={a.color} strokeWidth={23} />
                ))}
              </G>
              <Path d={CLOUDS_D} fill={CLOUD_FILL} />
            </AnimatedG>
            <Ellipse cx={SHADOW.cx} cy={SHADOW.cy} rx={SHADOW.rx} ry={SHADOW.ry} fill="url(#introShadow)" />
            <AnimatedG opacity={sparkle}>
              <Path d={SPARKLES_D} fill="#FFFFFF" />
            </AnimatedG>
          </G>
          <Path d={art.tile} fill="none" stroke={c.tileRim} strokeWidth={3} />
        </Svg>
        {/* Prism itself, on its own layer so the float is a plain translate. */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: lift }] }]}>
          <Svg width={size} height={size} viewBox="0 0 1024 1024">
            <Defs>
              <LinearGradient id="introGlass" x1="0" y1="0" x2="0.25" y2="1">
                <Stop offset="0" stopColor={GLASS.top} />
                <Stop offset="0.5" stopColor={GLASS.mid} />
                <Stop offset="1" stopColor={GLASS.bottom} />
              </LinearGradient>
              <LinearGradient id="introLimb" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={GLASS.limb[0]} />
                <Stop offset="1" stopColor={GLASS.limb[1]} />
              </LinearGradient>
              <LinearGradient id="introBand" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={1} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
              <ClipPath id="introBody">
                <Path d={BODY_D} />
              </ClipPath>
            </Defs>
            {ARMS.map((a) => (
              <Ellipse key={`arm${a.cx}`} cx={a.cx} cy={a.cy} rx={ARM.rx} ry={ARM.ry} transform={`rotate(${a.rot} ${a.cx} ${a.cy})`} fill="url(#introLimb)" />
            ))}
            {FEET.map((f) => (
              <Ellipse key={`foot${f.cx}`} cx={f.cx} cy={f.cy} rx={FOOT.rx} ry={FOOT.ry} fill="url(#introLimb)" />
            ))}
            <Path d={BODY_D} fill="url(#introGlass)" />
            <G clipPath="url(#introBody)">
              {art.facets.map((fc) => (
                <Path key={fc.id} d={fc.d} fill={fc.fill} fillOpacity={fc.opacity} />
              ))}
              {art.sheen.map((s) => (
                <Path key={s.color} d={s.d} fill={s.color} fillOpacity={SHEEN_OPACITY} />
              ))}
              <Path d={FACET_EDGES_D} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round" />
              <G transform={`rotate(${SHIMMER_ANGLE} 512 520)`}>
                <AnimatedRect x={shimmerX} y={-300} width={SHIMMER_BAND_W} height={1600} fill="url(#introBand)" opacity={shimmerOpacity} />
              </G>
            </G>
            <Path d={BODY_D} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={6} strokeLinejoin="round" />
            <Path d={GLOSS_STREAK_D} fill="none" stroke="#FFFFFF" strokeWidth={16} strokeLinecap="round" opacity={0.8} />
            {BLUSH.map((b) => (
              <Ellipse key={`blush${b.cx}`} cx={b.cx} cy={b.cy} rx={BLUSH_R.rx} ry={BLUSH_R.ry} fill={GLASS.blush} fillOpacity={0.6} />
            ))}
            {/* Asleep on the splash; the eyes open, and blink once, by cross-fading these two layers. */}
            <AnimatedPath d={art.closedEyes} fill="none" stroke={GLASS.ink} strokeWidth={12} strokeLinecap="round" opacity={eyesShut} />
            <AnimatedG opacity={eyesOpen}>
              {EYES.map((e) => (
                <G key={`eye${e.cx}`}>
                  <Ellipse cx={e.cx} cy={e.cy} rx={EYE.rx} ry={EYE.ry} fill={GLASS.ink} />
                  <Circle cx={e.cx + 13} cy={e.cy - 20} r={15} fill="#FFFFFF" />
                  <Circle cx={e.cx - 13} cy={e.cy + 21} r={7} fill="#FFFFFF" fillOpacity={0.8} />
                </G>
              ))}
            </AnimatedG>
            <Path d={MOUTH_D} fill="none" stroke={GLASS.ink} strokeWidth={10} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});
