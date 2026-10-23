// Original vector artwork for the theme home's category bubbles (T57). Simple, friendly shapes
// drawn here with react-native-svg on a 64 x 64 grid: no logos, no copied art. Decorative only:
// the bubble's own accessibility label names the category.
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { BrowseKey } from '../core/categoryPaging';

type Props = {
  page: BrowseKey;
  size: number;
  /** Main line/fill colour (the pastel's ink). */
  ink: string;
  /** Highlight colour (the berry tint). */
  accent: string;
  /** Light detail colour (surface white). */
  light: string;
};

export function CategoryBubbleArt({ page, size, ink, accent, light }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Shape page={page} ink={ink} accent={accent} light={light} />
    </Svg>
  );
}

function Shape({ page, ink, accent, light }: Omit<Props, 'size'>) {
  switch (page) {
    case 'all': {
      // Four little app tiles, one of them tinted.
      return (
        <G>
          <Rect x={10} y={10} width={19} height={19} rx={6} fill={ink} />
          <Rect x={35} y={10} width={19} height={19} rx={6} fill={accent} />
          <Rect x={10} y={35} width={19} height={19} rx={6} fill={light} stroke={ink} strokeWidth={2.5} />
          <Rect x={35} y={35} width={19} height={19} rx={6} fill={ink} opacity={0.55} />
        </G>
      );
    }
    case 'minimal': {
      // One calm circle resting on a line.
      return (
        <G>
          <Circle cx={32} cy={28} r={13} fill={light} stroke={ink} strokeWidth={3} />
          <Path d="M12 48 H52" stroke={ink} strokeWidth={3} strokeLinecap="round" />
        </G>
      );
    }
    case 'dark': {
      // Crescent moon with two stars.
      return (
        <G>
          <Path d="M38 12 A20 20 0 1 0 52 42 A16 16 0 1 1 38 12 Z" fill={ink} />
          <Path d="M48 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill={accent} />
          <Circle cx={54} cy={32} r={2} fill={accent} />
        </G>
      );
    }
    case 'pastel': {
      // Soft rainbow arcs over a cloud.
      return (
        <G fill="none" strokeLinecap="round">
          <Path d="M12 40 A20 20 0 0 1 52 40" stroke={accent} strokeWidth={5} />
          <Path d="M19 40 A13 13 0 0 1 45 40" stroke={ink} strokeWidth={5} opacity={0.6} />
          <Path
            d="M16 50 a7 7 0 0 1 4 -12 a9 9 0 0 1 17 -2 a7 7 0 0 1 11 7 a6 6 0 0 1 -2 7 Z"
            fill={light}
            stroke={ink}
            strokeWidth={2.5}
          />
        </G>
      );
    }
    case 'nature': {
      // A sprout with two leaves.
      return (
        <G>
          <Path d="M32 54 V30" stroke={ink} strokeWidth={3} strokeLinecap="round" />
          <Path d="M32 34 C20 34 13 26 13 14 C25 14 32 22 32 34 Z" fill={ink} />
          <Path d="M32 30 C42 30 50 23 51 12 C40 12 32 19 32 30 Z" fill={accent} opacity={0.85} />
          <Ellipse cx={32} cy={55} rx={13} ry={3} fill={ink} opacity={0.25} />
        </G>
      );
    }
    case 'neon': {
      // Glowing lightning zig-zag with a halo ring.
      return (
        <G>
          <Circle cx={32} cy={32} r={22} fill="none" stroke={accent} strokeWidth={2} opacity={0.5} />
          <Path d="M35 10 L20 36 H31 L27 54 L44 27 H33 Z" fill={ink} stroke={light} strokeWidth={2} strokeLinejoin="round" />
        </G>
      );
    }
    case 'retro': {
      // Striped sunset sun over a horizon.
      return (
        <G>
          <Path d="M12 40 A20 20 0 0 1 52 40 Z" fill={accent} />
          <Rect x={12} y={30} width={40} height={3} fill={light} />
          <Rect x={12} y={35} width={40} height={2.5} fill={light} />
          <Path d="M8 44 H56" stroke={ink} strokeWidth={3} strokeLinecap="round" />
          <Path d="M16 51 H48" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        </G>
      );
    }
    case 'anime': {
      // A big four-point sparkle with small twinkles.
      return (
        <G>
          <Path d="M30 8 C32 22 36 26 50 28 C36 30 32 34 30 50 C28 34 24 30 10 28 C24 26 28 22 30 8 Z" fill={ink} />
          <Path d="M48 40 c1 5 2 6 7 7 c-5 1 -6 2 -7 7 c-1 -5 -2 -6 -7 -7 c5 -1 6 -2 7 -7 Z" fill={accent} />
          <Circle cx={14} cy={48} r={3} fill={accent} opacity={0.8} />
        </G>
      );
    }
    case 'cute': {
      // A smiling heart with rosy cheeks.
      return (
        <G>
          <Path d="M32 54 C14 42 8 32 8 23 C8 15 14 10 21 10 C26 10 30 13 32 17 C34 13 38 10 43 10 C50 10 56 15 56 23 C56 32 50 42 32 54 Z" fill={accent} />
          <Circle cx={24} cy={26} r={2.6} fill={ink} />
          <Circle cx={40} cy={26} r={2.6} fill={ink} />
          <Path d="M27 32 Q32 37 37 32" stroke={ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Ellipse cx={19} cy={32} rx={3.5} ry={2.2} fill={light} opacity={0.7} />
          <Ellipse cx={45} cy={32} rx={3.5} ry={2.2} fill={light} opacity={0.7} />
        </G>
      );
    }
    case 'luxury': {
      // A cut gem with a glint.
      return (
        <G strokeLinejoin="round">
          <Path d="M18 14 H46 L56 26 L32 54 L8 26 Z" fill={light} stroke={ink} strokeWidth={3} />
          <Path d="M8 26 H56 M24 14 L20 26 L32 54 L44 26 L40 14" fill="none" stroke={ink} strokeWidth={2} />
          <Path d="M52 6 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" fill={accent} />
        </G>
      );
    }
    case 'seasonal': {
      // A falling leaf and a snowflake: seasons turning.
      return (
        <G>
          <Path d="M14 46 C14 30 24 18 40 16 C40 32 30 44 14 46 Z" fill={accent} />
          <Path d="M14 46 L34 24" stroke={light} strokeWidth={2} strokeLinecap="round" />
          <G stroke={ink} strokeWidth={2.5} strokeLinecap="round">
            <Path d="M46 34 V54 M37 44 H55 M40 38 L52 50 M52 38 L40 50" />
          </G>
        </G>
      );
    }
    default:
      return <Circle cx={32} cy={32} r={16} fill={ink} />;
  }
}
