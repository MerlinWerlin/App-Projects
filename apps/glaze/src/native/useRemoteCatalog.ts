// T160 (owner-1030 A): the remote catalogue as gallery themes, for the Themes tab and the theme
// detail. Listing needs no entitlement (Plus packs show the Plus badge; src/plus gates the
// download). While packs are disabled (empty base URL) these return nothing and make no request.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Catalog } from '../core/packCatalog';
import { getAnyTheme } from '../core/plusThemes';
import { remoteArtFiles, remoteArtThemes, remoteThemeById, withDownloadedArt, type RemoteArtTheme } from '../core/remoteCatalog';
import { PACK_BASE_RESOLVED, PACKS_ENABLED, getPackState, refreshCatalog, remoteArtFileUri, remoteArtOnDevice, subscribePacks } from './packs';

const NONE: readonly RemoteArtTheme[] = Object.freeze([]) as readonly RemoteArtTheme[];

let memo: { catalog: Catalog | null; themes: readonly RemoteArtTheme[] } = { catalog: null, themes: NONE };

/** Catalogue packs as themes (bundled themes with the same id win), memoised per catalogue. */
function themesFor(catalog: Catalog | null): readonly RemoteArtTheme[] {
  if (memo.catalog === catalog) return memo.themes;
  const bundled = catalog ? catalog.packs.filter((p) => !!getAnyTheme(p.id)).map((p) => p.id) : [];
  const themes = catalog ? remoteArtThemes(catalog, PACK_BASE_RESOLVED, bundled) : NONE;
  memo = { catalog, themes: themes.length ? Object.freeze(themes) : NONE };
  return memo.themes;
}

const getCatalog = () => getPackState().catalog;

/**
 * Remote art-pack themes for the gallery: the cached catalogue at once, refreshed in the
 * background when it is older than 6 h. Stable array identity until the catalogue changes.
 */
export function useRemoteArtThemes(): readonly RemoteArtTheme[] {
  const catalog = useSyncExternalStore(subscribePacks, getCatalog, getCatalog);
  useEffect(() => {
    if (PACKS_ENABLED) void refreshCatalog(false);
  }, []);
  return themesFor(catalog);
}

/** Pull to refresh: fetch catalog.json now (no-op while packs are disabled). Never rejects. */
export function refreshRemoteCatalog(): Promise<void> {
  return refreshCatalog(true);
}

export type RemoteArtLocal = {
  /** The remote theme (with the downloaded credit / heroes once on the phone), or undefined. */
  theme: RemoteArtTheme | undefined;
  /** file:// URI of the downloaded wallpaper (null until downloaded and verified). */
  wallpaperUri: string | null;
  /** file:// URI of the downloaded thumbnail, or null. */
  thumbUri: string | null;
};

/** One remote theme by id plus its downloaded files (verified on first read). */
export function useRemoteArtTheme(id: string | null | undefined): RemoteArtLocal {
  const themes = useRemoteArtThemes();
  const base = remoteThemeById(themes, id);
  const store = useSyncExternalStore(subscribePacks, getPackState, getPackState);
  const downloaded = base ? store.index.packs.some((p) => p.id === base.id) : false;
  const local = base ? store.remoteArt[base.id] : undefined;
  useEffect(() => {
    if (base && downloaded && !local) void remoteArtOnDevice(base.id);
  }, [base, downloaded, local]);
  return useMemo(() => {
    if (!base || !local) return { theme: base, wallpaperUri: null, thumbUri: null };
    const files = remoteArtFiles(local);
    return {
      theme: withDownloadedArt(base, local),
      wallpaperUri: remoteArtFileUri(base.id, files.wallpaper),
      thumbUri: remoteArtFileUri(base.id, files.thumb),
    };
  }, [base, local]);
}
