// Sparkle accents are retired (DESIGN.md §7: no decorative sparkles). The component stays so existing call sites
// compile, and renders nothing. `sparklePath` is kept for the pure geometry it exports.
import type { StyleProp, ViewStyle } from 'react-native';

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
  color?: string;
  variant?: 'single' | 'cluster';
  style?: StyleProp<ViewStyle>;
};

export function Sparkle(_props: SparkleProps) {
  return null;
}
