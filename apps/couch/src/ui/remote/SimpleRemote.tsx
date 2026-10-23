import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../Text';
import { RemoteIcon } from '../icons/RemoteIcon';
import { elevation, fonts } from '../../theme/tokens';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { PressableScale } from '../motion/PressableScale';
import type { KeyPress } from './RemoteKey';
import { useT } from '../../i18n/react';
import { NeverMirror } from '../NeverMirror';
import { keyPressScale, themedHaptic } from './press';
import { RemoteTexture } from './RemoteTexture';
import { useHoldPress } from './repeatHold';
import { SIMPLE_COLUMNS, SIMPLE_CONTROLS, SIMPLE_KEY_MIN_HEIGHT, SIMPLE_NOTE_KEYS, simpleRows, type SimpleControl } from './simple';
import { gridColumns, remoteContentWidth } from '../../core/textScale';

/**
 * Simple mode (prototype `.remote.simple`): 2-column grid of big labelled keys.
 * The grid holds the volume and channel keys (the simple rockers), so it is never mirrored
 * (owner-1016 R3): Louder/Quieter stay on the physical left in Arabic too. The note mirrors.
 */
export function SimpleRemote({ onKey, width }: { onKey: KeyPress; /** Content width (pt) of the card. */ width?: number }) {
  const t = useRemoteTheme();
  const tr = useT();
  // Larger Text (T74): one key per row once a caption's longest word no longer fits half the card.
  const win = useWindowDimensions();
  const columns = gridColumns(
    width ?? remoteContentWidth(win.width),
    SIMPLE_COLUMNS,
    SIMPLE_CONTROLS.map((c) => c.caption),
    { fontSize: 17, fontScale: win.fontScale, role: 'label', padH: 8, gap: 12, wrap: true },
  );
  return (
    <View style={[styles.remote, { backgroundColor: t.body }]}>
      <RemoteTexture texture={t.texture} radius={28} />
      <NeverMirror style={styles.grid}>
        {simpleRows(SIMPLE_CONTROLS, columns).map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((c) => (
              <SimpleKey key={c.key} control={c} onKey={onKey} />
            ))}
          </View>
        ))}
      </NeverMirror>
      <View style={styles.log}>
        <Text scaleRole="meta" style={[styles.logText, { color: t.muted }]}>{tr(SIMPLE_NOTE_KEYS[0])}</Text>
        <Text scaleRole="meta" style={[styles.logText, { color: t.muted }]}>{tr(SIMPLE_NOTE_KEYS[1])}</Text>
      </View>
    </View>
  );
}

/** One big key. Louder / Quieter / channel keys repeat while held (T72); Power and Home never do. */
function SimpleKey({ control: c, onKey }: { control: SimpleControl; onKey: KeyPress }) {
  const t = useRemoteTheme();
  const color = c.power ? t.power : t.ink;
  const hold = useHoldPress(c.key, c.label, onKey, c.power ? 'heavy' : themedHaptic('light', t.press));
  return (
    <View style={styles.cell}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={c.label}
        haptic="none"
        scaleTo={keyPressScale(t.press)}
        {...hold}
        style={({ pressed }) => [styles.key, { backgroundColor: pressed ? t.accentSoft : t.key, shadowColor: t.keyEdge }]}
      >
        <RemoteIcon name={c.icon} size={30} color={color} />
        <Text scaleRole="label" style={[styles.caption, { color }]}>
          {c.caption}
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  remote: { borderRadius: 28, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 18, gap: 12 },
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  key: {
    minHeight: SIMPLE_KEY_MIN_HEIGHT,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    ...elevation.key,
  },
  /** PressableScale styles its inner view, so the flexing cell is a wrapper. */
  cell: { flex: 1 },
  caption: { fontFamily: fonts.textSemi, fontSize: 17, textAlign: 'center' },
  log: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, minHeight: 18, marginTop: 6 },
  logText: { fontFamily: fonts.mono, fontSize: 11.5, flexShrink: 1 },
});
