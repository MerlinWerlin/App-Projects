// Squircle card (docs/DESIGN_V2.md §6): radius lg, e2 shadow (dark: top highlight), optional pastel fill and a
// sparkle accent in the top end corner. With onPress it becomes a button with the v2 press scale.
import type { ReactNode } from 'react';
import { View, type AccessibilityActionEvent, type AccessibilityActionInfo, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale, type PressHaptic } from '../PressableScale';
import { useThemeV2 } from '../../theme/useTheme';
import { elevationV2, radiusV2, spaceV2, type ElevationLevel } from '../../theme/tokensV2';
import { pressScaleV2 } from '../../theme/motion';
import { Sparkle } from './Sparkle';
import { squircle } from './shared';

export type BubbleCardProps = {
  children: ReactNode;
  /** Fill colour (a pastel from c.pastels, c.ink for a hero); default card. */
  fill?: string;
  /** Show a small sparkle cluster in the top end corner. */
  sparkle?: boolean;
  sparkleColor?: string;
  radius?: keyof typeof radiusV2;
  elevation?: ElevationLevel;
  padding?: number;
  onPress?: () => void;
  /** Optional long press (pressable cards only); pair it with an accessibility action. */
  onLongPress?: () => void;
  haptic?: PressHaptic;
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  style?: StyleProp<ViewStyle>;
};

export function BubbleCard({
  children,
  fill,
  sparkle = false,
  sparkleColor,
  radius = 'lg',
  elevation = 'e2',
  padding = spaceV2.x4,
  onPress,
  onLongPress,
  haptic = 'tap',
  accessibilityActions,
  onAccessibilityAction,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  style,
}: BubbleCardProps) {
  const { c, isDark } = useThemeV2();
  const box: StyleProp<ViewStyle> = [
    squircle,
    elevationV2(elevation, isDark),
    { backgroundColor: fill ?? c.card, borderRadius: radiusV2[radius], padding },
    style,
  ];
  const accent = sparkle ? (
    <Sparkle variant="cluster" size={22} color={sparkleColor} style={{ position: 'absolute', top: spaceV2.x3, end: spaceV2.x3 }} />
  ) : null;
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={onLongPress ? 400 : undefined}
        haptic={haptic}
        scaleTo={pressScaleV2}
        // T84: tap ripple; light rings on an ink hero card, ink rings on light cards.
        ripple={fill === c.ink ? c.onInk : c.ink}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
        style={box}
      >
        {children}
        {accent}
      </PressableScale>
    );
  }
  return (
    <View style={box} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}>
      {children}
      {accent}
    </View>
  );
}
