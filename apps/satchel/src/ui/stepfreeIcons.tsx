// T156: original step-free pictograms, drawn with react-native-svg on a 48x48 grid from theme tokens only (ink
// outline, a soft fill and one highlight), so they follow light and dark mode. Simple geometric shapes in the same
// hand as the sign icons (signIcons.tsx); not copies of any official access symbol artwork, no brands or logos. The
// control or row around each one carries the words, so the drawing is hidden from screen readers.
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { AccessNeed } from '../core/stepfree.ts';
import { useApp } from '../state/app.tsx';

export type AccessIconId = AccessNeed | 'lift' | 'toilet';
const W = 2.5;

export const AccessIcon = memo(function AccessIcon({ id, size = 28, tone = 'sea' }: { id: AccessIconId; size?: number; tone?: 'sea' | 'ok' | 'muted' }) {
  const { theme } = useApp();
  const ink = theme.ink;
  const pop = tone === 'ok' ? theme.ok : tone === 'muted' ? theme.muted : theme.sea;
  const soft = tone === 'ok' ? theme.okSoft : theme.seaSoft;
  const st = (c: string, w = W) => ({ stroke: c, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });
  let body;
  switch (id) {
    case 'wheelchair':
      // A seated figure on a wheel: head, back, seat and leg, one big wheel and a small castor.
      body = (
        <>
          <Circle cx={24} cy={30} r={11} {...st(ink)} fill={soft} />
          <Circle cx={18} cy={9} r={3.5} fill={pop} />
          <Path d="M18 15 V27 H30 L34 38" {...st(pop, 3)} />
          <Line x1={18} y1={20} x2={27} y2={20} {...st(pop, 3)} />
          <Circle cx={38} cy={40} r={2} fill={ink} />
        </>
      );
      break;
    case 'stepFree':
      // Steps on the left crossed by a smooth ramp running down to ground level.
      body = (
        <>
          <Path d="M6 40 H42" {...st(ink)} />
          <Path d="M8 40 V30 H16 V22 H24 V14" {...st(theme.muted)} />
          <Path d="M8 40 L40 16 V40 Z" {...st(pop)} fill={soft} />
        </>
      );
      break;
    case 'pram':
      // A pram: hooded basket, handle and two wheels.
      body = (
        <>
          <Path d="M10 20 H36 A13 11 0 0 1 10 22 Z" {...st(ink)} fill={soft} />
          <Path d="M23 20 V8 A13 12 0 0 1 36 20" {...st(pop)} />
          <Path d="M36 20 L42 12" {...st(ink)} />
          <Circle cx={15} cy={39} r={4} {...st(ink)} />
          <Circle cx={32} cy={39} r={4} {...st(ink)} />
        </>
      );
      break;
    case 'walkLimited':
      // A walking figure with a stick, and a short dotted path ahead.
      body = (
        <>
          <Circle cx={20} cy={8} r={3.5} fill={pop} />
          <Path d="M20 13 L18 26 L13 38 M18 26 L24 38 M19 17 L27 22" {...st(ink, 3)} />
          <Line x1={30} y1={20} x2={32} y2={40} {...st(pop, 3)} />
          <Path d="M36 40 H38 M41 40 H43" {...st(theme.muted)} />
        </>
      );
      break;
    case 'lift':
      // A lift door with up and down arrows above it.
      body = (
        <>
          <Rect x={10} y={16} width={28} height={26} rx={3} {...st(ink)} fill={soft} />
          <Line x1={24} y1={16} x2={24} y2={42} {...st(ink)} />
          <Path d="M14 10 L18 5 L22 10 M26 5 L30 10 L34 5" {...st(pop)} />
        </>
      );
      break;
    default:
      // A toilet door with a wheel mark: the "accessible toilet" chip.
      body = (
        <>
          <Rect x={10} y={6} width={28} height={36} rx={3} {...st(ink)} fill={soft} />
          <Circle cx={24} cy={28} r={7} {...st(pop)} />
          <Circle cx={22} cy={15} r={2.5} fill={pop} />
        </>
      );
  }
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {body}
      </Svg>
    </View>
  );
});
