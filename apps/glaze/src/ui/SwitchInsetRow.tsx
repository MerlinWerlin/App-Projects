// Inset row with a trailing switch (v2 SwitchRow, docs/DESIGN_V2.md §8): tapping anywhere toggles
// it, the row carries the switch semantics and the switch itself is hidden from screen readers.
// ≥ 52 pt. Use inside an InsetGroup. T56: was duplicated in Settings and Icons.
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Switch, Text, View, type TextStyle } from 'react-native';
import { useT, type Script } from '../i18n';
import { iconTileRadius, sizeV2, spaceV2, textV2, type PastelName, type TypeRoleV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import type { FeatherName } from './featherName';
import { textStyleFor } from './i18nLayout';
import { PressableScale } from './PressableScale';

export type SwitchInsetRowProps = {
  label: string;
  /** Second line under the label; also read as the row's accessibility hint. */
  description?: string;
  accessibilityLabel?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Optional pastel squircle icon tile at the start. */
  icon?: FeatherName;
  iconTone?: PastelName;
  /** Dimmed and not toggleable (e.g. "Use in all themes" before the icon is customised). */
  disabled?: boolean;
};

function typeFor(script: Script, role: TypeRoleV2): TextStyle[] {
  return [textV2[role], textStyleFor(script, textV2[role])];
}

export function SwitchInsetRow({
  label,
  description,
  accessibilityLabel,
  value,
  onChange,
  icon,
  iconTone = 'berry',
  disabled = false,
}: SwitchInsetRowProps) {
  const { c } = useColorsV2();
  const { script } = useT();
  return (
    <PressableScale
      onPress={() => onChange(!value)}
      pressedScale={0.98}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      style={[styles.row, disabled ? styles.disabled : null]}
    >
      {icon ? (
        <View style={[styles.tile, { backgroundColor: c.pastels[iconTone].fill }]}>
          <Feather name={icon} size={17} color={c.pastels[iconTone].ink} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text style={[...typeFor(script, 'body'), { color: c.ink }]}>{label}</Text>
        {description ? <Text style={[...typeFor(script, 'footnote'), { color: c.inkSecondary }]}>{description}</Text> : null}
      </View>
      {/* The row carries the semantics; the switch itself is hidden from screen readers. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.tint, false: c.fill }} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizeV2.rowMin,
    paddingHorizontal: spaceV2.lg,
    paddingVertical: spaceV2.sm + spaceV2.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceV2.md,
  },
  disabled: { opacity: 0.45 },
  tile: {
    width: sizeV2.rowIcon,
    height: sizeV2.rowIcon,
    borderRadius: iconTileRadius(sizeV2.rowIcon),
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, flexShrink: 1, gap: spaceV2.xxs },
});
