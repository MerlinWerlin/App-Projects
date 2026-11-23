/** Shared controls. Big targets (56 pt), high contrast, Dynamic Type safe. Colours only from the theme. */
import { type ReactNode, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useApp } from '../state/AppState';
import { BOLD, FONT, RADIUS, SPACE, TARGET, type Theme } from '../theme/theme';
import { haptic } from '../native/store';

export const DONE_ID = 'screedline-done';

import { Icon } from './Icon';
export { Icon };

export function T({ style, children, kind = 'body', color, numberOfLines, max = 2 }: { style?: StyleProp<TextStyle>; children: ReactNode; kind?: 'title' | 'headline' | 'body' | 'label' | 'small' | 'caps'; color?: string; numberOfLines?: number; max?: number }) {
  const { theme } = useApp();
  const base: TextStyle =
    kind === 'title' ? { fontFamily: FONT.numBold, fontSize: 34, lineHeight: 38, letterSpacing: 0.2 }
    : kind === 'headline' ? { ...BOLD, fontSize: 19, lineHeight: 25 }
    : kind === 'label' ? { ...BOLD, fontSize: 17, lineHeight: 22 }
    : kind === 'small' ? { fontFamily: FONT.body, fontSize: 15, lineHeight: 20 }
    : kind === 'caps' ? { ...BOLD, fontSize: 13, lineHeight: 17, letterSpacing: 1.2, textTransform: 'uppercase' }
    : { fontFamily: FONT.body, fontSize: 17, lineHeight: 24 };
  return (
    <Text maxFontSizeMultiplier={max} numberOfLines={numberOfLines} style={[base, { color: color ?? (kind === 'small' || kind === 'caps' ? theme.ink2 : theme.ink) }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, alt }: { children: ReactNode; style?: StyleProp<ViewStyle>; alt?: boolean }) {
  const { theme } = useApp();
  return <View style={[{ backgroundColor: alt ? theme.cardAlt : theme.card, borderRadius: RADIUS.m, padding: SPACE.l, borderWidth: theme.name === 'sun' ? theme.borderWidth : StyleSheet.hairlineWidth, borderColor: theme.line }, style]}>{children}</View>;
}

export function Button({ label, onPress, kind = 'primary', icon, disabled, a11y, style, testID }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'plain' | 'danger'; icon?: string; disabled?: boolean; a11y?: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { theme } = useApp();
  const bg = kind === 'primary' ? theme.amber : 'transparent';
  const fg = kind === 'primary' ? theme.onAmber : kind === 'danger' ? theme.danger : theme.ink;
  const border = kind === 'secondary' ? theme.ink : kind === 'danger' ? theme.danger : 'transparent';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: TARGET, borderRadius: RADIUS.m, backgroundColor: bg, borderWidth: kind === 'plain' ? 0 : 2, borderColor: kind === 'primary' ? theme.amber : border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.l, gap: SPACE.s, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}
    >
      {icon ? <Icon name={icon} size={22} color={fg} /> : null}
      <Text maxFontSizeMultiplier={1.6} style={{ ...BOLD, fontSize: 18, color: fg, flexShrink: 1, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/** iOS decimal pads have no return key: one shared Done bar for every number field. */
export function DoneBar() {
  const { theme } = useApp();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ID}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: theme.cardAlt, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line, paddingHorizontal: SPACE.m, paddingVertical: SPACE.xs }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => Keyboard.dismiss()} style={{ minHeight: 44, minWidth: 88, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.amber, borderRadius: RADIUS.s }}>
          <Text style={{ ...BOLD, fontSize: 18, color: theme.onAmber }}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export function FieldShell({ label, help, error, children }: { label: string; help?: string; error?: string; children: ReactNode }) {
  const { theme } = useApp();
  return (
    <View style={{ gap: 6 }}>
      <T kind="label">{label}</T>
      {children}
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={18} color={theme.danger} />
          <T kind="small" color={theme.danger} style={{ flex: 1 }}>{error}</T>
        </View>
      ) : help ? <T kind="small">{help}</T> : null}
    </View>
  );
}

