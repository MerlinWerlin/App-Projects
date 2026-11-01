// T221 (owner-1101e) "My widget art": every piece the user has applied (theme art and Widget Studio
// photos), newest first, each with a Remove button, plus the plain-words hint that each Glaze
// Seamless widget can show its own piece (long-press > Edit Widget). Reads the App Group library
// through widgets.artLibrary(); shows nothing in Expo Go / Android / an older build (no library).
// Removing deletes the piece's file; a widget that showed it falls back to the last applied image.
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { WidgetArtPiece } from '../core/widgetArtLibrary';
import { useT } from '../i18n';
import { widgets } from '../native/widgets';
import { chromeRadiusV2, fontScaleCap, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
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

export function WidgetArtLibraryList({ refreshKey = 0, style }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const [pieces, setPieces] = useState<WidgetArtPiece[] | null>(null);
  const [dir, setDir] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await widgets.artLibrary();
    if (!res.available || !res.ok) {
      setPieces(null);
      return;
    }
    setPieces(res.pieces);
    setDir(res.dir);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (pieces === null) return null;

  const onRemove = async (piece: WidgetArtPiece) => {
    if (busyId) return;
    setBusyId(piece.id);
    haptic('select');
    const res = await widgets.removeFromArtLibrary(piece.id);
    setBusyId(null);
    const msg = res.ok ? t('ui.seamless.library.removed') : t('ui.seamless.library.failed');
    setLine(msg);
    AccessibilityInfo.announceForAccessibility(msg);
    await load();
  };

  const base = dir.endsWith('/') ? dir : `${dir}/`;

  return (
    <View style={[styles.wrap, style]}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...label('headline'), { color: c.ink }]}>
        {t('ui.seamless.library.title')}
      </Text>
      <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
        {pieces.length ? t('ui.seamless.library.hint') : t('ui.seamless.library.empty')}
      </Text>
      {pieces.map((p) => (
        <View key={p.id} style={[styles.row, { borderColor: c.separator }]}>
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
          <PillButton
            label={t('ui.seamless.library.remove')}
            icon="trash-2"
            variant="destructive"
            size="small"
            busy={busyId === p.id}
            haptic={false}
            onPress={() => void onRemove(p)}
            accessibilityLabel={t('ui.seamless.library.removeA11y', { name: p.name })}
          />
        </View>
      ))}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, paddingVertical: spaceV2.sm, borderTopWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: chromeRadiusV2.control },
  text: { flex: 1, gap: spaceV2.xxs },
});
