// T91 spot illustration: a folded paper map with a dashed route and a pin. Decorative.
import { memo } from 'react';
import { Circle, Ellipse, Path } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const MapPin = memo(function MapPin({ size }: { size?: number }) {
  const { theme } = useApp();
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={48} r={40} fill={theme.tealSoft} />
      <Path d="M18 34 L42 26 L72 34 L102 26 V78 L72 86 L42 78 L18 86 Z" fill={theme.card} stroke={theme.line} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M42 26 V78 M72 34 V86" stroke={theme.line} strokeWidth={2} />
      <Path d="M24 74 C 36 66, 44 76, 56 64 S 74 52, 84 46" fill="none" stroke={theme.sea} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[3, 5]} />
      <Circle cx={24} cy={74} r={3.5} fill={theme.sea} />
      <Ellipse cx={86} cy={52} rx={7} ry={2.5} fill={theme.line} />
      <Path d="M86 14 C77 14 70 21 70 30 C70 41 86 52 86 52 C86 52 102 41 102 30 C102 21 95 14 86 14 Z" fill={theme.accent} />
      <Circle cx={86} cy={30} r={6} fill={theme.card} />
    </SpotFrame>
  );
});
