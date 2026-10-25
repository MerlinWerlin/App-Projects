// Shared building blocks: Screen, Title, Body, Card, PressableScale, Button, EmptyState, ToggleRow.
// Every control names itself to screen readers; touch targets are at least 48 pt; colours come from tokens.
import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, Text, TextInput, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../native/device.ts';
import { useApp } from '../state/app.tsx';
import { duration, pressScale } from '../theme/motion.ts';
import { fonts, radius, space, TOUCH } from '../theme/tokens.ts';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + space.l, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.l, gap: space.l };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: theme.paper }, pad]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={pad}>
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const { theme } = useApp();
  return (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 30, color: theme.ink }}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const { theme } = useApp();
  return <Text style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: muted ? theme.muted : theme.ink }}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useApp();
  return (
    <View style={[{ backgroundColor: theme.card, borderRadius: radius.m, borderWidth: 1, borderColor: theme.line, padding: space.l, gap: space.s }, style]}>
      {children}
    </View>
  );
}

/**
 * Pressable that scales gently on press (skipped with Reduce Motion) and taps a haptic.
 * `animate={false}` turns the scale off (low-battery essentials: no animation at all).
 */
export function PressableScale(props: PressableProps & { children: ReactNode; animate?: boolean }) {
  const { reduceMotion } = useApp();
  const scale = useRef(new Animated.Value(1)).current;
  const { children, style, onPress, animate = true, ...rest } = props;
  const to = (v: number) =>
    reduceMotion || !animate ? undefined : Animated.timing(scale, { toValue: v, duration: duration.fast, useNativeDriver: true }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={() => to(pressScale)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        haptic.tap();
        onPress?.(e);
      }}
      hitSlop={8}
    >
      <Animated.View style={[{ minHeight: TOUCH, justifyContent: 'center', transform: [{ scale }] }, style as StyleProp<ViewStyle>]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ label, onPress, hint, kind = 'primary' }: { label: string; onPress: () => void; hint?: string; kind?: 'primary' | 'quiet' }) {
  const { theme } = useApp();
  const primary = kind === 'primary';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={{
        backgroundColor: primary ? theme.accent : 'transparent',
        borderRadius: radius.m,
        paddingHorizontal: space.l,
        borderWidth: primary ? 0 : 1,
        borderColor: theme.line,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: primary ? theme.onAccent : theme.ink }}>{label}</Text>
    </PressableScale>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const { theme } = useApp();
  return (
    <Card style={{ alignItems: 'flex-start', gap: space.m }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.displayMedium, fontSize: 20, color: theme.ink }}>
        {title}
      </Text>
      <Body muted>{body}</Body>
      {action}
    </Card>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme, t } = useApp();
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Body>{label}</Body>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: value ? theme.ok : theme.muted }}>{value ? t('common.on') : t('common.off')}</Text>
    </PressableScale>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  multiline,
  autoCapitalize = 'sentences',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  /** 'tel' gives the phone keypad and lets the system offer the user's own phone numbers to fill in. */
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel';
}) {
  const { theme } = useApp();
  const tel = inputMode === 'tel';
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: theme.muted }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        multiline={multiline}
        autoCapitalize={tel ? 'none' : autoCapitalize}
        autoCorrect={false}
        inputMode={inputMode}
        keyboardType={tel ? 'phone-pad' : undefined}
        textContentType={tel ? 'telephoneNumber' : undefined}
        autoComplete={tel ? 'tel' : undefined}
        style={{
          minHeight: multiline ? 96 : TOUCH,
          borderWidth: 1,
          borderColor: error ? theme.danger : theme.line,
          borderRadius: radius.s,
          paddingHorizontal: space.m,
          paddingVertical: space.s,
          backgroundColor: theme.card,
          color: theme.ink,
          fontFamily: fonts.body,
          fontSize: 16,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.body, fontSize: 14, color: theme.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** A selectable chip (radio semantics). */
export function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: ReactNode }) {
  const { theme } = useApp();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.m,
        borderRadius: radius.l,
        borderWidth: 1,
        borderColor: selected ? theme.accent : theme.line,
        backgroundColor: selected ? theme.accentSoft : theme.card,
      }}
    >
      {icon}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: theme.ink }}>{label}</Text>
    </PressableScale>
  );
}

export function Warning({ text }: { text: string }) {
  const { theme } = useApp();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: theme.accentSoft, borderRadius: radius.s, padding: space.m }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: theme.ink }}>{text}</Text>
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const { theme } = useApp();
  return <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.muted }}>{children}</Text>;
}
