// One tall rounded tile in the Wallpapers tab grid (T71). Draws, per tile kind:
//   theme    the theme's designed wallpaper (WallpaperView) under the Lock Screen clock (LockMock)
//   pair     the Lock wallpaper and its softened Home version side by side (core/wallpaperPair)
//   loop     a saved Live Lock Screen: a plain tinted tile with a play glyph and its name
//            (no poster frame is stored for loops, so none is faked), plus the LIVE badge
//   photo    entry tile into the wallpaper maker with the user's photo
//   makeLive entry tile into the Live tab
// The LIVE badge is drawn only when `tile.live` (true for saved loops only, see
// core/wallpaperTiles.ts). The Plus badge only when the theme is Plus.
// T77: with `onToggleLike`, theme and pair tiles get a heart (src/ui/HeartButton.tsx) at the
// bottom reading end that likes the wallpaper on this device only. No counts or ranks.
import { Feather } from '@expo/vector-icons';
import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../core/themes';
import { designedColours, homeVersionFor } from '../core/wallpaperPair';
import { pairHalfSize, tileFavouriteId, type WallpaperTile } from '../core/wallpaperTiles';
import { useT } from '../i18n';
import { PlusBadge } from '../plus/PlusBadge';
import { HomeTint } from '../render/HomeWallpaperView';
import { WallpaperView } from '../render/WallpaperView';
import { radiusV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { FeatherName } from './featherName';
import { HeartButton } from './HeartButton';
import { LockMock } from './LockMock';
import { PressableScale } from './PressableScale';
import { noMirror, textStyleFor } from './i18nLayout';

/** Nominal export size for the Home version maths (only the colours matter at tile size). */
const PAIR_SIZE = { width: 1179, height: 2556 };
const PAIR_GAP = spaceV2.xs;
/** Grain dots per small preview (the full count is for exports). */
const TILE_GRAIN = 60;

export type WallpaperTileViewProps = {
  tile: WallpaperTile;
  /** The tile's theme (theme and pair tiles). */
  theme?: Theme;
  /** The saved loop's name (loop tiles). */
  loopName?: string;
  width: number;
  height: number;
  onOpen: (href: string) => void;
  /** T77: whether this tile's wallpaper is liked on this device. */
  liked?: boolean;
  /** T77: likes / unlikes the wallpaper by theme id. Hearts show on theme and pair tiles only. */
  onToggleLike?: (id: string) => void;
};

function LiveBadge({ label }: { label: string }) {
  return (
    <View style={[styles.badge, styles.badgeStart, styles.liveBadge]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.liveDot} />
      <Text style={styles.liveText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PairArt({ theme, width, lockLabel, homeLabel }: { theme: Theme; width: number; lockLabel: string; homeLabel: string }) {
  const { c } = useColorsV2();
  const half = pairHalfSize(width - spaceV2.sm * 2, PAIR_GAP);
  const home = useMemo(() => homeVersionFor({ colours: designedColours(theme.wallpaper), size: PAIR_SIZE }), [theme]);
  const showArt = !theme.packId;
  return (
    <View style={[styles.pairRow, noMirror]}>
      {[lockLabel, homeLabel].map((label, i) => (
        <View key={label + i} style={styles.pairHalf}>
          <View style={[styles.pairFrame, { width: half.width, height: half.height, borderColor: c.separator }]}>
            <WallpaperView params={theme.wallpaper} width={half.width} height={half.height} maxGrain={TILE_GRAIN / 2} showArt={showArt} />
            {i === 1 ? <HomeTint home={home} /> : null}
          </View>
          <Text style={[textV2.caption2, { color: c.inkSecondary }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function WallpaperTileViewInner({ tile, theme, loopName, width, height, onOpen, liked = false, onToggleLike }: WallpaperTileViewProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const name = theme?.name ?? loopName ?? '';
  const favId = onToggleLike ? tileFavouriteId(tile) : undefined;
  const withHeart = favId !== undefined;

  let label: string;
  let hint: string;
  if (tile.kind === 'theme') {
    label = t('tabs.wallpapersTab.themeTileA11y', { name });
    hint = tile.plus ? t('tabs.wallpapersTab.plusTileHint') : t('tabs.wallpapersTab.themeTileHint');
  } else if (tile.kind === 'pair') {
    label = t('tabs.wallpapersTab.pairTileA11y', { name });
    hint = tile.plus ? t('tabs.wallpapersTab.plusTileHint') : t('tabs.wallpapersTab.themeTileHint');
  } else if (tile.kind === 'loop') {
    label = t('tabs.wallpapersTab.loopTileA11y', { name });
    hint = t('tabs.wallpapersTab.loopTileHint');
  } else if (tile.kind === 'makeLive') {
    label = t('tabs.wallpapersTab.makeLiveTile');
    hint = t('tabs.wallpapersTab.makeLiveHint');
  } else {
    label = t('tabs.wallpapersTab.photoTile');
    hint = t('tabs.wallpapersTab.photoTileHint');
  }

  const caption = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  let body: ReactNode;
  if (tile.kind === 'theme' && theme) {
    body = (
      <>
        <View style={[StyleSheet.absoluteFill, noMirror]}>
          <WallpaperView params={theme.wallpaper} width={width} height={height} maxGrain={TILE_GRAIN} showArt={!theme.packId} />
          <LockMock width={width} height={height} showGuides={false} />
        </View>
        <View style={[styles.scrim, withHeart ? styles.withHeart : null]}>
          <Text style={[caption, styles.onArt]} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </>
    );
  } else if (tile.kind === 'pair' && theme) {
    body = (
      <View style={[styles.fill, styles.pairBody, { backgroundColor: c.surface }]}>
        <PairArt theme={theme} width={width} lockLabel={t('tabs.wallpapersTab.pairLock')} homeLabel={t('tabs.wallpapersTab.pairHome')} />
        <Text style={[caption, { color: c.ink }, withHeart ? styles.withHeart : null]} numberOfLines={1}>
          {name}
        </Text>
      </View>
    );
  } else {
    const look: { icon: FeatherName; fill: string; ink: string; text: string } =
      tile.kind === 'loop'
        ? { icon: 'play', fill: c.pastels.lilac.fill, ink: c.pastels.lilac.ink, text: name }
        : tile.kind === 'makeLive'
          ? { icon: 'plus', fill: c.surface, ink: c.tint, text: label }
          : { icon: 'camera', fill: c.pastels.sky.fill, ink: c.pastels.sky.ink, text: label };
    body = (
      <View
        style={[
          styles.fill,
          styles.entry,
          { backgroundColor: look.fill },
          tile.kind === 'makeLive' ? [styles.dashed, { borderColor: c.separator }] : null,
        ]}
      >
        <View style={[styles.glyph, { backgroundColor: c.surface }]}>
          <Feather name={look.icon} size={24} color={look.ink} />
        </View>
        <Text style={[caption, styles.center, { color: look.ink }]} numberOfLines={3}>
          {look.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <PressableScale
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        onPress={() => onOpen(tile.href)}
        style={[styles.tile, { width, height, backgroundColor: c.fill }]}
      >
        {body}
        {tile.live ? <LiveBadge label={t('tabs.wallpapersTab.liveBadge')} /> : null}
        {tile.plus ? (
          <View style={[styles.badge, styles.badgeEnd]}>
            <PlusBadge />
          </View>
        ) : null}
      </PressableScale>
      {withHeart && onToggleLike && favId ? (
        <HeartButton
          id={favId}
          name={name}
          liked={liked}
          onToggle={onToggleLike}
          kind="wallpaper"
          onArt={tile.kind === 'theme'}
          style={styles.heart}
        />
      ) : null}
    </View>
  );
}

export const WallpaperTileView = memo(WallpaperTileViewInner);

const styles = StyleSheet.create({
  tile: { borderRadius: radiusV2.card, borderCurve: 'continuous', overflow: 'hidden', minHeight: 48, minWidth: 48 },
  fill: { flex: 1 },
  scrim: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: spaceV2.md, paddingVertical: spaceV2.sm, backgroundColor: 'rgba(0,0,0,0.35)' },
  onArt: { color: '#FFFFFF' },
  /** Room for the heart at the reading end of the name row. */
  withHeart: { paddingEnd: 48 },
  /** Placement only; HeartButton is the ≥ 48 pt target. */
  heart: { position: 'absolute', bottom: 0, end: 0 },
  entry: { alignItems: 'center', justifyContent: 'center', gap: spaceV2.md, padding: spaceV2.md },
  dashed: { borderWidth: 2, borderStyle: 'dashed', borderRadius: radiusV2.card },
  glyph: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  pairBody: { padding: spaceV2.sm, gap: spaceV2.sm, justifyContent: 'center' },
  pairRow: { flexDirection: 'row', gap: PAIR_GAP, justifyContent: 'center' },
  pairHalf: { alignItems: 'center', gap: spaceV2.xxs },
  pairFrame: { borderRadius: radiusV2.control, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  badge: { position: 'absolute', top: spaceV2.sm },
  badgeStart: { start: spaceV2.sm },
  badgeEnd: { end: spaceV2.sm },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.xs,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xxs,
    borderRadius: radiusV2.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4D6D' },
  liveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
