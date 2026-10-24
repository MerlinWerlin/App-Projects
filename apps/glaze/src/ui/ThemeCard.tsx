// ThemeCard: a theme in the gallery: mini Home Screen on the theme's wallpaper, name,
// tagline and palette dots. The whole card is one button (≥ 48 pt).
// Polish (docs/POLISH.md G1, T34): with `scrollY`/`viewportH` the wallpaper artwork drifts and
// scales slightly as the card crosses the viewport centre (UI thread, transform only); bumping
// `popKey` springs the mini icons in staggered; `staggerIndex` fades the card in on first mount.
// Reduce Motion: no parallax, no pop, a short fade instead of the stagger.
// T77: with `onToggleLike` a heart (src/ui/HeartButton.tsx) sits at the bottom reading end, so
// pack themes can be liked too and show up in the Themes tab's Liked sub-tab.
// Design v2 (T84): a large squircle card on `surface` with the `card` shadow on the outer view and
// the content clipped by an inner view; system headline/footnote type, tint "New" pill.
// T118 (fb-1024 B): `baseY` (a shared value) carries the grid's position for the parallax, so a
// layout change above the grid moves the cards on the UI thread without re-rendering them; icon
// specs come from a module cache; a card that never pops draws a still Home Screen (no per-icon
// animation hooks).
// T130: an art-pack theme shows its bundled wallpaper image (src/ui/ThemeWallpaper.tsx).

