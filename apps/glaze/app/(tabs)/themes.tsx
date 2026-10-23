// Themes tab, design v2 chrome (docs/DESIGN_V2.md §9, T55): collapsing "Themes" large title with
// the header actions in the glass bar, pill search on `fill`, tips as pastel squircle cards, quiet
// inset rows, v2 colours and type. The T57 category bubbles + showcase grid and the T63 per-theme
// Plus badges are unchanged.
// T77 (shots-1018 L6): All / New / Our picks / Liked sub-tabs under the search field compose with
// the category bubbles; hearts on showcase cards like a theme on this device only. "Our picks" is
// an editorial list (src/core/discovery.ts), never counts or ranks.
// fb-1022 (owner test 22 Oct): G1 no stacked tip cards on the first screen (help is the header "?"
// and one-at-a-time hints after the first action, in theme detail); G2 the shape picker lives in
// theme detail only; G3 category bubbles sit directly under the large title; G4 the sub-tabs are
// content-sized pills (PillTabs) so "Our picks" never clips or breaks across lines.
// T107 (fb-1022-perf, owner 22 Oct: the bubble bounce stutters): the selected bubble lives in a
// SelectionStore (only the two changed bubbles re-render, the bounce starts in the press handler on
// the UI thread); the grid swap waits one frame and runs as a transition (startTransition), so the
// bounce never shares a frame with the grid's render; category pages come from a theme index built
// once; the panels below the gallery are memoised so a swap never re-renders them.
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type TextStyle,
} from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoryCounts, isNew, searchThemes, themesInCategory } from '../../src/core/categories';
import { browsePages, pageAfterStep, pageCategory, pageIndex, pageKey, type BrowseKey } from '../../src/core/categoryPaging';
import { buildThemeIndex, createCategorySwitch, createSelectionStore, themesForPage } from '../../src/core/categorySwitch';
import { DISCOVERY_TABS, discoveryTabKey, discoveryThemes, type DiscoveryTab } from '../../src/core/discovery';
import { ALL_THEMES, PLUS_PACKS } from '../../src/core/plusThemes';
import { SPACE_THEMES } from '../../src/core/spacePack';
import { FREE_MARKED_IDS, STORY_GROUPS, inStoryGroup, isFreeMarked, storyChipKey } from '../../src/core/freeMarks';
import type { StoryPlayGroup } from '../../src/core/themesStoryPlay';
import { activeCollections, collectionThemes, type CollectionId } from '../../src/core/seasons';
import { THEMES, type Theme, type ThemeCategoryId } from '../../src/core/themes';
import { useT, type Script } from '../../src/i18n';
import { deviceRegionCode } from '../../src/native/region';
import { PlusBadge } from '../../src/plus/PlusBadge';
import { FreePill } from '../../src/ui/FreePill';
import { useFavourites } from '../../src/store/favourites';
import { continuous, radiusV2, sizeV2, spaceV2, textV2, type TypeRoleV2 } from '../../src/theme/tokensV2';
import { useColorsV2 } from '../../src/theme/useTokens';
import { CategoryBubbleRow, type BubblePage } from '../../src/ui/CategoryBubbleRow';
import { LiveHeroCard } from '../../src/ui/LiveHeroCard';
import { ThemeCard } from '../../src/ui/ThemeCard';
import { YourLookPanel } from '../../src/ui/YourLookPanel';
import { PressableScale } from '../../src/ui/PressableScale';
import { PillTabs, type PillTabOption } from '../../src/ui/PillTabs';
import { ShowcaseGrid } from '../../src/ui/ShowcaseGrid';
import { haptic } from '../../src/ui/haptics';
import { textStyleFor } from '../../src/ui/i18nLayout';
import { BarIconButton, InsetGroup, InsetRow, LargeTitle, LargeTitleHeader, PillButton, SquircleCard } from '../../src/ui/v2';

type FeatherName = ComponentProps<typeof Feather>['name'];
/** Stable badge element so memoised cards don't re-render for it. */
const PLUS_BADGE = <PlusBadge />; // i18n-ignore (code after a JSX element)
/** T106: stable "Free" pill element for free themes in the new collections. */
const FREE_BADGE = <FreePill />; // i18n-ignore (code after a JSX element)
/** T107: every theme grouped by category once, so a category page is a lookup (stable arrays). */
const ALL_INDEX = buildThemeIndex(ALL_THEMES);
/** T107: panels below the gallery take no props; memoised so a category swap skips them. */
const LiveHeroCardM = memo(LiveHeroCard);
const YourLookPanelM = memo(YourLookPanel);

