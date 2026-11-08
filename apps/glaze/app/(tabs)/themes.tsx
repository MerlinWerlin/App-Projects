// Themes tab. T253 (owner-1101h #4, docs/OWNER_1101H.md: "Themes front page with categories + All
// themes", fast with 100+ themes): the front page is built from src/core/themeBrowse.ts.
//   Home view: a category chip row (All themes + every non-empty category in the fixed order, More
//   last), then one editorial section per non-empty category (header with "See all" and a
//   horizontal rail of art-led cards, src/ui/GalleryArtCard), then "All themes": every theme as
//   rows of thumbnail cards (src/ui/ThemeThumbCard), scrolled by this one virtualised list.
//   Grid view: a chip, "See all", a search or the Liked filter shows a virtualised thumbnail grid:
//   fixed-height rows of `columns` thumbnails (what FlatList numColumns does) in the SAME list, so
//   the search field in the header keeps focus; getItemLayout over the fixed card geometry and a
//   progressive render window (about one screen of rows per batch).
//   Tapping the selected chip again, or "All categories", goes back to the overview.
// Themes come from the remote catalogue (useRemoteArtThemes, cached with a TTL + ETag, T254) plus
// the bundled starters; each carries a `category` in its data. Listing uses catalogue metadata and
// thumbnail URLs only: a pack downloads when its theme page is opened, never from this tab (T254,
// guarded in src/core/themeBrowse.test.ts). Thumbnails load lazily as cells mount (expo-image).
// While the catalogue's first load runs, a skeleton row in the final shape shows; never an error.
// Kept: search over every theme (name, mood, tags, category), the Liked filter (hearts are
// device-local), pull to refresh, the Live hero, Your look, Make a wallpaper, Send feedback, the
// header "?" and Settings gear. The list only allows the iOS overscroll while it rests at the very
// top (pull to refresh); anywhere else it never bounces (owner 25 Oct), and Android never glows.
// docs/PREMIUM_UI.md §1-2: tokens only, 16 pt rhythm (editorialV2), surfaces not hairlines,
// skeletons not spinners, Dynamic Type caps, ≥ 48 pt targets, virtualised lists (LIST_WINDOW,
// memoised rows, stable keys), no spring or bounce.
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View, FlatList, type LayoutChangeEvent, type ListRenderItem, type TextStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { galleryStarters } from '../../src/core/gallery';
import { isRemoteArtTheme } from '../../src/core/remoteCatalog';
import {
  BROWSE_FILTERS,
  RAIL_WINDOW,
  browseCategoryLabelKey,
  browseChips,
  browseEmptyReason,
  browseFiltering,
  browseGridRows,
  browseGridThemes,
  browseHomeRows,
  browseMode,
  browseThemes,
  gridColumns,
  gridGeometry,
  gridItemLayout,
  gridWindow,
  groupByCategory,
  nextBrowseView,
  railCardWidth,
  railItemLayout,
  type BrowseCategoryId,
  type BrowseChip,
  type BrowseFilter,
  type BrowseRow,
  type BrowseView,
} from '../../src/core/themeBrowse';
import type { Theme } from '../../src/core/themes';
import { useT, type Script } from '../../src/i18n';
import { refreshRemoteCatalog, useRemoteArtThemes, useRemoteCatalogStatus } from '../../src/native/useRemoteCatalog';
import { PlusBadge } from '../../src/plus/PlusBadge';
import { useFavourites } from '../../src/store/favourites';
import { circleRadius, continuous, editorialV2, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { CategoryChipRow } from '../../src/ui/CategoryChipRow';
import { GalleryArtCard, GalleryCardSkeleton } from '../../src/ui/GalleryArtCard';
import { LanguageHintLine } from '../../src/ui/LanguageHintLine';
import { LiveHeroCard } from '../../src/ui/LiveHeroCard';
import { YourLookPanel } from '../../src/ui/YourLookPanel';
import { PressableScale } from '../../src/ui/PressableScale';
import { PillTabs, type PillTabOption } from '../../src/ui/PillTabs';
import { PHONE_ASPECT } from '../../src/ui/ThemeCard';
import { THUMB_LABEL_HEIGHT, ThemeThumbCard } from '../../src/ui/ThemeThumbCard';
import { haptic } from '../../src/ui/haptics';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { BarIconButton, InsetGroup, InsetRow, LargeTitle, LargeTitleHeader, LIST_WINDOW, PillButton, SectionHeader, SquircleCard } from '../../src/ui/v2';
import { withScreenBoundary } from '../../src/ui/ScreenBoundary';

type FeatherName = ComponentProps<typeof Feather>['name'];
type GalleryTheme = Theme & { browseCategory?: BrowseCategoryId };
type Row = BrowseRow<GalleryTheme>;

/** Stable badge element so memoised cards don't re-render for it (a catalogue pack marked Plus). */
const PLUS_BADGE = <PlusBadge />; // i18n-ignore (code after a JSX element)
/** The bundled starters, once (each with its category from themes/<id>/meta.json). */
const STARTERS: readonly GalleryTheme[] = galleryStarters();
/** Panels below the gallery take no props; memoised so a filter change skips them. */
const LiveHeroCardM = memo(LiveHeroCard);
const YourLookPanelM = memo(YourLookPanel);
/** Scroll offset (pt) at or above which the list counts as resting at the top (pull to refresh). */
const TOP_SLOP = 1;

/** JS side of a caught UI-thread error (T228, docs/CRASH_1101.md): log it, never rethrow. */
function reportWorkletError(where: string, message: string): void {
  console.warn(`[Themes] recovered from a UI-thread error in ${where}: ${message}`);
}

/** A v2 type role plus the script's line-height adjustment. */
function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

// T264 (owner-1101i #2): keys never throw on a malformed row / theme (fall back to the index).
const rowKey = (row: Row, index: number): string => (row && typeof row.key === 'string' ? row.key : `row-${index}`);
const themeKey = (theme: GalleryTheme, index: number): string => (theme && typeof theme.id === 'string' ? theme.id : `theme-${index}`);
/** T264: a theme the gallery can draw (a catalogue entry missing its id is skipped, never a crash). */
const drawable = (theme: GalleryTheme | null | undefined): theme is GalleryTheme => !!theme && typeof theme.id === 'string' && theme.id.length > 0;
/** T264: a finite, positive size (a NaN / zero window or layout never reaches the list geometry). */
const finitePos = (n: number, fallback: number): number => (Number.isFinite(n) && n > 0 ? n : fallback);
/** Layout fallback before the window reports a size (a common phone width / height in pt). */
const FALLBACK_W = 390;
const FALLBACK_H = 844;
/** Nothing extra to spread onto the list (the overview keeps LIST_WINDOW). */
const NO_PROPS = Object.freeze({});

/**
 * The bar's trailing actions (reading end). This is the header-right slot: add further bar
 * buttons (e.g. a Settings gear) as siblings here, before or after the Tips "?".
 */
function HeaderActions({ children }: { children?: ReactNode }) {
  return <View style={styles.headerActions}>{children}</View>;
}

/** The props every card shares (one memoised object from the screen). */
type CardShared = {
  /** Art-led rail card width. */
  railWidth: number;
  /** Thumbnail card width and art height (fixed grid geometry). */
  thumbWidth: number;
  thumbArt: number;
  onOpen: (id: string) => void;
  likedIds: ReadonlySet<string>;
  onToggleLike: (id: string) => void;
};

/** One theme card: art-led in a rail, a thumbnail in a grid. A catalogue pack marked Plus shows the badge. */
const BrowseCard = memo(function BrowseCard({ theme, variant, shared }: { theme: GalleryTheme; variant: 'art' | 'thumb'; shared: CardShared }) {
  const { t } = useT();
  const plusNote = t('themes.plusNote');
  const downloadNote = t('themes.collection.downloadA11y');
  const remote = isRemoteArtTheme(theme);
  const plus = remote && theme.plus;
  const { onOpen, likedIds, onToggleLike } = shared;
  if (variant === 'art') {
    return (
      <GalleryArtCard
        theme={theme}
        width={shared.railWidth}
        onOpen={onOpen}
        badge={plus ? PLUS_BADGE : undefined}
        accessibilityNote={plus ? plusNote : remote ? downloadNote : undefined}
        liked={likedIds.has(theme.id)}
        onToggleLike={onToggleLike}
      />
    );
  }
  return (
    <ThemeThumbCard
      theme={theme}
      width={shared.thumbWidth}
      artHeight={shared.thumbArt}
      onOpen={onOpen}
      badge={plus ? PLUS_BADGE : undefined}
      accessibilityNote={plus ? plusNote : remote ? downloadNote : undefined}
      liked={likedIds.has(theme.id)}
      onToggleLike={onToggleLike}
    />
  );
});

/** Header of a home section: the category (or All themes) with its count and a "See all" button. */
const BrowseHead = memo(function BrowseHead({ section, count, onSeeAll }: { section: BrowseCategoryId | 'all'; count: number; onSeeAll: (id: BrowseCategoryId | 'all') => void }) {
  const { t } = useT();
  const label = section === 'all' ? t('themes.browse.allThemes') : t(browseCategoryLabelKey(section));
  return (
    <View style={styles.headRow}>
      <SectionHeader
        eyebrow={t('themes.browse.count', { count })}
        title={label}
        body={section === 'all' ? t('themes.browse.allThemesBody') : undefined}
        style={styles.headText}
      />
      {section === 'all' ? null : (
        <PillButton
          label={t('themes.browse.seeAll')}
          size="small"
          variant="plain"
          onPress={() => onSeeAll(section)}
          accessibilityLabel={t('themes.browse.seeAllA11y', { label })}
          style={styles.seeAll}
        />
      )}
    </View>
  );
});

/** One category's horizontal rail of art-led cards (fixed card width, so getItemLayout is exact). */
const CategoryRail = memo(function CategoryRail({ themes, shared }: { themes: readonly GalleryTheme[]; shared: CardShared }) {
  const gap = editorialV2.cardGap;
  const railData = useMemo(() => (themes ?? []).filter(drawable), [themes]);
  const renderItem: ListRenderItem<GalleryTheme> = useCallback(
    ({ item }) => (
      !drawable(item) ? null :
      <View style={styles.railItem}>
        <BrowseCard theme={item} variant="art" shared={shared} />
      </View>
    ),
    [shared],
  );
  const getItemLayout = useCallback((_: ArrayLike<GalleryTheme> | null | undefined, index: number) => railItemLayout(shared.railWidth, gap, index), [shared.railWidth, gap]);
  return (
    <FlatList
      data={railData}
      renderItem={renderItem}
      keyExtractor={themeKey}
      getItemLayout={getItemLayout}
      {...RAIL_WINDOW}
      horizontal
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    />
  );
});

/** One row of thumbnail cards in the home view's All themes section (memoised list row). */
const GalleryCardRow = memo(function GalleryCardRow({ themes, shared }: { themes: readonly GalleryTheme[]; shared: CardShared }) {
  return (
    <View style={styles.cardRow}>
      {(themes ?? []).filter(drawable).map((theme) => (
        <BrowseCard key={theme.id} theme={theme} variant="thumb" shared={shared} />
      ))}
    </View>
  );
});

/** While the catalogue's first load runs: cards in their final shape, a calm pulse, no error. */
const SkeletonCardRow = memo(function SkeletonCardRow({ count, cardWidth }: { count: number; cardWidth: number }) {
  const { t } = useT();
  return (
    <View style={styles.cardRow} accessible accessibilityLabel={t('themes.collection.loadingA11y')}>
      {Array.from({ length: count }, (_, i) => (
        <GalleryCardSkeleton key={i} width={cardWidth} />
      ))}
    </View>
  );
});

/** Pastel circle with a glyph, used by the empty states. */
function EmptyIcon({ icon }: { icon: FeatherName }) {
  const { c } = useColorsV2();
  return (
    <View style={[styles.emptyIcon, { backgroundColor: c.pastels.berry.fill }]}>
      <Feather name={icon} size={24} color={c.pastels.berry.ink} />
    </View>
  );
}

/** Search field over every theme's name, mood, tags and category (a pill on `fill`). */
function SearchField({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  return (
    <View style={[styles.search, continuous, { backgroundColor: c.fill }]}>
      <Feather name="search" size={18} color={c.inkSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t('themes.search.placeholder')}
        placeholderTextColor={c.inkSecondary}
        accessibilityLabel={t('themes.search.a11y')}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        selectionColor={c.tint}
        maxFontSizeMultiplier={fontScaleCap('body')}
        style={[...typeFor(script, 'body'), styles.searchInput, { color: c.ink }]}
      />
      {value.length > 0 ? (
        <PressableScale
          onPress={() => onChange('')}
          haptic="select"
          pressedScale={0.9}
          accessibilityRole="button"
          accessibilityLabel={t('themes.search.clear')}
          style={styles.barIcon}
        >
          <Feather name="x-circle" size={18} color={c.inkSecondary} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** A filter with nothing in it: no search match, or nothing liked yet; one tap back to everything. */
const GalleryEmpty = memo(function GalleryEmpty({ reason, onReset }: { reason: 'noMatches' | 'noLiked'; onReset: () => void }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const liked = reason === 'noLiked';
  const title = liked ? t('themes.discover.likedEmpty') : t('themes.search.empty.title');
  const body = liked ? t('themes.discover.likedEmptyBody') : t('themes.search.empty.body');
  return (
    <View style={styles.emptyRow}>
      <SquircleCard accessibilityLabel={[title, body].join(' ')}>
        <View style={styles.empty}>
          <EmptyIcon icon={liked ? 'heart' : 'search'} />
          <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[...typeFor(script, 'headline'), styles.center, { color: c.ink }]}>{title}</Text>
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), styles.center, { color: c.inkSecondary }]}>{body}</Text>
          {/* Release standard §1: an empty filtered list offers a one-tap way back to everything. */}
          <PillButton label={liked ? t('common.showAll') : t('themes.search.empty.reset')} variant="plain" onPress={onReset} style={styles.selfCenter} />
        </View>
      </SquircleCard>
    </View>
  );
});

function ThemesScreen() {
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const width = finitePos(win.width, FALLBACK_W);
  const height = finitePos(win.height, FALLBACK_H);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BrowseFilter>('all');
  const [view, setView] = useState<BrowseView>('home');
  const { liked, toggle: toggleLike } = useFavourites();
  const likedIds = useMemo(() => new Set(liked), [liked]);
  const filtering = browseFiltering(query, filter);
  const mode = browseMode(view, query, filter);

  // The remote catalogue (cached at once, refreshed in the background) plus the bundled starters.
  const remote = useRemoteArtThemes();
  const status = useRemoteCatalogStatus();
  const themes: readonly GalleryTheme[] = useMemo(() => {
    // T264: a malformed catalogue entry (no id) is dropped; a throw falls back to the bundled starters.
    try {
      return browseThemes<GalleryTheme, GalleryTheme>((remote ?? []).filter(drawable), STARTERS).filter(drawable);
    } catch {
      return STARTERS;
    }
  }, [remote]);
  const sections = useMemo(() => groupByCategory(themes), [themes]);
  const chips = useMemo(() => browseChips(sections, themes.length), [sections, themes.length]);
  const waiting = status === 'loading' && remote.length === 0;

  // Fixed card geometry: rails show ~2.3 art cards, the grid 3 thumbnails per row on phones.
  const columns = gridColumns(width);
  const geo = useMemo(
    () => gridGeometry({ width, columns, gutter: spaceV2.lg, gap: editorialV2.cardGap, aspect: PHONE_ASPECT, labelHeight: THUMB_LABEL_HEIGHT }),
    [width, columns],
  );
  const railWidth = finitePos(railCardWidth(width, spaceV2.lg, editorialV2.cardGap), sizeV2.touch);
  const gridWin = useMemo(
    () => ({ ...gridWindow(height, geo.rowHeight), removeClippedSubviews: LIST_WINDOW.removeClippedSubviews, updateCellsBatchingPeriod: LIST_WINDOW.updateCellsBatchingPeriod }),
    [height, geo.rowHeight],
  );

  const gridThemes: readonly GalleryTheme[] = useMemo(
    () => (mode === 'grid' ? browseGridThemes<GalleryTheme>({ themes, view, query, filter, liked }) : []),
    [mode, themes, view, query, filter, liked],
  );
  // One list for both views (so the search field in its header keeps focus while the view changes):
  // the overview's rows, or the grid as fixed-height rows of `columns` thumbnails.
  const rows: readonly Row[] = useMemo(
    () => (mode === 'home' ? browseHomeRows<GalleryTheme>({ themes, columns, waiting }) : browseGridRows<GalleryTheme>(gridThemes, columns)),
    [mode, themes, columns, waiting, gridThemes],
  );

  const onOpen = useCallback(
    (id: string) => {
      if (typeof id !== 'string' || id.length === 0) return;
      try {
        router.push(`/theme/${id}`);
      } catch (e) {
        console.warn('[Themes] could not open a theme', e);
      }
    },
    [router],
  );
  const resetFilters = useCallback(() => {
    haptic('select');
    setQuery('');
    setFilter('all');
    setView('home');
  }, []);
  const shared: CardShared = useMemo(
    () => ({ railWidth, thumbWidth: geo.cardWidth, thumbArt: geo.artHeight, onOpen, likedIds, onToggleLike: toggleLike }),
    [railWidth, geo.cardWidth, geo.artHeight, onOpen, likedIds, toggleLike],
  );

  // Scroll position lives in a shared value written on the UI thread; the large title and glass bar
  // read it to collapse. `atTop` only flips when the list crosses the top, so it rarely re-renders.
  const scrollY = useSharedValue(0);
  const topFlag = useSharedValue(1);
  const [atTop, setAtTop] = useState(true);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      // T228 (docs/CRASH_1101.md): a UI-thread error is caught and logged, never rethrown.
      try {
        scrollY.value = Number.isFinite(e.contentOffset.y) ? e.contentOffset.y : 0;
        const top = e.contentOffset.y <= TOP_SLOP ? 1 : 0;
        if (top !== topFlag.value) {
          topFlag.value = top;
          runOnJS(setAtTop)(top === 1);
        }
      } catch (err) {
        runOnJS(reportWorkletError)('themes.onScroll', String(err));
      }
    },
  });

  // A chip or See all opens its grid at the top (the title and pull to refresh follow the scroll).
  const listRef = useRef<FlatList<Row> | null>(null);
  useEffect(() => {
    try {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch {
      // No list yet (first render): it starts at the top anyway.
    }
  }, [view]);

  const pickChip = useCallback((id: BrowseChip['id']) => {
    setView((v) => nextBrowseView(v, id));
  }, []);
  const seeAll = useCallback((id: BrowseCategoryId | 'all') => {
    haptic('select');
    setView(id);
  }, []);

  const renderRow: ListRenderItem<Row> = useCallback(
    ({ item }) => {
      if (!item) return null; // T264: a hole in the rows draws nothing
      if (item.kind === 'head') return <BrowseHead section={item.section} count={item.count} onSeeAll={seeAll} />; // i18n-ignore (code after a JSX element)
      if (item.kind === 'rail') return <CategoryRail themes={item.themes} shared={shared} />; // i18n-ignore (code after a JSX element)
      if (item.kind === 'skeleton') return <SkeletonCardRow count={Math.min(item.count, columns)} cardWidth={geo.cardWidth} />; // i18n-ignore (code after a JSX element)
      return <GalleryCardRow themes={item.themes} shared={shared} />; // i18n-ignore (code after a JSX element)
    },
    [seeAll, shared, columns, geo.cardWidth],
  );

  // Where the grid's first row starts: the content inset above the header plus the header's
  // measured height (cell offsets are content-relative), so getItemLayout matches the real rows.
  const [headerH, setHeaderH] = useState(0);
  const listTop = insets.top + sizeV2.navBar + headerH;
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e?.nativeEvent?.layout?.height ?? 0);
    if (!Number.isFinite(h) || h < 0) return;
    setHeaderH((old) => (old === h ? old : h));
  }, []);
  const getGridLayout = useCallback(
    (_: ArrayLike<Row> | null | undefined, index: number) => gridItemLayout(geo.rowHeight, listTop, index),
    [geo.rowHeight, listTop],
  );

  // Pull to refresh: fetch catalog.json now. Never rejects; a 404 or offline keeps what is shown.
  const [refreshing, setRefreshing] = useState(false);
  // T264: no setState after the tab unmounted (a refresh that outlives the screen), no unhandled rejection.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const done = () => {
      if (mounted.current) setRefreshing(false);
    };
    try {
      refreshRemoteCatalog().then(done, done).catch(() => undefined);
    } catch {
      done();
    }
  }, []);

  const filterOptions: PillTabOption<BrowseFilter>[] = useMemo(
    () => BROWSE_FILTERS.map((id) => ({ value: id, label: t(`themes.discover.${id}`) })),
    [t],
  );
  const title = t('tabs.themes');
  const gridTitle = view === 'home' ? null : view === 'all' ? t('themes.browse.allThemes') : t(browseCategoryLabelKey(view));
  const matchCount = gridThemes.length;

  const listHeader = useMemo(
    () => (
      <View onLayout={onHeaderLayout}>
        <LargeTitle title={title} subtitle={t('themes.subtitle')} scrollY={scrollY} />
        <View style={styles.inner}>
          {/* Release standard §1: "Language: English · Change", first session only, until tapped. */}
          <LanguageHintLine />
          {/* All / Liked as content-sized pills (never clipped). */}
          <PillTabs label={t('themes.discover.label')} options={filterOptions} value={filter} onChange={setFilter} />
          {/* Search covers every theme (name, mood, tags, category). */}
          <SearchField value={query} onChange={setQuery} />
          {/* T253: All themes + every non-empty category; the selected chip again goes back. */}
          <CategoryChipRow chips={chips} view={view} onPick={pickChip} />
          {filtering && matchCount > 0 ? (
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]} accessibilityLiveRegion="polite">
              {t('themes.search.results', { count: matchCount })}
            </Text>
          ) : null}
        </View>
        {gridTitle ? (
          <View style={styles.headRow}>
            <SectionHeader eyebrow={t('themes.browse.count', { count: matchCount })} title={gridTitle} style={styles.headText} />
            <PillButton
              label={t('themes.browse.backHome')}
              size="small"
              variant="plain"
              icon="grid"
              onPress={resetFilters}
              accessibilityHint={t('themes.browse.backHomeHint')}
              style={styles.seeAll}
            />
          </View>
        ) : (
          <View style={styles.gridTop} />
        )}
      </View>
    ),
    [onHeaderLayout, title, t, scrollY, filterOptions, filter, query, chips, view, pickChip, filtering, matchCount, script, c.inkSecondary, gridTitle, resetFilters],
  );

  const listFooter = useMemo(
    () => (
      <View style={styles.footer}>
        {/* Below the gallery: Live Lock Screen, the applied look, make a wallpaper. */}
        {filtering ? null : (
          <>
            <LiveHeroCardM />
            {/* T26: "Your look" panel (applied theme: preview, background, overrides, missing apps). */}
            <YourLookPanelM />
            <InsetGroup style={styles.flush}>
              <InsetRow
                title={t('themes.makeWallpaper.title')}
                subtitle={t('themes.makeWallpaper.body')}
                icon="image"
                iconTone="sky"
                onPress={() => router.push('/wallpaper')}
                accessibilityLabel={t('themes.makeWallpaper.title')}
                accessibilityHint={t('themes.makeWallpaper.hint')}
              />
            </InsetGroup>
          </>
        )}
        {/* T23: small feedback entry, opens /feedback with "Theme request" preselected. */}
        <PillButton
          label={t('themes.feedback')}
          icon="mail"
          variant="plain"
          onPress={() => router.push('/feedback?type=theme')}
          accessibilityHint={t('themes.feedbackHint')}
        />
      </View> // i18n-ignore (code after a JSX element)
    ),
    [filtering, t, router],
  );

  const gridEmpty = useMemo(() => <GalleryEmpty reason={browseEmptyReason(query, filter)} onReset={resetFilters} />, [query, filter, resetFilters]); // i18n-ignore (code after a JSX element)

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Animated.FlatList
        ref={listRef}
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        {...LIST_WINDOW}
        {...(mode === 'grid' ? gridWin : NO_PROPS)}
        getItemLayout={mode === 'grid' ? getGridLayout : undefined}
        bounces={atTop}
        overScrollMode="never"
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sizeV2.navBar }]}
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={mode === 'grid' ? gridEmpty : null}
        ListFooterComponent={listFooter}
      />
      {/* Header-right slot: more bar actions go inside HeaderActions next to the Tips "?". */}
      <LargeTitleHeader
        title={title}
        scrollY={scrollY}
        trailing={
          <HeaderActions>
            <BarIconButton icon="help-circle" accessibilityLabel={t('themes.tipsA11y')} onPress={() => router.push('/tips')} />
            {/* T70: Settings left the tab bar; this gear is its way in. */}
            <BarIconButton icon="settings" accessibilityLabel={t('tabs.settings')} onPress={() => router.push('/settings')} />
          </HeaderActions>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: spaceV2.xxxl },
  inner: { paddingHorizontal: spaceV2.lg, paddingTop: spaceV2.md, gap: spaceV2.lg },
  // List rows below the header carry the side gutter themselves; SectionHeader brings the editorial
  // 32 above a section and 12 below its title; card rows keep the 16-pt rhythm.
  headRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spaceV2.lg, gap: spaceV2.sm },
  headText: { flex: 1 },
  seeAll: { marginBottom: spaceV2.xs },
  rail: { paddingHorizontal: spaceV2.lg, paddingBottom: editorialV2.cardGap },
  railItem: { paddingEnd: editorialV2.cardGap },
  // Thumbnail rows: fixed height (card + gap), so the grid's getItemLayout is exact.
  cardRow: { flexDirection: 'row', gap: editorialV2.cardGap, paddingHorizontal: spaceV2.lg, marginBottom: editorialV2.cardGap },
  gridTop: { height: editorialV2.sectionBottom },
  emptyRow: { paddingHorizontal: spaceV2.lg, paddingTop: editorialV2.sectionTop },
  footer: { paddingHorizontal: spaceV2.lg, paddingTop: editorialV2.sectionTop, gap: spaceV2.lg },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  barIcon: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  selfCenter: { alignSelf: 'center' },
  flush: { marginHorizontal: 0 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.sm,
    minHeight: sizeV2.touch,
    paddingStart: spaceV2.lg,
    paddingEnd: spaceV2.xs,
    borderRadius: radiusV2.pill,
  },
  searchInput: { flex: 1, minHeight: sizeV2.touch, paddingVertical: spaceV2.sm },
  empty: { alignItems: 'center', gap: spaceV2.sm },
  emptyIcon: { width: 48, height: 48, borderRadius: circleRadius(48), alignItems: 'center', justifyContent: 'center' },
});

// T264 (owner-1101i #2): this screen fails on its own: a calm card + Retry, never a closed app.
export default withScreenBoundary(ThemesScreen, 'themes');
