/** Rootpass's own line glyphs for each tool (original artwork, drawn in code). */
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import type { ToolId } from '../plus/entitlement.ts';
import { C } from './theme.ts';

export function Glyph({ tool, size = 44, color = C.accent, sub = C.ink2 }: { tool: ToolId; size?: number; color?: string; sub?: string }) {
  const w = 2.6;
  const common = { stroke: color, strokeWidth: w, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const thin = { stroke: sub, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tool === 'saddle' && (
        <>
          <Rect x={4} y={28} width={40} height={14} rx={7} {...thin} />
          <Path d="M16 6 V24 Q16 31 24 31 Q32 31 32 24 V6" {...common} />
          <Line x1={16} y1={6} x2={32} y2={6} {...common} />
        </>
      )}
      {tool === 'lobster' && (
        <>
          <Path d="M6 42 L6 28 L10 18 L18 10 L28 6 L42 6" {...thin} />
          <Path d="M18 42 L18 31 L20 26 L25 21 L30 19 L42 18" {...common} />
          <Line x1={6} y1={28} x2={18} y2={31} {...common} />
          <Line x1={10} y1={18} x2={20} y2={26} {...common} />
          <Line x1={18} y1={10} x2={25} y2={21} {...common} />
          <Line x1={28} y1={6} x2={30} y2={19} {...common} />
        </>
      )}
      {tool === 'frame' && (
        <>
          <Rect x={6} y={8} width={36} height={32} {...thin} />
          <Rect x={13} y={15} width={22} height={18} {...thin} />
          <Line x1={6} y1={8} x2={13} y2={15} {...common} />
          <Line x1={42} y1={8} x2={35} y2={15} {...common} />
          <Line x1={6} y1={40} x2={13} y2={33} {...common} />
          <Line x1={42} y1={40} x2={35} y2={33} {...common} />
        </>
      )}
      {tool === 'cutlist' && (
        <>
          <Rect x={4} y={18} width={40} height={12} rx={2} {...thin} />
          <Line x1={17} y1={13} x2={17} y2={35} {...common} />
          <Line x1={29} y1={13} x2={29} y2={35} {...common} />
          <Line x1={38} y1={13} x2={38} y2={35} {...common} />
        </>
      )}
      {tool === 'weight' && (
        <>
          <Path d="M10 10 H38 M24 10 V38 M10 38 H38" {...common} />
          <Path d="M10 10 V14 M38 10 V14 M10 38 V34 M38 38 V34" {...thin} />
        </>
      )}
      {tool === 'weld' && (
        <>
          <Polyline points="6,40 42,40" {...thin} />
          <Polyline points="10,6 10,40" {...thin} />
          <Path d="M10 22 Q12 36 26 40" {...common} />
          <Path d="M10 22 L26 40" {...thin} strokeDasharray="2 3" />
        </>
      )}
      {tool === 'bend' && (
        <>
          <Path d="M8 8 V30 Q8 40 18 40 H42" {...common} />
          <Path d="M14 8 V30 Q14 34 18 34 H42" {...thin} />
        </>
      )}
      {tool === 'pcd' && (
        <>
          <Circle cx={24} cy={24} r={15} {...thin} strokeDasharray="3 3" />
          {[0, 60, 120, 180, 240, 300].map(a => (
            <Circle key={a} cx={24 + 15 * Math.sin((a * Math.PI) / 180)} cy={24 - 15 * Math.cos((a * Math.PI) / 180)} r={3.6} {...common} />
          ))}
          <Line x1={21} y1={24} x2={27} y2={24} {...thin} />
          <Line x1={24} y1={21} x2={24} y2={27} {...thin} />
        </>
      )}
    </Svg>
  );
}
