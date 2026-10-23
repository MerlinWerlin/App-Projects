import type { ComponentProps } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { elevation, radius, space, touch } from '../theme/tokens';
import { PressableScale } from './PressableScale';
import { useTypography } from '../theme/typography';

type FeatherName = ComponentProps<typeof Feather>['name'];

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  icon?: FeatherName;
  /** Defaults to `title`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Large studio buttons (≥ 48 pt; primary is 60 pt tall). Primary = ink fill, secondary = card with a line border.
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
}: ButtonProps) {
  const ty = useTypography();
  const { c } = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? c.onInk : c.graphite;
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[
        {
          minHeight: primary ? 60 : touch + 8,
          borderRadius: radius.md,
          paddingHorizontal: space.xl,
          paddingVertical: space.sm,
          backgroundColor: primary ? c.ink : c.card,
          borderWidth: primary ? 0 : 1,
          borderColor: c.line,
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        primary && !disabled ? elevation.card : null,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {icon ? <Feather name={icon} size={primary ? 22 : 20} color={fg} style={{ marginEnd: space.sm }} /> : null}
        {/* Long translations wrap and the button grows (minHeight, never a fixed height). */}
        <Text style={{ ...ty.face('bodyBold'), fontSize: primary ? 18 : 16, color: fg, flexShrink: 1, textAlign: 'center' }}>{title}</Text>
      </View>
    </PressableScale>
  );
}
