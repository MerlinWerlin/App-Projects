import type { ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Rarity } from '../core/species';
import { t } from '../i18n';
import { type Colors, radius, rarityColor, space, type as ty, useColors } from '../theme/tokens';
import { useHaptics } from './haptics';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { c } = useColors();
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: c.line }, style]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'soft' | 'plain';
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}) {
  const { c } = useColors();
  const h = useHaptics();
  const bg = kind === 'primary' ? c.accent : kind === 'soft' ? c.accentSoft : 'transparent';
  const fg = kind === 'primary' ? c.accentInk : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        h.tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: space.xl,
          borderRadius: radius.pill,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {icon}
      <Text style={[ty.bodyBold, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Meter({ value, color, track, height = 12, label }: { value: number; color: string; track: string; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const col = rarityColor[rarity];
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1.5, borderColor: col, alignSelf: 'flex-start' }}>
      <Text style={[ty.small, { color: col, fontWeight: '700' }]}>{t(`rarity.${rarity}`)}</Text>
    </View>
  );
}

export function Title({ children, c }: { children: ReactNode; c: Colors }) {
  return <Text style={[ty.title, { color: c.ink }]} accessibilityRole="header">{children}</Text>;
}

/** A soft speckled egg. `tint` comes from the home region. */
export function Egg({ size, tint, crack = 0 }: { size: number; tint: string; crack?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel={t('a11y.egg')}>
      <Path d="M100 186 C 58 186, 40 156, 42 120 C 44 74, 70 22, 100 22 C 130 22, 156 74, 158 120 C 160 156, 142 186, 100 186 Z" fill="#FFF9EE" stroke="#3A3142" strokeWidth={3} />
      <Path d="M62 110 c 8 -6 16 -6 22 0 M118 70 c 6 -4 12 -4 16 2 M110 140 c 8 -6 18 -6 24 0" stroke={tint} strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.75} />
      <Path d="M76 160 c 4 -3 8 -3 12 0 M128 106 c 4 -3 8 -3 12 0" stroke={tint} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.5} />
      {crack > 0 ? <Path d="M70 96 L 84 108 L 94 94 L 106 110 L 118 96 L 130 106" stroke="#3A3142" strokeWidth={3} fill="none" strokeLinejoin="round" /> : null}
      {crack > 1 ? <Path d="M66 128 L 80 120 L 92 132 L 108 120 L 120 134 L 136 124" stroke="#3A3142" strokeWidth={3} fill="none" strokeLinejoin="round" /> : null}
    </Svg>
  );
}

export const regionTint: Record<string, string> = {
  oceania: '#E8834A',
  'uk-ie': '#4F8F6A',
  'north-america': '#4A79C2',
  europe: '#8A5BC2',
  japan: '#D9506E',
  'se-asia': '#2EA58F',
  wilds: '#A08C5B',
};

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}:${String(sec).padStart(2, '0')}`;
  return `${sec}s`;
}
