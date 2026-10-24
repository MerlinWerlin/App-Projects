import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { continuous, radii, space, textStyle } from '../../theme/design';
import { minTarget } from '../../theme/tokens';
import type { HapticKind } from '../remote/haptics';
import { PressableScale } from '../motion/PressableScale';
import { Text } from '../Text';
import { useDesign } from '../v2';

/**
 * Round icon button for the Cast tab (cast-1024): at least 48 pt, an SVG icon from src/ui/icons and
 * an optional short caption under it (wraps at large text sizes). The label is spoken; the icon is
 * hidden from screen readers.
 */
export function IconButton({
  icon,
  label,
  caption,
  hint,
  onPress,
  disabled,
  prominent,
  haptic = 'light',
}: {
  icon: ReactNode;
  label: string;
  caption?: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  prominent?: boolean;
  haptic?: HapticKind;
}) {
  const p = useDesign();
  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={[styles.wrap, disabled ? styles.disabled : null]}
    >
      <View
        style={[styles.circle, continuous, { backgroundColor: prominent ? p.tint : p.tintedFill }, prominent ? styles.big : null]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon}
      </View>
      {caption ? (
        <Text scaleRole="caption" style={[textStyle('caption1'), styles.caption, { color: p.secondaryLabel }]}>
          {caption}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, minWidth: minTarget, flexShrink: 1 },
  disabled: { opacity: 0.4 },
  circle: { minWidth: minTarget, minHeight: minTarget, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', padding: space.sm },
  big: { minWidth: 64, minHeight: 64 },
  caption: { textAlign: 'center' },
});
