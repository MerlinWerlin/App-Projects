// T125: the original icon tiles for travel bingo, drawn with react-native-svg (already a dependency) on a 48x48 grid
// from theme tokens only (ink outline, accentSoft fill, accent and sea highlights), so they follow light and dark mode.
// Simple geometric shapes, no brands, logos or characters. One glyph per GAME_ICONS name (src/core/games.ts); the
// tile around it carries the label and the screen-reader text, so the drawing itself is hidden from screen readers.
import { memo, type ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import type { GameIcon } from '../core/games.ts';
import { useApp } from '../state/app.tsx';

type Ink = { ink: string; soft: string; pop: string; cool: string };
const W = 2.5;

/** Outline props: ink stroke, rounded ends. */
const o = (c: Ink, fill: string = 'none') => ({ stroke: c.ink, strokeWidth: W, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill });

const GLYPHS: Record<GameIcon, (c: Ink) => ReactElement> = {
  plane: (c) => (
    <G>
      <Path d="M6 30 L40 14 Q45 12 44 17 L14 36 Z" {...o(c, c.soft)} />
      <Path d="M22 24 L16 12 L21 11 L30 20" {...o(c, c.pop)} />
      <Path d="M14 36 L10 42 M8 38 L24 36" {...o(c)} />
    </G>
  ),
  suitcase: (c) => (
    <G>
      <Rect x={9} y={15} width={30} height={24} rx={4} {...o(c, c.soft)} />
      <Path d="M18 15 V10 H30 V15" {...o(c)} />
      <Circle cx={17} cy={24} r={2.5} fill={c.pop} />
      <Circle cx={29} cy={30} r={2.5} fill={c.cool} />
      <Circle cx={22} cy={33} r={2} fill={c.pop} />
    </G>
  ),
  passport: (c) => (
    <G>
      <Rect x={12} y={7} width={24} height={34} rx={3} {...o(c, c.cool)} />
      <Circle cx={24} cy={21} r={6} {...o(c, c.soft)} />
      <Line x1={18} y1={33} x2={30} y2={33} {...o(c)} />
    </G>
  ),
  ticket: (c) => (
    <G>
      <Path d="M6 15 H42 V21 A3 3 0 0 0 42 27 V33 H6 V27 A3 3 0 0 0 6 21 Z" {...o(c, c.soft)} />
      <Line x1={30} y1={16} x2={30} y2={32} stroke={c.ink} strokeWidth={1.5} strokeDasharray="2 3" />
      <Line x1={11} y1={21} x2={24} y2={21} {...o(c)} />
      <Line x1={11} y1={27} x2={20} y2={27} {...o(c)} />
    </G>
  ),
  tower: (c) => (
    <G>
      <Path d="M20 42 L22 20 H26 L28 42 Z" {...o(c, c.soft)} />
      <Path d="M14 12 H34 L31 20 H17 Z" {...o(c, c.cool)} />
      <Line x1={24} y1={12} x2={24} y2={6} {...o(c)} />
      <Line x1={14} y1={42} x2={34} y2={42} {...o(c)} />
    </G>
  ),
  clock: (c) => (
    <G>
      <Circle cx={24} cy={24} r={16} {...o(c, c.soft)} />
      <Path d="M24 14 V24 L31 28" {...o(c)} />
      <Circle cx={24} cy={24} r={2} fill={c.pop} />
    </G>
  ),
  coffee: (c) => (
    <G>
      <Path d="M10 18 H32 V30 A8 8 0 0 1 24 38 H18 A8 8 0 0 1 10 30 Z" {...o(c, c.soft)} />
      <Path d="M32 21 H36 A4 4 0 0 1 36 29 H32" {...o(c)} />
      <Path d="M16 13 Q14 10 16 7 M22 13 Q20 10 22 7" {...o(c)} stroke={c.pop} />
      <Line x1={8} y1={41} x2={34} y2={41} {...o(c)} />
    </G>
  ),
  window: (c) => (
    <G>
      <Rect x={12} y={6} width={24} height={36} rx={12} {...o(c, c.cool)} />
      <Rect x={16} y={11} width={16} height={26} rx={8} {...o(c, c.soft)} />
      <Path d="M18 24 Q22 20 26 24 Q28 22 30 24" {...o(c)} />
    </G>
  ),
  cloud: (c) => <Path d="M14 34 A7 7 0 0 1 13 20 A9 9 0 0 1 30 15 A8 8 0 0 1 37 34 Z" {...o(c, c.soft)} />,
  sun: (c) => (
    <G>
      <Circle cx={24} cy={24} r={8} {...o(c, c.pop)} />
      <Path d="M24 6 V11 M24 37 V42 M6 24 H11 M37 24 H42 M11 11 L14 14 M34 34 L37 37 M37 11 L34 14 M14 34 L11 37" {...o(c)} />
    </G>
  ),
  headphones: (c) => (
    <G>
      <Path d="M10 30 V24 A14 14 0 0 1 38 24 V30" {...o(c)} />
      <Rect x={7} y={27} width={8} height={12} rx={3} {...o(c, c.pop)} />
      <Rect x={33} y={27} width={8} height={12} rx={3} {...o(c, c.pop)} />
    </G>
  ),
  trolley: (c) => (
    <G>
      <Path d="M8 10 H13 L17 34 H38" {...o(c)} />
      <Rect x={18} y={16} width={16} height={13} rx={2} {...o(c, c.soft)} />
      <Circle cx={20} cy={39} r={3} {...o(c, c.cool)} />
      <Circle cx={34} cy={39} r={3} {...o(c, c.cool)} />
    </G>
  ),
  escalator: (c) => (
    <G>
      <Path d="M6 38 H14 L32 14 H42" {...o(c)} />
      <Path d="M6 32 H12 L30 8 H42" {...o(c)} stroke={c.cool} />
      <Path d="M17 30 H21 V26 H24 V22 H27 V18" {...o(c)} />
    </G>
  ),
  sign: (c) => (
    <G>
      <Line x1={24} y1={20} x2={24} y2={42} {...o(c)} />
      <Rect x={8} y={8} width={32} height={14} rx={3} {...o(c, c.cool)} />
      <Path d="M30 12 L34 15 L30 18" {...o(c)} />
      <Line x1={13} y1={15} x2={25} y2={15} {...o(c)} />
    </G>
  ),
  carousel: (c) => (
    <G>
      <Ellipse cx={24} cy={32} rx={18} ry={7} {...o(c, c.soft)} />
      <Rect x={12} y={20} width={10} height={9} rx={2} {...o(c, c.pop)} />
      <Rect x={26} y={18} width={12} height={11} rx={2} {...o(c, c.cool)} />
    </G>
  ),
  buckle: (c) => (
    <G>
      <Rect x={6} y={20} width={14} height={8} rx={2} {...o(c, c.soft)} />
      <Rect x={28} y={20} width={14} height={8} rx={2} {...o(c, c.soft)} />
      <Rect x={18} y={16} width={12} height={16} rx={3} {...o(c, c.pop)} />
    </G>
  ),
  pillow: (c) => <Path d="M14 12 A12 12 0 1 0 34 12 L30 16 A7 7 0 1 1 18 16 Z" {...o(c, c.cool)} />,
  book: (c) => (
    <G>
      <Path d="M24 14 Q16 9 7 11 V37 Q16 35 24 40 Z" {...o(c, c.soft)} />
      <Path d="M24 14 Q32 9 41 11 V37 Q32 35 24 40 Z" {...o(c, c.soft)} />
      <Line x1={12} y1={19} x2={19} y2={20} {...o(c)} />
      <Line x1={29} y1={20} x2={36} y2={19} {...o(c)} />
    </G>
  ),
  bottle: (c) => (
    <G>
      <Rect x={20} y={6} width={8} height={5} rx={1} {...o(c, c.pop)} />
      <Path d="M19 11 H29 L32 17 V40 A2 2 0 0 1 30 42 H18 A2 2 0 0 1 16 40 V17 Z" {...o(c, c.cool)} />
      <Line x1={16} y1={26} x2={32} y2={26} {...o(c)} />
    </G>
  ),
  sandwich: (c) => (
    <G>
      <Path d="M6 34 L24 12 L42 34 Z" {...o(c, c.soft)} />
      <Path d="M10 30 Q17 27 24 30 Q31 33 38 30" {...o(c)} stroke={c.pop} />
    </G>
  ),
  wing: (c) => (
    <G>
      <Path d="M4 30 L44 18 L44 24 L10 36 Z" {...o(c, c.soft)} />
      <Circle cx={40} cy={21} r={2} fill={c.pop} />
      <Line x1={20} y1={30} x2={22} y2={36} {...o(c)} />
    </G>
  ),
  moon: (c) => <Path d="M30 8 A16 16 0 1 0 40 32 A13 13 0 1 1 30 8 Z" {...o(c, c.pop)} />,
  backpack: (c) => (
    <G>
      <Path d="M12 20 A12 12 0 0 1 36 20 V40 H12 Z" {...o(c, c.cool)} />
      <Rect x={17} y={27} width={14} height={9} rx={2} {...o(c, c.soft)} />
      <Path d="M19 10 A5 5 0 0 1 29 10" {...o(c)} />
    </G>
  ),
  camera: (c) => (
    <G>
      <Path d="M8 16 H16 L19 11 H29 L32 16 H40 V38 H8 Z" {...o(c, c.soft)} />
      <Circle cx={24} cy={27} r={7} {...o(c, c.cool)} />
      <Circle cx={35} cy={20} r={1.5} fill={c.pop} />
    </G>
  ),
  plug: (c) => (
    <G>
      <Rect x={14} y={16} width={20} height={14} rx={3} {...o(c, c.soft)} />
      <Path d="M19 16 V9 M29 16 V9" {...o(c)} />
      <Path d="M24 30 V36 Q24 42 30 42 H38" {...o(c)} stroke={c.pop} />
    </G>
  ),
  map: (c) => (
    <G>
      <Path d="M6 12 L17 8 L31 12 L42 8 V36 L31 40 L17 36 L6 40 Z" {...o(c, c.soft)} />
      <Path d="M17 8 V36 M31 12 V40" {...o(c)} />
      <Circle cx={24} cy={22} r={3} fill={c.pop} />
    </G>
  ),
  train: (c) => (
    <G>
      <Rect x={11} y={7} width={26} height={28} rx={6} {...o(c, c.cool)} />
      <Rect x={15} y={12} width={18} height={9} rx={2} {...o(c, c.soft)} />
      <Circle cx={17} cy={28} r={2} fill={c.pop} />
      <Circle cx={31} cy={28} r={2} fill={c.pop} />
      <Path d="M15 35 L11 42 M33 35 L37 42" {...o(c)} />
    </G>
  ),
  track: (c) => (
    <G>
      <Path d="M18 6 L12 42 M30 6 L36 42" {...o(c)} />
      <Path d="M16 12 H32 M15 20 H33 M14 28 H34 M13 36 H35" {...o(c)} stroke={c.pop} />
    </G>
  ),
  bench: (c) => (
    <G>
      <Rect x={7} y={14} width={34} height={8} rx={2} {...o(c, c.soft)} />
      <Rect x={7} y={25} width={34} height={5} rx={2} {...o(c, c.pop)} />
      <Path d="M11 30 V40 M37 30 V40" {...o(c)} />
    </G>
  ),
  whistle: (c) => (
    <G>
      <Path d="M8 20 H28 V18 H36 V24 A10 10 0 1 1 18 30 H8 Z" {...o(c, c.pop)} />
      <Circle cx={26} cy={31} r={3} fill={c.ink} />
      <Path d="M38 10 L41 7 M40 15 H44" {...o(c)} />
    </G>
  ),
  bridge: (c) => (
    <G>
      <Path d="M4 26 H44" {...o(c)} />
      <Path d="M8 26 A16 14 0 0 1 40 26" {...o(c)} stroke={c.cool} />
      <Path d="M16 19 V26 M24 17 V26 M32 19 V26" {...o(c)} />
      <Path d="M4 38 Q10 34 16 38 Q22 42 28 38 Q34 34 44 38" {...o(c)} stroke={c.cool} />
    </G>
  ),
  tunnel: (c) => (
    <G>
      <Path d="M4 40 Q8 14 24 10 Q40 14 44 40 Z" {...o(c, c.soft)} />
      <Path d="M14 40 V28 A10 10 0 0 1 34 28 V40" {...o(c, c.ink)} />
    </G>
  ),
  cow: (c) => (
    <G>
      <Path d="M14 16 Q8 10 10 8 M34 16 Q40 10 38 8" {...o(c)} />
      <Path d="M14 14 H34 V30 A10 10 0 0 1 14 30 Z" {...o(c, c.soft)} />
      <Ellipse cx={24} cy={33} rx={8} ry={5} {...o(c, c.pop)} />
      <Circle cx={19} cy={22} r={1.8} fill={c.ink} />
      <Circle cx={29} cy={22} r={1.8} fill={c.ink} />
    </G>
  ),
  tree: (c) => (
    <G>
      <Circle cx={24} cy={19} r={12} {...o(c, c.soft)} />
      <Path d="M24 31 V42 M24 34 L19 29 M24 36 L29 31" {...o(c)} />
    </G>
  ),
  house: (c) => (
    <G>
      <Path d="M6 22 L24 8 L42 22" {...o(c, c.pop)} />
      <Rect x={11} y={22} width={26} height={18} {...o(c, c.soft)} />
      <Rect x={20} y={29} width={8} height={11} {...o(c, c.cool)} />
    </G>
  ),
  river: (c) => (
    <G>
      <Path d="M4 16 Q12 10 20 16 Q28 22 36 16 Q40 13 44 14" {...o(c)} stroke={c.cool} />
      <Path d="M4 26 Q12 20 20 26 Q28 32 36 26 Q40 23 44 24" {...o(c)} stroke={c.cool} />
      <Path d="M4 36 Q12 30 20 36 Q28 42 36 36 Q40 33 44 34" {...o(c)} stroke={c.cool} />
    </G>
  ),
  mountain: (c) => (
    <G>
      <Path d="M4 40 L18 14 L28 30 L33 22 L44 40 Z" {...o(c, c.soft)} />
      <Path d="M14 22 L18 14 L22 21 L19 19 Z" {...o(c, c.cool)} />
    </G>
  ),
  bicycle: (c) => (
    <G>
      <Circle cx={12} cy={32} r={7} {...o(c)} />
      <Circle cx={36} cy={32} r={7} {...o(c)} />
      <Path d="M12 32 L20 18 H32 L36 32 M20 18 L26 32 L32 18 M18 14 H24" {...o(c)} stroke={c.pop} />
    </G>
  ),
  umbrella: (c) => (
    <G>
      <Path d="M6 24 A18 16 0 0 1 42 24 Z" {...o(c, c.pop)} />
      <Path d="M24 24 V38 A3 3 0 0 1 18 38" {...o(c)} />
    </G>
  ),
  bird: (c) => (
    <G>
      <Path d="M8 28 Q18 12 30 22 L40 16 L36 26 Q30 36 18 34 Z" {...o(c, c.cool)} />
      <Path d="M18 26 Q24 22 28 28" {...o(c)} />
      <Circle cx={33} cy={22} r={1.5} fill={c.ink} />
    </G>
  ),
  flower: (c) => (
    <G>
      <Path d="M24 26 V42 M24 36 Q18 32 14 34" {...o(c)} />
      <Circle cx={24} cy={10} r={5} {...o(c, c.pop)} />
      <Circle cx={16} cy={17} r={5} {...o(c, c.pop)} />
      <Circle cx={32} cy={17} r={5} {...o(c, c.pop)} />
      <Circle cx={24} cy={18} r={4} {...o(c, c.soft)} />
    </G>
  ),
  car: (c) => (
    <G>
      <Path d="M6 32 V26 L12 24 L16 16 H32 L37 24 L42 26 V32 Z" {...o(c, c.pop)} />
      <Path d="M18 19 H30 L33 24 H15 Z" {...o(c, c.soft)} />
      <Circle cx={14} cy={33} r={4} {...o(c, c.ink)} />
      <Circle cx={34} cy={33} r={4} {...o(c, c.ink)} />
    </G>
  ),
  fuel: (c) => (
    <G>
      <Rect x={10} y={8} width={18} height={32} rx={2} {...o(c, c.soft)} />
      <Rect x={14} y={12} width={10} height={8} rx={1} {...o(c, c.cool)} />
      <Path d="M28 16 L34 20 V34 A3 3 0 0 0 40 34 V18 L36 14" {...o(c)} />
      <Line x1={7} y1={40} x2={31} y2={40} {...o(c)} />
    </G>
  ),
  trafficlight: (c) => (
    <G>
      <Rect x={16} y={4} width={16} height={34} rx={5} {...o(c, c.soft)} />
      <Circle cx={24} cy={12} r={3.5} fill={c.pop} />
      <Circle cx={24} cy={21} r={3.5} {...o(c)} strokeWidth={1.5} />
      <Circle cx={24} cy={30} r={3.5} fill={c.cool} />
      <Line x1={24} y1={38} x2={24} y2={44} {...o(c)} />
    </G>
  ),
  cone: (c) => (
    <G>
      <Path d="M18 36 L22 8 H26 L30 36 Z" {...o(c, c.pop)} />
      <Path d="M20 22 H28" {...o(c)} stroke={c.soft} strokeWidth={4} />
      <Rect x={10} y={36} width={28} height={5} rx={1} {...o(c, c.soft)} />
    </G>
  ),
  truck: (c) => (
    <G>
      <Rect x={4} y={12} width={26} height={20} rx={2} {...o(c, c.soft)} />
      <Path d="M30 18 H38 L44 25 V32 H30 Z" {...o(c, c.cool)} />
      <Circle cx={12} cy={35} r={4} {...o(c, c.ink)} />
      <Circle cx={36} cy={35} r={4} {...o(c, c.ink)} />
    </G>
  ),
  bus: (c) => (
    <G>
      <Rect x={6} y={10} width={36} height={24} rx={4} {...o(c, c.pop)} />
      <Path d="M10 15 H38 V23 H10 Z" {...o(c, c.soft)} />
      <Path d="M19 15 V23 M29 15 V23" {...o(c)} />
      <Circle cx={14} cy={36} r={3.5} {...o(c, c.ink)} />
      <Circle cx={34} cy={36} r={3.5} {...o(c, c.ink)} />
    </G>
  ),
  turbine: (c) => (
    <G>
      <Path d="M23 20 L22 42 H26 L25 20" {...o(c, c.soft)} />
      <Path d="M24 18 L24 4 M24 18 L36 25 M24 18 L12 25" {...o(c)} strokeWidth={3.5} />
      <Circle cx={24} cy={18} r={2.5} fill={c.pop} />
    </G>
  ),
  tent: (c) => (
    <G>
      <Path d="M4 40 L24 8 L44 40 Z" {...o(c, c.pop)} />
      <Path d="M24 22 L18 40 H30 Z" {...o(c, c.soft)} />
    </G>
  ),
  boat: (c) => (
    <G>
      <Path d="M24 6 V30 M24 8 L38 26 H24 M24 12 L12 26 H24" {...o(c, c.soft)} />
      <Path d="M6 30 H42 L36 38 H12 Z" {...o(c, c.cool)} />
      <Path d="M4 43 Q10 40 16 43 Q22 46 28 43 Q34 40 44 43" {...o(c)} stroke={c.cool} />
    </G>
  ),
  flag: (c) => (
    <G>
      <Line x1={12} y1={6} x2={12} y2={42} {...o(c)} />
      <Path d="M12 8 Q20 4 28 8 Q34 11 40 8 V24 Q34 27 28 24 Q20 20 12 24 Z" {...o(c, c.pop)} />
    </G>
  ),
  rainbow: (c) => (
    <G>
      <Path d="M6 36 A18 18 0 0 1 42 36" {...o(c)} stroke={c.pop} strokeWidth={4} />
      <Path d="M12 36 A12 12 0 0 1 36 36" {...o(c)} stroke={c.soft} strokeWidth={4} />
      <Path d="M18 36 A6 6 0 0 1 30 36" {...o(c)} stroke={c.cool} strokeWidth={4} />
    </G>
  ),
  apple: (c) => (
    <G>
      <Path d="M24 16 Q14 10 10 20 Q8 34 18 40 Q24 42 30 40 Q40 34 38 20 Q34 10 24 16 Z" {...o(c, c.pop)} />
      <Path d="M24 16 Q24 10 28 6" {...o(c)} />
      <Path d="M26 10 Q32 6 34 10 Q30 13 26 10 Z" {...o(c, c.soft)} />
    </G>
  ),
  stop: (c) => (
    <G>
      <Polygon points="18,6 30,6 40,16 40,30 30,40 18,40 8,30 8,16" {...o(c, c.pop)} />
      <Line x1={16} y1={23} x2={32} y2={23} stroke={c.soft} strokeWidth={4} strokeLinecap="round" />
    </G>
  ),
  fountain: (c) => (
    <G>
      <Path d="M8 34 H40 L36 42 H12 Z" {...o(c, c.soft)} />
      <Line x1={24} y1={34} x2={24} y2={20} {...o(c)} />
      <Path d="M24 20 Q18 10 12 22 M24 20 Q30 10 36 22 M24 20 V8" {...o(c)} stroke={c.cool} />
    </G>
  ),
  monument: (c) => (
    <G>
      <Rect x={12} y={34} width={24} height={7} {...o(c, c.soft)} />
      <Rect x={18} y={26} width={12} height={8} {...o(c, c.soft)} />
      <Circle cx={24} cy={11} r={4} {...o(c, c.cool)} />
      <Path d="M19 26 L20 16 H28 L29 26" {...o(c, c.cool)} />
    </G>
  ),
  icecream: (c) => (
    <G>
      <Path d="M16 22 L24 42 L32 22 Z" {...o(c, c.soft)} />
      <Circle cx={20} cy={18} r={6} {...o(c, c.pop)} />
      <Circle cx={28} cy={18} r={6} {...o(c, c.cool)} />
      <Circle cx={24} cy={11} r={5} {...o(c, c.soft)} />
    </G>
  ),
  balloon: (c) => (
    <G>
      <Ellipse cx={24} cy={18} rx={11} ry={13} {...o(c, c.pop)} />
      <Path d="M22 31 H26 L24 34 Z" {...o(c, c.pop)} />
      <Path d="M24 34 Q20 38 24 41 Q28 44 24 46" {...o(c)} />
    </G>
  ),
  tram: (c) => (
    <G>
      <Path d="M16 6 H32 M24 6 V10" {...o(c)} />
      <Rect x={9} y={10} width={30} height={26} rx={5} {...o(c, c.cool)} />
      <Rect x={13} y={14} width={22} height={9} rx={2} {...o(c, c.soft)} />
      <Path d="M6 42 H42 M14 36 L12 42 M34 36 L36 42" {...o(c)} />
    </G>
  ),
  crossing: (c) => (
    <G>
      <Rect x={6} y={8} width={36} height={32} rx={2} {...o(c, c.cool)} />
      <Path d="M14 12 V36 M24 12 V36 M34 12 V36" stroke={c.soft} strokeWidth={5} />
    </G>
  ),
  lamp: (c) => (
    <G>
      <Path d="M24 42 V14 Q24 8 30 8 H34" {...o(c)} />
      <Path d="M30 12 H40 L38 18 H32 Z" {...o(c, c.pop)} />
      <Line x1={16} y1={42} x2={32} y2={42} {...o(c)} />
    </G>
  ),
  postbox: (c) => (
    <G>
      <Path d="M14 42 V16 A10 10 0 0 1 34 16 V42 Z" {...o(c, c.pop)} />
      <Rect x={18} y={18} width={12} height={3} rx={1} fill={c.ink} />
      <Line x1={14} y1={28} x2={34} y2={28} {...o(c)} />
    </G>
  ),
  palette: (c) => (
    <G>
      <Path d="M24 6 A18 18 0 1 0 24 42 Q30 42 28 36 Q26 30 32 30 H38 Q42 30 42 24 A18 18 0 0 0 24 6 Z" {...o(c, c.soft)} />
      <Circle cx={16} cy={18} r={3} fill={c.pop} />
      <Circle cx={26} cy={14} r={3} fill={c.cool} />
      <Circle cx={14} cy={29} r={3} fill={c.ink} />
    </G>
  ),
  awning: (c) => (
    <G>
      <Path d="M6 10 H42 L40 20 H8 Z" {...o(c, c.pop)} />
      <Path d="M15 10 L14 20 M24 10 V20 M33 10 L34 20" {...o(c)} />
      <Path d="M10 20 V40 H38 V20" {...o(c)} />
      <Rect x={14} y={28} width={20} height={6} rx={1} {...o(c, c.soft)} />
    </G>
  ),
  bread: (c) => (
    <G>
      <Path d="M6 30 Q6 16 24 16 Q42 16 42 30 Q42 36 36 36 H12 Q6 36 6 30 Z" {...o(c, c.soft)} />
      <Path d="M16 22 L19 28 M24 21 L27 27 M32 22 L35 28" {...o(c)} stroke={c.pop} />
    </G>
  ),
  door: (c) => (
    <G>
      <Path d="M12 42 V14 A12 12 0 0 1 36 14 V42 Z" {...o(c, c.cool)} />
      <Circle cx={30} cy={28} r={2} fill={c.pop} />
      <Line x1={8} y1={42} x2={40} y2={42} {...o(c)} />
    </G>
  ),
};

/** One bingo glyph at `size` points, coloured from the theme. Decorative: the tile names it. */
export const GameGlyph = memo(function GameGlyph({ icon, size = 40 }: { icon: GameIcon; size?: number }) {
  const { theme } = useApp();
  const c: Ink = { ink: theme.ink, soft: theme.accentSoft, pop: theme.accent, cool: theme.sea };
  const draw = GLYPHS[icon] ?? GLYPHS.sun;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {draw(c)}
      </Svg>
    </View>
  );
});
