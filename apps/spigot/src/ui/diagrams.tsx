import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText, G, Rect } from 'react-native-svg';
import { usePalette } from './theme';

/**
 * Offset sketch: lower pipe, two fittings at θ, the diagonal travel, the upper pipe. Dimension lines for
 * offset (vertical), run (horizontal) and travel (diagonal). Drawn to the chosen angle (clamped for legibility).
 */
export function OffsetDiagram({ angle, labels }: { angle: number; labels?: { offset?: string; run?: string; travel?: string } }) {
  const c = usePalette();
  const W = 340, H = 190;
  const a = Math.max(11.25, Math.min(90, angle || 45));
  const rise = 110;
  const runPx = a >= 89.9 ? 0 : Math.min(200, rise / Math.tan((a * Math.PI) / 180));
  const x1 = (W - runPx) / 2 - 10, y1 = 150; // first fitting centre
  const x2 = x1 + runPx, y2 = y1 - rise; // second fitting centre
  const pipe = c.copper;
  const dim = c.ink2;
  const label = (x: number, y: number, s: string, anchor: 'start' | 'middle' | 'end' = 'middle') => (
    <G>
      <SvgText x={x} y={y} fill={c.ink} fontSize={15} fontWeight="700" textAnchor={anchor}>{s}</SvgText>
    </G>
  );
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Diagram: two ${a}° fittings. Offset is the sideways distance between the pipe centre lines, run is the distance along the pipe, travel is the diagonal between fitting centres.`}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} rx={16} fill={c.surface2} />
        {/* pipes */}
        <Line x1={12} y1={y1} x2={x1} y2={y1} stroke={pipe} strokeWidth={12} strokeLinecap="round" />
        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={pipe} strokeWidth={12} strokeLinecap="round" />
        <Line x1={x2} y1={y2} x2={W - 50} y2={y2} stroke={pipe} strokeWidth={12} strokeLinecap="round" />
        <Circle cx={x1} cy={y1} r={9} fill={c.ink} />
        <Circle cx={x2} cy={y2} r={9} fill={c.ink} />
        {/* offset dimension (right side) */}
        <Line x1={W - 34} y1={y1} x2={W - 34} y2={y2} stroke={dim} strokeWidth={2} />
        <Path d={`M ${W - 40} ${y2 + 8} L ${W - 34} ${y2} L ${W - 28} ${y2 + 8} M ${W - 40} ${y1 - 8} L ${W - 34} ${y1} L ${W - 28} ${y1 - 8}`} stroke={dim} strokeWidth={2} fill="none" />
        <Line x1={x1} y1={y1} x2={W - 26} y2={y1} stroke={dim} strokeWidth={1} strokeDasharray="4 4" />
        {label(W - 40, (y1 + y2) / 2 + 5, labels?.offset ? 'OFFSET' : 'OFFSET', 'end')}
        {labels?.offset ? label(W - 40, (y1 + y2) / 2 + 23, labels.offset, 'end') : null}
        {/* run dimension (bottom) */}
        {runPx > 0 ? (
          <G>
            <Line x1={x1} y1={y1 + 24} x2={x2} y2={y1 + 24} stroke={dim} strokeWidth={2} />
            <Line x1={x2} y1={y2} x2={x2} y2={y1 + 30} stroke={dim} strokeWidth={1} strokeDasharray="4 4" />
            {label((x1 + x2) / 2, y1 + 18 + 22, `RUN${labels?.run ? ` ${labels.run}` : ''}`)}
          </G>
        ) : null}
        {/* travel label */}
        {label((x1 + x2) / 2 - 14, (y1 + y2) / 2 - 8, `TRAVEL${labels?.travel ? ` ${labels.travel}` : ''}`, 'end')}
        {/* angle label */}
        {label(x1 + 24, y1 - 10, `${Number(a.toFixed(2))}°`, 'start')}
      </Svg>
    </View>
  );
}

/** Rolling offset: a box with rise up the side, roll across the floor and the true offset as its diagonal. */
export function RollingDiagram() {
  const c = usePalette();
  const W = 340, H = 180;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Diagram: a box. Rise goes up the side, roll goes across, and the true offset is the diagonal across the end of the box.">
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} rx={16} fill={c.surface2} />
        <Path d="M 70 140 L 200 140 L 250 100 L 250 30 L 120 30 L 70 70 Z" fill="none" stroke={c.line} strokeWidth={2} />
        <Path d="M 70 140 L 70 70 M 70 70 L 200 70 L 200 140 M 200 70 L 250 30" fill="none" stroke={c.line} strokeWidth={2} />
        <Line x1={200} y1={140} x2={250} y2={30} stroke={c.copper} strokeWidth={10} strokeLinecap="round" />
        <Line x1={200} y1={140} x2={200} y2={70} stroke={c.ink2} strokeWidth={3} />
        <Line x1={200} y1={70} x2={250} y2={30} stroke={c.ink2} strokeWidth={3} />
        <SvgText x={190} y={110} fill={c.ink} fontSize={15} fontWeight="700" textAnchor="end">RISE</SvgText>
        <SvgText x={232} y={46} fill={c.ink} fontSize={15} fontWeight="700" textAnchor="end">ROLL</SvgText>
        <SvgText x={262} y={96} fill={c.ink} fontSize={15} fontWeight="700">TRUE</SvgText>
        <SvgText x={262} y={114} fill={c.ink} fontSize={15} fontWeight="700">OFFSET</SvgText>
      </Svg>
    </View>
  );
}

/** Fall: a sloping pipe over a level line with the drop at the far end. */
export function FallDiagram({ drop, length }: { drop?: string; length?: string }) {
  const c = usePalette();
  const W = 340, H = 130;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Diagram: a drain falling along its length.${drop ? ` Total fall ${drop}.` : ''}`}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} rx={16} fill={c.surface2} />
        <Line x1={24} y1={40} x2={300} y2={40} stroke={c.ink3} strokeWidth={1.5} strokeDasharray="5 5" />
        <Line x1={24} y1={40} x2={300} y2={80} stroke={c.copper} strokeWidth={12} strokeLinecap="round" />
        <Line x1={318} y1={40} x2={318} y2={80} stroke={c.ink2} strokeWidth={2} />
        <Path d="M 312 48 L 318 40 L 324 48 M 312 72 L 318 80 L 324 72" stroke={c.ink2} strokeWidth={2} fill="none" />
        <SvgText x={306} y={30} fill={c.ink} fontSize={15} fontWeight="700" textAnchor="end">{drop ? `FALL ${drop}` : 'FALL'}</SvgText>
        <SvgText x={150} y={112} fill={c.ink} fontSize={15} fontWeight="700" textAnchor="middle">{length ? `LENGTH ${length}` : 'LENGTH'}</SvgText>
        <Path d="M 120 64 l 14 2 l -9 8" stroke={c.ink} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}

