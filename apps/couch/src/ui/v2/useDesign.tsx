import { createContext, useContext, type ReactNode } from 'react';
import { designPalette, remoteDesignPalette, type DesignPalette } from '../../theme/design';
import type { RemoteTheme } from '../../theme/remoteThemes';
import { useScheme } from '../../theme/useTheme';

/**
 * The v2 palette for the current subtree (market-1018 M3). App screens get the light/dark palette
 * from the Theme setting; anything on or opened from the remote is wrapped in
 * <RemoteDesignProvider theme={useRemoteTheme()}> so v2 components follow the remote theme.
 */
const DesignCtx = createContext<DesignPalette | null>(null);

export function DesignProvider({ palette, children }: { palette: DesignPalette; children: ReactNode }) {
  return <DesignCtx.Provider value={palette}>{children}</DesignCtx.Provider>;
}

export function RemoteDesignProvider({ theme, children }: { theme: RemoteTheme; children: ReactNode }) {
  return <DesignCtx.Provider value={remoteDesignPalette(theme)}>{children}</DesignCtx.Provider>;
}

export function useDesign(): DesignPalette {
  const override = useContext(DesignCtx);
  const scheme = useScheme();
  return override ?? designPalette(scheme);
}
