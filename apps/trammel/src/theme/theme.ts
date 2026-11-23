// Trammel's "Blade" design system: a tape-measure blade. Results sit on high-vis yellow with heavy black condensed
// numerals (the most legible pairing in full sun: ~15:1 contrast), everything else is ink on warm site paper, or
// paper on near-black at night. One accent (blade yellow); red, amber and green only for the NCC/fit checks.
import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  bg: string;
  card: string;
  sunk: string;
  ink: string;
  muted: string;
  line: string;
  blade: string;
  bladeInk: string;
  bladeTick: string;
  ok: string;
  warn: string;
  bad: string;
  okBg: string;
  warnBg: string;
  badBg: string;
  focus: string;
};

export const light: Theme = {
  dark: false,
  bg: '#F2EFE8',
  card: '#FFFFFF',
  sunk: '#E7E3D9',
  ink: '#151412',
  muted: '#5A564E',
  line: '#D3CEC2',
  blade: '#FFC21A',
  bladeInk: '#111111',
  bladeTick: '#1A1A1A',
  ok: '#17663A',
  warn: '#8A5A00',
  bad: '#B3261E',
  okBg: '#E2F2E7',
  warnBg: '#FBF0D6',
  badBg: '#FBE3E0',
  focus: '#151412',
};

export const dark: Theme = {
  dark: true,
  bg: '#0E0E0D',
  card: '#1A1A18',
  sunk: '#242421',
  ink: '#F4F1EA',
  muted: '#B2ADA2',
  line: '#34332F',
  blade: '#FFC21A',
  bladeInk: '#111111',
  bladeTick: '#1A1A1A',
  ok: '#6FD39A',
  warn: '#F2C14E',
  bad: '#FF8A7A',
  okBg: '#14271C',
  warnBg: '#2C2410',
  badBg: '#33150F',
  focus: '#FFC21A',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodyBold: 'Barlow_600SemiBold',
  display: 'BarlowCondensed_700Bold',
  displayHeavy: 'BarlowCondensed_800ExtraBold',
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { s: 8, m: 12, l: 18 };
/** Glove-friendly: every control is at least this tall (Apple's minimum is 44). */
export const TOUCH = 56;
