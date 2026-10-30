// T179 (owner-1031): theme lookups by id that also find remote catalogue themes (the free Codex art
// packs), so a remote theme never falls into "Theme not found" in Widget Studio, the wallpaper
// maker, Your look or the Icons tab. Bundled themes keep winning (getAnyTheme first), so lookups of
// themes people already applied are unchanged. Uses the existing exports of useRemoteCatalog /
// packs only (T178 owns those files).
import { useEffect, useState } from 'react';
import { getAnyTheme } from '../core/plusThemes';
import { remoteArtFiles } from '../core/remoteCatalog';
import { resolveAnyTheme } from '../core/remoteThemePage';
import type { Theme } from '../core/themes';
import { PACKS_ENABLED, getPackState, refreshCatalog, remoteArtFileUri, remoteArtOnDevice } from './packs';
import { useRemoteArtTheme } from './useRemoteCatalog';

/** A bundled theme by id, else the remote catalogue theme (with its downloaded art once on the phone). */
export function useAnyTheme(id: string | null | undefined): Theme | undefined {
  const key = typeof id === 'string' && id ? id : null;
  const bundled = key ? getAnyTheme(key) : undefined;
  const remote = useRemoteArtTheme(bundled ? null : key);
  return resolveAnyTheme<Theme>(key, () => bundled, remote.theme ? [remote.theme] : []);
}

/** Longest wait for the cached catalogue before a page says "not found" (ms). */
const SETTLE_CAP_MS = 4000;

/**
 * True once the remote catalogue has been read (cache, plus a fetch when one was due), or at once
 * when packs are disabled or a catalogue is already in memory. Capped so offline never hangs.
 */
export function useCatalogSettled(): boolean {
  const [settled, setSettled] = useState<boolean>(() => !PACKS_ENABLED || getPackState().catalog !== null);
  useEffect(() => {
    if (settled) return;
    let alive = true;
    const done = () => {
      if (alive) setSettled(true);
    };
    const timer = setTimeout(done, SETTLE_CAP_MS);
    refreshCatalog(false).then(done, done);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [settled]);
  return settled;
}

/**
 * file:// URI of a downloaded remote pack's wallpaper, read (and verified) now if the page has not
 * resolved it yet, so Apply's Wallpaper step never saves the drawn fallback by mistake. Null when
 * the pack is not (or no longer) on the phone. Never rejects.
 */
export async function downloadedRemoteWallpaper(id: string): Promise<string | null> {
  try {
    const m = getPackState().remoteArt[id] ?? (await remoteArtOnDevice(id));
    return m ? remoteArtFileUri(id, remoteArtFiles(m).wallpaper) : null;
  } catch {
    return null;
  }
}
