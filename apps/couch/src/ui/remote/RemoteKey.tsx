import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '../Text';
import { KeyFace } from '../icons/KeyFace';
import { RemoteIcon } from '../icons/RemoteIcon';
import type { Key } from '../../core/keys';
import { elevation, fonts, minTarget, radius } from '../../theme/tokens';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { PressableScale } from '../motion/PressableScale';
import { NEVER_MIRROR_STYLE, NeverMirror } from '../NeverMirror';
import type { KeyControl, Rocker as RockerData } from './controls';
import type { HapticKind } from './haptics';
import { capColors } from './machined';
import { keyPressScale, themedHaptic } from './press';
import { useHoldPress } from './repeatHold';

export interface KeyPress {
  (key: Key, label: string): void;
}

/** Depth of the recessed socket around every key (pt): the dark ring the cap sits in, like the icon's buttons. */
export const SOCKET = 3;

/**
 * The recess a key sits in (Nov 2026 overhaul, DESIGN.md "The logo remote"): a dark well a few points wider than the
 * cap, with a faint lit lip along its lower edge. Static: only the cap inside moves when pressed.
 */
export function Socket({
  radius: r,
  style,
  children,
}: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const t = useRemoteTheme();
  const c = capColors(t);
  return (
    <View style={[styles.socket, { borderRadius: r + SOCKET, backgroundColor: c.socket, borderBottomColor: c.socketLip }, style]}>
      {children}
    </View>
  );
}

/**
 * Generic remote button: a domed cap (KeyFace) in a socket. >= 48pt, labelled, haptic per theme. Pressing sinks the
 * cap (spring scale from PressableScale, so it stays inside its socket) and shades it, as a real key goes down;
 * Reduce Motion keeps the shade only.
 */
export function RemoteButton({
  label,
  onPress,
  onPressIn,
  onPressOut,
  children,
  round,
  wide,
  size,
  style,
  haptic: kind = 'light',
}: {
  label: string;
  onPress: () => void;
  /** Hold-to-repeat keys (useHoldPress) start / stop their repeat here. */
  onPressIn?: () => void;
  onPressOut?: () => void;
  children: ReactNode;
  round?: boolean;
  wide?: boolean;
  /** Round keys: cap diameter (pt). Default 52. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  haptic?: HapticKind;
}) {
  const t = useRemoteTheme();
  const r = round ? 999 : t.radius;
  const d = size ?? ROUND_KEY;
  const sized = {
    roundCap: { width: d, height: d },
  };
  return (
    <Socket radius={round ? d / 2 : t.radius} style={[wide ? styles.wide : null, round ? null : styles.stretch, style]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={4 + SOCKET}
        haptic={themedHaptic(kind, t.press)}
        scaleTo={keyPressScale(t.press)}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.key, { borderRadius: r, backgroundColor: t.key, shadowColor: t.keyEdge }, round ? sized.roundCap : styles.fill]}
      >
        {({ pressed }) => (
          <>
            <KeyFace keyColor={t.key} edgeColor={t.keyEdge} radius={round ? d / 2 : t.radius} />
            {children}
            {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sink, { borderRadius: r }]} /> : null}
          </>
        )}
      </PressableScale>
    </Socket>
  );
}

/** The key's artwork: its vector icon, or its text (digits / OK) when it has none. */
function KeyArt({ control, color, size, textStyle }: { control: KeyControl; color: string; size: number; textStyle: StyleProp<TextStyle> }) {
  if (control.icon) return <RemoteIcon name={control.icon} size={size} color={color} />;
  return (
    // Larger Text (T74): digits / OK grow up to the glyph cap, which still fits the 52 pt round key.
    <Text scaleRole="glyph" style={[textStyle, { color }]}>
      {control.glyph}
    </Text>
  );
}

/**
 * A button bound to a TV key from the layout data. Rewind / fast-forward (and any key in
 * REPEAT_KEYS) repeat while held with a selection tick per step (T72); Power, Home, Back, Mute
 * and the rest send once per press.
 */
export function RemoteKey({
  control,
  onKey,
  style,
  shape,
  size,
}: {
  control: KeyControl;
  onKey: KeyPress;
  style?: StyleProp<ViewStyle>;
  /** Override the layout data's shape (the remote draws Back / Home / Menu as the icon's round keys). */
  shape?: 'round';
  /** Round keys: cap diameter (pt). */
  size?: number;
}) {
  const t = useRemoteTheme();
  const power = control.variant === 'power';
  const color = power ? t.power : t.ink;
  const kind: HapticKind = power ? 'heavy' : 'light';
  // The hold logic plays the haptics itself (tap on release, tick per repeat), so the button's is off.
  const hold = useHoldPress(control.key, control.label, onKey, themedHaptic(kind, t.press));
  // Labelled variant (prototype .key.lbl): icon above a small visible caption, min width 64.
  if (control.caption) {
    // Labelled keys (Power, Source, Settings): a round cap with its name engraved on the body underneath.
    return (
      <View style={[styles.lbl, style]}>
        <RemoteButton label={control.label} haptic="none" {...hold} round size={LABELLED_KEY}>
          <KeyArt control={control} color={color} size={22} textStyle={styles.lblGlyph} />
        </RemoteButton>
        <Text scaleRole="caption" style={[styles.lblText, { color: t.muted }]} importantForAccessibility="no">
          {control.caption}
        </Text>
      </View>
    );
  }
  return (
    <RemoteButton
      label={control.label}
      haptic="none"
      {...hold}
      round={shape === 'round' || (shape === undefined && (power || control.variant === 'round'))}
      wide={shape === undefined && control.variant === 'wide'}
      size={size}
      style={style}
    >
      <KeyArt control={control} color={color} size={size && size >= 60 ? 24 : 22} textStyle={styles.glyph} />
    </RemoteButton>
  );
}

/**
 * One rocker half with hold-to-repeat (src/ui/remote/repeat.ts, useHoldPress): a tap sends one key
 * on release; holding sends the key after 400 ms and then repeatedly (accelerating), each step a
 * soft selection tick. A press that repeated does not send again on release.
 */
function RockerHalf({ control, onKey }: { control: KeyControl; onKey: KeyPress }) {
  const t = useRemoteTheme();
  const hold = useHoldPress(control.key, control.label, onKey, themedHaptic('light', t.press));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={control.label}
      haptic="none"
      scaleTo={keyPressScale(t.press)}
      {...hold}
      style={styles.rockerBtn}
    >
      {({ pressed }) => (
        <>
          <KeyArt control={control} color={t.ink} size={22} textStyle={styles.glyph} />
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sink, styles.rockerSink]} /> : null}
        </>
      )}
    </PressableScale>
  );
}

