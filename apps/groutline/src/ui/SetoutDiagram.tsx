/** Plan view of the set-out: full tiles, cut tiles (tinted), grout, and the centre lines. */
import { useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { AxisPlan } from '../core/setout.ts';
import { formatLength, type UnitSystem } from '../core/units.ts';
import { useTheme } from '../theme/theme.ts';

const FONT_FAMILY = Platform.select({ ios: 'System', default: 'Helvetica, Arial, sans-serif' });
const MAX_PIECES = 120; // per direction; beyond this a plan is unreadable, so we draw a summary grid

export function SetoutDiagram({ x, y, system, tileX, tileY }: { x: AxisPlan; y: AxisPlan; system: UnitSystem; tileX: number; tileY: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const pad = 26;
  const inner = Math.max(0, w - pad * 2 - 56);
  let scale = x.span > 0 ? inner / x.span : 0;
  const maxH = 440;
  if (y.span * scale > maxH) scale = maxH / y.span;
  const W = x.span * scale, H = y.span * scale;
  const ox = (w - 56 - W) / 2, oy = pad;
  const drawable = x.pieces.length <= MAX_PIECES && y.pieces.length <= MAX_PIECES;
  const full = (p: [number, number], tile: number) => Math.abs(p[1] - p[0] - tile) < 0.6;
  const label = (mm: number) => formatLength(mm, system, 'tile');
  const cutX = x.cutStart || x.cutEnd, cutY = y.cutStart || y.cutEnd;
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} accessible accessibilityRole="image"
      accessibilityLabel={`Set-out plan: ${x.pieces.length} pieces along the length and ${y.pieces.length} across. Edge cuts ${cutX ? label(x.cutStart || x.cutEnd) : 'none'} along the length and ${cutY ? label(y.cutStart || y.cutEnd) : 'none'} across. Tinted tiles are cuts.`}>
      {w > 0 && scale > 0 ? (
        <Svg width={w} height={H + pad * 2}>
          <Rect x={ox} y={oy} width={W} height={H} fill={t.grout} />
          {drawable ? (
            <G>
              {y.pieces.map((py, j) => x.pieces.map((px, i) => (
                <Rect key={`${i}-${j}`} x={ox + px[0] * scale} y={oy + py[0] * scale} width={Math.max(0.5, (px[1] - px[0]) * scale)} height={Math.max(0.5, (py[1] - py[0]) * scale)}
                  fill={full(px, tileX) && full(py, tileY) ? t.tile : t.tileCut} />
              )))}
            </G>
          ) : null}
          <Rect x={ox} y={oy} width={W} height={H} fill="none" stroke={t.ink} strokeWidth={2} />
          {x.mode !== 'wall' ? <Line x1={ox + W / 2} y1={oy - 8} x2={ox + W / 2} y2={oy + H + 8} stroke={t.accent} strokeWidth={2} strokeDasharray="6 5" /> : null}
          {y.mode !== 'wall' ? <Line x1={ox - 8} y1={oy + H / 2} x2={ox + W + 8} y2={oy + H / 2} stroke={t.accent} strokeWidth={2} strokeDasharray="6 5" /> : null}
          {x.cutStart ? <SvgText x={ox + 2} y={oy - 8} fill={t.ink} fontSize={13} fontWeight="700" fontFamily={FONT_FAMILY}>{`◀ ${label(x.cutStart)}`}</SvgText> : null}
          {x.cutEnd ? <SvgText x={ox + W - 2} y={oy - 8} fill={t.ink} fontSize={13} fontWeight="700" textAnchor="end" fontFamily={FONT_FAMILY}>{`${label(x.cutEnd)} ▶`}</SvgText> : null}
          {cutY ? <SvgText x={ox + W + 6} y={oy + Math.min(H / 2, 14)} fill={t.ink} fontSize={13} fontWeight="700" fontFamily={FONT_FAMILY}>{`▲ ${label(y.cutStart || y.cutEnd)}`}</SvgText> : null}
          <SvgText x={ox + W / 2} y={oy + H + 20} fill={t.ink2} fontSize={12} textAnchor="middle" fontFamily={FONT_FAMILY}>{formatLength(x.span, system)}</SvgText>
        </Svg>
      ) : <View style={{ height: 200 }} />}
    </View>
  );
}
