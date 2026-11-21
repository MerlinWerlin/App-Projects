/**
 * Shared UI kit ("Signal", see apps/cue/DESIGN.md). Wayfinding grammar: yellow sign fills only for the next
 * place your eyes or thumb should go; black and white for everything else. 44 pt targets and VoiceOver
 * labels everywhere.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutUp } from 'react-native-reanimated';
import { tap } from '../native/haptics';
import { useApp } from '../state/AppState';
import { MOTION, RADIUS, SIGN, SIGN_INK, SPACE, TYPE } from '../theme/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Tone = 'ink' | 'ink2' | 'ink3' | 'sign' | 'onSign' | 'danger';

/** Text in the app's type scale and colours. */
export function Txt({
  v = 'body',
  tone = 'ink',
  style,
  children,
  lines,
  max,
  ...rest
}: {
  v?: keyof typeof TYPE;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  lines?: number;
  /** Dynamic Type ceiling for dense chrome (bars, columns). Body copy leaves it unset. */
  max?: number;
  accessibilityRole?: 'header' | 'text';
  accessibilityLiveRegion?: 'polite' | 'assertive' | 'none';
}) {
  const { theme } = useApp();
  const color = { ink: theme.ink, ink2: theme.ink2, ink3: theme.ink3, sign: theme.signText, onSign: theme.onSign, danger: theme.danger }[tone];
  return (
    <Text style={[TYPE[v], { color }, style]} numberOfLines={lines} maxFontSizeMultiplier={max} {...rest}>
      {children}
    </Text>
  );
}

/** The system bar material (real blur on iOS, solid on Android). Used behind floating bars only. */
export function Bar({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: 'light' | 'dark' }) {
  const { theme } = useApp();
  const t = tint ?? theme.material;
  if (Platform.OS === 'android') {
    return <View style={[{ backgroundColor: t === 'dark' ? 'rgba(14,14,14,0.97)' : 'rgba(240,240,236,0.97)', overflow: 'hidden' }, style]}>{children}</View>;
  }
  return (
    <BlurView tint={t === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} intensity={80} style={[{ overflow: 'hidden' }, style]}>
      {children}
    </BlurView>
  );
}

/** Press feedback shared by every custom pressable: a small scale (dropped under Reduce Motion) and a dim. */
export function usePressStyle() {
  const { reduceMotion } = useApp();
  return (pressed: boolean): ViewStyle => ({ opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed && !reduceMotion ? MOTION.press : 1 }] });
}

type BtnKind = 'sign' | 'ink' | 'plain' | 'onSign';

/**
 * Buttons. sign: yellow, the one forward action on a screen. ink: solid black/white for strong secondary
 * actions. plain: field fill. onSign: a black button that sits on a yellow band.
 */
export function Btn({
  label,
  onPress,
  kind = 'sign',
  icon,
  iconColor,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: BtnKind;
  icon?: IconName;
  /** Glyph colour when it differs from the label (the red record dot). */
  iconColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, prefs } = useApp();
  const press = usePressStyle();
  const bg = { sign: theme.sign, ink: theme.inkFill, plain: theme.field, onSign: SIGN_INK }[kind];
  const fg = { sign: theme.onSign, ink: theme.onInkFill, plain: theme.ink, onSign: SIGN }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap(prefs.haptics);
        onPress();
      }}
      style={({ pressed }) => [s.btn, { backgroundColor: bg }, press(pressed), disabled && { opacity: 0.4 }, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={iconColor ?? fg} /> : null}
      <Text style={[TYPE.headline, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IconBtn({
  icon,
  label,
  onPress,
  color,
  size = 22,
  active,
  activeFill,
  activeInk,
  bg,
  square,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  /** A toggled-on state (mirror, flip): drawn as a filled square. */
  active?: boolean;
  activeFill?: string;
  activeInk?: string;
  bg?: string;
  /** Signage square instead of a circle. */
  square?: boolean;
}) {
  const { theme, prefs } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      hitSlop={6}
      onPress={() => {
        tap(prefs.haptics);
        onPress();
      }}
      style={({ pressed }) => [s.icon, square && { borderRadius: RADIUS.control }, { backgroundColor: active ? (activeFill ?? theme.sign) : (bg ?? 'transparent'), opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={active ? (activeInk ?? theme.onSign) : (color ?? theme.ink)} />
    </Pressable>
  );
}

/**
 * Digits that flip like a departures board when the value changes: each character sits in its own cell,
 * the old one leaves upward and the new one arrives from below. Instant under Reduce Motion.
 * Layout animations arm only once the screen has settled, so nothing animates during the push that
 * mounts it (an early layout animation there left the editor's text view scrolled).
 */
export function FlapText({ value, style, max = 1.3, label }: { value: string; style: StyleProp<TextStyle>; max?: number; label?: string }) {
  const { reduceMotion } = useApp();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArmed(true), 700);
    return () => clearTimeout(id);
  }, []);
  const animate = armed && !reduceMotion;
  const flat = StyleSheet.flatten(style) ?? {};
  const h = (flat.lineHeight ?? flat.fontSize ?? 20) as number;
  return (
    <View style={{ flexDirection: 'row', overflow: 'hidden' }} accessible accessibilityLabel={label ?? value}>
      {value.split('').map((ch, i) => (
        <View key={i} style={{ height: h, overflow: 'hidden' }}>
          <Animated.Text
            key={ch}
            entering={animate ? SlideInDown.duration(MOTION.flap) : undefined}
            exiting={animate ? SlideOutUp.duration(MOTION.flap) : undefined}
            style={style}
            maxFontSizeMultiplier={max}
            importantForAccessibility="no"
          >
            {ch}
          </Animated.Text>
        </View>
      ))}
    </View>
  );
}

/** Fades content in and out (state lines, chips). No movement, so it also serves Reduce Motion. */
export function Fade({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.duration(MOTION.in)} exiting={FadeOut.duration(MOTION.out)} style={style}>
      {children}
    </Animated.View>
  );
}

/** A grouped settings section: a bold header, rows on a sheet, optional footer. */
export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const { theme } = useApp();
  return (
    <View style={s.section}>
      {title ? (
        <Txt v="headline" style={s.sectionTitle} accessibilityRole="header">
          {title}
        </Txt>
      ) : null}
      <View style={[s.group, { backgroundColor: theme.sheet }]}>{children}</View>
      {footer ? (
        <Txt v="footnote" tone="ink3" style={s.footer}>
          {footer}
        </Txt>
      ) : null}
    </View>
  );
}

