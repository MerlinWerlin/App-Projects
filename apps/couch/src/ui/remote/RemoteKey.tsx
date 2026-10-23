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
import { keyPressScale, themedHaptic } from './press';
import { useHoldPress } from './repeatHold';

export interface KeyPress {
  (key: Key, label: string): void;
}

/**
 * Generic remote button (prototype .key): >= 48pt, labelled, spring press-scale + haptic
 * (PressableScale; light by default, heavy for Power). Draws a physical key face (KeyFace:
 * gradient, top highlight, soft inner shadow from the theme's key / keyEdge) that drops away while
 * pressed so the press colour shows, as if the key sank.
 */
export function RemoteButton({
  label,
  onPress,
  onPressIn,
  onPressOut,
  children,
  round,
  wide,
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
  style?: StyleProp<ViewStyle>;
  haptic?: HapticKind;
}) {
  const t = useRemoteTheme();
  const button = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      haptic={themedHaptic(kind, t.press)}
      scaleTo={keyPressScale(t.press)}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.key,
        // Theme: corner radius, key face, press colour (round keys stay round).
        { borderRadius: t.radius, backgroundColor: pressed ? t.accentSoft : t.key, shadowColor: t.keyEdge },
        round ? styles.round : null,
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed ? null : <KeyFace keyColor={t.key} edgeColor={t.keyEdge} radius={round ? 999 : t.radius} />}
          {children}
        </>
      )}
    </PressableScale>
  );
  // PressableScale styles its inner view, so a flexing (wide) key needs a flexing wrapper.
  return wide ? <View style={styles.wide}>{button}</View> : button;
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
}: {
  control: KeyControl;
  onKey: KeyPress;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRemoteTheme();
  const power = control.variant === 'power';
  const color = power ? t.power : t.ink;
  const kind: HapticKind = power ? 'heavy' : 'light';
  // The hold logic plays the haptics itself (tap on release, tick per repeat), so the button's is off.
  const hold = useHoldPress(control.key, control.label, onKey, themedHaptic(kind, t.press));
  // Labelled variant (prototype .key.lbl): icon above a small visible caption, min width 64.
  if (control.caption) {
    return (
      <RemoteButton
        label={control.label}
        haptic="none"
        {...hold}
        style={[styles.lbl, style]}
      >
        <KeyArt control={control} color={color} size={20} textStyle={styles.lblGlyph} />
        <Text scaleRole="caption" style={[styles.lblText, { color }]} importantForAccessibility="no">
          {control.caption}
        </Text>
      </RemoteButton>
    );
  }
  return (
    <RemoteButton
      label={control.label}
      haptic="none"
      {...hold}
      round={power || control.variant === 'round'}
      wide={control.variant === 'wide'}
      style={style}
    >
      <KeyArt control={control} color={color} size={22} textStyle={styles.glyph} />
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
      style={({ pressed }) => [styles.rockerBtn, pressed ? { backgroundColor: t.accentSoft } : null]}
    >
      <KeyArt control={control} color={t.ink} size={22} textStyle={styles.glyph} />
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
    <View
      accessibilityRole="none"
      accessibilityLabel={data.label}
      style={[NEVER_MIRROR_STYLE, styles.rocker, { backgroundColor: t.key, shadowColor: t.keyEdge }]}
    >
      <KeyFace keyColor={t.key} edgeColor={t.keyEdge} radius={24} />
      <RockerHalf control={data.up} onKey={onKey} />
      {/* The rocker is a fixed 60 pt physical control: its short caption shrinks to fit rather than clip. */}
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

const styles = StyleSheet.create({
  playRow: { flexDirection: 'row' },
  key: {
    minHeight: minTarget,
    minWidth: minTarget,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.key,
  },
  round: { borderRadius: 999, width: 52, height: 52 },
  wide: { flex: 1 },
  glyph: { fontFamily: fonts.textSemi, fontSize: 20, textAlign: 'center' },
  lbl: { minWidth: 64, paddingVertical: 6, paddingHorizontal: 10, gap: 2 },
  lblGlyph: { fontFamily: fonts.textSemi, fontSize: 18, textAlign: 'center' },
  lblText: { fontFamily: fonts.textSemi, fontSize: 11.5, textAlign: 'center' },
  rocker: { width: 60, borderRadius: 24, alignItems: 'center', ...elevation.key },
  rockerBtn: { height: 52, width: 60, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  caption: { fontFamily: fonts.textBold, fontSize: 11, letterSpacing: 0.9, maxWidth: 56, textAlign: 'center' },
});
