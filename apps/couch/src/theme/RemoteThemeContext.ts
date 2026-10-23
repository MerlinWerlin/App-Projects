import { createContext, useContext } from 'react';
import type { RemoteThemeId } from './remoteThemes';

/**
 * Who may show a Couch Plus remote theme right now (owner-1017 T56).
 *
 * Only src/plus/ may read the entitlement (tests/plus-guard.test.ts), so the value is provided by
 * PlusThemeProvider in src/plus/themes.tsx at the root (app/_layout.tsx). The remote reads it only
 * through useRemoteTheme(), never the entitlement itself. Outside the provider nothing is unlocked
 * and nothing is being tried, so the remote shows the chosen free theme or Midnight.
 */
export interface RemoteThemeAccess {
  /** Couch Plus is owned (themes are unlocked). */
  plus: boolean;
  /** The Plus theme being tried this session ("Try it"), or null. Not persisted. */
  trying: RemoteThemeId | null;
  /** Start trying a Plus theme (null stops trying). Free themes are never "tried". */
  tryTheme: (id: RemoteThemeId | null) => void;
}

export const NO_THEME_ACCESS: RemoteThemeAccess = Object.freeze({ plus: false, trying: null, tryTheme: () => {} });

export const RemoteThemeAccessContext = createContext<RemoteThemeAccess>(NO_THEME_ACCESS);

export function useRemoteThemeAccess(): RemoteThemeAccess {
  return useContext(RemoteThemeAccessContext);
}
