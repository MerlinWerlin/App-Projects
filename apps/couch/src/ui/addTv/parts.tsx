import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import { continuous, list, radii, space, textStyle } from '../../theme/design';
import { Text } from '../Text';
import { useDesign } from '../v2';

/**
 * Small design-v2 pieces shared by the add-TV screens (app/add-tv.tsx, app/add-tv-ir.tsx; T68).
 * Every string comes in as a prop from the caller's catalogue. Nothing has a fixed height: text and
 * fields grow with Larger Text.
 */

/** Step heading inside the scroll content (the large title stays "Add a TV"). */
export function StepTitle({ children, live }: { children: ReactNode; live?: boolean }) {
  const p = useDesign();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLiveRegion={live ? 'polite' : undefined}
      style={[textStyle('title2'), { color: p.label }]}
    >
      {children}
    </Text>
  );
}

/** Body copy in the step column: 'label' for primary text, 'secondary' for hints. */
export function StepText({
  children,
  tone = 'label',
  live,
}: {
  children: ReactNode;
  tone?: 'label' | 'secondary' | 'error';
  live?: boolean;
}) {
  const p = useDesign();
  const color = tone === 'error' ? p.destructive : tone === 'secondary' ? p.secondaryLabel : p.label;
  return (
    <Text accessibilityLiveRegion={live ? 'polite' : undefined} style={[textStyle(tone === 'secondary' ? 'footnote' : 'subheadline'), { color }]}>
      {children}
    </Text>
  );
}

/** Tinted callout for what to do on the TV (Allow prompt, Roku setting, infrared tip). */
export function Callout({ children, live }: { children: ReactNode; live?: boolean }) {
  const p = useDesign();
  return (
    <View style={[styles.callout, continuous, { backgroundColor: p.tintedFill }]}>
      <Text accessibilityLiveRegion={live ? 'polite' : undefined} style={[textStyle('subheadline'), { color: p.tintedLabel }]}>
        {children}
      </Text>
    </View>
  );
}

/** Labelled text field on the grouped surface (name, room, address, PIN, key). */
export function StepField({
  label,
  inputStyle,
  ...input
}: TextInputProps & { label?: string; inputStyle?: StyleProp<TextStyle> }) {
  const p = useDesign();
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[textStyle('footnote'), styles.fieldLabel, { color: p.secondaryLabel }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={p.secondaryLabel}
        {...input}
        style={[styles.field, continuous, textStyle('body'), { backgroundColor: p.surface, color: p.label }, inputStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  callout: { borderRadius: radii.md, padding: space.md },
  fieldWrap: { gap: space.xs },
  fieldLabel: { paddingHorizontal: list.rowPadding },
  field: { minHeight: list.rowMinHeight, borderRadius: radii.group, paddingHorizontal: list.rowPadding, paddingVertical: space.md },
});
