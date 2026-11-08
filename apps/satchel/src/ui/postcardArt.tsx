// T147: original postcard and stamp illustrations, drawn with react-native-svg (already a dependency) from theme tokens
// only (card / line / ink outline, accentSoft and seaSoft washes, accent and sea highlights), so they follow light and
// dark mode. A postcard with a small hills-and-sun scene on the picture half, address lines on the writing half and
// a perforated stamp with a wavy postmark; a lone stamp for list rows (with a tick once sent). Simple shapes, no
// postal-service emblems, no brands. Decorative: the row or card around the art names it for screen readers. The
// sent stamp fades in on a timed transition (static with Reduce Motion), never a spring.
import { memo, useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useApp } from '../state/app.tsx';
import { duration, fadeIn } from '../theme/motion.ts';

type Paint = { paper: string; edge: string; ink: string; muted: string; warm: string; warmSoft: string; cool: string; coolSoft: string };

function usePaint(): Paint {
  const { theme } = useApp();
  return { paper: theme.cardRaised, edge: theme.line, ink: theme.ink, muted: theme.muted, warm: theme.accent, warmSoft: theme.accentSoft, cool: theme.sea, coolSoft: theme.seaSoft };
}

/** Perforated stamp edge: a rectangle with small bites along every side (w x h at x, y). */
function perforated(x: number, y: number, w: number, h: number, r = 1.6, step = 5): string {
  let d = `M${x} ${y}`;
  for (let i = x + step; i <= x + w; i += step) d += ` L${i - step / 2 - r} ${y} A${r} ${r} 0 0 0 ${i - step / 2 + r} ${y} L${i} ${y}`;
  for (let i = y + step; i <= y + h; i += step) d += ` L${x + w} ${i - step / 2 - r} A${r} ${r} 0 0 0 ${x + w} ${i - step / 2 + r} L${x + w} ${i}`;
  for (let i = x + w - step; i >= x; i -= step) d += ` L${i + step / 2 + r} ${y + h} A${r} ${r} 0 0 0 ${i + step / 2 - r} ${y + h} L${i} ${y + h}`;
  for (let i = y + h - step; i >= y; i -= step) d += ` L${x} ${i + step / 2 + r} A${r} ${r} 0 0 0 ${x} ${i + step / 2 - r} L${x} ${i}`;
  return `${d} Z`;
}

/** The stamp's little picture: a sun over two hills, inside a 30 x 36 box at (x, y). */
function StampFace({ p, x, y }: { p: Paint; x: number; y: number }) {
  return (
    <G>
      <Path d={perforated(x, y, 30, 36)} fill={p.paper} stroke={p.edge} strokeWidth={1} />
      <Rect x={x + 4} y={y + 4} width={22} height={28} rx={2} fill={p.coolSoft} />
      <Circle cx={x + 19} cy={y + 13} r={4} fill={p.warm} />
      <Path d={`M${x + 4} ${y + 27} Q${x + 11} ${y + 17} ${x + 17} ${y + 24} Q${x + 21} ${y + 19} ${x + 26} ${y + 25} V${y + 32} H${x + 4} Z`} fill={p.cool} />
    </G>
  );
}

/** A postcard with a stamp and postmark (viewBox 160 x 110). */
export const PostcardArt = memo(function PostcardArt({ width = 160 }: { width?: number }) {
  const p = usePaint();
  const h = (width * 110) / 160;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={h} viewBox="0 0 160 110">
        <G rotation={-3} originX={80} originY={55}>
          <Rect x={8} y={10} width={144} height={92} rx={6} fill={p.paper} stroke={p.edge} strokeWidth={1.5} />
          {/* picture half: sea, hills and a sun */}
          <Rect x={14} y={16} width={64} height={80} rx={3} fill={p.warmSoft} />
          <Circle cx={56} cy={36} r={9} fill={p.warm} />
          <Path d="M14 74 Q30 56 44 68 Q56 58 78 70 V96 H14 Z" fill={p.cool} />
          <Path d="M14 84 Q30 78 46 84 T78 84 V96 H14 Z" fill={p.coolSoft} />
          <Path d="M20 30 q4 -3 8 0 M30 26 q3 -2 6 0" stroke={p.ink} strokeWidth={1.2} fill="none" strokeLinecap="round" />
          {/* divider and address lines */}
          <Line x1={86} y1={22} x2={86} y2={92} stroke={p.edge} strokeWidth={1.2} />
          <Line x1={94} y1={62} x2={144} y2={62} stroke={p.muted} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={94} y1={72} x2={140} y2={72} stroke={p.muted} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={94} y1={82} x2={130} y2={82} stroke={p.muted} strokeWidth={1.4} strokeLinecap="round" />
          <StampFace p={p} x={114} y={16} />
          {/* wavy postmark over the stamp's edge */}
          <Circle cx={108} cy={34} r={10} fill="none" stroke={p.ink} strokeWidth={1} opacity={0.55} />
          <Path d="M92 30 q4 -3 8 0 t8 0 t8 0 M92 36 q4 -3 8 0 t8 0 t8 0" stroke={p.ink} strokeWidth={1} fill="none" opacity={0.55} />
        </G>
      </Svg>
    </View>
  );
});

/**
 * A lone stamp for a person's row (size x size * 1.2). Sent: a postmark ring and a tick fade in (timed), else the
 * stamp waits, slightly faded. Static with Reduce Motion.
 */
export const StampMark = memo(function StampMark({ sent, size = 40 }: { sent: boolean; size?: number }) {
  const p = usePaint();
  const { reduceMotion } = useApp();
  const mark = useRef(new Animated.Value(sent ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      mark.setValue(sent ? 1 : 0);
      return;
    }
    if (!sent) {
      mark.setValue(0);
      return;
    }
    const a = fadeIn(mark, false, duration.slow);
    a.start();
    return () => a.stop();
  }, [sent, reduceMotion, mark]);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size * 1.2, opacity: sent ? 1 : 0.75 }}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 40 48">
        <StampFace p={p} x={5} y={6} />
      </Svg>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity: mark }}>
        <Svg width={size} height={size * 1.2} viewBox="0 0 40 48">
          <Circle cx={26} cy={30} r={11} fill="none" stroke={p.ink} strokeWidth={1.6} />
          <Path d="M20 30 L24.5 34.5 L32 25.5" stroke={p.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  );
});
