import { Platform, useColorScheme } from 'react-native';

// Warm paper and ink. The artwork itself always stays on white paper; only the chrome follows dark mode.
const light = {
  bg: '#F4EDE1',
  card: '#FFFDF8',
  cardAlt: '#EFE6D6',
  ink: '#2B2622',
  ink2: '#5F564E',
  ink3: '#8F857B',
  line: '#E2D7C5',
  accent: '#B5523B',
  accentInk: '#FFFFFF',
  accentSoft: '#F3DED5',
  good: '#5E7349',
  scrim: 'rgba(43,38,34,0.06)',
  canvas: '#E9E1D3',
};

const dark: typeof light = {
  bg: '#1C1917',
  card: '#26221F',
  cardAlt: '#302B27',
  ink: '#F3ECE2',
  ink2: '#CFC4B6',
  ink3: '#9A8F83',
  line: '#3A342F',
  accent: '#E08263',
  accentInk: '#1C1917',
  accentSoft: '#3D2B24',
  good: '#9BB37E',
  scrim: 'rgba(0,0,0,0.25)',
  canvas: '#141210',
};

export type Colors = typeof light;

export function useColors(): { c: Colors; dark: boolean } {
  const isDark = useColorScheme() === 'dark';
  return { c: isDark ? dark : light, dark: isDark };
}

/** Line art colours: never themed, it is a printed page. */
export const ART = { paper: '#FFFFFF', ink: '#2B2622' };

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const type = {
  title: { fontSize: 32, fontWeight: '700' as const, fontFamily: serif },
  h2: { fontSize: 20, fontWeight: '700' as const, fontFamily: serif },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '700' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
};

/** One motion file: three durations, no bouncy springs. */
export const motion = { fast: 120, base: 200, slow: 320, flight: 900 };
