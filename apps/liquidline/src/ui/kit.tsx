// Shared building blocks. Glove-first: every control is at least TOUCH (56 pt) tall, steppers are big, numbers are
// big condensed numerals. Text uses system styles that scale with Dynamic Type (allowFontScaling stays on).
import { Icon as Ionicons } from './Icon.tsx';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, RADIUS, SPACE, TOUCH, usePalette, type Palette } from '../theme/tokens.ts';

export type Tone = 'low' | 'high' | 'neutral';

export function toneColor(p: Palette, tone: Tone) {
  return tone === 'low' ? p.low : tone === 'high' ? p.high : p.text;
}

export function Screen({ title, subtitle, children, right, tab = true }: { title?: string; subtitle?: string; children: ReactNode; right?: ReactNode; tab?: boolean }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: tab ? insets.top + SPACE.md : SPACE.lg, paddingBottom: SPACE.xxl + (tab ? 0 : insets.bottom), paddingHorizontal: SPACE.lg, gap: SPACE.lg }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="automatic"
    >
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.md }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[styles.largeTitle, { color: p.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subhead, { color: p.text2 }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={DONE_BAR}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: p.surface2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.line, paddingHorizontal: SPACE.lg }}>
            <Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: SPACE.sm }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: p.text }}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </ScrollView>
  );
}

/** The iOS number pad has no return key: every number field gets this Done bar above the keyboard. */
export const DONE_BAR = 'liquidline-done';

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: Tone }) {
  const p = usePalette();
  const border = tone === 'low' ? p.low : tone === 'high' ? p.high : p.line;
  return <View style={[{ backgroundColor: p.surface, borderRadius: RADIUS.lg, padding: SPACE.lg, gap: SPACE.md, borderWidth: tone ? 1.5 : StyleSheet.hairlineWidth, borderColor: border }, style]}>{children}</View>;
}

