import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { Text } from '../Text';
import { KEYBOARD_MODE_LABEL, LiveTyper, type KeyboardMode } from '../../core/keyboard';
import { useSession } from '../../state/session';
import { fonts, minTarget } from '../../theme/tokens';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { PressableScale } from '../motion/PressableScale';
import { useT } from '../../i18n/react';
import { Sheet } from '../Sheet';
import { gridColumns, minKeyHeight, roleCap, rowOrStack, sheetContentWidth } from '../../core/textScale';

export interface KeyboardSheetProps {
  visible: boolean;
  onClose: () => void;
}

const MODES: KeyboardMode[] = ['live', 'enter'];

/**
 * Bottom sheet for typing on the TV (prototype keyboardSheet). Logic lives in
 * src/core/keyboard.ts (LiveTyper), tested against MockTv; this file only renders.
 */
export function KeyboardSheet({ visible, onClose }: KeyboardSheetProps) {
  const t = useRemoteTheme();
  const tr = useT();
  const { session, snap } = useSession();
  const typer = useMemo(() => new LiveTyper(session), [session]);
  const [value, setValue] = useState<string>('');
  const [mode, setMode] = useState<KeyboardMode>('live');
  const inputRef = useRef<TextInput>(null);
  const tvName = session.activeTv()?.name ?? tr('ui.keyboard.yourTv');

  // Fresh field each time the sheet opens or the active TV changes.
  useEffect(() => {
    if (visible) {
      typer.reset('');
      setValue('');
    }
  }, [visible, snap.activeId, typer]);

  const onChange = (next: string): void => {
    setValue(next);
    if (mode === 'live') void typer.update(next);
  };

  const onPickMode = (m: KeyboardMode): void => {
    if (m === mode) return;
    setMode(m);
    // Switching to live sends what is already in the field so the TV catches up.
    if (m === 'live') void typer.update(value);
  };

  const onSearch = (): void => {
    void typer.submit(value);
    setValue('');
    onClose();
  };

  const onClear = (): void => {
    setValue('');
    if (mode === 'live') void typer.clear();
    else typer.reset('');
    inputRef.current?.focus();
  };

  const note = tr(mode === 'live' ? 'ui.keyboard.noteLive' : 'ui.keyboard.noteEnter');

  // Larger Text (T74): the mode toggle and the Clear / Search pair stack when their scaled labels
  // no longer fit side by side; the toggle's buttons keep a 44 pt target.
  const win = useWindowDimensions();
  const avail = sheetContentWidth(win.width);
  const segLayout = rowOrStack(
    avail - 6,
    MODES.map((m) => KEYBOARD_MODE_LABEL[m]),
    { fontSize: 12.5, fontScale: win.fontScale, role: 'label', padH: 12 },
  );
  const segBtnH = minKeyHeight(12.5, win.fontScale, 'label', { padV: 6 });
  const btnColumns = gridColumns(
    avail,
    2,
    [tr('ui.keyboard.clear'), tr('ui.keyboard.send')],
    { fontSize: 15, fontScale: win.fontScale, role: 'label', padH: 16, gap: 10, wrap: true },
  );

  return (
    <Sheet
      palette={t}
      visible={visible}
      onClose={onClose}
      title={tr('ui.keyboard.title', { tv: tvName })}
      accessibilityLabel={tr('ui.keyboard.label')}
      closeLabel={tr('ui.keyboard.close')}
      avoidKeyboard
    >
      <View
        style={[styles.seg, segLayout === 'stack' ? styles.segStack : null, { backgroundColor: t.key }]}
        accessibilityRole="radiogroup" accessibilityLabel={tr('ui.keyboard.mode')}>
        {MODES.map((m) => {
          const on = m === mode;
          return (
            <PressableScale
              key={m}
              haptic="selection"
              onPress={() => onPickMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={KEYBOARD_MODE_LABEL[m]}
              style={[styles.segBtn, { minHeight: segBtnH }, on ? { backgroundColor: t.accent } : null]}
            >
              <Text scaleRole="label" style={[styles.segTxt, { color: on ? t.accentInk : t.muted }]}>
                {KEYBOARD_MODE_LABEL[m]}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSearch}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        submitBehavior="submit"
        placeholder={tr('ui.keyboard.placeholder')}
        placeholderTextColor={t.muted}
        maxFontSizeMultiplier={roleCap('body')}
        accessibilityLabel={tr('ui.keyboard.field')}
        style={[styles.field, { backgroundColor: t.key, borderColor: t.keyEdge, color: t.ink }]}
      />
      <Text scaleRole="body" style={[styles.note, { color: t.muted }]}>
        {note}
      </Text>
      {snap.lastError ? (
        <Text scaleRole="body" style={[styles.note, { color: t.warn }]} accessibilityLiveRegion="polite">
          {snap.lastError}
        </Text>
      ) : null}

      <View style={btnColumns === 2 ? styles.row : styles.stack}>
        <View style={btnColumns === 2 ? styles.cell : null}>
          <PressableScale
            haptic="light"
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={tr('ui.keyboard.clear')}
            style={[styles.btn, { backgroundColor: t.key }]}
          >
            <Text scaleRole="label" style={[styles.btnTxt, { color: t.ink }]}>
              {tr('ui.keyboard.clear')}
            </Text>
          </PressableScale>
        </View>
        <View style={btnColumns === 2 ? styles.cell : null}>
          <PressableScale
            haptic="success"
            onPress={onSearch}
            accessibilityRole="button"
            accessibilityLabel={tr('ui.keyboard.send')}
            style={[styles.btn, { backgroundColor: t.accent }]}
          >
            <Text scaleRole="label" style={[styles.btnTxt, { color: t.accentInk }]}>
              {tr('ui.keyboard.send')}
            </Text>
          </PressableScale>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 99, padding: 3 },
  segBtn: { borderRadius: 99, paddingVertical: 6, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  segTxt: { fontFamily: fonts.textSemi, fontSize: 12.5, textAlign: 'center' },
  /** Larger Text (T74): the two modes one above the other, full width. */
  segStack: { flexDirection: 'column', alignSelf: 'stretch', borderRadius: 22 },
  field: {
    width: '100%',
    fontFamily: fonts.text,
    fontSize: 17,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  note: { fontFamily: fonts.text, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10 },
  stack: { flexDirection: 'column', gap: 10 },
  // PressableScale styles its inner animated view, so flex: 1 lives on this wrapper.
  cell: { flex: 1 },
  btn: { minHeight: minTarget, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  btnTxt: { fontFamily: fonts.textBold, fontSize: 15, textAlign: 'center' },
});
