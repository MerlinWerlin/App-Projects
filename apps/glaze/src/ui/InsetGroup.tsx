// iOS inset-grouped list (docs/DESIGN_V2.md "InsetGroup / InsetRow"): a rounded section card on the
// grouped background, an optional small header above and footnote below, hairline separators that
// start at the row title. Rows spring slightly on press and fire a selection haptic (Haptics
// setting); Reduce Motion dims instead (PressableScale). Chevrons point the reading way in RTL.
import { Feather } from '@expo/vector-icons';
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { separatorInset } from '../core/designV2';
import { continuous, iconTileRadius, radiusV2, sizeV2, spaceV2, textV2, type PastelName } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { FeatherName } from './featherName';
import type { HapticKind } from './haptics';
import { Chevron, textStyleFor } from './i18nLayout';
import { PressableScale } from './PressableScale';

type GroupProps = {
  children?: ReactNode;
  /** Small section title above the card. */
  header?: string;
  /** Explanatory footnote below the card. */
  footer?: string;
  style?: StyleProp<ViewStyle>;
};

export function InsetGroup({ children, header, footer, style }: GroupProps) {
  const { c } = useColorsV2();
  const { script } = useT();
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<{ icon?: unknown }>[];
  return (
    <View style={[styles.group, style]}>
      {header ? (
        <Text accessibilityRole="header" style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.header, { color: c.inkSecondary }]}>
          {header}
        </Text>
      ) : null}
      <View style={[styles.card, continuous, { backgroundColor: c.surface }]}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {row}
            {i < rows.length - 1 ? (
              <View
                style={[styles.separator, { marginStart: separatorInset(Boolean(row.props.icon)), backgroundColor: c.separator }]}
              />
            ) : null}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text style={[textV2.footnote, textStyleFor(script, textV2.footnote), styles.footer, { color: c.inkSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

export type RowAccessory = 'chevron' | 'check' | 'none';

type RowProps = {
  title: string;
  subtitle?: string;
  /** Trailing secondary text (current value), e.g. a chosen language. */
  value?: string;
  /** Leading glyph on a small pastel squircle tile. */
  icon?: FeatherName;
  iconTone?: PastelName;
  /** chevron: opens a screen · check: selected option in a picker list · none. */
  accessory?: RowAccessory;
  /** Trailing control (Switch, small pill...). The row itself is then not pressable unless onPress is set. */
  trailing?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  haptic?: HapticKind | false;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function InsetRow({
  title,
  subtitle,
  value,
  icon,
  iconTone = 'berry',
  accessory,
  trailing,
  onPress,
  selected = false,
  destructive = false,
  disabled = false,
  haptic = 'select',
  accessibilityLabel,
  accessibilityHint,
}: RowProps) {
  const { c } = useColorsV2();
  const { script, isRTL } = useT();
  const kind: RowAccessory = accessory ?? (selected ? 'check' : onPress && !trailing ? 'chevron' : 'none');
  const tile = sizeV2.rowIcon;
  const content = (
    <>
      {icon ? (
        <View
          style={[
            styles.tile,
            continuous,
            { width: tile, height: tile, borderRadius: iconTileRadius(tile), backgroundColor: c.pastels[iconTone].fill },
          ]}
        >
          <Feather name={icon} size={17} color={c.pastels[iconTone].ink} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text style={[textV2.body, textStyleFor(script, textV2.body), { color: destructive ? c.danger : c.ink }]}>{title}</Text>
        {subtitle ? (
          <Text style={[textV2.footnote, textStyleFor(script, textV2.footnote), { color: c.inkSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {value ? (
        <Text numberOfLines={1} style={[textV2.body, textStyleFor(script, textV2.body), styles.value, { color: c.inkSecondary }]}>
          {value}
        </Text>
      ) : null}
      {trailing ?? null}
      {kind === 'chevron' ? <Feather name={Chevron.forward(isRTL)} size={18} color={c.inkTertiary} /> : null}
      {kind === 'check' ? <Feather name="check" size={20} color={selected ? c.tint : 'transparent'} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible={!trailing} accessibilityLabel={trailing ? undefined : accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      style={[styles.row, disabled ? styles.disabled : null]}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  group: { marginHorizontal: spaceV2.lg, gap: spaceV2.xs + spaceV2.xxs },
  header: { paddingHorizontal: spaceV2.lg, fontWeight: '600' },
  footer: { paddingHorizontal: spaceV2.lg },
  card: { borderRadius: radiusV2.group, overflow: 'hidden' },
  row: {
    minHeight: sizeV2.rowMin,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.sm + spaceV2.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
  },
  tile: { alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: spaceV2.xxs },
  value: { flexShrink: 1, maxWidth: '45%' },
  separator: { height: StyleSheet.hairlineWidth },
  disabled: { opacity: 0.45 },
});
