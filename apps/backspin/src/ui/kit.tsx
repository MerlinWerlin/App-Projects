// Shared building blocks. Every touchable has an accessibility label and role, a 44pt+ target,
// and a press scale that turns off under calm motion.
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Switch, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useApp } from '../state/app.tsx';
import { haptic } from '../native/device.ts';
import { fam, HEADING_KINDS, R, SP, TYPE, type Theme } from './theme.ts';

/** Font family, weight and tracking for a text kind in the current skin. */
export function fontFor(theme: Theme, kind: keyof typeof TYPE): TextStyle {
  if (kind === 'num') return { fontFamily: fam(theme.font.number) };
  if (HEADING_KINDS.has(kind)) return { fontFamily: fam(theme.font.heading), fontWeight: theme.font.headingWeight, letterSpacing: (TYPE[kind] as TextStyle).letterSpacing ?? theme.font.headingTracking };
  return { fontFamily: fam(theme.font.body) };
}

/** The skin's soft screen gradient, behind everything. */
export function Backdrop() {
  const { theme } = useApp();
  const c = theme.bgGradient?.length >= 2 ? theme.bgGradient : [theme.bg, theme.bg];
  return <LinearGradient pointerEvents="none" colors={c as [string, string, ...string[]]} style={StyleSheet.absoluteFill} />;
}

export function Screen({ children, scroll = true, pad = true }: { children: ReactNode; scroll?: boolean; pad?: boolean }) {
  const { theme } = useApp();
  const ins = useSafeAreaInsets();
  const style = { paddingHorizontal: pad ? SP(5) : 0, paddingTop: ins.top + SP(3), paddingBottom: SP(10) };
  if (!scroll)
    return (
      <View style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
        <Backdrop />
        {children}
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Backdrop />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={style} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export function T({ children, style, kind = 'body', color, center, lines }: {
  children: ReactNode; style?: StyleProp<TextStyle>; kind?: keyof typeof TYPE; color?: string; center?: boolean; lines?: number;
}) {
  const { theme } = useApp();
  return (
    <Text numberOfLines={lines} style={[TYPE[kind], fontFor(theme, kind), { color: color ?? theme.ink, textAlign: center ? 'center' : undefined }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress, label, hi }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string; hi?: boolean;
}) {
  const { theme } = useApp();
  const f = theme.cardFinish;
  const base = [
    {
      backgroundColor: hi ? theme.cardHi : theme.card,
      borderRadius: theme.radius.l,
      padding: SP(4),
      borderWidth: f.borderWidth || StyleSheet.hairlineWidth,
      borderColor: theme.cardBorder,
      shadowColor: theme.shadow,
      shadowOpacity: f.shadowOpacity,
      shadowRadius: f.shadowRadius,
      shadowOffset: { width: 0, height: Math.round(f.shadowRadius / 3) },
    },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Press onPress={onPress} label={label} style={base}>
      {children}
    </Press>
  );
}

export function Press({ children, onPress, onPressIn, onPressOut, style, label, disabled, hint }: {
  children: ReactNode; onPress?: () => void; onPressIn?: () => void; onPressOut?: () => void;
  style?: StyleProp<ViewStyle>; label?: string; disabled?: boolean; hint?: string;
}) {
  const { calm } = useApp();
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => !calm && Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        to(0.96);
        onPressIn?.();
      }}
      onPressOut={() => {
        to(1);
        onPressOut?.();
      }}
      hitSlop={6}
    >
      <Animated.View style={[style, { transform: [{ scale: s }], opacity: disabled ? 0.45 : 1 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', icon, disabled, busy, small, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'rewind' | 'ghost' | 'quiet'; icon?: string; disabled?: boolean; busy?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useApp();
  const bg = kind === 'primary' ? theme.rec : kind === 'rewind' ? theme.rew : kind === 'ghost' ? 'transparent' : theme.cardHi;
  const fg = kind === 'primary' ? theme.recInk : kind === 'rewind' ? theme.rewInk : theme.ink;
  return (
    <Press
      label={title}
      disabled={disabled || busy}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[
        { backgroundColor: bg, borderRadius: R.pill, overflow: 'hidden', minHeight: small ? 44 : 54, paddingHorizontal: small ? SP(4) : SP(6), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SP(2) },
        kind === 'ghost' && { borderWidth: 1.5, borderColor: theme.line },
        style,
      ]}
    >
      {kind === 'primary' && theme.recGradient?.length >= 2 ? (
        <LinearGradient colors={theme.recGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: R.pill }]} />
      ) : null}
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Text style={{ fontSize: small ? 16 : 18 }}>{icon}</Text> : null}
      <Text style={[small ? TYPE.small : TYPE.bodyB, fontFor(theme, 'bodyB'), { color: fg, fontWeight: '700' }]}>{title}</Text>
    </Press>
  );
}

