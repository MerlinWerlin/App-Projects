// Opening animation (night-intro, owner 23 Oct 2026): the native splash shows the Couch remote still; on this view's
// first frame the splash hands over, then the four arrows press in turn (each with a glint on the gold at that side),
// OK presses with a soft light ripple across the ring, a bottom button gives a small press, a sheen sweeps over the gold
// and the whole thing fades to the app. Calm ease-in/out timing, no springs. Never takes touches; hidden from VoiceOver.
// Reduce Motion: the still remote shows and simply fades when the app is ready.
// Shapes and timings come from src/core/introRemote.ts (the same data renders the splash image, so they match).
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  INTRO_BG,
  INTRO_MS,
  INTRO_SIZE,
  RING,
  SHEEN,
  VIEW,
  interpolation,
  introCanFade,
  introTracks,
  remoteLayers,
  restValue,
  sheenTravel,
  type Gradient,
  type Layer,
  type Prop,
  type Shape,
} from '../core/introRemote';
import { NEVER_MIRROR_STYLE } from './NeverMirror';
import { haptic } from './remote/haptics';

type AnyComponent = ComponentType<Record<string, unknown>>;
/** Works with both the generic real RN types and the offline stubs. */
type Interp = ReturnType<Animated.Value['interpolate']>;
const SHAPES: Record<Shape['kind'], AnyComponent> = {
  circle: Circle as unknown as AnyComponent,
  path: Path as unknown as AnyComponent,
  rect: Rect as unknown as AnyComponent,
  ellipse: Ellipse as unknown as AnyComponent,
};

function Grad({ g }: { g: Gradient }) {
  const stops = g.stops.map(([offset, color, opacity], i) => (
    <Stop key={i} offset={offset} stopColor={color} stopOpacity={opacity ?? 1} />
  ));
  return g.type === 'linear' ? (
    <LinearGradient id={g.id} gradientUnits="userSpaceOnUse" {...g.attrs}>
      {stops}
    </LinearGradient>
  ) : (
    <RadialGradient id={g.id} gradientUnits="userSpaceOnUse" {...g.attrs}>
      {stops}
    </RadialGradient>
  );
}

/** A layer's art in its own Svg (global viewBox coordinates cropped to the layer's box). */
function LayerArt({ layer, shapes, k }: { layer: Layer; shapes: Shape[]; k: number }) {
  const [x, y, w, h] = layer.box;
  return (
    <Svg width={w * k} height={h * k} viewBox={`${x} ${y} ${w} ${h}`}>
      {shapes === layer.shapes && layer.gradients.length > 0 ? (
        <Defs>
          {layer.gradients.map((g) => (
            <Grad key={g.id} g={g} />
          ))}
        </Defs>
      ) : null}
      {shapes.map((s, i) => {
        const C = SHAPES[s.kind];
        return <C key={i} {...s.attrs} />;
      })}
    </Svg>
  );
}

export function IntroRemote({
  ready,
  haptics,
  onReveal,
  onDone,
}: {
  /** Fonts are in (or the startup cap passed). */
  ready: boolean;
  /** The Haptics setting (loaded): one light tick on the OK press. */
  haptics: boolean;
  /** Fade-out starts: mount the app underneath now (Linework fb-1023: native screens covered a JS overlay). */
  onReveal?: () => void;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  // Same size and place as the native splash image (app.json imageWidth, centred), so the hand-over is seamless.
  const size = Math.min(INTRO_SIZE, width - 32, height - 32);
  const k = size / VIEW;

  const clock = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const started = useRef(Date.now());
  const seqDone = useRef(false);
  const finishing = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;

  const finish = useRef(() => {});
  finish.current = () => {
    if (finishing.current) return;
    if (!introCanFade(seqDone.current, readyRef.current, Date.now() - started.current)) return;
    finishing.current = true;
    onReveal?.();
    Animated.timing(fade, { toValue: 0, duration: INTRO_MS.fadeOut, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() =>
      onDone(),
    );
  };

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let run: Animated.CompositeAnimation | null = null;
    // The native splash hands over to this view on its first frame.
    requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    // Hard cap: never keep a slow device behind the intro.
    timers.push(setTimeout(() => finish.current(), INTRO_MS.maxWait));
    const play = (reduce: boolean) => {
      if (!alive) return;
      if (reduce) {
        seqDone.current = true;
        finish.current();
        return;
      }
      timers.push(
        setTimeout(() => {
          if (hapticsRef.current) haptic('light');
        }, INTRO_MS.haptic),
      );
      run = Animated.timing(clock, { toValue: INTRO_MS.seq, duration: INTRO_MS.seq, easing: Easing.linear, useNativeDriver: true });
      run.start(() => {
        if (!alive) return;
        seqDone.current = true;
        finish.current();
      });
    };
    try {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((v) => play(Boolean(v)))
        .catch(() => play(false));
    } catch {
      play(false);
    }
    return () => {
      alive = false;
      for (const t of timers) clearTimeout(t);
      run?.stop();
    };
  }, [clock]);

  useEffect(() => {
    if (ready) finish.current();
  }, [ready]);

  const layers = useMemo(() => remoteLayers(), []);
  const values = useMemo(() => {
    const out = new Map<string, Interp>();
    for (const tr of introTracks()) {
      out.set(`${tr.layer}.${tr.prop}`, clock.interpolate({ ...interpolation(tr), extrapolate: 'clamp' }));
    }
    return out;
  }, [clock]);
  const val = (id: string, prop: Prop) => values.get(`${id}.${prop}`) ?? restValue(prop);

  const art = useMemo(
    () =>
      layers.map((layer) => {
        const [x, y, w, h] = layer.box;
        const box = { position: 'absolute' as const, left: x * k, top: y * k, width: w * k, height: h * k };
        if (layer.id === 'sheen') {
          const { cx, cy, r } = RING;
          return (
            <Animated.View
              key={layer.id}
              style={{
                position: 'absolute',
                left: (cx - r) * k,
                top: (cy - r) * k,
                width: 2 * r * k,
                height: 2 * r * k,
                borderRadius: r * k,
                overflow: 'hidden',
                opacity: val('sheen', 'opacity'),
              }}
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  left: (x - (cx - r)) * k,
                  top: (y - (cy - r)) * k,
                  width: w * k,
                  height: h * k,
                  transform: [
                    { translateX: Animated.multiply(val('sheen', 'shift') as Interp, sheenTravel() * k) },
                    { rotate: `${SHEEN.angle}deg` },
                  ],
                }}
              >
                <LayerArt layer={layer} shapes={layer.shapes} k={k} />
              </Animated.View>
            </Animated.View>
          );
        }
        const opacity = layer.id === 'base' || layer.shade ? 1 : val(layer.id, 'opacity');
        return (
          <Animated.View key={layer.id} style={[box, { opacity, transform: [{ scale: val(layer.id, 'scale') }] }]}>
            <LayerArt layer={layer} shapes={layer.shapes} k={k} />
            {layer.shade ? (
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: val(layer.id, 'shade') }]}>
                <LayerArt layer={layer} shapes={layer.shade} k={k} />
              </Animated.View>
            ) : null}
          </Animated.View>
        );
      }),
    // values/val are stable for the clock; k changes only with the window size
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layers, values, k],
  );

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.host, { opacity: fade }]}
    >
      <StatusBar style="light" />
      {/* Physical art: the d-pad never mirrors in right-to-left languages. */}
      <View style={[{ width: size, height: size }, NEVER_MIRROR_STYLE]}>{art}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center', backgroundColor: INTRO_BG, zIndex: 100 },
});
