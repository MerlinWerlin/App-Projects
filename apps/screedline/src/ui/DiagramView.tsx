/** Renders a tool diagram (src/tools/diagram.ts) as SVG, scaled to the card, in the theme's colours. */
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { useApp } from '../state/AppState';
import { BOLD, FONT, RADIUS, SPACE } from '../theme/theme';
import type { Diagram, Fill, Item } from '../tools/diagram';
import { Card, T } from './kit';

export function DiagramView({ d }: { d: Diagram }) {
  const { theme } = useApp();
  const { width } = useWindowDimensions();
  const boxW = Math.min(width - 2 * SPACE.l - 2 * SPACE.l, 520);
  const k = boxW / d.w;
  const fills: Record<Fill, string> = {
    slab: theme.dark ? '#5A5F66' : '#BDB8AC',
    paper: theme.card,
    amber: theme.amber,
    amberSoft: theme.dark ? 'rgba(255,194,51,0.35)' : 'rgba(255,179,0,0.30)',
    gravel: theme.dark ? '#3E3B35' : '#DCD6C8',
    soil: theme.dark ? '#3A3328' : '#CBB89A',
    steel: theme.dark ? '#2C3036' : '#E6E3DA',
    none: 'transparent',
  };
  const ink = theme.ink, muted = theme.ink2, edge = theme.dark ? '#9AA0A8' : '#3E4248';
  const fs = (s?: 's' | 'm') => (s === 'm' ? 11.5 : 9.5);
  const draw = (it: Item, i: number) => {
    switch (it.t) {
      case 'rect': return <Rect key={i} x={it.x} y={it.y} width={Math.max(0, it.w)} height={Math.max(0, it.h)} fill={fills[it.fill]} stroke={it.stroke ? edge : 'none'} strokeWidth={0.8} strokeDasharray={it.dash ? '3 2' : undefined} />;
      case 'circle': return <Circle key={i} cx={it.cx} cy={it.cy} r={it.r} fill={fills[it.fill]} stroke={it.fill === 'slab' ? edge : 'none'} strokeWidth={0.6} />;
      case 'poly': return <Polygon key={i} points={it.pts.map(p => p.join(',')).join(' ')} fill={fills[it.fill]} stroke={edge} strokeWidth={0.8} strokeDasharray={it.dash ? '3 2' : undefined} />;
      case 'line': {
        const style = it.kind === 'amber' ? { stroke: theme.amber, w: 3 } : it.kind === 'string' ? { stroke: theme.amber, w: 1.4 } : it.kind === 'ground' ? { stroke: muted, w: 1 } : it.kind === 'dash' ? { stroke: muted, w: 0.8 } : { stroke: edge, w: 3 };
        return <Line key={i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke={style.stroke} strokeWidth={style.w} strokeDasharray={it.kind === 'dash' || it.kind === 'ground' ? '4 3' : undefined} />;
      }
      case 'text': return <SvgText key={i} x={it.x} y={it.y} fontSize={fs(it.size)} fontWeight={it.kind === 'ink' ? '600' : '400'} fill={it.kind === 'amber' ? theme.amber : it.kind === 'muted' ? muted : ink} textAnchor={it.anchor ?? 'start'}>{it.s}</SvgText>;
      case 'dim': {
        const vertical = Math.abs(it.x2 - it.x1) < Math.abs(it.y2 - it.y1);
        const mx = (it.x1 + it.x2) / 2, my = (it.y1 + it.y2) / 2;
        const tw = it.label.length * 5.4 + 6;
        const t = 3;
        return (
          <G key={i}>
            <Line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke={ink} strokeWidth={0.8} />
            {vertical
              ? <><Line x1={it.x1 - t} y1={it.y1} x2={it.x1 + t} y2={it.y1} stroke={ink} strokeWidth={0.8} /><Line x1={it.x2 - t} y1={it.y2} x2={it.x2 + t} y2={it.y2} stroke={ink} strokeWidth={0.8} /></>
              : <><Line x1={it.x1} y1={it.y1 - t} x2={it.x1} y2={it.y1 + t} stroke={ink} strokeWidth={0.8} /><Line x1={it.x2} y1={it.y2 - t} x2={it.x2} y2={it.y2 + t} stroke={ink} strokeWidth={0.8} /></>}
            <Rect x={mx - tw / 2} y={my - 7} width={tw} height={13} rx={3} fill={theme.card} />
            <SvgText x={mx} y={my + 3.5} fontSize={9.5} fontWeight="700" fill={ink} textAnchor="middle">{it.label}</SvgText>
          </G>
        );
      }
    }
  };
  return (
    <Card style={{ gap: SPACE.m }}>
      <T kind="label">{d.title}</T>
      <View accessible accessibilityRole="image" accessibilityLabel={`${d.title} drawing. ${d.items.filter(i => i.t === 'dim').map(i => (i as { label: string }).label).join(', ')}`}>
        <Svg width={boxW} height={d.h * k} viewBox={`-6 -6 ${d.w + 12} ${d.h + 12}`}>
          {d.items.map(draw)}
        </Svg>
      </View>
      {d.legend ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.m }}>
          {d.legend.map(l => (
            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: fills[l.fill], borderWidth: StyleSheet.hairlineWidth, borderColor: edge }} />
              <Text maxFontSizeMultiplier={1.6} style={{ fontFamily: FONT.body, fontSize: 14, color: muted }}>{l.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {d.list ? (
        <View style={{ borderRadius: RADIUS.s, backgroundColor: theme.cardAlt, padding: SPACE.m, gap: 4 }}>
          <Text maxFontSizeMultiplier={1.6} style={{ ...BOLD, fontSize: 15, color: ink }}>{d.list.title}</Text>
          {d.list.rows.map(([a, b]) => (
            <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.m }}>
              <Text maxFontSizeMultiplier={1.6} style={{ fontFamily: FONT.body, fontSize: 16, color: ink, flex: 1 }}>{a}</Text>
              <Text maxFontSizeMultiplier={1.6} style={{ fontFamily: FONT.numBold, fontSize: 20, color: ink }}>{b}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
