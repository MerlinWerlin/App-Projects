import { useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { duration } from '../../theme/motion';
import { elevation, fonts } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { KEY_LABEL, type Key } from '../../core/keys';
import { useT } from '../../i18n/react';
import { NEVER_MIRROR_STYLE } from '../NeverMirror';
import { classifySwipe, TOUCHPAD_HINT_KEY, TOUCHPAD_LABEL_KEY } from './controls';
import { useScrollLock } from '../Screen';
import { tap } from './haptics';
import type { KeyPress } from './RemoteKey';

/**
 * Touchpad (prototype .touch): each 36pt of travel sends one direction and
 * re-anchors, so a long swipe repeats; a short quick tap sends OK.
 * Screen-reader users get the same actions as accessibilityActions.
 * A fading light trail follows the finger: a ring buffer of TRAIL_DOTS soft dots moved with
 * setValue (no React re-render per move), a new dot only after TRAIL_MIN_MOVE px of travel,
 * each fading out over ~320 ms on the native driver. Reduce Motion: one static dot under the finger.
 * Never mirrored (owner-1016 R3): a swipe right is the TV's RIGHT in every language. The root
 * carries NEVER_MIRROR_STYLE and the swipe math uses the physical dx (never negated for RTL).
 */
const TRAIL_DOTS = 7;
const TRAIL_MIN_MOVE = 6;
const DOT = 28;
const DOT_OPACITY = 0.45;

interface Dot {
  x: Animated.Value;
  y: Animated.Value;
  o: Animated.Value;
  s: Animated.Value;
}

function makeDots(): Dot[] {
  return Array.from({ length: TRAIL_DOTS }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    o: new Animated.Value(0),
    s: new Animated.Value(1),
  }));
}

export function Touchpad({ onKey }: { onKey: KeyPress }) {
  const t = useRemoteTheme();
  const tl = useT();
  const g = useRef({ ox: 0, oy: 0, t0: 0, moved: false });
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  const setScrollLock = useScrollLock();
  const lockRef = useRef(setScrollLock);
  lockRef.current = setScrollLock;
  const reduce = useReducedMotion();
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const dots = useRef<Dot[] | null>(null);
  if (!dots.current) dots.current = makeDots();
  // Trail cursor: start point (pad coordinates), last dot position, next ring slot.
  const trail = useRef({ sx: 0, sy: 0, lx: 0, ly: 0, next: 0 });

  /** Drop a dot at (x, y) in pad coordinates; it fades and shrinks on the UI thread. */
  const drop = (x: number, y: number) => {
    const list = dots.current;
    if (!list) return;
    const tr = trail.current;
    tr.lx = x;
    tr.ly = y;
    if (reduceRef.current) {
      // Reduce Motion: a single static dot that follows the finger.
      const d = list[0];
      if (!d) return;
      d.x.setValue(x - DOT / 2);
      d.y.setValue(y - DOT / 2);
      d.s.setValue(1);
      d.o.setValue(DOT_OPACITY * 0.7);
      return;
    }
    const d = list[tr.next % list.length];
    tr.next = (tr.next + 1) % list.length;
    if (!d) return;
    d.o.stopAnimation();
    d.s.stopAnimation();
    d.x.setValue(x - DOT / 2);
    d.y.setValue(y - DOT / 2);
    d.o.setValue(DOT_OPACITY);
    d.s.setValue(1);
    Animated.parallel([
      Animated.timing(d.o, { toValue: 0, duration: duration.slow, useNativeDriver: true }),
      Animated.timing(d.s, { toValue: 0.6, duration: duration.slow, useNativeDriver: true }),
    ]).start();
  };
  const dropRef = useRef(drop);
  dropRef.current = drop;

  /** Finger lifted: hide the static Reduce Motion dot (trail dots fade on their own). */
  const endTrail = () => {
    if (reduceRef.current) {
      const d = dots.current?.[0];
      d?.o.setValue(0);
    }
  };
  const endRef = useRef(endTrail);
  endRef.current = endTrail;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          g.current = { ox: 0, oy: 0, t0: Date.now(), moved: false };
          lockRef.current(true);
          const { locationX, locationY } = e.nativeEvent;
          trail.current.sx = locationX;
          trail.current.sy = locationY;
          dropRef.current(locationX, locationY);
        },
        onPanResponderTerminate: () => {
          lockRef.current(false);
          endRef.current();
        },
        onPanResponderMove: (_e, s) => {
          const tr = trail.current;
          const x = tr.sx + s.dx;
          const y = tr.sy + s.dy;
          if (Math.hypot(x - tr.lx, y - tr.ly) > TRAIL_MIN_MOVE) dropRef.current(x, y);
          const dir = classifySwipe(s.dx - g.current.ox, s.dy - g.current.oy, { phase: 'move' });
          if (dir && dir !== 'OK') {
            g.current.ox = s.dx;
            g.current.oy = s.dy;
            g.current.moved = true;
            tap();
            onKeyRef.current(dir, KEY_LABEL[dir]);
          }
        },
        onPanResponderRelease: (_e, s) => {
          lockRef.current(false);
          endRef.current();
          if (g.current.moved) return;
          const r = classifySwipe(s.dx, s.dy, { phase: 'end', elapsedMs: Date.now() - g.current.t0 });
          if (r) {
            tap();
            onKeyRef.current(r, KEY_LABEL[r]);
          }
        },
      }),
    [],
  );

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={tl(TOUCHPAD_LABEL_KEY)}
      accessibilityActions={[
        { name: 'activate', label: KEY_LABEL.OK },
        { name: 'increment', label: KEY_LABEL.UP },
        { name: 'decrement', label: KEY_LABEL.DOWN },
      ]}
      onAccessibilityAction={(e) => {
        const n = e.nativeEvent.actionName;
        const key: Key | null = n === 'activate' ? 'OK' : n === 'increment' ? 'UP' : n === 'decrement' ? 'DOWN' : null;
        if (key) onKey(key, KEY_LABEL[key]);
      }}
      style={[NEVER_MIRROR_STYLE, styles.touch, { backgroundColor: t.key, shadowColor: t.keyEdge }]}
    >
      <View pointerEvents="none" style={styles.trail}>
        {(dots.current ?? []).map((d, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.dot,
              {
                backgroundColor: t.accent,
                opacity: d.o,
                transform: [{ translateX: d.x }, { translateY: d.y }, { scale: d.s }],
              },
            ]}
          />
        ))}
      </View>
      <View pointerEvents="none">
        <Text scaleRole="caption" style={[styles.hint, { color: t.muted }]}>{tl(TOUCHPAD_HINT_KEY)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touch: {
    width: '100%',
    aspectRatio: 1.25,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.key,
  },
  // Clips the trail to the pad's rounded corners without clipping the pad's own shadow.
  trail: { ...StyleSheet.absoluteFillObject, borderRadius: 22, overflow: 'hidden' },
  dot: { position: 'absolute', left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2 },
  // Larger Text (T74): capped at the caption scale and wrapped inside the pad (aspect-ratio box).
  hint: { fontFamily: fonts.text, fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
});
