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
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { pageTransition } from '../../src/core/categoryPaging';
import { keepIfSame, reuseEqual, sameJson } from '../../src/core/perfCache';
import { TILE_REVEAL_BATCH, TILE_REVEAL_FIRST, isMounted, keptAcrossSwap, revealStep } from '../../src/core/perfReveal';
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
import { LargeTitleScrollView, PillButton } from '../../src/ui/v2';

const GAP = spaceV2.md;
const THEME_BY_ID: ReadonlyMap<string, Theme> = new Map(ALL_THEMES.map((th) => [th.id, th]));
const NO_KEPT: ReadonlySet<string> = new Set<string>();
const tileKey = (x: WallpaperTile): string => x.id;
const sameTile = (a: WallpaperTile, b: WallpaperTile): boolean =>
  a.kind === b.kind && a.themeId === b.themeId && a.loopId === b.loopId && a.live === b.live && a.plus === b.plus && a.href === b.href;

type TileGridProps = {
  /** The tiles on show (already cut to the visible count). */
  tiles: readonly WallpaperTile[];
  tileWidth: number;
  tileHeight: number;
  loopById: ReadonlyMap<string, LoopProject>;
  likedIds: ReadonlySet<string>;
  onToggleLike: (id: string) => void;
  onOpen: (href: string) => void;
  fade: SharedValue<number>;
};

/** T118: the tile grid, memoised, mounting new tiles progressively (placeholders hold their place). */
const TileGrid = memo(function TileGrid({ tiles, tileWidth, tileHeight, loopById, likedIds, onToggleLike, onOpen, fade }: TileGridProps) {
  const { c } = useColorsV2();
  const gridFade = useAnimatedStyle(() => ({ opacity: fade.value }));
  const ids = useMemo(() => tiles.map(tileKey), [tiles]);
  const idsKey = ids.join('|');
  const [revealed, setRevealed] = useState(() => Math.min(tiles.length, TILE_REVEAL_FIRST));
  const [kept, setKept] = useState<ReadonlySet<string>>(NO_KEPT);
  const [shown, setShown] = useState<{ key: string; ids: readonly string[] }>({ key: idsKey, ids });
  if (shown.key !== idsKey) {
    // Render-phase reset: tiles mounted before stay mounted, new ones are revealed per frame.
    setKept(keptAcrossSwap(shown.ids, revealed, kept, ids));
    setShown({ key: idsKey, ids });
    setRevealed(Math.min(tiles.length, TILE_REVEAL_FIRST));
  }
  useEffect(() => {
    if (revealed >= tiles.length) return;
    const raf = requestAnimationFrame(() => setRevealed((n) => revealStep(n, tiles.length, TILE_REVEAL_BATCH)));
    return () => cancelAnimationFrame(raf);
  }, [revealed, tiles.length]);
  const index = useMemo(() => new Map(ids.map((id, i) => [id, i])), [ids]);
  const rows = useMemo(() => tileRows(tiles), [tiles]);
  const placeholder = [styles.placeholder, { width: tileWidth, height: tileHeight, backgroundColor: c.fill }];

  return (
    <Animated.View style={[styles.grid, gridFade]}>
      {rows.map((row) => (
        <View key={row.map((r) => r.id).join('|')} style={styles.row}>
          {row.map((tile) =>
            isMounted(index.get(tile.id) ?? 0, revealed, kept, tile.id) ? (
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
            ) : (
              <View key={tile.id} style={placeholder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            ),
          )}
        </View>
      ))}
    </Animated.View>
  );
});

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

  return (
    <LargeTitleScrollView title={t('tabs.wallpapers')} subtitle={t('tabs.wallpapersTab.subtitle')}>
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
        {liveEmpty ? (
          <Text style={[textV2.footnote, textStyleFor(script, textV2.footnote), { color: c.inkSecondary }]}>
            {t('tabs.wallpapersTab.liveEmpty')}
          </Text>
        ) : null}
        <TileGrid
          tiles={visible}
          tileWidth={tileWidth}
          tileHeight={tileHeight}
          loopById={loopById}
          likedIds={likedIds}
          onToggleLike={toggleLike}
          onOpen={onOpen}
          fade={fade}
        />
        {shown < tiles.length ? (
          <PillButton label={t('tabs.wallpapersTab.showMore')} variant="tinted" icon="chevron-down" onPress={showMore} />
        ) : null}
      </View>
    </LargeTitleScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spaceV2.lg, gap: spaceV2.lg, paddingBottom: spaceV2.xl },
  grid: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  /** Same footprint and fill as a tile while it mounts. */
  placeholder: { borderRadius: radiusV2.card, borderCurve: 'continuous' },
});
