/**
 * Groutline's controls. Built for site use: 56 pt targets, type that follows Dynamic Type, one accent colour carrying
 * dark ink, answers in large condensed numerals, SF Symbols, and press feedback you can feel through gloves.
 *
 * Motion (animate-expo gate): press scale 0.97 / 120 ms ease-out (tens a day, feedback); segmented selection:
 * instant colour + selection haptic (state indication); "How it's worked out" fades in 200 ms (explanation). Reduce Motion
 * drops the scale and the fade. Nothing animates on every keystroke.
 */
import * as Haptics from 'expo-haptics';
import { Children, useState, type ReactNode } from 'react';
import {
  Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View,
  type KeyboardTypeOptions, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Step } from '../core/steps.ts';
import { FONT, RADIUS, SPACE, TAP, useTheme } from '../theme/theme.ts';
import { Icon, type IconName } from './Icon.tsx';

/** Shared keyboard toolbar id (ToolScreen renders the InputAccessoryView with the live answer and Done). */
export const KB_ACCESSORY = 'groutline-kb';

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

/** The answer, in big condensed numerals; shrinks to stay on one line (8,108,497 tiles at 375 pt). */
export function Num({ value, unit, size = 64, tone = 'ink' }: { value: string; unit?: string; size?: number; tone?: Tone }) {
  const t = useTheme();
  return (
    <Text accessibilityLabel={unit ? `${value} ${unit}` : value} maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4} style={{ color: t[tone] }}>
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

/** Grouped-list section header (iOS style). */
export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ marginTop: SPACE.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.xs, paddingHorizontal: SPACE.xxs }}>
        <Txt v="footnote" tone="ink2" accessibilityRole="header" style={{ fontWeight: '600' }}>{title}</Txt>
        {right}
      </View>
      {children}
    </View>
  );
}

let hapticsOn = true;
/** Set from the user's Haptics setting (AppState). */
export const setHapticsEnabled = (on: boolean) => { hapticsOn = on; };

export function haptic(on = true, kind: 'light' | 'success' | 'select' = 'light') {
  if (!on || !hapticsOn) return;
  const p = kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : kind === 'select' ? Haptics.selectionAsync() : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  void p.catch(() => undefined);
}

/** A pressable that scales to 0.97 on press-in (feedback on touch, commit on release), on the UI thread. */
export function PressScale({ children, style, disabled, onPress, onLongPress, ...a11y }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean; onPress?(): void; onLongPress?(): void;
} & Pick<React.ComponentProps<typeof Pressable>, 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState' | 'hitSlop'>) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const to = (v: number) => { if (!reduced) scale.set(withTiming(v, { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) })); };
  return (
    <Pressable {...a11y} disabled={disabled} onPress={onPress} onLongPress={onLongPress} pressRetentionOffset={16}
      onPressIn={() => to(0.97)} onPressOut={() => to(1)}>
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Btn({ label, onPress, kind = 'primary', icon, disabled, style, accessibilityHint }: {
  label: string; onPress(): void; kind?: 'primary' | 'ink' | 'plain' | 'text' | 'danger'; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityHint?: string;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'ink' ? t.ink : 'transparent';
  const fg = kind === 'primary' ? t.onAccent : kind === 'ink' ? t.ground : kind === 'danger' ? t.bad : t.ink;
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={[st.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1, borderWidth: kind === 'plain' ? 1.5 : 0, borderColor: t.line, minHeight: kind === 'text' ? 48 : TAP }, style]}>
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={[SIZES.headline, { color: fg, fontSize: 18, textDecorationLine: kind === 'text' ? 'underline' : 'none' }]} maxFontSizeMultiplier={1.6}>{label}</Text>
    </PressScale>
  );
}

const SPOKEN: Record<string, string> = { mm: 'millimetres', in: 'inches', 'ft-in': 'feet and inches', 'm²': 'square metres', 'sq ft': 'square feet', '%': 'percent', kg: 'kilograms', lb: 'pounds', L: 'litres', gal: 'gallons' };

/**
 * A number field sized for gloves. Imperial needs ' " and / so it gets the punctuation keyboard. The iOS number
 * pads have no return key, so every field carries the shared keyboard toolbar (live answer + Done).
 * Placeholders show defaults in regular weight so they never read as typed values.
 */
