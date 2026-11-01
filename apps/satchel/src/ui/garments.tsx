// T136: original garment icons for the outfit planner (top, bottom, dress, layer, shoes, accessory), drawn with
// react-native-svg (already a dependency) on a 48x48 grid from theme tokens only (ink outline, accentSoft fill, accent
// and sea highlights), so they follow light and dark mode. Simple shapes, no brands or logos. Decorative: the row or
// chip around a glyph names the piece for screen readers.
import { memo, type ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import type { GarmentCat } from '../core/outfits.ts';
import { useApp } from '../state/app.tsx';

type Ink = { ink: string; soft: string; pop: string; cool: string };
const W = 2.5;

const o = (c: Ink, fill: string = 'none') => ({ stroke: c.ink, strokeWidth: W, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill });

const GLYPHS: Record<GarmentCat, (c: Ink) => ReactElement> = {
  // A short-sleeved tee with a scooped neck and a stripe.
  top: (c) => (
    <G>
      <Path d="M17 8 L8 12 L4 20 L11 24 L13 21 V41 H35 V21 L37 24 L44 20 L40 12 L31 8 Q24 15 17 8 Z" {...o(c, c.soft)} />
      <Line x1={13} y1={29} x2={35} y2={29} stroke={c.pop} strokeWidth={3} />
    </G>
  ),
  // Trousers with a waistband and a turned-up hem.
  bottom: (c) => (
    <G>
      <Path d="M13 8 H35 L38 41 H28 L24 19 L20 41 H10 Z" {...o(c, c.cool)} />
      <Line x1={13} y1={13} x2={35} y2={13} {...o(c)} />
      <Line x1={11} y1={37} x2={19.5} y2={37} {...o(c)} />
      <Line x1={28.5} y1={37} x2={37} y2={37} {...o(c)} />
    </G>
  ),
  // A sleeveless dress with a belt and a flared skirt.
  dress: (c) => (
    <G>
      <Path d="M18 5 L20 9 Q24 12 28 9 L30 5 L32 7 L30 18 L38 41 Q24 45 10 41 L18 18 L16 7 Z" {...o(c, c.soft)} />
      <Line x1={18} y1={19} x2={30} y2={19} stroke={c.pop} strokeWidth={3} strokeLinecap="round" />
      <Path d="M17 33 Q24 35 31 33" {...o(c)} />
    </G>
  ),
  // An open jacket with long sleeves, a zip and two pockets.
  layer: (c) => (
    <G>
      <Path d="M17 7 L9 10 L5 37 H11 L13 22 V42 H35 V22 L37 37 H43 L39 10 L31 7 L24 15 Z" {...o(c, c.cool)} />
      <Line x1={24} y1={15} x2={24} y2={42} {...o(c)} />
      <Rect x={15.5} y={30} width={5} height={4} rx={1} fill={c.pop} />
      <Rect x={27.5} y={30} width={5} height={4} rx={1} fill={c.pop} />
    </G>
  ),
  // A low walking shoe from the side, with laces and a sole.
  shoes: (c) => (
    <G>
      <Path d="M6 34 V20 Q6 16 10 17 L17 19 Q21 25 29 27 L39 29 Q44 30 44 34 Z" {...o(c, c.soft)} />
      <Rect x={5} y={34} width={40} height={5} rx={2.5} {...o(c, c.pop)} />
      <Path d="M17 23 L20 21 M20 25 L23 23 M23 27 L26 25" {...o(c)} />
    </G>
  ),
  // A sun hat with a wide brim and a band.
  accessory: (c) => (
    <G>
      <Path d="M5 31 Q24 41 43 31 Q24 27 5 31 Z" {...o(c, c.soft)} />
      <Path d="M14 31 Q13 15 24 15 Q35 15 34 31" {...o(c, c.cool)} />
      <Path d="M14.5 26 Q24 28.5 33.5 26" stroke={c.pop} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={31} cy={22} r={1.8} fill={c.pop} />
    </G>
  ),
};

/** One garment glyph at `size` points, coloured from the theme. Hidden from screen readers (its row names it). */
export const GarmentGlyph = memo(function GarmentGlyph({ cat, size = 32 }: { cat: GarmentCat; size?: number }) {
  const { theme } = useApp();
  const c: Ink = { ink: theme.ink, soft: theme.accentSoft, pop: theme.accent, cool: theme.seaSoft };
  const draw = GLYPHS[cat] ?? GLYPHS.top;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {draw(c)}
      </Svg>
    </View>
  );
});
