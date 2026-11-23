import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { fromMm, fmt, type UnitSystem } from '../core/units.ts';
import { Txt } from './kit.tsx';
import { C, FONT, RADIUS, SPACE } from './theme.ts';

/**
 * Common pipe and CHS outside diameters (mm): AS 1074 / AS/NZS 1163 / ISO 4200 series and ASME B36.10 (168.3).
 */
export const PIPE_SIZES: { dn: string; od: number }[] = [
  { dn: 'DN15', od: 21.3 }, { dn: 'DN20', od: 26.9 }, { dn: 'DN25', od: 33.7 }, { dn: 'DN32', od: 42.4 },
  { dn: 'DN40', od: 48.3 }, { dn: 'DN50', od: 60.3 }, { dn: 'DN65', od: 76.1 }, { dn: 'DN80', od: 88.9 },
  { dn: 'DN90', od: 101.6 }, { dn: 'DN100', od: 114.3 }, { dn: 'DN125', od: 139.7 }, { dn: 'DN150', od: 165.1 },
  { dn: '6" NPS', od: 168.3 }, { dn: 'DN200', od: 219.1 }, { dn: 'DN250', od: 273.1 }, { dn: 'DN300', od: 323.9 },
];

export function PipeChips({ units, onPick, selectedMm }: { units: UnitSystem; onPick(display: string): void; selectedMm: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm, paddingVertical: 2 }} keyboardShouldPersistTaps="handled">
      {PIPE_SIZES.map(p => {
        const on = Math.abs(selectedMm - p.od) < 0.05;
        const shown = units === 'imperial' ? fmt(fromMm(p.od, units), 3) : fmt(p.od, 1);
        return (
          <Pressable
            key={p.dn}
            onPress={() => onPick(units === 'imperial' ? fmt(p.od / 25.4, 3) : String(p.od))}
            accessibilityRole="button"
            accessibilityLabel={`${p.dn}, ${shown} ${units === 'imperial' ? 'inches' : 'millimetres'} outside diameter`}
            style={{ minHeight: 48, minWidth: 64, paddingHorizontal: SPACE.md, borderRadius: RADIUS.sm, justifyContent: 'center', backgroundColor: on ? C.accent : C.raised }}
          >
            <Txt v="label" tone={on ? 'accentInk' : 'ink2'} style={{ fontSize: 12 }}>{p.dn}</Txt>
            <Txt v="headline" tone={on ? 'accentInk' : 'ink'}>{shown}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The unrolled wrap template, drawn to fit the screen (not to scale; the PDF is). */
export function WrapPreview({ points, circumference, maxDepth, ordinates, labels }: {
  points: { x: number; h: number }[];
  circumference: number;
  maxDepth: number;
  ordinates: { phiDeg: number; x: number; h: number }[];
  labels: (deg: number) => string | null;
}) {
  const { width } = useWindowDimensions();
  const W = width - SPACE.gutter * 2 - SPACE.lg * 2;
  const pad = 18;
  const depth = Math.max(maxDepth, circumference * 0.04);
  const H = Math.min(240, Math.max(120, (W * depth) / circumference + 2 * pad + 20));
  const sx = (W - 8) / circumference;
  const sy = (H - pad * 2 - 14) / depth;
  const X = (x: number) => 4 + x * sx;
  const Y = (h: number) => pad + 14 + h * sy;
  return (
    <View accessible accessibilityLabel={`Unrolled template preview. Deepest cut ${fmt(maxDepth, 1)} millimetres.`}>
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill={C.ground} rx={10} />
        <Line x1={X(0)} y1={Y(0)} x2={X(circumference)} y2={Y(0)} stroke={C.ink3} strokeDasharray="4 4" strokeWidth={1} />
        {ordinates.map((o, k) => {
          const q = labels(o.phiDeg);
          return (
            <G key={k}>
              <Line x1={X(o.x)} y1={Y(0)} x2={X(o.x)} y2={H - 6} stroke={q ? C.ink3 : C.line} strokeWidth={q ? 1.4 : 1} strokeDasharray={q ? undefined : '3 3'} />
              {q ? <SvgText x={X(o.x)} y={pad + 2} fill={C.ink2} fontSize={10} fontFamily={FONT.displayMed} textAnchor={k === 0 ? 'start' : k === ordinates.length - 1 ? 'end' : 'middle'}>{q}</SvgText> : null}
            </G>
          );
        })}
        <Polyline points={points.map(p => `${X(p.x)},${Y(p.h)}`).join(' ')} fill="none" stroke={C.accent} strokeWidth={3} strokeLinejoin="round" />
        {ordinates.map((o, k) => <Circle key={k} cx={X(o.x)} cy={Y(o.h)} r={3} fill={C.arc} />)}
      </Svg>
      <Txt v="small" tone="ink3">Pipe end at the top (dashed). Waste is above the orange line.</Txt>
    </View>
  );
}
