// The refrigeration cycle, drawn with the readings on it: condenser and liquid line in red (high side), evaporator
// and suction line in blue (low side), compressor and metering device between. Each measured value sits where the
// probe or the hose goes, so the diagram doubles as "where to measure".
import Svg, { Circle, G, Line, Path, Rect, Text as T } from 'react-native-svg';
import { usePalette } from '../theme/tokens.ts';

export type CycleValues = {
  evap: string;
  cond: string;
  suctionLine: string;
  liquidLine: string;
  suctionP: string;
  liquidP: string;
  sh: string;
  sc: string;
  shOk: boolean;
  scOk: boolean;
};

function Coil({ x, y, w, color }: { x: number; y: number; w: number; color: string }) {
  const n = 9;
  const step = w / n;
  let d = `M ${x} ${y}`;
  for (let i = 0; i < n; i++) d += ` l ${step / 2} -9 l ${step / 2} 9`;
  return <Path d={d} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="round" />;
}

function Pill({ x, y, text, fill, ink, anchor = 'middle' }: { x: number; y: number; text: string; fill: string; ink: string; anchor?: 'start' | 'middle' | 'end' }) {
  const w = Math.max(44, text.length * 7.6 + 16);
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return (
    <G>
      <Rect x={left} y={y - 13} width={w} height={22} rx={11} fill={fill} />
      <T x={left + w / 2} y={y + 3} fontSize={13} fontWeight="800" fill={ink} textAnchor="middle">{text}</T>
    </G>
  );
}

export function CycleDiagram({ v }: { v: CycleValues }) {
  const p = usePalette();
  const label = (x: number, y: number, s: string, c = p.text2, size = 11, anchor: 'start' | 'middle' | 'end' = 'middle') => (
    <T x={x} y={y} fontSize={size} fontWeight="700" fill={c} textAnchor={anchor}>{s}</T>
  );
  return (
    <Svg
      width="100%"
      height={300}
      viewBox="0 0 340 300"
      accessibilityLabel={`Refrigeration cycle. Evaporating ${v.evap}, condensing ${v.cond}. Superheat ${v.sh} on the suction line at ${v.suctionLine}. Subcooling ${v.sc} on the liquid line at ${v.liquidLine}.`}
    >
      {/* Condenser (high side) */}
      <Rect x={70} y={28} width={200} height={44} rx={10} fill={p.highSoft} />
      <Coil x={84} y={58} w={172} color={p.high} />
      {label(170, 20, `CONDENSER  ${v.cond}`, p.high, 12)}
      {/* Evaporator (low side) */}
      <Rect x={70} y={218} width={200} height={44} rx={10} fill={p.lowSoft} />
      <Coil x={84} y={248} w={172} color={p.low} />
      {label(170, 284, `EVAPORATOR  ${v.evap}`, p.low, 12)}
      {/* Compressor */}
      <Line x1={300} y1={240} x2={300} y2={176} stroke={p.low} strokeWidth={4} />
      <Line x1={270} y1={240} x2={300} y2={240} stroke={p.low} strokeWidth={4} />
      <Circle cx={300} cy={150} r={26} fill={p.surface} stroke={p.text} strokeWidth={3} />
      <Path d="M 288 150 L 300 138 L 312 150 M 300 138 L 300 162" stroke={p.text} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Line x1={300} y1={124} x2={300} y2={50} stroke={p.high} strokeWidth={4} strokeDasharray="7 5" />
      <Line x1={270} y1={50} x2={300} y2={50} stroke={p.high} strokeWidth={4} strokeDasharray="7 5" />
      {label(300, 196, 'COMP', p.text2, 10)}
      {/* Liquid line and metering device */}
      <Line x1={70} y1={50} x2={40} y2={50} stroke={p.high} strokeWidth={4} />
      <Line x1={40} y1={50} x2={40} y2={136} stroke={p.high} strokeWidth={4} />
      <Path d="M 28 136 L 52 136 L 40 152 Z M 28 168 L 52 168 L 40 152 Z" fill={p.text} />
      <Line x1={40} y1={168} x2={40} y2={240} stroke={p.low} strokeWidth={4} />
      <Line x1={40} y1={240} x2={70} y2={240} stroke={p.low} strokeWidth={4} />
      {label(62, 156, 'METERING', p.text2, 10, 'start')}
      {/* Readings where they are taken */}
      {label(52, 92, `${v.liquidP}`, p.high, 12, 'start')}
      {label(52, 108, `line ${v.liquidLine}`, p.text2, 11, 'start')}
      <Pill x={110} y={122} text={`SC ${v.sc}`} fill={v.scOk ? p.ok : p.high} ink={p.onHigh} />
      {label(288, 214, `${v.suctionP}`, p.low, 12, 'end')}
      {label(288, 200, `line ${v.suctionLine}`, p.text2, 11, 'end')}
      <Pill x={240} y={186} text={`SH ${v.sh}`} fill={v.shOk ? p.ok : p.low} ink={p.onLow} />
    </Svg>
  );
}