import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { DisplayFont } from '../core/artwork';
import { artworkTransform, cardProgress } from '../core/galleryMotion';
import type { Theme } from '../core/themes';
import { useT } from '../i18n';
import { staggerIn, useMotionReduced } from '../theme/motion';
import { continuous, pressV2, radiusV2, shadowV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { HeartButton } from './HeartButton';
import { HomeMock } from './HomeMock';
import { PressableScale } from './PressableScale';
import { noMirror, textStyleFor } from './i18nLayout';
import { cachedPreviewSpecs } from './previewCache';
import { ThemeWallpaper } from './ThemeWallpaper';

/** Portrait phone aspect (height / width) used for preview backgrounds. */
export const PHONE_ASPECT = 874 / 402;

type Props = {
  theme: Theme;
  /** Card width in points. */
  width: number;
  /** Called on tap (use `onOpen` for a stable, memo-friendly handler). */
  onPress?: () => void;
  /** Called on tap with the theme id; preferred over `onPress` in long lists. */
  onOpen?: (id: string) => void;
  /** Optional badge drawn over the preview (e.g. a Plus pill). */
  badge?: ReactNode;
  /** Extra words for the accessibility label (e.g. "Glaze Plus"). */
  accessibilityNote?: string;
  /** Gallery scroll offset (UI thread). With `viewportH`, enables the artwork parallax. */
  scrollY?: SharedValue<number>;  /** Gallery viewport height (UI thread). */
  viewportH?: SharedValue<number>;
  /** Y of the card's parent grid inside the scroll content, in points. */
  offsetY?: number;
  /**
   * T118: Y of the card's parent grid as a shared value (added to `offsetY` on the UI thread).
   * Preferred in long lists: the grid moving never re-renders the card.
   */
  baseY?: SharedValue<number>;
  /** Reports the card centre in scroll-content coordinates (for "which card settled"). */
  onCentre?: (id: string, centreY: number) => void;
  /** Change (> 0) to pop the mini Home Screen icons in staggered. 0 = still. */
  popKey?: number;
  /** Stagger slot for the first-mount entering animation; omit for none. */
  staggerIndex?: number;
  /** Show the "New" pill (R4; the gallery decides with core/categories isNew). */
  isNew?: boolean;
  /** T77: whether this theme is liked on this device. The heart shows only with `onToggleLike`. */
  liked?: boolean;
  /** T77: likes / unlikes the theme (device-local, src/store/favourites.ts). */
  onToggleLike?: (id: string) => void;
};

export type ThemeCardProps = Props;

/** System fonts for a theme's display-type hint (iOS family names; Android generic families). */
export function displayFontStyle(hint: DisplayFont | undefined): TextStyle | null {
  switch (hint) {
    case 'serif':
      return { fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontWeight: '700' };
    case 'script':
      return { fontFamily: Platform.select({ ios: 'Snell Roundhand', default: 'serif' }), fontWeight: '700' };
    case 'mono':
      return { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontWeight: '700' };
    case 'rounded':
      return { fontFamily: Platform.select({ ios: 'Avenir Next', default: 'sans-serif-medium' }), fontWeight: '700' };
    default:
      return null; // 'display': the system headline face (textV2.headline)
  }
}

export const ThemeCard = memo(function ThemeCard({
  theme,
  width,
  onPress,
  onOpen,
  badge,
  accessibilityNote,
  scrollY,
  viewportH,
  offsetY = 0,
  baseY,
  onCentre,
  popKey = 0,
  staggerIndex,
  isNew = false,
  liked = false,
  onToggleLike,
}: Props) {
  const { c, scheme } = useColorsV2();
  const { t, script } = useT();
  const small = [textV2.footnote, textStyleFor(script, textV2.footnote)];
  const reduced = useMotionReduced();
  const inner = Math.max(80, width - spaceV2.sm * 2);
  const artH = inner * PHONE_ASPECT;
  const specs = cachedPreviewSpecs(theme, 8);
  const dots = [theme.palette.bg, theme.palette.surface, theme.palette.accent, theme.palette.glyph];

  // The entering animation is decided once, at mount (the gallery passes an index on its first mount only).
  const entering = useRef(staggerIndex === undefined ? undefined : staggerIn(staggerIndex, reduced)).current;

  // Card centre in scroll-content coordinates, mirrored to the UI thread for the parallax.
  const box = useRef<{ y: number; h: number } | null>(null);
  const centre = useSharedValue(Number.NaN);
  const publish = useCallback(() => {
    const b = box.current;
    if (!b) return;
    const y = offsetY + b.y + b.h / 2;
    centre.value = y;
    onCentre?.(theme.id, y);
  }, [offsetY, onCentre, theme.id, centre]);
  useEffect(() => {
    publish();
  }, [publish]);
  const tracked = scrollY !== undefined || onCentre !== undefined;
  const onLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    box.current = { y, h: height };
    publish();
  };

  const parallax = scrollY !== undefined && viewportH !== undefined && !reduced;
  const maxShift = Math.min(12, artH * 0.035);
  const artStyle = useAnimatedStyle(() => {
    if (!parallax || !scrollY || !viewportH || !Number.isFinite(centre.value)) {
      return { transform: [{ translateY: 0 }, { scale: 1 }] };
    }
    const p = cardProgress(centre.value + (baseY ? baseY.value : 0), scrollY.value, viewportH.value);
    const t = artworkTransform(p, artH, maxShift, 0.04);
    return { transform: [{ translateY: t.translateY }, { scale: t.scale }] };
  }, [parallax, artH, maxShift, baseY]);

  const handlePress = () => {
    if (onOpen) onOpen(theme.id);
    else onPress?.();
  };

  return (
    <Animated.View entering={entering} onLayout={tracked ? onLayout : undefined} style={{ width }}>
      <PressableScale
        onPress={handlePress}
        haptic="select"
        pressedScale={pressV2.card}
        accessibilityRole="button"
        accessibilityLabel={[
          t('themeUi.card.a11y', { name: theme.name, tagline: theme.tagline }),
          isNew ? t('themes.badge.newA11y') : null,
          accessibilityNote ?? null,
        ]
          .filter(Boolean)
          .join(' ')}
        accessibilityHint={t('themeUi.card.hint')}
        style={[styles.card, continuous, shadowV2('card', scheme), { width }]}
      >
        {/* The shadow sits on the pressable; this view clips the artwork to the continuous corners. */}
        <View
          style={[
            styles.cardInner,
            continuous,
            { backgroundColor: c.surface },
            scheme === 'dark' ? { borderColor: c.separator, borderWidth: StyleSheet.hairlineWidth } : null,
          ]}
        >
          <View
            style={[styles.preview, continuous, noMirror, { width: inner }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          >
            <HomeMock
              specs={specs}
              width={inner}
              maxIcons={8}
              dockCount={0}
              backgroundColour={theme.palette.bg}
              animateIcons={popKey > 0 && !reduced ? 'pop' : false}
              animateKey={popKey}
              still={popKey === 0}
              background={
                <Animated.View style={[{ width: inner, height: artH }, artStyle]}>
                  <ThemeWallpaper theme={theme} width={inner} height={artH} maxGrain={120} />
                </Animated.View>
              }
            />
            {badge ? <View style={styles.badge}>{badge}</View> : null}
            {isNew ? (
              <View style={[styles.newPill, { backgroundColor: c.tint }]}>
                <Text style={[textV2.caption1, textStyleFor(script, textV2.caption1), styles.newText, { color: c.onTint }]}>
                  {t('themes.badge.new')}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.text, onToggleLike ? styles.textWithHeart : null]}>
            <Text
              style={[textV2.headline, textStyleFor(script, textV2.headline), displayFontStyle(theme.art?.displayFont), { color: c.ink }]}
              numberOfLines={2}
            >
              {theme.name}
            </Text>
            <Text style={[...small, { color: c.inkSecondary }]} numberOfLines={2}>
              {theme.tagline}
            </Text>
            <View style={styles.dots}>
              {dots.map((d, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: d, borderColor: c.separator }]} />
              ))}
            </View>
          </View>
        </View>
      </PressableScale>
      {/* T77: a sibling of the card button, so screen readers reach it on its own. No counts. */}
      {onToggleLike ? <HeartButton id={theme.id} name={theme.name} liked={liked} onToggle={onToggleLike} style={styles.heart} /> : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { minHeight: sizeV2.touch, borderRadius: radiusV2.cardLarge },
  cardInner: {
    borderRadius: radiusV2.cardLarge,
    padding: spaceV2.sm,
    gap: spaceV2.sm,
    overflow: 'hidden',
  },
  preview: { borderRadius: radiusV2.cardLarge - spaceV2.sm, overflow: 'hidden' },
  badge: { position: 'absolute', top: spaceV2.xs, right: spaceV2.xs },
  newPill: {
    position: 'absolute',
    top: spaceV2.xs,
    left: spaceV2.xs,
    paddingHorizontal: spaceV2.sm,
    paddingVertical: spaceV2.xxs,
    borderRadius: radiusV2.pill,
  },
  newText: { fontWeight: '600' },
  text: { gap: spaceV2.xxs, paddingHorizontal: spaceV2.xs, paddingBottom: spaceV2.xs },
  /** Room for the heart at the reading end of the text block. */
  textWithHeart: { paddingEnd: sizeV2.touch },
  /** Placement only; HeartButton is the ≥ 48 pt target. */
  heart: { position: 'absolute', bottom: 0, end: 0 },
  dots: { flexDirection: 'row', gap: 6, marginTop: spaceV2.xs },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
});
