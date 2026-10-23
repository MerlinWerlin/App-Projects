// Templates (PLAN §3 /templates, DESIGN_V2 §7, MARKET "Design reference 18 Oct" §2; T75): large title and search
// field, a horizontal row of big category bubbles (All, New, then categories), level as a pill segmented control,
// Favourites + collections as pill chips, and a 2-column grid of tall preview cards on a soft pastel panel. The tip
// card (F5) is a pastel BubbleCard under the grid; no results get the shared EmptyStateV2 (T89) with one action.
// Every v1 behaviour stays: localized search, favourites (optimistic, announced), recent templates (recorded on
// open), level / category / collection / favourites filters with counts, route params, trace navigation.
// T82: a card tap opens the detail sheet (Start tracing → /trace with the same params); long press traces at once.
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeV2 } from '../../src/theme/useTheme';
import { gutterFor, maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../../src/theme/tokensV2';
import { pressScaleV2, useReduceMotion } from '../../src/theme/motion';
import { select } from '../../src/native/haptics';
import {
  CATEGORIES,
  DEFAULT_STROKE_WIDTH,
  LEVELS,
  TEMPLATES,
  type Template,
  type TemplateCategory,
  type TemplateLevel,
} from '../../src/core/templates';
import {
  COLLECTIONS,
  NO_FILTERS,
  filterCounts,
  hasActiveFilters,
  isFavoritesParam,
  parseCollection,
  parseLevel,
  parseQuery,
  searchTemplates,
  toggleFavorite as toggleInList,
  type SearchLocalizer,
  type TemplateCollectionId,
  type TemplateFilters,
} from '../../src/core/templateSearch';
import {
  isNewTemplate,
  newTemplates,
  parseShelf,
  shelfBubbles,
  shelfCategory,
  shelfGlyph,
  shelfPool,
  type Shelf,
} from '../../src/core/templateShelf';
import { sceneBottomPad } from '../../src/core/tabs';
import { useT } from '../../src/i18n';
import { loadFavorites, recordTemplateUse, toggleFavorite } from '../../src/native/templatePrefs';
import { TemplateCard } from '../../src/ui/TemplateCard';
import { TemplateDetailSheet } from '../../src/ui/v2/TemplateDetailSheet';
import { TemplateSvg } from '../../src/ui/TemplateSvg';
import { PressableScale } from '../../src/ui/PressableScale';
import { animateListChange } from '../../src/ui/layoutAnim';
import {
  BAR_HEIGHT,
  BubbleCard,
  CategoryBubble,
  EmptyStateV2,
  IconBubble,
  LargeTitle,
  LargeTitleHeader,
  Sparkle,
  useLargeTitleScroll,
} from '../../src/ui/v2';
import { PillSegmented, type PillSegment } from '../../src/ui/v2/PillSegmented';
import { usePlus } from '../../src/plus/usePlus';
import { TRADE_SUBS, inTradeSub, tradeSubCounts, type TradeSub } from '../../src/core/tradeSubs';
import { starterIds, templateLocked } from '../../src/plus/access';
import { STARTER_TEMPLATE_COUNT } from '../../src/plus/entitlement';

// Free after the 14-day trial (owner decision 22 Oct 2026); everything else needs Linework Plus.
const STARTERS = starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT);
import { squircle } from '../../src/ui/v2/shared';

const GAP = spaceV2.x3;
/** Inner padding of the pastel grid panel. */
const PANEL = spaceV2.x3;
/** Height of the panel's rounded top / bottom caps (equals their corner radius). */
const CAP = radiusV2.md;
const GLYPH = 44;
const EMPTY: ReadonlySet<string> = new Set();

type LevelChoice = 'all' | TemplateLevel;

// Library-wide counts (no filters), used to hide collection chips with no art yet.
const LIBRARY = filterCounts(TEMPLATES, NO_FILTERS);
// The newest set (the New bubble's pool), computed once.
const NEW_POOL = newTemplates(TEMPLATES);

