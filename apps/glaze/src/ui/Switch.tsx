import { Pressable, Switch, StyleSheet, Text, View } from 'react-native';
import { fontScaleCap, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { useT } from '../i18n';
import { textStyleFor } from './i18nLayout';

type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
  /** Screen-reader label if it should differ from the visible label. */
  accessibilityLabel?: string;
  disabled?: boolean;
};

/** A full-width ≥ 48 pt row with a label and a switch; tapping anywhere on the row toggles it. Design v2 (T83): tint track. */
export function SwitchRow({ label, value, onChange, description, accessibilityLabel, disabled = false }: Props) {
  const { c } = useColorsV2();
  const { script } = useT();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      style={({ pressed }) => [styles.row, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}
    >
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={fontScaleCap('body')} style={[textV2.body, textStyleFor(script, textV2.body), { color: c.ink }]}>
          {label}
        </Text>
        {description ? (
          <Text maxFontSizeMultiplier={fontScaleCap('footnote')} style={[textV2.footnote, textStyleFor(script, textV2.footnote), { color: c.inkSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {/* The row carries the semantics; the switch itself is hidden from screen readers. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: c.tint, false: c.fill }}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: sizeV2.touch, flexDirection: 'row', alignItems: 'center', gap: spaceV2.md, paddingVertical: spaceV2.xs },
  text: { flex: 1, gap: spaceV2.xxs },
});
