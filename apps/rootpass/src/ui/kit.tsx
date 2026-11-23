import { Icon, type IconName } from './Icon.tsx';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Step } from '../core/units.ts';
import { codeNote } from '../core/country.ts';
import { useApp } from '../state/AppState.tsx';
import { C, FONT, HIT, RADIUS, SPACE } from './theme.ts';

type Variant = 'display' | 'title' | 'headline' | 'body' | 'label' | 'small' | 'number';
const V: Record<Variant, TextStyle> = {
  display: { fontFamily: FONT.display, fontSize: 40, lineHeight: 42, letterSpacing: 0.2 },
  title: { fontFamily: FONT.display, fontSize: 26, lineHeight: 30 },
  headline: { fontFamily: FONT.bodyBold, fontWeight: '600', fontSize: 17, lineHeight: 22 },
  body: { fontFamily: FONT.body, fontSize: 17, lineHeight: 23 },
  label: { fontFamily: FONT.displayMed, fontSize: 15, lineHeight: 18, letterSpacing: 1.1, textTransform: 'uppercase' },
  small: { fontFamily: FONT.body, fontSize: 14, lineHeight: 19 },
  number: { fontFamily: FONT.display, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
};

export function Txt({ v = 'body', tone = 'ink', style, children, ...rest }: TextProps & { v?: Variant; tone?: 'ink' | 'ink2' | 'ink3' | 'accent' | 'arc' | 'warn' | 'bad' | 'accentInk' }) {
  const { sp } = useApp();
  // Copy follows the user's country spelling; numbers and non-string children pass through.
  const kids = Array.isArray(children) ? children.map(c => (typeof c === 'string' ? sp(c) : c)) : typeof children === 'string' ? sp(children) : children;
  return <Text maxFontSizeMultiplier={v === 'display' || v === 'number' ? 1.4 : 1.8} {...rest} style={[V[v], { color: C[tone] }, style]}>{kids}</Text>;
}

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.ground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SPACE.gutter, paddingBottom: insets.bottom + SPACE.xxl * 2, gap: SPACE.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

export function Section({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: SPACE.sm }}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="label" tone="ink3" accessibilityRole="header">{title}</Txt>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: ViewStyle; tone?: 'surface' | 'raised' | 'accent' }) {
  const bg = tone === 'accent' ? C.accentDim : tone === 'raised' ? C.raised : C.surface;
  return <View style={[{ backgroundColor: bg, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.md, borderWidth: tone === 'accent' ? 1 : 0, borderColor: C.accent }, style]}>{children}</View>;
}

export interface NumFieldProps {
  label: string;
  value: string;
  onChange(v: string): void;
  unit?: string;
  hint?: string;
  step?: number;
  min?: number;
  integer?: boolean;
  allowNegative?: boolean;
  invalid?: boolean;
}

/** Big number field: 64 pt tall, decimal keypad, optional − / + steppers sized for gloves. */
export function NumField({ label, value, onChange, unit, hint, step, min, integer, allowNegative, invalid }: NumFieldProps) {
  const [focus, setFocus] = useState(false);
  const bump = (d: number) => {
    const cur = Number(String(value).replace(',', '.'));
    const base = Number.isFinite(cur) ? cur : 0;
    let next = Math.round((base + d) * 1000) / 1000;
    if (min !== undefined) next = Math.max(min, next);
    onChange(String(next));
    void Haptics.selectionAsync().catch(() => undefined);
  };
  return (
    <View style={{ gap: 6, flex: 1, minWidth: 140 }}>
      <Txt v="label" tone="ink2">{label}</Txt>
      <View style={[st.field, { borderColor: invalid ? C.bad : focus ? C.accent : C.line }]}>
        {step ? <Stepper icon="remove" label={`Less ${label}`} onPress={() => bump(-step)} /> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          keyboardType={integer ? 'number-pad' : allowNegative ? 'numbers-and-punctuation' : 'decimal-pad'}
          returnKeyType="done"
          selectTextOnFocus
          accessibilityLabel={`${label}${unit ? ` in ${unit}` : ''}`}
          placeholder="0"
          placeholderTextColor={C.ink3}
          maxFontSizeMultiplier={1.3}
          style={st.input}
        />
        {unit ? <Txt v="headline" tone="ink3" style={{ paddingRight: step ? 4 : SPACE.md }}>{unit}</Txt> : null}
        {step ? <Stepper icon="add" label={`More ${label}`} onPress={() => bump(step)} /> : null}
      </View>
      {hint ? <Txt v="small" tone="ink3">{hint}</Txt> : null}
    </View>
  );
}

function Stepper({ icon, label, onPress }: { icon: 'add' | 'remove'; label: string; onPress(): void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => [st.stepper, pressed && { backgroundColor: C.line, transform: [{ scale: 0.95 }] }]}>
      <Icon name={icon} size={26} color={C.ink} />
    </Pressable>
  );
}

