// Shared building blocks. Every control is at least TOUCH (56 pt) tall for gloved hands; text uses Dynamic Type
// (allowFontScaling is on by default) with a cap on the giant result numerals so they never overflow.
import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Check, Step } from '../core/result.ts';
import { formatLength, parseLength, parseNumber } from '../core/units.ts';
import { useSettings } from '../state/settings.tsx';
import { fonts, radius, space, TOUCH, useTheme } from '../theme/theme.ts';

export function Screen({ children, bottom }: { children: ReactNode; bottom?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.l, paddingBottom: space.xxl + insets.bottom, gap: space.l }}
      >
        {children}
      </ScrollView>
      {bottom}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: radius.l, padding: space.l, gap: space.m, borderWidth: 1, borderColor: t.line }, style]}>{children}</View>;
}

export function H({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.3, color: t.ink, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

export function P({ children, muted, small }: { children: ReactNode; muted?: boolean; small?: boolean }) {
  const t = useTheme();
  return <Text style={{ fontFamily: fonts.body, fontSize: small ? 15 : 17, lineHeight: small ? 21 : 24, color: muted ? t.muted : t.ink }}>{children}</Text>;
}

type FieldKind = 'length' | 'number' | 'int' | 'angle';

/** A labelled input. Lengths take mm, cm, m, inches, fractions or feet-inches; the line under it says what was read. */
export function Field({ label, value, onChange, kind = 'length', placeholder, hint, optional }: { label: string; value: string; onChange: (s: string) => void; kind?: FieldKind; placeholder?: string; hint?: string; optional?: boolean }) {
  const t = useTheme();
  const { settings } = useSettings();
  const [focus, setFocus] = useState(false);
  const trimmed = value.trim();
  let echo: string | null = null;
  let bad = false;
  if (trimmed) {
    if (kind === 'length') {
      const mm = parseLength(trimmed, settings.units);
      if (mm == null) bad = true;
      else if (!/^\d+(\.\d+)?$/.test(trimmed) || settings.units === 'imperial') echo = settings.units === 'imperial' ? `${formatLength(mm, 'metric')} · ${formatLength(mm, 'imperial', settings.denom)}` : formatLength(mm, 'metric');
    } else {
      const n = parseNumber(trimmed);
      if (n == null || (kind === 'int' && !Number.isInteger(n))) bad = true;
    }
  }
  const unit = kind === 'angle' ? '°' : kind === 'length' ? (settings.units === 'metric' ? 'mm' : 'in') : '';
  const keyboard: KeyboardTypeOptions = kind === 'int' ? 'number-pad' : kind === 'length' && settings.units === 'imperial' ? 'numbers-and-punctuation' : 'decimal-pad';
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.muted }}>
        {label}
        {optional ? <Text style={{ fontFamily: fonts.body }}>  optional</Text> : null}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: TOUCH + 4, borderRadius: radius.m, borderWidth: 2, borderColor: bad ? t.bad : focus ? t.focus : t.line, backgroundColor: t.card, paddingHorizontal: space.m }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          placeholderTextColor={t.muted}
          keyboardType={keyboard}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          selectTextOnFocus
          accessibilityLabel={label}
          accessibilityHint={hint}
          maxFontSizeMultiplier={1.6}
          style={{ flex: 1, fontFamily: fonts.display, fontSize: 30, color: t.ink, paddingVertical: Platform.OS === 'ios' ? 10 : 6 }}
        />
        {unit ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: t.muted }}>{unit}</Text> : null}
      </View>
      {bad ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.bad }}>{kind === 'length' ? 'Can’t read that length. Try 2400, 2.4m or 4\' 6 1/2"' : kind === 'int' ? 'Enter a whole number' : 'Enter a number'}</Text> : echo ? <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.muted }}>= {echo}</Text> : hint ? <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.muted }}>{hint}</Text> : null}
    </View>
  );
}

export function Segment<T extends string | number>({ label, options, value, onChange }: { label?: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.muted }}>{label}</Text> : null}
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => ({ minHeight: TOUCH - 8, paddingHorizontal: space.l, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? t.ink : t.card, borderWidth: 2, borderColor: on ? t.ink : t.line, opacity: pressed ? 0.75 : 1 })}
            >
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: on ? t.bg : t.ink }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 999 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const t = useTheme();
  const btn = (d: number, icon: 'remove' | 'add') => (
    <Pressable
      onPress={() => onChange(Math.min(max, Math.max(min, value + d)))}
      disabled={(d < 0 && value <= min) || (d > 0 && value >= max)}
      accessibilityRole="button"
      accessibilityLabel={`${d < 0 ? 'Fewer' : 'More'} ${label.toLowerCase()}`}
      style={({ pressed }) => ({ width: TOUCH + 8, height: TOUCH, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', backgroundColor: t.ink, opacity: pressed ? 0.7 : (d < 0 && value <= min) || (d > 0 && value >= max) ? 0.3 : 1 })}
    >
      <Ionicons name={icon} size={30} color={t.bg} />
    </Pressable>
  );
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.muted }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }} accessibilityLabel={`${label}: ${value}`}>
        {btn(-1, 'remove')}
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 36, color: t.ink }} maxFontSizeMultiplier={1.4}>
          {value}
        </Text>
        {btn(1, 'add')}
      </View>
    </View>
  );
}

