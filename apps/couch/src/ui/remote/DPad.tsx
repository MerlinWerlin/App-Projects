import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { dpadAvailableWidth, dpadGeometry, type DpadGeometry, type DpadRect } from '../../core/dpadGeometry';
import { Text } from '../Text';
import { duration, spring } from '../../theme/motion';
import type { RemoteTheme } from '../../theme/remoteThemes';
import { fonts, space } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { useT } from '../../i18n/react';
import { NEVER_MIRROR_STYLE } from '../NeverMirror';
import { DPAD, DPAD_LABEL_KEY, type KeyControl } from './controls';
import { haptic } from './haptics';
import { nubSpec, okModel, PAD_PERSPECTIVE, padModel, tiltFor } from './machined';
import { ModelSvg } from './ModelSvg';
import { keyPressScale, themedHaptic } from './press';
import type { KeyPress } from './RemoteKey';
import { useHoldPress, type HoldPressProps } from './repeatHold';

type Side = 'up' | 'down' | 'left' | 'right';
const SIDES: readonly Side[] = ['up', 'right', 'down', 'left'];

/** Peak opacity of the light glint that runs over the metal on the pressed side (the opening animation's glint). */
const GLINT_OPACITY = 0.85;
/** The OK disc darkens this much while held, as if it sank into its groove. */
const OK_SINK_SHADE = 0.22;

/**
 * The direction pad, drawn as the remote in the app icon and opening animation (Nov 2026 overhaul, DESIGN.md "The
 * logo remote"): a spun-gold ring sunk in a dark well, four dark arrow nubs, and a big round OK disc (fb-1017b H1,
 * ~52% of the ring) sitting in a black groove. Artwork is shape data from src/ui/remote/machined.ts (the opening
 * animation's own generators), drawn once per size and theme, never per press.
 *
 * Press feel: the pad rocks a few degrees toward the pressed arrow on the motion spring, like a real rocker pad, and
 * a glint of light runs over the metal on that side; OK sinks (scale + shade) with a medium haptic. Reduce Motion: no
 * rocking or scaling, the glint and shade still show.
 *
 * Geometry (fb-1017-ok): every size and hit area comes from dpadGeometry(measured width), one diameter shared by the
 * ring, the OK key and the arrow hit areas, so OK is a true circle exactly centred with an equal gap all round, never
 * clipped, on SE to Pro Max and with large Dynamic Type. Themes only change colours. The OK label uses
 * lineHeight = fontSize (Text `tight`). Never mirrored (owner-1016 R3): the pad's root carries NEVER_MIRROR_STYLE.
 */
