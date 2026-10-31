// T92 spot illustration: an open travel notebook with a ribbon and a pencil, for journal and ideas lists. Decorative.
import { memo } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const Notebook = memo(function Notebook({ size }: { size?: number }) {
  const { theme } = useApp();
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={46} r={40} fill={theme.tealSoft} />
      <Ellipse cx={60} cy={86} rx={40} ry={4} fill={theme.line} />
      {/* Two facing pages over a cover. */}
      <Path d="M14 26 Q36 20 60 28 Q84 20 106 26 V80 Q84 74 60 82 Q36 74 14 80 Z" fill={theme.sea} />
      <Path d="M18 24 Q38 18 58 26 V78 Q38 70 18 76 Z" fill={theme.card} stroke={theme.line} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M102 24 Q82 18 62 26 V78 Q82 70 102 76 Z" fill={theme.card} stroke={theme.line} strokeWidth={1.5} strokeLinejoin="round" />
      <Rect x={24} y={36} width={26} height={3.5} rx={1.75} fill={theme.line} />
      <Rect x={24} y={46} width={22} height={3.5} rx={1.75} fill={theme.line} />
      <Rect x={24} y={56} width={26} height={3.5} rx={1.75} fill={theme.line} />
      {/* A little sun sketched on the right page. */}
      <Circle cx={82} cy={44} r={7} fill={theme.accentSoft} stroke={theme.accent} strokeWidth={2.5} />
      <Path d="M70 62 Q76 56 82 62 T94 62" fill="none" stroke={theme.teal} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M56 26 V90 L60 86 L64 90 V26" fill={theme.accent} />
      <G transform="rotate(-38 96 20)">
        <Rect x={78} y={16} width={30} height={7} rx={2} fill={theme.accent} />
        <Rect x={78} y={16} width={6} height={7} rx={2} fill={theme.ink} />
        <Path d="M108 16 L116 19.5 L108 23 Z" fill={theme.card} stroke={theme.ink} strokeWidth={1.5} strokeLinejoin="round" />
      </G>
    </SpotFrame>
  );
});
