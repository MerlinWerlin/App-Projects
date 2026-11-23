/**
 * Groutline's look: a site-board palette. Warm porcelain ground, near-black ink, one loud safety-orange accent
 * that always carries dark ink (never white text on orange: 4.5:1+ contrast either way). Big condensed numerals for
 * answers you read at arm's length with gloves on.
 */
import { useColorScheme } from 'react-native';

export interface Theme {
  dark: boolean;
  ground: string;
  sheet: string;
  sunk: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  grout: string;
  accent: string;
  onAccent: string;
  good: string;
  warn: string;
  bad: string;
  tile: string;
  tileCut: string;
}

export const LIGHT: Theme = {
  dark: false,
  ground: '#F2EFE8',
  sheet: '#FFFFFF',
  sunk: '#E7E2D7',
  ink: '#15171A',
  ink2: '#4A4F57',
  ink3: '#6B7079',
  line: '#D6D0C3',
  grout: '#B9B2A3',
  accent: '#FF6A1A',
  onAccent: '#15171A',
  good: '#1F7A4D',
  warn: '#9A5B00',
  bad: '#B3261E',
  tile: '#FFFFFF',
  tileCut: '#FFD9BF',
};

export const DARK: Theme = {
  dark: true,
  ground: '#0F1113',
  sheet: '#1A1D21',
  sunk: '#24282D',
  ink: '#F4F1EA',
  ink2: '#C3C0B8',
  ink3: '#9C9A93',
  line: '#33383E',
  grout: '#4A5057',
  accent: '#FF7A2E',
  onAccent: '#15171A',
  good: '#5BC48B',
  warn: '#F2B15C',
  bad: '#FF8A80',
  tile: '#2C3136',
  tileCut: '#6B3A1C',
};

export const useTheme = (): Theme => (useColorScheme() === 'dark' ? DARK : LIGHT);

export const SPACE = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, gutter: 20 } as const;
export const RADIUS = { field: 14, card: 20, chip: 999 } as const;

/** Display numerals: Barlow Condensed (OFL). Body text stays on the system font so it follows Dynamic Type. */
export const FONT = { numBold: 'BarlowCondensed_700Bold', numSemi: 'BarlowCondensed_600SemiBold' } as const;

/** Minimum control height: Apple asks for 44 pt; we use 56 so it works in work gloves. */
export const TAP = 56;
