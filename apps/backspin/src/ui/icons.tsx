// Backspin's own icons: one 24-point grid, 2-point round strokes, drawn in the current ink. They replace the emoji
// that used to stand in for icons. Decorative by default (the control next to them carries the label).
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'mic' | 'play' | 'pause' | 'stop' | 'loop' | 'share' | 'save' | 'settings' | 'packs' | 'party' | 'takes'
  | 'check' | 'lock' | 'chevron' | 'down' | 'plus' | 'close' | 'trash' | 'shuffle' | 'next' | 'mail' | 'help'
  | 'rewind' | 'flame' | 'grid';

export function Icon({ name, size = 22, color, stroke = 2 }: { name: IconName; size?: number; color: string; stroke?: number }) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const f = { fill: color };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} pointerEvents="none">
      {name === 'mic' && (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} {...p} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...p} />
        </>
      )}
      {name === 'play' && <Path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" {...f} />}
      {name === 'pause' && (
        <>
          <Rect x={6.5} y={5} width={4} height={14} rx={1} {...f} />
          <Rect x={13.5} y={5} width={4} height={14} rx={1} {...f} />
        </>
      )}
      {name === 'stop' && <Rect x={6} y={6} width={12} height={12} rx={2} {...f} />}
      {name === 'rewind' && <Path d="M16 5.5v13a.8.8 0 0 1-1.2.7L4.4 12.7a.8.8 0 0 1 0-1.4l10.4-6.5A.8.8 0 0 1 16 5.5Z" {...f} />}
      {name === 'loop' && <Path d="M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4" {...p} />}
      {name === 'share' && <Path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" {...p} />}
      {name === 'save' && <Path d="M6 3.8h12a1 1 0 0 1 1 1v15.4a.5.5 0 0 1-.8.4L12 16.5l-6.2 4.1a.5.5 0 0 1-.8-.4V4.8a1 1 0 0 1 1-1Z" {...p} />}
      {name === 'settings' && (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...p} />
          <Circle cx={15} cy={7} r={2} {...p} />
          <Circle cx={9} cy={17} r={2} {...p} />
        </>
      )}
      {name === 'packs' && <Path d="M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM3 7v11M21 7v11" {...p} />}
      {name === 'party' && (
        <>
          <Circle cx={9} cy={8} r={3} {...p} />
          <Path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.3a3 3 0 0 1 0 5.4M17.5 14.3A5.5 5.5 0 0 1 20.5 20" {...p} />
        </>
      )}
      {name === 'takes' && <Path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" {...p} />}
      {name === 'check' && <Path d="M5 12.5 10 17.5 19 7" {...p} />}
      {name === 'lock' && (
        <>
          <Rect x={5} y={10.5} width={14} height={10} rx={2} {...p} />
          <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...p} />
        </>
      )}
      {name === 'chevron' && <Path d="M9.5 5.5 16 12l-6.5 6.5" {...p} />}
      {name === 'down' && <Path d="M5.5 9.5 12 16l6.5-6.5" {...p} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...p} />}
      {name === 'trash' && <Path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" {...p} />}
      {name === 'shuffle' && <Path d="M17 4l3 3-3 3M4 7h3.5c4.5 0 4.5 10 9 10H20M17 14l3 3-3 3M4 17h3.5c1.5 0 2.4-1.1 3.1-2.6M20 7h-3.5c-1.5 0-2.4 1.1-3.1 2.6" {...p} />}
      {name === 'next' && <Path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" {...p} />}
      {name === 'mail' && (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2} {...p} />
          <Path d="m4 7 8 6 8-6" {...p} />
        </>
      )}
      {name === 'help' && (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" {...p} />
          <Circle cx={12} cy={17} r={0.6} {...p} />
        </>
      )}
      {name === 'flame' && <Path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-4.5 4.5-6.5 4.5-11 3 1.8 4.6 4.3 4.9 7 .9-.6 1.5-1.6 1.7-2.7 1.2 1.6 1.9 3.6 1.9 5.7 0 4.1-2.6 7-6.5 7Z" {...p} />}
      {name === 'grid' && (
        <>
          <Rect x={4} y={4} width={7} height={7} rx={1.5} {...p} />
          <Rect x={13} y={4} width={7} height={7} rx={1.5} {...p} />
          <Rect x={4} y={13} width={7} height={7} rx={1.5} {...p} />
          <Rect x={13} y={13} width={7} height={7} rx={1.5} {...p} />
        </>
      )}
    </Svg>
  );
}
