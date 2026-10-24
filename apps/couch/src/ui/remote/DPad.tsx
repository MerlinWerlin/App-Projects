import { useId, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Circle, Defs, LinearGradient, Stop, Svg } from 'react-native-svg';
import { dpadAvailableWidth, dpadGeometry, type DpadGeometry, type DpadRect } from '../../core/dpadGeometry';
import { Text } from '../Text';
import { duration, spring } from '../../theme/motion';
import type { RemoteTheme } from '../../theme/remoteThemes';
import { elevation, fonts, space } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { useT } from '../../i18n/react';
import { RemoteIcon } from '../icons/RemoteIcon';
import { NEVER_MIRROR_STYLE } from '../NeverMirror';
import { DPAD, DPAD_LABEL_KEY, type KeyControl } from './controls';
import { haptic } from './haptics';
import { keyPressScale, themedHaptic } from './press';
import type { KeyPress } from './RemoteKey';
import { useHoldPress, type HoldPressProps } from './repeatHold';

/** The whole pad dips to this while an arrow is held. */
const PAD_PRESS_SCALE = 0.985;
/** Peak opacity of the lit arc. */
const RING_OPACITY = 0.6;
/**
 * Raised bevel on the OK key (fb-1017b H1). The face is the theme's accent; a neutral specular
 * light (same in every theme, like real light) brightens the top band and the theme's keyEdge
 * shades the bottom band. Both bands stop short of the label (geometry `bevel` stops), so the label
 * always sits on plain accent and keeps its AA contrast. The drop shadow uses keyEdge.
 */
const BEVEL_LIGHT = '#FFFFFF';
const BEVEL_LIGHT_OPACITY = 0.3;
const BEVEL_SHADE_OPACITY = 0.35;

type Side = 'up' | 'down' | 'left' | 'right';

/**
 * Circular direction pad with a centre OK (prototype .pad). The OK key is ~52% of the ring
 * (fb-1017b H1), raised with a bevel and soft shadow; each arrow band is >= 44 pt deep. Arrow glyphs
 * are Couch's own vector icons (RemoteIcon), sized from the geometry.
 * Press feedback: the pressed side lights an accent arc on the inner ring (opacity fade), the pad
 * dips to 0.985 with the motion spring, light haptic; OK press-scales with a medium haptic.
 * Reduce Motion: the arc still fades, nothing scales.
 * Geometry (fb-1017-ok): every size and position comes from dpadGeometry(measured width), one
 * diameter shared by ring, arcs, OK key and arrow hit areas, so the OK key is a true circle exactly
 * centred with an equal gap all round, never clipped, on SE to Pro Max and with large Dynamic Type.
 * Themes only change colours. The OK label uses lineHeight = fontSize (Text `tight`).
 * Never mirrored (owner-1016 R3): left/right are the TV's physical directions, also in Arabic,
 * so the pad's root carries NEVER_MIRROR_STYLE (direction: 'ltr').
 */
