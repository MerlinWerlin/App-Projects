// Capsule button (docs/DESIGN_V2.md "PillButton"): continuous-corner pill, ≥ 48 pt tall, eases
// to 0.97 on press with no bounce (PressableScale + motion tokens; Reduce Motion dims instead) with a haptic that
// follows the Haptics setting. Labels wrap rather than truncate (long German/French strings).
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { continuous, fontScaleCap, materialFill, pressV2, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { FeatherName } from './featherName';
import type { HapticKind } from './haptics';
import { textStyleFor } from './i18nLayout';
import { PressableScale, type PressableScaleProps } from './PressableScale';

export type PillVariant = 'filled' | 'tinted' | 'plain' | 'glass' | 'destructive';

type Props = {
  label: string;
  onPress: () => void;
  /** filled: primary CTA · tinted: secondary · plain: text-only · glass: over photos · destructive. */
  variant?: PillVariant;
  size?: 'regular' | 'small';
  icon?: FeatherName;
  /** Put the icon after the label (it still follows the reading direction). */
  iconAfter?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  disabled?: boolean;
  /** Shows a spinner in place of the icon and blocks presses. */
  busy?: boolean;
  haptic?: HapticKind | false;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** T94: optional secondary action (long-press) and matching VoiceOver/TalkBack actions. */
  onLongPress?: () => void;
  accessibilityActions?: PressableScaleProps['accessibilityActions'];
  onAccessibilityAction?: PressableScaleProps['onAccessibilityAction'];
  style?: StyleProp<ViewStyle>;
};

export function PillButton({
  label,
  onPress,
  variant = 'filled',
  size = 'regular',
  icon,
  iconAfter = false,
  block = false,
  disabled = false,
  busy = false,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  onLongPress,
  accessibilityActions,
  onAccessibilityAction,
  style,
}: Props) {
  const { c, scheme } = useColorsV2();
  const { script } = useT();
  const glass = materialFill('chrome', scheme);
  const colours: Record<PillVariant, { bg: string; fg: string }> = {
    filled: { bg: c.tint, fg: c.onTint },
    tinted: { bg: c.tintSoft, fg: c.onTintSoft },
    plain: { bg: 'transparent', fg: c.tint },
    glass: { bg: glass.translucent, fg: c.ink },
    destructive: { bg: c.danger, fg: c.onDanger },
  };
  const { bg, fg } = colours[variant];
  const inactive = disabled || busy;
  const iconSize = size === 'small' ? 16 : 18;
  const textStyle = size === 'small' ? textV2.subhead : textV2.button;
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      disabled={inactive}
      haptic={haptic ?? (variant === 'filled' ? 'light' : 'select')}
      pressedScale={pressV2.pill}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      hitSlop={size === 'small' ? 4 : 0}
      style={[
        styles.base,
        continuous,
        size === 'small' ? styles.small : styles.regular,
        block ? styles.block : null,
        { backgroundColor: bg },
        variant === 'glass' ? { borderColor: c.separator, borderWidth: StyleSheet.hairlineWidth } : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {iconAfter ? null : <Glyph busy={busy} icon={icon} size={iconSize} color={fg} />}
      <Text
        maxFontSizeMultiplier={fontScaleCap(size === 'small' ? 'subhead' : 'button')}
        style={[
          textStyle,
          textStyleFor(script, textStyle),
          styles.label,
          size === 'small' ? styles.smallWeight : null,
          { color: fg },
        ]}
      >
        {label}
      </Text>
      {iconAfter ? <Glyph busy={busy} icon={icon} size={iconSize} color={fg} /> : null}
    </PressableScale>
  );
}

function Glyph({ busy, icon, size, color }: { busy: boolean; icon?: FeatherName; size: number; color: string }) {
  if (busy) {
    return <ActivityIndicator size="small" color={color} />;
  }
  return icon ? <Feather name={icon} size={size} color={color} /> : null;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radiusV2.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spaceV2.sm,
    alignSelf: 'flex-start',
  },
  regular: { minHeight: sizeV2.pill, paddingHorizontal: spaceV2.xl, paddingVertical: spaceV2.md },
  small: { minHeight: sizeV2.pillSmall, paddingHorizontal: spaceV2.lg, paddingVertical: spaceV2.sm },
  block: { alignSelf: 'stretch' },
  label: { flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.45 },
  smallWeight: { fontWeight: '600' },
});
