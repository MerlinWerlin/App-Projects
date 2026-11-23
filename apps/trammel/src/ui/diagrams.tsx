// Drawings for each calculator, to scale where it matters (stairs, rafters, arcs, layouts, cut bars).
// Decorative to VoiceOver except for a one-line description; every number is also in the readouts.
import { Text, View } from 'react-native';
import Svg, { Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import type { Bar } from '../core/cutlist.ts';
import { toRad } from '../core/units.ts';
import { fonts, radius, space, useTheme } from '../theme/theme.ts';

function Frame({ label, children, height = 200 }: { label: string; children: React.ReactNode; height?: number }) {
  const t = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ backgroundColor: t.card, borderRadius: radius.l, borderWidth: 1, borderColor: t.line, padding: space.m, height }}>
      {children}
    </View>
  );
}

export function StairDiagram({ risers, riser, going }: { risers: number; riser: number; going: number }) {
  const t = useTheme();
  const n = Math.max(1, Math.min(risers, 24));
  const W = 320;
  const H = 180;
  const totalRun = going * (n - 1) + going * 0.9;
  const totalRise = riser * n;
  const s = Math.min((W - 40) / totalRun, (H - 30) / totalRise);
  const ox = 20;
  const oy = H - 10;
  let d = `M ${ox} ${oy}`;
  for (let i = 0; i < n; i++) {
    const x = ox + i * going * s;
    const y = oy - (i + 1) * riser * s;
    d += ` L ${x} ${y}`;
    d += ` L ${x + (i === n - 1 ? going * 0.9 : going) * s} ${y}`;
  }
  const pitchEnd = { x: ox + (n - 1) * going * s, y: oy - n * riser * s };
  return (
    <Frame label={`Stair profile: ${risers} risers`}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={0} y1={oy} x2={W} y2={oy} stroke={t.muted} strokeWidth={1.5} />
        <Path d={d} stroke={t.ink} strokeWidth={3} fill="none" strokeLinejoin="round" />
        <Line x1={ox} y1={oy - riser * s} x2={pitchEnd.x} y2={pitchEnd.y} stroke={t.blade} strokeWidth={3} strokeDasharray="6 5" />
        <SvgText x={ox + going * s * 0.5} y={oy - riser * s - 6} fontSize={13} fontWeight="700" fill={t.ink} textAnchor="middle">
          G
        </SvgText>
        <SvgText x={ox - 9} y={oy - riser * s * 0.45} fontSize={13} fontWeight="700" fill={t.ink} textAnchor="middle">
          R
        </SvgText>
      </Svg>
    </Frame>
  );
}

export function RafterDiagram({ pitchDeg, overhangRatio }: { pitchDeg: number; overhangRatio: number }) {
  const t = useTheme();
  const W = 320;
  const H = 170;
  const tan = Math.tan(toRad(pitchDeg));
  const run = 230;
  const rise = Math.min(130, run * tan);
  const runDrawn = rise / tan;
  const ox = 50;
  const oy = H - 20;
  const ex = ox - Math.min(40, runDrawn * overhangRatio);
  const ey = oy + (ox - ex) * tan;
  const rx = ox + runDrawn;
  const ry = oy - rise;
  return (
    <Frame label={`Rafter at ${pitchDeg.toFixed(1)} degrees`} height={190}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Rect x={ox - 16} y={oy} width={16} height={20} fill={t.muted} />
        <Line x1={rx} y1={ry - 8} x2={rx} y2={oy} stroke={t.line} strokeWidth={1.5} strokeDasharray="4 4" />
        <Line x1={ox} y1={oy} x2={rx} y2={oy} stroke={t.line} strokeWidth={1.5} strokeDasharray="4 4" />
        <Rect x={rx} y={ry - 10} width={8} height={30} fill={t.muted} />
        <Line x1={ex} y1={Math.min(ey, H - 2)} x2={rx} y2={ry} stroke={t.ink} strokeWidth={10} strokeLinecap="round" />
        <Line x1={ex} y1={Math.min(ey, H - 2)} x2={rx} y2={ry} stroke={t.blade} strokeWidth={4} strokeLinecap="round" />
        <SvgText x={(ox + rx) / 2} y={oy + 16} fontSize={13} fontWeight="700" fill={t.ink} textAnchor="middle">
          run
        </SvgText>
        <SvgText x={rx + 14} y={(oy + ry) / 2} fontSize={13} fontWeight="700" fill={t.ink}>
          rise
        </SvgText>
        <SvgText x={ox + 34} y={oy - 6} fontSize={13} fontWeight="700" fill={t.ink}>
          {`${pitchDeg.toFixed(1)}°`}
        </SvgText>
      </Svg>
    </Frame>
  );
}

export function MitreDiagram({ corner }: { corner: number }) {
  const t = useTheme();
  const W = 320;
  const H = 180;
  const cx = 160;
  const cy = 150;
  const L = 140;
  const w = 22;
  const half = toRad(corner / 2);
  // Two boards meeting at the corner, symmetric about the vertical; the mitre line is the bisector.
  const a1 = -Math.PI / 2 - half;
  const a2 = -Math.PI / 2 + half;
  const board = (a: number, side: 1 | -1) => {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const nx = -dy * side;
    const ny = dx * side;
    const inner = w / Math.sin(half);
    const p1 = [cx, cy];
    const p2 = [cx + dx * L, cy + dy * L];
    const p3 = [p2[0] + nx * w, p2[1] + ny * w];
    const p4 = [cx, cy - inner];
    return [p1, p2, p3, p4].map((p) => p.join(',')).join(' ');
  };
  return (
    <Frame label={`Two pieces meeting at ${corner.toFixed(1)} degrees`}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Polygon points={board(a1, 1)} fill={t.blade} stroke={t.ink} strokeWidth={2} />
        <Polygon points={board(a2, -1)} fill={t.blade} stroke={t.ink} strokeWidth={2} />
        <Line x1={cx} y1={cy + 10} x2={cx} y2={cy - w / Math.sin(half) - 14} stroke={t.ink} strokeWidth={2} strokeDasharray="5 4" />
      </Svg>
    </Frame>
  );
}

