// T92 spot illustration: a round travel clock with a crescent moon and a sun, for time-zone and 'not yet' states.
// Decorative.
import { memo } from 'react';
import { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const Clock = memo(function Clock({ size }: { size?: number }) {
  const { theme } = useApp();
  const hours = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={48} r={40} fill={theme.seaSoft} />
      {/* Bells and feet of a little travel alarm clock. */}
      <Rect x={41} y={10} width={14} height={8} rx={4} fill={theme.sea} transform="rotate(-24 48 14)" />
      <Rect x={65} y={10} width={14} height={8} rx={4} fill={theme.sea} transform="rotate(24 72 14)" />
      <Path d="M42 80 L36 88 M78 80 L84 88" stroke={theme.ink} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={60} cy={50} r={32} fill={theme.card} stroke={theme.sea} strokeWidth={5} />
      {hours.map((deg) => (
        <G key={deg} transform={`rotate(${deg} 60 50)`}>
          <Line x1={60} y1={23} x2={60} y2={deg % 90 === 0 ? 29 : 26} stroke={deg % 90 === 0 ? theme.ink : theme.line} strokeWidth={2.5} strokeLinecap="round" />
        </G>
      ))}
      <Line x1={60} y1={50} x2={60} y2={33} stroke={theme.ink} strokeWidth={3.5} strokeLinecap="round" />
      <Line x1={60} y1={50} x2={72} y2={58} stroke={theme.accent} strokeWidth={3.5} strokeLinecap="round" />
      <Circle cx={60} cy={50} r={3.5} fill={theme.ink} />
      {/* Night on one side, day on the other. */}
      <Path d="M18 22 A9 9 0 1 0 28 34 A7 7 0 1 1 18 22 Z" fill={theme.teal} />
      <Circle cx={102} cy={26} r={6} fill={theme.accent} />
      <Path d="M102 14 V16 M102 36 V38 M90 26 H92 M112 26 H114" stroke={theme.accent} strokeWidth={2} strokeLinecap="round" />
    </SpotFrame>
  );
});