export function Label({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  const p = usePalette();
  return <Text style={[styles.label, { color: tone === 'neutral' ? p.text2 : toneColor(p, tone) }]}>{children}</Text>;
}

export function Heading({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  const p = usePalette();
  return <Text accessibilityRole="header" style={{ fontSize: 19, lineHeight: 24, fontWeight: '800', color: toneColor(p, tone) }}>{children}</Text>;
}

/** A list of what's included, with a check for each line. */
export function Checklist({ items }: { items: string[] }) {
  const p = usePalette();
  return (
    <View style={{ gap: 8 }}>
      {items.map((t) => (
        <View key={t} style={{ flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' }}>
          <Ionicons name="checkmark-circle" size={20} color={p.ok} style={{ marginTop: 1 }} />
          <Text style={[styles.body, { color: p.text, flex: 1 }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export function Body({ children, dim }: { children: ReactNode; dim?: boolean }) {
  const p = usePalette();
  return <Text style={[styles.body, { color: dim ? p.text2 : p.text }]}>{children}</Text>;
}

export function Small({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={[styles.footnote, { color: p.text3 }]}>{children}</Text>;
}

export function Segmented<T extends string>({ value, options, onChange, tone = 'neutral', label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; tone?: Tone; label?: string }) {
  const p = usePalette();
  const active = tone === 'neutral' ? p.accent : toneColor(p, tone);
  const onActive = tone === 'neutral' ? p.onAccent : tone === 'low' ? p.onLow : p.onHigh;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: p.surface2, borderRadius: RADIUS.md, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) void Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={({ pressed }) => ({ flex: 1, minHeight: TOUCH - 8, borderRadius: RADIUS.sm + 2, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? active : 'transparent', paddingHorizontal: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 16, fontWeight: '700', color: on ? onActive : p.text2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A big number field with − / + steppers and a ± key (the iOS decimal pad has no minus, and evaporating
 * temperatures are often below zero).
 */
export function NumberField({ label, value, onChange, unit, step = 1, tone = 'neutral', allowNegative = true, hint, onUnitPress, testID }: {
  label: string; value: string; onChange: (s: string) => void; unit?: string; step?: number; tone?: Tone; allowNegative?: boolean; hint?: string; onUnitPress?: () => void; testID?: string;
}) {
  const p = usePalette();
  const color = toneColor(p, tone);
  const bump = (d: number) => {
    const n = Number(value.replace(',', '.'));
    const base = Number.isFinite(n) && value.trim() !== '' ? n : 0;
    const decimals = Math.max(decimalsOf(value), decimalsOf(String(step)));
    let next = base + d;
    if (!allowNegative) next = Math.max(0, next);
    onChange(next.toFixed(decimals));
    void Haptics.selectionAsync().catch(() => {});
  };
  const flip = () => {
    const t = value.trim();
    onChange(t.startsWith('-') ? t.slice(1) : t ? `-${t}` : '-');
  };
  return (
    <View style={{ gap: SPACE.xs }}>
      <Label tone={tone}>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: SPACE.sm }}>
        <StepButton icon="remove" label={`Decrease ${label}`} onPress={() => bump(-step)} color={color} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface2, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, minHeight: TOUCH + 12 }}>
          <TextInput
            testID={testID}
            accessibilityLabel={label}
            value={value}
            onChangeText={(s) => onChange(s.replace(/[^0-9.,\-]/g, ''))}
            keyboardType="decimal-pad"
            inputAccessoryViewID={DONE_BAR}
            returnKeyType="done"
            selectTextOnFocus
            placeholder="–"
            placeholderTextColor={p.text3}
            style={{ flex: 1, fontFamily: FONT.numeral, fontSize: 38, color, paddingVertical: 4, minWidth: 40 }}
          />
          {unit ? (
            <Pressable disabled={!onUnitPress} onPress={onUnitPress} accessibilityRole={onUnitPress ? 'button' : 'text'} accessibilityLabel={onUnitPress ? `Unit ${unit}, change` : unit} hitSlop={10}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: p.text2 }}>{unit}</Text>
            </Pressable>
          ) : null}
        </View>
        {allowNegative ? <StepButton text="±" label={`Make ${label} negative or positive`} onPress={flip} color={color} narrow /> : null}
        <StepButton icon="add" label={`Increase ${label}`} onPress={() => bump(step)} color={color} />
      </View>
      {hint ? <Small>{hint}</Small> : null}
    </View>
  );
}

function decimalsOf(s: string) {
  const i = s.replace(',', '.').indexOf('.');
  return i < 0 ? 0 : Math.min(3, s.length - i - 1);
}

function StepButton({ icon, text, label, onPress, color, narrow }: { icon?: keyof typeof Ionicons.glyphMap; text?: string; label: string; onPress: () => void; color: string; narrow?: boolean }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressRetentionOffset={16}
      style={({ pressed }) => ({ width: narrow ? 48 : TOUCH, minHeight: TOUCH + 12, borderRadius: RADIUS.md, backgroundColor: pressed ? p.line : p.surface2, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      {icon ? <Ionicons name={icon} size={28} color={color} /> : <Text style={{ fontSize: 24, fontWeight: '800', color }}>{text}</Text>}
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', icon, disabled, tone = 'neutral', testID }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'plain'; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; tone?: Tone; testID?: string }) {
  const p = usePalette();
  const fill = tone === 'neutral' ? p.accent : toneColor(p, tone);
  const onFill = tone === 'neutral' ? p.onAccent : tone === 'low' ? p.onLow : p.onHigh;
  const bg = kind === 'primary' ? fill : kind === 'secondary' ? p.surface2 : 'transparent';
  const fg = kind === 'primary' ? onFill : kind === 'secondary' ? p.text : fill;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: TOUCH, borderRadius: RADIUS.md, backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed && !disabled ? 0.97 : 1 }], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg })}
      pressRetentionOffset={16}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text style={{ fontSize: 17, fontWeight: '700', color: fg, textAlign: 'center' }}>{title}</Text>
    </Pressable>
  );
}

export function Row({ title, detail, onPress, icon, value, tone = 'neutral', last, testID }: { title: string; detail?: string; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap; value?: string; tone?: Tone; last?: boolean; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable testID={testID} accessibilityRole={onPress ? 'button' : 'text'} onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: TOUCH, paddingVertical: SPACE.sm, opacity: pressed ? 0.6 : 1, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line })}>
      {icon ? <Ionicons name={icon} size={24} color={toneColor(p, tone)} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: p.text, fontWeight: '600' }]}>{title}</Text>
        {detail ? <Text style={[styles.footnote, { color: p.text2 }]}>{detail}</Text> : null}
      </View>
      {value ? <Text style={[styles.body, { color: p.text2 }]}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={20} color={p.text3} /> : null}
    </Pressable>
  );
}

/** The big readout: a gauge-style number with its unit and a caption. */
export function Readout({ label, value, unit, tone = 'neutral', caption, size = 'big', testID }: { label: string; value: string; unit?: string; tone?: Tone; caption?: string; size?: 'big' | 'mid'; testID?: string }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={`${label} ${value} ${unit ?? ''}`} style={{ gap: 2 }}>
      <Label tone={tone}>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <Text testID={testID} adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: size === 'big' ? 76 : 48, lineHeight: size === 'big' ? 80 : 52, color: toneColor(p, tone), letterSpacing: -1 }}>{value}</Text>
        {unit ? <Text style={{ fontFamily: FONT.numeralMedium, fontSize: size === 'big' ? 28 : 22, color: p.text2 }}>{unit}</Text> : null}
      </View>
      {caption ? <Small>{caption}</Small> : null}
    </View>
  );
}

