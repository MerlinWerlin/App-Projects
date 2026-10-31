// T91 spot illustration: a travel case with a luggage tag, on a soft sea disc. Decorative.
import { memo } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const Suitcase = memo(function Suitcase({ size }: { size?: number }) {
  const { theme } = useApp();
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={46} r={40} fill={theme.seaSoft} />
      <Ellipse cx={60} cy={86} rx={30} ry={4} fill={theme.line} />
      <Path d="M48 30 V22 Q48 16 54 16 H66 Q72 16 72 22 V30" fill="none" stroke={theme.ink} strokeWidth={4} strokeLinecap="round" />
      <Rect x={30} y={30} width={60} height={50} rx={10} fill={theme.accent} />
      <Rect x={30} y={30} width={60} height={12} rx={6} fill={theme.accentStrong} />
      <Rect x={42} y={30} width={6} height={50} fill={theme.accentStrong} />
      <Rect x={72} y={30} width={6} height={50} fill={theme.accentStrong} />
      <Circle cx={40} cy={82} r={3.5} fill={theme.ink} />
      <Circle cx={80} cy={82} r={3.5} fill={theme.ink} />
      {/* Luggage tag on a string, swinging off the handle. */}
      <Path d="M70 20 Q86 22 90 34" fill="none" stroke={theme.ink} strokeWidth={1.5} />
      <G transform="rotate(18 94 44)">
        <Rect x={86} y={34} width={16} height={22} rx={3} fill={theme.card} stroke={theme.teal} strokeWidth={2} />
        <Circle cx={94} cy={39} r={1.8} fill={theme.teal} />
        <Rect x={89} y={45} width={10} height={2.5} rx={1.25} fill={theme.teal} />
        <Rect x={89} y={50} width={7} height={2.5} rx={1.25} fill={theme.line} />
      </G>
    </SpotFrame>
  );
});
