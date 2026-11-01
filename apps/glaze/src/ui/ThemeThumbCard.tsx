// T253/T254 (owner-1101h #4-5): the thumbnail card of the Themes front page's All themes grid and
// the category grids. Fixed geometry (art at phone aspect + one name row of sizeV2.touch), so the
// grid can use getItemLayout (src/core/themeBrowse.ts gridGeometry). Thumbnails only: a catalogue
// theme draws its small remote thumbnail (RemoteArtImage: expo-image, ThumbHash placeholder,
// memory-disk cache; loads only once the virtualised list mounts the cell); a bundled theme draws
// its bundled wallpaper. Nothing here downloads a pack (that waits until the theme is opened).
// The whole card is one ≥ 48 pt button; the heart is a sibling so screen readers reach it alone.
// Tokens only (docs/DESIGN_V2.md), Dynamic Type cap on the name, no spring.
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isRemoteArtTheme } from '../core/remoteCatalog';
import type { Theme } from '../core/themes';
import { useT } from '../i18n';
import { continuous, fontScaleCap, pressV2, radiusV2, shadowV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { HeartButton } from './HeartButton';
import { PressableScale } from './PressableScale';
import { RemoteArtImage } from './RemoteArtImage';
import { ThemeWallpaper } from './ThemeWallpaper';
import { noMirror, textStyleFor } from './i18nLayout';

/** Height of the name row under the art (fixed, so every card in the grid is the same height). */
export const THUMB_LABEL_HEIGHT = sizeV2.touch;

type Props = {
  theme: Theme;
  width: number;
  /** Art height (gridGeometry().artHeight). */
  artHeight: number;
  onOpen: (id: string) => void;
  badge?: ReactNode;
  accessibilityNote?: string;
  liked: boolean;
  onToggleLike: (id: string) => void;
};

export const ThemeThumbCard = memo(function ThemeThumbCard({ theme, width, artHeight, onOpen, badge, accessibilityNote, liked, onToggleLike }: Props) {
  const { c, scheme } = useColorsV2();
  const { t, script } = useT();
  const label = [t('themeUi.card.a11y', { name: theme.name, tagline: theme.tagline }), accessibilityNote ?? null].filter(Boolean).join(' ');
  return (
    <View style={{ width }}>
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
            style={[styles.art, noMirror, { width, height: artHeight, backgroundColor: theme.palette.bg }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          >
            {isRemoteArtTheme(theme) ? (
              <RemoteArtImage theme={theme} width={width} height={artHeight} />
            ) : (
              <ThemeWallpaper theme={theme} width={width} height={artHeight} maxGrain={60} />
            )}
            {badge ? <View style={styles.badge}>{badge}</View> : null}
          </View>
          <View style={styles.label}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={fontScaleCap('footnote')}
              style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.name, { color: c.ink }]}
            >
              {theme.name}
            </Text>
          </View>
        </View>
      </PressableScale>
      <HeartButton id={theme.id} name={theme.name} liked={liked} onToggle={onToggleLike} style={styles.heart} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: { minHeight: sizeV2.touch, borderRadius: radiusV2.card },
  inner: { borderRadius: radiusV2.card, overflow: 'hidden' },
  art: { overflow: 'hidden' },
  badge: { position: 'absolute', top: spaceV2.xs, end: spaceV2.xs },
  label: { height: THUMB_LABEL_HEIGHT, justifyContent: 'center', paddingStart: spaceV2.sm, paddingEnd: sizeV2.touch },
  name: { fontWeight: '600' },
  /** Placement only; HeartButton is the ≥ 48 pt target. */
  heart: { position: 'absolute', bottom: 0, end: 0 },
});
