// T144: the original pictograms for the sign reader, drawn with react-native-svg (already a dependency) on a 48x48
// grid from theme tokens only (ink outline, accentSoft fill, accent / sea highlights, danger for "not allowed" and
// warnings), so they follow light and dark mode. Simple geometric shapes in the same hand as the bingo tiles
// (gameIcons.tsx); not copies of any country's official sign artwork, no brands or logos, no protected emblems (the
// hospital mark is a bed, not a red cross). The card around each one carries the name and the screen-reader text,
// so the drawing itself is hidden from screen readers.
import { memo, type ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import type { SignId } from '../core/signs.ts';
import { useApp } from '../state/app.tsx';

type Ink = { ink: string; soft: string; pop: string; cool: string; stop: string; paper: string };
const W = 2.5;

const o = (c: Ink, fill: string = 'none') => ({ stroke: c.ink, strokeWidth: W, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill });
const s = (colour: string, width: number = W) => ({ stroke: colour, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

/** A simple standing figure: head, body, legs. `dress` widens the body into a trapezoid. */
const figure = (c: Ink, x: number, fill: string, dress = false) => (
  <G>
    <Circle cx={x} cy={11} r={3.5} {...o(c, fill)} />
    {dress ? <Path d={`M${x - 3} 17 H${x + 3} L${x + 6} 30 H${x - 6} Z`} {...o(c, fill)} /> : <Rect x={x - 4} y={17} width={8} height={13} rx={2.5} {...o(c, fill)} />}
    <Line x1={x - 2} y1={30} x2={x - 2} y2={40} {...o(c)} />
    <Line x1={x + 2} y1={30} x2={x + 2} y2={40} {...o(c)} />
  </G>
);

/** A door seen from the front with a handle. */
const door = (c: Ink, x: number, fill: string) => (
  <G>
    <Rect x={x} y={8} width={16} height={32} rx={2} {...o(c, fill)} />
    <Circle cx={x + 12} cy={25} r={1.6} fill={c.ink} />
  </G>
);

/** A horizontal arrow from x1 to x2 at height y. */
const arrow = (colour: string, x1: number, x2: number, y: number) => {
  const d = x2 > x1 ? -5 : 5;
  return <Path d={`M${x1} ${y} H${x2} M${x2 + d} ${y - 5} L${x2} ${y} L${x2 + d} ${y + 5}`} {...s(colour, 3)} />;
};

/** The "not allowed" ring and bar drawn over a picture. */
const notAllowed = (c: Ink) => (
  <G>
    <Circle cx={24} cy={24} r={19} {...s(c.stop, 3.5)} />
    <Line x1={10.5} y1={37.5} x2={37.5} y2={10.5} {...s(c.stop, 3.5)} />
  </G>
);

/** A hanging shop-door board with something drawn on it. */
const board = (c: Ink, fill: string, mark: ReactElement) => (
  <G>
    <Path d="M16 18 L24 8 L32 18" {...o(c)} />
    <Circle cx={24} cy={8} r={1.6} fill={c.ink} />
    <Rect x={8} y={18} width={32} height={20} rx={3} {...o(c, fill)} />
    {mark}
  </G>
);

const GLYPHS: Record<SignId, (c: Ink) => ReactElement> = {
  exit: (c) => (
    <G>
      {door(c, 8, c.soft)}
      {arrow(c.pop, 22, 42, 24)}
    </G>
  ),
  entrance: (c) => (
    <G>
      {door(c, 26, c.soft)}
      {arrow(c.cool, 4, 22, 24)}
    </G>
  ),
  push: (c) => (
    <G>
      <Rect x={28} y={6} width={12} height={36} rx={2} {...o(c, c.soft)} />
      <Path d="M8 20 H18 Q22 20 22 24 Q22 28 18 28 H8" {...o(c, c.paper)} />
      <Line x1={14} y1={20} x2={14} y2={28} {...o(c)} />
      {arrow(c.pop, 4, 26, 36)}
    </G>
  ),
  pull: (c) => (
    <G>
      <Rect x={8} y={6} width={12} height={36} rx={2} {...o(c, c.soft)} />
      <Path d="M20 18 H30 V30 H20" {...o(c)} />
      {arrow(c.cool, 24, 44, 38)}
    </G>
  ),
  open: (c) => board(c, c.soft, <Path d="M16 28 L22 33 L32 23" {...s(c.cool, 3)} />),
  closed: (c) => board(c, c.paper, <Line x1={15} y1={28} x2={33} y2={28} {...s(c.stop, 3.5)} />),
  lift: (c) => (
    <G>
      <Rect x={10} y={6} width={28} height={36} rx={3} {...o(c, c.soft)} />
      <Line x1={24} y1={6} x2={24} y2={42} {...o(c)} />
      <Polygon points="17,14 13,20 21,20" fill={c.pop} />
      <Polygon points="31,34 27,28 35,28" fill={c.cool} />
    </G>
  ),
  stairs: (c) => (
    <G>
      <Path d="M6 40 H14 V32 H22 V24 H30 V16 H38 V8 H42 V40 Z" {...o(c, c.soft)} />
      <Path d="M8 22 L20 10 M14 10 H20 V16" {...s(c.pop, 3)} />
    </G>
  ),
  toilets: (c) => (
    <G>
      {figure(c, 14, c.cool)}
      <Line x1={24} y1={6} x2={24} y2={42} {...s(c.ink, 1.5)} />
      {figure(c, 34, c.pop, true)}
    </G>
  ),
  men: (c) => figure(c, 24, c.cool),
  women: (c) => figure(c, 24, c.pop, true),
  accessibleToilet: (c) => (
    <G>
      <Circle cx={20} cy={9} r={3.5} {...o(c, c.soft)} />
      <Path d="M20 15 V26 H30 L34 36" {...o(c)} />
      <Path d="M20 20 H28" {...o(c)} />
      <Circle cx={20} cy={32} r={9} {...s(c.cool, 3)} />
      <Line x1={34} y1={36} x2={38} y2={36} {...o(c)} />
    </G>
  ),
  platform: (c) => (
    <G>
      <Rect x={12} y={6} width={24} height={26} rx={6} {...o(c, c.soft)} />
      <Rect x={16} y={11} width={16} height={8} rx={2} {...o(c, c.paper)} />
      <Circle cx={18} cy={26} r={1.8} fill={c.ink} />
      <Circle cx={30} cy={26} r={1.8} fill={c.ink} />
      <Path d="M16 32 L12 38 M32 32 L36 38" {...o(c)} />
      <Line x1={4} y1={42} x2={44} y2={42} {...s(c.pop, 3)} />
    </G>
  ),
  departures: (c) => (
    <G>
      <Path d="M6 32 L38 16 Q44 13 43 18 L14 36 Z" {...o(c, c.soft)} />
      <Path d="M22 26 L18 16 L23 15 L30 21" {...o(c, c.pop)} />
      <Line x1={4} y1={42} x2={44} y2={42} {...o(c)} />
    </G>
  ),
  arrivals: (c) => (
    <G>
      <Path d="M6 14 L38 28 Q44 31 41 34 L10 24 Z" {...o(c, c.soft)} />
      <Path d="M20 20 L20 10 L25 11 L28 22" {...o(c, c.cool)} />
      <Line x1={4} y1={42} x2={44} y2={42} {...o(c)} />
    </G>
  ),
  ticketOffice: (c) => (
    <G>
      <Path d="M6 40 V14 L24 6 L42 14 V40" {...o(c, c.soft)} />
      <Rect x={14} y={18} width={20} height={12} rx={2} {...o(c, c.paper)} />
      <Path d="M12 36 H36" {...o(c)} />
      <Path d="M19 22 H29 V26 H19 Z" fill={c.pop} />
    </G>
  ),
  lockers: (c) => (
    <G>
      <Rect x={8} y={6} width={32} height={36} rx={2} {...o(c, c.soft)} />
      <Line x1={24} y1={6} x2={24} y2={42} {...o(c)} />
      <Line x1={8} y1={18} x2={40} y2={18} {...o(c)} />
      <Line x1={8} y1={30} x2={40} y2={30} {...o(c)} />
      <Circle cx={20} cy={12} r={1.6} fill={c.pop} />
      <Circle cx={36} cy={24} r={1.6} fill={c.cool} />
      <Circle cx={20} cy={36} r={1.6} fill={c.pop} />
    </G>
  ),
  taxi: (c) => (
    <G>
      <Rect x={19} y={9} width={10} height={6} rx={1.5} fill={c.pop} stroke={c.ink} strokeWidth={1.5} />
      <Path d="M6 32 V26 L12 16 H36 L42 26 V32 Z" {...o(c, c.soft)} />
      <Line x1={14} y1={24} x2={34} y2={24} {...o(c)} />
      <Circle cx={14} cy={34} r={4} {...o(c, c.paper)} />
      <Circle cx={34} cy={34} r={4} {...o(c, c.paper)} />
    </G>
  ),
  busStop: (c) => (
    <G>
      <Line x1={38} y1={6} x2={38} y2={42} {...o(c)} />
      <Circle cx={38} cy={9} r={4} {...o(c, c.pop)} />
      <Rect x={6} y={14} width={24} height={22} rx={4} {...o(c, c.soft)} />
      <Rect x={9} y={17} width={18} height={8} rx={1.5} {...o(c, c.paper)} />
      <Circle cx={12} cy={31} r={1.6} fill={c.ink} />
      <Circle cx={24} cy={31} r={1.6} fill={c.ink} />
      <Line x1={10} y1={36} x2={10} y2={40} {...o(c)} />
      <Line x1={26} y1={36} x2={26} y2={40} {...o(c)} />
    </G>
  ),
  noEntry: (c) => (
    <G>
      <Circle cx={24} cy={24} r={18} fill={c.stop} />
      <Rect x={12} y={21} width={24} height={6} rx={1.5} fill={c.paper} />
    </G>
  ),
  keepOut: (c) => (
    <G>
      <Line x1={10} y1={18} x2={10} y2={42} {...o(c)} />
      <Line x1={38} y1={18} x2={38} y2={42} {...o(c)} />
      <Rect x={5} y={18} width={38} height={8} rx={2} {...o(c, c.paper)} />
      <Path d="M13 18 L9 26 M23 18 L19 26 M33 18 L29 26 M43 20 L40 26" {...s(c.stop, 3)} />
      <Line x1={6} y1={42} x2={42} y2={42} {...o(c)} />
    </G>
  ),
  cashOnly: (c) => (
    <G>
      <Rect x={5} y={12} width={30} height={18} rx={2} {...o(c, c.soft)} />
      <Circle cx={20} cy={21} r={4.5} {...o(c, c.paper)} />
      <Circle cx={35} cy={33} r={8} {...o(c, c.pop)} />
      <Circle cx={35} cy={33} r={4} {...s(c.ink, 1.5)} />
    </G>
  ),
  noPhotos: (c) => (
    <G>
      <Path d="M12 17 H17 L19 14 H29 L31 17 H36 V32 H12 Z" {...o(c, c.soft)} />
      <Circle cx={24} cy={24.5} r={4.5} {...o(c, c.paper)} />
      {notAllowed(c)}
    </G>
  ),
  noSmoking: (c) => (
    <G>
      <Rect x={9} y={24} width={24} height={5} rx={1} {...o(c, c.paper)} />
      <Rect x={33} y={24} width={5} height={5} fill={c.pop} stroke={c.ink} strokeWidth={1.5} />
      <Path d="M36 20 Q34 17 37 14 Q40 11 38 8" {...s(c.ink, 1.8)} />
      {notAllowed(c)}
    </G>
  ),
  danger: (c) => (
    <G>
      <Path d="M24 6 L43 39 H5 Z" {...o(c, c.soft)} />
      <Line x1={24} y1={17} x2={24} y2={28} {...s(c.stop, 3.5)} />
      <Circle cx={24} cy={33.5} r={2} fill={c.stop} />
    </G>
  ),
  emergencyExit: (c) => (
    <G>
      <Rect x={30} y={8} width={12} height={32} rx={2} {...o(c, c.soft)} />
      <Circle cx={15} cy={11} r={3.5} {...o(c, c.cool)} />
      <Path d="M14 16 L18 26 L24 30 M18 26 L12 34 M16 20 L24 18 M15 19 L8 24" {...s(c.ink, 3)} />
      {arrow(c.cool, 20, 28, 40)}
    </G>
  ),
  wetFloor: (c) => (
    <G>
      <Path d="M24 6 L42 38 H6 Z" {...o(c, c.soft)} />
      <Path d="M24 15 Q19 22 19 25 A5 5 0 0 0 29 25 Q29 22 24 15 Z" {...o(c, c.cool)} />
      <Path d="M13 34 Q16 32 19 34 T25 34 T31 34 T37 34" {...s(c.ink, 1.8)} />
    </G>
  ),
  pharmacy: (c) => (
    <G>
      <G transform="rotate(-35 24 24)">
        <Rect x={10} y={18} width={28} height={12} rx={6} {...o(c, c.paper)} />
        <Path d="M24 18 H32 A6 6 0 0 1 32 30 H24 Z" fill={c.cool} />
        <Rect x={10} y={18} width={28} height={12} rx={6} {...o(c)} />
      </G>
      <Circle cx={36} cy={37} r={4} {...o(c, c.pop)} />
    </G>
  ),
  hospital: (c) => (
    <G>
      <Path d="M6 40 V22 M42 40 V30 M6 30 H42" {...o(c)} />
      <Rect x={18} y={22} width={24} height={8} rx={2} {...o(c, c.soft)} />
      <Circle cx={12} cy={25} r={3.5} {...o(c, c.paper)} />
      <Rect x={28} y={7} width={10} height={10} rx={2} fill={c.cool} />
      <Path d="M33 9 V15 M30 12 H36" {...s(c.paper, 2)} />
    </G>
  ),
  information: (c) => (
    <G>
      <Circle cx={24} cy={24} r={18} {...o(c, c.soft)} />
      <Circle cx={24} cy={15} r={2.6} fill={c.cool} />
      <Path d="M20 21 H25 V34 M20 34 H29" {...s(c.cool, 3.5)} />
    </G>
  ),
};

/** The pictogram for one sign at the given size (48 by default), hidden from screen readers. */
export const SignIcon = memo(function SignIcon({ id, size = 48 }: { id: SignId; size?: number }) {
  const { theme } = useApp();
  const c: Ink = { ink: theme.ink, soft: theme.accentSoft, pop: theme.accent, cool: theme.sea, stop: theme.danger, paper: theme.cardRaised };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {GLYPHS[id](c)}
      </Svg>
    </View>
  );
});
