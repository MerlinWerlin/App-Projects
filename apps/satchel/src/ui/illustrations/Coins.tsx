// T92 spot illustration: a folded banknote behind a small stack of plain coins, for spending and money states.
// No currency symbol, so it fits every country. Decorative.
import { memo } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useApp } from '../../state/app.tsx';
import { SpotFrame } from './frame.tsx';

export const Coins = memo(function Coins({ size }: { size?: number }) {
  const { theme } = useApp();
  const stack = [0, 1, 2, 3];
  return (
    <SpotFrame size={size}>
      <Circle cx={60} cy={46} r={40} fill={theme.okSoft} />
      <Ellipse cx={60} cy={86} rx={34} ry={4} fill={theme.line} />
      <G transform="rotate(-12 50 46)">
        <Rect x={16} y={26} width={64} height={38} rx={6} fill={theme.card} stroke={theme.ok} strokeWidth={2.5} />
        <Rect x={22} y={32} width={52} height={26} rx={4} fill="none" stroke={theme.line} strokeWidth={1.5} />
        <Circle cx={48} cy={45} r={8} fill={theme.okSoft} stroke={theme.ok} strokeWidth={2} />
        <Circle cx={30} cy={45} r={2.5} fill={theme.ok} />
        <Circle cx={66} cy={45} r={2.5} fill={theme.ok} />
      </G>
      {stack.map((i) => (
        <G key={i}>
          <Ellipse cx={82} cy={78 - i * 8} rx={16} ry={5} fill={theme.accentStrong} />
          <Rect x={66} y={72 - i * 8} width={32} height={6} fill={theme.accentStrong} />
          <Ellipse cx={82} cy={72 - i * 8} rx={16} ry={5} fill={theme.accent} stroke={theme.card} strokeWidth={1.5} />
        </G>
      ))}
      <Ellipse cx={82} cy={48} rx={9} ry={2.5} fill="none" stroke={theme.accentStrong} strokeWidth={1.5} />
      <Path d="M104 12 L106 17 L111 19 L106 21 L104 26 L102 21 L97 19 L102 17 Z" fill={theme.accent} />
    </SpotFrame>
  );
});