export default function TemplatesScreen() {
  const { c, text } = useThemeV2();
  const { t, tDynamic, locale, setting } = useT();
  // Rebuilt when the language changes (locale + setting also cover the pseudo-locale).
  const langKey = `${setting}|${locale}`;
  const levelOptions = useMemo<readonly PillSegment<LevelChoice>[]>(
    () => [
      { value: 'all', label: t('templates.level.all'), accessibilityLabel: t('templates.level.allLabel') },
      ...LEVELS.map((l) => ({ value: l.id, label: tDynamic(`templates.level.${l.id}`, l.label) })),
    ],
    [langKey, t, tDynamic],
  );
  // Search also matches names and labels in the app's language (English always works too).
  const localizer = useMemo<SearchLocalizer>(
    () => ({
      name: (tpl) => tDynamic(`templates.name.${tpl.id}`, tpl.name),
      category: (id) => tDynamic(`templates.category.${id}`, id),
      level: (id) => tDynamic(`templates.level.${id}`, id),
    }),
    [langKey, tDynamic],
  );
  const categoryName = (id: TemplateCategory) =>
    tDynamic(`templates.category.${id}`, CATEGORIES.find((x) => x.id === id)?.label ?? id);
  const collectionName = (id: TemplateCollectionId, fallback: string) => tDynamic(`templates.collection.${id}`, fallback);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gutter = gutterFor(width);
  const { scrollY, onScroll } = useLargeTitleScroll();
  const params = useLocalSearchParams<{ category?: string; collection?: string; level?: string; q?: string }>();
  // ?category=<id> picks a category bubble, ?category=new the New bubble.
  const pShelf = parseShelf(params.category);
  const pCollection = parseCollection(params.collection);
  const pFavorites = isFavoritesParam(params.collection);
  const pLevel = parseLevel(params.level);
  const pQuery = parseQuery(params.q);

  const [query, setQuery] = useState(pQuery);
  const [shelf, setShelf] = useState<Shelf>(pShelf);
  const [level, setLevel] = useState<TemplateLevel | null>(pLevel);
  const [collection, setCollection] = useState<TemplateCollectionId | null>(pCollection);
  const [favoritesOnly, setFavoritesOnly] = useState(pFavorites);
  const [favorites, setFavorites] = useState<string[]>([]);
  // T82: the template whose detail sheet is open.
  const [detail, setDetail] = useState<Template | null>(null);
  const listRef = useRef<FlatList<Template>>(null);
  const reduce = useReduceMotion();
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  // Grid stagger runs on the screen's first mount only: cards mounted later (filter changes,
  // scrolling, coming back from trace) appear without it.
  const staggerOn = useRef(true);
  useEffect(() => {
    staggerOn.current = false;
  }, []);

  // Follow the route params if the screen is reused with different ones.
  useEffect(() => {
    setQuery(pQuery);
    setShelf(pShelf);
    setLevel(pLevel);
    setCollection(pCollection);
    setFavoritesOnly(pFavorites);
  }, [pQuery, pShelf, pLevel, pCollection, pFavorites]);

  // Bumped on every heart tap, so a load that started before a tap can't overwrite the optimistic state.
  const toggles = useRef(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const started = toggles.current;
      loadFavorites().then((list) => {
        if (alive && toggles.current === started) setFavorites(list);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  // Typing stays responsive: the (SVG-heavy) grid re-renders from the deferred query.
  const deferredQuery = useDeferredValue(query);
  const favSet = useMemo<ReadonlySet<string>>(() => new Set(favorites), [favorites]);
  const category = shelfCategory(shelf);
  // fb-1023b: Trade & workshop has its own sub-category chips (Angles, Carpentry, Metal & welding, ...).
  const [tradeSub, setTradeSub] = useState<TradeSub | null>(null);
  useEffect(() => {
    if (shelf !== 'trade') setTradeSub(null);
  }, [shelf]);
  const shelfAll = useMemo(() => shelfPool(TEMPLATES, shelf), [shelf]);
  const subCounts = useMemo(() => tradeSubCounts(shelfAll), [shelfAll]);
  const pool = useMemo(() => (shelf === 'trade' ? inTradeSub(shelfAll, tradeSub) : shelfAll), [shelf, shelfAll, tradeSub]);
  const filters = useMemo<TemplateFilters>(
    () => ({ query: deferredQuery, category, level, collection, favoritesOnly }),
    [deferredQuery, category, level, collection, favoritesOnly],
  );
  // Favourites only affect results when the Favourites chip is on, so hearts don't rebuild the list otherwise.
  const resultFavs = favoritesOnly ? favSet : EMPTY;
  const data = useMemo(() => searchTemplates(pool, filters, resultFavs, localizer), [pool, filters, resultFavs, localizer]);
  // Counts for the level / collection / favourites chips and the total come from the shelf's pool; the bubbles'
  // counts from the whole library (holding the other filters), and New from the newest set.
  const counts = useMemo(() => filterCounts(pool, filters, favSet, localizer), [pool, filters, favSet, localizer]);
  const libraryCounts = useMemo(
    () => (shelf === 'new' ? filterCounts(TEMPLATES, filters, favSet, localizer) : counts),
    [shelf, filters, favSet, localizer, counts],
  );
  const newCount = useMemo(
    () => filterCounts(NEW_POOL, { ...filters, category: null }, favSet, localizer).total,
    [filters, favSet, localizer],
  );
  const anyActive = hasActiveFilters(filters) || shelf === 'new';

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filters, shelf]);

  const cardWidth = Math.floor((width - gutter * 2 - PANEL * 2 - GAP) / 2);

  // Results change (rows added/removed): ease the grid into its new layout. Skipped under Reduce Motion.
  // Search typing is not animated (the grid follows a deferred query, so the next layout pass is the keystroke's).
  const animateResults = useCallback(() => animateListChange(reduceRef.current), []);

  const { access } = usePlus();
  const isLocked = useCallback((tpl: Template) => templateLocked(access, STARTERS, tpl.id), [access]);
  const open = useCallback(
    (tpl: Template) => {
      // No haptic here: the card's PressableScale fires the light tap.
      if (isLocked(tpl)) {
        router.push('/plus');
        return;
      }
      recordTemplateUse(tpl.id).catch(() => {});
      router.push({ pathname: '/trace', params: { template: tpl.id } });
    },
    [router, isLocked],
  );
  // T82: card tap → detail sheet; its Start tracing button closes it and runs the usual open(). Locked → Plus.
  const showDetail = useCallback(
    (tpl: Template) => {
      if (isLocked(tpl)) router.push('/plus');
      else setDetail(tpl);
    },
    [isLocked, router],
  );
  const startFromSheet = useCallback(
    (tpl: Template) => {
      setDetail(null);
      open(tpl);
    },
    [open],
  );

  const favRef = useRef(favorites);
  favRef.current = favorites;
  const favOnlyRef = useRef(favoritesOnly);
  favOnlyRef.current = favoritesOnly;
  const onToggleFavorite = useCallback((tpl: Template) => {
    select();
    const adding = !favRef.current.includes(tpl.id);
    // With Favourites on, un-hearting removes the card from the grid.
    if (favOnlyRef.current) animateResults();
    toggles.current += 1;
    // Optimistic: the heart flips now; storage applies the same toggle in order behind it.
    setFavorites((prev) => toggleInList(prev, tpl.id));
    toggleFavorite(tpl.id).catch(() => {});
    const name = tDynamic(`templates.name.${tpl.id}`, tpl.name);
    AccessibilityInfo.announceForAccessibility(
      adding ? t('templates.favAdded', { name }) : t('templates.favRemoved', { name }),
    );
  }, [animateResults, t, tDynamic]);

  const clearAll = useCallback(() => {
    select();
    animateResults();
    setQuery('');
    setShelf('all');
    setLevel(null);
    setCollection(null);
    setFavoritesOnly(false);
  }, [animateResults]);

  const renderItem = useCallback<ListRenderItem<Template>>(
    ({ item, index }) => (
      <TemplateCard
        template={item}
        width={cardWidth}
        favorite={favSet.has(item.id)}
        onOpen={showDetail}
        onQuickTrace={open}
        onToggleFavorite={onToggleFavorite}
        marginBottom={GAP}
        index={index}
        entrance={staggerOn.current}
        isNew={isNewTemplate(item)}
        locked={isLocked(item)}
      />
    ),
    [cardWidth, favSet, showDetail, open, onToggleFavorite, isLocked],
  );

  const shelves = shelfBubbles(TEMPLATES, shelf);
  const shownCollections = COLLECTIONS.filter((col) => LIBRARY.collections[col.id] > 0 || col.id === collection);
  const total = counts.total;
  const pastel = c.pastels[2];

  const shelfLabel = (s: Shelf) =>
    s === 'all' ? t('templates.allCategories') : s === 'new' ? t('templates.shelf.new') : categoryName(s);
  const shelfA11y = (s: Shelf) =>
    s === 'all'
      ? t('templates.allCategoriesLabel', { count: libraryCounts.categories.all })
      : t('templates.categoryChipLabel', {
          name: shelfLabel(s),
          count: s === 'new' ? newCount : libraryCounts.categories[s],
        });
  const shelfGlyphNode = (s: Shelf) => {
    if (s === 'all') return <Feather name="grid" size={30} color={c.ink} />;
    const tpl = shelfGlyph(TEMPLATES, s);
    const art = tpl ? (
      <TemplateSvg template={tpl} size={GLYPH} color={c.graphite} strokeWidth={(tpl.strokeWidth ?? DEFAULT_STROKE_WIDTH) * 3} />
    ) : (
      <Feather name="feather" size={28} color={c.ink} />
    );
    if (s !== 'new') return art;
    return (
      <View>
        {art}
        <Sparkle variant="cluster" size={20} color={c.bubblegum} style={{ position: 'absolute', top: -8, end: -10 }} />
      </View>
    );
  };

  const header = (
    <View>
      <LargeTitle title={t('common.nav.templates')} scrollY={scrollY} />
      <SearchField value={query} onChange={setQuery} />

      {/* Category bubbles: single choice (All, New, categories) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={t('templates.shelf.groupLabel')}
        keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -gutter, marginTop: spaceV2.x4 }}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: spaceV2.x3, paddingVertical: spaceV2.x1 }}
      >
        {shelves.map((s, n) => (
          <CategoryBubble
            key={s}
            label={shelfLabel(s)}
            index={n}
            selected={shelf === s}
            accessibilityRole="tab"
            accessibilityLabel={shelfA11y(s)}
            glyph={shelfGlyphNode(s)}
            onPress={() => {
              if (shelf === s) return;
              animateResults();
              setShelf(s);
            }}
          />
        ))}
      </ScrollView>

      {shelf === 'trade' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={t('templates.tradeSub.groupLabel')}
          style={{ marginHorizontal: -gutter, marginTop: spaceV2.x3 }}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: spaceV2.x2, paddingVertical: spaceV2.x1 }}
        >
          <FilterPill
            label={t('templates.tradeSub.all')}
            count={shelfAll.length}
            active={tradeSub === null}
            accessibilityLabel={t('templates.tradeSub.all')}
            onPress={() => {
              animateResults();
              setTradeSub(null);
            }}
          />
          {TRADE_SUBS.filter((sub) => subCounts[sub] > 0).map((sub) => (
            <FilterPill
              key={sub}
              label={tDynamic(`templates.tradeSub.${sub}`, sub)}
              count={subCounts[sub]}
              active={tradeSub === sub}
              accessibilityLabel={tDynamic(`templates.tradeSub.${sub}`, sub)}
              onPress={() => {
                animateResults();
                setTradeSub(tradeSub === sub ? null : sub);
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Level */}
      <PillSegmented
        options={levelOptions}
        value={level ?? 'all'}
        onChange={(v) => {
          animateResults();
          setLevel(v === 'all' ? null : v);
        }}
        accessibilityLabel={t('templates.level.groupLabel')}
        columns={2}
        style={{ marginTop: spaceV2.x4 }}
      />

      {/* Favourites and collections: toggles that combine with a bubble */}
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={maxFontScaleV2}
        style={[text('footnote'), { color: c.muted, fontWeight: '600', marginTop: spaceV2.x4, marginBottom: spaceV2.x1 }]}
      >
        {t('templates.collectionsTitle')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -gutter }}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: spaceV2.x2, paddingVertical: spaceV2.x1 }}
      >
        <FilterPill
          label={t('templates.favourites')}
          count={counts.favorites}
          active={favoritesOnly}
          icon={<Ionicons name={favoritesOnly ? 'heart' : 'heart-outline'} size={16} color={favoritesOnly ? c.onInk : c.ink} />}
          accessibilityLabel={t('templates.favouritesChipLabel', { count: counts.favorites })}
          onPress={() => {
            animateResults();
            setFavoritesOnly((v) => !v);
          }}
        />
        {shownCollections.map((col) => (
          <FilterPill
            key={col.id}
            label={collectionName(col.id, col.label)}
            count={counts.collections[col.id]}
            active={collection === col.id}
            accessibilityLabel={t('templates.collectionChipLabel', {
              name: collectionName(col.id, col.label),
              count: counts.collections[col.id],
            })}
            onPress={() => {
              animateResults();
              setCollection((cur) => (cur === col.id ? null : col.id));
            }}
          />
        ))}
      </ScrollView>

      {/* Result count + clear */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spaceV2.x2 }}>
        <Text
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('subhead'), { color: c.muted, fontWeight: '500', flexShrink: 1 }]}
        >
          {t('templates.count', { count: total })}
        </Text>
        {anyActive ? (
          <Pressable
            onPress={clearAll}
            accessibilityRole="button"
            accessibilityLabel={t('templates.clearFiltersLabel')}
            style={{ minHeight: sizeV2.touch, minWidth: sizeV2.touch, justifyContent: 'center', alignItems: 'flex-end', paddingStart: spaceV2.x2 }}
          >
            <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.ink, fontWeight: '600' }]}>
              {t('templates.clearFilters')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Top cap of the pastel grid panel */}
      <View
        style={[
          squircle,
          { height: CAP, marginTop: spaceV2.x2, backgroundColor: pastel, borderTopStartRadius: CAP, borderTopEndRadius: CAP },
        ]}
      />
    </View>
  );

  const trimmed = deferredQuery.trim();
  const noFavouritesYet = favoritesOnly && favorites.length === 0 && !trimmed && shelf === 'all' && !level && !collection;
  const emptyTitle = noFavouritesYet ? t('templates.empty.noFavouritesTitle') : t('templates.empty.title');
  const emptyMessage = noFavouritesYet
    ? t('templates.empty.noFavouritesBody')
    : trimmed
      ? t('templates.empty.noMatchQuery', { query: trimmed })
      : t('templates.empty.noMatchFilters');

  // T89: the shared designed empty state (EmptyStateV2) inside the pastel panel, with one clear action
  // (clearAll fires the selection haptic itself).
  const empty = (
    <View style={{ backgroundColor: pastel, paddingHorizontal: PANEL }}>
      <EmptyStateV2
        art={noFavouritesYet ? 'favourites' : 'search'}
        title={emptyTitle}
        body={emptyMessage}
        action={
          noFavouritesYet
            ? { title: t('templates.empty.browseAll'), accessibilityHint: t('templates.empty.browseAllHint'), icon: 'grid', haptic: 'none', onPress: clearAll }
            : { title: t('templates.clearFilters'), accessibilityHint: t('templates.empty.clearHint'), icon: 'x-circle', haptic: 'none', onPress: clearAll }
        }
      />
    </View>
  );

  const footer = (
    <View>
      {/* Bottom cap of the pastel grid panel */}
      <View
        style={[
          squircle,
          { height: CAP, backgroundColor: pastel, borderBottomStartRadius: CAP, borderBottomEndRadius: CAP },
        ]}
      />
      {/* F5 (owner 17 Oct): where to find more pictures to trace. */}
      <View accessible accessibilityLabel={`${t('templates.tip.title')}. ${t('templates.tip.body')}`} style={{ marginTop: spaceV2.section }}>
        <BubbleCard fill={c.pastels[4]} elevation="none" sparkle sparkleColor={c.lilac} padding={spaceV2.x5}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spaceV2.x3 }}>
            <IconBubble icon="image" size={36} fill={c.card} color={c.ink} />
            <View style={{ flex: 1, paddingEnd: spaceV2.x5 }}>
              <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('headline'), { color: c.graphite }]}>
                {t('templates.tip.title')}
              </Text>
              <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.muted, marginTop: spaceV2.x1 }]}>
                {t('templates.tip.body')}
              </Text>
            </View>
          </View>
        </BubbleCard>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.FlatList
        ref={listRef}
        data={data}
        extraData={favSet}
        numColumns={2}
        keyExtractor={(tpl: Template) => tpl.id}
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Each grid row sits on the pastel panel.
        columnWrapperStyle={{ justifyContent: 'space-between', backgroundColor: pastel, paddingHorizontal: PANEL }}
        contentContainerStyle={{
          paddingTop: insets.top + BAR_HEIGHT,
          paddingHorizontal: gutter,
          // T92: the tab bar below already pads for the home indicator.
          paddingBottom: sceneBottomPad(insets.bottom, true, spaceV2.x8),
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        // Advanced templates are heavy SVGs: render a little at a time and keep a modest window.
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={60}
        windowSize={5}
      />
      {/* T92: a tab root, so no back chevron (the tab bar is the way out). */}
      <LargeTitleHeader title={t('common.nav.templates')} scrollY={scrollY} />
      <TemplateDetailSheet
        template={detail}
        favorite={detail ? favSet.has(detail.id) : false}
        onToggleFavorite={onToggleFavorite}
        onStart={startFromSheet}
        onClose={() => setDetail(null)}
      />
    </View>
  );
}

