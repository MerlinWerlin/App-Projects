import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { ConnectionState } from '../../core/types';
import { duration, easeOut, shimmerPeriod, spring } from '../../theme/motion';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { useActive } from '../motion/useActive';
import { haptic } from '../remote/haptics';
import { emitFx } from './bus';
import { initialTrack, pillVisual, step, type PillStatus, type PillTrack } from './connection';

/**
 * Tracks the active TV's connection status across renders (src/ui/fx/connection.ts) and fires the
 * one-shot effects on a transition into connected: success haptic + emitFx('connected').
 * Returns the status and a counter that bumps on every pop (StatusPill keys its pop on it).
 */
export function useConnectionStatus(
  tvId: string | null,
  state: ConnectionState | null,
  assumeConnected: boolean,
): { status: PillStatus; pops: number } {
  const track = useRef<PillTrack>(initialTrack);
  const [view, setView] = useState<{ status: PillStatus; pops: number }>(() => ({
    status: step(initialTrack, tvId, state, assumeConnected).next.status,
    pops: 0,
  }));
  useEffect(() => {
    const { next, fx } = step(track.current, tvId, state, assumeConnected);
    track.current = next;
    setView((v) => (v.status === next.status && !fx.pop ? v : { status: next.status, pops: v.pops + (fx.pop ? 1 : 0) }));
    if (fx.haptic) haptic('success');
    if (fx.emit) emitFx({ type: 'connected' });
  }, [tvId, state, assumeConnected]);
  return view;
}

/**
 * The header's status dot (prototype .tvbar LED) with motion:
 * searching = soft shimmer halo (opacity loop), connected = the dot pops once (spring),
 * reconnecting = amber pulse ring, error/off/offline = static. Loops pause when the screen is
 * inactive; Reduce Motion = colour only. Decorative: the header's status text carries the meaning.
 */
export function StatusPill({ status, pops }: { status: PillStatus; pops: number }) {
  const t = useRemoteTheme();
  const reduce = useReducedMotion();
  const active = useActive();
  const v = pillVisual(status);
  const color = v.color === 'ok' ? t.ok : v.color === 'warn' ? t.warn : v.color === 'accent' ? t.accent : t.muted;

  const loop = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  // Idle loop: shimmer or pulse, only while visible and motion is allowed.
  useEffect(() => {
    loop.stopAnimation();
    loop.setValue(0);
    if (reduce || !active || v.anim === 'none') return;
    const half = v.anim === 'shimmer' ? shimmerPeriod / 2 : duration.slow * 2;
    const ease = Easing.inOut(Easing.quad);
    const anim =
      v.anim === 'shimmer'
        ? Animated.loop(
            Animated.sequence([
              Animated.timing(loop, { toValue: 1, duration: half, easing: ease, useNativeDriver: true }),
              Animated.timing(loop, { toValue: 0, duration: half, easing: ease, useNativeDriver: true }),
            ]),
          )
        : Animated.loop(
            Animated.sequence([
              Animated.timing(loop, { toValue: 1, duration: half * 1.5, easing: Easing.bezier(...easeOut), useNativeDriver: true }),
              Animated.delay(duration.slow),
              Animated.timing(loop, { toValue: 0, duration: 0, useNativeDriver: true }),
            ]),
          );
    anim.start();
    return () => anim.stop();
  }, [v.anim, reduce, active, loop]);

  // One pop per transition into connected.
  useEffect(() => {
    if (pops === 0 || reduce) return;
    pop.setValue(1);
    const anim = Animated.sequence([
      Animated.timing(pop, { toValue: 1.5, duration: duration.fast, easing: Easing.bezier(...easeOut), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, ...spring, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [pops, reduce, pop]);

  const showHalo = !reduce && v.anim !== 'none';
  const haloOpacity =
    v.anim === 'shimmer'
      ? loop.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.5] })
      : loop.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const haloScale =
    v.anim === 'shimmer' ? loop.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1.8] }) : loop.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });

  return (
    <View style={styles.wrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
      {showHalo ? (
        <Animated.View style={[styles.halo, { backgroundColor: color, opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
      ) : null}
      <Animated.View style={[styles.dot, { backgroundColor: color, transform: [{ scale: pop }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
