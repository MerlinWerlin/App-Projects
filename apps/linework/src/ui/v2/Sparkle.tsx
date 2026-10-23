// Tiny static sparkle accents for empty states and celebrations (docs/DESIGN_V2.md §6). Original art: a four-point
// star with soft concave sides, optionally with two smaller companions. Decorative (hidden from screen readers);
// static, so nothing to pause or reduce.
import Svg, { Path } from 'react-native-svg';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeV2 } from '../../theme/useTheme';

/** Four-point star centred on (cx, cy) with radius r (path in a 0–24 box at r = 10). */
export function sparklePath(cx: number, cy: number, r: number): string {
  const k = r * 0.22; // waist of the concave sides
  return [
    `M${cx} ${cy - r}`,
    `Q${cx + k} ${cy - k} ${cx + r} ${cy}`,
    `Q${cx + k} ${cy + k} ${cx} ${cy + r}`,
    `Q${cx - k} ${cy + k} ${cx - r} ${cy}`,
    `Q${cx - k} ${cy - k} ${cx} ${cy - r}`,
    'Z',
  ].join(' ');
}

export type SparkleProps = {
  size?: number;
  /** Fill colour; default sunny. */
  color?: string;
  /** 'single' star or a 'cluster' of three. */
  variant?: 'single' | 'cluster';
  style?: StyleProp<ViewStyle>;
};

export function Sparkle({ size = 24, color, variant = 'single', style }: SparkleProps) {
  const { c } = useThemeV2();
  const fill = color ?? c.sunny;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {variant === 'cluster' ? (
          <>
            <Path d={sparklePath(10, 13, 8)} fill={fill} />
            <Path d={sparklePath(19.5, 5, 3.5)} fill={fill} opacity={0.8} />
            <Path d={sparklePath(20, 19, 2.5)} fill={fill} opacity={0.6} />
          </>
        ) : (
          <Path d={sparklePath(12, 12, 10)} fill={fill} />
        )}
      </Svg>
    </View>
  );
}
