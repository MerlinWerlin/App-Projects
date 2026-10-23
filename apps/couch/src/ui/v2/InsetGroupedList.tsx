import { Children, createContext, isValidElement, useContext, type ReactNode } from 'react';
import { I18nManager, Pressable, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { accessoryPlacement, continuous, list, radii, separatorInset, space, textStyle } from '../../theme/design';
import { haptic } from '../remote/haptics';
import { Text } from '../Text';
import { useDesign } from './useDesign';

/**
 * iOS inset-grouped list (market-1018 M3): a rounded (continuous) group of rows on the grouped
 * background, with an optional header above and footer below. Rows draw inset separators (starting
 * under the text, not the icon) except after the last row. Every string is a prop from the caller.
 */
interface Position {
  last: boolean;
}
const PositionCtx = createContext<Position>({ last: true });

export function InsetGroupedList({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const p = useDesign();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section}>
      {header ? (
        <Text accessibilityRole="header" style={[textStyle('footnote'), styles.header, { color: p.secondaryLabel }]}>
          {header}
        </Text>
      ) : null}
      <View style={[styles.group, continuous, { backgroundColor: p.surface }]}>
        {rows.map((row, i) => (
          <PositionCtx.Provider key={row.key ?? i} value={{ last: i === rows.length - 1 }}>
            {row}
          </PositionCtx.Provider>
        ))}
      </View>
      {footer ? <Text style={[textStyle('footnote'), styles.footer, { color: p.secondaryLabel }]}>{footer}</Text> : null}
    </View>
  );
}

export type RowAccessory =
  | { type: 'none' }
  | { type: 'chevron' }
  /** Read-only value at the end (e.g. the chosen language), optionally with a chevron. */
  | { type: 'value'; value: string; chevron?: boolean }
  /** Tint-coloured action text at the end (e.g. "Change"). */
  | { type: 'detail'; text: string }
  | { type: 'switch'; value: boolean; onValueChange: (v: boolean) => void }
  | { type: 'check'; checked: boolean };

/**
 * One row. Pressable when onPress is set (or for switches: the whole row toggles). Title and subtitle
 * wrap; at accessibility text sizes a value/detail moves under the title instead of truncating.
 * The chevron points to the end edge (mirrored in right-to-left languages).
 */
export function Row({
  title,
  subtitle,
  icon,
  iconBackground,
  accessory = { type: 'none' },
  onPress,
  destructive,
  disabled,
  accessibilityHint,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  /** Leading icon (drawn on a rounded tile when iconBackground is set). Hidden from VoiceOver. */
  icon?: ReactNode;
  iconBackground?: string;
  accessory?: RowAccessory;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  /** Defaults to title, subtitle and value joined. */
  accessibilityLabel?: string;
}) {
  const p = useDesign();
  const { last } = useContext(PositionCtx);
  const { fontScale } = useWindowDimensions();
  const placement = accessoryPlacement(fontScale, accessory.type);
  const isSwitch = accessory.type === 'switch';
  const press = isSwitch
    ? () => {
        haptic('selection');
        accessory.onValueChange(!accessory.value);
      }
    : onPress
      ? () => {
          haptic(accessory.type === 'check' ? 'selection' : 'light');
          onPress();
        }
      : undefined;

  const trailingText = accessory.type === 'value' ? accessory.value : accessory.type === 'detail' ? accessory.text : undefined;
  const trailingColor = accessory.type === 'detail' ? p.tintLabel : p.secondaryLabel;
  const label = accessibilityLabel ?? [title, subtitle, trailingText].filter(Boolean).join(', ');

  const trailingNode = trailingText ? (
    <Text style={[textStyle('body'), placement === 'end' ? styles.valueEnd : null, { color: trailingColor }]}>{trailingText}</Text>
  ) : null;

  const content = (pressed: boolean) => (
    <View style={[styles.row, { backgroundColor: pressed ? p.surfacePressed : 'transparent' }]}>
      {icon ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.icon, continuous, iconBackground ? { backgroundColor: iconBackground } : null]}
        >
          {icon}
        </View>
      ) : null}
      <View style={styles.main}>
        <View style={styles.line}>
          <View style={styles.texts}>
            <Text style={[textStyle('body'), { color: destructive ? p.destructive : p.label }]}>{title}</Text>
            {subtitle ? <Text style={[textStyle('subheadline'), { color: p.secondaryLabel }]}>{subtitle}</Text> : null}
            {placement === 'below' ? trailingNode : null}
          </View>
          {placement === 'end' ? trailingNode : null}
          {isSwitch ? (
            <Switch
              value={accessory.value}
              onValueChange={(v) => {
                haptic('selection');
                accessory.onValueChange(v);
              }}
              disabled={disabled}
              trackColor={{ true: p.tint, false: p.fill }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
          {accessory.type === 'check' && accessory.checked ? <Check color={p.tint} /> : null}
          {accessory.type === 'chevron' || (accessory.type === 'value' && accessory.chevron) ? <Chevron color={p.tertiaryLabel} /> : null}
        </View>
        {!last ? <View style={[styles.separator, { backgroundColor: p.separator }]} /> : null}
      </View>
    </View>
  );

  const a11y = {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint,
    accessibilityRole: isSwitch ? ('switch' as const) : press ? ('button' as const) : ('text' as const),
    accessibilityState: isSwitch
      ? { checked: accessory.value, disabled: !!disabled }
      : accessory.type === 'check'
        ? { selected: accessory.checked, disabled: !!disabled }
        : { disabled: !!disabled },
  };

  if (!press) return <View {...a11y}>{content(false)}</View>;
  return (
    <Pressable {...a11y} onPress={press} disabled={disabled} style={disabled ? styles.disabled : null}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

/** Row separator inset helper re-exported for screens that draw custom rows. */
export { separatorInset };

function Chevron({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={I18nManager.isRTL ? styles.mirror : null}
    >
      <Svg width={8} height={14} viewBox="0 0 8 14">
        <Path d="M1.5 1.5 L6.5 7 L1.5 12.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

function Check({ color }: { color: string }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={16} height={13} viewBox="0 0 16 13">
        <Path d="M1.5 7 L6 11.5 L14.5 1.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: list.inset, marginBottom: list.groupGap, gap: space.sm },
  header: { paddingHorizontal: list.rowPadding },
  footer: { paddingHorizontal: list.rowPadding },
  group: { borderRadius: radii.group, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingStart: list.rowPadding, minHeight: list.rowMinHeight },
  icon: { width: list.icon, height: list.icon, borderRadius: radii.sm - 3, alignItems: 'center', justifyContent: 'center', marginEnd: list.iconGap },
  main: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingEnd: list.rowPadding,
    paddingVertical: list.rowPaddingV,
    minHeight: list.rowMinHeight,
  },
  texts: { flex: 1, gap: space.xxs },
  // Natural (start) alignment: values sit at the end of the row and only wrap below the AX sizes,
  // where they move under the title instead (accessoryPlacement).
  valueEnd: { flexShrink: 1, maxWidth: '55%' },
  separator: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  mirror: { transform: [{ scaleX: -1 }] },
  disabled: { opacity: 0.5 },
});
