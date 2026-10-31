// T92 spot illustration: a blank page with a folded corner under a magnifying glass, for 'not found' states. Decorative.
import { memo } from 'react';
import { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const Magnifier = memo(function Magnifier({ size }: { size?: number }) {
  const { theme } = useApp();
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={48} r={40} fill={theme.accentSoft} />
      <Ellipse cx={58} cy={88} rx={28} ry={3.5} fill={theme.line} />
      {/* The page, with its corner folded over. */}
      <Path d="M28 16 H66 L82 32 V84 H28 Z" fill={theme.card} stroke={theme.line} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M66 16 V32 H82" fill={theme.line} stroke={theme.line} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={36} y={40} width={30} height={4} rx={2} fill={theme.line} />
      <Rect x={36} y={50} width={22} height={4} rx={2} fill={theme.line} />
      <Line x1={36} y1={62} x2={60} y2={62} stroke={theme.line} strokeWidth={4} strokeLinecap="round" strokeDasharray={[2, 6]} />
      {/* The glass, looking at nothing in particular. */}
      <Line x1={84} y1={70} x2={98} y2={84} stroke={theme.ink} strokeWidth={7} strokeLinecap="round" />
      <Circle cx={74} cy={60} r={15} fill={theme.seaSoft} stroke={theme.sea} strokeWidth={5} />
      <Path d="M66 54 Q69 49 74 48" fill="none" stroke={theme.card} strokeWidth={3} strokeLinecap="round" />
      <Path d="M100 14 L102 19 L107 21 L102 23 L100 28 L98 23 L93 21 L98 19 Z" fill={theme.accent} />
      <Circle cx={16} cy={30} r={3} fill={theme.teal} />
    </SpotFrame>
  );
});
