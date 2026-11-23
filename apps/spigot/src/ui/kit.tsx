import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle, type TextStyle, Share, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { HIT, font, radius, space, usePalette, type Palette } from './theme';
import { useApp } from '../state/AppState';
import { parseLength, unitLabel, type UnitSystem } from '../calc/units';
import type { Step } from '../calc/steps';
import { fmtValue, stepLine, stepsAsText } from './format';
import { useCountry } from '../country/useCountry';

export function useTap() {
  const { prefs } = useApp();
  return (kind: 'light' | 'success' | 'warn' = 'light') => {
    if (!prefs.haptics || Platform.OS === 'web') return;
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    else if (kind === 'warn') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    else void Haptics.selectionAsync().catch(() => undefined);
  };
}

export function Screen({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.l, paddingBottom: (footer ? 120 : 40) + insets.bottom, gap: space.l }}>
        {children}
      </ScrollView>
      {footer ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: Math.max(insets.bottom, space.m), backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }}>{footer}</View> : null}
    </View>
  );
}

export function H({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const c = usePalette();
  return <Text accessibilityRole="header" style={[{ fontFamily: font.display, fontSize: 22, letterSpacing: 0.3, color: c.ink, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export function Body({ children, style, muted }: { children: React.ReactNode; style?: TextStyle; muted?: boolean }) {
  const c = usePalette();
  return <Text style={[{ fontSize: 16, lineHeight: 22, color: muted ? c.ink3 : c.ink2 }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = usePalette();
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.l, padding: space.l, gap: space.m, borderWidth: c.scheme === 'light' ? 1 : 0, borderColor: c.line }, style]}>{children}</View>;
}

export function Button({ label, onPress, kind = 'primary', icon, disabled, style, accessibilityHint }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; style?: ViewStyle; accessibilityHint?: string }) {
  const c = usePalette();
  const tap = useTap();
  const bg = kind === 'primary' ? c.vis : kind === 'secondary' ? c.panel : 'transparent';
  const fg = kind === 'primary' ? c.onVis : kind === 'secondary' ? c.onPanel : kind === 'danger' ? c.danger : c.copper;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [{ minHeight: HIT, borderRadius: radius.m, backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.88 : 1, transform: [{ scale: pressed && !disabled ? 0.97 : 1 }], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s, paddingHorizontal: space.l, borderWidth: kind === 'quiet' || kind === 'danger' ? 1.5 : 0, borderColor: kind === 'danger' ? c.danger : c.line }, style]}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} accessible={false} importantForAccessibility="no" /> : null}
      <Text style={{ fontFamily: font.display, fontSize: 21, letterSpacing: 0.4, color: fg, textTransform: 'uppercase' }}>{label}</Text>
    </Pressable>
  );
}