export function NumberInput({ value, onChange, unit, label, integer, negative, error, placeholder }: { value: string; onChange: (s: string) => void; unit: string; label: string; integer?: boolean; negative?: boolean; error?: boolean; placeholder?: string }) {
  const { theme } = useApp();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[styles.input, { backgroundColor: theme.card, borderColor: error ? theme.danger : focus ? theme.amber : theme.fieldLine, borderWidth: focus || error ? 3 : theme.borderWidth }]}>
      <TextInput
        accessibilityLabel={`${label}${unit ? ' in ' + unit : ''}`}
        value={value}
        onChangeText={onChange}
        keyboardType={negative ? 'numbers-and-punctuation' : integer ? 'number-pad' : 'decimal-pad'}
        inputAccessoryViewID={DONE_ID}
        selectTextOnFocus
        placeholder={placeholder}
        placeholderTextColor={theme.ink2}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        maxFontSizeMultiplier={1.5}
        style={{ flex: 1, minWidth: 0, fontFamily: FONT.num, fontSize: 30, color: theme.ink, paddingVertical: 0, minHeight: 60 }}
      />
      {unit ? <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: FONT.num, fontSize: 22, color: theme.ink2, marginLeft: SPACE.s }}>{unit}</Text> : null}
    </View>
  );
}

/** Segmented control for 2–3 options; wrapping chips beyond that. */
export function Choice({ options, value, onChange, label }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; label: string }) {
  const { theme, prefs } = useApp();
  const seg = options.length <= 3 || (options.length === 4 && options.every(o => o.label.length <= 6));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={seg ? { flexDirection: 'row', backgroundColor: theme.cardAlt, borderRadius: RADIUS.m, padding: 4, gap: 4, borderWidth: theme.name === 'sun' ? theme.borderWidth : 0, borderColor: theme.line } : { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
            onPress={() => { if (!on) { haptic.tap(prefs.haptics); onChange(o.value); } }}
            style={({ pressed }) => [
              { minHeight: 52, borderRadius: RADIUS.s + 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.m, opacity: pressed ? 0.85 : 1 },
              seg ? { flex: 1, backgroundColor: on ? theme.ink : 'transparent' } : { backgroundColor: on ? theme.ink : theme.card, borderWidth: theme.borderWidth, borderColor: on ? theme.ink : theme.fieldLine },
            ]}
          >
            <Text maxFontSizeMultiplier={1.6} style={{ ...BOLD, fontSize: 16, color: on ? theme.ground : theme.ink, textAlign: 'center' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return <T kind="caps" style={{ marginTop: SPACE.xl, marginBottom: SPACE.s }}>{children}</T>;
}

/** The brand mark in UI: a short amber screed line. */
export function ScreedLine({ width = 44, theme }: { width?: number; theme: Theme }) {
  return <View style={{ width, height: 6, borderRadius: 3, backgroundColor: theme.amber }} />;
}

export function Row({ title, subtitle, icon, onPress, right, a11y, testID }: { title: string; subtitle?: string; icon?: string; onPress?: () => void; right?: ReactNode; a11y?: string; testID?: string }) {
  const { theme } = useApp();
  return (
    <Pressable
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={a11y ?? [title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: TARGET + 8, flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.m, paddingHorizontal: SPACE.l, backgroundColor: pressed ? theme.cardAlt : theme.card })}
    >
      {icon ? <Icon name={icon} size={26} color={theme.ink} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T kind="label">{title}</T>
        {subtitle ? <T kind="small">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={24} color={theme.ink2} /> : null)}
    </Pressable>
  );
}

export function Group({ children }: { children: ReactNode }) {
  const { theme } = useApp();
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={{ borderRadius: RADIUS.m, overflow: 'hidden', borderWidth: theme.name === 'sun' ? theme.borderWidth : StyleSheet.hairlineWidth, borderColor: theme.line }}>
      {items.map((c, i) => (
        <View key={i} style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : undefined}>{c}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 64, borderRadius: RADIUS.m, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.l },
});
