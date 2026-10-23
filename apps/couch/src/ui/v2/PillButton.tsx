import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { continuous, press, radii, space, textStyle, typeScale } from '../../theme/design';
import { minTarget } from '../../theme/tokens';
import type { HapticKind } from '../remote/haptics';
import { PressableScale } from '../motion/PressableScale';
import { Text } from '../Text';
import { pillColors, type PillTone, type PillVariant } from './pillColors';
import { useDesign } from './useDesign';

export type PillSize = 'regular' | 'large';
export type { PillTone, PillVariant };

/**
 * Capsule button (market-1018 M3): filled (primary), tinted (secondary), plain (tertiary).
 * Springs on press via PressableScale (Reduce Motion: dim only), light haptic by default.
 * The label is a prop (catalogue string from the caller) and wraps at large Dynamic Type sizes:
 * the capsule grows taller instead of truncating. Minimum 48pt tall.
 */
export function PillButton({
  label,
  onPress,
  variant = 'filled',
  tone = 'accent',
  size = 'regular',
  icon,
  haptic = 'light',
  disabled,
  accessibilityHint,
  accessibilityLabel,
  stretch,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: PillVariant;
  tone?: PillTone;
  size?: PillSize;
  /** Optional leading icon (e.g. <RemoteIcon name="plus" color={...} />), hidden from VoiceOver. */
  icon?: ReactNode;
  haptic?: HapticKind;
  disabled?: boolean;
  accessibilityHint?: string;
  /** Defaults to the label. */
  accessibilityLabel?: string;
  /** Fill the container's width (primary actions at the bottom of a screen). */
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useDesign();
  const c = pillColors(p, variant, tone);
  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      scaleTo={press.pillScale}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.pill,
        continuous,
        size === 'large' ? styles.large : null,
        variant === 'plain' ? styles.plain : null,
        stretch ? styles.stretch : styles.hug,
        { backgroundColor: c.bg },
        style,
      ]}
    >
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {icon}
        </View>
      ) : null}
      <Text style={[textStyle('button'), styles.label, { color: c.ink }]} maxFontSizeMultiplier={typeScale.button.maxScale}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: minTarget,
    borderRadius: radii.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  large: { minHeight: 54, paddingHorizontal: space.xxl },
  plain: { paddingHorizontal: space.md },
  stretch: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  label: { textAlign: 'center', flexShrink: 1 },
});
