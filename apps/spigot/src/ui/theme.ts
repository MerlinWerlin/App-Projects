/**
 * Spigot design tokens. Built for a job site: black on hi-vis yellow for actions, huge condensed numerals,
 * 4.5:1+ contrast everywhere (most pairs are 10:1+) so results stay readable in direct sun and with sunnies on.
 */
import { useColorScheme } from 'react-native';
import { useApp } from '../state/AppState';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  ink: string;
  ink2: string;
  ink3: string;
  /** Hi-vis yellow: primary buttons and result numerals on the dark result panel. */
  vis: string;
  onVis: string;
  /** Copper: brand, links, selected chips. */
  copper: string;
  onCopper: string;
  panel: string;
  onPanel: string;
  onPanel2: string;
  danger: string;
  warnBg: string;
  warnInk: string;
  scheme: 'light' | 'dark';
}

export const light: Palette = {
  bg: '#F4F1EA',
  surface: '#FFFFFF',
  surface2: '#EAE5DA',
  line: '#D5CEBF',
  ink: '#121417',
  ink2: '#3E434A',
  ink3: '#5F656D',
  vis: '#FFCC00',
  onVis: '#121417',
  copper: '#A8481A',
  onCopper: '#FFFFFF',
  panel: '#15181C',
  onPanel: '#FFFFFF',
  onPanel2: '#C9CDD3',
  danger: '#B3261E',
  warnBg: '#FFF1C2',
  warnInk: '#4A3800',
  scheme: 'light',
};

export const dark: Palette = {
  bg: '#0E1012',
  surface: '#1A1D21',
  surface2: '#24282D',
  line: '#353A41',
  ink: '#F5F3EE',
  ink2: '#C9CDD3',
  ink3: '#9EA4AC',
  vis: '#FFCC00',
  onVis: '#121417',
  copper: '#F08A4B',
  onCopper: '#121417',
  panel: '#000000',
  onPanel: '#FFFFFF',
  onPanel2: '#C9CDD3',
  danger: '#FF8A80',
  warnBg: '#3A2F00',
  warnInk: '#FFE58A',
  scheme: 'dark',
};

export const font = {
  display: 'BarlowCondensed_700Bold',
  displayHeavy: 'BarlowCondensed_800ExtraBold',
  displayMedium: 'BarlowCondensed_600SemiBold',
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { s: 10, m: 14, l: 20, pill: 999 };
/** Glove-friendly minimum hit size (Apple's minimum is 44 pt). */
export const HIT = 56;

export function usePalette(): Palette {
  const system = useColorScheme();
  const { prefs } = useApp();
  const mode = prefs.appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : prefs.appearance;
  return mode === 'dark' ? dark : light;
}
