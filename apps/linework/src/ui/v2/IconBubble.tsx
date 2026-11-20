// Leading row icon (DESIGN.md §5): a bare graphite glyph in a fixed 30 pt slot, no tinted tile (icons in tinted
// shapes are banned). `fill` is accepted for compatibility and ignored. Decorative: the row carries the name.
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeV2 } from '../../theme/useTheme';
import { sizeV2 } from '../../theme/tokensV2';
import type { FeatherName } from './shared';

export type IconBubbleProps = {
  icon: FeatherName;
  /** Ignored (no tile behind the icon). */
  fill?: string;
  /** Icon colour; default graphite. */
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconBubble({ icon, color, size = sizeV2.iconBubble, style }: IconBubbleProps) {
  const { c } = useThemeV2();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Feather name={icon} size={Math.round(size * 0.7)} color={color ?? c.graphite} />
    </View>
  );
}