/**
 * Volume / channel rocker (prototype .rocker). Never mirrored (owner-1016 R3): up/down are the
 * TV's physical keys, so the rocker keeps its layout direction in Arabic (NEVER_MIRROR_STYLE).
 */
export function Rocker({ data, onKey }: { data: RockerData; onKey: KeyPress }) {
  const t = useRemoteTheme();
  return (
    <Socket radius={ROCKER_W / 2} style={NEVER_MIRROR_STYLE}>
      <View
        accessibilityRole="none"
        accessibilityLabel={data.label}
        style={[styles.rocker, { backgroundColor: t.key, shadowColor: t.keyEdge }]}
      >
        <KeyFace keyColor={t.key} edgeColor={t.keyEdge} radius={ROCKER_W / 2} />
        <RockerHalf control={data.up} onKey={onKey} />
        {/* The rocker is a fixed-width physical control: its short caption shrinks to fit rather than clip. */}
        <Text
          scaleRole="caption"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.caption, { color: t.muted }]}
          importantForAccessibility="no"
        >
          {data.caption.toUpperCase()}
        </Text>
        <RockerHalf control={data.down} onKey={onKey} />
      </View>
    </Socket>
  );
}

/**
 * Rewind / play-pause / fast-forward row (PLAYBACK_ROW). Never mirrored (owner-1016 R3): rewind
 * stays on the physical left and fast-forward on the right in Arabic too. Pass the row style.
 */
export function PlaybackRow({
  controls,
  onKey,
  style,
}: {
  controls: readonly KeyControl[];
  onKey: KeyPress;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <NeverMirror style={[styles.playRow, style]}>
      {controls.map((c) => (
        <RemoteKey key={c.key} control={c} onKey={onKey} />
      ))}
    </NeverMirror>
  );
}

/** Round key cap diameters (pt). */
const ROUND_KEY = 52;
const LABELLED_KEY = 54;
/** Rocker cap width (pt). */
const ROCKER_W = 58;

const styles = StyleSheet.create({
  playRow: { flexDirection: 'row' },
  socket: { padding: SOCKET, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center' },
  key: {
    minHeight: minTarget,
    minWidth: minTarget,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...elevation.key,
  },
  fill: { alignSelf: 'stretch' },
  wide: { flex: 1 },
  /** Non-round caps fill their socket (the Pressable stretches, then its face). */
  stretch: { alignItems: 'stretch' },
  sink: { backgroundColor: '#000000', opacity: 0.2 },
  glyph: { fontFamily: fonts.textSemi, fontSize: 20, textAlign: 'center' },
  lbl: { alignItems: 'center', gap: 6, minWidth: 64 },
  lblGlyph: { fontFamily: fonts.textSemi, fontSize: 18, textAlign: 'center' },
  lblText: { fontFamily: fonts.textSemi, fontSize: 11.5, textAlign: 'center' },
  rocker: { width: ROCKER_W, borderRadius: ROCKER_W / 2, alignItems: 'center', overflow: 'hidden', ...elevation.key },
  rockerBtn: { height: 54, width: ROCKER_W, alignItems: 'center', justifyContent: 'center' },
  rockerSink: { borderRadius: ROCKER_W / 2 },
  caption: { fontFamily: fonts.textBold, fontSize: 11, letterSpacing: 0.9, maxWidth: ROCKER_W - 6, textAlign: 'center' },
});
