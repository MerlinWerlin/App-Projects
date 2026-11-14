// 1.0.35 (owner TestFlight 2026-11-14 04:03 on the Wallpapers tab: "This should have downloaded wall papers as well"):
// the wallpapers of the art-pack themes downloaded to this phone, for the Wallpapers tab. Read from the pack store
// (the same verified files the theme page uses); a pack whose manifest is not read yet is read once in the background.
// Nothing is downloaded here and nothing leaves the phone.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { remoteArtFiles } from '../core/remoteCatalog';
import { getPackState, remoteArtFileUri, remoteArtOnDevice, subscribePacks } from './packs';
import { useRemoteArtThemes } from './useRemoteCatalog';

/** One downloaded theme's wallpaper: the theme id and name, and its file:// URI (null until the pack is read). */
export type DownloadedThemeWallpaper = { id: string; name: string; uri: string | null };

export function useDownloadedThemeWallpapers(): readonly DownloadedThemeWallpaper[] {
  const themes = useRemoteArtThemes();
  const store = useSyncExternalStore(subscribePacks, getPackState, getPackState);
  const downloaded = useMemo(() => {
    const ids = new Set(store.index.packs.map((p) => p.id));
    return themes.filter((t) => ids.has(t.id));
  }, [themes, store.index.packs]);
  // Read each downloaded pack's manifest once (verified), so its wallpaper file is known.
  useEffect(() => {
    for (const t of downloaded) {
      if (!store.remoteArt[t.id]) Promise.resolve(remoteArtOnDevice(t.id)).catch(() => undefined);
    }
  }, [downloaded, store.remoteArt]);
  return useMemo(
    () =>
      downloaded.map((t) => {
        const local = store.remoteArt[t.id];
        let uri: string | null = null;
        if (local) {
          try {
            uri = remoteArtFileUri(t.id, remoteArtFiles(local).wallpaper);
          } catch {
            uri = null; // T264: a malformed manifest shows no picture, never a crash.
          }
        }
        return { id: t.id, name: t.name, uri };
      }),
    [downloaded, store.remoteArt],
  );
}