export function Row({
  label,
  value,
  onPress,
  right,
  badge,
  last,
  sub,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  badge?: string;
  last?: boolean;
  /** A second line under the label (paywall features). */
  sub?: string;
}) {
  const { theme, prefs } = useApp();
  const body = (
    <View style={[s.row, sub ? s.rowTall : null]}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
          <Txt v={sub ? 'headline' : 'body'} style={{ flexShrink: 1 }}>
            {label}
          </Txt>
          {badge ? <Tag label={badge} /> : null}
        </View>
        {sub ? (
          <Txt v="subhead" tone="ink2">
            {sub}
          </Txt>
        ) : null}
      </View>
      <View style={{ flex: 1 }} />
      {value ? <Txt tone="ink2">{value}</Txt> : null}
      {right}
      {onPress && !right ? <Ionicons name="arrow-forward" size={18} color={theme.ink3} /> : null}
      {!last ? <View style={[s.sep, { backgroundColor: theme.rule }]} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={() => {
        tap(prefs.haptics);
        onPress();
      }}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.pressed : 'transparent' })}
    >
      {body}
    </Pressable>
  );
}

export function SwitchRow({ label, value, onChange, badge, last }: { label: string; value: boolean; onChange: (v: boolean) => void; badge?: string; last?: boolean }) {
  const { theme } = useApp();
  return <Row label={label} badge={badge} last={last} right={<Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: theme.sign, false: theme.field }} ios_backgroundColor={theme.field} />} />;
}

/** Segmented control: field track, the chosen segment filled. `tone` sign for wayfinding choices (prompter mode). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  compact,
  dark,
}: {
  options: { value: T; label: string; locked?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  compact?: boolean;
  /** Always-dark surfaces (the prompter): stage colours regardless of appearance. */
  dark?: boolean;
}) {
  const { theme, prefs } = useApp();
  const track = dark ? '#1E1E1E' : theme.field;
  const onFill = dark ? SIGN : theme.inkFill;
  const onText = dark ? SIGN_INK : theme.onInkFill;
  const offText = dark ? '#B4B4AE' : theme.ink2;
  return (
    <View style={[s.seg, { backgroundColor: track }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.locked ? `${o.label}, Plus` : o.label}
            hitSlop={compact ? { top: 6, bottom: 6 } : 3}
            onPress={() => {
              tap(prefs.haptics);
              onChange(o.value);
            }}
            style={[s.segItem, compact && { minHeight: 32, paddingHorizontal: SPACE.xs }, on && { backgroundColor: onFill }]}
          >
            <Text style={[TYPE.subhead, { color: on ? onText : offText, fontFamily: on ? TYPE.headline.fontFamily : TYPE.subhead.fontFamily }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {o.label}
            </Text>
            {o.locked ? <Ionicons name="lock-closed" size={11} color={on ? onText : offText} style={{ marginLeft: 4 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ label, value, onMinus, onPlus, last }: { label: string; value: string; onMinus: () => void; onPlus: () => void; last?: boolean }) {
  const { theme } = useApp();
  return (
    <Row
      label={label}
      last={last}
      right={
        <View style={[s.stepper, { backgroundColor: theme.field }]}>
          <IconBtn icon="remove" label={`${label}, less`} onPress={onMinus} size={18} square />
          <Text style={[TYPE.headline, { color: theme.ink, minWidth: 48, textAlign: 'center' }]} maxFontSizeMultiplier={1.4}>
            {value}
          </Text>
          <IconBtn icon="add" label={`${label}, more`} onPress={onPlus} size={18} square />
        </View>
      }
    />
  );
}

/** The word "Plus" on locked features. */
export function Tag({ label = 'Plus' }: { label?: string }) {
  const { theme } = useApp();
  return (
    <View style={[s.tag, { backgroundColor: theme.inkFill }]}>
      <Text style={[TYPE.caption, { color: theme.onInkFill, fontFamily: TYPE.headline.fontFamily }]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: RADIUS.control, paddingHorizontal: SPACE.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
  icon: { width: SPACE.touch, height: SPACE.touch, borderRadius: SPACE.touch / 2, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: SPACE.xl, paddingHorizontal: SPACE.gutter },
  sectionTitle: { marginBottom: SPACE.xs },
  footer: { marginTop: SPACE.xs },
  group: { borderRadius: RADIUS.panel, overflow: 'hidden' },
  row: { minHeight: SPACE.touch + 4, paddingHorizontal: SPACE.md, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  rowTall: { paddingVertical: SPACE.sm + 2 },
  sep: { position: 'absolute', left: SPACE.md, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  tag: { borderRadius: RADIUS.chip, paddingHorizontal: 6, paddingVertical: 1 },
  seg: { flexDirection: 'row', borderRadius: RADIUS.control, padding: 3, gap: 3 },
  segItem: { flex: 1, minHeight: 36, borderRadius: RADIUS.chip, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, flexDirection: 'row' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.control },
});
