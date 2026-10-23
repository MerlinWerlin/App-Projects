// Renderer hook for downloaded theme packs (T47). When a pack theme's pack is on the phone, read
// it (verified again on read), register the motifs it brings that the app doesn't ship (so
// IconCanvas / WallpaperView / ArtPaths draw them through src/core/artwork), and return the
// pack's copy of the theme so its artwork is preferred over the bundled one. Until the files are
// read, or if anything fails, the bundled theme comes back unchanged.
// Entitlement is not read here: callers pass `useDownloaded` from src/plus/usePackAccess.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { preferPackTheme } from '../core/packDetail';
import { packMotifsVersion, subscribePackMotifs } from '../core/packMotifs';
import type { Theme } from '../core/themes';
import { getPackState, packContentOnDevice, subscribePacks } from '../native/packs';

/** The registry version, so a view can re-render (and re-run its layout memos) when pack motifs arrive. */
export function usePackMotifsVersion(): number {
  return useSyncExternalStore(subscribePackMotifs, packMotifsVersion, packMotifsVersion);
}

export function usePackTheme(base: Theme, useDownloaded: boolean): Theme {
  const packId = base.packId;
  const store = useSyncExternalStore(subscribePacks, getPackState, getPackState);
  // Re-read after a re-download (Settings › Storage) changes the stored copy.
  const downloadedAt = packId ? store.index.packs.find((p) => p.id === packId)?.downloadedAt ?? null : null;
  const [loaded, setLoaded] = useState<{ key: string; themes: readonly Theme[] } | null>(null);
  const key = `${packId ?? ''}|${downloadedAt ?? ''}`;
  const active = useDownloaded && !!packId && downloadedAt !== null;

  useEffect(() => {
    if (!active || !packId) return;
    let alive = true;
    packContentOnDevice(packId).then((c) => {
      if (alive) setLoaded({ key, themes: c.themes });
    });
    return () => {
      alive = false;
    };
  }, [active, packId, key]);

  if (!active || !loaded || loaded.key !== key) return base;
  return preferPackTheme(base, loaded.themes);
}
