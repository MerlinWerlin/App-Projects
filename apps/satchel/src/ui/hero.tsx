// T50 design pass: the shared "rich travel" building blocks. Every colour comes from theme tokens; motion is timed
// (ease-out, no overshoot) and Reduce Motion turns it off. Exported for every tab:
//   HeroHeader   gradient banner with an original vector illustration behind a title / subtitle (+ children)
//   GradientFill the tone's gradient as an absolute backdrop for any custom card
//   HeroIllustration  the illustrations on their own (route, ticket, map, cross, toilet)
//   StatTile     a number that counts up (tabular figures) with a label and an icon badge
//   SectionCard  elevated card with an icon badge, title, optional subtitle and action link
//   IconBadge    an Ionicons glyph in a tinted circle
//   QuickAction  square-ish tile (icon badge + label) for a quick-access row
//   ProgressBar  thin timed bar with progressbar semantics
//   FadeInView   fades and rises 12 pt on mount (timed); nothing moves with Reduce Motion
//   toneColours  { fg, bg } pair for a tone, for anything custom
//   tabIcon      tab bar icon factory (filled glyph in a tinted pill when focused)
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useApp } from '../state/app.tsx';
import { duration, easeOut, timed, useFadeRise } from '../theme/motion.ts';
import { radius, shadowOf, space, TOUCH, typeScale, type HeroTone, type Theme } from '../theme/tokens.ts';
import { PressableScale } from './kit.tsx';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type Tone = 'sea' | 'teal' | 'ok' | 'warn' | 'danger' | 'accent' | 'ink';
export type Illustration = 'route' | 'ticket' | 'map' | 'cross' | 'toilet' | 'none';

/** Foreground / tinted background for a tone. fg on bg is at least 3:1 (icons) and bold text is AA in both themes. */
export function toneColours(theme: Theme, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'sea':
      return { fg: theme.sea, bg: theme.seaSoft };
    case 'teal':
      return { fg: theme.teal, bg: theme.tealSoft };
    case 'ok':
      return { fg: theme.ok, bg: theme.okSoft };
    case 'warn':
      return { fg: theme.warn, bg: theme.warnSoft };
    case 'danger':
      return { fg: theme.danger, bg: theme.dangerSoft };
    case 'accent':
      return { fg: theme.accentInk, bg: theme.accentSoft };
    default:
      return { fg: theme.ink, bg: theme.line };
  }
}

/** Ionicons glyph in a tinted circle. Decorative: hidden from screen readers (the row it sits in names itself). */
export const IconBadge = memo(function IconBadge({ name, tone = 'sea', size = 'm' }: { name: IconName; tone?: Tone; size?: 's' | 'm' | 'l' }) {
  const { theme } = useApp();
  const { fg, bg } = toneColours(theme, tone);
  const box = size === 's' ? 32 : size === 'l' ? 52 : 42;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: box, height: box, borderRadius: box / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={name} size={Math.round(box * 0.5)} color={fg} />
    </View>
  );
});

