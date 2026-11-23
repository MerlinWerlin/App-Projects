/**
 * Wattle UI kit: big, glove-friendly controls (≥ 56 pt), heavy numbers, high contrast in every theme.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tap } from '../native/haptics.ts';
import { useApp } from '../state/AppState.tsx';
import { PHASE, RADIUS, SPACE, TARGET, TYPE } from '../theme/theme.ts';

export const DISCLAIMER = 'Estimate for licensed electricians. Check against AS/NZS 3000 and 3008, the manufacturer’s data and the job’s design.';

type Tone = 'ink' | 'ink2' | 'accent' | 'pass' | 'fail' | 'warn' | 'onAccent';

/** Largest Dynamic Type scale per style: answers and labels stay on screen at the biggest accessibility sizes. */
const MAX_SCALE: Partial<Record<keyof typeof TYPE, number>> = { label: 1.4, footnote: 1.6, subhead: 1.6, answer: 1.3, answerSm: 1.4, largeTitle: 1.5 };

export function Txt({ v = 'body', tone = 'ink', style, children, ...rest }: { v?: keyof typeof TYPE; tone?: Tone; style?: StyleProp<TextStyle>; children: ReactNode; accessibilityRole?: 'header' | 'text'; numberOfLines?: number; maxFontSizeMultiplier?: number; selectable?: boolean }) {
  const { theme } = useApp();
  const color = tone === 'accent' ? theme.accentText : theme[tone];
  return <Text style={[TYPE[v], { color }, style]} maxFontSizeMultiplier={MAX_SCALE[v] ?? 2} {...rest}>{children}</Text>;
}

/** Scrolling screen with a large title, safe areas and room above the tab bar. */
export function Screen({ title, sub, right, children, pushed }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; /** Under a navigation bar: no top safe-area padding. */ pushed?: boolean }) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.ground }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.ground }}
      contentContainerStyle={{ paddingTop: pushed ? SPACE.xs : insets.top + SPACE.sm, paddingBottom: SPACE.xxl, paddingHorizontal: SPACE.md, gap: SPACE.md }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={st.titleRow}>
        <View style={{ flex: 1 }}>
          <Stripe />
          <Txt v="largeTitle" accessibilityRole="header" maxFontSizeMultiplier={1.4}>{title}</Txt>
          {sub ? <Txt v="subhead" tone="ink2" maxFontSizeMultiplier={1.3}>{sub}</Txt> : null}
        </View>
        {right}
      </View>
      {children}
    </ScrollView>
    {/* Content scrolls under the status bar otherwise: keep a solid strip behind it. */}
    {!pushed ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: theme.ground }} /> : null}
    </View>
  );
}

