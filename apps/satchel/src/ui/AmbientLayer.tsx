// Destination themes: a few small particles (petals, leaves, lanterns, stars...) drifting slowly inside a hero banner.
// Whimsical, never interactive: pointerEvents none, hidden from screen readers, clipped to the banner, and kept to the
// right-hand side so the title stays clear. Native-driver transforms and opacity only, in staggered loops that run
// while the screen is focused. Reduce Motion: a handful of particles drawn still, nothing moves.
import { useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import { PARTICLES, type ParticleKind } from '../core/countrytheme.ts';
import { useApp } from '../state/app.tsx';
import { ParticleGlyph } from './countryArt.tsx';

/** A repeatable 0..1 number for particle i, so the layout is the same on every render. */
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** How many particles run, and how many stay drawn (still) with Reduce Motion. */
export const AMBIENT_COUNT = { full: 12, compact: 8, still: 5 } as const;

type Spec = { i: number; x: number; y: number; size: number; ms: number; delay: number; sway: number; spin: number; opacity: number; still: number };

function Particle({ spec, kind, h, running, reduceMotion, accent }: { spec: Spec; kind: ParticleKind; h: number; running: boolean; reduceMotion: boolean; accent: string }) {
  const def = PARTICLES[kind];
  const progress = useRef(new Animated.Value(reduceMotion ? spec.still : 0)).current;

  useEffect(() => {
    if (reduceMotion || !running) {
      progress.setValue(spec.still);
      return;
    }
    progress.setValue(0);
    const loop = Animated.sequence([
      Animated.delay(spec.delay),
      Animated.loop(Animated.timing(progress, { toValue: 1, duration: spec.ms, easing: Easing.linear, useNativeDriver: true })),
    ]);
    loop.start();
    return () => loop.stop();
  }, [progress, running, reduceMotion, spec]);

  const style = useMemo(() => {
    const s = spec.size;
    if (def.motion === 'twinkle') {
      return {
        opacity: reduceMotion ? spec.opacity : progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, spec.opacity, 0.12] }),
        transform: [
          { translateX: spec.x },
          { translateY: spec.y * (h - s) },
          { scale: reduceMotion ? 1 : progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.75, 1.1, 0.75] }) },
        ],
      };
    }
    const rise = def.motion === 'rise';
    const travel = rise ? [h + s, -s * 1.5] : [-s * 1.5, h + s];
    const sway = rise ? spec.sway * 0.5 : spec.sway;
    const spin = rise ? [`${-spec.spin / 30}deg`, `${spec.spin / 30}deg`, `${-spec.spin / 30}deg`] : ['0deg', `${spec.spin / 2}deg`, `${spec.spin}deg`];
    return {
      opacity: reduceMotion ? spec.opacity : progress.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, spec.opacity, spec.opacity, 0] }),
      transform: [
        { translateX: progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [spec.x, spec.x + sway, spec.x, spec.x - sway, spec.x] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: travel }) },
        { rotate: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: spin }) },
      ],
    };
  }, [def.motion, h, progress, reduceMotion, spec]);

  const shape = def.shapes[spec.i % def.shapes.length];
  const paint = def.paints[spec.i % def.paints.length];
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: spec.size, height: spec.size }, style]}>
      <ParticleGlyph shape={shape} paint={paint} size={spec.size} accent={accent} />
    </Animated.View>
  );
}

/** The ambient particles for a hero banner. Fills its parent (absolute); put it inside a View with overflow hidden. */
export const AmbientLayer = memo(function AmbientLayer({ kind, compact = false }: { kind: ParticleKind; compact?: boolean }) {
  const { reduceMotion, theme } = useApp();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((old) => (old && Math.abs(old.w - width) < 1 && Math.abs(old.h - height) < 1 ? old : { w: width, h: height }));
  }, []);

  const motion = PARTICLES[kind].motion;
  const specs = useMemo<Spec[]>(() => {
    if (!box) return [];
    const n = reduceMotion ? AMBIENT_COUNT.still : compact ? AMBIENT_COUNT.compact : AMBIENT_COUNT.full;
    const twinkle = motion === 'twinkle';
    return Array.from({ length: n }, (_, i) => {
      const size = Math.round((twinkle ? 8 : 11) + rand(i, 1) * (twinkle ? 8 : 8));
      // Keep to the right 65% of the banner, where the art is, away from the start of the title.
      const x = box.w * (0.35 + 0.65 * ((i + rand(i, 2)) / n)) - size / 2;
      const ms = twinkle ? 2400 + rand(i, 3) * 2200 : (motion === 'rise' ? 11000 : 9000) + rand(i, 3) * 7000;
      return {
        i,
        x,
        y: rand(i, 4),
        size,
        ms,
        delay: Math.round((i / n) * ms * 0.9),
        sway: 8 + rand(i, 5) * 14,
        spin: (rand(i, 6) > 0.5 ? 1 : -1) * (120 + rand(i, 7) * 200),
        opacity: 0.55 + rand(i, 8) * 0.3,
        still: 0.15 + 0.7 * ((i + 0.5) / n),
      };
    });
  }, [box, compact, motion, reduceMotion]);

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {box
        ? specs.map((s) => <Particle key={`${kind}${s.i}`} spec={s} kind={kind} h={box.h} running={focused} reduceMotion={reduceMotion} accent={theme.heroAccent} />)
        : null}
    </View>
  );
});
