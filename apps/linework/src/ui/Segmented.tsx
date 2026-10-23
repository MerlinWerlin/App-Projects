import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, space, touch } from '../theme/tokens';
import { select } from '../native/haptics';
import { useTypography } from '../theme/typography';

export type SegmentedOption<T extends string> = { value: T; label: string; accessibilityHint?: string };

export type SegmentedProps<T extends string> = {
  options: readonly [SegmentedOption<T>, SegmentedOption<T>];
  value: T;
  onChange: (v: T) => void;
  /** Read by screen readers for the group, e.g. "Image style". */
  accessibilityLabel: string;
  disabled?: boolean;
};

// Two-option toggle (pill track with a filled selected segment).
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, disabled = false }: SegmentedProps<T>) {
  const ty = useTypography();
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        padding: space.xs,
        borderRadius: radius.pill,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (selected || disabled) return;
              select();
              onChange(o.value);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityHint={o.accessibilityHint}
            accessibilityState={{ checked: selected, selected, disabled }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: touch,
              paddingHorizontal: space.xs,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? c.ink : pressed ? c.inkSoft : 'transparent',
            })}
          >
            <Text
              maxFontSizeMultiplier={1.4}
              numberOfLines={2}
              adjustsFontSizeToFit
              style={{ ...ty.face('bodyBold'), fontSize: 16, color: selected ? c.onInk : c.graphite, textAlign: 'center' }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
