// Glaze 1.0.44 (owner 23 Nov 2026): the mini Home Screen over a theme card's art print. The print is the
// theme's wallpaper; its own small Clock widget sits in the 2×2 slot and Phone, Messages and Camera sit in
// a dock along the bottom, exactly as they'd look after applying the theme. Geometry, icon specs and the
// clock SVG are pure and cached (src/core/cardPreview.ts), so a card that scrolls back in reuses them;
// the whole layer is decorative (hidden from VoiceOver, no touches) and draws nothing on tiny prints.
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { cardClockSvg, cardIconSpecs, cardPreviewLayout, dockFill } from '../core/cardPreview';
import { relativeLuminance } from '../core/colour';
import type { IconSpec } from '../core/iconspec';
import { weakKeyedCache } from '../core/perfCache';
import type { Theme } from '../core/themes';
import { IconCanvas } from '../render/IconCanvas';
import { useT } from '../i18n';
import { continuous } from '../theme/tokensV2';

const ICONS = weakKeyedCache<Theme, IconSpec[]>();

type Props = { theme: Theme; width: number; height: number };

export const ThemeHomePreview = memo(function ThemeHomePreview({ theme, width, height }: Props) {
  const { locale } = useT();
  const layout = useMemo(() => cardPreviewLayout(width, height), [width, height]);
  const icons = layout ? ICONS.get(theme, 'card', () => cardIconSpecs(theme)) : null;
  const clock = useMemo(() => (layout ? cardClockSvg(theme, locale) : ''), [layout, theme, locale]);
  if (!layout || !icons) return null;
  const glass = dockFill(relativeLuminance(theme.palette.bg));
  const { widget, dock } = layout;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.lift, { left: widget.x, top: widget.y, width: widget.size, height: widget.size, borderRadius: layout.widgetRadius }]}>
        <View style={[styles.clip, continuous, { borderRadius: layout.widgetRadius }]}>
          <SvgXml xml={clock} width={widget.size} height={widget.size} />
        </View>
      </View>
      <View
        style={[
          styles.dock,
          continuous,
          { left: dock.x, top: dock.y, width: dock.w, height: dock.h, borderRadius: dock.radius, backgroundColor: glass.fill, borderColor: glass.edge },
        ]}
      />
      {icons.map((spec, i) => {
        const b = layout.icons[i];
        return b ? <IconCanvas key={spec.appId ?? i} spec={spec} size={b.size} morph={false} style={[styles.icon, { left: b.x, top: b.y }]} /> : null;
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  // No shadow: Home Screen widgets sit flat on the wallpaper, and a shadow costs a frame while scrolling.
  lift: { position: 'absolute' },
  clip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  dock: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
  icon: { position: 'absolute' },
});
