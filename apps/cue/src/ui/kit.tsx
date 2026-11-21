/**
 * Shared UI kit ("Running order", see apps/cue/DESIGN.md). Platform-shaped controls, 44 pt targets and
 * VoiceOver labels everywhere. Green (go) is spent on one primary action per screen and on selection only.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { tap } from '../native/haptics';
import { useApp } from '../state/AppState';
import { MOTION, RADIUS, SPACE, TYPE } from '../theme/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Tone = 'ink' | 'ink2' | 'ink3' | 'go' | 'standby' | 'danger' | 'onGo';

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
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  lines?: number;
  accessibilityRole?: 'header' | 'text';
  accessibilityLiveRegion?: 'polite' | 'assertive' | 'none';
}) {
  const { theme } = useApp();
  const color = { ink: theme.ink, ink2: theme.ink2, ink3: theme.ink3, go: theme.goText, standby: theme.standby, danger: theme.danger, onGo: theme.onGo }[tone];
  return (
    <Text style={[TYPE[v], { color }, style]} numberOfLines={lines} {...rest}>
      {children}
    </Text>
  );
}

/** The system bar material (real blur on iOS, solid on Android). Used for bars and docks only. */
export function Bar({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: 'light' | 'dark' }) {
  const { theme } = useApp();
  const t = tint ?? theme.material;
  if (Platform.OS === 'android') {
    return <View style={[{ backgroundColor: t === 'dark' ? 'rgba(18,18,20,0.96)' : 'rgba(250,250,248,0.97)', overflow: 'hidden' }, style]}>{children}</View>;
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
  return (pressed: boolean): ViewStyle => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed && !reduceMotion ? MOTION.press : 1 }] });
}

export function Btn({
  label,
  onPress,
  kind = 'go',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  /** go: the screen's one primary action. plain: everything else. */
  kind?: 'go' | 'plain';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, prefs } = useApp();
  const press = usePressStyle();
  const fg = kind === 'go' ? theme.onGo : theme.ink;
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
      style={({ pressed }) => [s.btn, { backgroundColor: kind === 'go' ? theme.go : theme.field }, press(pressed), disabled && { opacity: 0.4 }, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[TYPE.headline, { color: fg }]} numberOfLines={1}>
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
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  /** A toggled-on state (mirror, flip): drawn as a filled circle. */
  active?: boolean;
  activeFill?: string;
  activeInk?: string;
  bg?: string;
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
      style={({ pressed }) => [s.icon, { backgroundColor: active ? (activeFill ?? theme.ink) : (bg ?? 'transparent'), opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={active ? (activeInk ?? theme.ground) : (color ?? theme.goText)} />
    </Pressable>
  );
}

/** An inset grouped list section (iOS Settings shape): footnote header, rows on a sheet, optional footer. */
export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const { theme } = useApp();
  return (
    <View style={s.section}>
      {title ? (
        <Txt v="footnote" tone="ink2" style={s.sectionTitle} accessibilityRole="header">
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
          <Txt style={{ flexShrink: 1 }}>{label}</Txt>
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
      {onPress && !right ? <Ionicons name="chevron-forward" size={16} color={theme.ink3} /> : null}
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
  return <Row label={label} badge={badge} last={last} right={<Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: theme.go, false: theme.field }} ios_backgroundColor={theme.field} />} />;
}

/** iOS-shaped segmented control: field track, the selected segment raised on the sheet colour. */
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
    <View style={[s.seg, { backgroundColor: theme.field }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
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
            style={[s.segItem, compact && { minHeight: 32, paddingHorizontal: SPACE.xs }, on && { backgroundColor: theme.dark ? theme.pressed : theme.sheet }]}
          >
            <Text style={[TYPE.subhead, { color: on ? theme.ink : theme.ink2, fontWeight: on ? '600' : '400' }]} numberOfLines={1}>
              {o.label}
            </Text>
            {o.locked ? <Ionicons name="lock-closed" size={11} color={theme.ink3} style={{ marginLeft: 4 }} /> : null}
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
          <IconBtn icon="remove" label={`${label}, less`} onPress={onMinus} size={18} color={theme.ink} />
          <Text style={[TYPE.time, { color: theme.ink, minWidth: 48, textAlign: 'center' }]}>{value}</Text>
          <IconBtn icon="add" label={`${label}, more`} onPress={onPlus} size={18} color={theme.ink} />
        </View>
      }
    />
  );
}

/** The word "Plus" on locked features: plain text in a hairline capsule, no ornament. */
export function Tag({ label = 'Plus' }: { label?: string }) {
  const { theme } = useApp();
  return (
    <View style={[s.tag, { borderColor: theme.rule }]}>
      <Text style={[TYPE.caption, { color: theme.ink2, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 50, borderRadius: RADIUS.control, paddingHorizontal: SPACE.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
  icon: { width: SPACE.touch, height: SPACE.touch, borderRadius: SPACE.touch / 2, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: SPACE.lg + 4, paddingHorizontal: SPACE.gutter },
  sectionTitle: { marginBottom: 6, marginLeft: SPACE.md },
  footer: { marginTop: 6, marginHorizontal: SPACE.md },
  group: { borderRadius: RADIUS.group, overflow: 'hidden' },
  row: { minHeight: SPACE.touch, paddingHorizontal: SPACE.md, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  rowTall: { paddingVertical: SPACE.sm },
  sep: { position: 'absolute', left: SPACE.md, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  tag: { borderRadius: RADIUS.round, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, paddingVertical: 1 },
  seg: { flexDirection: 'row', borderRadius: 9, padding: 2, gap: 2 },
  segItem: { flex: 1, minHeight: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, flexDirection: 'row' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.round },
});
