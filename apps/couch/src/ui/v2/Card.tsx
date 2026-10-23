import type { ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import { boxShadow, continuous, press, radii, space, type ShadowLevel } from '../../theme/design';
import type { HapticKind } from '../remote/haptics';
import { PressableScale } from '../motion/PressableScale';
import { useDesign } from './useDesign';

/**
 * Raised content card (market-1018 M3): continuous (squircle) corners, layered shadow in light,
 * lighter surface + hairline edge in dark. With onPress it springs on press (PressableScale, Reduce
 * Motion = dim only) and plays a light haptic. Copy comes from the caller (accessibilityLabel prop).
 */
export function Card({
  children,
  onPress,
  onLongPress,
  elevation = 'low',
  haptic = 'light',
  padded = true,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  elevation?: ShadowLevel;
  haptic?: HapticKind;
  /** Default 16pt inner padding; false for full-bleed content (images, previews). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  disabled?: boolean;
}) {
  const p = useDesign();
  const look: StyleProp<ViewStyle> = [
    styles.card,
    continuous,
    {
      backgroundColor: p.card,
      boxShadow: boxShadow(elevation, p.scheme),
      borderColor: p.cardEdge,
      borderWidth: p.cardEdge === 'transparent' ? 0 : StyleSheet.hairlineWidth,
    },
    padded ? styles.padded : null,
    style,
  ];
  if (!onPress && !onLongPress) {
    return (
      <View style={look} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} accessibilityRole={accessibilityRole}>
        {children}
      </View>
    );
  }
  return (
    <PressableScale
      style={look}
      onPress={onPress}
      onLongPress={onLongPress}
      haptic={haptic}
      scaleTo={press.cardScale}
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card },
  padded: { padding: space.lg, gap: space.sm },
});
