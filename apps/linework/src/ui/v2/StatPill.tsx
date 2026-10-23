// Rounded stat chip for progress (docs/DESIGN_V2.md §6): icon + number (tabular figures) + label. The caller passes
// an already formatted value (useT().num / percent / duration, which keep numbers LTR-isolated) and the full
// spoken label, e.g. t('home.progress.streak', { count }).
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeV2 } from '../../theme/useTheme';
import { maxFontScaleV2, radiusV2, spaceV2 } from '../../theme/tokensV2';
import { tabular } from '../../theme/tokens';
import { squircle, type FeatherName } from './shared';

export type StatPillProps = {
  value: string;
  label: string;
  icon?: FeatherName;
  /** Icon colour; default sunny-ish accent per tone. */
  tone?: 'ink' | 'sunny' | 'mint' | 'bubblegum' | 'lilac';
  /** Spoken text from the catalogue; without it the screen reader reads the value then the label. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function StatPill({ value, label, icon, tone = 'ink', accessibilityLabel, style }: StatPillProps) {
  const { c, text } = useThemeV2();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[
        squircle,
        {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: spaceV2.x2,
          minHeight: 36,
          paddingVertical: spaceV2.x2,
          paddingHorizontal: spaceV2.x3,
          borderRadius: radiusV2.pill,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
        },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={16} color={c[tone]} /> : null}
      <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('headline'), tabular, { color: c.graphite }]}>
        {value}
      </Text>
      <Text maxFontSizeMultiplier={maxFontScaleV2} style={[text('subhead'), { color: c.muted, flexShrink: 1 }]}>
        {label}
      </Text>
    </View>
  );
}