export function DPad({ onKey }: { onKey: KeyPress }) {
  const t = useRemoteTheme();
  const tr = useT();
  const reduce = useReducedMotion();
  const win = useWindowDimensions();
  // Estimate from the window before the first layout, then use the measured width.
  const [measured, setMeasured] = useState<number | null>(null);
  const g = dpadGeometry(measured ?? dpadAvailableWidth(win.width, space.gutter), win.fontScale);
  const rect = (r: DpadRect): ViewStyle => ({ left: r.x, top: r.y, width: r.w, height: r.h });
  const padScale = useRef(new Animated.Value(1)).current;
  const okScale = useRef(new Animated.Value(1)).current;
  const glow = useRef({
    up: new Animated.Value(0),
    down: new Animated.Value(0),
    left: new Animated.Value(0),
    right: new Animated.Value(0),
  }).current;

  const springTo = (v: Animated.Value, to: number) =>
    Animated.spring(v, { toValue: to, ...spring, useNativeDriver: true }).start();
  const fade = (v: Animated.Value, to: number, ms: number) =>
    Animated.timing(v, { toValue: to, duration: ms, useNativeDriver: true }).start();

  // Arrows repeat while held (T72: hold-to-repeat with a selection tick per step); OK never repeats.
  const tapArrow = themedHaptic('light', t.press);
  const hold: Record<Side, HoldPressProps> = {
    up: useHoldPress(DPAD.up.key, DPAD.up.label, onKey, tapArrow),
    down: useHoldPress(DPAD.down.key, DPAD.down.label, onKey, tapArrow),
    left: useHoldPress(DPAD.left.key, DPAD.left.label, onKey, tapArrow),
    right: useHoldPress(DPAD.right.key, DPAD.right.label, onKey, tapArrow),
  };

  const arrow = (side: Side, c: KeyControl) => (
    <Pressable
      key={c.key}
      accessibilityRole="button"
      accessibilityLabel={c.label}
      onPressIn={() => {
        fade(glow[side], RING_OPACITY, duration.fast);
        if (!reduce) springTo(padScale, PAD_PRESS_SCALE);
        hold[side].onPressIn();
      }}
      onPressOut={() => {
        fade(glow[side], 0, duration.slow);
        if (!reduce) springTo(padScale, 1);
        hold[side].onPressOut();
      }}
      onPress={hold[side].onPress}
      style={[styles.btn, rect(g.arrows[side])]}
    >
      {({ pressed }) => (
        <RemoteIcon name={side} size={g.arrowIcon.size} color={pressed ? t.ringLit : (t.ringInk ?? t.muted)} />
      )}
    </Pressable>
  );

  // One arc per side: a ring with only that side's border coloured.
  const ring = (side: Side) => {
    const sideColor =
      side === 'up'
        ? { borderTopColor: t.ringLit }
        : side === 'down'
          ? { borderBottomColor: t.ringLit }
          : side === 'left'
            ? { borderLeftColor: t.ringLit }
            : { borderRightColor: t.ringLit };
    return (
      <Animated.View
        key={side}
        pointerEvents="none"
        style={[
          styles.ring,
          { top: g.ringInset, left: g.ringInset, right: g.ringInset, bottom: g.ringInset, borderWidth: g.ringStroke },
          sideColor,
          { opacity: glow[side] },
        ]}
      />
    );
  };

  const k = g.key;
  return (
    <View
      style={[NEVER_MIRROR_STYLE, styles.wrap]}
      onLayout={(e) => {
        const w = Math.floor(e.nativeEvent.layout.width);
        if (w > 0 && w !== measured) setMeasured(w);
      }}
    >
    <Animated.View
      accessibilityLabel={tr(DPAD_LABEL_KEY)}
      style={[
        NEVER_MIRROR_STYLE,
        styles.pad,
        {
          width: g.diameter,
          height: g.diameter,
          borderRadius: g.diameter / 2,
          // Theme: pad face = ring, lit arcs = ringLit, OK = accent / accentSoft / accentInk.
          backgroundColor: t.ring,
          shadowColor: t.keyEdge,
          transform: [{ scale: padScale }],
        },
      ]}
    >
      {ring('up')}
      {ring('down')}
      {ring('left')}
      {ring('right')}
      {arrow('up', DPAD.up)}
      {arrow('left', DPAD.left)}
      {arrow('right', DPAD.right)}
      {arrow('down', DPAD.down)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={DPAD.ok.label}
        onPressIn={() => {
          if (!reduce) springTo(okScale, keyPressScale(t.press));
        }}
        onPressOut={() => {
          if (!reduce) springTo(okScale, 1);
        }}
        onPress={() => {
          haptic(themedHaptic('medium', t.press));
          onKey(DPAD.ok.key, DPAD.ok.label);
        }}
        style={[styles.btn, { left: k.offset, top: k.offset, width: k.size, height: k.size, borderRadius: k.radius }]}
      >
        {({ pressed }) => (
          <Animated.View
            style={[
              styles.okFace,
              {
                // Same box as the key, so the press scale runs from the key's own centre.
                width: k.size,
                height: k.size,
                borderRadius: k.radius,
                borderWidth: k.border,
                backgroundColor: t.accent,
                borderColor: t.accentSoft,
                shadowColor: t.keyEdge,
                opacity: reduce && pressed ? 0.85 : 1,
                transform: [{ scale: okScale }],
              },
            ]}
          >
            <OkBevel g={g} theme={t} />
            <Text
              tight
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[styles.okText, { color: t.accentInk, fontSize: g.label.fontSize, maxWidth: g.label.maxWidth }]}
              allowFontScaling={false}
            >
              {tr('ui.common.ok')}
            </Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
    </View>
  );
}

/**
 * The OK key's raised-bevel face, drawn inside the key's border (fills its parent's padding box).
 * Shared with the theme picker's mini preview (app/themes.tsx). Decoration only.
 */
export function OkBevel({ g, theme }: { g: DpadGeometry; theme: Pick<RemoteTheme, 'accent' | 'keyEdge'> }) {
  // Gradient ids must be unique per instance; useId's punctuation is not valid in url(#id).
  const id = `ok${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const inner = g.key.size - 2 * g.key.border;
  const r = inner / 2;
  // Bevel stops are shares of the key's outer height; convert to the inner face's coordinates.
  const at = (share: number) => Math.min(1, Math.max(0, (share * g.key.size - g.key.border) / inner));
  return (
    <Svg
      pointerEvents="none"
      width={inner}
      height={inner}
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BEVEL_LIGHT} stopOpacity={BEVEL_LIGHT_OPACITY} />
          <Stop offset={at(g.bevel.highlightEnd)} stopColor={BEVEL_LIGHT} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset={at(g.bevel.shadeStart)} stopColor={theme.keyEdge} stopOpacity={0} />
          <Stop offset="1" stopColor={theme.keyEdge} stopOpacity={BEVEL_SHADE_OPACITY} />
        </LinearGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={theme.accent} />
      <Circle cx={r} cy={r} r={r} fill={`url(#${id}l)`} />
      <Circle cx={r} cy={r} r={r} fill={`url(#${id}s)`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  pad: { alignSelf: 'center', ...elevation.key },
  ring: { position: 'absolute', borderRadius: 999, borderColor: 'transparent' },
  btn: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  // Soft drop shadow under the raised OK key (colour = theme keyEdge).
  okFace: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  okText: { fontFamily: fonts.displayBold },
});
