// Progress figure (DESIGN.md §5): plain inline text, the number in graphite (tabular figures) and the label in
// muted. No chip, no icon, no count-up. The caller passes an already formatted value (useT().num etc., which keep
// numbers LTR-isolated) and may pass the full spoken label. `icon` / `tone` are accepted and ignored.
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, spaceV2 } from '../../theme/tokensV2';
import { tabular } from '../../theme/tokens';
import type { FeatherName } from './shared';

export type StatPillProps = {
  value: string;
  label: string;
  icon?: FeatherName;
  tone?: 'ink' | 'sunny' | 'mint' | 'bubblegum' | 'lilac';
  /** Spoken text from the catalogue; without it the screen reader reads the value then the label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function StatPill({ value, label, accessibilityLabel, style }: StatPillProps) {
  const { c, text } = useThemeV2();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spaceV2.x1 }, style]}
    >
      <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('headline'), tabular, { color: c.graphite }]}>
        {value}
      </Text>
      <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.muted, flexShrink: 1 }]}>
        {label}
      </Text>
    </View>
  );
}
