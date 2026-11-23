import { useColorScheme } from 'react-native';
import { DARK, LIGHT, type Palette } from './palette.ts';

export { DARK, LIGHT, type Palette };

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

export const FONT = {
  numeral: 'BarlowCondensed_700Bold',
  numeralMedium: 'BarlowCondensed_600SemiBold',
  display: 'BarlowCondensed_800ExtraBold',
};

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const RADIUS = { sm: 10, md: 16, lg: 22 };
/** Glove-friendly: every tappable thing is at least this tall. */
export const TOUCH = 56;