export function ArcDiagram({ chord, rise, radius: r }: { chord: number; rise: number; radius: number }) {
  const t = useTheme();
  const W = 320;
  const H = 170;
  const s = Math.min((W - 40) / chord, (H - 40) / rise);
  const x0 = W / 2 - (chord * s) / 2;
  const x1 = W / 2 + (chord * s) / 2;
  const y = H - 20;
  const large = rise > r ? 1 : 0;
  return (
    <Frame label="Arch from span and rise" height={190}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Line x1={x0} y1={y} x2={x1} y2={y} stroke={t.muted} strokeWidth={2} />
        <Path d={`M ${x0} ${y} A ${r * s} ${r * s} 0 ${large} 1 ${x1} ${y}`} stroke={t.ink} strokeWidth={4} fill="none" />
        <Line x1={W / 2} y1={y} x2={W / 2} y2={y - rise * s} stroke={t.blade} strokeWidth={3} />
        <SvgText x={W / 2 + 8} y={y - (rise * s) / 2} fontSize={13} fontWeight="700" fill={t.ink}>
          rise
        </SvgText>
        <SvgText x={W / 2} y={y + 16} fontSize={13} fontWeight="700" fill={t.ink} textAnchor="middle">
          span
        </SvgText>
      </Svg>
    </Frame>
  );
}

export function LayoutDiagram({ length, centres, thickness }: { length: number; centres: number[]; thickness: number }) {
  const t = useTheme();
  const W = 320;
  const H = 90;
  const s = (W - 20) / length;
  return (
    <Frame label={`${centres.length} members along ${Math.round(length)} millimetres`} height={110}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Rect x={10} y={12} width={length * s} height={10} fill={t.ink} />
        <Rect x={10} y={H - 22} width={length * s} height={10} fill={t.ink} />
        {centres.map((c, i) => (
          <Rect key={i} x={10 + (c - thickness / 2) * s} y={22} width={Math.max(2, thickness * s)} height={H - 44} fill={t.blade} stroke={t.ink} strokeWidth={0.8} />
        ))}
      </Svg>
    </Frame>
  );
}

export function CutBars({ bars, label }: { bars: Bar[]; label: (mm: number) => string }) {
  const t = useTheme();
  const longest = Math.max(...bars.map((b) => b.stock));
  return (
    <View style={{ gap: space.m }}>
      {bars.map((b, i) => (
        <View key={i} accessible accessibilityLabel={`Length ${i + 1}, ${label(b.stock)}: cut ${b.cuts.map((c) => label(c.length)).join(', ')}; offcut ${label(b.offcut)}`} style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.ink }}>
              #{i + 1} · {label(b.stock)}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.muted }}>offcut {label(b.offcut)}</Text>
          </View>
          <View style={{ flexDirection: 'row', height: 40, width: `${(b.stock / longest) * 100}%`, borderRadius: 6, overflow: 'hidden', backgroundColor: t.sunk, borderWidth: 1.5, borderColor: t.ink }}>
            {b.cuts.map((c, k) => (
              <View key={k} style={{ flexGrow: c.length, flexBasis: 0, backgroundColor: t.blade, borderRightWidth: 2, borderRightColor: t.ink, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: fonts.display, fontSize: 16, color: t.bladeInk, paddingHorizontal: 2 }}>
                  {label(c.length).replace(' mm', '')}
                </Text>
              </View>
            ))}
            <View style={{ flexGrow: Math.max(0, b.stock - b.used), flexBasis: 0 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Empty-state art for Jobs: a carpenter's pencil resting on a length of tape blade. */
export function EmptyJobsArt() {
  const t = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: 220, height: 120 }}>
      <Svg width="100%" height="100%" viewBox="0 0 220 120">
        <Rect x={10} y={56} width={200} height={40} rx={6} fill={t.blade} stroke={t.ink} strokeWidth={2.5} />
        {Array.from({ length: 24 }, (_, i) => (
          <Line key={i} x1={18 + i * 8} y1={56} x2={18 + i * 8} y2={i % 5 === 0 ? 76 : i % 1 === 0 ? 66 : 62} stroke={t.bladeInk} strokeWidth={2} />
        ))}
        <Polygon points="40,40 176,14 182,30 46,56" fill={t.card} stroke={t.ink} strokeWidth={2.5} strokeLinejoin="round" />
        <Polygon points="176,14 200,16 182,30" fill={t.blade} stroke={t.ink} strokeWidth={2.5} strokeLinejoin="round" />
        <Polygon points="194,15.5 200,16 196,21" fill={t.ink} />
        <Line x1={62} y1={36} x2={62 + 0} y2={52} stroke={t.ink} strokeWidth={2} />
      </Svg>
    </View>
  );
}