export function DPad({ onKey }: { onKey: KeyPress }) {
  const t = useRemoteTheme();
  const tr = useT();
  const reduce = useReducedMotion();
  const win = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const g = dpadGeometry(measured ?? dpadAvailableWidth(win.width, space.gutter), win.fontScale);
  const rect = (r: DpadRect): ViewStyle => ({ left: r.x, top: r.y, width: r.w, height: r.h });
  const pad = useMemo(() => padModel(t, g.diameter, g.key.size), [t, g.diameter, g.key.size]);
  const ok = useMemo(() => okModel(t, g.key.size), [t, g.key.size]);

  // Animated values live for the component's lifetime (useState initialisers: created once, never read as refs).
  const [tiltX] = useState(() => new Animated.Value(0));
  const [tiltY] = useState(() => new Animated.Value(0));
  const [okScale] = useState(() => new Animated.Value(1));
  const [okShade] = useState(() => new Animated.Value(0));
  const [glint] = useState(() => ({
    up: new Animated.Value(0),
    down: new Animated.Value(0),
    left: new Animated.Value(0),
    right: new Animated.Value(0),
  }));

  const springTo = (v: Animated.Value, to: number) =>
    Animated.spring(v, { toValue: to, ...spring, useNativeDriver: true }).start();
  const fade = (v: Animated.Value, to: number, ms: number) =>
    Animated.timing(v, { toValue: to, duration: ms, useNativeDriver: true }).start();

  const tapArrow = themedHaptic('light', t.press);
  const hold: Record<Side, HoldPressProps> = {
    up: useHoldPress(DPAD.up.key, DPAD.up.label, onKey, tapArrow),
    down: useHoldPress(DPAD.down.key, DPAD.down.label, onKey, tapArrow),
    left: useHoldPress(DPAD.left.key, DPAD.left.label, onKey, tapArrow),
    right: useHoldPress(DPAD.right.key, DPAD.right.label, onKey, tapArrow),
  };

  const rock = (side: Side | null) => {
    if (reduce) return;
    const r = tiltFor(side);
    springTo(tiltX, r.rotateX);
    springTo(tiltY, r.rotateY);
  };

  const arrow = (side: Side, c: KeyControl) => (
    <Pressable
      key={c.key}
      accessibilityRole="button"
      accessibilityLabel={c.label}
      onPressIn={() => {
        fade(glint[side], GLINT_OPACITY, duration.fast);
        rock(side);
        hold[side].onPressIn();
      }}
      onPressOut={() => {
        fade(glint[side], 0, duration.slow);
        rock(null);
        hold[side].onPressOut();
      }}
      onPress={hold[side].onPress}
      style={[styles.btn, rect(g.arrows[side])]}
    />
  );

  const k = g.key;
  const rotateX = tiltX.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });
  const rotateY = tiltY.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] });
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
            transform: [{ perspective: PAD_PERSPECTIVE }, { rotateX }, { rotateY }],
          },
        ]}
      >
        <ModelSvg size={g.diameter} gradients={pad.gradients} shapes={pad.shapes} />
        {SIDES.map((side) => (
          <Glint key={side} side={side} g={g} theme={t} opacity={glint[side]} />
        ))}
        {arrow('up', DPAD.up)}
        {arrow('left', DPAD.left)}
        {arrow('right', DPAD.right)}
        {arrow('down', DPAD.down)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={DPAD.ok.label}
          onPressIn={() => {
            fade(okShade, OK_SINK_SHADE, duration.fast);
            if (!reduce) springTo(okScale, keyPressScale(t.press));
          }}
          onPressOut={() => {
            fade(okShade, 0, duration.base);
            if (!reduce) springTo(okScale, 1);
          }}
          onPress={() => {
            haptic(themedHaptic('medium', t.press));
            onKey(DPAD.ok.key, DPAD.ok.label);
          }}
          style={[styles.btn, { left: k.offset, top: k.offset, width: k.size, height: k.size, borderRadius: k.radius }]}
        >
          <Animated.View
            style={[
              styles.okFace,
              {
                width: k.size,
                height: k.size,
                borderRadius: k.radius,
                shadowColor: t.keyEdge,
                transform: [{ scale: okScale }],
              },
            ]}
          >
            <ModelSvg size={k.size} gradients={ok.gradients} shapes={ok.shapes} />
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
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { borderRadius: k.radius, backgroundColor: '#000000', opacity: okShade }]}
            />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * A soft streak of light on the metal just outside a nub, stretched along the ring (the opening animation's glint).
 * Fades in while that arrow is held. Decoration only.
 */
function Glint({ side, g, theme, opacity }: { side: Side; g: DpadGeometry; theme: RemoteTheme; opacity: Animated.Value }) {
  const nub = nubSpec(g.diameter, g.key.size);
  const c = g.diameter / 2;
  const rx = Math.round(nub.base * 1.5);
  const ry = Math.round(nub.height * 0.75);
  const vertical = side === 'up' || side === 'down';
  const w = vertical ? rx * 2 : ry * 2;
  const h = vertical ? ry * 2 : rx * 2;
  const along = side === 'up' || side === 'left' ? -1 : 1;
  const cx = vertical ? c : c + along * nub.dist;
  const cy = vertical ? c + along * nub.dist : c;
  const id = `gl-${side}`;
  const light = theme.scheme === 'dark' ? '#FFF6E0' : '#FFFFFF';
  return (
    <Animated.View pointerEvents="none" style={[styles.glint, { left: cx - w / 2, top: cy - h / 2, width: w, height: h, opacity }]}>
      <Svg width={w} height={h} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <RadialGradient id={id} cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} gradientUnits="userSpaceOnUse">
            <Stop offset={0} stopColor={light} stopOpacity={0.75} />
            <Stop offset={0.45} stopColor={light} stopOpacity={0.3} />
            <Stop offset={1} stopColor={light} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The OK disc's artwork alone at a given geometry, for small previews (the theme picker's mini remote). Shares the
 * pad's model, so the preview and the remote always match.
 */
export function OkDisc({ g, theme }: { g: DpadGeometry; theme: Pick<RemoteTheme, 'id' | 'accent'> }) {
  const model = useMemo(() => okModel(theme, g.key.size, 'mini'), [theme, g.key.size]);
  return <ModelSvg size={g.key.size} gradients={model.gradients} shapes={model.shapes} />;
}

/** The whole pad face (well, ring, nubs) for previews. */
export function PadFace({ g, theme }: { g: DpadGeometry; theme: RemoteTheme }) {
  const model = useMemo(() => padModel(theme, g.diameter, g.key.size, 'minip'), [theme, g.diameter, g.key.size]);
  return <ModelSvg size={g.diameter} gradients={model.gradients} shapes={model.shapes} />;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  pad: { alignSelf: 'center' },
  btn: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glint: { position: 'absolute' },
  okFace: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  okText: { fontFamily: fonts.displayBold },
});