/** Tape-measure ticks along the top of the result blade (decoration). */
function Ticks() {
  const t = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row', height: 14, overflow: 'hidden', marginHorizontal: -space.l, marginTop: -space.l, marginBottom: space.xs }}>
      {Array.from({ length: 80 }, (_, i) => (
        <View key={i} style={{ width: 1.5, marginRight: 4.5, height: i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6, backgroundColor: t.bladeTick }} />
      ))}
    </View>
  );
}

/** The hero result: black condensed numerals on blade yellow. */
export function Blade({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${sub ? `. ${sub}` : ''}`} style={{ backgroundColor: t.blade, borderRadius: radius.l, padding: space.l, gap: 2, overflow: 'hidden' }}>
      <Ticks />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, letterSpacing: 0.6, textTransform: 'uppercase', color: t.bladeInk }}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.5} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.displayHeavy, fontSize: 64, lineHeight: 70, color: t.bladeInk }}>
        {value}
      </Text>
      {sub ? <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: t.bladeInk }}>{sub}</Text> : null}
      {children}
    </View>
  );
}

export type Readout = { label: string; value: string; strong?: boolean };

export function Readouts({ rows }: { rows: Readout[] }) {
  const t = useTheme();
  return (
    <Card style={{ paddingVertical: space.s, gap: 0 }}>
      {rows.map((r, i) => (
        <View key={r.label} accessible accessibilityLabel={`${r.label}: ${r.value}`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space.m, minHeight: 50, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, paddingVertical: space.s }}>
          <Text style={{ flexShrink: 1, fontFamily: fonts.body, fontSize: 17, color: t.muted }}>{r.label}</Text>
          <Text style={{ flexShrink: 1, marginLeft: 'auto', fontFamily: fonts.display, fontSize: r.strong ? 30 : 26, color: t.ink, textAlign: 'right' }} maxFontSizeMultiplier={1.5}>
            {r.value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

export function Checks({ checks }: { checks: Check[] }) {
  const t = useTheme();
  if (!checks.length) return null;
  const map = { ok: { c: t.ok, bg: t.okBg, icon: 'checkmark-circle' as const, word: 'OK' }, warn: { c: t.warn, bg: t.warnBg, icon: 'alert-circle' as const, word: 'Note' }, fail: { c: t.bad, bg: t.badBg, icon: 'close-circle' as const, word: 'Outside the limit' } };
  return (
    <View style={{ gap: space.s }}>
      {checks.map((c, i) => {
        const m = map[c.level];
        return (
          <View key={i} accessible accessibilityLabel={`${m.word}: ${c.text}`} style={{ flexDirection: 'row', gap: space.s, alignItems: 'flex-start', backgroundColor: m.bg, borderRadius: radius.m, padding: space.m }}>
            <Ionicons name={m.icon} size={24} color={m.c} />
            <Text style={{ flex: 1, fontFamily: c.level === 'warn' ? fonts.body : fonts.bodyBold, fontSize: 16, lineHeight: 22, color: t.ink }}>{c.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function StepsCard({ steps }: { steps: Step[] }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ gap: space.s }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', minHeight: TOUCH - 12, gap: space.s }}>
        <Ionicons name="calculator-outline" size={22} color={t.ink} />
        <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, color: t.ink }}>How it’s worked out</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={t.muted} />
      </Pressable>
      {open
        ? steps.map((s, i) => (
            <View key={i} style={{ gap: 2, paddingTop: space.s, borderTopWidth: 1, borderTopColor: t.line }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: t.muted }}>{s.label}</Text>
              <Text selectable style={{ fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 24, color: t.ink }}>
                {s.working}
              </Text>
            </View>
          ))
        : null}
    </Card>
  );
}

export function ErrorCard({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: space.s, alignItems: 'center', borderRadius: radius.l, borderWidth: 2, borderStyle: 'dashed', borderColor: t.line, padding: space.l }}>
      <Ionicons name="create-outline" size={24} color={t.muted} />
      <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 23, color: t.muted }}>{text}</Text>
    </View>
  );
}

export function Verify({ text }: { text?: string }) {
  return <P muted small>{text ?? 'Guidance only: verify against the plans, the engineer’s details and the codes that apply where you build.'}</P>;
}

export function Button({ label, onPress, kind = 'primary', icon, disabled, hint }: { label: string; onPress: () => void; kind?: 'primary' | 'blade' | 'secondary' | 'quiet' | 'danger'; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; hint?: string }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.ink : kind === 'blade' ? t.blade : kind === 'secondary' ? t.card : 'transparent';
  const fg = kind === 'primary' ? t.bg : kind === 'blade' ? t.bladeInk : kind === 'danger' ? t.bad : t.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({ minHeight: TOUCH, borderRadius: radius.m, paddingHorizontal: space.l, flexDirection: 'row', alignItems: 'center', justifyContent: kind === 'quiet' || kind === 'danger' ? 'flex-start' : 'center', gap: space.s, backgroundColor: bg, borderWidth: kind === 'secondary' ? 2 : 0, borderColor: t.ink, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 })}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: fg, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Reads a length field: null when empty or unreadable. */
export function useReaders() {
  const { settings } = useSettings();
  return {
    len: (s: string | undefined) => (s && s.trim() ? parseLength(s, settings.units) : null),
    num: (s: string | undefined) => (s && s.trim() ? parseNumber(s) : null),
  };
}
