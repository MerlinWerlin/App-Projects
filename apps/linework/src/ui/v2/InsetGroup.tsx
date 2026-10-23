// iOS inset-grouped section (docs/DESIGN_V2.md §6): optional header and footer text around a rounded card of rows.
// Rows: icon bubble, title (+ subtitle), detail, and a chevron (mirrored for RTL), switch, check or nothing.
// Hairline separators are inset to the text start (past the icon bubble), as in iOS Settings.
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, radiusV2, sizeV2, spaceV2 } from '../../theme/tokensV2';
import { forwardChevron } from '../../i18n/direction';
import { select, tap } from '../../native/haptics';
import { IconBubble } from './IconBubble';
import { squircle, type FeatherName } from './shared';

export type InsetGroupProps = {
  header?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function InsetGroup({ header, footer, children, style }: InsetGroupProps) {
  const { c, text } = useThemeV2();
  let i = 0;
  const rows = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const first = i === 0;
    i += 1;
    return cloneElement(child as ReactElement<{ isFirst?: boolean }>, { isFirst: first });
  });
  return (
    <View style={[{ marginBottom: spaceV2.section }, style]}>
      {header ? (
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('footnote'), { color: c.muted, textTransform: 'uppercase', paddingHorizontal: spaceV2.x4, marginBottom: spaceV2.x2 }]}
        >
          {header}
        </Text>
      ) : null}
      <View style={[squircle, { backgroundColor: c.card, borderRadius: radiusV2.md, overflow: 'hidden' }]}>{rows}</View>
      {footer ? (
        <Text
          maxFontSizeMultiplier={maxFontScaleV2}
          style={[text('footnote'), { color: c.muted, paddingHorizontal: spaceV2.x4, marginTop: spaceV2.x2 }]}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export type InsetRowAccessory = 'chevron' | 'switch' | 'check' | 'none';

export type InsetRowProps = {
  title: string;
  subtitle?: string;
  /** Trailing value text ("English", "On"). */
  detail?: string;
  icon?: FeatherName;
  iconFill?: string;
  iconColor?: string;
  /** Default: 'chevron' when onPress is set, 'switch' when onValueChange is set, otherwise 'none'. */
  accessory?: InsetRowAccessory;
  /** Switch rows. */
  value?: boolean;
  onValueChange?: (v: boolean) => void;
  /** Switch rows: selection tick before the change (default true). Off for a row that ticks itself (Haptics). */
  switchHaptic?: boolean;
  /** 'check' rows: shows the check mark and reports selected. */
  checked?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Set by InsetGroup: the first row draws no separator. */
  isFirst?: boolean;
};

export function InsetRow({
  title,
  subtitle,
  detail,
  icon,
  iconFill,
  iconColor,
  accessory,
  value,
  onValueChange,
  switchHaptic = true,
  checked,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  isFirst = false,
}: InsetRowProps) {
  const { c, text } = useThemeV2();
  const kind: InsetRowAccessory = accessory ?? (onValueChange ? 'switch' : onPress ? 'chevron' : 'none');
  const textStart = spaceV2.x4 + (icon ? sizeV2.iconBubble + spaceV2.x3 : 0);
  const isSwitch = kind === 'switch';
  const press = isSwitch
    ? onValueChange && !disabled
      ? () => {
          if (switchHaptic) select();
          onValueChange(!value);
        }
      : undefined
    : onPress && !disabled
      ? () => {
          if (kind === 'check') select();
          else tap();
          onPress();
        }
      : undefined;

  const role = isSwitch ? 'switch' : kind === 'check' ? 'radio' : press ? 'button' : undefined;
  const state = isSwitch ? { checked: !!value, disabled } : kind === 'check' ? { checked: !!checked, disabled } : { disabled };

  return (
    <Pressable
      onPress={press}
      disabled={!press}
      accessible
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={state}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: sizeV2.row,
        paddingStart: spaceV2.x4,
        paddingEnd: spaceV2.x4,
        paddingVertical: spaceV2.x3,
        gap: spaceV2.x3,
        backgroundColor: pressed && press ? c.card2 : c.card,
        opacity: disabled ? 0.45 : 1,
      })}
    >
      {!isFirst ? (
        <View
          style={{ position: 'absolute', top: 0, start: textStart, end: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.line }}
        />
      ) : null}
      {icon ? <IconBubble icon={icon} fill={iconFill} color={iconColor} /> : null}
      <View style={{ flex: 1, flexShrink: 1 }}>
        <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('body'), { color: c.graphite }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('body'), { color: c.muted, flexShrink: 1, textAlign: 'auto' }]}>
          {detail}
        </Text>
      ) : null}
      {kind === 'chevron' ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Feather name={forwardChevron()} size={20} color={c.muted} />
        </View>
      ) : null}
      {kind === 'check' && checked ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Feather name="check" size={20} color={c.ink} />
        </View>
      ) : null}
      {isSwitch ? (
        <Switch
          value={!!value}
          onValueChange={(v) => {
            if (switchHaptic) select();
            onValueChange?.(v);
          }}
          disabled={disabled}
          trackColor={{ true: c.mint, false: c.line }}
          // the row is the accessible switch; hide the inner control so it is not announced twice
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </Pressable>
  );
}
