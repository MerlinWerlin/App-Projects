import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Defs, Ellipse, RadialGradient, Stop, Svg } from 'react-native-svg';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useActive } from '../motion/useActive';
import { idleMode } from '../motion/idle';
import { onFx } from './bus';
import {
  BREATH,
  DRIFT,
  GLOW_LOBES,
  PULSE,
  PULSE_LOBE,
  STATIC_OPACITY,
  SWELL,
  SWELL_COLOR,
  SWELL_LOBE,
  falloffStops,
  pulseCenter,
} from './glow';

/**
 * Cinema glow (premium polish P1): soft bias lighting behind the remote, like LED strips behind a TV.
 * Three large radial gradients (many-stop falloff to 0) breathe slowly and drift a few px; key presses
 * send a quick pulse from the key's side (fx 'press'), the power key one slow warm swell (fx 'power').
 * Reduce Motion: a still glow, presses only nudge opacity. Idle loops pause when the screen is not
 * active. Decoration only: no touches, hidden from accessibility. SVG is animated by wrapping it in
 * Animated.Views (opacity/transform, native driver).
 */
export function CinemaGlow({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const active = useActive();
  const breath = useRef(new Animated.Value(reduce ? STATIC_OPACITY : BREATH.min)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const swell = useRef(new Animated.Value(0)).current;
  const [dir, setDir] = useState({ x: 0, y: 0 });

  // Idle breathing + drift, only while the screen is focused and the app is foreground.
  const mode = idleMode({ reduce, active });
  useEffect(() => {
    if (mode === 'still') {
      breath.stopAnimation();
      drift.stopAnimation();
      breath.setValue(STATIC_OPACITY);
      drift.setValue(0);
      return;
    }
    if (mode === 'paused') return;
    const half = BREATH.period / 2;
    const ease = Easing.inOut(Easing.sin);
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: BREATH.max, duration: half, easing: ease, useNativeDriver: true }),
        Animated.timing(breath, { toValue: BREATH.min, duration: half, easing: ease, useNativeDriver: true }),
      ]),
    );
    drift.setValue(0);
    const drifting = Animated.loop(
      Animated.timing(drift, { toValue: 1, duration: DRIFT.period, easing: Easing.linear, useNativeDriver: true }),
    );
    breathing.start();
    drifting.start();
    return () => {
      breathing.stop();
      drifting.stop();
    };
  }, [mode, breath, drift]);

  // One-shot pulses from the fx bus.
  useEffect(() => {
    return onFx((e) => {
      if (e.type === 'press') {
        setDir(e.dir);
        pulse.stopAnimation();
        pulse.setValue(0);
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: reduce ? PULSE.reduceOpacity : 1,
            duration: PULSE.in,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, { toValue: 0, duration: PULSE.out, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start();
      } else if (e.type === 'power') {
        swell.stopAnimation();
        swell.setValue(0);
        Animated.sequence([
          Animated.timing(swell, {
            toValue: reduce ? SWELL.reduceOpacity : 1,
            duration: SWELL.in,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(swell, { toValue: 0, duration: SWELL.out, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]).start();
      }
    });
  }, [reduce, pulse, swell]);

  const tx = drift.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, DRIFT.px, 0, -DRIFT.px, 0] });
  const ty = drift.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-DRIFT.px / 2, 0, DRIFT.px / 2, 0, -DRIFT.px / 2],
  });
  const swellScale = swell.interpolate({
    inputRange: [0, 1],
    outputRange: reduce ? [1, 1] : [SWELL.scaleFrom, SWELL.scaleTo],
    extrapolate: 'clamp',
  });
  const c = pulseCenter(dir);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: breath, transform: [{ translateX: tx }, { translateY: ty }] }]}>
        <BaseGlow color={color} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulse }]}>
        <Lobe id="pulse" color={color} cx={c.cx} cy={c.cy} rx={PULSE_LOBE.rx} ry={PULSE_LOBE.ry} peak={PULSE_LOBE.peak} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: swell, transform: [{ scale: swellScale }] }]}>
        <Lobe
          id="swell"
          color={SWELL_COLOR}
          cx={SWELL_LOBE.cx}
          cy={SWELL_LOBE.cy}
          rx={SWELL_LOBE.rx}
          ry={SWELL_LOBE.ry}
          peak={SWELL_LOBE.peak}
        />
      </Animated.View>
    </View>
  );
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** The three base lobes in one Svg (re-rendered only when the colour changes). */
const BaseGlow = memo(function BaseGlow({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        {GLOW_LOBES.map((l) => (
          <RadialGradient key={l.id} id={`glow-${l.id}`} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
            {falloffStops(l.peak).map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={color} stopOpacity={s.opacity} />
            ))}
          </RadialGradient>
        ))}
      </Defs>
      {GLOW_LOBES.map((l) => (
        <Ellipse key={l.id} cx={pct(l.cx)} cy={pct(l.cy)} rx={pct(l.rx)} ry={pct(l.ry)} fill={`url(#glow-${l.id})`} />
      ))}
    </Svg>
  );
});

/** One soft ellipse of light (positions are fractions of the glow box). */
const Lobe = memo(function Lobe({
  id,
  color,
  cx,
  cy,
  rx,
  ry,
  peak,
}: {
  id: string;
  color: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  peak: number;
}) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={`glow-${id}`} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
          {falloffStops(peak).map((s) => (
            <Stop key={s.offset} offset={s.offset} stopColor={color} stopOpacity={s.opacity} />
          ))}
        </RadialGradient>
      </Defs>
      <Ellipse cx={pct(cx)} cy={pct(cy)} rx={pct(rx)} ry={pct(ry)} fill={`url(#glow-${id})`} />
    </Svg>
  );
});
