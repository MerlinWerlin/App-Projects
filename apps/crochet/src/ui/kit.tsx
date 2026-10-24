// Small UI kit: text, buttons, cards, rows, fields, segmented control, sheet. Every control has an
// accessibility label and a 48 pt touch target.
import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../store/settings';
import { TOUCH, font, radius, space, useColors } from '../theme/tokens';
import { haptic } from './haptics';

export type IconName = React.ComponentProps<typeof Feather>['name'];

// ------------------------------------------------------------------ text

export function Title({ children, style, size = 30 }: { children: ReactNode; style?: StyleProp<TextStyle>; size?: number }) {
  const { c } = useColors();
  return (
    <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[{ fontFamily: font.display, fontSize: size, color: c.ink, letterSpacing: -0.3 }, style]}>
      {children}
    </Text>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useColors();
  return (
    <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={[{ fontFamily: font.displayMed, fontSize: 20, color: c.ink }, style]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  style,
  muted,
  bold,
  small,
  numberOfLines,
  selectable,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  bold?: boolean;
  small?: boolean;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const { c } = useColors();
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      maxFontSizeMultiplier={1.8}
      style={[
        {
          fontFamily: bold ? font.bodyBold : font.body,
          fontSize: small ? 14 : 16,
          lineHeight: small ? 19 : 22,
          color: muted ? c.ink2 : c.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useColors();
  return (
    <Text maxFontSizeMultiplier={1.5} style={[{ fontFamily: font.heavy, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: c.ink3 }, style]}>
      {children}
    </Text>
  );
}

// ------------------------------------------------------------------ press

export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  label,
  hint,
  disabled,
  role = 'button',
  delayLongPress,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  label: string;
  hint?: string;
  disabled?: boolean;
  role?: 'button' | 'link' | 'tab' | 'checkbox' | 'radio';
  delayLongPress?: number;
}) {
  const { reduceMotion } = useSettings();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  };
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { c } = useColors();
  const bg = kind === 'primary' ? c.accent : kind === 'secondary' ? c.surface2 : kind === 'danger' ? c.danger : 'transparent';
  const fg = kind === 'primary' ? c.accentInk : kind === 'danger' ? '#fff' : kind === 'ghost' ? c.accent : c.ink;
  return (
    <PressableScale
      label={title}
      disabled={disabled}
      onPress={() => {
        haptic('tap');
        onPress();
      }}
      style={[
        {
          minHeight: small ? 40 : TOUCH,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: radius.pill,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: font.bodyBold, fontSize: small ? 14 : 16, color: fg }}>
        {title}
      </Text>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  tone = 'plain',
  size = 22,
  style,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  tone?: 'plain' | 'soft' | 'accent';
  size?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const { c } = useColors();
  const bg = tone === 'soft' ? c.surface2 : tone === 'accent' ? c.accent : 'transparent';
  const fg = tone === 'accent' ? c.accentInk : c.ink;
  return (
    <PressableScale
      label={label}
      disabled={disabled}
      onPress={() => {
        haptic('select');
        onPress();
      }}
      onLongPress={onLongPress}
      style={[{ width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }, style]}
    >
      <Feather name={icon} size={size} color={fg} />
    </PressableScale>
  );
}

// ------------------------------------------------------------------ layout

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const { c } = useColors();
  const s: StyleProp<ViewStyle> = [{ backgroundColor: c.surface, borderRadius: radius.l, padding: space.l, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }, style];
  if (onPress) {
    return (
      <PressableScale label={label ?? ''} onPress={onPress} style={s}>
        {children}
      </PressableScale>
    );
  }
  return <View style={s}>{children}</View>;
}

export function Section({ title, children, right, style }: { title?: string; children: ReactNode; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: space.s, marginTop: space.l }, style]}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Label>{title}</Label>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useColors();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  icon,
  right,
  onPress,
  last,
  danger,
  chevron = !!onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
  chevron?: boolean;
}) {
  const { c } = useColors();
  const inner = (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.l,
        paddingVertical: 10,
        gap: space.m,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: c.line,
      }}
    >
      {icon ? (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: danger ? 'transparent' : c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={18} color={danger ? c.danger : c.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Body bold style={danger ? { color: c.danger } : undefined}>
          {title}
        </Body>
        {subtitle ? (
          <Body small muted>
            {subtitle}
          </Body>
        ) : null}
      </View>
      {right}
      {chevron ? <Feather name="chevron-right" size={18} color={c.ink3} /> : null}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={() => {
        haptic('select');
        onPress();
      }}
      style={({ pressed }) => ({ backgroundColor: pressed ? c.surface2 : 'transparent' })}
    >
      {inner}
    </Pressable>
  );
}

export function SwitchRow({ title, subtitle, value, onChange, last, icon }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean; icon?: IconName }) {
  const { c } = useColors();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      icon={icon}
      last={last}
      chevron={false}
      right={
        <RNSwitch
          accessibilityLabel={title}
          value={value}
          onValueChange={(v) => {
            haptic('select');
            onChange(v);
          }}
          trackColor={{ true: c.accent, false: c.line }}
        />
      }
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useColors();
  return (
    <View accessibilityRole="tablist" style={[{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: radius.pill, padding: 4, gap: 4 }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) haptic('select');
              onChange(o.value);
            }}
            style={{ flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent' }}
          >
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: on ? font.bodyBold : font.bodySemi, fontSize: 14, color: on ? c.ink : c.ink2 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: IconName }) {
  const { c } = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on }}
      onPress={() => {
        haptic('select');
        onPress?.();
      }}
      style={{
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: on ? c.ink : c.surface2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon ? <Feather name={icon} size={14} color={on ? c.bg : c.ink2} /> : null}
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bodyBold, fontSize: 14, color: on ? c.bg : c.ink2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({ label, style, multiline, ...rest }: Omit<TextInputProps, 'style'> & { label: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useColors();
  return (
    <View style={[{ gap: 6 }, style]}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.ink3}
        multiline={multiline}
        {...rest}
        style={{
          minHeight: multiline ? 120 : TOUCH,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          borderRadius: radius.m,
          backgroundColor: c.surface2,
          color: c.ink,
          fontFamily: font.body,
          fontSize: 16,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

/** Number input that keeps a string while typing. */
export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  decimals,
  style,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  decimals?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Field
      label={label}
      style={style}
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
      defaultValue={value != null ? String(value) : ''}
      onChangeText={(s) => {
        const n = Number(s.replace(',', '.'));
        onChange(s.trim() === '' || !Number.isFinite(n) ? undefined : n);
      }}
      returnKeyType="done"
    />
  );
}

export function Stepper({ value, onChange, min = 0, max = 9999, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  const { c } = useColors();
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <IconButton icon="minus" tone="soft" label={`${label} -1`} onPress={() => onChange(Math.max(min, value - 1))} size={18} />
      <Text style={{ minWidth: 44, textAlign: 'center', fontFamily: font.heavy, fontSize: 20, color: c.ink }}>{value}</Text>
      <IconButton icon="plus" tone="soft" label={`${label} +1`} onPress={() => onChange(Math.min(max, value + 1))} size={18} />
    </View>
  );
}

// ------------------------------------------------------------------ screen

export function ScreenScroll({ children, contentStyle, keyboard }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle>; keyboard?: boolean }) {
  const { c } = useColors();
  const inner = (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: space.l, paddingBottom: 120 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
  if (!keyboard) return inner;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {inner}
    </KeyboardAvoidingView>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  const { c } = useColors();
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.m }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={30} color={c.accent} />
      </View>
      <H2 style={{ textAlign: 'center' }}>{title}</H2>
      <Body muted style={{ textAlign: 'center' }}>
        {body}
      </Body>
      {action}
    </View>
  );
}

// ------------------------------------------------------------------ sheet

export function Sheet({ visible, onClose, children, title }: { visible: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const { c } = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
        <View
          style={{
            backgroundColor: c.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: space.l,
            paddingTop: space.s,
            paddingBottom: Math.max(insets.bottom, space.l),
            maxHeight: '88%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: space.m }} />
          {title ? <H2 style={{ marginBottom: space.m }}>{title}</H2> : null}
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Fades content in on mount (skipped with reduce motion). */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useSettings();
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, { toValue: 1, duration: 220, delay: Math.min(delay, 240), useNativeDriver: true }).start();
  }, [v, delay, reduceMotion]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}
