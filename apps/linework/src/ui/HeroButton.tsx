// Home hero buttons (docs/POLISH.md L7): the studio Button shape with a soft sheen and card elevation.
// Primary = ink fill with a white top-light (≈18% → transparent); secondary = card with a faint ink-blue top-light.
// Press feedback and the single light haptic come from PressableScale, so callers must not also call tap().
import { useRef, type ComponentProps } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { elevation, radius, space, touch } from '../theme/tokens';
import { PressableScale } from './PressableScale';
import { useTypography } from '../theme/typography';

type FeatherName = ComponentProps<typeof Feather>['name'];

export type HeroButtonProps = {
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

let nextId = 0;

export function HeroButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
}: HeroButtonProps) {
  const ty = useTypography();
  const { c, isDark } = useTheme();
  const gradId = useRef(`hero-sheen-${nextId++}`).current;
  const primary = variant === 'primary';
  const fg = primary ? c.onInk : c.graphite;
  // Dark mode's ink is a light blue, so its sheen stays a touch quieter.
  const sheenColor = primary ? '#FFFFFF' : c.ink;
  const sheenTop = primary ? (isDark ? 0.14 : 0.18) : isDark ? 0.1 : 0.07;

  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[
        {
          minHeight: primary ? 60 : touch + 8,
          borderRadius: radius.md,
          backgroundColor: primary ? c.ink : c.card,
          borderWidth: primary ? 0 : 1,
          borderColor: c.line,
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        disabled ? null : elevation.card,
        style,
      ]}
    >
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, { borderRadius: radius.md, overflow: 'hidden' }]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={sheenColor} stopOpacity={sheenTop} />
              <Stop offset="0.6" stopColor={sheenColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm }}>
        {icon ? <Feather name={icon} size={primary ? 22 : 20} color={fg} style={{ marginEnd: space.sm }} /> : null}
        {/* Long translations wrap and the button grows (minHeight, never a fixed height). */}
        <Text style={{ ...ty.face('bodyBold'), fontSize: primary ? 18 : 16, color: fg, flexShrink: 1, textAlign: 'center' }}>{title}</Text>
      </View>
    </PressableScale>
  );
}
