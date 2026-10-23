// fb-1023 C: the small pictures on the Widgets tab's option rows (size sub-tabs, look chips, theme
// chips). Geometry and colours come from src/core/widgetOptionArt.ts; this file only draws them
// with plain Views (Expo Go safe). Decorative: hidden from screen readers, because each control
// keeps its own accessibility label. Positions use `start`, so the pictures mirror in RTL.
// No animation (owner fb-1022c).
import { StyleSheet, View } from 'react-native';
import { SIZE_ART_BOX, SWATCH_BOX, sizeArt, type ArtRect, type Swatch } from '../core/widgetOptionArt';
import type { WidgetTabSize } from '../core/tabNav';

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const, pointerEvents: 'none' as const };

type SizeArtProps = {
  size: WidgetTabSize;
  /** Outline colour (a theme token: tint when selected, inkSecondary otherwise). */
  stroke: string;
  /** Fill inside the outline (a theme token, e.g. tintSoft when selected; transparent otherwise). */
  fill: string;
};

/** A size's picture: tiny rounded rectangles in the size's real aspect. */
export function SizeArt({ size, stroke, fill }: SizeArtProps) {
  const rects: ArtRect[] = sizeArt(size);
  return (
    <View {...hidden} style={styles.sizeBox}>
      {rects.map((r: ArtRect, i: number) => (
        <View
          key={i}
          style={[
            styles.abs,
            {
              start: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
              borderRadius: r.radius,
            },
            r.role === 'line' ? { backgroundColor: stroke } : { borderColor: stroke, borderWidth: 1.5, backgroundColor: fill },
          ]}
        />
      ))}
    </View>
  );
}

type SwatchArtProps = {
  swatch: Swatch;
  /** Hairline round the whole swatch (a theme token: separator, or onTint on a selected chip). */
  ring: string;
};

/** A look / theme swatch: a two-band wallpaper with a widget pane and a short text mark on it. */
export function SwatchArt({ swatch, ring }: SwatchArtProps) {
  return (
    <View {...hidden} style={[styles.swatch, { borderColor: ring }]}>
      <View style={[styles.band, { backgroundColor: swatch.backdrop[0] }]} />
      <View style={[styles.band, { backgroundColor: swatch.backdrop[1] }]} />
      <View
        style={[
          styles.pane,
          { backgroundColor: swatch.pane, opacity: swatch.paneOpacity },
          swatch.edge ? { borderColor: swatch.edge, borderWidth: StyleSheet.hairlineWidth } : null,
        ]}
      />
      <View style={styles.markRow}>
        {swatch.halo > 0 ? <View style={[styles.halo, { backgroundColor: swatch.mark, opacity: swatch.halo }]} /> : null}
        <View style={[styles.mark, { backgroundColor: swatch.mark }]} />
        <View style={[styles.markShort, { backgroundColor: swatch.mark }]} />
      </View>
    </View>
  );
}

const INSET = 4;

const styles = StyleSheet.create({
  sizeBox: { width: SIZE_ART_BOX.width, height: SIZE_ART_BOX.height },
  abs: { position: 'absolute' },
  swatch: {
    width: SWATCH_BOX.width,
    height: SWATCH_BOX.height,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  band: { flex: 1 },
  pane: { position: 'absolute', top: INSET, bottom: INSET, start: INSET, end: INSET, borderRadius: 4 },
  markRow: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    start: INSET,
    end: INSET,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  halo: { position: 'absolute', width: 18, height: 9, borderRadius: 4.5 },
  mark: { width: 14, height: 3, borderRadius: 1.5 },
  markShort: { width: 8, height: 2, borderRadius: 1 },
});
