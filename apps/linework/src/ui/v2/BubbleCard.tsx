// Flat paper card (DESIGN.md §5): card fill, 1 px hairline border, radius lg (12), no shadow by default. The old
// `sparkle` props are accepted and ignored (sparkles are retired). With onPress it becomes a button with the press
// scale.
import type { ReactNode } from 'react';
import { View, type AccessibilityActionEvent, type AccessibilityActionInfo, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale, type PressHaptic } from '../PressableScale';
import { useThemeV2 } from '../../theme/useTheme';
import { elevationV2, radiusV2, spaceV2, type ElevationLevel } from '../../theme/tokensV2';
import { pressScaleV2 } from '../../theme/motion';
import { squircle } from './shared';

export type BubbleCardProps = {
  children: ReactNode;
  /** Fill colour (a pastel from c.pastels, c.ink for a hero); default card. */
  fill?: string;
  /** Retired (DESIGN.md §7): accepted for compatibility, draws nothing. */
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
  radius = 'lg',
  elevation = 'none',
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
    {
      backgroundColor: fill ?? c.card,
      borderRadius: radiusV2[radius],
      padding,
      // hairline edge on paper-coloured cards; a filled (ink) card needs none
      borderWidth: fill === undefined || fill === c.card || fill === c.card2 || c.pastels.includes(fill) ? 1 : 0,
      borderColor: c.line,
    },
    style,
  ];
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={onLongPress ? 400 : undefined}
        haptic={haptic}
        scaleTo={pressScaleV2}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
        style={box}
      >
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={box} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}>
      {children}
    </View>
  );
}
