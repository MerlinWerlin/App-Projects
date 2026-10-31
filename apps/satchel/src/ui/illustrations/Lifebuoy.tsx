// T92 spot illustration: a ring buoy on a coiled rope, for help and 'when things go wrong' states. Decorative.
import { memo } from 'react';
import { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const Lifebuoy = memo(function Lifebuoy({ size }: { size?: number }) {
  const { theme } = useApp();
  const bands = [45, 135, 225, 315];
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={48} r={42} fill={theme.dangerSoft} />
      <Ellipse cx={60} cy={88} rx={30} ry={3.5} fill={theme.line} />
      <Path d="M22 74 Q14 60 24 50" fill="none" stroke={theme.ink} strokeWidth={2} strokeLinecap="round" strokeDasharray={[4, 3]} />
      {/* Ring: white body, four coloured bands, a hole showing the disc behind. */}
      <Circle cx={60} cy={48} r={30} fill={theme.card} stroke={theme.line} strokeWidth={2} />
      {bands.map((deg) => (
        <G key={deg} transform={`rotate(${deg} 60 48)`}>
          <Path d="M52 18.5 A30 30 0 0 1 68 18.5 L65 34.5 A14 14 0 0 0 55 34.5 Z" fill={theme.danger} />
        </G>
      ))}
      <Circle cx={60} cy={48} r={14} fill={theme.dangerSoft} stroke={theme.line} strokeWidth={2} />
      <Path d="M36 30 Q60 4 84 30" fill="none" stroke={theme.ink} strokeWidth={2} strokeLinecap="round" strokeDasharray={[4, 3]} />
      <Path d="M100 12 L102 17 L107 19 L102 21 L100 26 L98 21 L93 19 L98 17 Z" fill={theme.accent} />
      <Circle cx={100} cy={76} r={3} fill={theme.sea} />
    </SpotFrame>
  );
});
