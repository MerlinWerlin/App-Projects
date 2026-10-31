// T91 spot illustration: a tilted travel ticket with a tear-off stub and a barcode. Decorative.
import { memo } from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const Ticket = memo(function Ticket({ size }: { size?: number }) {
  const { theme } = useApp();
  const bars = [3, 1.5, 2.5, 1.5, 3, 1.5, 2, 3];
  let x = 82;
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={48} r={40} fill={theme.seaSoft} />
      <G transform="rotate(-10 60 48)">
        <Rect x={14} y={24} width={92} height={48} rx={8} fill={theme.card} stroke={theme.line} strokeWidth={2} />
        <Rect x={14} y={24} width={92} height={12} rx={6} fill={theme.sea} />
        <Rect x={14} y={30} width={92} height={6} fill={theme.sea} />
        <Path d="M76 24 V72" stroke={theme.line} strokeWidth={2} strokeDasharray={[3, 4]} />
        <Rect x={22} y={44} width={34} height={5} rx={2.5} fill={theme.accent} />
        <Rect x={22} y={54} width={24} height={4} rx={2} fill={theme.line} />
        <Rect x={22} y={62} width={30} height={4} rx={2} fill={theme.line} />
        {bars.map((w, i) => {
          const r = <Rect key={i} x={x} y={44} width={w} height={20} fill={theme.ink} />;
          x += w + 1.6;
          return r;
        })}
      </G>
      {/* A little plane heading off the top corner. */}
      <G transform="translate(98 14) rotate(-30)">
        <Path d="M-8 -1.5 H6 Q10 0 6 1.5 H-8 Z" fill={theme.accent} />
        <Path d="M0 -1.5 L-4 -8 H-1.5 L4 -1.5 Z" fill={theme.accent} />
        <Path d="M0 1.5 L-4 8 H-1.5 L4 1.5 Z" fill={theme.accent} />
      </G>
    </SpotFrame>
  );
});
