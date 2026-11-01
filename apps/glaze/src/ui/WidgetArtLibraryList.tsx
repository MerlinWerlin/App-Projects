// T221 (owner-1101e) "My widget art": every piece the user has applied (theme art and Widget Studio
// photos), newest first, each with a Remove button, plus the plain-words hint that each Glaze
// Seamless widget can show its own piece (long-press > Edit Widget). Reads the App Group library
// through widgets.artLibrary(); shows nothing in Expo Go / Android / an older build (no library).
// Removing deletes the piece's file; a widget that showed it falls back to the current theme's art.
// T238 (owner-1101g #6): Manage (select with checkboxes > Delete selected, Clear all with a confirm);
// the one-time clean-up of art from older versions / other themes runs on the first load.
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { WidgetArtPiece } from '../core/widgetArtLibrary';
import { useT } from '../i18n';
import { widgets } from '../native/widgets';
import { loadActiveThemeId } from '../store/activeTheme';
import { chromeRadiusV2, fontScaleCap, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';
import { textStyleFor } from './i18nLayout';
import { PillButton } from './PillButton';

type Props = {
  /** Bump to re-read the library (ThemeWidgetArt calls back after adding a piece). */
  refreshKey?: number;
  style?: StyleProp<ViewStyle>;
};

const THUMB = 56;
/** T238: the one-time clean-up runs once per app launch at most (it is a no-op once flagged). */
let migrationTried = false;

export function WidgetArtLibraryList({ refreshKey = 0, style }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const [pieces, setPieces] = useState<WidgetArtPiece[] | null>(null);
  const [dir, setDir] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // T264 (owner-1101i #2): no setState after unmount, and a failed bridge read hides the list
  // instead of rejecting unhandled.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    try {
      if (!migrationTried) {
        migrationTried = true;
        try {
          await widgets.migrateArtLibrary(await loadActiveThemeId());
        } catch {
          // Best effort: the library still lists below.
        }
      }
      const res = await widgets.artLibrary();
      if (!alive.current) return;
      if (!res || !res.available || !res.ok || !Array.isArray(res.pieces)) {
        setPieces(null);
        return;
      }
      const list = res.pieces.filter((p) => !!p && typeof p.id === 'string');
      setPieces(list);
      setDir(typeof res.dir === 'string' ? res.dir : '');
      setSelected((prev) => new Set([...prev].filter((id) => list.some((p) => p.id === id))));
      if (list.length === 0) setManaging(false);
    } catch (e) {
      console.warn('[WidgetArt] library read failed', e);
      if (alive.current) setPieces(null);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load, refreshKey]);

  if (pieces === null) return null;

  const onRemove = async (piece: WidgetArtPiece) => {
    if (busyId) return;
    setBusyId(piece.id);
    haptic('select');
    let res: { ok: boolean };
    try {
      res = await widgets.removeFromArtLibrary(piece.id);
    } catch {
      res = { ok: false }; // T264
    }
    setBusyId(null);
    const msg = res.ok ? t('ui.seamless.library.removed') : t('ui.seamless.library.failed');
    setLine(msg);
    AccessibilityInfo.announceForAccessibility(msg);
    await load();
  };

  const announce = (ok: boolean, done: string) => {
    const msg = ok ? done : t('ui.seamless.library.failed');
    setLine(msg);
    AccessibilityInfo.announceForAccessibility(msg);
  };

  const toggle = (id: string) => {
    haptic('select');
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDeleteSelected = async () => {
    if (bulkBusy || selected.size === 0) return;
    setBulkBusy(true);
    haptic('warning');
    let res: { ok: boolean };
    try {
      res = await widgets.removeManyFromArtLibrary([...selected]);
    } catch {
      res = { ok: false }; // T264
    }
    setBulkBusy(false);
    setSelected(new Set());
    announce(res.ok, t('ui.seamless.library.deleted'));
    await load();
  };

  const onClearAll = () => {
    if (bulkBusy) return;
    haptic('warning');
    Alert.alert(t('ui.seamless.library.clearTitle'), t('ui.seamless.library.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ui.seamless.library.clearAll'),
        style: 'destructive',
        onPress: async () => {
          setBulkBusy(true);
          let res: { ok: boolean };
          try {
            res = await widgets.clearArtLibrary();
          } catch {
            res = { ok: false }; // T264
          }
          setBulkBusy(false);
          setSelected(new Set());
          announce(res.ok, t('ui.seamless.library.deleted'));
          await load();
        },
      },
    ]);
  };

  const base = dir.endsWith('/') ? dir : `${dir}/`;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...label('headline'), styles.text, { color: c.ink }]}>
          {t('ui.seamless.library.title')}
        </Text>
        {pieces.length ? (
          <PillButton
            label={managing ? t('ui.seamless.library.done') : t('ui.seamless.library.manage')}
            variant="plain"
            size="small"
            onPress={() => {
              setManaging((m) => !m);
              setSelected(new Set());
            }}
            accessibilityLabel={managing ? t('ui.seamless.library.done') : t('ui.seamless.library.manageA11y')}
          />
        ) : null}
      </View>
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
        {pieces.length ? t('ui.seamless.library.hint') : t('ui.seamless.library.empty')}
      </Text>
      {pieces.length ? (
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
          {t('ui.seamless.library.kept')}
        </Text>
      ) : null}
      {managing ? (
        <View style={styles.actions}>
          <PillButton
            label={t('ui.seamless.library.deleteSelected')}
            icon="trash-2"
            variant="destructive"
            size="small"
            disabled={selected.size === 0}
            busy={bulkBusy}
            haptic={false}
            onPress={() => onDeleteSelected().catch(() => undefined)}
          />
          <PillButton label={t('ui.seamless.library.clearAll')} variant="plain" size="small" haptic={false} disabled={bulkBusy} onPress={onClearAll} />
        </View>
      ) : null}
      {pieces.map((p) => {
        const on = selected.has(p.id);
        const body = (
          <>
          {dir ? (
            <ExpoImage
              source={{ uri: `${base}${p.file}` }}
              recyclingKey={`${p.id}-${p.created}`}
              cachePolicy="none"
              contentFit="contain"
              style={[styles.thumb, { backgroundColor: c.surfaceRaised }]}
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <View style={styles.text}>
            <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), { color: c.ink }]}>
              {p.name}
            </Text>
            {p.themeName ? (
              <Text numberOfLines={1} maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
                {p.themeName}
              </Text>
            ) : null}
          </View>
          </>
        );
        if (managing) {
          return (
            <Pressable
              key={p.id}
              onPress={() => toggle(p.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t('ui.seamless.library.selectA11y', { name: p.name })}
              style={({ pressed }) => [styles.row, { borderColor: c.separator, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name={on ? 'check-circle' : 'circle'} size={sizeV2.rowIcon} color={on ? c.tint : c.inkSecondary} />
              {body}
            </Pressable>
          );
        }
        return (
        <View key={p.id} style={[styles.row, { borderColor: c.separator }]}>
          {body}
          <PillButton
            label={t('ui.seamless.library.remove')}
            icon="trash-2"
            variant="destructive"
            size="small"
            busy={busyId === p.id}
            haptic={false}
            onPress={() => onRemove(p).catch(() => undefined)}
            accessibilityLabel={t('ui.seamless.library.removeA11y', { name: p.name })}
          />
        </View>
        );
      })}
      {line ? (
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} accessibilityLiveRegion="polite" style={[...label('footnote'), { color: c.inkSecondary }]}>
          {line}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.sm, marginTop: spaceV2.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spaceV2.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch, paddingVertical: spaceV2.sm, borderTopWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: chromeRadiusV2.control },
  text: { flex: 1, gap: spaceV2.xxs },
});
