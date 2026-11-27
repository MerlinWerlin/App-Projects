// T221 (owner-1101e) "My widget art", reworked 2026-11-13 (owner TestFlight feedback: "the numbers
// need to be larger and more clear and there needs to be no remove options just the native art works
// to the theme"): the current theme's Artwork 1-5, one row per slot in order, each with a big number
// in that slot's colour (src/core/artworkSlots.ts, the same colours as the Add Widget gallery tiles),
// the piece and its name. No Remove / Manage, no other sizes, photos or older pieces. Reads the App
// Group library through widgets.artLibrary(); shows nothing in Expo Go / Android / an older build.
// The one-time clean-up of art from older versions / other themes still runs on the first load.
// 1.0.37 (owner TestFlight 1.0.36): re-reads by itself when the active theme changes and after every
// index write of the theme art sync; while the new theme's art is being made it shows placeholder rows,
// never the previous theme's pieces.
// 1.0.39 (owner TestFlight 1.0.37): a theme with fewer than five pieces shows each piece ONCE and the
// calm theme-colour design in the other slots (as the Home Screen widget does), never the same image
// twice. Each piece has a More menu: Save to Photos (add-only access) or Add to Custom 1-5 (confirmed
// when the slot already has a picture), so a piece from any theme can stay on the Home Screen.
import { Image as ExpoImage } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { openArtworkActions } from './artworkActions';
import { useToast } from './Toast';
import { ARTWORK_GROUPS, artworkPieces, artworkSlotColour } from '../core/artworkSlots';
import type { WidgetArtPiece, WidgetArtSize } from '../core/widgetArtLibrary';
import { useT } from '../i18n';
import { widgets } from '../native/widgets';
import { loadActiveThemeId, useActiveThemeId } from '../store/activeTheme';
import { getThemeArtSyncStatus, subscribeThemeArtSync, type ThemeArtSyncStatus } from '../store/themeWidgetArt';
import { chromeRadiusV2, circleRadius, fontScaleCap, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { textStyleFor } from './i18nLayout';

type Props = {
  /** Bump to re-read the library (ThemeWidgetArt calls back after adding a piece). */
  refreshKey?: number;
  style?: StyleProp<ViewStyle>;
  /** 1.0.39: the theme in use's colours, for the design shown in a slot the theme has no piece for. */
  palette?: { bg: string; accent: string; ink: string } | null;
  /** 1.0.41: Add to Custom n needs Glaze Plus for this (premium) theme; the paywall opens instead. */
  customLocked?: boolean;
  onCustomLocked?: () => void;
};

// Owner 2026-11-14 ("large image and large number next to each other, not separate"): each row is a
// big number in the slot colour on the left and the artwork itself, large, on the right.
const THUMB = 132;
const NUMBER = 64;
/**
 * Owner 2026-11-27: Artwork 6-7 (medium) and 8-9 (large) show in the shape of their widget, at the
 * same height as the square small thumbnails' area (medium 364x170 pt, large 364x382 pt).
 */
export const THUMB_SIZE: Record<WidgetArtSize, { width: number; height: number }> = {
  small: { width: THUMB, height: THUMB },
  medium: { width: 176, height: 82 },
  large: { width: 126, height: 132 },
};
/** T238: the one-time clean-up runs once per app launch at most (it is a no-op once flagged). */
let migrationTried = false;

export function WidgetArtLibraryList({ refreshKey = 0, style, palette = null, customLocked = false, onCustomLocked }: Props) {
  const toast = useToast();
  const { c } = useColorsV2();
  const { t, script } = useT();
  const label = (role: TypeRoleV2) => [textV2[role], textStyleFor(script, textV2[role])];
  const [pieces, setPieces] = useState<WidgetArtPiece[] | null>(null);
  const [dir, setDir] = useState('');
  const [storedThemeId, setStoredThemeId] = useState<string | null>(null);
  const [artwork, setArtwork] = useState<Record<WidgetArtSize, string[] | null>>({ small: null, medium: null, large: null });
  // 1.0.37: the theme in use (updates the moment a theme is applied) and the art sync's progress.
  const liveThemeId = useActiveThemeId();
  const activeThemeId = liveThemeId ?? storedThemeId;
  const [sync, setSync] = useState<ThemeArtSyncStatus>(getThemeArtSyncStatus);
  useEffect(() => subscribeThemeArtSync(setSync), []);

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
      setStoredThemeId(themeId);
      if (!res || !res.available || !res.ok || !Array.isArray(res.pieces)) {
        setPieces(null);
        return;
      }
      setPieces(res.pieces.filter((p) => !!p && typeof p.id === 'string'));
      setDir(typeof res.dir === 'string' ? res.dir : '');
      const listOf = (v: unknown) => (Array.isArray(v) ? (v as string[]) : null);
      setArtwork({ small: listOf(res.artwork), medium: listOf(res.artworkMedium), large: listOf(res.artworkLarge) });
    } catch (e) {
      console.warn('[WidgetArt] library read failed', e);
      if (alive.current) setPieces(null);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load, refreshKey, liveThemeId, sync.rev]);

  if (pieces === null) return null;

  const base = dir.endsWith('/') ? dir : `${dir}/`;
  // Owner 2026-11-27: one section per size, numbered on from the last (small Artwork 1-5, medium
  // 6-7, large 8-9: src/core/artworkSlots.ts ARTWORK_GROUPS, the same numbers as the Home Screen).
  // Artwork n = the size's n-th plain art piece (the same rule as the widget), from the same ordered
  // lists the Home Screen widgets read (index.json `artwork`, `artworkMedium`, `artworkLarge`).
  const sections = ARTWORK_GROUPS.map((g) => {
    const listed = artworkPieces(pieces, activeThemeId, artwork[g.size], g.size);
    // 1.0.37: pieces of another theme (the index has not caught up with a theme change yet) are never shown.
    const stale = !!activeThemeId && listed.some((p) => p.themeId !== activeThemeId);
    const list = stale ? [] : listed;
    // While the art is being made (or the index still lists the previous theme), unfilled slots are
    // Preparing placeholders; once it is done, a slot with no piece shows the theme design (1.0.39:
    // never a repeat, the same rule as the widget's ThemeArtSlots.piece).
    const preparing = stale || (sync.syncing !== null && list.length < g.count);
    const rows: { n: number; p: WidgetArtPiece | null; preparing: boolean; size: WidgetArtSize }[] =
      preparing || list.length ? Array.from({ length: g.count }, (_, i) => ({ n: g.first + i, p: list[i] ?? null, preparing, size: g.size })) : [];
    return { ...g, rows };
  });
  // A size with no pieces at all (an older pack before its medium / large art) is left out once the
  // small section shows; the empty note appears only when no size has anything.
  const shown = sections.filter((s) => s.rows.length);
  const rows = shown.flatMap((s) => s.rows);
  const sizeName = (s: WidgetArtSize) => (s === 'small' ? t('ui.seamless.sizes.small') : s === 'medium' ? t('ui.seamless.sizes.medium') : t('ui.seamless.sizes.large'));

  const openActions = (n: number, uri: string) => openArtworkActions(n, uri, t as never, toast, customLocked ? onCustomLocked ?? (() => undefined) : undefined);

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
      {shown.map((section) => (
        <View key={section.size} style={styles.section}>
          {/* Owner 2026-11-27: "Medium · 6-7" over its rows, so each number reads with its size. */}
          <Text accessibilityRole="header" maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...label('footnote'), styles.sectionTitle, { color: c.inkSecondary }]}>
            {`${sizeName(section.size)} · ${section.first}–${section.first + section.count - 1}`}
          </Text>
          {section.rows.map(({ n, p, preparing, size }) => {
        const col = artworkSlotColour(n);
        const thumbSize = THUMB_SIZE[size];
        if (!p && !preparing) {
          // 1.0.39: no piece for this slot yet: the calm theme-colour design, as on the Home Screen.
          return (
            <View
              key={n}
              style={[styles.row, { borderColor: c.separator }]}
              accessible
              accessibilityLabel={t('ui.seamless.library.artworkA11y', { n })}
              accessibilityValue={{ text: t('ui.seamless.library.themeDesign') }}
            >
              <View style={[styles.number, { backgroundColor: col.fill }]}>
                <Text allowFontScaling={false} style={[styles.numberText, { color: col.ink }]}>{n}</Text>
              </View>
              <View style={[styles.thumb, thumbSize, styles.placeholder, { backgroundColor: palette?.bg ?? c.fill }]}>
                <View style={[styles.designDot, { backgroundColor: palette?.accent ?? c.inkSecondary }]} />
              </View>
              <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), styles.text, { color: c.inkSecondary }]}>
                {t('ui.seamless.library.themeDesign')}
              </Text>
            </View>
          );
        }
        if (!p) {
          return (
            <View
              key={n}
              style={[styles.row, { borderColor: c.separator }]}
              accessible
              accessibilityLabel={t('ui.seamless.library.artworkA11y', { n })}
              accessibilityValue={{ text: t('ui.seamless.library.preparing') }}
              accessibilityState={{ busy: true }}
            >
              <View style={[styles.number, { backgroundColor: col.fill }]}>
                <Text allowFontScaling={false} style={[styles.numberText, { color: col.ink }]}>{n}</Text>
              </View>
              <View style={[styles.thumb, thumbSize, styles.placeholder, { backgroundColor: c.fill }]}>
                <ActivityIndicator color={c.inkSecondary} />
              </View>
              <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), styles.text, { color: c.inkSecondary }]}>
                {t('ui.seamless.library.preparing')}
              </Text>
            </View>
          );
        }
        return (
          <View
            key={n}
            style={[styles.row, { borderColor: c.separator }]}
            accessible
            accessibilityLabel={t('ui.seamless.library.artworkA11y', { n })}
            accessibilityValue={{ text: p.name }}
            // 1.0.39: VoiceOver reaches the same menu as the "…" button through a custom action.
            accessibilityActions={dir ? [{ name: 'more', label: t('ui.seamless.library.actions', { n }) }] : undefined}
            onAccessibilityAction={() => {
              if (dir) openActions(n, `${base}${p.file}`);
            }}
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
                style={[styles.thumb, thumbSize, { backgroundColor: c.surfaceRaised }]}
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <Text numberOfLines={2} maxFontSizeMultiplier={fontScaleCap('body')} style={[...label('body'), styles.text, { color: c.ink }]}>
              {p.name}
            </Text>
            {dir ? (
              <Pressable
                onPress={() => openActions(n, `${base}${p.file}`)}
                hitSlop={8}
                style={({ pressed }) => [styles.more, { backgroundColor: c.fill, opacity: pressed ? 0.6 : 1 }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Feather name="more-horizontal" size={20} color={c.ink} />
              </Pressable>
            ) : null}
          </View>
        );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spaceV2.sm, marginTop: spaceV2.lg },
  section: { gap: spaceV2.sm },
  sectionTitle: { marginTop: spaceV2.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, minHeight: sizeV2.touch, paddingVertical: spaceV2.sm, borderTopWidth: StyleSheet.hairlineWidth },
  number: { width: NUMBER, height: NUMBER, borderRadius: circleRadius(NUMBER), alignItems: 'center', justifyContent: 'center' },
  numberText: { ...textV2.largeTitle, fontWeight: '800' },
  thumb: { width: THUMB, height: THUMB, borderRadius: chromeRadiusV2.control },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  designDot: { width: 44, height: 44, borderRadius: circleRadius(44), opacity: 0.85 },
  more: { width: sizeV2.touch, height: sizeV2.touch, borderRadius: circleRadius(sizeV2.touch), alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
