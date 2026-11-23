/**
 * Groutline's controls. Built for site use: 56 pt minimum targets, big type that follows Dynamic Type, one accent
 * colour carrying dark ink, and answers in large condensed numerals.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Children, useState, type ReactNode } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type KeyboardTypeOptions, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Step } from '../core/steps.ts';
import { FONT, RADIUS, SPACE, TAP, useTheme, type Theme } from '../theme/theme.ts';

type Variant = 'large' | 'title' | 'title2' | 'headline' | 'body' | 'callout' | 'subhead' | 'footnote' | 'caption';
const SIZES: Record<Variant, TextStyle> = {
  large: { fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -0.4 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 24 },
  callout: { fontSize: 16, lineHeight: 22 },
  subhead: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
};
type Tone = 'ink' | 'ink2' | 'ink3' | 'accent' | 'good' | 'warn' | 'bad' | 'onAccent';

export function Txt({ v = 'body', tone = 'ink', style, children, ...rest }: { v?: Variant; tone?: Tone; style?: StyleProp<TextStyle>; children: ReactNode } & React.ComponentProps<typeof Text>) {
  const t = useTheme();
  return <Text {...rest} style={[SIZES[v], { color: t[tone] }, style]}>{children}</Text>;
}

/** The answer, in big condensed numerals. */
export function Num({ value, unit, size = 64, tone = 'ink' }: { value: string; unit?: string; size?: number; tone?: Tone }) {
  const t = useTheme();
  return (
    <Text accessibilityLabel={unit ? `${value} ${unit}` : value} maxFontSizeMultiplier={1.4} style={{ color: t[tone] }}>
      <Text style={{ fontFamily: FONT.numBold, fontSize: size, lineHeight: size * 1.05 }}>{value}</Text>
      {unit ? <Text style={{ fontFamily: FONT.numSemi, fontSize: size * 0.42 }}>{` ${unit}`}</Text> : null}
    </Text>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'sheet' | 'sunk' | 'accent' | 'ink' }) {
  const t = useTheme();
  const bg = tone === 'sunk' ? t.sunk : tone === 'accent' ? t.accent : tone === 'ink' ? t.ink : t.sheet;
  return <View style={[{ backgroundColor: bg, borderRadius: RADIUS.card, padding: SPACE.md }, style]}>{children}</View>;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ marginTop: SPACE.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.xs, paddingHorizontal: SPACE.xxs }}>
        <Txt v="caption" tone="ink2" accessibilityRole="header" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Txt>
        {right}
      </View>
      {children}
    </View>
  );
}

export function haptic(on = true) {
  if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function Btn({ label, onPress, kind = 'primary', icon, disabled, style, accessibilityHint }: {
  label: string; onPress(): void; kind?: 'primary' | 'ink' | 'plain' | 'danger'; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityHint?: string;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'ink' ? t.ink : 'transparent';
  const fg = kind === 'primary' ? t.onAccent : kind === 'ink' ? t.ground : kind === 'danger' ? t.bad : t.ink;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [st.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, borderWidth: kind === 'plain' ? StyleSheet.hairlineWidth : 0, borderColor: t.line }, style]}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text style={[SIZES.headline, { color: fg, fontSize: 18 }]} maxFontSizeMultiplier={1.6}>{label}</Text>
    </Pressable>
  );
}

export function IconBtn({ icon, label, onPress, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress(): void; color?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={24} color={color ?? t.ink} />
    </Pressable>
  );
}

const SPOKEN: Record<string, string> = { mm: 'millimetres', in: 'inches', 'ft-in': 'feet and inches', 'm²': 'square metres', 'sq ft': 'square feet', '%': 'percent', kg: 'kilograms', lb: 'pounds', L: 'litres', gal: 'gallons' };

