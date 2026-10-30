// Wallpapers tab (T70 entry, T71 grid; docs/MARKET.md "Owner screenshots 18 Oct" L5).
// Sub-tabs Still / Live / Pairs over a 2-column grid of tall rounded tiles. The tile list and
// grid maths live in src/core/wallpaperTiles.ts (tested); this screen only draws them.
// Tiles open the existing screens: /wallpaper (theme or photo), /theme/<id> for Plus themes,
// /live/<id> for a saved loop and /live to make one. The LIVE badge is on saved loops only.
// T77 (shots-1018 L6): a second row, All / New / Our picks / Liked (the Themes tab's labels and
// picks, core/discovery.ts), narrows Still and Pairs; Live lists the person's own loops and hides
// it. Hearts on theme and pair tiles like a wallpaper on this device only. No counts or ranks.
// T118 (fb-1024 B, owner 24 Oct: "a little laggy moving around the UI"): coming back to the tab
// reloads the saved loops but keeps the old list when nothing changed (no whole-screen re-render on
// focus); tiles keep their identity when unchanged (memoised tiles skip); the grid is its own
// memoised component; after a change the first two rows mount at once and the rest a row per frame
// behind same-sized placeholders, with tiles already on screen kept mounted (core/perfReveal).
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { pageTransition } from '../../src/core/categoryPaging';
import { keepIfSame, reuseEqual, sameJson } from '../../src/core/perfCache';
import { easeOutCurve } from '../../src/theme/motion';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { DISCOVERY_TABS, discoveryTabKey, type DiscoveryTab } from '../../src/core/discovery';
import { ALL_THEMES } from '../../src/core/plusThemes';
import type { Theme } from '../../src/core/themes';
import type { LoopProject } from '../../src/core/loop';
import {
  WALLPAPER_SUB_TABS,
  discoverWallpaperTiles,
  discoveryApplies,
  gridTileSize,
  tileRows,
  visibleTileCount,
  wallpaperSubTabKey,
  type WallpaperSubTab,
  type WallpaperTile,
} from '../../src/core/wallpaperTiles';
import { useT } from '../../src/i18n';
import { useWallpaperFavourites } from '../../src/store/favourites';
import { loadLoops } from '../../src/store/loops';
import { radiusV2, spaceV2, textV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { Segmented, type SegmentedOption } from '../../src/ui/Segmented';
import { WallpaperTileView } from '../../src/ui/WallpaperTile';
import { LargeTitleFlatList, PillButton } from '../../src/ui/v2';

const GAP = spaceV2.md;
const THEME_BY_ID: ReadonlyMap<string, Theme> = new Map(ALL_THEMES.map((th) => [th.id, th]));
const tileKey = (x: WallpaperTile): string => x.id;
const sameTile = (a: WallpaperTile, b: WallpaperTile): boolean =>
  a.kind === b.kind && a.themeId === b.themeId && a.loopId === b.loopId && a.live === b.live && a.plus === b.plus && a.href === b.href;

type TileRowProps = {
  /** One grid row (two tiles). */
  row: readonly WallpaperTile[];
  tileWidth: number;
  tileHeight: number;
  loopById: ReadonlyMap<string, LoopProject>;
  likedIds: ReadonlySet<string>;
  onToggleLike: (id: string) => void;
  onOpen: (href: string) => void;
  fade: SharedValue<number>;
};

/**
 * T162 (owner 30 Oct C): one row of the virtualised tile grid (memoised). The list mounts rows as
 * they scroll in, which replaces T118's per-frame reveal; the fb-1023 fade is per row, UI thread.
 */
const TileRow = memo(function TileRow({ row, tileWidth, tileHeight, loopById, likedIds, onToggleLike, onOpen, fade }: TileRowProps) {
  const rowFade = useAnimatedStyle(() => ({ opacity: fade.value }));
  return (
    <Animated.View style={[styles.row, rowFade]}>
      {row.map((tile) => (
        <WallpaperTileView
          key={tile.id}
          tile={tile}
          theme={tile.themeId ? THEME_BY_ID.get(tile.themeId) : undefined}
          loopName={tile.loopId ? loopById.get(tile.loopId)?.name : undefined}
          width={tileWidth}
          height={tileHeight}
          onOpen={onOpen}
          liked={tile.themeId ? likedIds.has(tile.themeId) : false}
          onToggleLike={onToggleLike}
        />
      ))}
    </Animated.View>
  );
});

const rowKey = (row: readonly WallpaperTile[]): string => row.map(tileKey).join('|');

export default function WallpapersTab() {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<WallpaperSubTab>('still');
  const [pages, setPages] = useState(0);
  const [loops, setLoops] = useState<LoopProject[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryTab>('all');
  const { liked, toggle: toggleLike } = useWallpaperFavourites();
  const likedIds = useMemo(() => new Set(liked), [liked]);
  const today = useMemo(() => new Date(), []);

  // Reload saved loops whenever the tab comes into focus (they are made on the Live tab).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadLoops().then((s) => {
        // T118: nothing new since the last visit keeps the same list (no re-render on focus).
        if (alive) setLoops((prev) => keepIfSame(prev, s.projects, sameJson));
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const loopById = useMemo(() => new Map(loops.map((l) => [l.id, l])), [loops]);
  // T118: a tile equal to the one before keeps its object, so its memoised view skips the render.
  const lastTiles = useRef<readonly WallpaperTile[]>([]);
  const tiles = useMemo(() => {
    const next = reuseEqual(lastTiles.current, discoverWallpaperTiles(tab, discovery, { themes: ALL_THEMES, loops, today, liked }), tileKey, sameTile);
    lastTiles.current = next;
    return next;
  }, [tab, discovery, loops, today, liked]);
  const shown = visibleTileCount(tiles.length, pages);
  const visible = useMemo(() => tiles.slice(0, shown), [tiles, shown]);
  const { tileWidth, tileHeight } = gridTileSize(width - spaceV2.lg * 2, GAP);

  const options: SegmentedOption<WallpaperSubTab>[] = useMemo(
    () => WALLPAPER_SUB_TABS.map((id) => ({ value: id, label: t(wallpaperSubTabKey(id)) })),
    [t],
  );
  const onTab = useCallback((next: WallpaperSubTab) => {
    setTab(next);
    setPages(0);
  }, []);
  const discoveryOptions: SegmentedOption<DiscoveryTab>[] = useMemo(
    () => DISCOVERY_TABS.map((id) => ({ value: id, label: t(discoveryTabKey(id)) })),
    [t],
  );
  const onDiscovery = useCallback((next: DiscoveryTab) => {
    setDiscovery(next);
    setPages(0);
  }, []);
  const onOpen = useCallback((href: string) => router.push(href), [router]);
  const showMore = useCallback(() => setPages((p) => p + 1), []);

  // fb-1023: switching sub-tab or All/New/Picks/Liked fades the tiles in (opacity only, the calm fb-1022c rule).
  const fade = useSharedValue(1);
  const lastKey = useRef(`${tab}|${discovery}`);
  useEffect(() => {
    const key = `${tab}|${discovery}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const tr = pageTransition(0, 1);
    if (tr.kind === 'none') return;
    fade.value = tr.fromOpacity;
    fade.value = withTiming(1, { duration: tr.durationMs, easing: easeOutCurve });
  }, [tab, discovery, fade]);

  const liveEmpty = tab === 'live' && loops.length === 0;
  const discovering = discoveryApplies(tab);
  const footnote = [textV2.footnote, textStyleFor(script, textV2.footnote), { color: c.inkSecondary }];
  // T77: what an empty New / Liked list says (Still and Pairs only; All always has tiles).
  let discoveryEmpty: string | null = null;
  if (discovering && tiles.length === 0 && discovery === 'liked') {
    discoveryEmpty = `${t('tabs.wallpapersTab.discover.likedEmpty')} ${t('tabs.wallpapersTab.discover.likedEmptyBody')}`;
  } else if (discovering && tiles.length === 0 && discovery === 'new') {
    discoveryEmpty = t('tabs.wallpapersTab.discover.newEmpty');
  }

  // T162: the tiles are a virtualised list of rows; the controls above them are the list header.
  const rows = useMemo(() => tileRows(visible), [visible]);
  const renderRow: ListRenderItem<readonly WallpaperTile[]> = useCallback(
    ({ item }) => (
      <TileRow
        row={item}
        tileWidth={tileWidth}
        tileHeight={tileHeight}
        loopById={loopById}
        likedIds={likedIds}
        onToggleLike={toggleLike}
        onOpen={onOpen}
        fade={fade}
      />), // i18n-ignore (code after a JSX element)
    [tileWidth, tileHeight, loopById, likedIds, toggleLike, onOpen, fade],
  );
  const onShowAll = useCallback(() => onDiscovery('all'), [onDiscovery]);

  const header = (
    <View style={styles.body}>
      <Segmented label={t('tabs.wallpapersTab.subTabs')} options={options} value={tab} onChange={onTab} />
      {discovering ? (
        <Segmented grid label={t('tabs.wallpapersTab.discover.label')} options={discoveryOptions} value={discovery} onChange={onDiscovery} />
      ) : null}
      {discovering && discovery === 'picks' ? <Text style={footnote}>{t('themes.discover.picksNote')}</Text> : null}
      {discoveryEmpty ? (
        <Text style={footnote} accessibilityLiveRegion="polite">
          {discoveryEmpty}
        </Text>
      ) : null}
      {/* Release standard §1: an empty filtered list offers a one-tap way back to everything. */}
      {discoveryEmpty ? <PillButton label={t('common.showAll')} variant="plain" onPress={onShowAll} /> : null}
      {tab === 'still' ? (
        // T76: the photo-collage maker (2..6 of the person's photos on one Lock Screen).
        <PillButton
          label={t('wallpaper.collage.entry')}
          variant="tinted"
          icon="grid"
          block
          accessibilityHint={t('wallpaper.collage.entryHint')}
          onPress={() => router.push('/collage')}
        />
      ) : null}
      {liveEmpty ? <Text style={footnote}>{t('tabs.wallpapersTab.liveEmpty')}</Text> : null}
    </View>); // i18n-ignore (code after a JSX element)
  const footer =
    shown < tiles.length ? (
      <View style={styles.footer}>
        <PillButton label={t('tabs.wallpapersTab.showMore')} variant="tinted" icon="chevron-down" onPress={showMore} />
      </View>) : null; // i18n-ignore (code after a JSX element)

  return (
    <LargeTitleFlatList
      title={t('tabs.wallpapers')}
      subtitle={t('tabs.wallpapersTab.subtitle')}
      header={header}
      data={rows}
      renderItem={renderRow}
      keyExtractor={rowKey}
      footer={footer}
    />
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spaceV2.lg, gap: spaceV2.lg },
  // T162: each row is a list item, so it carries the side gutter and the gap below it.
  row: { flexDirection: 'row', gap: GAP, paddingHorizontal: spaceV2.lg, marginBottom: GAP },
  footer: { paddingHorizontal: spaceV2.lg, paddingTop: spaceV2.sm, paddingBottom: spaceV2.xl },
});
