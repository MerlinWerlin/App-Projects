import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { isFreeRemoteTheme, type RemoteThemeId } from '../theme/remoteThemes';
import { RemoteThemeAccessContext, type RemoteThemeAccess } from '../theme/RemoteThemeContext';

/**
 * Supplies remote-theme access (owner-1017 T56). Since 25 Oct 2026 every theme is free (owner decision,
 * Workboard couch-themes-free): themes are not a Couch Plus feature, so this never reads the entitlement
 * and `plus` is always false. Picking any theme applies and keeps it (themePicker.pickTheme); "Try it"
 * only exists for a theme that is not free, and there are none. Every TV control stays free in every theme.
 */
export function PlusThemeProvider({ children }: { children: ReactNode }) {
  const [trying, setTrying] = useState<RemoteThemeId | null>(null);

  const tryTheme = useCallback((id: RemoteThemeId | null) => {
    setTrying(id && !isFreeRemoteTheme(id) ? id : null);
  }, []);

  const value = useMemo<RemoteThemeAccess>(() => ({ plus: false, trying, tryTheme }), [trying, tryTheme]);
  return <RemoteThemeAccessContext.Provider value={value}>{children}</RemoteThemeAccessContext.Provider>;
}