/** Fades in and rises a little on mount (timed, ease-out). With Reduce Motion it is simply there. */
export function FadeInView({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useApp();
  const anim = useFadeRise(reduceMotion, delay);
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

/** Original vector art for hero banners: simple shapes in white wash with one warm highlight. viewBox 160 x 120. */
export const HeroIllustration = memo(function HeroIllustration({ kind, width = 160, height = 120 }: { kind: Illustration; width?: number; height?: number }) {
  const { theme } = useApp();
  if (kind === 'none') return null;
  const wash = theme.heroWash;
  const line = theme.heroMuted;
  const warm = theme.heroAccent;
  return (
    <Svg width={width} height={height} viewBox="0 0 160 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {kind === 'route' ? (
        <G>
          <Circle cx={128} cy={30} r={22} fill={wash} />
          <Circle cx={40} cy={88} r={30} fill={wash} />
          <Path d="M18 100 C 50 100, 60 40, 100 46 S 140 30, 146 18" fill="none" stroke={line} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[2, 7]} />
          <Circle cx={18} cy={100} r={5} fill={line} />
          <Circle cx={18} cy={100} r={9} fill="none" stroke={line} strokeWidth={1.5} />
          {/* A small plane on the line, nose pointing up-right. */}
          <G transform="translate(118 36) rotate(-35)">
            <Path d="M-12 -2 H10 Q16 0 10 2 H-12 Z" fill={warm} />
            <Path d="M0 -2 L-6 -12 H-2 L6 -2 Z" fill={warm} />
            <Path d="M0 2 L-6 12 H-2 L6 2 Z" fill={warm} />
            <Path d="M-11 -2 L-14 -7 H-11 L-7 -2 Z" fill={warm} />
          </G>
        </G>
      ) : null}
      {kind === 'ticket' ? (
        <G transform="rotate(-8 80 60)">
          <Rect x={22} y={28} width={120} height={64} rx={10} fill={wash} stroke={line} strokeWidth={2} />
          <Path d="M98 30 V90" stroke={line} strokeWidth={2} strokeDasharray={[4, 5]} />
          <Rect x={34} y={42} width={44} height={6} rx={3} fill={warm} />
          <Rect x={34} y={56} width={30} height={5} rx={2.5} fill={line} />
          <Rect x={34} y={68} width={38} height={5} rx={2.5} fill={line} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Rect key={i} x={108 + i * 4.5} y={44} width={i % 2 ? 2 : 3} height={32} fill={line} />
          ))}
        </G>
      ) : null}
      {kind === 'map' ? (
        <G>
          <Path d="M24 34 L60 22 L100 34 L136 22 V90 L100 102 L60 90 L24 102 Z" fill={wash} stroke={line} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M60 22 V90 M100 34 V102" stroke={line} strokeWidth={1.5} />
          <Path d="M34 80 C 50 70, 70 84, 86 64 S 118 56, 126 46" fill="none" stroke={line} strokeWidth={2} strokeDasharray={[3, 5]} strokeLinecap="round" />
          <Path d="M118 18 C110 18 104 24 104 32 C104 42 118 54 118 54 C118 54 132 42 132 32 C132 24 126 18 118 18 Z" fill={warm} />
          <Circle cx={118} cy={32} r={5} fill={theme.hero.map[0]} />
        </G>
      ) : null}
      {kind === 'cross' ? (
        <G>
          <Circle cx={112} cy={52} r={38} fill={wash} />
          <Rect x={98} y={26} width={28} height={52} rx={6} fill={warm} />
          <Rect x={86} y={38} width={52} height={28} rx={6} fill={warm} />
          <Path d="M10 92 H42 L50 76 L60 106 L70 84 L76 92 H150" fill="none" stroke={line} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      ) : null}
      {kind === 'toilet' ? (
        <G>
          <Circle cx={108} cy={56} r={40} fill={wash} />
          <Path d="M108 16 C96 16 86 26 86 38 C86 54 108 76 108 76 C108 76 130 54 130 38 C130 26 120 16 108 16 Z" fill={warm} />
          <Circle cx={108} cy={38} r={9} fill={theme.hero.toilets[0]} />
          <Path d="M36 96 C36 86 44 80 52 80 C60 80 68 86 68 96 Z" fill={line} />
          <Circle cx={52} cy={70} r={7} fill={line} />
          <Path d="M20 104 H150" stroke={line} strokeWidth={2} strokeLinecap="round" strokeDasharray={[2, 6]} />
        </G>
      ) : null}
    </Svg>
  );
});

/** The tone's diagonal gradient filling its parent (absolute). Put it first inside a View with overflow hidden. */
export const GradientFill = memo(function GradientFill({ tone }: { tone: HeroTone }) {
  const { theme } = useApp();
  const id = `grad${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const [from, to] = theme.hero[tone];
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill={`url(#${id})`} />
    </Svg>
  );
});

/**
 * Gradient hero banner. Title in display type, optional eyebrow (small caps) and subtitle; anything in `children`
 * sits below (stats, a countdown chip...). `topInset` adds the safe-area top so the gradient runs under the status bar.
 * The title is the screen's header for screen readers.
 */
export function HeroHeader({
  tone,
  title,
  subtitle,
  eyebrow,
  illustration = 'route',
  topInset = 0,
  compact = false,
  children,
  style,
}: {
  tone: HeroTone;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  illustration?: Illustration;
  topInset?: number;
  /** Shorter banner (smaller title, tighter padding, smaller art) for screens whose main content needs the room. */
  compact?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useApp();
  const pad = compact ? space.l : space.xl;
  return (
    <View style={[{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: theme.hero[tone][0] }, shadowOf(theme, 'mid'), style]}>
      <GradientFill tone={tone} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -8, top: topInset + space.s, opacity: 0.95 }}>
        <HeroIllustration kind={illustration} width={compact ? 120 : 160} height={compact ? 90 : 120} />
      </View>
      <View style={{ paddingTop: topInset + pad, paddingBottom: pad, paddingHorizontal: space.l, gap: compact ? space.xs : space.s }}>
        {eyebrow ? <Text style={[typeScale.caption, { color: theme.heroMuted }]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[compact ? typeScale.displayM : typeScale.displayL, { color: theme.heroInk, maxWidth: '78%' }]}>
          {title}
        </Text>
        {subtitle ? <Text style={[typeScale.body, { color: theme.heroMuted, maxWidth: '82%' }]}>{subtitle}</Text> : null}
        {children ? <View style={{ marginTop: space.s, gap: space.s }}>{children}</View> : null}
      </View>
    </View>
  );
}

