import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { radius, space, type as ty, useColors } from '../theme/tokens';
import { useHaptics } from './haptics';

export type IconName = string;

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { c } = useColors();
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: c.line }, style]}>
      {children}
    </View>
  );
}

export function Button({ label, onPress, kind = 'primary', style }: { label: string; onPress: () => void; kind?: 'primary' | 'soft'; style?: ViewStyle }) {
  const { c } = useColors();
  const h = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        h.tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: space.xl,
          borderRadius: radius.pill,
          backgroundColor: kind === 'primary' ? c.accent : c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      <Text style={[ty.bodyBold, { color: kind === 'primary' ? c.accentInk : c.accent }]}>{label}</Text>
    </Pressable>
  );
}

/** Round icon button for toolbars (48 pt target). */
export function IconButton({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
  size = 24,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: number;
}) {
  const { c } = useColors();
  const h = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        h.select();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? c.accent : pressed ? c.scrim : 'transparent',
        opacity: disabled ? 0.35 : 1,
      })}
    >
      <MaterialCommunityIcons name={icon as never} size={size} color={active ? c.accentInk : c.ink} />
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { c } = useColors();
  const h = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={() => {
        h.select();
        onPress();
      }}
      style={{
        minHeight: 40,
        paddingHorizontal: space.lg,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: on ? c.ink : c.line,
        backgroundColor: on ? c.ink : c.card,
      }}
    >
      <Text style={[ty.small, { color: on ? c.bg : c.ink2, fontWeight: on ? '700' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

export function Meter({ value, label }: { value: number; label?: string }) {
  const { c } = useColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height: 6, borderRadius: 3, backgroundColor: c.cardAlt, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: c.good }} />
    </View>
  );
}
