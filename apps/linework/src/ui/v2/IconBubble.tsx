// 30 pt rounded-square icon tile used at the start of InsetRows (docs/DESIGN_V2.md §6). Decorative: the row
// carries the accessible name.
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeV2 } from '../../theme/useTheme';
import { radiusV2, sizeV2 } from '../../theme/tokensV2';
import { squircle, type FeatherName } from './shared';

export type IconBubbleProps = {
  icon: FeatherName;
  /** Tile fill; default the accent tint (inkSoft). */
  fill?: string;
  /** Icon colour; default ink. */
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconBubble({ icon, fill, color, size = sizeV2.iconBubble, style }: IconBubbleProps) {
  const { c } = useThemeV2();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        squircle,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * (radiusV2.xs / sizeV2.iconBubble)),
          backgroundColor: fill ?? c.inkSoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Feather name={icon} size={Math.round(size * 0.58)} color={color ?? c.ink} />
    </View>
  );
}
