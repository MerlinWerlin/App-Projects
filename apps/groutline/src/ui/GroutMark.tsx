// Brand mark: four tiles and the orange grout line between them.
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../theme/theme.ts';

export function GroutMark({ size = 48 }: { size?: number }) {
  const t = useTheme();
  const g = size * 0.12;
  const s = (size - g) / 2;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} rx={size * 0.2} fill={t.accent} />
      {[[0, 0], [s + g, 0], [0, s + g], [s + g, s + g]].map(([x, y], i) => (
        <Rect key={i} x={x + (x ? 0 : g * 0.6)} y={y + (y ? 0 : g * 0.6)} width={s - g * 0.6} height={s - g * 0.6} rx={size * 0.06} fill={t.ink} />
      ))}
    </Svg>
    </View>
  );
}
