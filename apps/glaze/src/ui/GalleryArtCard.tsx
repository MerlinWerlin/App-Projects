// T177 (owner brief 31 Oct, docs/OWNER_1031.md): the art-led gallery card of the Themes tab. The
// theme's artwork fills the top of the card edge to edge at phone aspect (no mock chrome over it),
// then the name and the mood line on a soft surface. A catalogue theme (remote art pack) draws its
// remote thumbnail through expo-image with the catalogue ThumbHash as the instant placeholder
// (RemoteArtImage: memory-disk cache, so a seen thumbnail still shows offline); a bundled starter
// draws its bundled wallpaper (ThemeWallpaper). The whole card is one ≥ 48 pt button; the heart is
// a sibling so screen readers reach it on its own.
// docs/PREMIUM_UI.md §1-2: tokens only, depth from `surfaceRaised` in dark mode (no hairline), the
// one soft card shadow in light mode, Dynamic Type caps on every Text, a timed press (PressableScale,
// no spring). GalleryCardSkeleton is the same card while the catalogue is still empty.
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isRemoteArtTheme } from '../core/remoteCatalog';
import type { Theme } from '../core/themes';
import { useT } from '../i18n';
import { continuous, fontScaleCap, pressV2, radiusV2, shadowV2, sizeV2, spaceV2, textV2, typeV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { HeartButton } from './HeartButton';
import { PressableScale } from './PressableScale';
import { RemoteArtImage } from './RemoteArtImage';
import { Skeleton } from './Skeleton';
import { PHONE_ASPECT } from './ThemeCard';
import { ThemeWallpaper } from './ThemeWallpaper';
import { noMirror, textStyleFor } from './i18nLayout';

/** Artwork height for a card of `width` (phone aspect, like the 240 x 520 catalogue thumbs). */
export function galleryArtHeight(width: number): number {
  return Math.round(width * PHONE_ASPECT);
}

type Props = {
  theme: Theme;
  width: number;
  /** Stable handler from the screen: opens /theme/<id>. */
  onOpen: (id: string) => void;
  /** Optional pill over the art (e.g. the Plus badge for a catalogue pack marked Plus). */
  badge?: ReactNode;
  /** Extra words for the accessibility label (e.g. "Free download."). */
  accessibilityNote?: string;
  liked: boolean;
  onToggleLike: (id: string) => void;
};

export const GalleryArtCard = memo(function GalleryArtCard({ theme, width, onOpen, badge, accessibilityNote, liked, onToggleLike }: Props) {
  const { c, scheme } = useColorsV2();
  const { t, script } = useT();
  const artH = galleryArtHeight(width);
  const label = [t('themeUi.card.a11y', { name: theme.name, tagline: theme.tagline }), accessibilityNote ?? null].filter(Boolean).join(' ');
  return (
    <View style={[styles.wrap, { width }]}>
      <PressableScale
        onPress={() => onOpen(theme.id)}
        haptic="select"
        pressedScale={pressV2.card}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('themeUi.card.hint')}
        style={[styles.card, continuous, shadowV2('card', scheme), { width }]}
      >
        <View style={[styles.inner, continuous, { backgroundColor: scheme === 'dark' ? c.surfaceRaised : c.surface }]}>
          <View
            style={[styles.art, noMirror, { width, height: artH, backgroundColor: theme.palette.bg }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          >
            {isRemoteArtTheme(theme) ? (
              <RemoteArtImage theme={theme} width={width} height={artH} />
            ) : (
              <ThemeWallpaper theme={theme} width={width} height={artH} maxGrain={120} />
            )}
            {badge ? <View style={styles.badge}>{badge}</View> : null}
          </View>
          <View style={styles.text}>
            <Text maxFontSizeMultiplier={fontScaleCap('headline')} style={[textV2.headline, textStyleFor(script, textV2.headline), { color: c.ink }]}>
              {theme.name}
            </Text>
            <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[textV2.footnote, textStyleFor(script, textV2.footnote), { color: c.inkSecondary }]} numberOfLines={3}>
              {theme.tagline}
            </Text>
          </View>
        </View>
      </PressableScale>
      <HeartButton id={theme.id} name={theme.name} liked={liked} onToggle={onToggleLike} style={styles.heart} />
    </View>
  );
});

/** The same card while the catalogue is still empty: art block and two text lines, calm pulse. */
export const GalleryCardSkeleton = memo(function GalleryCardSkeleton({ width }: { width: number }) {
  const { c, scheme } = useColorsV2();
  const artH = galleryArtHeight(width);
  return (
    <View
      style={[styles.card, styles.inner, continuous, shadowV2('card', scheme), { width, backgroundColor: scheme === 'dark' ? c.surfaceRaised : c.surface }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton width={width} height={artH} radius={0} />
      <View style={styles.text}>
        <Skeleton width="70%" height={typeV2.headline.lineHeight} />
        <Skeleton width="90%" height={typeV2.footnote.lineHeight} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {},
  card: { minHeight: sizeV2.touch, borderRadius: radiusV2.cardLarge },
  inner: { borderRadius: radiusV2.cardLarge, overflow: 'hidden' },
  art: { overflow: 'hidden' },
  badge: { position: 'absolute', top: spaceV2.sm, end: spaceV2.sm },
  text: { gap: spaceV2.xs, paddingHorizontal: spaceV2.md, paddingTop: spaceV2.md, paddingBottom: spaceV2.md, paddingEnd: sizeV2.touch },
  /** Placement only; HeartButton is the ≥ 48 pt target. */
  heart: { position: 'absolute', bottom: 0, end: 0 },
});
