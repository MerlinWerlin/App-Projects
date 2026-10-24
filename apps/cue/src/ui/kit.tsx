/** Small shared UI kit: buttons, rows, switches, segmented control. 44pt targets, labels for VoiceOver. */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tap } from '../native/haptics';
import { useApp } from '../state/AppState';
import { RADIUS } from '../theme/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

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
  const bg = kind === 'primary' ? theme.accent : kind === 'danger' ? theme.danger : theme.chip;
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
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}
    >
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
  size = 24,
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
      hitSlop={8}
      onPress={() => {
        tap(prefs.haptics);
        onPress();
      }}
      style={({ pressed }) => [s.icon, { backgroundColor: bg ?? (active ? theme.accent : 'transparent'), opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={active ? theme.accentInk : (color ?? theme.ink)} />
    </Pressable>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const { theme } = useApp();
  return (
    <View style={s.section}>
      {title ? (
        <Text style={[s.sectionTitle, { color: theme.sub }]} accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>{children}</View>
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
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  badge?: string;
  last?: boolean;
}) {
  const { theme, prefs } = useApp();
  const body = (
    <View style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line }]}>
      <Text style={[s.rowLabel, { color: theme.ink }]}>{label}</Text>
      {badge ? (
        <View style={[s.badge, { backgroundColor: theme.accent }]}>
          <Text style={[s.badgeText, { color: theme.accentInk }]}>{badge}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {value ? <Text style={[s.rowValue, { color: theme.sub }]}>{value}</Text> : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={theme.sub} /> : null}
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
    >
      {body}
    </Pressable>
  );
}

export function SwitchRow({ label, value, onChange, badge, last }: { label: string; value: boolean; onChange: (v: boolean) => void; badge?: string; last?: boolean }) {
  const { theme } = useApp();
  return (
    <Row
      label={label}
      badge={badge}
      last={last}
      right={<Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: theme.accent }} />}
    />
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; locked?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
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
            accessibilityLabel={o.label}
            onPress={() => {
              tap(prefs.haptics);
              onChange(o.value);
            }}
            style={[s.segItem, on && { backgroundColor: theme.card }]}
          >
            <Text style={{ color: on ? theme.ink : theme.sub, fontWeight: on ? '700' : '500', fontSize: 14 }} numberOfLines={1}>
              {o.label}
              {o.locked ? ' ✦' : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const { theme } = useApp();
  return (
    <Row
      label={label}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconBtn icon="remove" label={`${label} −`} onPress={onMinus} size={20} />
          <Text style={{ color: theme.ink, minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
          <IconBtn icon="add" label={`${label} +`} onPress={onPlus} size={20} />
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: RADIUS, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontSize: 16, fontWeight: '700' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6, marginLeft: 4 },
  card: { borderRadius: RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 15 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  seg: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  segItem: { flex: 1, minHeight: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
