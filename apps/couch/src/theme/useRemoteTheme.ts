import { useContext } from 'react';
import { RemoteThemePrefContext } from '../state/prefs';
import { effectiveRemoteTheme, type RemoteTheme } from './remoteThemes';
import { useRemoteThemeAccess } from './RemoteThemeContext';

/**
 * The remote's theme (owner-1017 T56): the chosen theme (Settings → Remote theme, remembered per
 * device), the Plus theme being tried this session, or Midnight when a Plus theme is chosen without
 * Plus. Every remote control, the sheets opened from the remote and the cinema glow read this
 * instead of useTheme(). Themes change colours and feel only, never what a button does.
 */
export function useRemoteTheme(): RemoteTheme {
  const chosen = useContext(RemoteThemePrefContext);
  const { plus, trying } = useRemoteThemeAccess();
  return effectiveRemoteTheme(chosen, { plus, trying });
}