/** Active / neutral / earth stripe: the Wattle brand mark on every screen. */
export function Stripe({ width = 54 }: { width?: number }) {
  return (
    <View style={[st.stripe, { width }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[st.stripeSeg, { backgroundColor: PHASE.active }]} />
      <View style={[st.stripeSeg, { backgroundColor: PHASE.neutral }]} />
      <View style={[st.stripeSeg, { backgroundColor: PHASE.earth, borderRightWidth: 6, borderRightColor: PHASE.earthStripe }]} />
    </View>
  );
}

export function Card({ children, style, pad = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean }) {
  const { theme } = useApp();
  return <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.line, borderWidth: theme.rule }, pad && { padding: SPACE.md }, style]}>{children}</View>;
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { theme, prefs } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.xs }} accessibilityLabel={label} style={{ flexGrow: 0 }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => { if (!on) { tap(prefs.haptics); onChange(o.id); } }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [st.chip, { backgroundColor: on ? theme.accent : theme.card, borderColor: on ? theme.accent : theme.line, borderWidth: theme.rule, opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={[TYPE.headline, { color: on ? theme.onAccent : theme.ink }]} maxFontSizeMultiplier={1.5}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Two-way switch that fills the width (phase, method, metal). */
export function Toggle<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { theme, prefs } = useApp();
  return (
    <View style={[st.toggle, { backgroundColor: theme.card2, borderColor: theme.line, borderWidth: theme.rule }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => { if (!on) { tap(prefs.haptics); onChange(o.id); } }} accessibilityRole="radio" accessibilityState={{ checked: on }}
            style={[st.toggleBtn, on && { backgroundColor: theme.accent }]}>
            <Text style={[TYPE.headline, { color: on ? theme.onAccent : theme.ink, textAlign: 'center' }]} maxFontSizeMultiplier={1.4}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NumField({ label, value, onChange, unit, hint, placeholder, integer, optional }: { label: string; value: string; onChange: (s: string) => void; unit?: string; hint?: string; placeholder?: string; integer?: boolean; optional?: boolean }) {
  const { theme } = useApp();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: SPACE.xxs, flex: 1, minWidth: 140 }}>
      <Txt v="label" tone="ink2" maxFontSizeMultiplier={1.4}>{label}{optional ? '  ·  optional' : ''}</Txt>
      <View style={[st.field, { backgroundColor: theme.field, borderColor: focus ? theme.accent : theme.line, borderWidth: focus ? 2 : theme.rule }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          inputMode={integer ? 'numeric' : 'decimal'}
          returnKeyType="done"
          placeholder={placeholder ?? '0'}
          placeholderTextColor={theme.dark ? '#5C616B' : '#8A8F98'}
          selectionColor={theme.accent}
          accessibilityLabel={`${label}${unit ? `, ${unit}` : ''}`}
          accessibilityHint={hint}
          maxFontSizeMultiplier={1.5}
          style={[TYPE.input, st.input, { color: theme.ink }]}
        />
        {unit ? <Text style={[TYPE.headline, { color: theme.ink2 }]} maxFontSizeMultiplier={1.4}>{unit}</Text> : null}
      </View>
      {hint ? <Txt v="footnote" tone="ink2">{hint}</Txt> : null}
    </View>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={st.fieldRow}>{children}</View>;
}

/** Quick-pick values under a field (angles, sizes). */
export function Picks({ values, onPick, current, suffix = '' }: { values: readonly (number | string)[]; onPick: (v: string) => void; current: string; suffix?: string }) {
  const { theme, prefs } = useApp();
  return (
    <View style={st.picks}>
      {values.map(v => {
        const on = String(v) === current;
        return (
          <Pressable key={String(v)} onPress={() => { tap(prefs.haptics); onPick(String(v)); }} accessibilityRole="button" accessibilityLabel={`${v}${suffix}`} accessibilityState={{ selected: on }}
            style={({ pressed }) => [st.pick, { backgroundColor: on ? theme.ink : theme.card2, borderColor: theme.line, borderWidth: theme.rule, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[TYPE.headline, { color: on ? theme.ground : theme.ink }]} maxFontSizeMultiplier={1.4}>{v}{suffix}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Btn({ title, onPress, kind = 'primary', icon, disabled, style, label }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; style?: StyleProp<ViewStyle>; label?: string }) {
  const { theme } = useApp();
  const bg = kind === 'primary' ? theme.accent : kind === 'secondary' ? theme.card2 : 'transparent';
  const fg = kind === 'primary' ? theme.onAccent : kind === 'danger' ? theme.fail : kind === 'quiet' ? theme.accentText : theme.ink;
  return (
    <Pressable
      onPress={() => { if (!disabled) onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [st.btn, { backgroundColor: bg, borderColor: kind === 'secondary' ? theme.line : 'transparent', borderWidth: kind === 'secondary' ? theme.rule : 0, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
      <Text style={[TYPE.headline, { color: fg }]} maxFontSizeMultiplier={1.5}>{title}</Text>
    </Pressable>
  );
}

export function IconBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => [st.iconBtn, { backgroundColor: theme.card, borderColor: theme.line, borderWidth: theme.rule, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={24} color={theme.ink} />
    </Pressable>
  );
}

export function Row({ title, sub, icon, onPress, right, last }: { title: string; sub?: string; icon?: keyof typeof Ionicons.glyphMap; onPress?: () => void; right?: ReactNode; last?: boolean }) {
  const { theme } = useApp();
  const body = (
    <View style={[st.row, !last && { borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth * (theme.rule > 1 ? 3 : 1) }]}>
      {icon ? <View style={[st.rowIcon, { backgroundColor: theme.card2 }]}><Ionicons name={icon} size={22} color={theme.accentText} /></View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="headline">{title}</Txt>
        {sub ? <Txt v="footnote" tone="ink2">{sub}</Txt> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={theme.ink2} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={sub ? `${title}. ${sub}` : title} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{body}</Pressable> : body;
}

export interface Answer { label: string; value: string; big?: boolean }

/**
 * The result: big answer(s), pass/fail, warnings, the working, the disclaimer and Save to job.
 * `error` shows a plain-language reason instead when the inputs aren't usable yet.
 */
export function Result({ answers, status, statusText, warnings = [], steps = [], error, onSave, children }: { answers?: Answer[]; status?: 'pass' | 'fail'; statusText?: string; warnings?: string[]; steps?: string[]; error?: string | null; onSave?: () => void; children?: ReactNode }) {
  const { theme } = useApp();
  const [open, setOpen] = useState(false);
  if (error) {
    return (
      <Card style={{ flexDirection: 'row', gap: SPACE.sm, alignItems: 'center' }}>
        <Ionicons name="information-circle-outline" size={26} color={theme.ink2} />
        <Txt v="callout" tone="ink2" style={{ flex: 1 }}>{error}</Txt>
      </Card>
    );
  }
  const [hero, ...rest] = answers ?? [];
  return (
    <Card pad={false} style={{ overflow: 'hidden' }}>
      <View style={{ padding: SPACE.md, gap: SPACE.sm }} accessible accessibilityLabel={[...(answers ?? []).map(a => `${a.label} ${a.value}`), statusText].filter(Boolean).join('. ')}>
        {status ? (
          <View style={[st.badge, { backgroundColor: status === 'pass' ? theme.pass : theme.fail }]}>
            <Ionicons name={status === 'pass' ? 'checkmark-circle' : 'close-circle'} size={20} color={theme.dark ? '#0E0F12' : '#FFFFFF'} />
            <Text style={[TYPE.headline, { color: theme.dark ? '#0E0F12' : '#FFFFFF' }]} maxFontSizeMultiplier={1.4}>{statusText}</Text>
          </View>
        ) : null}
        {hero ? (
          <View>
            <Txt v="label" tone="ink2">{hero.label}</Txt>
            <Txt v="answer" maxFontSizeMultiplier={1.3} selectable>{hero.value}</Txt>
          </View>
        ) : null}
        {rest.length ? (
          <View style={st.answerGrid}>
            {rest.map(a => (
              <View key={a.label} style={[st.answerCell, { borderColor: theme.line, borderWidth: theme.rule, backgroundColor: theme.card2 }]}>
                <Txt v="label" tone="ink2" maxFontSizeMultiplier={1.3}>{a.label}</Txt>
                <Txt v="answerSm" maxFontSizeMultiplier={1.3} selectable>{a.value}</Txt>
              </View>
            ))}
          </View>
        ) : null}
        {children}
        {warnings.map(w => (
          <View key={w} style={st.warn}>
            <Ionicons name="warning" size={20} color={theme.warn} />
            <Txt v="subhead" tone="warn" style={{ flex: 1, fontWeight: '600' }}>{w}</Txt>
          </View>
        ))}
      </View>
      {steps.length ? (
        <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? 'Hide the working' : 'Show the working'}
          style={[st.stepsHead, { borderTopColor: theme.line, borderTopWidth: theme.rule }]}>
          <Ionicons name="calculator-outline" size={20} color={theme.accentText} />
          <Txt v="headline" tone="accent" style={{ flex: 1 }}>{open ? 'Hide the working' : 'Show the working'}</Txt>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.ink2} />
        </Pressable>
      ) : null}
      {open ? (
        <View style={{ paddingHorizontal: SPACE.md, paddingBottom: SPACE.md, gap: SPACE.xs }}>
          {steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: SPACE.xs }}>
              <Txt v="footnote" tone="accent" style={{ fontWeight: '800', width: 18 }}>{i + 1}</Txt>
              <Txt v="subhead" style={{ flex: 1, fontVariant: ['tabular-nums'] }} selectable>{s}</Txt>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[st.foot, { backgroundColor: theme.card2, borderTopColor: theme.line, borderTopWidth: theme.rule }]}>
        <Txt v="footnote" tone="ink2" style={{ flex: 1 }}>{DISCLAIMER}</Txt>
        {onSave ? <Btn title="Save" icon="bookmark-outline" kind="secondary" onPress={onSave} style={{ minHeight: 48, paddingHorizontal: SPACE.md }} label="Save to a job" /> : null}
      </View>
    </Card>
  );
}

/** Shown instead of a paid calculator when there's no unlock or trial. */
export function Locked({ what }: { what: string }) {
  const { theme, trial } = useApp();
  const router = useRouter();
  return (
    <Card style={{ gap: SPACE.sm, alignItems: 'flex-start' }}>
      <View style={[st.rowIcon, { backgroundColor: theme.accent }]}><Ionicons name="lock-closed" size={22} color={theme.onAccent} /></View>
      <Txt v="title">{what} is part of the Full Unlock</Txt>
      <Txt v="callout" tone="ink2">
        {trial.started ? 'Your free trial has ended. One payment unlocks every calculator for good. No subscription.' : 'Try every calculator free for 7 days, then one payment unlocks them for good. No subscription.'}
      </Txt>
      <Btn title={trial.started ? 'See the Full Unlock' : 'Start the free trial'} icon="flash" onPress={() => router.push('/unlock')} style={{ alignSelf: 'stretch' }} />
      <Txt v="footnote" tone="ink2">Offsets, Ohm’s law, power and the unit converter stay free.</Txt>
    </Card>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Txt v="label" tone="ink2" style={{ marginTop: SPACE.xs }} accessibilityRole="header">{children}</Txt>;
}

const st = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.sm, marginBottom: SPACE.xxs },
  stripe: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: SPACE.xs },
  stripeSeg: { flex: 1 },
  card: { borderRadius: RADIUS.lg },
  chip: { minHeight: 48, paddingHorizontal: SPACE.md, borderRadius: RADIUS.pill, justifyContent: 'center' },
  toggle: { flexDirection: 'row', borderRadius: RADIUS.md, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, minHeight: TARGET - 8, borderRadius: RADIUS.sm, justifyContent: 'center', paddingHorizontal: SPACE.xs },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 64, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, gap: SPACE.xs },
  input: { flex: 1, paddingVertical: SPACE.sm, minWidth: 0 },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  pick: { minHeight: 48, minWidth: 56, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: TARGET, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.lg },
  iconBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: TARGET + 8, paddingVertical: SPACE.sm },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: SPACE.sm, paddingVertical: 6 },
  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  answerCell: { flexGrow: 1, flexBasis: '45%', borderRadius: RADIUS.md, padding: SPACE.sm, gap: 2 },
  warn: { flexDirection: 'row', gap: SPACE.xs, alignItems: 'flex-start' },
  stepsHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, minHeight: TARGET, paddingHorizontal: SPACE.md },
  foot: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.md },
});
