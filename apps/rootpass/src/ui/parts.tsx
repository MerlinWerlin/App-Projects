import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { fromMm, fmt, type UnitSystem } from '../core/units.ts';
import type { PipeSize } from '../core/country.ts';
import { useApp } from '../state/AppState.tsx';
import { Txt } from './kit.tsx';
import { C, FONT, RADIUS, SPACE } from './theme.ts';

/** The country's pipe series (src/core/country.ts): ISO / AS / EN DN sizes, or ASME B36.10M NPS. */
/** The series wall a pipe is usually bought in: Medium (AS 1074, EN 10255) or Sch 40 (ASME), else the first listed. */
export function usualWall(p: PipeSize): number | null {
  if (!p.walls) return null;
  return p.walls.Medium ?? p.walls['Sch 40'] ?? Object.values(p.walls)[0] ?? null;
}

export function PipeChips({ units, onPick, selectedMm, onPickWall }: { units: UnitSystem; onPick(display: string): void; selectedMm: number; onPickWall?: (display: string) => void }) {
  const { country } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.sm, paddingVertical: 2 }} keyboardShouldPersistTaps="handled">
      {country.pipes.map(p => {
        const on = Math.abs(selectedMm - p.od) < 0.05;
        const shown = units === 'imperial' ? fmt(fromMm(p.od, units), 3) : fmt(p.od, 1);
        return (
          <Pressable
            key={p.label}
            onPress={() => {
              onPick(units === 'imperial' ? fmt(p.od / 25.4, 3) : String(p.od));
              const w = usualWall(p);
              if (onPickWall && w !== null) onPickWall(units === 'imperial' ? fmt(w / 25.4, 3) : fmt(w, 1));
            }}
            accessibilityRole="button"
            accessibilityLabel={`${p.label}, ${shown} ${units === 'imperial' ? 'inches' : 'millimetres'} outside diameter`}
            style={{ minHeight: 48, minWidth: 64, paddingHorizontal: SPACE.md, borderRadius: RADIUS.sm, justifyContent: 'center', backgroundColor: on ? C.accent : C.raised }}
          >
            <Txt v="label" tone={on ? 'accentInk' : 'ink2'} style={{ fontSize: 12 }}>{p.label}</Txt>
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

/** Wall chips for the selected pipe in the local series (AS 1074 Light/Medium/Heavy, EN 10255, ASME schedules). */
export function ScheduleChips({ odMm, units, onPick, wallMm }: { odMm: number; units: UnitSystem; onPick(display: string): void; wallMm: number }) {
  const { country } = useApp();
  const p = country.pipes.find(x => Math.abs(x.od - odMm) < 0.05);
  if (!p?.walls || !Object.keys(p.walls).length) return null;
  const show = (mm: number) => (units === 'imperial' ? fmt(mm / 25.4, 3) : fmt(mm, 1));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
      {Object.entries(p.walls).map(([n, w]) => {
        // Selected when the wall field matches this series wall (to the displayed precision).
        const on = Math.abs(wallMm - w) < (units === 'imperial' ? 0.02 : 0.06);
        return (
          <Pressable key={n} onPress={() => onPick(show(w))} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${n} wall, ${show(w)}`}
            style={({ pressed }) => ({ minHeight: 52, minWidth: 92, flexGrow: 1, paddingHorizontal: SPACE.md, borderRadius: RADIUS.sm, justifyContent: 'center', backgroundColor: on ? C.accent : pressed ? C.line : C.raised })}>
            <Txt v="label" tone={on ? 'accentInk' : 'ink2'} style={{ fontSize: 12 }}>{n}</Txt>
            <Txt v="headline" tone={on ? 'accentInk' : 'ink'}>{show(w)}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
