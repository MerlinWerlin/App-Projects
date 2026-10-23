import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../Text';
import { sourceNote, chooseSource, currentSourceId, loadSources, nextSource, type SourceView } from '../../core/inputs';
import type { TvInput } from '../../core/types';
import { useSession } from '../../state/session';
import { fonts, minTarget } from '../../theme/tokens';
import { useRemoteTheme } from '../../theme/useRemoteTheme';
import { PressableScale } from '../motion/PressableScale';
import { useT } from '../../i18n/react';
import { Sheet } from '../Sheet';
import { gridCellWidth, gridColumns, sheetContentWidth } from '../../core/textScale';

/**
 * Source picker sheet (prototype v2 sourceSheet, PLAN 6b). Logic lives in src/core/inputs.ts
 * (tested against MockTv); this file only renders. Contract: props stay { visible, onClose }.
 */
export interface SourceSheetProps {
  visible: boolean;
  onClose: () => void;
}

type LoadState = SourceView | { kind: 'loading' };

export function SourceSheet({ visible, onClose }: SourceSheetProps) {
  const t = useRemoteTheme();
  const tr = useT();
  const { session, snap } = useSession();
  const [view, setView] = useState<LoadState>({ kind: 'loading' });
  // Last input Couch chose, per TV: Roku does not report the current input, so we remember it.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const tvId = snap.activeId;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setView({ kind: 'loading' });
    let loaded: SourceView = { kind: 'cycle' };
    void session
      .exec(async (d) => {
        loaded = await loadSources(d);
      })
      .then(() => {
        // On error (lastError is set) fall back to cycling so "Next source" is still there.
        if (!cancelled) setView(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, tvId, session]);

  const inputs: TvInput[] = view.kind === 'list' ? view.inputs : [];
  const current = view.kind === 'list' ? currentSourceId(inputs, tvId ? chosen[tvId] : null) : null;
  // Larger Text (T74): two columns while the longest name fits half the sheet, else one per row;
  // names wrap between words instead of being cut off.
  const win = useWindowDimensions();
  const columns = gridColumns(
    sheetContentWidth(win.width),
    2,
    inputs.map((i) => i.name),
    { fontSize: 15, fontScale: win.fontScale, role: 'label', padH: 12, gap: 10, wrap: true },
  );
  const cellStyle = { width: gridCellWidth(columns) };

  const remember = (id: string | null): void => {
    if (!tvId || !id) return;
    setChosen((prev) => ({ ...prev, [tvId]: id }));
  };

  const onPick = (id: string): void => {
    void session.exec((d) => chooseSource(d, id)).then((ok) => {
      if (ok) remember(id);
    });
    onClose();
  };

  const onNext = (): void => {
    let picked: string | null = null;
    void session
      .exec(async (d) => {
        picked = await nextSource(d, { inputs, currentId: current });
      })
      .then((ok) => {
        if (ok) remember(picked);
      });
    onClose();
  };

  return (
    <Sheet
      palette={t}
      visible={visible}
      onClose={onClose}
      title={tr('ui.source.title')}
      accessibilityLabel={tr('ui.source.label')}
      closeLabel={tr('ui.source.close')}
    >
      {view.kind === 'loading' ? (
        <Text scaleRole="body" style={[styles.note, { color: t.muted }]}>
          {tr('ui.source.loading')}
        </Text>
      ) : null}

      {inputs.length > 0 ? (
        <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={tr('ui.source.list')}>
          {inputs.map((i) => {
            const on = i.id === current;
            return (
              <View key={i.id} style={cellStyle}>
                <PressableScale
                  haptic="light"
                  onPress={() => onPick(i.id)}
                  accessibilityRole="button"
                  accessibilityLabel={i.name}
                  accessibilityState={{ selected: on }}
                  style={[styles.src, { backgroundColor: t.key, borderColor: on ? t.accent : 'transparent' }]}
                >
                  <Text scaleRole="label" style={[styles.srcTxt, { color: t.ink }]}>
                    {i.name}
                  </Text>
                </PressableScale>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text scaleRole="body" style={[styles.note, { color: t.muted }]}>
        {sourceNote()}
      </Text>
      {snap.lastError ? (
        <Text scaleRole="body" style={[styles.note, { color: t.warn }]} accessibilityLiveRegion="polite">
          {snap.lastError}
        </Text>
      ) : null}

      <PressableScale
        haptic="light"
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={tr('ui.source.next')}
        style={[styles.btn, { backgroundColor: t.key }]}
      >
        <Text scaleRole="label" style={[styles.btnTxt, { color: t.ink }]}>
          {tr('ui.source.next')}
        </Text>
      </PressableScale>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Prototype .srcs: 2-column grid, gap 10, keys 56 tall, current ringed 2px in accent.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  src: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  srcTxt: { fontFamily: fonts.textSemi, fontSize: 15, textAlign: 'center' },
  note: { fontFamily: fonts.text, fontSize: 13 },
  btn: { minHeight: minTarget, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  btnTxt: { fontFamily: fonts.textBold, fontSize: 15, textAlign: 'center' },
});
