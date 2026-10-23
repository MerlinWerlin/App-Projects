import { useColorScheme } from 'react-native';
import { paletteFor, type PaletteV2, type Scheme } from './tokensV2';

/** Design v2 palette + scheme for the system appearance (docs/DESIGN_V2.md). */
export function useColorsV2(): { c: PaletteV2; scheme: Scheme } {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { c: paletteFor(scheme), scheme };
}
