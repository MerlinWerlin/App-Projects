/**
 * Eaveline's tool icons: one hand-drawn set on a 24-unit grid, 2-unit round strokes, a single accent shape per icon
 * where it carries meaning (the pitch angle, the fall arrow, the water). Original artwork.
 */
import Svg, { Circle, G, Line, Path, Polyline, Rect } from 'react-native-svg';
import type { ToolId } from '../state/model';

export function ToolIcon({ id, size = 28, color, accent }: { id: ToolId; size?: number; color: string; accent: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const a = { ...s, stroke: accent };
  const body = (() => {
    switch (id) {
      case 'pitch': // a rafter over its run, with the angle marked
        return <G><Polyline points="3,19 21,19 21,8" {...s} /><Line x1="3" y1="19" x2="21" y2="8" {...s} /><Path d="M8.5 19 A5.5 5.5 0 0 0 7.9 16.6" {...a} strokeWidth={2.4} /></G>;
      case 'level': // a phone with a bubble vial
        return <G><Rect x="7" y="2.5" width="10" height="19" rx="2.5" {...s} /><Rect x="9" y="10" width="6" height="4" rx="2" {...s} /><Circle cx="12.6" cy="12" r="1.1" fill={accent} stroke="none" /></G>;
      case 'roof': // a house roof with its plan below
        return <G><Polyline points="2.5,12 12,4 21.5,12" {...s} /><Path d="M5 12 V20 H19 V12" {...s} /><Path d="M9 20 V15 H15 V20" {...a} /></G>;
      case 'rafter': // a hip roof in elevation: ridge, with the two hips in the accent and a rafter dropping from the ridge
        return <G><Path d="M2.5 18 H21.5" {...s} /><Path d="M8 8 H16" {...s} /><Path d="M2.5 18 L8 8 M16 8 L21.5 18" {...a} strokeWidth={2.4} /><Path d="M12 8 L12 18" {...s} strokeDasharray="2 2.5" /></G>;
      case 'sheets': // corrugated sheet, end on
        return <G><Path d="M2.5 14 q2.4 -5 4.75 0 t4.75 0 t4.75 0 t4.75 0" {...s} /><Path d="M2.5 19 q2.4 -5 4.75 0 t4.75 0 t4.75 0 t4.75 0" {...a} /><Line x1="12" y1="3" x2="12" y2="8" {...s} /><Polyline points="9.5,5.5 12,3 14.5,5.5" {...s} /></G>;
      case 'tiles': // overlapping tile courses on battens
        return <G><Path d="M3 7 h18 M3 13 h18 M3 19 h18" {...s} /><Path d="M5 7 v4 a2 2 0 0 0 4 0 v-4 M11 7 v4 a2 2 0 0 0 4 0 v-4 M17 7 v4 a2 2 0 0 0 4 0 v-4" {...a} /><Path d="M8 13 v4 a2 2 0 0 0 4 0 v-4 M14 13 v4 a2 2 0 0 0 4 0 v-4" {...s} /></G>;
      case 'shingles': // staggered shingle tabs
        return <G><Path d="M3 6 h18 v5 H3 Z" {...s} /><Path d="M9 6 v5 M15 6 v5" {...s} /><Path d="M3 13 h18 v5 H3 Z" {...a} /><Path d="M6 13 v5 M12 13 v5 M18 13 v5" {...a} /></G>;
      case 'flashings': // a ridge capping over two roof planes
        return <G><Path d="M2.5 18 L12 9 L21.5 18" {...s} /><Path d="M6.5 12.5 L12 7.5 L17.5 12.5" {...a} strokeWidth={2.4} /><Path d="M12 4 v1.5" {...s} /></G>;
      case 'fall': // a gutter with the fall arrow
        return <G><Path d="M3 8 v3 a3 3 0 0 0 3 3 h12 a3 3 0 0 0 3 -3 v-3" {...s} /><Path d="M5 18 L19 21" {...a} /><Polyline points="15.8,18.2 19,21 15.2,21.9" {...a} /></G>;
      case 'downpipes': // a gutter outlet and downpipe with a drop
        return <G><Path d="M2.5 5 h11 v3 a2 2 0 0 1 -2 2 h-7 a2 2 0 0 1 -2 -2 Z" {...s} /><Path d="M10 10 v11 h4 V10" {...s} /><Path d="M19 12 c-1.6 2.2 -2.4 3.4 -2.4 4.4 a2.4 2.4 0 0 0 4.8 0 c0 -1 -0.8 -2.2 -2.4 -4.4 Z" {...a} /></G>;
      case 'fixings': // a roofing screw with its washer
        return <G><Path d="M7 5 h10" {...s} strokeWidth={2.4} /><Path d="M9 3 h6 v2 H9 Z" {...s} /><Path d="M8 8 h8" {...a} strokeWidth={2.4} /><Path d="M12 8 v13 M10 11 l4 1.5 M10 14 l4 1.5 M10 17 l4 1.5" {...s} /></G>;
    }
  })();
  return <Svg width={size} height={size} viewBox="0 0 24 24">{body}</Svg>;
}
