// Wallpapers tab (T70 entry, T71 grid; docs/MARKET.md "Owner screenshots 18 Oct" L5).
// Sub-tabs Still / Live / Pairs over a 2-column grid of tall rounded tiles. The tile list and
// grid maths live in src/core/wallpaperTiles.ts (tested); this screen only draws them.
// Tiles open the existing screens: /wallpaper (theme or photo), /theme/<id> for Plus themes,
// /live/<id> for a saved loop and /live to make one. The LIVE badge is on saved loops only.
// T77 (shots-1018 L6): a second row, All / New / Our picks / Liked (the Themes tab's labels and
// picks, core/discovery.ts), narrows Still and Pairs; Live lists the person's own loops and hides
// it. Hearts on theme and pair tiles like a wallpaper on this device only. No counts or ranks.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { spaceV2, textV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { Segmented, type SegmentedOption } from '../../src/ui/Segmented';
import { WallpaperTileView } from '../../src/ui/WallpaperTile';
import { LargeTitleScrollView, PillButton } from '../../src/ui/v2';

const GAP = spaceV2.md;
const THEME_BY_ID: ReadonlyMap<string, Theme> = new Map(ALL_THEMES.map((th) => [th.id, th]));

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
        if (alive) setLoops(s.projects);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const loopById = useMemo(() => new Map(loops.map((l) => [l.id, l])), [loops]);
  const tiles = useMemo(
    () => discoverWallpaperTiles(tab, discovery, { themes: ALL_THEMES, loops, today, liked }),
    [tab, discovery, loops, today, liked],
  );
  const shown = visibleTileCount(tiles.length, pages);
  const rows = useMemo(() => tileRows(tiles.slice(0, shown)), [tiles, shown]);
  const { tileWidth, tileHeight } = gridTileSize(width - spaceV2.lg * 2, GAP);

  const options: SegmentedOption<WallpaperSubTab>[] = WALLPAPER_SUB_TABS.map((id) => ({ value: id, label: t(wallpaperSubTabKey(id)) }));
  const onTab = useCallback((next: WallpaperSubTab) => {
    setTab(next);
    setPages(0);
  }, []);
  const discoveryOptions: SegmentedOption<DiscoveryTab>[] = DISCOVERY_TABS.map((id) => ({ value: id, label: t(discoveryTabKey(id)) }));
  const onDiscovery = useCallback((next: DiscoveryTab) => {
    setDiscovery(next);
    setPages(0);
  }, []);
  const onOpen = useCallback((href: string) => router.push(href), [router]);

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
          <Segmented label={t('tabs.wallpapersTab.discover.label')} options={discoveryOptions} value={discovery} onChange={onDiscovery} />
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
        <View style={styles.grid}>
          {rows.map((row) => (
            <View key={row.map((r) => r.id).join('|')} style={styles.row}>
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
                  onToggleLike={toggleLike}
                />
              ))}
            </View>
          ))}
        </View>
        {shown < tiles.length ? (
          <PillButton label={t('tabs.wallpapersTab.showMore')} variant="tinted" icon="chevron-down" onPress={() => setPages((p) => p + 1)} />
        ) : null}
      </View>
    </LargeTitleScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spaceV2.lg, gap: spaceV2.lg, paddingBottom: spaceV2.xl },
  grid: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
});
