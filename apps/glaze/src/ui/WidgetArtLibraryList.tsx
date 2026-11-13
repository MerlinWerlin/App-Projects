// T221 (owner-1101e) "My widget art", reworked 2026-11-13 (owner TestFlight feedback: "the numbers
// need to be larger and more clear and there needs to be no remove options just the native art works
// to the theme"): the current theme's Artwork 1-5, one row per slot in order, each with a big number
// in that slot's colour (src/core/artworkSlots.ts, the same colours as the Add Widget gallery tiles),
// the piece and its name. No Remove / Manage, no other sizes, photos or older pieces. Reads the App
// Group library through widgets.artLibrary(); shows nothing in Expo Go / Android / an older build.
// The one-time clean-up of art from older versions / other themes still runs on the first load.
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ARTWORK_SLOT_COUNT, artworkPieces, artworkSlotColour } from '../core/artworkSlots';
import type { WidgetArtPiece } from '../core/widgetArtLibrary';
import { useT } from '../i18n';
import { widgets } from '../native/widgets';
import { loadActiveThemeId } from '../store/activeTheme';
import { chromeRadiusV2, circleRadius, fontScaleCap, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';

type Props = {
  /** Bump to re-read the library (ThemeWidgetArt calls back after adding a piece). */
  refreshKey?: number;
  style?: StyleProp<ViewStyle>;
};

// Owner 2026-11-14 ("large image and large number next to each other, not separate"): each row is a
// big number in the slot colour on the left and the artwork itself, large, on the right.
const THUMB = 132;
const NUMBER = 64;
/** T238: the one-time clean-up runs once per app launch at most (it is a no-op once flagged). */
let migrationTried = false;

export function WidgetArtLibraryList({ refreshKey = 0, style }: Props) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const [pieces, setPieces] = useState<WidgetArtPiece[] | null>(null);
  const [dir, setDir] = useState('');
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [artwork, setArtwork] = useState<string[] | null>(null);

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
      const themeId = await loadActiveThemeId().catch(() => null);
      if (!alive.current) return;
      setActiveThemeId(themeId);
      if (!res || !res.available || !res.ok || !Array.isArray(res.pieces)) {
        setPieces(null);
        return;
      }
      setPieces(res.pieces.filter((p) => !!p && typeof p.id === 'string'));
      setDir(typeof res.dir === 'string' ? res.dir : '');
      setArtwork(Array.isArray(res.artwork) ? res.artwork : null);
    } catch (e) {
      console.warn('[WidgetArt] library read failed', e);
      if (alive.current) setPieces(null);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load, refreshKey]);

  if (pieces === null) return null;

  const base = dir.endsWith('/') ? dir : `${dir}/`;
  // Artwork n = the theme's n-th small plain art piece, cycling (the same rule as the widget).
  // Owner 2026-11-13: the same ordered list the Home Screen widgets read (index.json `artwork`).
  const list = artworkPieces(pieces, activeThemeId, artwork);
  const rows = list.length ? Array.from({ length: ARTWORK_SLOT_COUNT }, (_, i) => ({ n: i + 1, p: list[i % list.length] })) : [];

  return (
    <View style={[styles.wrap, style]}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('headline')} style={[...label('headline'), { color: c.ink }]}>
        {t('ui.seamless.library.title')}
      </Text>
      {rows.length ? null : (
        <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), { color: c.inkSecondary }]}>
          {t('ui.seamless.library.empty')}
        </Text>
      )}
      {rows.map(({ n, p }) => {
        const col = artworkSlotColour(n);
        return (
          <View
            key={n}
            style={[styles.row, { borderColor: c.separator }]}
            accessible
            accessibilityLabel={t('ui.seamless.library.artworkA11y', { n })}
            accessibilityValue={{ text: p.name }}
          >
            <View style={[styles.number, { backgroundColor: col.fill }]}>
              <Text allowFontScaling={false} style={[styles.numberText, { color: col.ink }]}>{n}</Text>
            </View>
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
            <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), styles.text, { color: c.ink }]}>
              {p.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.sm, marginTop: spaceV2.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch, paddingVertical: spaceV2.sm, borderTopWidth: StyleSheet.hairlineWidth },
  number: { width: NUMBER, height: NUMBER, borderRadius: circleRadius(NUMBER), alignItems: 'center', justifyContent: 'center' },
  numberText: { ...textV2.largeTitle, fontWeight: '800' },
  thumb: { width: THUMB, height: THUMB, borderRadius: chromeRadiusV2.control },
  text: { flex: 1 },
});
