// T77 (shots-1018 L6): the favourites heart, shared by the Themes showcase cards, the pack-section
// ThemeCards and the Wallpapers tiles. A ≥ 48 pt toggle; the caller places it (usually absolute,
// at the reading end of the card's name row) as a sibling of the card so screen readers reach it
// as its own button. Likes are device-local (src/store/favourites.ts). It never shows a count.
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { circleRadius, onArtV2, sizeV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { haptic } from './haptics';

/** Glyph colour over wallpaper art (on the dark disc). */
const ON_ART = onArtV2.ink;

export type HeartKind = 'theme' | 'wallpaper';

export type HeartButtonProps = {
  /** The id the heart likes (a theme id for both kinds). */
  id: string;
  /** Spoken name, e.g. the theme name. */
  name: string;
  liked: boolean;
  onToggle: (id: string) => void;
  /** Which copy to use: liking a theme or liking a wallpaper. */
  kind?: HeartKind;
  /** Drawn over artwork: a small dark disc behind a white glyph so it reads on any wallpaper. */
  onArt?: boolean;
  /** Placement from the caller (position, offsets). */
  style?: StyleProp<ViewStyle>;
};

/** T118: memoised; callers pass a stable `onToggle` and a StyleSheet `style`. */
export const HeartButton = memo(function HeartButton({ id, name, liked, onToggle, kind = 'theme', onArt = false, style }: HeartButtonProps) {
  const { c } = useColorsV2();
  const { t } = useT();
  let label: string;
  let hint: string;
  if (kind === 'wallpaper') {
    label = liked ? t('tabs.wallpapersTab.like.remove', { name }) : t('tabs.wallpapersTab.like.add', { name });
    hint = t('tabs.wallpapersTab.like.hint');
  } else {
    label = liked ? t('themes.like.remove', { name }) : t('themes.like.add', { name });
    hint = t('themes.like.hint');
  }
  const colour = onArt ? ON_ART : liked ? c.tint : c.inkSecondary;
  return (
    <Pressable
      onPress={() => {
        haptic(liked ? 'select' : 'light');
        onToggle(id);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: liked }}
      style={({ pressed }: { pressed: boolean }) => [styles.heart, style, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={onArt ? styles.disc : null}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={colour} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  heart: {
    width: sizeV2.touch,
    height: sizeV2.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: 34,
    height: 34,
    borderRadius: circleRadius(34),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
