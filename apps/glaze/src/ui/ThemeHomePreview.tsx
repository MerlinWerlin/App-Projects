// Glaze 1.0.44 (owner 23-24 Nov 2026): the mini Home Screen over a theme card's art print. The print is
// the theme's wallpaper; the top band holds the first page of a Home Screen as it looks after applying
// the theme: a small widget (half the themes show their own Clock, the other half their best Artwork
// piece, alternating along every rail) with Phone, Messages and Camera beside it. Geometry, icon specs,
// the clock SVG and the art choice are pure and cached (src/core/cardPreview.ts, cardArtPlan.ts), the art
// ships in the app (assets/card-art, 256 px), so nothing downloads; the whole layer is decorative
// (hidden from VoiceOver, no touches) and draws nothing on tiny prints.
import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { cardClockSvg, cardIconSpecs, cardPreviewLayout } from '../core/cardPreview';
import type { IconSpec } from '../core/iconspec';
import { weakKeyedCache } from '../core/perfCache';
import type { Theme } from '../core/themes';
import { IconCanvas } from '../render/IconCanvas';
import { useT } from '../i18n';
import { continuous } from '../theme/tokensV2';
import { cardArtSource } from './cardArtSources';

const ICONS = weakKeyedCache<Theme, IconSpec[]>();

type Props = { theme: Theme; width: number; height: number };

export const ThemeHomePreview = memo(function ThemeHomePreview({ theme, width, height }: Props) {
  const { locale } = useT();
  const layout = useMemo(() => cardPreviewLayout(width, height), [width, height]);
  const icons = layout ? ICONS.get(theme, 'card', () => cardIconSpecs(theme)) : null;
  const art = cardArtSource(theme.id);
  const clock = useMemo(() => (layout && art == null ? cardClockSvg(theme, locale) : ''), [layout, art, theme, locale]);
  if (!layout || !icons) return null;
  const { widget } = layout;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.widget,
          continuous,
          { left: widget.x, top: widget.y, width: widget.size, height: widget.size, borderRadius: layout.widgetRadius },
          art != null ? { backgroundColor: theme.palette.bg } : null,
        ]}
      >
        {art != null ? (
          <Image source={art} contentFit="cover" cachePolicy="memory" recyclingKey={`card-art-${theme.id}`} transition={0} style={{ width: widget.size, height: widget.size }} />
        ) : (
          <SvgXml xml={clock} width={widget.size} height={widget.size} />
        )}
      </View>
      {icons.map((spec, i) => {
        const b = layout.icons[i];
        return b ? <IconCanvas key={spec.appId ?? i} spec={spec} size={b.size} morph={false} style={[styles.icon, { left: b.x, top: b.y }]} /> : null;
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  // No shadow: Home Screen widgets sit flat on the wallpaper, and a shadow costs a frame while scrolling.
  widget: { position: 'absolute', overflow: 'hidden' },
  icon: { position: 'absolute' },
});