/** "Show working": the calculation steps, collapsed by default so the answer stays big. */
export function Working({ steps, initiallyOpen = false }: { steps: { label: string; value: string }[]; initiallyOpen?: boolean }) {
  const p = usePalette();
  const [open, setOpen] = useState(initiallyOpen);
  if (!steps.length) return null;
  return (
    <View style={{ gap: SPACE.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={p.text2} />
        <Text style={[styles.body, { color: p.text2, fontWeight: '600' }]}>{open ? 'Hide working' : 'Show working'}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: 6, borderLeftWidth: 2, borderLeftColor: p.line, paddingLeft: SPACE.md }}>
          {steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md, flexWrap: 'wrap' }}>
              <Text style={[styles.footnote, { color: p.text2, flexShrink: 1 }]}>{s.label}</Text>
              <Text style={[styles.footnote, { color: p.text, fontWeight: '700' }]}>{s.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Notice({ text, kind = 'warn', icon }: { text: string; kind?: 'warn' | 'info' | 'ok'; icon?: keyof typeof Ionicons.glyphMap }) {
  const p = usePalette();
  const bg = kind === 'warn' ? p.warnSoft : kind === 'ok' ? p.okSoft : p.surface2;
  const fg = kind === 'warn' ? p.onWarnSoft : kind === 'ok' ? p.ok : p.text2;
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', gap: SPACE.sm, backgroundColor: bg, borderRadius: RADIUS.md, padding: SPACE.md }}>
      <Ionicons name={icon ?? (kind === 'warn' ? 'warning' : kind === 'ok' ? 'checkmark-circle' : 'information-circle')} size={20} color={fg} style={{ marginTop: 1 }} />
      <Text style={[styles.footnote, { color: fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function Chip({ text, tone = 'neutral' }: { text: string; tone?: Tone | 'warn' }) {
  const p = usePalette();
  const bg = tone === 'low' ? p.lowSoft : tone === 'high' ? p.highSoft : tone === 'warn' ? p.warnSoft : p.surface2;
  const fg = tone === 'low' ? p.low : tone === 'high' ? p.high : tone === 'warn' ? p.onWarnSoft : p.text2;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: fg }}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  largeTitle: { fontFamily: FONT.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  subhead: { fontSize: 15, lineHeight: 20, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  body: { fontSize: 17, lineHeight: 22 },
  footnote: { fontSize: 14, lineHeight: 19 },
});
