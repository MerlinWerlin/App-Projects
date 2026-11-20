// Shared building blocks for the "Print" look (DESIGN.md): flat inks on paper, one button family, paper-slip cards,
// drawn icons. Every touchable has an accessibility label and role, a 44pt+ target, and press feedback that turns
// into a dim (no movement) under calm motion / Reduce Motion.
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Switch, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useApp } from '../state/app.tsx';
import { haptic } from '../native/device.ts';
import { fam, HEADING_KINDS, MOTION, R, SP, TYPE, type Theme } from './theme.ts';
import { Icon, type IconName } from './icons.tsx';

export { Icon, type IconName };

/** Font family, weight and tracking for a text kind in the current skin. */
export function fontFor(theme: Theme, kind: keyof typeof TYPE): TextStyle {
  if (kind === 'num') return { fontFamily: fam(theme.font.number) };
  if (HEADING_KINDS.has(kind)) return { fontFamily: fam(theme.font.heading), fontWeight: theme.font.headingWeight, letterSpacing: (TYPE[kind] as TextStyle).letterSpacing ?? theme.font.headingTracking };
  return { fontFamily: fam(theme.font.body) };
}

/** Widest content column, in points. Wider than any iPhone, so it only matters on iPad. */
export const CONTENT_MAX = 640;

/**
 * A screen. `header` = this route shows a navigation bar, which already sits below the status bar, so the top
 * safe-area inset must not be added again (it left a ~60 pt empty band under the title on Round, Settings, Plus).
 */
