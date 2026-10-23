// Pill button (docs/DESIGN_V2.md §6): primary (ink fill), secondary (inkSoft), plain. At least 50 pt tall; long
// translations wrap onto more lines and the pill grows: the label is never truncated (no numberOfLines).
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PressableScale, type PressHaptic } from '../PressableScale';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { pressScaleV2 } from '../../theme/motion';
import { squircle, type FeatherName } from './shared';

export type PillVariant = 'primary' | 'secondary' | 'plain';

export type PillButtonProps = {
  title: string;
  onPress: () => void;
  variant?: PillVariant;
  icon?: FeatherName;
  disabled?: boolean;
  /** Spoken name; default the title. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Default 'tap' for primary, 'select' otherwise. */
  haptic?: PressHaptic;
  /** Stretch to the container width (default true for primary). */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PillButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  haptic,
  block,
  style,
}: PillButtonProps) {
  const { c, text } = useThemeV2();
  const fill = variant === 'primary' ? c.ink : variant === 'secondary' ? c.inkSoft : 'transparent';
  const fg = variant === 'primary' ? c.onInk : c.ink;
  const stretch = block ?? variant === 'primary';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={haptic ?? (variant === 'primary' ? 'tap' : 'select')}
      scaleTo={pressScaleV2}
      // T84: concentric tap ripple on the primary action only.
      ripple={variant === 'primary' && !disabled ? c.onInk : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[
        squircle,
        {
          alignSelf: stretch ? 'stretch' : 'flex-start',
          minHeight: sizeV2.pill,
          borderRadius: radiusV2.pill,
          backgroundColor: fill,
          paddingHorizontal: spaceV2.x6,
          paddingVertical: spaceV2.x3,
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spaceV2.x2 }}>
        {icon ? <Feather name={icon} size={18} color={fg} /> : null}
        <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('headline'), { color: fg, textAlign: 'center', flexShrink: 1 }]}>
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}
