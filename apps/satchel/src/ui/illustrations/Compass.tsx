// T91 spot illustration: a compass rose with a two-tone needle. Decorative.
import { memo } from 'react';
import { Circle, G, Line, Path } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const Compass = memo(function Compass({ size }: { size?: number }) {
  const { theme } = useApp();
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={48} r={44} fill={theme.accentSoft} />
      <Circle cx={60} cy={48} r={32} fill={theme.card} stroke={theme.sea} strokeWidth={4} />
      {ticks.map((deg) => (
        <G key={deg} transform={`rotate(${deg} 60 48)`}>
          <Line x1={60} y1={19} x2={60} y2={deg % 90 === 0 ? 26 : 23} stroke={deg % 90 === 0 ? theme.ink : theme.line} strokeWidth={deg % 90 === 0 ? 2.5 : 2} strokeLinecap="round" />
        </G>
      ))}
      <G transform="rotate(35 60 48)">
        <Path d="M60 26 L67 48 H53 Z" fill={theme.accent} />
        <Path d="M60 70 L53 48 H67 Z" fill={theme.sea} />
      </G>
      <Circle cx={60} cy={48} r={4} fill={theme.ink} />
      <Circle cx={60} cy={48} r={1.6} fill={theme.card} />
      {/* A few sparkles: the way out is that way. */}
      <Path d="M100 14 L102 19 L107 21 L102 23 L100 28 L98 23 L93 21 L98 19 Z" fill={theme.accent} />
      <Circle cx={16} cy={78} r={3} fill={theme.teal} />
    </SpotFrame>
  );
});
