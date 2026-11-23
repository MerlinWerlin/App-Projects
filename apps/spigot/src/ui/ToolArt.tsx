import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import type { ToolId } from '../state/data';

/**
 * Tool pictograms: one drawn set on a 64-unit grid, 4-unit outlines, copper pipe with a lighter top highlight and a
 * hi-vis accent, so the six tiles read as a family (same weight, same palette, same optical size).
 */
const COPPER = '#C8642B';
const VIS = '#FFCC00';
const WATER = '#2E8BD6';

export function ToolArt({ id, size = 56, ink }: { id: ToolId; size?: number; ink: string }) {
  const sw = 4;
  const pipe = (d: string) => (
    <G>
      <Path d={d} stroke={ink} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke={COPPER} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  );
  let body: React.ReactNode = null;
  switch (id) {
    case 'offset':
      body = (
        <G>
          {pipe('M8 48 H22 L42 18 H56')}
          <Line x1={22} y1={56} x2={22} y2={40} stroke={VIS} strokeWidth={3} strokeDasharray="3 3" />
          <Line x1={42} y1={6} x2={42} y2={10} stroke={VIS} strokeWidth={3} />
          <Path d="M28 56 L50 56" stroke={VIS} strokeWidth={3} strokeLinecap="round" />
        </G>
      );
      break;
    case 'fall':
      body = (
        <G>
          <Line x1={8} y1={20} x2={56} y2={20} stroke={ink} strokeWidth={2.5} strokeDasharray="4 4" />
          {pipe('M10 24 L54 38')}
          <Path d="M50 46 L50 58 M44 52 L50 58 L56 52" stroke={VIS} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      );
      break;
    case 'cut':
      body = (
        <G>
          {pipe('M10 32 H54')}
          <Rect x={6} y={22} width={10} height={20} rx={3} fill={ink} />
          <Rect x={48} y={22} width={10} height={20} rx={3} fill={ink} />
          <Line x1={32} y1={10} x2={32} y2={54} stroke={VIS} strokeWidth={3.5} strokeDasharray="5 4" strokeLinecap="round" />
        </G>
      );
      break;
    case 'rolling':
      body = (
        <G>
          <Path d="M12 48 L12 24 L30 14 L52 22 L52 46 L34 56 Z" stroke={ink} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          <Path d="M12 24 L34 32 L52 22 M34 32 L34 56" stroke={ink} strokeWidth={2} fill="none" strokeDasharray="3 3" />
          {pipe('M14 46 L50 24')}
          <Circle cx={50} cy={24} r={4} fill={VIS} />
        </G>
      );
      break;
    case 'flow':
      body = (
        <G>
          <Circle cx={30} cy={34} r={20} fill={COPPER} stroke={ink} strokeWidth={sw} />
          <Circle cx={30} cy={34} r={12} fill="#FFFFFF" stroke={ink} strokeWidth={2.5} />
          <Path d="M18 36 Q24 31 30 36 T42 36 V40 A12 12 0 0 1 18 40 Z" fill={WATER} />
          <Path d="M52 10 C52 10 58 18 58 22 A6 6 0 0 1 46 22 C46 18 52 10 52 10 Z" fill={WATER} stroke={ink} strokeWidth={2} />
        </G>
      );
      break;
    case 'cutlist':
      body = (
        <G>
          {[14, 30, 46].map((y, i) => (
            <G key={y}>
              <Rect x={8} y={y - 5} width={48} height={10} rx={3} fill={COPPER} stroke={ink} strokeWidth={2.5} />
              <Line x1={8 + [26, 18, 32][i]!} y1={y - 5} x2={8 + [26, 18, 32][i]!} y2={y + 5} stroke={ink} strokeWidth={2.5} />
              <Rect x={8 + [40, 36, 44][i]!} y={y - 5} width={48 - [40, 36, 44][i]!} height={10} rx={2} fill={VIS} stroke={ink} strokeWidth={2.5} />
            </G>
          ))}
        </G>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {body}

    </Svg>
  );
}