/** fb-1022c: the centred-card "pop" is gone, so no card ever gets a pop key. */
const NO_POPS: Record<string, number> = {};

/** A v2 type role plus the script's line-height adjustment. */
function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

/**
 * The bar's trailing actions (reading end). This is the header-right slot: add further bar
 * buttons (e.g. a Settings gear) as siblings here, before or after the Tips "?".
 */
function HeaderActions({ children }: { children?: ReactNode }) {
  return <View style={styles.headerActions}>{children}</View>;
}

type GridProps = {
  themes: readonly Theme[];
  /** Y of this grid's parent inside the scroll content. */
  parentY: number;
  cardWidth: number;
  gap: number;
  plus?: boolean;
  scrollY: SharedValue<number>;  viewportH: SharedValue<number>;  popKeys: Record<string, number>;
  onCentre: (id: string, centreY: number) => void;
  onOpen: (id: string) => void;
  /** First stagger slot for this grid, or undefined after the gallery's first mount. */
  staggerFrom: number | undefined;
  emptyTitle: string;
  /** Today's date for the "New" badge. */
  today: Date;
  /** T77: liked theme ids (device-local) and the heart toggle, so pack themes can be liked too. */
  likedIds: ReadonlySet<string>;
  onToggleLike: (id: string) => void;
};

function ThemeGrid({
  themes,
  parentY,
  cardWidth,
  gap,
  plus,
  scrollY,
  viewportH,
  popKeys,
  onCentre,
  onOpen,
  staggerFrom,
  emptyTitle,
  today,
  likedIds,
  onToggleLike,
}: GridProps) {
  const [y, setY] = useState(0);
  const { t: tr } = useT();
  const plusNote = tr('themes.plusNote');
  const freeNote = tr('themes.badge.freeA11y');
  const onLayout = (e: LayoutChangeEvent) => {
    const ny = e.nativeEvent.layout.y;
    if (ny !== y) setY(ny);
  };
  if (themes.length === 0) return <GalleryEmpty title={emptyTitle} />; // i18n-ignore (code after a JSX element)
  return (
    <View onLayout={onLayout} style={[styles.grid, { gap }]}>
      {themes.map((t, i) => (
        <ThemeCard
          key={t.id}
          theme={t}
          width={cardWidth}
          badge={plus || t.plus ? PLUS_BADGE : isFreeMarked(t.id) ? FREE_BADGE : undefined}
          accessibilityNote={plus || t.plus ? plusNote : isFreeMarked(t.id) ? freeNote : undefined}
          onOpen={onOpen}
          scrollY={scrollY}
          viewportH={viewportH}
          offsetY={parentY + y}
          onCentre={onCentre}
          popKey={popKeys[t.id] ?? 0}
          staggerIndex={staggerFrom === undefined ? undefined : staggerFrom + i}
          isNew={isNew(t, today)}
          liked={likedIds.has(t.id)}
          onToggleLike={onToggleLike}
        />
      ))}
    </View>
  );
}

/** Pastel circle with a glyph, used by the empty states. */
function EmptyIcon({ icon }: { icon: FeatherName }) {
  const { c } = useColorsV2();
  return (
    <View style={[styles.emptyIcon, { backgroundColor: c.pastels.berry.fill }]}>
      <Feather name={icon} size={24} color={c.pastels.berry.ink} />
    </View>
  );
}

/** Designed empty state for a theme list with nothing in it (e.g. a pack still being drawn). */
function GalleryEmpty({ title }: { title: string }) {
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  return (
    <SquircleCard accessibilityLabel={t('themes.empty.a11y', { title })}>
      <View style={styles.empty}>
        <EmptyIcon icon="droplet" />
        <Text style={[...typeFor(script, 'headline'), styles.center, { color: c.ink }]}>{title}</Text>
        <Text style={[...typeFor(script, 'footnote'), styles.center, { color: c.inkSecondary }]}>{t('themes.empty.body')}</Text>
        <PillButton
          label={t('themes.empty.cta')}
          icon="grid"
          variant="plain"
          onPress={() => router.push('/icons')}
          accessibilityLabel={t('themes.empty.cta')}
          accessibilityHint={t('themes.empty.ctaHint')}
          style={styles.selfCenter}
        />
      </View>
    </SquircleCard>
  );
}

