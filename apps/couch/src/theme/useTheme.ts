import { useContext } from 'react';
import { useColorScheme } from 'react-native';
import { resolveScheme } from '../core/prefs';
import { ThemePrefContext } from '../state/prefs';
import { palette, type Palette } from './tokens';

/** Resolved 'light' | 'dark' from the Theme setting ('system' follows the OS). */
export function useScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const pref = useContext(ThemePrefContext);
  return resolveScheme(pref, system);
}

export function useTheme(): Palette {
  return palette(useScheme());
}
