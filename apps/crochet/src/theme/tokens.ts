// Colour, type and spacing tokens (light + dark). Warm "yarn basket" palette: oat paper, cocoa ink,
// a berry accent, and soft yarn colours for project cards.
import { useColorScheme } from 'react-native';
import { useSettings } from '../store/settings';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  good: string;
  warn: string;
  danger: string;
  overlay: string;
  highlight: string;
}

const light: Palette = {
  bg: '#FBF6EF',
  surface: '#FFFFFF',
  surface2: '#F3EBE0',
  ink: '#2E2420',
  ink2: '#6B5B53',
  ink3: '#9C8D84',
  line: '#E8DDD0',
  accent: '#B5476A',
  accentInk: '#FFFFFF',
  accentSoft: '#F6DDE5',
  good: '#4F8A62',
  warn: '#C27B1E',
  danger: '#B83A3A',
  overlay: 'rgba(46,36,32,0.45)',
  highlight: 'rgba(255, 214, 102, 0.42)',
};

const dark: Palette = {
  bg: '#191412',
  surface: '#241D1A',
  surface2: '#2F2622',
  ink: '#F6EDE6',
  ink2: '#C4B4AA',
  ink3: '#8E7F76',
  line: '#3A302B',
  accent: '#E07A9B',
  accentInk: '#1B1012',
  accentSoft: '#4A2632',
  good: '#7CC392',
  warn: '#E5A64C',
  danger: '#F07A7A',
  overlay: 'rgba(0,0,0,0.6)',
  highlight: 'rgba(255, 214, 102, 0.30)',
};

/** Soft yarn colours for project cards: [light bg, dark bg, ink]. */
export const YARN: Record<string, { light: string; dark: string; ink: string }> = {
  rose: { light: '#F7D9DE', dark: '#4B2A31', ink: '#9C3A55' },
  sage: { light: '#DCE8D5', dark: '#2C3A2B', ink: '#4D7A4A' },
  butter: { light: '#F8EBC4', dark: '#45391E', ink: '#94721C' },
  sky: { light: '#D6E6F3', dark: '#22323F', ink: '#3E6E95' },
  lilac: { light: '#E5DCF2', dark: '#352A44', ink: '#6E52A0' },
  peach: { light: '#F8DFCE', dark: '#47301F', ink: '#B0612E' },
  mint: { light: '#D3EEE4', dark: '#1F3B33', ink: '#2F8068' },
  clay: { light: '#EFD5CB', dark: '#442A22', ink: '#A04D36' },
};

export const font = {
  display: 'Fraunces_700Bold',
  displayMed: 'Fraunces_600SemiBold',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
} as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 10, m: 16, l: 22, xl: 28, pill: 999 } as const;
/** Minimum touch target (pt). */
export const TOUCH = 48;

export function useColors(): { c: Palette; dark: boolean } {
  const sys = useColorScheme();
  const { appearance } = useSettings();
  const dark = appearance === 'dark' || (appearance === 'system' && sys === 'dark');
  return { c: dark ? darkPalette : lightPalette, dark };
}

export const lightPalette = light;
export const darkPalette = dark;

export function yarnColour(key: string, dark: boolean): { bg: string; ink: string } {
  const y = YARN[key] ?? YARN.rose;
  return { bg: dark ? y.dark : y.light, ink: dark ? '#F6EDE6' : y.ink };
}