/** A number field sized for gloves. Imperial needs ' " and / so it gets the punctuation keyboard. */
export function Field({ label, value, onChangeText, unit, placeholder, error, keyboard, hint, flex, accessibilityLabel }: {
  label: string; value: string; onChangeText(v: string): void; unit?: string; placeholder?: string; error?: string | null; keyboard?: KeyboardTypeOptions; hint?: string; flex?: number; accessibilityLabel?: string;
}) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={flex ? { flex, minWidth: 0 } : undefined}>
      <Txt v="footnote" tone="ink2" style={{ marginBottom: 4, fontWeight: '600' }}>{label}</Txt>
      <View style={[st.field, { backgroundColor: t.sheet, borderColor: error ? t.bad : focus ? t.accent : t.line, borderWidth: focus || error ? 2 : StyleSheet.hairlineWidth }]}>
        <TextInput
          value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.ink3}
          keyboardType={keyboard ?? 'decimal-pad'} returnKeyType="done" selectTextOnFocus
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          accessibilityLabel={accessibilityLabel ?? (unit ? `${label}, in ${SPOKEN[unit] ?? unit}` : label)}
          style={[st.input, { color: t.ink }]} maxFontSizeMultiplier={1.6}
        />
        {unit ? <Txt v="subhead" tone="ink3" style={{ marginLeft: 4 }}>{unit}</Txt> : null}
      </View>
      {error ? <Txt v="footnote" tone="bad" style={{ marginTop: 4 }}>{error}</Txt> : hint ? <Txt v="footnote" tone="ink3" style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

/** Side-by-side items that share the width equally and wrap onto a new line below 120 pt each. */
export function Row({ children, gap = SPACE.sm }: { children: ReactNode; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {Children.map(children, c => (c ? <View style={{ flexGrow: 1, flexBasis: 0, minWidth: 120 }}>{c}</View> : null))}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ id: T; label: string }>; value: T; onChange(v: T): void; label: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label} onPress={() => onChange(o.id)}
            style={({ pressed }) => [st.chip, { backgroundColor: on ? t.ink : t.sheet, borderColor: on ? t.ink : t.line, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={[SIZES.headline, { color: on ? t.ground : t.ink }]} maxFontSizeMultiplier={1.5}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange(v: boolean): void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} style={[st.toggle, { backgroundColor: t.sheet }]}>
      <View style={{ flex: 1, paddingRight: SPACE.sm }}>
        <Txt v="headline">{label}</Txt>
        {sub ? <Txt v="footnote" tone="ink2">{sub}</Txt> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.line }} thumbColor="#FFFFFF" accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
  );
}

export interface PickOption { id: string; title: string; sub?: string }