export function Screen({ children, scroll = true, pad = true, header = false }: { children: ReactNode; scroll?: boolean; pad?: boolean; header?: boolean }) {
  const { theme } = useApp();
  const ins = useSafeAreaInsets();
  // Fixed (non-scrolling) screens keep their bottom buttons clear of the home indicator.
  const bottom = scroll ? SP(10) : Math.max(SP(6), ins.bottom + SP(3));
  const style = { paddingHorizontal: pad ? SP(5) : 0, paddingTop: header ? SP(2) : ins.top + SP(4), paddingBottom: bottom };
  // On iPad (and iPad landscape) keep one centred phone-width column instead of stretching edge to edge.
  const column = { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' } as const;
  if (!scroll)
    return (
      <View style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
        <View style={[column, { flex: 1 }]}>{children}</View>
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={style} keyboardShouldPersistTaps="handled">
        <View style={column}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function T({ children, style, kind = 'body', color, center, lines }: {
  children: ReactNode; style?: StyleProp<TextStyle>; kind?: keyof typeof TYPE; color?: string; center?: boolean; lines?: number;
}) {
  const { theme } = useApp();
  // A size override must not inherit the kind's smaller lineHeight, or iOS clips the top of the glyph
  // (owner feedback 25 Oct). Give it room unless the caller set one.
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const size = flat?.fontSize ?? TYPE[kind].fontSize;
  const lh = flat?.lineHeight ?? (TYPE[kind] as TextStyle).lineHeight;
  const tight = kind === 'num' || HEADING_KINDS.has(kind);
  const roomy = lh != null && lh < size * (tight ? 0.98 : 1.2) ? { lineHeight: Math.ceil(size * (tight ? 1.05 : 1.25)) } : null;
  return (
    <Text numberOfLines={lines} style={[TYPE[kind], fontFor(theme, kind), { color: color ?? theme.ink, textAlign: center ? 'center' : undefined }, style, roomy]}>
      {children}
    </Text>
  );
}

/** An emoji shown as content (never as an icon): sized box, never clipped, hidden from screen readers. */
export function Emoji({ children, size = 28, style }: { children: string; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      accessible={false}
      importantForAccessibility="no"
      allowFontScaling={false}
      style={[{ fontSize: size, lineHeight: Math.ceil(size * 1.25), textAlign: 'center', includeFontPadding: false }, style]}
    >
      {children}
    </Text>
  );
}

/**
 * A slip of paper: one flat tint of the ground, no border, no shadow. `hi` is a deeper slip; `selected` is printed
 * in a pink tint with a pink rule, so the chosen option reads without a checkmark. Every skin renders flat: skin
 * shadow settings are ignored (DESIGN.md, Elevation).
 */
export function Card({ children, style, onPress, label, hi, selected }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string; hi?: boolean; selected?: boolean;
}) {
  const { theme } = useApp();
  const f = theme.cardFinish;
  const base = [
    {
      backgroundColor: selected ? theme.recTint : hi ? theme.cardHi : theme.card,
      borderRadius: theme.radius.l,
      padding: SP(4),
      borderWidth: selected ? 2 : f.borderWidth,
      borderColor: selected ? theme.rec : theme.cardBorder,
    },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Press onPress={onPress} label={label} style={base} selected={selected}>
      {children}
    </Press>
  );
}

export function Press({ children, onPress, onPressIn, onPressOut, style, label, disabled, hint, selected }: {
  children: ReactNode; onPress?: () => void; onPressIn?: () => void; onPressOut?: () => void;
  style?: StyleProp<ViewStyle>; label?: string; disabled?: boolean; hint?: string; selected?: boolean;
}) {
  const { calm } = useApp();
  const s = useRef(new Animated.Value(1)).current;
  const o = useRef(new Animated.Value(1)).current;
  // Feedback on touch-down. Full motion: a critically damped press to 0.97. Calm motion: a dim instead of a move.
  const to = (down: boolean) =>
    calm
      ? Animated.timing(o, { toValue: down ? 0.6 : 1, duration: MOTION.press, useNativeDriver: true }).start()
      : Animated.spring(s, { toValue: down ? 0.97 : 1, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={selected == null ? { disabled: !!disabled } : { disabled: !!disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        to(true);
        onPressIn?.();
      }}
      onPressOut={() => {
        to(false);
        onPressOut?.();
      }}
      hitSlop={6}
    >
      <Animated.View style={[style, { transform: [{ scale: s }], opacity: disabled ? 0.4 : o }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * One button family, all pills. primary = pink ink (the forwards / record action), rewind = blue ink (anything played
 * backwards), quiet = a paper slip, ghost = an ink outline. Labels are the system face, semibold.
 */
export function Button({ title, onPress, kind = 'primary', icon, disabled, busy, small, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'rewind' | 'ghost' | 'quiet'; icon?: IconName; disabled?: boolean; busy?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
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
        { backgroundColor: bg, borderRadius: R.pill, minHeight: small ? 44 : 56, paddingHorizontal: small ? SP(4) : SP(6), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SP(2) },
        kind === 'ghost' && { borderWidth: 1.5, borderColor: theme.ink },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} /> : null}
      <Text style={[small ? TYPE.small : TYPE.bodyB, fontFor(theme, 'bodyB'), { color: fg, fontWeight: '600' }]}>{title}</Text>
    </Press>
  );
}

export function ToggleRow({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP(3), gap: SP(3) }}>
      <View style={{ flex: 1 }}>
        <T kind="bodyB">{title}</T>
        {sub ? <T kind="small" color={theme.sub} style={{ marginTop: 2 }}>{sub}</T> : null}
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

/** A choice chip: an ink outline when off, solid ink when on. Plus-only choices show a lock and read "locked". */
export function Chip({ label, on, onPress, locked, tone, icon }: { label: string; on?: boolean; onPress: () => void; locked?: boolean; tone?: 'danger'; icon?: IconName }) {
  const { theme, t } = useApp();
  const fg = on ? theme.bg : tone === 'danger' ? theme.bad : locked ? theme.sub : theme.ink;
  return (
    <Press
      label={locked ? `${label}, ${t('common.locked')}` : label}
      selected={!!on}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{ paddingHorizontal: SP(4), minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SP(1.5), borderRadius: R.pill, backgroundColor: on ? theme.ink : 'transparent', borderWidth: 1.5, borderColor: on ? theme.ink : theme.line }}
    >
      {locked ? <Icon name="lock" size={15} color={fg} /> : icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={[TYPE.small, fontFor(theme, 'small'), { color: fg, fontWeight: '600' }]}>{label}</Text>
    </Press>
  );
}

export function Divider() {
  const { theme } = useApp();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }} />;
}

/**
 * The record, printed flat: one ink disc, grooves knocked out in the paper colour, and a label in the ink of the
 * direction it plays (pink forwards, blue backwards). It turns only while sound plays, and never under calm motion.
 */
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
  const ink = spin < 0 ? theme.labelBack : theme.labelForward;
  return (
    <View accessible={!!label} accessibilityLabel={label} style={{ width: size, height: size, alignSelf: 'center' }}>
      <Animated.View style={{ transform: [{ rotate: rot }] }}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={c} fill={theme.discBody} />
          {[0.9, 0.78, 0.66, 0.54].map((f) => (
            <Circle key={f} cx={c} cy={c} r={c * f} stroke={theme.discGroove} strokeOpacity={0.35} strokeWidth={1} fill="none" />
          ))}
          <Circle cx={c} cy={c} r={c * 0.38} fill={ink} />
          <Path d={`M ${c - c * 0.1} ${c - c * 0.14} L ${c + c * 0.16} ${c} L ${c - c * 0.1} ${c + c * 0.14} Z`} fill={theme.discBody} transform={spin < 0 ? `rotate(180 ${c} ${c})` : undefined} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Waveform bars (0..1). `progress` 0..1 colours the played part. */
export function Wave({ peaks, color, dim, progress = 1, height = 56, gap = 2 }: { peaks: number[]; color: string; dim: string; progress?: number; height?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height, gap }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: theme.cardHi, borderRadius: R.m, paddingVertical: SP(3), paddingHorizontal: SP(4), marginTop: SP(3) }}>
      <T kind="small">{text}</T>
    </View>
  );
}

/** A group heading: a real heading in the display face, never a small tracked label. */
export function SectionTitle({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <T kind="h" style={{ marginTop: first ? SP(2) : SP(8), marginBottom: SP(3) }}>
      {children}
    </T>
  );
}