export function Row({ children, gap = SPACE.md }: { children: ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{children}</View>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange(v: T): void; label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt v="label" tone="ink2">{label}</Txt> : null}
      <View style={st.seg} accessibilityRole="radiogroup">
        {options.map(o => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => { if (!on) { onChange(o.value); void Haptics.selectionAsync().catch(() => undefined); } }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[st.segItem, on && { backgroundColor: C.accent }]}
            >
              <Txt v="headline" tone={on ? 'accentInk' : 'ink2'} style={{ textAlign: 'center' }} numberOfLines={2}>{o.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Btn({ label, onPress, kind = 'primary', icon, disabled }: { label: string; onPress(): void; kind?: 'primary' | 'secondary' | 'plain'; icon?: IconName; disabled?: boolean }) {
  const { sp } = useApp();
  const bg = kind === 'primary' ? C.accent : kind === 'secondary' ? C.raised : 'transparent';
  const fg = kind === 'primary' ? C.accentInk : kind === 'plain' ? C.accent : C.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={sp(label)}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [st.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed && !disabled ? 0.97 : 1 }] }]}
    >
      {icon ? <Icon name={icon} size={22} color={fg} /> : null}
      <Text maxFontSizeMultiplier={1.5} style={{ fontFamily: FONT.display, fontSize: 21, color: fg, letterSpacing: 0.4 }}>{sp(label)}</Text>
    </Pressable>
  );
}

/** The answer, big. */
export function Big({ label, value, sub, tone = 'ink' }: { label: string; value: string; sub?: string; tone?: 'ink' | 'accent' | 'arc' }) {
  const { sp } = useApp();
  return (
    <View style={{ gap: 2, minWidth: 140, flex: 1 }} accessible accessibilityLabel={sp(`${label}: ${value}${sub ? `, ${sub}` : ''}`)}>
      <Txt v="label" tone="ink3">{label}</Txt>
      <Txt v="number" tone={tone} selectable>{value}</Txt>
      {sub ? <Txt v="small" tone="ink2">{sub}</Txt> : null}
    </View>
  );
}

export function Working({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  return (
    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: SPACE.sm }}>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={st.workingHead}>
        <Icon name="working" size={20} color={C.arc} />
        <Txt v="headline" tone="arc" style={{ flex: 1 }}>{open ? 'Hide the working' : 'Show the working'}</Txt>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={20} color={C.arc} />
      </Pressable>
      {open ? (
        <View style={{ gap: SPACE.md, paddingTop: SPACE.sm }}>
          {steps.map((s, k) => (
            <View key={k} style={{ gap: 2 }}>
              <Txt v="small" tone="ink2">{k + 1}. {s.label}</Txt>
              {s.formula ? <Txt v="small" tone="arc" selectable style={{ fontFamily: FONT.bodyBold, fontWeight: '600' }}>{s.formula}</Txt> : null}
              <Txt v="body" selectable>{s.value}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Note({ kind = 'verify', children }: { kind?: 'verify' | 'warn' | 'error' | 'info'; children: ReactNode }) {
  const map = {
    verify: { bg: C.warnDim, fg: C.warn, icon: 'warning' as const },
    warn: { bg: C.warnDim, fg: C.warn, icon: 'alert' as const },
    error: { bg: '#341714', fg: C.bad, icon: 'error' as const },
    info: { bg: C.arcDim, fg: C.arc, icon: 'info' as const },
  }[kind];
  return (
    <View style={[st.note, { backgroundColor: map.bg }]} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      <Icon name={map.icon} size={22} color={map.fg} />
      <Txt v="body" style={{ flex: 1, color: map.fg }}>{children}</Txt>
    </View>
  );
}

export const VERIFY = 'Verify before cutting: check one length with a tape and tack-fit before welding out.';

/** "Verify before cutting" plus the user's local welding code. */
export function VerifyNote() {
  const { country } = useApp();
  return <Note>{`${VERIFY} ${codeNote(country)}`}</Note>;
}

export function TableRows({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <View style={{ borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
      <View style={[st.tr, { backgroundColor: C.raised }]}>
        {head.map((h, k) => <Txt key={k} v="label" tone="ink2" style={[st.td, k === 0 && { flex: 0.8 }]}>{h}</Txt>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[st.tr, i % 2 ? { backgroundColor: C.surface } : null]}>
          {r.map((c, k) => <Txt key={k} v="headline" selectable style={[st.td, k === 0 && { flex: 0.8, color: C.ink2 }, { fontVariant: ['tabular-nums'] }]}>{String(c)}</Txt>)}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 64, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 2 },
  input: { flex: 1, minWidth: 60, color: C.ink, fontFamily: FONT.display, fontSize: 30, paddingHorizontal: SPACE.md, paddingVertical: 8, fontVariant: ['tabular-nums'] },
  stepper: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm, margin: 2, backgroundColor: C.raised },
  seg: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 52, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  btn: { minHeight: HIT + 4, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg },
  workingHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 48 },
  note: { flexDirection: 'row', gap: SPACE.sm, padding: SPACE.md, borderRadius: RADIUS.md },
  tr: { flexDirection: 'row', paddingHorizontal: SPACE.md, paddingVertical: 10, gap: SPACE.sm },
  td: { flex: 1 },
});