/** A row that opens a sheet of choices (the country's catalogue), with "Custom" always first. */
export function PickerRow({ label, value, sub, options, selected, onSelect, customLabel = 'Custom: type my own' }: {
  label: string; value: string; sub?: string; options: PickOption[]; selected: string | null; onSelect(id: string | null): void; customLabel?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityHint="Opens the list" onPress={() => setOpen(true)}
        style={({ pressed }) => [st.picker, { backgroundColor: t.sheet, opacity: pressed ? 0.85 : 1 }]}>
        <View style={{ flex: 1 }}>
          <Txt v="footnote" tone="ink2" style={{ fontWeight: '600' }}>{label}</Txt>
          <Txt v="headline" style={{ fontSize: 18 }}>{value}</Txt>
          {sub ? <Txt v="footnote" tone="ink3">{sub}</Txt> : null}
        </View>
        <Ionicons name="chevron-down" size={22} color={t.ink2} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: t.ground }}>
          <View style={[st.sheetHead, { borderBottomColor: t.line }]}>
            <Txt v="title2" accessibilityRole="header" style={{ flex: 1 }}>{label}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACE.xs }}>
              <Txt v="headline" tone="accent" style={{ color: t.dark ? t.accent : t.ink }}>Done</Txt>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACE.md, paddingBottom: insets.bottom + SPACE.xl, gap: SPACE.xs }}>
            {[{ id: '__custom', title: customLabel } as PickOption, ...options].map(o => {
              const on = o.id === '__custom' ? selected === null : o.id === selected;
              return (
                <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={o.sub ? `${o.title}, ${o.sub}` : o.title}
                  onPress={() => { onSelect(o.id === '__custom' ? null : o.id); setOpen(false); }}
                  style={({ pressed }) => [st.option, { backgroundColor: on ? t.ink : t.sheet, opacity: pressed ? 0.85 : 1 }]}>
                  <View style={{ flex: 1 }}>
                    <Txt v="headline" style={{ color: on ? t.ground : t.ink }}>{o.title}</Txt>
                    {o.sub ? <Txt v="footnote" style={{ color: on ? t.ground : t.ink2 }}>{o.sub}</Txt> : null}
                  </View>
                  {on ? <Ionicons name="checkmark" size={24} color={t.ground} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/** "How it's worked out": every line of the sum, so the tiler can check it. */
export function Steps({ steps, initiallyOpen = false }: { steps: Step[]; initiallyOpen?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ marginTop: SPACE.md }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="How it's worked out" onPress={() => setOpen(!open)}
        style={[st.stepsHead, { backgroundColor: t.sunk }]}>
        <Ionicons name="calculator-outline" size={22} color={t.ink} />
        <Txt v="headline" style={{ flex: 1 }}>How it's worked out</Txt>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={t.ink2} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: SPACE.xs, gap: SPACE.xs }}>
          {steps.map((s, i) => (
            <View key={`${s.label}-${i}`} style={[st.step, { backgroundColor: t.sheet, borderLeftColor: t.accent }]} accessible accessibilityLabel={`${s.label}. ${s.working}. Equals ${s.result}`}>
              <Txt v="footnote" tone="ink2" style={{ fontWeight: '700' }}>{`${i + 1}. ${s.label}`}</Txt>
              <Txt v="callout" style={{ fontVariant: ['tabular-nums'] }}>{s.working}</Txt>
              <Txt v="headline" style={{ marginTop: 2 }}>{`= ${s.result}`}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Notes({ notes, tone = 'ink2' }: { notes: string[]; tone?: 'ink2' | 'warn' }) {
  const t = useTheme();
  if (!notes.length) return null;
  return (
    <View style={{ marginTop: SPACE.sm, gap: SPACE.xs }}>
      {notes.map(n => (
        <View key={n} style={{ flexDirection: 'row', gap: SPACE.xs, alignItems: 'flex-start' }}>
          <Ionicons name={tone === 'warn' ? 'warning' : 'information-circle'} size={20} color={tone === 'warn' ? t.warn : t.ink3} style={{ marginTop: 1 }} />
          <Txt v="subhead" tone={tone} style={{ flex: 1 }}>{n}</Txt>
        </View>
      ))}
    </View>
  );
}

export function Problems({ problems }: { problems: Array<{ message: string }> }) {
  const t = useTheme();
  return (
    <Card tone="sunk" style={{ marginTop: SPACE.md }}>
      <View style={{ flexDirection: 'row', gap: SPACE.xs, alignItems: 'center', marginBottom: 4 }}>
        <Ionicons name="create-outline" size={20} color={t.ink2} />
        <Txt v="headline">Fill in to see the answer</Txt>
      </View>
      {[...new Set(problems.map(p => p.message))].map(m => <Txt key={m} v="subhead" tone="ink2">{`• ${m}`}</Txt>)}
    </Card>
  );
}

export function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ minWidth: 120, flexGrow: 1 }} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <Txt v="footnote" tone="ink2" style={{ fontWeight: '600' }}>{label}</Txt>
      <Num value={value} unit={unit} size={34} />
    </View>
  );
}

export const themed = (fn: (t: Theme) => object) => fn;

const st = StyleSheet.create({
  btn: { minHeight: TAP, borderRadius: RADIUS.field, paddingHorizontal: SPACE.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
  field: { minHeight: TAP, borderRadius: RADIUS.field, paddingHorizontal: SPACE.sm, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, width: '100%', fontSize: 22, fontWeight: '700', paddingVertical: 10, fontVariant: ['tabular-nums'] },
  chip: { minHeight: 48, paddingHorizontal: SPACE.md, borderRadius: RADIUS.chip, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  toggle: { minHeight: TAP, borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center' },
  picker: { minHeight: 64, borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.md, paddingTop: SPACE.lg, paddingBottom: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  option: { minHeight: TAP, borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center' },
  stepsHead: { minHeight: TAP, borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  step: { borderRadius: 12, padding: SPACE.sm, borderLeftWidth: 4 },
});
