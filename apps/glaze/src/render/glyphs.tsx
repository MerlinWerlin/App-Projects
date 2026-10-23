// Glyph renderers. Feather glyphs are font icons (Text-based), so they are drawn as a View
// overlay centred on the icon; in-house glyphs are SVG paths drawn inside the icon's <Svg>.

import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { G, Path } from 'react-native-svg';
import { resolveGlyph, type ResolvedGlyph } from '../core/glyphnames';
import type { Box } from '../core/shapes';
import { INHOUSE_STROKE_WIDTH, INHOUSE_VIEWBOX, inhouseGlyph } from './inhouse';

export type FeatherGlyphName = ComponentProps<typeof Feather>['name'];

export { resolveGlyph };
export type { ResolvedGlyph };

type SvgGlyphProps = { name: string; box: Box; colour: string };

/** In-house glyph as SVG, scaled from the 24×24 grid into `box`. Renders nothing for unknown names. */
export function InhouseSvgGlyph({ name, box, colour }: SvgGlyphProps) {
  const g = inhouseGlyph(name);
  if (!g) return null;
  const k = box.size / INHOUSE_VIEWBOX;
  return (
    <G transform={`translate(${box.x} ${box.y}) scale(${k})`}>
      {g.strokes.map((d, i) => (
        <Path
          key={`s${i}`}
          d={d}
          fill="none"
          stroke={colour}
          strokeWidth={INHOUSE_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {(g.dots ?? []).map((d, i) => (
        <Path key={`d${i}`} d={d} fill={colour} />
      ))}
    </G>
  );
}

type FeatherGlyphProps = { name: string; box: Box; colour: string };

/** Feather font glyph, absolutely positioned and centred in `box` (icon coordinates). */
export function FeatherGlyphOverlay({ name, box, colour }: FeatherGlyphProps) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.size,
        height: box.size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={name as FeatherGlyphName} size={box.size} color={colour} />
    </View>
  );
}
