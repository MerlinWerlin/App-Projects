// Theme home category bubbles (T57, owner request 18 Oct M4a; docs/DESIGN_V2.md "category
// bubbles"): a horizontally snapping row of big pastel squircle tiles, each with original
// artwork (CategoryBubbleArt) and a label underneath. Geometry and the look curve come from
// src/core/categoryPaging.ts (tested in Node).
// T107 (fb-1022-perf): the selected key lives in a SelectionStore (src/core/categorySwitch.ts), not
// in props. Each bubble subscribes to its own key, so a press re-renders the old and the new bubble
// only; the pressed bubble starts its change in the press handler, on the UI thread.
// fb-1022c (owner 22 Oct evening: "the bounce is too full on"): no bounce, no scale, no spring.
// The selected bubble keeps its size; a tint ring and soft glow fade in over BUBBLE_FADE_MS with an
// ease-out curve (opacity only), the old one fades out, and the row scrolls the selected bubble
// into view. Pressing a bubble dims it slightly instead of shrinking it.
import { memo, useCallback, useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  BUBBLE_FADE_MS,
  BUBBLE_PASTEL,
  bubbleLook,
  bubbleMetrics,
  bubbleSnapOffsets,
  revealOffset,
  type BrowseKey,
} from '../core/categoryPaging';
import type { SelectionStore } from '../core/categorySwitch';
import { useT } from '../i18n';
import { easeOutCurve, useMotionReduced } from '../theme/motion';
import { continuous, radiusV2, shadowV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { CategoryBubbleArt } from './CategoryBubbleArt';
import { PressableScale } from './PressableScale';
import { textStyleFor } from './i18nLayout';
import { useIsSelected } from './useSelection';

export type BubblePage = {
  key: BrowseKey;
  /** Translated category name. */
  label: string;
  /** Real number of themes on this page (for the accessibility label only). */
  count: number;
};

type RowProps = {
  pages: readonly BubblePage[];
  /** Selected page (T107: a store, so a press re-renders two bubbles, not the row). */
  store: SelectionStore<BrowseKey>;
  onSelect: (key: BrowseKey) => void;
};

export const CategoryBubbleRow = memo(function CategoryBubbleRow({ pages, store, onSelect }: RowProps) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const reduced = useMotionReduced();
  const m = bubbleMetrics(width, spaceV2.lg, spaceV2.md);
  const scroller = useRef<ScrollView>(null);
  const viewportW = useRef(width);
  const count = pages.length;
  const snaps = bubbleSnapOffsets(count, m, viewportW.current);
  // Latest pages for the store listener without re-subscribing.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // Keep the selected bubble in view (with the previous one peeking) whenever it changes; this
  // listens to the store directly, so the row itself never re-renders for a selection change.
  useEffect(() => {
    const reveal = (animated: boolean) => {
      const list = pagesRef.current;
      const index = Math.max(
        0,
        list.findIndex((p) => p.key === store.get()),
      );
      const x = revealOffset(index, list.length, m, viewportW.current);
      scroller.current?.scrollTo({ x, animated });
    };
    reveal(false);
    return store.subscribe(() => reveal(!reduced));
  }, [store, count, m.size, m.gap, m.inset, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable press handler so memoised bubbles skip re-rendering.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const select = useCallback((key: BrowseKey) => onSelectRef.current(key), []);

  const onLayout = (e: LayoutChangeEvent) => {
    viewportW.current = e.nativeEvent.layout.width;
  };

  // Room above and below for the glow.
  const grow = spaceV2.sm;

  return (
    <ScrollView bounces={false} overScrollMode="never"
      ref={scroller}
      horizontal
      onLayout={onLayout}
      showsHorizontalScrollIndicator={false}
      snapToOffsets={snaps}
      snapToEnd={false}
      decelerationRate="fast"
      accessibilityRole="tablist"
      accessibilityLabel={t('themes.category.rowLabel')}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.row,
        { gap: m.gap, paddingHorizontal: m.inset, paddingVertical: grow },
      ]}
      style={styles.scroll}
    >
      {pages.map((p) => (
        <Bubble
          key={p.key}
          page={p}
          size={m.size}
          store={store}
          onSelect={select}
        />
      ))}
    </ScrollView>
  );
});

