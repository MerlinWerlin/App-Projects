// Themes tab. T177 (owner brief 31 Oct, docs/OWNER_1031.md: "it has all of the old themes which need
// to go ... none of the new themes from GitHub"): the gallery is rebuilt around the remote
// catalogue. Two editorial sections, composed in src/core/gallery.ts:
//   1. "New collection": every theme in the catalogue (useRemoteArtThemes), data-driven, so a later
//      batch of packs appears with no app change. Art-led large cards (src/ui/GalleryArtCard): the
//      catalogue thumbnail through expo-image with its ThumbHash placeholder, the name, the mood line.
//      While the catalogue is still empty (first launch, offline, a 404) the section shows calm
//      skeleton cards in the final shape, never an error.
//   2. "Starters": the three bundled art packs (Deep Sea, Starry Night, Sunset Dunes).
// Gone from the gallery: the old starter showcase, the themesNew / themesStoryPlay lists, Space, the
// Plus packs, the seasonal collections banner, the story chips, the category bubbles and the
// New / Our picks sub-tabs. Their data modules stay, so a theme someone already applied still
// resolves by id (getAnyTheme) on the theme page, in widgets and in saved state.
// Kept: search over the listed themes, the Liked filter (hearts are device-local), the Live hero,
// Your look, Make a wallpaper, Send feedback, the header "?" and Settings gear.
// Pull to refresh fetches catalog.json now (refreshRemoteCatalog). The list only allows the iOS
// overscroll while it rests at the very top, which is what pulling to refresh needs; anywhere else
// it never bounces (owner 25 Oct), and Android never shows the overscroll glow.
// docs/PREMIUM_UI.md §1-2: tokens only, 16 pt rhythm (editorialV2), surfaces not hairlines,
// skeletons not spinners, Dynamic Type caps, ≥ 48 pt targets, one virtualised list (LIST_WINDOW,
// memoised rows, stable keys), no spring or bounce.
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View, type ListRenderItem, type TextStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GALLERY_FILTERS, galleryCardWidth, galleryColumns, galleryFiltering, galleryMatchCount, galleryRows, galleryStarters, type GalleryFilter, type GalleryRow, type GallerySectionId } from '../../src/core/gallery';
import { isRemoteArtTheme } from '../../src/core/remoteCatalog';
import type { Theme } from '../../src/core/themes';
import { useT, type Script } from '../../src/i18n';
import { refreshRemoteCatalog, useRemoteArtThemes } from '../../src/native/useRemoteCatalog';
import { PlusBadge } from '../../src/plus/PlusBadge';
import { useFavourites } from '../../src/store/favourites';
import { circleRadius, continuous, editorialV2, fontScaleCap, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { GalleryArtCard, GalleryCardSkeleton } from '../../src/ui/GalleryArtCard';
import { LanguageHintLine } from '../../src/ui/LanguageHintLine';
import { LiveHeroCard } from '../../src/ui/LiveHeroCard';
import { YourLookPanel } from '../../src/ui/YourLookPanel';
import { PressableScale } from '../../src/ui/PressableScale';
import { PillTabs, type PillTabOption } from '../../src/ui/PillTabs';
import { haptic } from '../../src/ui/haptics';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { BarIconButton, InsetGroup, InsetRow, LargeTitle, LargeTitleHeader, LIST_WINDOW, PillButton, SectionHeader, SquircleCard } from '../../src/ui/v2';

type FeatherName = ComponentProps<typeof Feather>['name'];
type GalleryTheme = Theme;
type Row = GalleryRow<GalleryTheme>;

/** Stable badge element so memoised cards don't re-render for it (a catalogue pack marked Plus). */
const PLUS_BADGE = <PlusBadge />; // i18n-ignore (code after a JSX element)
/** The three bundled starters, once. */
const STARTERS = galleryStarters();
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

const rowKey = (row: Row): string => row.key;

/**
 * The bar's trailing actions (reading end). This is the header-right slot: add further bar
 * buttons (e.g. a Settings gear) as siblings here, before or after the Tips "?".
 */
function HeaderActions({ children }: { children?: ReactNode }) {
  return <View style={styles.headerActions}>{children}</View>;
}

/** The props every card row shares (one memoised object from the screen). */
type CardShared = {
  cardWidth: number;
  onOpen: (id: string) => void;
  likedIds: ReadonlySet<string>;
  onToggleLike: (id: string) => void;
};

/** Editorial header of a gallery section (eyebrow + title + body, read as one heading). */
const GalleryHead = memo(function GalleryHead({ section }: { section: GallerySectionId }) {
  const { t } = useT();
  if (section === 'collection') {
    return (
      <SectionHeader
        eyebrow={t('themes.eyebrow.collection')}
        title={t('themes.collection.title')}
        body={t('themes.collection.body')}
        style={styles.headRow}
      />
    );
  }
  return <SectionHeader eyebrow={t('themes.eyebrow.starters')} title={t('themes.starters')} body={t('themes.startersBody')} style={styles.headRow} />;
});

/** One row of art-led cards (memoised list row; stable shared props). */
const GalleryCardRow = memo(function GalleryCardRow({ themes, shared }: { themes: readonly GalleryTheme[]; shared: CardShared }) {
  const { t } = useT();
  const plusNote = t('themes.plusNote');
  const downloadNote = t('themes.collection.downloadA11y');
  const { cardWidth, onOpen, likedIds, onToggleLike } = shared;
  return (
    <View style={styles.cardRow}>
      {themes.map((theme) => {
        const remote = isRemoteArtTheme(theme);
        const plus = remote && theme.plus;
        return (
          <GalleryArtCard
            key={theme.id}
            theme={theme}
            width={cardWidth}
            onOpen={onOpen}
            badge={plus ? PLUS_BADGE : undefined}
            accessibilityNote={plus ? plusNote : remote ? downloadNote : undefined}
            liked={likedIds.has(theme.id)}
            onToggleLike={onToggleLike}
          />
        );
      })}
    </View>
  );
});

/** New collection while the catalogue is still empty: cards in their final shape, a calm pulse, no error. */
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

/** Search field over the listed themes' name, mood and tags (a pill on `fill`). */
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

export default function ThemesScreen() {
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const { liked, toggle: toggleLike } = useFavourites();
  const likedIds = useMemo(() => new Set(liked), [liked]);
  const filtering = galleryFiltering(query, filter);

  // The New collection: the remote catalogue (cached at once, refreshed in the background).
  const remote = useRemoteArtThemes();

  const columns = galleryColumns(width);
  const cardWidth = galleryCardWidth(width, columns, spaceV2.lg, editorialV2.cardGap);
  const rows: readonly Row[] = useMemo(
    () => galleryRows<GalleryTheme, GalleryTheme>({ remote, starters: STARTERS, columns, query, filter, liked }),
    [remote, columns, query, filter, liked],
  );
  const matchCount = galleryMatchCount(rows);

  const onOpen = useCallback(
    (id: string) => {
      router.push(`/theme/${id}`);
    },
    [router],
  );
  const resetFilters = useCallback(() => {
    haptic('select');
    setQuery('');
    setFilter('all');
  }, []);
  const shared: CardShared = useMemo(() => ({ cardWidth, onOpen, likedIds, onToggleLike: toggleLike }), [cardWidth, onOpen, likedIds, toggleLike]);

  const renderRow: ListRenderItem<Row> = useCallback(
    ({ item }) => {
      if (item.kind === 'head') return <GalleryHead section={item.section} />; // i18n-ignore (code after a JSX element)
      if (item.kind === 'skeleton') return <SkeletonCardRow count={item.count} cardWidth={cardWidth} />; // i18n-ignore (code after a JSX element)
      if (item.kind === 'empty') return <GalleryEmpty reason={item.reason} onReset={resetFilters} />; // i18n-ignore (code after a JSX element)
      return <GalleryCardRow themes={item.themes} shared={shared} />; // i18n-ignore (code after a JSX element)
    },
    [cardWidth, shared, resetFilters],
  );

  // Pull to refresh: fetch catalog.json now. Never rejects; a 404 or offline keeps what is shown.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const done = () => setRefreshing(false);
    void refreshRemoteCatalog().then(done, done);
  }, []);

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

  const filterOptions: PillTabOption<GalleryFilter>[] = useMemo(
    () => GALLERY_FILTERS.map((id) => ({ value: id, label: t(`themes.discover.${id}`) })),
    [t],
  );
  const title = t('tabs.themes');

  const listHeader = useMemo(
    () => (
      <>
        <LargeTitle title={title} subtitle={t('themes.subtitle')} scrollY={scrollY} />
        <View style={styles.inner}>
          {/* Release standard §1: "Language: English · Change", first session only, until tapped. */}
          <LanguageHintLine />
          {/* All / Liked as content-sized pills (never clipped). */}
          <PillTabs label={t('themes.discover.label')} options={filterOptions} value={filter} onChange={setFilter} />
          {/* Search narrows both sections below. */}
          <SearchField value={query} onChange={setQuery} />
          {filtering && matchCount > 0 ? (
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]} accessibilityLiveRegion="polite">
              {t('themes.search.results', { count: matchCount })}
            </Text>
          ) : null}
        </View>
      </>
    ),
    [title, t, scrollY, filterOptions, filter, query, filtering, matchCount, script, c.inkSecondary],
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

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Animated.FlatList
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        {...LIST_WINDOW}
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
  headRow: { paddingHorizontal: spaceV2.lg },
  cardRow: { flexDirection: 'row', gap: editorialV2.cardGap, paddingHorizontal: spaceV2.lg, marginBottom: editorialV2.cardGap },
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
