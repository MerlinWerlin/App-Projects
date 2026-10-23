import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Defs, Ellipse, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import type { RemoteTexture as Texture } from '../../theme/remoteThemes';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { idleMode } from '../motion/idle';
import { useActive } from '../motion/useActive';
import { AURORA, BRUSHED, woodgrainLines } from './textureArt';

/**
 * Generated texture behind the remote card (owner-1017 T56): the theme's `texture` drawn with
 * react-native-svg gradients, stripes and sine-wave grain. No images or photos. Decoration only:
 * no touches, hidden from accessibility, at the theme's low opacity so every label keeps AA
 * (labels sit on their own key faces anyway).
 * Aurora drifts slowly (Animated opacity/transform, native driver) only while the screen is active;
 * paused when idle or blurred and still under Reduce Motion (src/ui/motion/idle.ts), like CinemaGlow.
 * Place it as the first child of the card; it fills the card and clips to `radius`.
 */
export function RemoteTexture({ texture, radius }: { texture: Texture; radius: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  if (texture.kind === 'none' || texture.opacity <= 0 || texture.colors.length === 0) return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        const h = Math.round(e.nativeEvent.layout.height);
        if (w > 0 && h > 0 && (w !== size?.w || h !== size?.h)) setSize({ w, h });
      }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', opacity: texture.opacity }]}
    >
      {size ? (
        texture.animated ? (
          <AuroraArt colors={texture.colors} w={size.w} h={size.h} />
        ) : (
          <StaticArt kind={texture.kind} colors={texture.colors} w={size.w} h={size.h} />
        )
      ) : null}
    </View>
  );
}

const c = (colors: readonly string[], i: number): string => colors[Math.min(i, colors.length - 1)] as string;

/** Every non-animated texture kind (re-rendered only when the theme or the card size changes). */
const StaticArt = memo(function StaticArt({ kind, colors, w, h }: { kind: Texture['kind']; colors: readonly string[]; w: number; h: number }) {
  const grain = useMemo(() => (kind === 'woodgrain' ? woodgrainLines(w, h, colors) : []), [kind, w, h, colors]);
  switch (kind) {
    case 'glass':
      // Deep glass: diagonal tint plus a soft highlight across the top.
      return (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="tx-glass" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={c(colors, 0)} stopOpacity={1} />
              <Stop offset="1" stopColor={c(colors, 1)} stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id="tx-sheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.18} />
              <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={w} height={h} fill="url(#tx-glass)" />
          <Rect width={w} height={h} fill="url(#tx-sheen)" />
        </Svg>
      );
    case 'velvet':
    case 'brass':
      // Velvet / brass: a warm pool of light in the middle falling off to the edges.
      return (
        <Svg width={w} height={h}>
          <Defs>
            <RadialGradient id="tx-pool" cx="50%" cy="40%" rx="70%" ry="60%" fx="50%" fy="40%">
              <Stop offset="0" stopColor={c(colors, 0)} stopOpacity={1} />
              <Stop offset="1" stopColor={c(colors, 1)} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect width={w} height={h} fill="url(#tx-pool)" />
          {kind === 'brass' ? <Rect y={0} width={w} height={2} fill="#E8C98A" opacity={0.6} /> : null}
        </Svg>
      );
    case 'brushed':
      // Brushed aluminium: fine horizontal stripes under a vertical sheen.
      return (
        <Svg width={w} height={h}>
          <Defs>
            <Pattern id="tx-brush" patternUnits="userSpaceOnUse" x="0" y="0" width={w} height={BRUSHED.period}>
              <Rect width={w} height={BRUSHED.period} fill={c(colors, 0)} />
              <Rect width={w} height={BRUSHED.line} fill={c(colors, 1)} />
            </Pattern>
            <LinearGradient id="tx-metal" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.35} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={w} height={h} fill="url(#tx-brush)" />
          <Rect width={w} height={h} fill="url(#tx-metal)" />
        </Svg>
      );
    case 'woodgrain':
      return (
        <Svg width={w} height={h}>
          <Rect width={w} height={h} fill={c(colors, 0)} />
          {grain.map((g, i) => (
            <Path key={i} d={g.d} stroke={g.color} strokeWidth={g.width} strokeOpacity={g.opacity} fill="none" />
          ))}
        </Svg>
      );
    case 'neon':
      // Edge light: a soft wide stroke and a crisp inner one, pink to cyan.
      return (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="tx-edge" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={c(colors, 0)} stopOpacity={1} />
              <Stop offset="1" stopColor={c(colors, 1)} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={4} y={4} width={w - 8} height={h - 8} rx={24} fill="none" stroke="url(#tx-edge)" strokeWidth={8} strokeOpacity={0.35} />
          <Rect x={2} y={2} width={w - 4} height={h - 4} rx={26} fill="none" stroke="url(#tx-edge)" strokeWidth={2} />
        </Svg>
      );
    case 'paper':
    case 'candy':
    default:
      // Paper / candy: a soft diagonal blend through the theme's stops.
      return (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="tx-soft" x1="0" y1="0" x2="1" y2="1">
              {colors.map((col, i) => (
                <Stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={col} stopOpacity={1} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width={w} height={h} fill="url(#tx-soft)" />
        </Svg>
      );
  }
});

/**
 * Aurora: a still base band plus two soft colour curtains that drift and breathe.
 * idleMode: 'loop' runs, 'paused' stops (screen blurred / app backgrounded), 'still' (Reduce Motion)
 * shows a fixed frame.
 */
function AuroraArt({ colors, w, h }: { colors: readonly string[]; w: number; h: number }) {
  const reduce = useReducedMotion();
  const active = useActive();
  const drift = useRef(new Animated.Value(0)).current;
  const mode = idleMode({ reduce, active });

  useEffect(() => {
    if (mode === 'still') {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
    if (mode === 'paused') {
      drift.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.timing(drift, { toValue: 1, duration: AURORA.period, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [mode, drift]);

  const still = mode === 'still';
  const tx = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-AURORA.px, AURORA.px, -AURORA.px] });
  const tx2 = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [AURORA.px, -AURORA.px, AURORA.px] });
  const op = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [AURORA.min, AURORA.max, AURORA.min] });
  const op2 = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [AURORA.max, AURORA.min, AURORA.max] });

  return (
    <>
      <AuroraLayer id="a0" color={c(colors, 2)} w={w} h={h} cy={0.85} />
      <Animated.View
        style={[StyleSheet.absoluteFill, still ? { opacity: AURORA.still } : { opacity: op, transform: [{ translateX: tx }] }]}
      >
        <AuroraLayer id="a1" color={c(colors, 0)} w={w} h={h} cy={0.2} />
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, still ? { opacity: AURORA.still } : { opacity: op2, transform: [{ translateX: tx2 }] }]}
      >
        <AuroraLayer id="a2" color={c(colors, 1)} w={w} h={h} cy={0.5} />
      </Animated.View>
    </>
  );
}

const AuroraLayer = memo(function AuroraLayer({ id, color, w, h, cy }: { id: string; color: string; w: number; h: number; cy: number }) {
  return (
    <Svg width={w} height={h}>
      <Defs>
        <RadialGradient id={`tx-${id}`} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
          <Stop offset="0" stopColor={color} stopOpacity={AURORA.peak} />
          <Stop offset="0.6" stopColor={color} stopOpacity={AURORA.peak / 3} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={w / 2} cy={h * cy} rx={w * 0.75} ry={h * 0.28} fill={`url(#tx-${id})`} />
    </Svg>
  );
});
