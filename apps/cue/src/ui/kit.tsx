/**
 * Shared UI kit ("Studio" look). 44pt+ targets and VoiceOver labels everywhere.
 * Brass is spent on the primary action and selected states only; everything else stays quiet.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { tap } from '../native/haptics';
import { useApp } from '../state/AppState';
import { FONT, RADIUS, TYPE } from '../theme/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Text in the app's type scale and colours. */
export function Txt({
  v = 'body',
  tone = 'ink',
  style,
  children,
  lines,
  ...rest
}: {
  v?: keyof typeof TYPE;
  tone?: 'ink' | 'sub' | 'faint' | 'accent' | 'danger' | 'onAccent';
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  lines?: number;
  accessibilityRole?: 'header' | 'text';
  accessibilityLiveRegion?: 'polite' | 'assertive' | 'none';
}) {
  const { theme } = useApp();
  const color = { ink: theme.ink, sub: theme.sub, faint: theme.faint, accent: theme.accentText, danger: theme.danger, onAccent: theme.accentInk }[tone];
  return (
    <Text style={[TYPE[v], { color }, style]} numberOfLines={lines} {...rest}>
      {children}
    </Text>
  );
}

/** Frosted glass panel (real blur where available, solid fallback on Android). */
export function Glass({ children, style, tint, intensity = 40 }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: 'light' | 'dark'; intensity?: number }) {
  const { theme } = useApp();
  const t = tint ?? theme.blurTint;
  if (Platform.OS === 'android') {
    return <View style={[{ backgroundColor: t === 'dark' ? 'rgba(16,19,28,0.92)' : 'rgba(255,255,255,0.94)', overflow: 'hidden' }, style]}>{children}</View>;
  }
  return (
    <BlurView tint={t === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} intensity={intensity} style={[{ overflow: 'hidden' }, style]}>
      {children}
    </BlurView>
  );
}

export function Btn({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, prefs } = useApp();
  const fg = kind === 'primary' ? theme.accentInk : kind === 'danger' ? '#fff' : theme.ink;
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
      style={({ pressed }) => [
        s.btn,
        kind === 'primary' && theme.shadow,
        kind === 'secondary' && { backgroundColor: theme.card, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line },
        kind === 'danger' && { backgroundColor: theme.danger },
        { opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {kind === 'primary' ? (
        <LinearGradient colors={['#DDB063', '#C9973F', '#B4832F']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.control }]} />
      ) : null}
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[s.btnText, { color: fg }]} numberOfLines={1}>
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
  bg,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  active?: boolean;
  bg?: string;
}) {
  const { theme, prefs } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={6}
      onPress={() => {
        tap(prefs.haptics);
        onPress();
      }}
      style={({ pressed }) => [s.icon, { backgroundColor: active ? theme.accent : (bg ?? 'transparent'), opacity: pressed ? 0.55 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={active ? theme.accentInk : (color ?? theme.ink)} />
    </Pressable>
  );
}

export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const { theme } = useApp();
  return (
    <View style={s.section}>
      {title ? (
        <Txt v="headline" style={s.sectionTitle} accessibilityRole="header">
          {title}
        </Txt>
      ) : null}
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>{children}</View>
      {footer ? (
        <Txt v="caption" tone="faint" style={s.footer}>
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
  icon,
  last,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  badge?: string;
  icon?: IconName;
  last?: boolean;
}) {
  const { theme, prefs } = useApp();
  const body = (
    <View style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line }]}>
      {icon ? (
        <View style={[s.rowIcon, { backgroundColor: theme.accentWash }]}>
          <Ionicons name={icon} size={16} color={theme.accentText} />
        </View>
      ) : null}
      <Txt style={{ flexShrink: 1 }}>{label}</Txt>
      {badge ? (
        <View style={[s.badge, { borderColor: theme.accent }]}>
          <Text style={[s.badgeText, { color: theme.accentText }]}>{badge}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {value ? (
        <Txt v="callout" tone="sub">
          {value}
        </Txt>
      ) : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={17} color={theme.faint} /> : null}
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
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.chip : 'transparent' })}
    >
      {body}
    </Pressable>
  );
}

export function SwitchRow({ label, value, onChange, badge, icon, last }: { label: string; value: boolean; onChange: (v: boolean) => void; badge?: string; icon?: IconName; last?: boolean }) {
  const { theme } = useApp();
  return (
    <Row
      label={label}
      badge={badge}
      icon={icon}
      last={last}
      right={<Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: theme.accent, false: theme.chip }} ios_backgroundColor={theme.chip} />}
    />
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  compact,
}: {
  options: { value: T; label: string; locked?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  compact?: boolean;
}) {
  const { theme, prefs } = useApp();
  return (
    <View style={[s.seg, { backgroundColor: theme.chip }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.locked ? `${o.label}, Plus` : o.label}
            onPress={() => {
              tap(prefs.haptics);
              onChange(o.value);
            }}
            style={[s.segItem, compact && { minHeight: 32, paddingHorizontal: 8 }, on && [{ backgroundColor: theme.card }, theme.shadow, { shadowOpacity: theme.dark ? 0.3 : 0.06 }]]}
          >
            <Text style={{ color: on ? theme.ink : theme.sub, fontFamily: on ? FONT.bodyBold : FONT.body, fontSize: 14 }} numberOfLines={1}>
              {o.label}
            </Text>
            {o.locked ? <Ionicons name="sparkles" size={11} color={theme.accentText} style={{ marginLeft: 3 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ label, value, onMinus, onPlus, icon }: { label: string; value: string; onMinus: () => void; onPlus: () => void; icon?: IconName }) {
  const { theme } = useApp();
  return (
    <Row
      label={label}
      icon={icon}
      right={
        <View style={[s.stepper, { backgroundColor: theme.chip }]}>
          <IconBtn icon="remove" label={`${label}, less`} onPress={onMinus} size={18} />
          <Text style={{ color: theme.ink, minWidth: 46, textAlign: 'center', fontFamily: FONT.bodyBold, fontVariant: ['tabular-nums'] }}>{value}</Text>
          <IconBtn icon="add" label={`${label}, more`} onPress={onPlus} size={18} />
        </View>
      }
    />
  );
}

/** Small brass "Plus" mark used on locked features. */
export function PlusMark() {
  const { theme } = useApp();
  return (
    <View style={[s.badge, { borderColor: theme.accent, flexDirection: 'row', gap: 3, alignItems: 'center' }]}>
      <Ionicons name="sparkles" size={10} color={theme.accentText} />
      <Text style={[s.badgeText, { color: theme.accentText }]}>Plus</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: RADIUS.control, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'visible' },
  btnText: { fontFamily: FONT.bodyBold, fontSize: 16.5, letterSpacing: 0.1 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 26, paddingHorizontal: 16 },
  sectionTitle: { marginBottom: 8, marginLeft: 4 },
  footer: { marginTop: 8, marginHorizontal: 6 },
  card: { borderRadius: RADIUS.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 1 },
  badgeText: { fontFamily: FONT.bodyBold, fontSize: 11 },
  seg: { flexDirection: 'row', borderRadius: RADIUS.chip + 2, padding: 3, gap: 3 },
  segItem: { flex: 1, minHeight: 36, borderRadius: RADIUS.chip, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, flexDirection: 'row' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.pill },
});