/** A number that counts up from 0 on mount / when it changes (timed, tabular figures). Reduce Motion: shown at once. */
export const StatTile = memo(function StatTile({
  value,
  label,
  icon,
  tone = 'sea',
  style,
}: {
  value: number;
  label: string;
  icon?: IconName;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, t, reduceMotion } = useApp();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion || value <= 0) {
      setShown(value);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v * value)));
    // JS-driven so the listener sees every frame; the count is short (two slow beats).
    const a = Animated.timing(anim, { toValue: 1, duration: duration.slow * 2, easing: easeOut, useNativeDriver: false });
    a.start(() => setShown(value));
    return () => {
      a.stop();
      anim.removeListener(id);
    };
  }, [value, reduceMotion, anim]);
  return (
    <View
      accessible
      accessibilityLabel={t('design.stats.a11y', { label, n: value })}
      style={[
        { flex: 1, minWidth: 96, backgroundColor: theme.cardRaised, borderRadius: radius.l, padding: space.m, gap: space.xs, borderWidth: theme.dark ? 1 : 0, borderColor: theme.line },
        shadowOf(theme, 'low'),
        style,
      ]}
    >
      {icon ? <IconBadge name={icon} tone={tone} size="s" /> : null}
      <Text style={[typeScale.displayM, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{shown}</Text>
      <Text numberOfLines={1} style={[typeScale.caption, { color: theme.muted }]}>
        {label}
      </Text>
    </View>
  );
});

/**
 * Elevated card with an icon badge and a title row. `action` adds a small link on the right (48 pt target).
 * Content goes in children.
 */
export function SectionCard({
  title,
  subtitle,
  icon,
  tone = 'sea',
  action,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  tone?: Tone;
  action?: { label: string; hint?: string; onPress: () => void };
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useApp();
  return (
    <View
      style={[
        { backgroundColor: theme.cardRaised, borderRadius: radius.l, padding: space.l, gap: space.m, borderWidth: theme.dark ? 1 : 0, borderColor: theme.line },
        shadowOf(theme, 'low'),
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        {icon ? <IconBadge name={icon} tone={tone} /> : null}
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[typeScale.title, { color: theme.ink }]}>
            {title}
          </Text>
          {subtitle ? <Text style={[typeScale.small, { color: theme.muted }]}>{subtitle}</Text> : null}
        </View>
        {action ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={action.label} accessibilityHint={action.hint} onPress={action.onPress} style={{ paddingHorizontal: space.s }}>
            <Text style={[typeScale.bodyStrong, { color: toneColours(theme, tone).fg }]}>{action.label}</Text>
          </PressableScale>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Quick-access tile: icon badge over a short label. Disabled tiles are dimmed and say so to screen readers. */
export const QuickAction = memo(function QuickAction({
  icon,
  label,
  hint,
  tone = 'sea',
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  tone?: Tone;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[
          {
            alignItems: 'center',
            gap: space.s,
            paddingVertical: space.m,
            paddingHorizontal: space.xs,
            minHeight: TOUCH + space.xl,
            borderRadius: radius.l,
            backgroundColor: theme.cardRaised,
            borderWidth: theme.dark ? 1 : 0,
            borderColor: theme.line,
            opacity: disabled ? 0.5 : 1,
          },
          shadowOf(theme, 'low'),
        ]}
      >
        <IconBadge name={icon} tone={tone} />
        <Text numberOfLines={1} style={[typeScale.small, { fontFamily: typeScale.bodyStrong.fontFamily, color: theme.ink }]}>
          {label}
        </Text>
      </PressableScale>
    </View>
  );
});

/** Thin rounded progress bar; the fill eases to its value (timed). `label` is what a screen reader hears. */
export const ProgressBar = memo(function ProgressBar({ progress, label, tone = 'sea', track }: { progress: number; label: string; tone?: Tone; track?: string }) {
  const { theme, reduceMotion } = useApp();
  const p = Math.min(1, Math.max(0, progress));
  const anim = useRef(new Animated.Value(reduceMotion ? p : 0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    const a = timed(anim, p, duration.slow, reduceMotion, duration.fast);
    a.start();
    return () => a.stop();
  }, [p, reduceMotion, anim]);
  const fg = toneColours(theme, tone).fg;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: 8, borderRadius: 4, backgroundColor: track ?? toneColours(theme, tone).bg, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height: 8,
          width: w,
          borderRadius: 4,
          backgroundColor: fg,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] }) }],
        }}
      />
    </View>
  );
});

/**
 * Tab bar icon factory (T50): `tabIcon('airplane', theme.accentSoft)` shows the filled glyph in a tinted pill when the
 * tab is focused and the `-outline` glyph otherwise. Use it for every Tabs.Screen so new tabs match.
 */
export const tabIcon =
  (base: string, pill: string) =>
  ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <View style={{ width: 52, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? pill : 'transparent' }}>
      <Ionicons name={(focused ? base : `${base}-outline`) as IconName} size={size - 2} color={typeof color === 'string' ? color : undefined} />
    </View>
  );
