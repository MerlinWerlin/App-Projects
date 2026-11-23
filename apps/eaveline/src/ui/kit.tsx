/** Shared building blocks. Big targets (56 pt), high contrast, Dynamic Type friendly. */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import {
  FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Step } from '../core/context';
import { lengthInputText, parseLength, parsePitch, pitchInputText } from '../core/units';
import { useApp } from '../state/AppState';
import { RADIUS, SPACE, TOUCH, TYPE, type Theme } from '../theme/theme';

export type Tone = 'ink' | 'ink2' | 'ink3' | 'danger' | 'ok' | 'onAccent' | 'steel';

export function Txt({ v = 'body', tone = 'ink', style, ...rest }: TextProps & { v?: keyof typeof TYPE; tone?: Tone; style?: StyleProp<TextStyle> }) {
  const { theme } = useApp();
  return <Text {...rest} style={[TYPE[v], { color: theme[tone] }, style]} />;
}

export function Screen({ children, pad = true }: { children: ReactNode; pad?: boolean }) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.ground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: pad ? SPACE.gutter : 0, paddingTop: SPACE.sm, paddingBottom: insets.bottom + SPACE.xxl, gap: SPACE.md }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useApp();
  return <View style={[st.card, { backgroundColor: theme.sheet, borderColor: theme.line }, style]}>{children}</View>;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: SPACE.xs }}>
      <View style={st.sectionHead}>
        <Txt v="label" tone="ink3" accessibilityRole="header" style={{ flex: 1 }}>{title}</Txt>
        {right}
      </View>
      {children}
    </View>
  );
}

export function tap(enabled: boolean, kind: 'light' | 'success' = 'light') {
  if (!enabled || Platform.OS === 'web') return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  else void Haptics.selectionAsync().catch(() => undefined);
}

type BtnKind = 'accent' | 'ink' | 'plain' | 'outline' | 'danger';
export function Btn({ label, onPress, kind = 'accent', icon, disabled, style, accessibilityHint, testID }: {
  label: string; onPress(): void; kind?: BtnKind; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityHint?: string; testID?: string;
}) {
  const { theme } = useApp();
  const bg = kind === 'accent' ? theme.accent : kind === 'ink' ? theme.ink : kind === 'danger' ? theme.danger : 'transparent';
  const fg = kind === 'accent' ? theme.onAccent : kind === 'ink' ? theme.ground : kind === 'danger' ? '#FFFFFF' : theme.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [st.btn, { backgroundColor: bg, borderColor: kind === 'outline' ? theme.ink : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text style={[TYPE.headline, { color: fg, textAlign: 'center' }]} maxFontSizeMultiplier={1.6}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, suffix, hint, error, keyboard = 'decimal-pad', placeholder, testID, multiline }: {
  label: string; value: string; onChangeText(t: string): void; suffix?: string; hint?: string; error?: string | null;
  keyboard?: 'decimal-pad' | 'numbers-and-punctuation' | 'default'; placeholder?: string; testID?: string; multiline?: boolean;
}) {
  const { theme } = useApp();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: SPACE.xxs }}>
      <Txt v="subhead" tone="ink2" nativeID={testID ? `${testID}-label` : undefined}>{label}</Txt>
      <View style={[st.field, { backgroundColor: theme.field, borderColor: error ? theme.danger : focus ? theme.ink : theme.fieldLine, borderWidth: focus || error ? 2 : 1.5 }, multiline && { minHeight: 110, alignItems: 'flex-start' }]}>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          keyboardType={keyboard}
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={theme.ink3}
          multiline={multiline}
          style={[TYPE.title2, { flex: 1, color: theme.ink, paddingVertical: SPACE.sm, fontVariant: ['tabular-nums'] }, multiline && { ...TYPE.body, textAlignVertical: 'top' }]}
          selectTextOnFocus={!multiline}
          maxFontSizeMultiplier={1.5}
        />
        {suffix ? <Txt v="headline" tone="ink3">{suffix}</Txt> : null}
      </View>
      {error ? <Txt v="footnote" tone="danger" accessibilityLiveRegion="polite">{error}</Txt> : hint ? <Txt v="footnote" tone="ink3">{hint}</Txt> : null}
    </View>
  );
}

