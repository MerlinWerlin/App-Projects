import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../Text';
import { RemoteIcon } from '../icons/RemoteIcon';
import type { Key } from '../../core/keys';
import { useSession } from '../../state/session';
import { fonts, minTarget, radius, tabular } from '../../theme/tokens';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { PressableScale } from '../motion/PressableScale';
import { Sheet } from '../Sheet';
import { useT } from '../../i18n/react';
import { NUMPAD_GRID, NUMPAD_NOTE_KEY, NUMPAD_OK, NUMPAD_TITLE_KEY, NUMPAD_UNSUPPORTED_NOTE_KEY } from './controls';
import { initialNumpad, pressDigit, pressOk, type NumpadResult, type NumpadState } from './numpad';
import { minKeyHeight } from '../../core/textScale';

export interface NumpadSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional: report what was sent so the remote's log line can show it. */
  onSent?: (label: string) => void;
}

/** Character typed by each numpad key (for the display); OK is handled separately. */
function charFor(key: Key): string {
  return key === 'NUM_DASH' ? '-' : key.replace('NUM_', '');
}

/**
 * 123 number pad bottom sheet (prototype v2 numpadSheet). State lives in numpad.ts;
 * digits go straight to the TV via session.sendKey. Free like every control.
 */
export function NumpadSheet({ visible, onClose, onSent }: NumpadSheetProps) {
  const t = useRemoteTheme();
  const tr = useT();
  const { session, snap } = useSession();
  const [state, setState] = useState<NumpadState>(initialNumpad);
  // Latest display state, so two taps inside one frame both land in the display.
  const stateRef = useRef<NumpadState>(state);
  // Same rule as numpadSupported(caps): the 'numbers' capability. Without it the sheet explains.
  const supported = session.can('numbers');
  // Larger Text (T74): the dial stays 3 x 4 (a phone keypad); digits grow up to the glyph cap and
  // the keys grow with them, never below 56 pt.
  const keyH = minKeyHeight(20, useWindowDimensions().fontScale, 'glyph', { padV: 12, floor: 56 });

  // Fresh display each time the sheet opens or the active TV changes.
  useEffect(() => {
    if (!visible) return;
    stateRef.current = initialNumpad();
    setState(stateRef.current);
  }, [visible, snap.activeId]);

  const apply = (r: NumpadResult, label: string): void => {
    stateRef.current = r.state;
    setState(r.state);
    if (r.send) {
      void session.sendKey(r.send);
      onSent?.(label);
    }
    if (r.close) onClose();
  };

  return (
    <Sheet
      palette={t}
      visible={visible}
      onClose={onClose}
      title={tr(NUMPAD_TITLE_KEY)}
      accessibilityLabel={tr('ui.remote.numberPad')}
      closeLabel={tr('ui.numpad.close')}
    >
      {supported ? (
        <>
          <Text
            scaleRole="title"
            style={[styles.show, tabular, { color: t.ink }]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={state.show ? tr('ui.numpad.typed', { digits: state.show }) : tr('ui.numpad.nothingTyped')}
          >
            {state.show || ' '}
          </Text>
          <View style={styles.grid}>
            {NUMPAD_GRID.map((c) => (
              <View key={c.key} style={styles.cell}>
                <PressableScale
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  onPress={() => apply(pressDigit(stateRef.current, charFor(c.key)), c.label)}
                  style={({ pressed }) => [
                    styles.key,
                    { minHeight: keyH, backgroundColor: pressed ? t.accentSoft : t.key, shadowColor: t.keyEdge },
                  ]}
                >
                  {c.icon ? (
                    <RemoteIcon name={c.icon} size={22} color={t.ink} />
                  ) : (
                    <Text scaleRole="glyph" style={[styles.keyText, tabular, { color: t.ink }]}>
                      {c.glyph}
                    </Text>
                  )}
                </PressableScale>
              </View>
            ))}
            <View style={styles.cell}>
              <PressableScale
                haptic="success"
                accessibilityRole="button"
                accessibilityLabel={NUMPAD_OK.label}
                onPress={() => {
                  const shown = stateRef.current.show;
                  apply(pressOk(stateRef.current), shown ? tr('ui.numpad.sentChannel', { channel: shown }) : NUMPAD_OK.label);
                }}
                style={({ pressed }) => [
                  styles.key,
                  // OK draws like the d-pad's OK: accent face, accentInk label (AA in every theme).
                  { minHeight: keyH, backgroundColor: pressed ? t.accentSoft : t.accent, shadowColor: t.keyEdge },
                ]}
              >
                {({ pressed }) => (
                <Text scaleRole="glyph" style={[styles.keyText, styles.okText, { color: pressed ? t.ink : t.accentInk }]}>
                  {tr('ui.common.ok')}
                </Text>
                )}
              </PressableScale>
            </View>
          </View>
          <Text scaleRole="body" style={[styles.note, { color: t.muted }]}>{tr(NUMPAD_NOTE_KEY)}</Text>
        </>
      ) : (
        <Text scaleRole="body" style={[styles.note, { color: t.muted }]}>{tr(NUMPAD_UNSUPPORTED_NOTE_KEY)}</Text>
      )}

      {snap.lastError ? (
        <Text scaleRole="body" style={[styles.note, { color: t.warn }]} accessibilityLiveRegion="polite">
          {snap.lastError}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  show: { fontFamily: fonts.mono, fontSize: 26, textAlign: 'center', minHeight: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  // PressableScale styles its inner animated view, so the grid width lives on this wrapper.
  cell: { width: '31.5%' },
  key: {
    minHeight: 56,
    minWidth: minTarget,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 2,
  },
  keyText: { fontFamily: fonts.display, fontSize: 20 },
  // A translated OK may be longer than two letters: it wraps inside the key instead of clipping.
  okText: { textAlign: 'center', paddingHorizontal: 4 },
  note: { fontFamily: fonts.text, fontSize: 13 },
});
