// PillTabs (fb-1022 G4, T102): sub-tabs as content-sized pills in a horizontal row. Each pill is as
// wide as its own label (one line, never clipped, never broken mid-phrase like "Our / picks" in an
// equal-width segment); when the labels are longer than the screen (long translations) the row
// scrolls sideways instead of squeezing them. Selected pill: tint fill; others: quiet `fill`.
import { ScrollView, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useT } from '../i18n';
import { continuous, radiusV2, sizeV2, spaceV2, textV2 } from '../theme/tokensV2';
import { useColorsV2 } from '../theme/useTokens';
import { PressableScale } from './PressableScale';
import { textStyleFor } from './i18nLayout';

export type PillTabOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  /** Read by screen readers as the group name. */
  label: string;
  options: readonly PillTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function PillTabs<T extends string>({ label, options, value, onChange, style }: Props<T>) {
  const { c } = useColorsV2();
  const { t, script } = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.scroller, style]}
      contentContainerStyle={styles.row}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => {
              if (!selected) onChange(o.value);
            }}
            haptic={selected ? false : 'select'}
            pressedScale={0.95}
            accessibilityRole="tab"
            accessibilityLabel={t('ui.segmentedOptionA11y', { group: label, option: o.label })}
            accessibilityState={{ selected }}
            style={[styles.pill, continuous, { backgroundColor: selected ? c.tint : c.fill }]}
          >
            <Text
              numberOfLines={1}
              style={[
                textV2.subhead,
                textStyleFor(script, textV2.subhead),
                styles.text,
                { color: selected ? c.onTint : c.ink },
              ]}
            >
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Bleed to the screen edges so a scrolling row isn't cut at the content inset.
  scroller: { marginHorizontal: -spaceV2.lg, flexGrow: 0 },
  row: { paddingHorizontal: spaceV2.lg, gap: spaceV2.sm, alignItems: 'center' },
  pill: {
    minHeight: sizeV2.touch,
    paddingHorizontal: spaceV2.lg,
    borderRadius: radiusV2.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontWeight: '600', textAlign: 'center' },
});