// Toggle chip in the v2 pill style: card fill + hairline, solid ink when on; springy press + selection haptic.
function FilterPill({
  label,
  count,
  active,
  icon,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  icon?: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { c, text } = useThemeV2();
  const { num } = useT();
  const fg = active ? c.onInk : c.graphite;
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={pressScaleV2}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      style={[
        squircle,
        {
          minHeight: sizeV2.touch,
          paddingHorizontal: spaceV2.x4,
          borderRadius: radiusV2.pill,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spaceV2.x1,
          backgroundColor: active ? c.ink : c.card,
          borderWidth: 1,
          borderColor: active ? c.ink : c.line,
        },
      ]}
    >
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {icon}
        </View>
      ) : null}
      <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: fg, fontWeight: '600' }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: active ? c.onInk : c.muted, fontVariant: ['tabular-nums'] }]}>
        {num(count)}
      </Text>
    </PressableScale>
  );
}

// Search field under the large title: a soft rounded field with a clear button (44 pt).
function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { c, text } = useThemeV2();
  const { t } = useT();
  const inputRef = useRef<TextInput>(null);
  return (
    <View
      style={[
        squircle,
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: sizeV2.touch,
          paddingStart: spaceV2.x3,
          borderRadius: radiusV2.sm,
          backgroundColor: c.card2,
          borderWidth: 1,
          borderColor: c.line,
        },
      ]}
    >
      <Feather
        name="search"
        size={18}
        color={c.muted}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        placeholder={t('templates.search.placeholder')}
        placeholderTextColor={c.muted}
        accessibilityLabel={t('templates.search.label')}
        accessibilityHint={t('templates.search.hint')}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        maxLength={80}
        onSubmitEditing={() => Keyboard.dismiss()}
        maxFontSizeMultiplier={maxFontScaleV2}
        style={[
          text('body'),
          { flex: 1, minHeight: sizeV2.touch, paddingHorizontal: spaceV2.x2, paddingVertical: 0, color: c.graphite },
        ]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => {
            select();
            onChange('');
            inputRef.current?.focus();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('templates.search.clear')}
          style={({ pressed }) => ({
            width: sizeV2.touch,
            height: sizeV2.touch,
            borderRadius: sizeV2.touch / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? c.inkSoft : 'transparent',
          })}
        >
          <Feather name="x-circle" size={20} color={c.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
