import { StyleSheet, View } from 'react-native';
import { elevation } from '../../theme/tokens';
import { NEVER_MIRROR_STYLE } from '../NeverMirror';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { useT } from '../../i18n/react';
import { COLOR_ROW, COLOR_ROW_LABEL_KEY } from './controls';
import { PressableScale } from '../motion/PressableScale';
import type { KeyPress } from './RemoteKey';

/**
 * Red / green / yellow / blue pill buttons (prototype v2 .colors). The remote screen only
 * renders this when the TV driver has the 'colorKeys' capability. Free like every control.
 */
/** Red/green/yellow/blue keep the TV's physical order in RTL (owner-1016). */
export function ColorKeys({ onKey }: { onKey: KeyPress }) {
  const t = useRemoteTheme();
  const tr = useT();
  return (
    <View accessibilityLabel={tr(COLOR_ROW_LABEL_KEY)} style={[styles.row, NEVER_MIRROR_STYLE]}>
      {COLOR_ROW.map((c) => (
        <View key={c.key} style={styles.cell}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={c.label}
            hitSlop={{ top: 9, bottom: 9, left: 2, right: 2 }}
            scaleTo={0.94}
            onPress={() => onKey(c.key, c.label)}
            style={[styles.pill, { backgroundColor: c.color, shadowColor: t.keyEdge }]}
          >
            {null}
          </PressableScale>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  /** PressableScale styles its inner view, so the flexing cell is a wrapper. */
  cell: { flex: 1 },
  pill: {
    height: 30,
    borderRadius: 99,
    ...elevation.key,
  },
});
