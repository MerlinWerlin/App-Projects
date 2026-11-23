/**
 * Schematic (not to scale) of the bend being calculated, with the numbered marks the person puts on the conduit.
 */
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { View } from 'react-native';
import { useApp } from '../state/AppState.tsx';

export type BendKind = 'offset' | 'saddle3' | 'saddle4' | 'kick' | 'stub90';

const W = 340;
const H = 150;

export function BendDiagram({ kind, label }: { kind: BendKind; label: string }) {
  const { theme } = useApp();
  // Gold conduit on dark; black on light and Sunlight, where yellow on white is too faint.
  const pipe = theme.dark ? theme.accent : '#15120A';
  const ink = theme.ink;
  // Marks read like a pencil line: white on dark, red on light.
  const markInk = theme.dark ? theme.ink : theme.fail;
  const ink2 = theme.ink2;
  const obstacle = theme.dark ? '#3A3F48' : '#C9C4B8';
  const y0 = 118;
  const stroke = 9;
  const mark = (x: number, y: number, n: number) => (
    <>
      <Line x1={x} y1={y - 16} x2={x} y2={y + 16} stroke={markInk} strokeWidth={4} />
      <Circle cx={x} cy={y + 28} r={10} fill={markInk} />
      <SvgText x={x} y={y + 32.5} fontSize={13} fontWeight="800" fill={theme.dark ? theme.ground : '#FFFFFF'} textAnchor="middle">{n}</SvgText>
    </>
  );
  let body;
  if (kind === 'offset') {
    body = (
      <>
        <Rect x={196} y={y0 - 4} width={130} height={30} fill={obstacle} rx={4} />
        <Path d={`M10 ${y0} L120 ${y0} L180 ${y0 - 60} L330 ${y0 - 60}`} stroke={pipe} strokeWidth={stroke} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {mark(120, y0, 1)}
        {mark(180, y0 - 60, 2)}
        <Line x1={340 - 8} y1={y0} x2={340 - 8} y2={y0 - 60} stroke={ink2} strokeWidth={2} strokeDasharray="4 4" />
        <SvgText x={300} y={y0 - 26} fontSize={12} fill={ink2} textAnchor="end">rise</SvgText>
      </>
    );
  } else if (kind === 'saddle3') {
    body = (
      <>
        <Circle cx={170} cy={y0 - 6} r={34} fill={obstacle} />
        <Path d={`M10 ${y0 + 28} L95 ${y0 + 28} L170 ${y0 - 48} L245 ${y0 + 28} L330 ${y0 + 28}`} stroke={pipe} strokeWidth={stroke} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {mark(95, y0 + 2, 1)}
        {mark(170, y0 - 74, 2)}
        {mark(245, y0 + 2, 3)}
      </>
    );
  } else if (kind === 'saddle4') {
    body = (
      <>
        <Rect x={130} y={y0 - 40} width={90} height={66} fill={obstacle} rx={4} />
        <Path d={`M10 ${y0 + 26} L70 ${y0 + 26} L125 ${y0 - 52} L225 ${y0 - 52} L280 ${y0 + 26} L330 ${y0 + 26}`} stroke={pipe} strokeWidth={stroke} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {mark(70, y0, 1)}
        {mark(125, y0 - 78, 2)}
        {mark(225, y0 - 78, 3)}
        {mark(280, y0, 4)}
      </>
    );
  } else if (kind === 'kick') {
    body = (
      <>
        <Line x1={10} y1={y0 + 10} x2={330} y2={y0 + 10} stroke={obstacle} strokeWidth={6} />
        <Path d={`M10 ${y0} L150 ${y0} L320 ${y0 - 80}`} stroke={pipe} strokeWidth={stroke} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {mark(150, y0 - 6, 1)}
        <SvgText x={250} y={y0 - 10} fontSize={12} fill={ink2}>angle</SvgText>
      </>
    );
  } else {
    body = (
      <>
        <Line x1={10} y1={y0 + 12} x2={330} y2={y0 + 12} stroke={obstacle} strokeWidth={6} />
        <Path d={`M10 ${y0} L210 ${y0} Q260 ${y0} 260 ${y0 - 50} L260 ${12}`} stroke={pipe} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {mark(150, y0 - 6, 1)}
        <Line x1={300} y1={12} x2={300} y2={y0 + 6} stroke={ink2} strokeWidth={2} strokeDasharray="4 4" />
        <SvgText x={292} y={70} fontSize={12} fill={ink2} textAnchor="end">stub</SvgText>
      </>
    );
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ alignItems: 'center' }}>
      <Svg width="100%" height={H + 20} viewBox={`0 -14 ${W} ${H + 20}`}>{body}</Svg>
    </View>
  );
}
