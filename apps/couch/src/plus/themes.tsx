import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePrefs } from '../state/prefs';
import { isFreeRemoteTheme, type RemoteThemeId } from '../theme/remoteThemes';
import { RemoteThemeAccessContext, type RemoteThemeAccess } from '../theme/RemoteThemeContext';
import { tierCanUse } from './entitlement';
import { usePlus } from './state';

/**
 * Supplies remote-theme access (owner-1017 T56): whether Couch Plus unlocks themes, and the Plus
 * theme being tried this session ("Try it", in memory only). The only place that reads the
 * entitlement for themes; the remote reads the result through useRemoteTheme().
 * Buying Plus while trying keeps the tried theme. Every TV control stays free in every theme.
 */
export function PlusThemeProvider({ children }: { children: ReactNode }) {
  const { tier } = usePlus();
  const plus = tierCanUse(tier, 'themes');
  const { set } = usePrefs();
  const [trying, setTrying] = useState<RemoteThemeId | null>(null);

  // Bought Plus while trying a theme: keep it.
  useEffect(() => {
    if (plus && trying) {
      set({ remoteTheme: trying });
      setTrying(null);
    }
  }, [plus, trying, set]);

  const tryTheme = useCallback((id: RemoteThemeId | null) => {
    setTrying(id && !isFreeRemoteTheme(id) ? id : null);
  }, []);

  const value = useMemo<RemoteThemeAccess>(() => ({ plus, trying: plus ? null : trying, tryTheme }), [plus, trying, tryTheme]);
  return <RemoteThemeAccessContext.Provider value={value}>{children}</RemoteThemeAccessContext.Provider>;
}