export function ToggleRow({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP(3), gap: SP(3) }}>
      <View style={{ flex: 1 }}>
        <T kind="bodyB">{title}</T>
        {sub ? <T kind="small" color={theme.sub}>{sub}</T> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={(v) => {
          haptic.tap();
          onChange(v);
        }}
        trackColor={{ true: theme.rew, false: theme.line }}
      />
    </View>
  );
}

export function Chip({ label, on, onPress, locked }: { label: string; on?: boolean; onPress: () => void; locked?: boolean }) {
  const { theme } = useApp();
  return (
    <Press
      label={label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{ paddingHorizontal: SP(4), minHeight: 40, justifyContent: 'center', borderRadius: R.pill, backgroundColor: on ? theme.ink : theme.cardHi }}
    >
      <Text style={[TYPE.small, fontFor(theme, 'small'), { color: on ? theme.bg : theme.ink, fontWeight: '700' }]}>
        {locked ? '🔒 ' : ''}
        {label}
      </Text>
    </Press>
  );
}

export function Divider() {
  const { theme } = useApp();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }} />;
}

/** A vinyl record that spins forwards or backwards while sound plays. */
export function Disc({ size = 140, spin = 0, label }: { size?: number; spin?: -1 | 0 | 1; label?: string }) {
  const { theme, calm } = useApp();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spin || calm) {
      a.stopAnimation();
      return;
    }
    a.setValue(0);
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin, calm, a]);
  const rot = a.interpolate({ inputRange: [0, 1], outputRange: spin < 0 ? ['360deg', '0deg'] : ['0deg', '360deg'] });
  const c = size / 2;
  return (
    <View accessible accessibilityLabel={label} style={{ width: size, height: size, alignSelf: 'center' }}>
      <Animated.View style={{ transform: [{ rotate: rot }] }}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={c - 1} fill={theme.discBody} />
          {[0.86, 0.74, 0.62, 0.5].map((f) => (
            <Circle key={f} cx={c} cy={c} r={c * f} stroke={theme.discGroove} strokeWidth={1.2} fill="none" />
          ))}
          <Path d={`M ${c} ${c * 0.08} A ${c * 0.92} ${c * 0.92} 0 0 1 ${c * 1.75} ${c * 0.6}`} stroke="rgba(255,255,255,0.18)" strokeWidth={3} fill="none" strokeLinecap="round" />
          <Circle cx={c} cy={c} r={c * 0.34} fill={spin < 0 ? theme.labelBack : theme.labelForward} />
          <Path d={`M ${c - c * 0.12} ${c - c * 0.14} L ${c + c * 0.16} ${c} L ${c - c * 0.12} ${c + c * 0.14} Z`} fill="#FFFFFF" transform={spin < 0 ? `rotate(180 ${c} ${c})` : undefined} />
          <Circle cx={c} cy={c} r={3} fill="#000" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Waveform bars (0..1). `progress` 0..1 colours the played part. */
export function Wave({ peaks, color, dim, progress = 1, height = 56 }: { peaks: number[]; color: string; dim: string; progress?: number; height?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height, gap: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {peaks.map((p, i) => (
        <View key={i} style={{ flex: 1, height: Math.max(3, p * height), borderRadius: 2, backgroundColor: i / peaks.length <= progress ? color : dim }} />
      ))}
    </View>
  );
}

export function Toastish({ text }: { text: string | null }) {
  const { theme } = useApp();
  if (!text) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: theme.cardHi, borderRadius: R.m, padding: SP(3), marginTop: SP(3) }}>
      <T kind="small">{text}</T>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const { theme } = useApp();
  return (
    <T kind="small" color={theme.sub} style={{ textTransform: 'uppercase', letterSpacing: 1, marginTop: SP(6), marginBottom: SP(2) }}>
      {children}
    </T>
  );
}