export function Chips<T extends string | number>({ options, value, onChange, label, format }: { options: readonly T[]; value: T | null; onChange: (v: T) => void; label: string; format?: (v: T) => string }) {
  const c = usePalette();
  const tap = useTap();
  return (
    <View style={{ gap: space.s }}>
      <FieldLabel>{label}</FieldLabel>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {options.map(o => {
          const on = o === value;
          return (
            <Pressable key={String(o)} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(o); }}
              style={({ pressed }) => ({ minHeight: HIT - 4, minWidth: 64, paddingHorizontal: space.m, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.ink : c.surface2, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Text style={{ fontFamily: font.display, fontSize: 22, color: on ? c.bg : c.ink }}>{format ? format(o) : String(o)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  const c = usePalette();
  const tap = useTap();
  const { fontScale } = useWindowDimensions();
  const stack = fontScale >= 1.35;
  return (
    <View style={{ gap: space.s }}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <View accessibilityRole="tablist" style={{ flexDirection: stack ? 'column' : 'row', backgroundColor: c.surface2, borderRadius: radius.m, padding: 4, gap: 4 }}>
        {options.map(o => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(o.value); }}
              style={{ flex: stack ? undefined : 1, minHeight: HIT - 8, borderRadius: radius.s, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent', paddingHorizontal: 4 }}>
              <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? c.ink : c.ink2, textAlign: 'center' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  return <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.8, color: c.ink3, textTransform: 'uppercase' }}>{children}</Text>;
}

/** Kinds of numeric field: lengths follow the unit setting; the others are plain numbers with their own suffix. */
export type FieldKind = 'length' | 'number' | 'integer';

export interface NumField {
  label: string;
  /** Raw text as typed. */
  text: string;
  setText: (s: string) => void;
  kind?: FieldKind;
  suffix?: string;
  hint?: string;
  optional?: boolean;
  /** Number fields that may be negative (levels below datum). */
  signed?: boolean;
}

/** Parses a field; null when empty, or an error string. */
export function readField(f: { text: string; kind?: FieldKind }, unit: UnitSystem): number | null | { error: string } {
  if (f.text.trim() === '') return null;
  if ((f.kind ?? 'length') === 'length') {
    const r = parseLength(f.text, unit);
    return r.ok ? r.value : { error: r.error };
  }
  const n = Number(f.text.trim().replace(',', '.'));
  if (!Number.isFinite(n)) return { error: 'Not a number' };
  if (f.kind === 'integer' && !Number.isInteger(n)) return { error: 'Whole numbers only' };
  return n;
}

export function Field({ field, onOpen, error }: { field: NumField; onOpen: () => void; error?: string | null }) {
  const c = usePalette();
  const { prefs } = useApp();
  const typedUnit = (field.kind ?? 'length') === 'length' && /[a-z'"′″]\s*$/i.test(field.text.trim());
  const suffix = typedUnit ? '' : field.suffix ?? ((field.kind ?? 'length') === 'length' ? unitLabel(prefs.unit) : '');
  const empty = field.text.trim() === '';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${field.label}${field.optional ? ', optional' : ''}`} accessibilityValue={{ text: empty ? 'empty' : `${field.text} ${suffix}` }} accessibilityHint="Opens the keypad" onPress={onOpen}
      style={({ pressed }) => ({ gap: 6, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <FieldLabel>{field.label}</FieldLabel>
        {field.optional ? <Text style={{ fontSize: 13, color: c.ink3 }}>Optional</Text> : null}
      </View>
      <View style={{ minHeight: 64, borderRadius: radius.m, borderWidth: 2, borderColor: error ? c.danger : c.line, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l }}>
        <Text maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontFamily: empty ? undefined : font.display, fontSize: empty ? 18 : 32, color: empty ? c.ink3 : c.ink }}>{empty ? 'Tap to enter' : field.text}</Text>
        {suffix ? <Text style={{ fontFamily: font.displayMedium, fontSize: 22, color: c.ink3 }}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={{ color: c.danger, fontSize: 15, fontWeight: '600' }}>{error}</Text> : field.hint ? <Text style={{ color: c.ink3, fontSize: 14 }}>{field.hint}</Text> : null}
    </Pressable>
  );
}

const FRACTIONS = ['1/16', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];

/**
 * Glove-friendly keypad sheet. 64 pt keys, imperial fraction keys, live check of what's typed,
 * and Next to step through a tool's fields.
 */
export function Keypad({ field, visible, onClose, onNext }: { field: NumField | null; visible: boolean; onClose: () => void; onNext?: () => void }) {
  const c = usePalette();
  const { prefs } = useApp();
  const insets = useSafeAreaInsets();
  const tap = useTap();
  const [text, setText] = useState('');
  // Reset only when the sheet opens or moves to another field (the field object is rebuilt on every render).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (visible && field) setText(field.text); }, [visible, field?.label]);
  if (!field) return null;
  const kind = field.kind ?? 'length';
  const imperial = kind === 'length' && prefs.unit === 'imperial';
  const parsed = readField({ text, kind }, prefs.unit);
  const err = parsed && typeof parsed === 'object' ? parsed.error : null;
  const commit = () => { field.setText(text.trim()); };
  const press = (k: string) => {
    tap();
    if (k === '⌫') setText(s => s.slice(0, -1));
    else if (k === 'C') setText('');
    else if (k === '±') setText(s => (s.startsWith('-') ? s.slice(1) : '-' + s));
    else if (FRACTIONS.includes(k)) setText(s => (s.replace(/\s*\d+\/\d+$/, '').trim() + ' ' + k).trim());
    else setText(s => (s + k).slice(0, 24));
  };
  const keys = imperial
    ? [['7', '8', '9', '⌫'], ['4', '5', '6', "'"], ['1', '2', '3', '/'], ['.', '0', ' ', 'C']]
    : [['7', '8', '9', '⌫'], ['4', '5', '6', 'C'], ['1', '2', '3', kind === 'length' ? 'm' : field.signed ? '±' : '−'], ['.', '0', '00', '']];
  const keyLabel = (k: string) => (k === ' ' ? 'space' : k === "'" ? 'ft ′' : k);
  const suffix = kind === 'length' && /[a-z'"′″]\s*$/i.test(text.trim()) ? '' : field.suffix ?? (kind === 'length' ? unitLabel(prefs.unit) : '');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close keypad" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => { commit(); onClose(); }} />
      <View style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), gap: space.m }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <FieldLabel>{field.label}</FieldLabel>
          {field.optional && text ? <Pressable accessibilityRole="button" onPress={() => setText('')} hitSlop={12}><Text style={{ color: c.copper, fontWeight: '700', fontSize: 16 }}>Clear</Text></Pressable> : null}
        </View>
        <View accessibilityLiveRegion="polite" style={{ minHeight: 72, borderRadius: radius.m, backgroundColor: c.panel, paddingHorizontal: space.l, flexDirection: 'row', alignItems: 'center' }}>
          <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontFamily: font.displayHeavy, fontSize: 44, color: text ? c.vis : c.onPanel2 }}>{text || '0'}</Text>
          <Text style={{ fontFamily: font.displayMedium, fontSize: 24, color: c.onPanel2 }}>{suffix}</Text>
        </View>
        <Text style={{ minHeight: 20, color: err ? c.danger : c.ink3, fontSize: 15, fontWeight: err ? '600' : '400' }}>{err ?? field.hint ?? (imperial ? 'Inches, e.g. 12 3/8 or 4′ 2 1/2' : kind === 'length' ? 'Millimetres. Add m for metres (1.2m)' : ' ')}</Text>
        {imperial ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
            {FRACTIONS.map(f => (
              <Pressable key={f} accessibilityRole="button" accessibilityLabel={`plus ${f} inch`} onPress={() => press(f)} style={({ pressed }) => ({ minHeight: 52, minWidth: 64, borderRadius: radius.s, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.display, fontSize: 22, color: c.ink }}>{f}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={{ gap: space.s }}>
          {keys.map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.s }}>
              {row.map((k, j) => k === '' || (k === '−') ? <View key={`blank-${j}`} style={{ flex: 1 }} /> : (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === '⌫' ? 'Delete' : k === 'C' ? 'Clear all' : k === '±' ? 'Plus or minus' : keyLabel(k)} onPress={() => press(k)}
                  style={({ pressed }) => ({ flex: 1, height: 64, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.line : k === '⌫' || k === 'C' || k === '±' ? c.surface2 : c.bg, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                  {k === '⌫' ? <Ionicons name="backspace-outline" size={30} color={c.ink} /> : <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.display, fontSize: k.length > 2 ? 22 : 32, color: c.ink }}>{keyLabel(k)}</Text>}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          {onNext ? <Button kind="quiet" label="Next" icon="arrow-forward" style={{ flex: 1 }} disabled={!!err} onPress={() => { commit(); onNext(); }} /> : null}
          <Button label="Done" icon="checkmark" style={{ flex: 1 }} disabled={!!err} onPress={() => { commit(); onClose(); }} />
        </View>
      </View>
    </Modal>
  );
}

/** Owns the keypad for a list of fields, with Next going to the next one. */
export function useKeypad(fields: NumField[]) {
  const [open, setOpen] = useState<number | null>(null);
  const field = open === null ? null : fields[open] ?? null;
  const element = (
    <Keypad
      field={field}
      visible={open !== null}
      onClose={() => setOpen(null)}
      onNext={open !== null && open < fields.length - 1 ? () => setOpen(open + 1) : undefined}
    />
  );
  return { openAt: (i: number) => setOpen(i), element };
}

export interface BigResult { label: string; value: string; accessibilityValue?: string }

/** The black result panel: huge hi-vis numbers readable at arm's length in sunlight. */
export function ResultPanel({ main, rest, empty }: { main: BigResult | null; rest?: BigResult[]; empty?: string }) {
  const c = usePalette();
  const spoken = main ? [main, ...(rest ?? [])].map(r => `${r.label} ${r.value}`).join(', ') : empty ?? '';
  useEffect(() => {
    const t = setTimeout(() => { if (spoken) AccessibilityInfo.announceForAccessibility(spoken); }, 900);
    return () => clearTimeout(t);
  }, [spoken]);
  return (
    <View accessible accessibilityLiveRegion="polite" accessibilityLabel={main ? [main, ...(rest ?? [])].map(r => `${r.label} ${r.value}`).join(', ') : empty} style={{ backgroundColor: c.panel, borderRadius: radius.l, padding: space.l, gap: space.m }}>
      {main ? (
        <>
          <Text style={{ fontSize: 14, fontWeight: '800', letterSpacing: 1.2, color: c.onPanel2, textTransform: 'uppercase' }}>{main.label}</Text>
          <Text maxFontSizeMultiplier={1.25} adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: font.displayHeavy, fontSize: 72, lineHeight: 78, color: c.vis }}>{main.value}</Text>
          {rest && rest.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.l, rowGap: space.m, borderTopWidth: 1, borderTopColor: '#2F343A', paddingTop: space.m }}>
              {rest.map(r => (
                <View key={r.label} style={{ minWidth: '40%', flexGrow: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 1, color: c.onPanel2, textTransform: 'uppercase' }}>{r.label}</Text>
                  <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: font.display, fontSize: 34, color: c.onPanel }}>{r.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={{ fontFamily: font.displayMedium, fontSize: 24, color: c.onPanel2 }}>{empty ?? 'Enter the measurements'}</Text>
      )}
    </View>
  );
}

export function Working({ steps, title }: { steps: Step[]; title: string }) {
  const c = usePalette();
  const { prefs } = useApp();
  const [open, setOpen] = useState(false);
  const tap = useTap();
  if (!steps.length) return null;
  return (
    <Card style={{ gap: 0, padding: 0 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Show working" accessibilityState={{ expanded: open }} onPress={() => { tap(); setOpen(o => !o); }} style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, gap: space.s }}>
        <Ionicons name="calculator-outline" size={22} color={c.copper} />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: c.ink }}>Show working</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={c.ink3} />
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: space.l, paddingBottom: space.l, gap: space.m }}>
          {steps.map((s, i) => (
            <View key={i} style={{ gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: space.m }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.ink, flexShrink: 1 }}>{s.label}</Text>
                <Text style={{ fontFamily: font.display, fontSize: 22, color: c.ink }}>{fmtValue(s.result, prefs.unit)}</Text>
              </View>
              <Text selectable style={{ fontSize: 15, color: c.ink3, fontVariant: ['tabular-nums'] }}>{stepLine(s, prefs.unit)}</Text>
            </View>
          ))}
          <Button kind="quiet" icon="share-outline" label="Share working" onPress={() => { void Share.share({ message: stepsAsText(title, steps, prefs.unit) }).catch(() => undefined); }} />
        </View>
      ) : null}
    </Card>
  );
}

export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  const c = usePalette();
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: tone === 'warn' ? c.warnBg : c.surface2 }}>
      <Ionicons name={tone === 'warn' ? 'warning-outline' : 'information-circle-outline'} size={22} color={tone === 'warn' ? c.warnInk : c.ink2} />
      <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: tone === 'warn' ? c.warnInk : c.ink2 }}>{children}</Text>
    </View>
  );
}

export function CheckNote() {
  const country = useCountry();
  return <Note>{country.checkNote}</Note>;
}

export function Row({ title, subtitle, onPress, right, icon, destructive }: { title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode; icon?: keyof typeof Ionicons.glyphMap; destructive?: boolean }) {
  const c = usePalette();
  const content = (
    <View style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s }}>
      {icon ? <Ionicons name={icon} size={24} color={destructive ? c.danger : c.copper} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: destructive ? c.danger : c.ink }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 15, color: c.ink3, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={c.ink3} /> : null)}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{content}</Pressable> : content;
}

export function Divider() {
  const c = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}

export function TextBox({ value, onChangeText, placeholder, multiline, label, autoFocus }: { value: string; onChangeText: (s: string) => void; placeholder?: string; multiline?: boolean; label: string; autoFocus?: boolean }) {
  const c = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.ink3} multiline={multiline} autoFocus={autoFocus} accessibilityLabel={label}
        style={{ minHeight: multiline ? 110 : HIT, borderRadius: radius.m, borderWidth: 2, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: space.l, paddingVertical: space.m, fontSize: 18, color: c.ink, textAlignVertical: multiline ? 'top' : 'center' }} />
    </View>
  );
}

export const styles = (c: Palette) => StyleSheet.create({ grow: { flex: 1 } , muted: { color: c.ink3 } });

export function useMemoOnce<T>(fn: () => T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, []);
}