type LenUnit = 'mm' | 'm' | 'ft' | 'in';
/** Length input in the person's units. `size` picks the unit: short (mm / in) or long (m / ft). */
export function LengthField({ label, mm, onMm, size = 'long', hint, testID }: { label: string; mm: number | null; onMm(mm: number | null): void; size?: 'short' | 'long'; hint?: string; testID?: string }) {
  const { prefs } = useApp();
  const unit: LenUnit = prefs.sys === 'imperial' ? (size === 'short' ? 'in' : 'ft') : size === 'short' ? 'mm' : 'm';
  const [text, setText] = useState(() => (mm != null && mm > 0 ? lengthInputText(mm, prefs.sys, unit) : ''));
  const [bad, setBad] = useState(false);
  // Follow outside changes (units switched, job loaded) without fighting the person's typing.
  useEffect(() => {
    const parsed = parseLength(text, prefs.sys, unit);
    if (mm == null || mm <= 0) { if (parsed !== null && parsed > 0) setText(''); return; }
    if (parsed === null || Math.abs(parsed - mm) > 0.5) setText(lengthInputText(mm, prefs.sys, unit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm, prefs.sys]);
  const onChange = (t: string) => {
    setText(t);
    const v = parseLength(t, prefs.sys, unit);
    setBad(t.trim() !== '' && v === null);
    onMm(v);
  };
  const imperialHint = unit === 'ft' ? 'Feet and inches, e.g. 12′ 6″ or 12 6' : 'Inches, e.g. 6 1/2';
  return (
    <Field label={label} value={text} onChangeText={onChange} suffix={unit === 'ft' ? 'ft' : unit === 'in' ? 'in' : unit}
      keyboard={prefs.sys === 'imperial' ? 'numbers-and-punctuation' : 'decimal-pad'}
      hint={hint ?? (prefs.sys === 'imperial' ? imperialHint : undefined)} error={bad ? 'That isn’t a length Eaveline can read.' : null} testID={testID} />
  );
}

export function PitchField({ label = 'Pitch', deg, onDeg, testID }: { label?: string; deg: number | null; onDeg(d: number | null): void; testID?: string }) {
  const { prefs, ctx } = useApp();
  const [text, setText] = useState(() => (deg && deg > 0 ? pitchInputText(deg, prefs.pitchStyle) : ''));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    const parsed = parsePitch(text, prefs.pitchStyle);
    if (!deg) { if (parsed) setText(''); return; }
    if (parsed === null || Math.abs(parsed - deg) > 0.01) setText(pitchInputText(deg, prefs.pitchStyle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deg, prefs.pitchStyle]);
  const onChange = (t: string) => {
    setText(t);
    const v = parsePitch(t, prefs.pitchStyle);
    setBad(t.trim() !== '' && v === null);
    onDeg(v);
  };
  const other = deg ? (prefs.pitchStyle === 'x12' ? `${ctx.pitch(deg).replace(/:12$/, '')}:12 = ${deg.toFixed(1)}°` : `${deg.toFixed(1)}°`) : null;
  return (
    <Field label={label} value={text} onChangeText={onChange} suffix={prefs.pitchStyle === 'x12' ? ':12' : '°'} keyboard="numbers-and-punctuation"
      hint={prefs.pitchStyle === 'x12' ? `Rise per 12 of run, e.g. 6 (also 22.5° or 25%)${other ? ` · ${other}` : ''}` : 'Degrees, e.g. 22.5 (also 6:12 or 25%)'}
      error={bad ? 'Enter a pitch from 0° to 75°.' : null} testID={testID} />
  );
}

export function NumField({ label, value, onValue, suffix, hint, testID, min = 0, max = 1e9 }: { label: string; value: number | null; onValue(n: number | null): void; suffix?: string; hint?: string; testID?: string; min?: number; max?: number }) {
  const [text, setText] = useState(() => (value != null ? String(value) : ''));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    const n = Number(text.replace(',', '.'));
    if (value == null) return;
    if (!Number.isFinite(n) || Math.abs(n - value) > 1e-9) setText(String(Math.round(value * 1000) / 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Field label={label} value={text} suffix={suffix} hint={hint} testID={testID} error={bad ? `Enter a number from ${min} to ${max}.` : null}
      onChangeText={tx => {
        setText(tx);
        const n = Number(tx.replace(',', '.'));
        const okNum = tx.trim() !== '' && Number.isFinite(n) && n >= min && n <= max;
        setBad(tx.trim() !== '' && !okNum);
        onValue(okNum ? n : null);
      }} />
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: NoInfer<T>; label: string }[]; onChange(v: NoInfer<T>): void; label: string }) {
  const { theme, prefs } = useApp();
  return (
    <View style={{ gap: SPACE.xxs }}>
      <Txt v="subhead" tone="ink2">{label}</Txt>
      <View accessibilityRole="radiogroup" style={[st.seg, { backgroundColor: theme.sheet2, borderColor: theme.line }]}>
        {options.map(o => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
              onPress={() => { tap(prefs.haptics); onChange(o.value); }}
              style={[st.segItem, on && { backgroundColor: theme.ink }]}>
              <Text style={[TYPE.headline, { color: on ? theme.ground : theme.ink, textAlign: 'center' }]} maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export interface Choice { id: string; title: string; sub?: string; tag?: string }
/** A row that opens a full-height list to pick from (the local catalogue), with a custom entry. */
export function Picker({ label, value, choices, onPick, customLabel = 'Custom (enter my own)', testID }: {
  label: string; value: string | null; choices: Choice[]; onPick(id: string): void; customLabel?: string | null; testID?: string;
}) {
  const { theme } = useApp();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const all: Choice[] = customLabel ? [...choices, { id: 'custom', title: customLabel }] : choices;
  const current = all.find(c => c.id === value);
  return (
    <View style={{ gap: SPACE.xxs }}>
      <Txt v="subhead" tone="ink2">{label}</Txt>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${current?.title ?? 'choose'}`} accessibilityHint="Opens the list"
        onPress={() => setOpen(true)} style={({ pressed }) => [st.field, st.pickRow, { backgroundColor: theme.field, borderColor: theme.fieldLine, opacity: pressed ? 0.8 : 1 }]}>
        <View style={{ flex: 1, paddingVertical: SPACE.sm }}>
          <Txt v="headline">{current?.title ?? 'Choose…'}</Txt>
          {current?.sub ? <Txt v="footnote" tone="ink3">{current.sub}</Txt> : null}
        </View>
        <Ionicons name="chevron-down" size={22} color={theme.ink2} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.ground }}>
          <View style={[st.sheetHead, { borderColor: theme.line }]}>
            <Txt v="title2" style={{ flex: 1 }} accessibilityRole="header">{label}</Txt>
            <Btn label="Done" kind="plain" onPress={() => setOpen(false)} style={{ minWidth: 80 }} />
          </View>
          <FlatList
            data={all}
            keyExtractor={c => c.id}
            contentContainerStyle={{ padding: SPACE.gutter, paddingBottom: insets.bottom + SPACE.xl, gap: SPACE.xs }}
            renderItem={({ item }) => {
              const on = item.id === value;
              return (
                <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { onPick(item.id); setOpen(false); }}
                  style={({ pressed }) => [st.choice, { backgroundColor: theme.sheet, borderColor: on ? theme.ink : theme.line, borderWidth: on ? 2 : 1, opacity: pressed ? 0.85 : 1 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt v="headline">{item.title}</Txt>
                    {item.sub ? <Txt v="footnote" tone="ink2">{item.sub}</Txt> : null}
                    {item.tag ? <Txt v="footnote" tone="ink3">{item.tag}</Txt> : null}
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={26} color={theme.ink} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

/** The hi-vis answer panel. */
export function Answer({ label, value, lines = [], testID }: { label: string; value: string; lines?: string[]; testID?: string }) {
  const { theme } = useApp();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${value}. ${lines.join('. ')}`} style={[st.answer, { backgroundColor: theme.accent }]}>
      <Text style={[TYPE.label, { color: theme.onAccent }]}>{label}</Text>
      <Text style={[TYPE.hero, { color: theme.onAccent, fontVariant: ['tabular-nums'] }]} adjustsFontSizeToFit numberOfLines={2} maxFontSizeMultiplier={1.3}>{value}</Text>
      {lines.map(l => <Text key={l} style={[TYPE.headline, { color: theme.onAccent }]} maxFontSizeMultiplier={1.6}>{l}</Text>)}
    </View>
  );
}

/** Secondary figures in a tidy two-column list. */
export function Figures({ rows }: { rows: [string, string][] }) {
  const { theme } = useApp();
  return (
    <Card style={{ paddingVertical: SPACE.xs }}>
      {rows.map(([k, v], i) => (
        <View key={`${k}-${i}`} style={[st.fig, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.line }]}>
          <Txt v="callout" tone="ink2" style={{ flex: 1 }}>{k}</Txt>
          <Txt v="headline" style={{ textAlign: 'right', flexShrink: 1, fontVariant: ['tabular-nums'] }}>{v}</Txt>
        </View>
      ))}
    </Card>
  );
}

/** "How it's worked out": every step with its formula. */
export function Steps({ steps, notes = [] }: { steps: Step[]; notes?: string[] }) {
  const { theme } = useApp();
  const [open, setOpen] = useState(true);
  return (
    <Card style={{ paddingVertical: 0 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(o => !o)} style={st.stepsHead}>
        <Ionicons name="calculator-outline" size={22} color={theme.ink} />
        <Txt v="headline" style={{ flex: 1 }}>How it’s worked out</Txt>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.ink2} />
      </Pressable>
      {open ? (
        <View style={{ paddingBottom: SPACE.sm }}>
          {steps.map((s, i) => (
            <View key={`${s.label}-${i}`} style={[st.step, { borderTopColor: theme.line }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="subhead">{s.label}</Txt>
                {s.formula ? <Txt v="footnote" tone="ink3">{s.formula}</Txt> : null}
              </View>
              <Txt v="headline" style={{ textAlign: 'right', maxWidth: '50%', fontVariant: ['tabular-nums'] }}>{s.value}</Txt>
            </View>
          ))}
          {notes.map(n => (
            <View key={n} style={[st.note, { borderTopColor: theme.line }]}>
              <Ionicons name="information-circle-outline" size={18} color={theme.ink2} style={{ marginTop: 2 }} />
              <Txt v="footnote" tone="ink2" style={{ flex: 1 }}>{n}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function Notice({ text, icon = 'alert-circle-outline', tone = 'ink2' }: { text: string; icon?: keyof typeof Ionicons.glyphMap; tone?: Tone }) {
  const { theme } = useApp();
  return (
    <View style={[st.notice, { borderColor: theme.line, backgroundColor: theme.sheet2 }]}>
      <Ionicons name={icon} size={20} color={theme[tone]} style={{ marginTop: 1 }} />
      <Txt v="subhead" tone={tone} style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

export function ErrorLine({ text }: { text: string }) {
  return <Notice text={text} icon="create-outline" tone="ink2" />;
}

export function Row({ title, sub, icon, onPress, right, testID, danger }: { title: string; sub?: string; icon?: keyof typeof Ionicons.glyphMap; onPress?(): void; right?: ReactNode; testID?: string; danger?: boolean }) {
  const { theme } = useApp();
  return (
    <Pressable testID={testID} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [st.row, { opacity: pressed ? 0.7 : 1 }]}>
      {icon ? <Ionicons name={icon} size={24} color={danger ? theme.danger : theme.ink} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="headline" tone={danger ? 'danger' : 'ink'}>{title}</Txt>
        {sub ? <Txt v="footnote" tone="ink3">{sub}</Txt> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={theme.ink3} /> : null)}
    </Pressable>
  );
}

export const Divider = () => {
  const { theme } = useApp();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line, marginLeft: SPACE.md }} />;
};

export const themed = (theme: Theme) => ({ color: theme.ink });

const st = StyleSheet.create({
  card: { borderRadius: RADIUS.m, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.xxs, marginTop: SPACE.xs },
  btn: { minHeight: TOUCH.big, borderRadius: RADIUS.m, paddingHorizontal: SPACE.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, borderWidth: 2 },
  field: { minHeight: TOUCH.big, borderRadius: RADIUS.s, paddingHorizontal: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  pickRow: { borderWidth: 1.5 },
  seg: { flexDirection: 'row', borderRadius: RADIUS.m, borderWidth: StyleSheet.hairlineWidth, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: TOUCH.min, borderRadius: RADIUS.s, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xs },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  choice: { borderRadius: RADIUS.m, padding: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: TOUCH.big },
  answer: { borderRadius: RADIUS.l, padding: SPACE.lg, gap: SPACE.xxs },
  fig: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 44, paddingVertical: SPACE.xs },
  stepsHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: TOUCH.big },
  step: { flexDirection: 'row', gap: SPACE.sm, paddingVertical: SPACE.xs + 2, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  note: { flexDirection: 'row', gap: SPACE.xs, paddingVertical: SPACE.xs, borderTopWidth: StyleSheet.hairlineWidth },
  notice: { flexDirection: 'row', gap: SPACE.sm, padding: SPACE.md, borderRadius: RADIUS.m, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: TOUCH.big, paddingVertical: SPACE.xs },
});