/** Cut length: two fittings, centre marks, faces, and the pipe between them. */
export function CutDiagram() {
  const c = usePalette();
  const W = 340, H = 120;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Diagram: a pipe between two fittings. Centre is the middle of a fitting, face is its mouth, and the take-off is from the centre to where the pipe stops inside.">
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} rx={16} fill={c.surface2} />
        <Rect x={30} y={34} width={56} height={40} rx={6} fill={c.ink} />
        <Rect x={254} y={34} width={56} height={40} rx={6} fill={c.ink} />
        <Line x1={74} y1={54} x2={266} y2={54} stroke={c.copper} strokeWidth={16} />
        <Line x1={58} y1={22} x2={58} y2={86} stroke={c.vis} strokeWidth={2} strokeDasharray="4 3" />
        <Line x1={282} y1={22} x2={282} y2={86} stroke={c.vis} strokeWidth={2} strokeDasharray="4 3" />
        <SvgText x={58} y={104} fill={c.ink} fontSize={13} fontWeight="700" textAnchor="middle">CENTRE</SvgText>
        <SvgText x={282} y={104} fill={c.ink} fontSize={13} fontWeight="700" textAnchor="middle">CENTRE</SvgText>
        <SvgText x={170} y={84} fill={c.ink} fontSize={14} fontWeight="700" textAnchor="middle">CUT LENGTH</SvgText>
        <SvgText x={86} y={24} fill={c.ink2} fontSize={12} textAnchor="middle">FACE</SvgText>
        <SvgText x={254} y={24} fill={c.ink2} fontSize={12} textAnchor="middle">FACE</SvgText>
        <Line x1={86} y1={28} x2={86} y2={34} stroke={c.ink2} strokeWidth={2} />
        <Line x1={254} y1={28} x2={254} y2={34} stroke={c.ink2} strokeWidth={2} />
      </Svg>
    </View>
  );
}