/** R4: search field over name, tagline, tags and categories (v2: a pill on `fill`). */
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

/** R5: "In season" banner with a tile per live collection; tapping one filters the gallery to it. */
const SeasonalBanner = memo(function SeasonalBanner({
  collections,
  selected,
  onSelect,
}: {
  collections: { id: CollectionId; themes: Theme[] }[];
  selected: CollectionId | null;
  onSelect: (id: CollectionId) => void;
}) {
  const { c } = useColorsV2();
  const { t, script, formatNumber } = useT();
  return (
    <SquircleCard tone="peach" size="large">
      <View style={styles.season}>
        <View style={styles.packTitle}>
          <Text accessibilityRole="header" style={[...typeFor(script, 'title3'), { color: c.pastels.peach.ink }]}>
            {t('themes.season.title')}
          </Text>
          <Text style={[...typeFor(script, 'footnote'), { color: c.pastels.peach.ink }]}>{t('themes.season.subtitle')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonRow}>
          {collections.map(({ id, themes }) => {
            const on = selected === id;
            const label = t(`themes.season.${id}`);
            return (
              <PressableScale
                key={id}
                onPress={() => onSelect(id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t('themes.season.a11y', { label, count: themes.length })}
                style={[
                  styles.seasonTile,
                  continuous,
                  { backgroundColor: c.surface, borderColor: on ? c.tint : 'transparent', borderWidth: 2 },
                ]}
              >
                <View style={styles.seasonDots}>
                  {themes.slice(0, 3).map((t) => (
                    <View key={t.id} style={[styles.seasonDot, { backgroundColor: t.palette.accent, borderColor: c.separator }]} />
                  ))}
                </View>
                <Text style={[...typeFor(script, 'headline'), { color: c.ink }]}>{label}</Text>
                <Text style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>{formatNumber(themes.length)}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>
    </SquircleCard>
  );
});

/** T77: a sub-tab with nothing in it yet (no liked themes, nothing new right now). */
function DiscoveryEmpty({ icon, title, body }: { icon: FeatherName; title: string; body?: string }) {
  const { c } = useColorsV2();
  const { script } = useT();
  return (
    <SquircleCard accessibilityLabel={body ? `${title} ${body}` : title}>
      <View style={styles.empty}>
        <EmptyIcon icon={icon} />
        <Text style={[...typeFor(script, 'headline'), styles.center, { color: c.ink }]}>{title}</Text>
        {body ? <Text style={[...typeFor(script, 'footnote'), styles.center, { color: c.inkSecondary }]}>{body}</Text> : null}
      </View>
    </SquircleCard>
  );
}

/** T106: Games / Movie night / Storybook chips under the search field (toggle; one at a time). */
const StoryChips = memo(function StoryChips({
  selected,
  onSelect,
}: {
  selected: StoryPlayGroup | null;
  onSelect: (g: StoryPlayGroup) => void;
}) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      accessibilityLabel={t('themes.storyChips.label')}
      keyboardShouldPersistTaps="handled"
    >
      {STORY_GROUPS.map((g) => {
        const on = selected === g;
        const label = t(storyChipKey(g));
        return (
          <PressableScale
            key={g}
            onPress={() => onSelect(g)}
            haptic="select"
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t('themes.storyChips.a11y', { label })}
            style={[styles.chip, continuous, { backgroundColor: on ? c.tint : c.fill }]}
          >
            <Text style={[...typeFor(script, 'subhead'), { color: on ? c.onTint : c.ink }]}>{label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
});

/** Filtering found nothing. */
function NoMatches({ onReset }: { onReset: () => void }) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  return (
    <SquircleCard>
      <View style={styles.empty}>
        <EmptyIcon icon="search" />
        <Text style={[...typeFor(script, 'headline'), styles.center, { color: c.ink }]}>{t('themes.search.empty.title')}</Text>
        <Text style={[...typeFor(script, 'footnote'), styles.center, { color: c.inkSecondary }]}>{t('themes.search.empty.body')}</Text>
        <PillButton label={t('themes.search.empty.reset')} variant="plain" onPress={onReset} style={styles.selfCenter} />
      </View>
    </SquircleCard>
  );
}

export default function ThemesScreen() {
  const { c } = useColorsV2();
  const router = useRouter();
  const { t, script } = useT();
  const ts = (role: TypeRoleV2): TextStyle[] => typeFor(script, role);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // R4 + R5 browsing: search query, one category or one seasonal collection at a time.
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ThemeCategoryId | null>(null);  const [collection, setCollection] = useState<CollectionId | null>(null);
  // T106: Story & Play group chip (games / movie night / storybook), composes with the rest.
  const [group, setGroup] = useState<StoryPlayGroup | null>(null);
  const today = useMemo(() => new Date(), []);
  const seasonal = useMemo(
    () =>
      activeCollections(today, deviceRegionCode())
        .map((id) => ({ id, themes: collectionThemes(id, ALL_THEMES) }))
        .filter((x) => x.themes.length > 0),
    [today],
  );
  // T77: the sub-tab picks the pool (in its own order); category, collection and search filter it.
  const [tab, setTab] = useState<DiscoveryTab>('all');
  const { liked, toggle: toggleLike } = useFavourites();
  const likedIds = useMemo(() => new Set(liked), [liked]);
  const discovering = tab !== 'all';
  const pool = useMemo(() => discoveryThemes(ALL_THEMES, tab, { today, liked }), [tab, today, liked]);
  const tabOptions: PillTabOption<DiscoveryTab>[] = DISCOVERY_TABS.map((id) => ({ value: id, label: t(discoveryTabKey(id)) }));
  const searched = useMemo(() => searchThemes(pool, query), [pool, query]);
  const counts = useMemo(() => categoryCounts(searched), [searched]);
  const collectionIds = useMemo(
    () => (collection ? new Set(collectionThemes(collection, ALL_THEMES).map((t) => t.id)) : null),
    [collection],
  );
  const filtering = query.trim().length > 0 || category !== null || collection !== null || group !== null;
  const filterList = useCallback(
    (list: readonly Theme[]): readonly Theme[] => {
      if (!filtering) return list;
      const inCat = inStoryGroup(searchThemes(themesInCategory(list, category), query), group);
      return collectionIds ? inCat.filter((t) => collectionIds.has(t.id)) : inCat;
    },
    [filtering, category, query, collectionIds, group],
  );
  // T107: the selected bubble lives in a store; a press updates it at once (two bubbles re-render,
  // the bounce starts) and the grid follows one frame later as a transition.
  const selection = useMemo(() => createSelectionStore<BrowseKey>(pageKey(null)), []);
  const switcher = useMemo(
    () =>
      createCategorySwitch<BrowseKey>({
        store: selection,
        schedule: (cb) => {
          requestAnimationFrame(cb);
        },
        commitGrid: (key) =>
          startTransition(() => {
            setCategory(pageCategory(key));
            setCollection(null);
          }),
      }),
    [selection],
  );
  // Swipes, resets and collections change `category` directly; keep the bubbles in step.
  useEffect(() => {
    const key = pageKey(category);
    if (!switcher.pending() && selection.get() !== key) selection.set(key);
  }, [category, selection, switcher]);
  const collectionRef = useRef(collection);
  collectionRef.current = collection;
  const pickPage = useCallback(
    (key: BrowseKey) => {
      if (key === selection.get()) {
        // Same bubble while a seasonal collection is showing: drop the collection only.
        if (collectionRef.current !== null) startTransition(() => setCollection(null));
        return;
      }
      switcher.press(key);
    },
    [selection, switcher],
  );
  // T107: the Space and Plus pack sections ignore the category (they only show on the "All" page),
  // so they keep the same lists, stay mounted (hidden) on category pages and never re-mount.
  const filteringAll = query.trim().length > 0 || collection !== null || group !== null;
  const filterAll = useCallback(
    (list: readonly Theme[]): readonly Theme[] => {
      if (!filteringAll) return list;
      const found = inStoryGroup(searchThemes(list, query), group);
      return collectionIds ? found.filter((t) => collectionIds.has(t.id)) : found;
    },
    [filteringAll, query, collectionIds, group],
  );
  const pickGroup = useCallback((g: StoryPlayGroup) => {
    setGroup((cur) => (cur === g ? null : g));
  }, []);
  const pickCategory = (id: ThemeCategoryId | null) => {
    if (id === category && collection === null) return;
    haptic('select');
    pickPage(pageKey(id));
  };
  const pickCollection = useCallback((id: CollectionId) => {
    haptic('select');
    setCollection((cur) => (cur === id ? null : id));
    setCategory(null);
  }, []);
  const resetFilters = () => {
    haptic('select');
    setQuery('');
    setCategory(null);
    setCollection(null);
    setGroup(null);
  };
  // T57 (M4a): big category bubbles page the showcase grid; swiping the grid steps pages.
  const page = pageKey(category);
  const pages = useMemo(() => browsePages(counts, page), [counts, page]);
  const pageAt = pageIndex(pages, page);
  const bubblePages: BubblePage[] = useMemo(
    () =>
      pages.map((key) => {
        const cat = pageCategory(key);
        return {
          key,
          label: cat === null ? t('themes.category.all') : t(`themes.category.${cat}`),
          count: cat === null ? searched.length : counts[cat],
        };
      }),
    [pages, t, searched.length, counts],
  );
  const stepRef = useRef<(step: -1 | 1) => void>(() => {});
  stepRef.current = (step: -1 | 1) => {
    const next = pages[pageAfterStep(pageAt, pages.length, step)];
    if (next === undefined || next === page) return;
    const cat = pageCategory(next);
    pickCategory(cat);
    const b = bubblePages.find((p) => p.key === next);
    if (b) AccessibilityInfo.announceForAccessibility(t('themes.category.a11y', { label: b.label, count: b.count }));
  };
  const onStep = useCallback((step: -1 | 1) => stepRef.current(step), []);
  const plusIds = useMemo(() => new Set(PLUS_PACKS.flatMap((p) => p.themes.map((x) => x.id))), []);
  const newIds = useMemo(() => new Set(ALL_THEMES.filter((x) => isNew(x, today)).map((x) => x.id)), [today]);

  // T34 (G1): scroll position lives in shared values written on the UI thread; cards read it for
  // the parallax, and the large title / glass bar read the same value to collapse (T55).
  const scrollY = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // fb-1022c (owner 22 Oct evening: no bounce): no first-mount stagger and no "pop" of the centred
  // card when scrolling stops; cards just appear. The card centres are still tracked (onCentre).
  const centres = useRef(new Map<string, number>());
  const viewport = useRef(0);
  const [packY, setPackY] = useState<Record<string, number>>({});
  /** Y of the content column inside the scroll content (it now sits below the large title). */
  const [innerY, setInnerY] = useState(0);

  const onCentre = useCallback((id: string, y: number) => {
    centres.current.set(id, y);
  }, []);

  const onViewportLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    viewport.current = h;
    viewportH.value = h;
  };

  const onOpen = useCallback(
    (id: string) => {
      router.push(`/theme/${id}`);
    },
    [router],
  );

  // Filtered sections: packs with no matches are hidden while filtering; a sub-tab hides them too.
  const showPacks = category === null && !discovering;
  const packsAlive = !discovering && (category === null || (query.trim().length === 0 && collection === null && group === null));
  const starters = useMemo(() => filterList(THEMES), [filterList]);
  // T103: the free Space (Webb) photo themes, a section of their own above the Plus packs.
  const space = useMemo(() => filterAll(SPACE_THEMES), [filterAll]);
  const [spaceY, setSpaceY] = useState(0);
  /** Y of the (T107) wrapper around the Space and Plus pack sections. */
  const [packsY, setPacksY] = useState(0);
  const packs = useMemo(
    () =>
      PLUS_PACKS.map((p) => ({ ...p, themes: filterAll(p.themes) })).filter((p) => !filteringAll || p.themes.length > 0),
    [filterAll, filteringAll],
  );
  // On a category page the showcase holds every matching theme (starters and Plus) and the pack
  // sections step aside; the "All" page keeps starters in the showcase and the packs below.
  // T107: a plain category page (no search, no collection) is a lookup in the prebuilt index.
  const plainCategory = query.trim().length === 0 && collection === null && group === null;
  const showcase = useMemo(
    () =>
      discovering
        ? filterList(pool)
        : category === null
          ? starters
          : plainCategory
            ? themesForPage(ALL_INDEX, category)
            : filterList(ALL_THEMES),
    [discovering, pool, category, starters, filterList, plainCategory],
  );
  const matchCount = showPacks ? starters.length + packs.reduce((n, p) => n + p.themes.length, 0) : showcase.length;

  // Forget the centres of cards that filtering hid.
  useEffect(() => {
    const visible = new Set((showPacks ? [...space, ...packs.flatMap((p) => [...p.themes])] : []).map((t) => t.id));
    for (const id of [...centres.current.keys()]) if (!visible.has(id)) centres.current.delete(id);
  }, [showPacks, packs, space]);

  const columns = width >= 340 ? 2 : 1;
  const gap = spaceV2.md;
  const cardWidth = Math.floor((width - spaceV2.lg * 2 - gap * (columns - 1)) / columns);

  const gridShared = { cardWidth, gap, scrollY, viewportH, popKeys: NO_POPS, onCentre, onOpen, today, likedIds, onToggleLike: toggleLike };
  // fb-1022c: no stagger slots (cards never stagger in).
  const nextSlot = (_n: number): number | undefined => undefined;

  const title = t('tabs.themes');
  // T77: each sub-tab has its own empty state (no liked themes yet, nothing new right now).
  let showcaseEmpty: ReactNode = <GalleryEmpty title={t('themes.startersEmpty')} />;
  if (tab === 'liked') {
    showcaseEmpty = <DiscoveryEmpty icon="heart" title={t('themes.discover.likedEmpty')} body={t('themes.discover.likedEmptyBody')} />;
  } else if (tab === 'new') {
    showcaseEmpty = <DiscoveryEmpty icon="star" title={t('themes.discover.newEmpty')} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Animated.ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sizeV2.navBar }]}
        contentInsetAdjustmentBehavior="never"
        onLayout={onViewportLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <LargeTitle title={title} subtitle={t('themes.subtitle')} scrollY={scrollY} />
        <View
          style={styles.inner}
          onLayout={(e: LayoutChangeEvent) => {
            const y = e.nativeEvent.layout.y;
            if (y !== innerY) setInnerY(y);
          }}
        >
          {/* fb-1022 G3: category bubbles first, directly under the large title. */}
          <CategoryBubbleRow pages={bubblePages} store={selection} onSelect={pickPage} />
          {/* fb-1022 G4: All / New / Our picks / Liked as content-sized pills (never clipped). */}
          <PillTabs label={t('themes.discover.label')} options={tabOptions} value={tab} onChange={setTab} />
          {/* R4: search filters the gallery below. */}
          <SearchField value={query} onChange={setQuery} />
          {/* T106: a way in to the games, movie-night and storybook themes. */}
          <StoryChips selected={group} onSelect={pickGroup} />
          {collection ? (
            <Text style={[...ts('footnote'), { color: c.inkSecondary }]} accessibilityLiveRegion="polite">
              {t('themes.season.showing', { label: t(`themes.season.${collection}`) })}
            </Text>
          ) : null}
          {filtering ? (
            <Text style={[...ts('footnote'), { color: c.inkSecondary }]} accessibilityLiveRegion="polite">
              {t('themes.search.results', { count: matchCount })}
            </Text>
          ) : null}
          {filtering && matchCount === 0 ? <NoMatches onReset={resetFilters} /> : null}

          {!filtering || showcase.length > 0 ? (
            <>
              <View style={styles.sectionHead}>
                <Text accessibilityRole="header" style={[...ts('title2'), { color: c.ink }]}>
                  {category !== null
                    ? t(`themes.category.${category}`)
                    : discovering
                      ? t(discoveryTabKey(tab))
                      : t('themes.starters')}
                </Text>
                {tab === 'picks' ? (
                  <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{t('themes.discover.picksNote')}</Text>
                ) : null}
              </View>
              <ShowcaseGrid
                themes={showcase}
                pageIndex={pageAt}
                pageCount={pages.length}
                onStep={onStep}
                onOpen={onOpen}
                plusIds={plusIds}
                plusBadge={PLUS_BADGE}
                plusNote={t('themes.plusNote')}
                freeIds={FREE_MARKED_IDS}
                freeBadge={FREE_BADGE}
                freeNote={t('themes.badge.freeA11y')}
                newIds={newIds}
                empty={showcaseEmpty}
                likedIds={likedIds}
                onToggleLike={toggleLike}
              />
            </>
          ) : null}

          {/* Below the gallery: seasonal collections, Live Lock Screen, the applied look, make a wallpaper. */}
          {seasonal.length > 0 ? (
            <SeasonalBanner collections={seasonal} selected={collection} onSelect={pickCollection} />
          ) : null}
          {filtering || discovering ? null : (
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

          {/* T107: kept mounted (hidden) on plain category pages so going back to "All" mounts nothing. */}
          {packsAlive ? (
            <View
              style={showPacks ? styles.packsWrap : styles.hidden}
              onLayout={(e: LayoutChangeEvent) => {
                const y = e.nativeEvent.layout.y;
                if (showPacks && y !== packsY) setPacksY(y);
              }}
            >
            {space.length > 0 ? (
              <View
                style={styles.pack}
                onLayout={(e: LayoutChangeEvent) => {
                  const y = e.nativeEvent.layout.y;
                  if (y !== spaceY) setSpaceY(y);
                }}
              >
                <View style={styles.packTitle}>
                  <Text accessibilityRole="header" style={[...ts('title2'), { color: c.ink }]}>
                    {t('themes.space.title')}
                  </Text>
                  <Text style={[...ts('subhead'), { color: c.inkSecondary }]}>{t('themes.space.body')}</Text>
                </View>
                <ThemeGrid
                  {...gridShared}
                  themes={space}
                  parentY={innerY + packsY + spaceY}
                  staggerFrom={nextSlot(space.length)}
                  emptyTitle={t('themes.space.title')}
                />
              </View>
            ) : null}

            {!filteringAll || packs.length > 0 ? (
              <View style={styles.packsHead}>
                <Text accessibilityRole="header" style={[...ts('title2'), { color: c.ink }]}>
                  {t('themes.plusPacks')}
                </Text>
                <Text style={[...ts('subhead'), { color: c.inkSecondary }]}>{t('themes.plusPacksBody')}</Text>
              </View>
            ) : null}
            {PLUS_PACKS.length === 0 ? <GalleryEmpty title={t('themes.plusPacksEmpty')} /> : null}
            {packs.map((pack) => (
              <View
                key={pack.id}
                style={styles.pack}
                onLayout={(e: LayoutChangeEvent) => {
                  const y = e.nativeEvent.layout.y;
                  setPackY((m) => (m[pack.id] === y ? m : { ...m, [pack.id]: y }));
                }}
              >
                <View style={styles.packTitle}>
                  <Text accessibilityRole="header" style={[...ts('title3'), { color: c.ink }]}>
                    {pack.name}
                  </Text>
                  <Text style={[...ts('footnote'), { color: c.inkSecondary }]}>{pack.tagline}</Text>
                </View>
                <ThemeGrid
                  {...gridShared}
                  themes={pack.themes}
                  parentY={innerY + packsY + (packY[pack.id] ?? 0)}
                  plus
                  staggerFrom={nextSlot(pack.themes.length)}
                  emptyTitle={t('themes.packEmpty', { name: pack.name })}
                />
              </View>
            ))}
            </View>
          ) : null}

          {/* T23: small feedback entry, opens /feedback with "Theme request" preselected. */}
          <PillButton
            label={t('themes.feedback')}
            icon="mail"
            variant="plain"
            onPress={() => router.push('/feedback?type=theme')}
            accessibilityHint={t('themes.feedbackHint')}
          />
        </View>
      </Animated.ScrollView>
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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  barIcon: { width: sizeV2.touch, height: sizeV2.touch, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  selfCenter: { alignSelf: 'center' },
  flush: { marginHorizontal: 0 },
  sectionHead: { gap: spaceV2.xxs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
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
  season: { gap: spaceV2.md },
  seasonTile: {
    minHeight: sizeV2.touch + spaceV2.lg,
    minWidth: 112,
    justifyContent: 'center',
    gap: spaceV2.xxs,
    paddingHorizontal: spaceV2.md,
    paddingVertical: spaceV2.sm,
    borderRadius: radiusV2.control,
  },
  seasonRow: { gap: spaceV2.sm },
  seasonDots: { flexDirection: 'row', gap: spaceV2.xs, marginBottom: spaceV2.xxs },
  seasonDot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  packsHead: { marginTop: spaceV2.md, gap: spaceV2.xxs },
  pack: { gap: spaceV2.sm },
  packsWrap: { gap: spaceV2.lg },
  chipRow: { gap: spaceV2.sm },
  chip: {
    minHeight: sizeV2.touch,
    justifyContent: 'center',
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
  },
  hidden: { display: 'none' },
  packTitle: { gap: spaceV2.xxs },
  empty: { alignItems: 'center', gap: spaceV2.sm },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
