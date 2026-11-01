import { useColorScheme } from 'react-native';
import type { Rarity } from '../core/species';

const light = {
  bg: '#FBF7F0',
  card: '#FFFFFF',
  cardAlt: '#F3EDE3',
  ink: '#2B2233',
  ink2: '#5E5568',
  ink3: '#8E8698',
  line: '#E6DDD0',
  accent: '#6C5CE7',
  accentInk: '#FFFFFF',
  accentSoft: '#ECE9FD',
  spark: '#F4B740',
  good: '#3E9A6A',
  meterTrack: '#EEE6D9',
  nest: '#F6EBD8',
};

const dark: typeof light = {
  bg: '#16131C',
  card: '#221E2B',
  cardAlt: '#2B2636',
  ink: '#F4F0F8',
  ink2: '#C3BBCF',
  ink3: '#8D85A0',
  line: '#383246',
  accent: '#9C8FFF',
  accentInk: '#16131C',
  accentSoft: '#2E2850',
  spark: '#F7C65C',
  good: '#5FC28E',
  meterTrack: '#2E2939',
  nest: '#2A2433',
};

export type Colors = typeof light;

export function useColors(): { c: Colors; dark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { c: isDark ? dark : light, dark: isDark };
}

export const rarityColor: Record<Rarity, string> = {
  common: '#9A93A6',
  uncommon: '#3E9A6A',
  rare: '#3B7DD8',
  shimmer: '#D99A1E',
  mythic: '#C2418F',
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const type = {
  title: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '700' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
};

/** One motion file: three durations, no bouncy springs. */
export const motion = { fast: 120, base: 200, slow: 320 };
