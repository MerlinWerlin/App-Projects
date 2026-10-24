// Theme home showcase grid (T57, owner request 18 Oct M4a, market lesson L1): a two-column grid
// of tall rounded cards, each a full Home Screen preview on the theme's wallpaper. Swiping the
// grid left/right steps between pages (direction follows reading order). Maths in
// src/core/categoryPaging.ts.
// T77: a heart on each card likes the theme (device-local, src/store/favourites.ts). It is a
// sibling of the card, not inside it, so screen readers reach it as its own button. No counts.
// The heart itself is the shared src/ui/HeartButton.tsx.
// T107 (fb-1022-perf): a page change no longer runs a layout spring, a zoom and a fade-out on every
// card (that work, all at once, made the bubble bounce stutter). After a swap the first two rows
// mount at once and the rest a few per frame (core/categorySwitch revealSteps), with same-sized
// light placeholders holding their place.
// fb-1022c (owner 22 Oct evening: "some very generic, chill transition"): a page change is a plain
// cross-fade of the whole grid (opacity only, GRID_FADE_MS ease-out on the UI thread): no slide,
// no spring, no stagger, no zoom, no layout animation, and the grid does not follow the finger.
// T118 (fb-1024 B, owner 24 Oct: "a little laggy moving around the UI"): the grid is memoised (the
// screen re-rendering for its own state no longer walks the cards); the first mount is progressive
// too (it used to mount every card of the page in the tab's first frame); cards already mounted
// before a swap or a search keystroke stay mounted (core/perfReveal keptAcrossSwap) instead of
// turning back into placeholders; the previews are still Home Screens (no per-icon animation
// hooks) with icon specs from a module cache.
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { pageTransition, showcaseCardWidth, showcaseColumns, swipeStep } from '../core/categoryPaging';
import { REVEAL_FIRST, nextReveal } from '../core/categorySwitch';
import { isMounted, keptAcrossSwap } from '../core/perfReveal';
import type { Theme } from '../core/themes';
import { useT } from '../i18n';
import { WallpaperView } from '../render/WallpaperView';
import { easeOutCurve } from '../theme/motion';
import { continuous } from '../theme/tokensV2';
import { radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { HOME_ASPECT, HomeMock } from './HomeMock';
import { HeartButton } from './HeartButton';
import { SquircleCard } from './SquircleCard';
import { noMirror, textStyleFor } from './i18nLayout';
import { cachedPreviewSpecs } from './previewCache';

type GridProps = {
  themes: readonly Theme[];
  /** Index of the page on show, and how many pages there are (for swiping and the slide). */
  pageIndex: number;
  pageCount: number;
  /** A finished swipe asks for the next (+1) or previous (-1) page. */
  onStep: (step: -1 | 1) => void;
  onOpen: (id: string) => void;
  /** Ids of Glaze Plus themes: they carry `plusBadge` and `plusNote`. */
  plusIds: ReadonlySet<string>;
  plusBadge?: ReactNode;
  plusNote?: string;
  /** T106: free themes in the new collections carry `freeBadge` and `freeNote`. */
  freeIds?: ReadonlySet<string>;
  freeBadge?: ReactNode;
  freeNote?: string;
  /** Which themes show the "New" pill (decided by the screen with core/categories isNew). */
  newIds: ReadonlySet<string>;
  /** Shown instead of the grid when the page has no themes. */
  empty?: ReactNode;
  /** T77: liked theme ids (device-local). Hearts show only when `onToggleLike` is given. */
  likedIds?: ReadonlySet<string>;
  onToggleLike?: (id: string) => void;
  /** fb-1023: when this changes (a search chip, sub-tab or collection), the grid does the same calm fade as a page change. */
  fadeKey?: string;
};

const NO_KEPT: ReadonlySet<string> = new Set<string>();
const idsOf = (xs: readonly Theme[]): string[] => xs.map((x) => x.id);

export const ShowcaseGrid = memo(function ShowcaseGrid({ themes, pageIndex, onStep, onOpen, plusIds, plusBadge, plusNote, freeIds, freeBadge, freeNote, newIds, empty, likedIds, onToggleLike, fadeKey = '' }: GridProps) {
  const { isRTL } = useT();
  const { width } = useWindowDimensions();
  const columns = showcaseColumns(width);
  const gap = spaceV2.md;
  const cardWidth = showcaseCardWidth(width, columns, spaceV2.lg, gap);

  // Page change: the whole grid fades up from GRID_FADE_FROM (opacity only, ease-out).
  const fade = useSharedValue(1);
  const lastPage = useRef(pageIndex);
  const lastKey = useRef(fadeKey);
  useEffect(() => {
    const from = lastPage.current;
    const keyChanged = lastKey.current !== fadeKey;
    lastPage.current = pageIndex;
    lastKey.current = fadeKey;
    // fb-1023: a chip / sub-tab swap counts as a change too (same opacity-only fade, no slide or scale).
    const tr = pageTransition(from, keyChanged && from === pageIndex ? from + 1 : pageIndex);
    if (tr.kind === 'none') return;
    fade.value = tr.fromOpacity;
    fade.value = withTiming(1, { duration: tr.durationMs, easing: easeOutCurve });
  }, [pageIndex, fadeKey, fade]);
  const gridStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-14, 14])
        .runOnJS(true)
        .onEnd((e) => {
          const step = swipeStep(e.translationX, e.velocityX, width, isRTL);
          if (step !== 0) onStep(step);
        }),
    [width, isRTL, onStep],
  );

  // Progressive mount (first mount and after a swap): first rows now, the rest a few cards per
  // frame. T118: cards mounted before the swap stay mounted (`kept`).
  const [revealed, setRevealed] = useState(() => Math.min(themes.length, REVEAL_FIRST));
  const [kept, setKept] = useState<ReadonlySet<string>>(NO_KEPT);
  const [shownThemes, setShownThemes] = useState(themes);
  if (shownThemes !== themes) {
    // Render-phase reset (React's "adjust state when a prop changes" pattern), no extra commit.
    setKept(keptAcrossSwap(idsOf(shownThemes), revealed, kept, idsOf(themes)));
    setShownThemes(themes);
    setRevealed(Math.min(themes.length, REVEAL_FIRST));
  }
  useEffect(() => {
    if (revealed >= themes.length) return;
    const raf = requestAnimationFrame(() => setRevealed((n) => nextReveal(n, themes.length)));
    return () => cancelAnimationFrame(raf);
  }, [revealed, themes.length]);
  const h = Math.round(Math.max(120, cardWidth) * HOME_ASPECT);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.wrap, gridStyle]} collapsable={false}>
        {themes.length === 0 ? (
          empty ?? null
        ) : (
          <View style={[styles.grid, { gap }]}>
            {themes.map((theme, i) => {
              if (!isMounted(i, revealed, kept, theme.id)) {
                return <CardPlaceholder key={theme.id} width={cardWidth} height={h} colour={theme.palette.bg} />;
              }
              return (
              <View key={theme.id} style={{ width: cardWidth }}>
                <ShowcaseCard
                  theme={theme}
                  width={cardWidth}
                  onOpen={onOpen}
                  isNew={newIds.has(theme.id)}
                  badge={plusIds.has(theme.id) ? plusBadge : freeIds?.has(theme.id) ? freeBadge : undefined}
                  note={plusIds.has(theme.id) ? plusNote : freeIds?.has(theme.id) ? freeNote : undefined}
                  liked={likedIds?.has(theme.id) ?? false}
                  onToggleLike={onToggleLike}
                />
              </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

/** Same footprint as a card (preview + name row), drawn in the theme's base colour. */
const CardPlaceholder = memo(function CardPlaceholder({ width, height, colour }: { width: number; height: number; colour: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.placeholder, continuous, { width, height: height + PLACEHOLDER_NAME_ROW, backgroundColor: colour }]}
    />
  );
});

/** Approximate height of a card's name row (headline + padding), so placeholders hold the layout. */
const PLACEHOLDER_NAME_ROW = 52;

type CardProps = {
  theme: Theme;
  width: number;
  onOpen: (id: string) => void;
  isNew: boolean;
  badge?: ReactNode;
  note?: string;
  liked: boolean;
  onToggleLike?: (id: string) => void;
};

/** One tall preview card: the theme's whole Home Screen, with its name underneath. */
const ShowcaseCard = memo(function ShowcaseCard({ theme, width, onOpen, isNew, badge, note, liked, onToggleLike }: CardProps) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  const specs = cachedPreviewSpecs(theme, 20);
  const h = Math.round(Math.max(120, width) * HOME_ASPECT);
  const label = [t('themeUi.card.a11y', { name: theme.name, tagline: theme.tagline }), isNew ? t('themes.badge.newA11y') : null, note ?? null]
    .filter(Boolean)
    .join(' ');

  return (
    <View>
      <SquircleCard
        size="large"
        padding={0}
        haptic="select"
        onPress={() => onOpen(theme.id)}
        accessibilityLabel={label}
        accessibilityHint={t('themeUi.card.hint')}
      >
        <View
          style={noMirror}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          <HomeMock
            specs={specs}
            width={width}
            maxIcons={20}
            dockCount={4}
            backgroundColour={theme.palette.bg}
            still
            background={<WallpaperView params={theme.wallpaper} width={width} height={h} maxGrain={96} />}
          />
          {badge ? <View style={styles.badge}>{badge}</View> : null}
          {isNew ? (
            <View style={[styles.newPill, { backgroundColor: c.tint }]}>
              <Text style={[textV2.caption2, textStyleFor(script, textV2.caption2), { color: c.onTint }]}>{t('themes.badge.new')}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.text, onToggleLike ? styles.textWithHeart : null]}>
          <Text style={[textV2.headline, textStyleFor(script, textV2.headline), { color: c.ink }]}>{theme.name}</Text>
        </View>
      </SquircleCard>
      {onToggleLike ? <HeartButton id={theme.id} name={theme.name} liked={liked} onToggle={onToggleLike} style={styles.heart} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { minHeight: 48 },
  placeholder: { borderRadius: radiusV2.cardLarge, opacity: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: { position: 'absolute', top: spaceV2.sm, right: spaceV2.sm },
  newPill: {
    position: 'absolute',
    top: spaceV2.sm,
    left: spaceV2.sm,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xxs,
    borderRadius: radiusV2.pill,
  },
  text: { paddingHorizontal: spaceV2.md, paddingVertical: spaceV2.md },
  /** Room for the heart at the reading end of the name row. */
  textWithHeart: { paddingEnd: sizeV2.touch + spaceV2.xxs },
  /** Placement only; HeartButton is the ≥ 48 pt target. */
  heart: { position: 'absolute', bottom: 0, end: spaceV2.xxs },
});
