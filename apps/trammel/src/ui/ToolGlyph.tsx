// One drawn pictogram per tool, in a single family: 24-unit grid, 2-unit round strokes, ink on the blade-yellow
// tile. Each one shows the thing the tool works out (a stair profile, a hip roof plan, a cut bar), so tiles read
// at a glance on site instead of being generic symbols.
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import type { ToolId } from '../core/tools.ts';

export function ToolGlyph({ id, size = 26, color }: { id: ToolId; size?: number; color: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const fill = { fill: color, stroke: 'none' };
  let body: React.ReactNode = null;
  switch (id) {
    case 'stairs':
      body = (
        <>
          <Polyline points="3,21 3,17 8,17 8,13 13,13 13,9 18,9 18,5 21,5" {...s} />
          <Line x1="3" y1="21" x2="21" y2="21" {...s} strokeWidth={1.5} />
        </>
      );
      break;
    case 'layout':
      body = (
        <>
          <Line x1="2" y1="4" x2="22" y2="4" {...s} strokeWidth={2.5} />
          <Line x1="2" y1="20" x2="22" y2="20" {...s} strokeWidth={2.5} />
          {[4, 9.3, 14.7, 20].map((x) => (
            <Line key={x} x1={x} y1="5.5" x2={x} y2="18.5" {...s} />
          ))}
          <Line x1="9.3" y1="12" x2="14.7" y2="12" {...s} strokeWidth={1.5} />
        </>
      );
      break;
    case 'decking':
      body = (
        <>
          {[3, 8, 13, 18].map((y) => (
            <Rect key={y} x="2.5" y={y} width="19" height="3.2" rx="1" {...s} strokeWidth={1.6} />
          ))}
        </>
      );
      break;
    case 'cutlist':
      body = (
        <>
          <Rect x="2" y="9" width="20" height="6" rx="1" {...s} />
          <Line x1="10" y1="9" x2="10" y2="15" {...s} />
          <Line x1="16" y1="9" x2="16" y2="15" {...s} />
          <Path d="M12 3 L14 6 L16 3 L18 6 L20 3" {...s} strokeWidth={1.6} />
          <Line x1="2" y1="19" x2="16" y2="19" {...s} strokeWidth={1.5} strokeDasharray="2 2" />
        </>
      );
      break;
    case 'rafter':
      body = (
        <>
          <Path d="M2 19 L12 5 L22 19" {...s} />
          <Line x1="12" y1="5" x2="12" y2="19" {...s} strokeWidth={1.5} strokeDasharray="2 2" />
          <Line x1="4" y1="19" x2="20" y2="19" {...s} strokeWidth={1.5} />
          <Rect x="5" y="19" width="3" height="3" {...fill} />
          <Rect x="16" y="19" width="3" height="3" {...fill} />
        </>
      );
      break;
    case 'hip':
      body = (
        <>
          <Rect x="2" y="5" width="20" height="14" rx="1" {...s} />
          <Line x1="9" y1="12" x2="15" y2="12" {...s} />
          <Line x1="2" y1="5" x2="9" y2="12" {...s} />
          <Line x1="2" y1="19" x2="9" y2="12" {...s} />
          <Line x1="22" y1="5" x2="15" y2="12" {...s} />
          <Line x1="22" y1="19" x2="15" y2="12" {...s} />
        </>
      );
      break;
    case 'pitch':
      body = (
        <>
          <Path d="M3 20 L21 20 L21 7 Z" {...s} />
          <Path d="M9 20 A6 6 0 0 0 8.4 17.6" {...s} strokeWidth={1.6} />
          <Rect x="18.2" y="17.2" width="2.8" height="2.8" {...s} strokeWidth={1.2} />
        </>
      );
      break;
    case 'mitre':
      body = (
        <>
          <Path d="M3 21 L3 3 L8 3 L8 16 L21 16 L21 21 Z" {...s} />
          <Line x1="3" y1="21" x2="8" y2="16" {...s} />
        </>
      );
      break;
    case 'crown':
      body = (
        <>
          <Line x1="3" y1="3" x2="21" y2="3" {...s} strokeWidth={1.5} />
          <Line x1="21" y1="3" x2="21" y2="21" {...s} strokeWidth={1.5} />
          <Path d="M8 3 C8 9 13 15 21 16" {...s} strokeWidth={2.4} />
          <Path d="M5 3 L5 6 C9 7 14 13 18 21 L21 21" {...s} strokeWidth={1.2} />
        </>
      );
      break;
    case 'square':
      body = (
        <>
          <Rect x="3" y="3" width="18" height="18" rx="1" {...s} />
          <Line x1="3" y1="21" x2="21" y2="3" {...s} strokeWidth={1.5} strokeDasharray="2.5 2" />
          <Path d="M3 16 L8 16 L8 21" {...s} strokeWidth={1.5} />
        </>
      );
      break;
    case 'arc':
      body = (
        <>
          <Path d="M3 18 A11 11 0 0 1 21 18" {...s} strokeWidth={2.4} />
          <Circle cx="12" cy="21" r="1.6" {...fill} />
          <Line x1="12" y1="21" x2="18.5" y2="9.5" {...s} strokeWidth={1.5} />
          <Line x1="3" y1="18" x2="21" y2="18" {...s} strokeWidth={1.2} strokeDasharray="2 2" />
        </>
      );
      break;
    case 'convert':
      body = (
        <>
          <Rect x="2" y="7" width="20" height="10" rx="1.5" {...s} />
          {[5, 8, 11, 14, 17, 20].map((x, i) => (
            <Line key={x} x1={x} y1="7" x2={x} y2={i % 2 === 0 ? 13 : 10.5} {...s} strokeWidth={1.4} />
          ))}
        </>
      );
      break;
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {body}
      </Svg>
    </View>
  );
}