export function Field({ label, value, onChangeText, unit, placeholder, error, keyboard, hint, flex, accessibilityLabel }: {
  label: string; value: string; onChangeText(v: string): void; unit?: string; placeholder?: string; error?: string | null; keyboard?: KeyboardTypeOptions; hint?: string; flex?: number; accessibilityLabel?: string;
}) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  const empty = value === '';
  return (
    <View style={flex ? { flex, minWidth: 0 } : undefined}>
      <Txt v="footnote" tone="ink2" style={{ marginBottom: 4, fontWeight: '600' }}>{label}</Txt>
      <View style={[st.field, { backgroundColor: t.sheet, borderColor: error ? t.bad : focus ? t.accent : t.line, borderWidth: focus || error ? 2 : 1 }]}>
        <TextInput
          value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.ink3}
          keyboardType={keyboard ?? 'decimal-pad'} returnKeyType="done" selectTextOnFocus
          inputAccessoryViewID={Platform.OS === 'ios' ? KB_ACCESSORY : undefined}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          accessibilityLabel={accessibilityLabel ?? (unit ? `${label}, in ${SPOKEN[unit] ?? unit}` : label)}
          style={[st.input, { color: t.ink, fontWeight: empty ? '400' : '700' }]} maxFontSizeMultiplier={1.6}
        />
        {unit ? <Txt v="subhead" tone="ink2" style={{ marginLeft: 4 }}>{unit}</Txt> : null}
      </View>
      {error ? <Txt v="footnote" tone="bad" style={{ marginTop: 4 }}>{error}</Txt> : hint ? <Txt v="footnote" tone="ink3" style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

/** Side-by-side items that share the width; they stack one per line at large text sizes. */
export function Row({ children, gap = SPACE.sm }: { children: ReactNode; gap?: number }) {
  const { fontScale } = useWindowDimensions();
  const stack = fontScale > 1.3;
  return (
    <View style={{ flexDirection: stack ? 'column' : 'row', flexWrap: 'wrap', gap }}>
      {Children.map(children, c => (c ? <View style={stack ? undefined : { flexGrow: 1, flexBasis: 0, minWidth: 120 }}>{c}</View> : null))}
    </View>
  );
}

/**
 * Equal-width segmented choice on one track (up to 3 options) or a grid of equal cells (3 per row). 56 pt tall for
 * gloves rather than the 32 pt system control.
 */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ id: T; label: string }>; value: T; onChange(v: T): void; label: string }) {
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  const perRow = fontScale > 1.3 ? 2 : 3;
  const rows: Array<typeof options> = [];
  for (let i = 0; i < options.length; i += perRow) rows.push(options.slice(i, i + perRow));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[st.track, { backgroundColor: t.sunk }]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 4 }}>
          {row.map(o => {
            const on = o.id === value;
            return (
              <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
                onPress={() => { if (!on) { haptic(true, 'select'); onChange(o.id); } }} style={{ flex: 1 }}>
                <View style={[st.segment, { backgroundColor: on ? t.ink : 'transparent' }]}>
                  <Text numberOfLines={2} style={[SIZES.headline, { color: on ? t.ground : t.ink, textAlign: 'center', fontSize: 16 }]} maxFontSizeMultiplier={1.5}>{o.label}</Text>
                </View>
              </Pressable>
            );
          })}
          {row.length < perRow && rows.length > 1 ? Array.from({ length: perRow - row.length }, (_, k) => <View key={`pad${k}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
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
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.line }} accessibilityElementsHidden importantForAccessibility="no" />
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
      <PressScale accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityHint="Opens the list" onPress={() => setOpen(true)}
        style={[st.picker, { backgroundColor: t.sheet }]}>
        <View style={{ flex: 1 }}>
          <Txt v="footnote" tone="ink2" style={{ fontWeight: '600' }}>{label}</Txt>
          <Txt v="headline" style={{ fontSize: 18 }}>{value}</Txt>
          {sub ? <Txt v="footnote" tone="ink3">{sub}</Txt> : null}
        </View>
        <Icon name="chevronDown" size={18} color={t.ink2} />
      </PressScale>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: t.ground }}>
          <View style={[st.sheetHead, { borderBottomColor: t.line }]}>
            <Txt v="title2" accessibilityRole="header" style={{ flex: 1 }}>{label}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACE.xs }}>
              <Txt v="headline" style={{ color: t.dark ? t.accent : t.ink }}>Done</Txt>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACE.md, paddingBottom: insets.bottom + SPACE.xl }}>
            <View style={{ backgroundColor: t.sheet, borderRadius: RADIUS.card, overflow: 'hidden' }}>
              {[{ id: '__custom', title: customLabel } as PickOption, ...options].map((o, i, all) => {
                const on = o.id === '__custom' ? selected === null : o.id === selected;
                return (
                  <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={o.sub ? `${o.title}, ${o.sub}` : o.title}
                    onPress={() => { haptic(true, 'select'); onSelect(o.id === '__custom' ? null : o.id); setOpen(false); }}
                    style={({ pressed }) => [st.option, { backgroundColor: pressed ? t.sunk : 'transparent', borderBottomWidth: i < all.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: t.line }]}>
                    <View style={{ flex: 1 }}>
                      <Txt v="headline">{o.title}</Txt>
                      {o.sub ? <Txt v="footnote" tone="ink2">{o.sub}</Txt> : null}
                    </View>
                    {on ? <Icon name="check" size={20} color={t.dark ? t.accent : t.ink} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/** "How it's worked out": every line of the sum, numbered, so the tiler can check it on site. */
export function Steps({ steps, initiallyOpen = false }: { steps: Step[]; initiallyOpen?: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ marginTop: SPACE.md }}>
      <PressScale accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="How it's worked out" onPress={() => setOpen(!open)}
        style={[st.stepsHead, { backgroundColor: t.sunk }]}>
        <Icon name="working" size={18} color={t.ink} />
        <Txt v="headline" style={{ flex: 1 }}>How it's worked out</Txt>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={t.ink2} />
      </PressScale>
      {open ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(200)} style={{ marginTop: SPACE.sm, gap: SPACE.sm }}>
          {steps.map((s, i) => (
            <View key={`${s.label}-${i}`} style={{ flexDirection: 'row', gap: SPACE.sm }} accessible accessibilityLabel={`Step ${i + 1}, ${s.label}. ${s.working}. Equals ${s.result}`}>
              <View style={[st.stepNo, { backgroundColor: t.accent }]}>
                <Text style={{ fontFamily: FONT.numBold, fontSize: 15, color: t.onAccent }} maxFontSizeMultiplier={1.3}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, paddingBottom: SPACE.xs, borderBottomWidth: i < steps.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: t.line }}>
                <Txt v="footnote" tone="ink2" style={{ fontWeight: '700' }}>{s.label}</Txt>
                <Txt v="callout" style={{ fontVariant: ['tabular-nums'] }}>{s.working}</Txt>
                <Text style={{ fontFamily: FONT.numSemi, fontSize: 22, color: t.ink, marginTop: 2 }} maxFontSizeMultiplier={1.5}>{`= ${s.result}`}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
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
          <View style={{ marginTop: 2 }}><Icon name={tone === 'warn' ? 'warn' : 'info'} size={16} color={tone === 'warn' ? t.warn : t.ink3} /></View>
          <Txt v="subhead" tone={tone} style={{ flex: 1 }}>{n}</Txt>
        </View>
      ))}
    </View>
  );
}

export function Problems({ problems }: { problems: Array<{ message: string }> }) {
  const t = useTheme();
  return (
    <Card tone="sunk">
      <View style={{ flexDirection: 'row', gap: SPACE.xs, alignItems: 'center', marginBottom: 4 }}>
        <Icon name="edit" size={18} color={t.ink2} />
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

const st = StyleSheet.create({
  btn: { borderRadius: RADIUS.field, paddingHorizontal: SPACE.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
  field: { minHeight: TAP, borderRadius: RADIUS.field, paddingHorizontal: SPACE.sm, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, fontSize: 22, paddingVertical: 10, fontVariant: ['tabular-nums'] },
  track: { borderRadius: RADIUS.field, padding: 4, gap: 4 },
  segment: { minHeight: 48, borderRadius: RADIUS.field - 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xs },
  toggle: { minHeight: TAP, borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center' },
  picker: { minHeight: 64, borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.md, paddingTop: SPACE.lg, paddingBottom: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  option: { minHeight: TAP, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center' },
  stepsHead: { minHeight: TAP, borderRadius: RADIUS.field, paddingHorizontal: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  stepNo: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
});