type BubbleProps = {
  page: BubblePage;
  size: number;
  store: SelectionStore<BrowseKey>;
  onSelect: (key: BrowseKey) => void;
};

/** Bubbles re-render only when their own page data or selected state changes. */
function samePage(a: BubbleProps, b: BubbleProps): boolean {
  return (
    a.page.key === b.page.key &&
    a.page.label === b.page.label &&
    a.page.count === b.page.count &&
    a.size === b.size &&
    a.store === b.store &&
    a.onSelect === b.onSelect
  );
}

const Bubble = memo(function Bubble({ page, size, store, onSelect }: BubbleProps) {
  const { c, scheme } = useColorsV2();
  const { t, script } = useT();
  const selected = useIsSelected(store, page.key);
  const pastel = c.pastels[BUBBLE_PASTEL[page.key]];
  const progress = useSharedValue(selected ? 1 : 0);
  // Last target sent, so the store echo after a press doesn't restart the running fade.
  const target = useRef(selected ? 1 : 0);

  const animateTo = useCallback(
    (to: number) => {
      if (target.current === to) return;
      target.current = to;
      progress.value = withTiming(to, { duration: BUBBLE_FADE_MS, easing: easeOutCurve });
    },
    [progress],
  );
  // Deselection (and selection from a swipe or reset) follows the store.
  useEffect(() => {
    animateTo(selected ? 1 : 0);
  }, [selected, animateTo]);

  const onPress = useCallback(() => {
    // Start the fade on this frame, before any React work for the grid.
    if (store.get() !== page.key) animateTo(1);
    onSelect(page.key);
  }, [store, page.key, animateTo, onSelect]);

  const ringStyle = useAnimatedStyle(() => {
    const look = bubbleLook(progress.value);
    return { opacity: look.tint };
  }, []);
  const glowStyle = useAnimatedStyle(() => {
    const look = bubbleLook(progress.value);
    return { opacity: look.glow };
  }, []);

  const radius = radiusV2.cardLarge;
  // Soft halo in the tint colour: a layered shadow on iOS, a tint fill + elevation on Android.
  const glow =
    Platform.OS === 'ios'
      ? { boxShadow: `0px 0px 22px 4px ${c.tint}`, backgroundColor: pastel.fill }
      : { backgroundColor: c.tint, elevation: 6 };
  const labelStyle = [textV2.subhead, textStyleFor(script, textV2.subhead)];

  return (
    <PressableScale
      onPress={onPress}
      feedback="fade"
      haptic="select"
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={t('themes.category.a11y', { label: page.label, count: page.count })}
      accessibilityHint={t('themes.bubbles.hint')}
      style={[styles.bubble, { width: size }]}
    >
      <View style={{ width: size, height: size }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, continuous, { borderRadius: radius }, glow, glowStyle]}
        />
        <View
          style={[
            styles.tile,
            continuous,
            shadowV2('card', scheme),
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: pastel.fill,
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <CategoryBubbleArt page={page.key} size={Math.round(size * 0.62)} ink={pastel.ink} accent={c.tint} light={c.surface} />
        </View>
        {/* Selected tint ring: fades in/out (opacity only), never resizes the bubble. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, continuous, styles.ring, { borderRadius: radius, borderColor: c.tint }, ringStyle]}
        />
      </View>
      <Text
        style={[labelStyle, styles.label, styles.labelWeight, { color: selected ? c.ink : c.inkSecondary }]}
      >
        {page.label}
      </Text>
    </PressableScale>
  );
}, samePage);

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { alignItems: 'flex-start' },
  bubble: { alignItems: 'center', gap: spaceV2.sm, minHeight: 48 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2.5 },
  label: { textAlign: 'center' },
  /** One weight for every label, so selecting never re-flows the text. */
  labelWeight: { fontWeight: '600' },
});
