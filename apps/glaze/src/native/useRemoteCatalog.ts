// T160 (owner-1030 A): the remote catalogue as gallery themes, for the Themes tab and the theme
// detail. Listing needs no entitlement (Plus packs show the Plus badge; src/plus gates the
// download). While packs are disabled (empty base URL) these return nothing and make no request.
// T178: also re-checks when the app comes back to the foreground (refreshCatalog decides whether
// a request is due: new build, empty / failed catalogue after 2 min, or 6 h old), and exposes the
// catalogue status so the Themes tab can show skeletons on the first load instead of an empty state.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { HeroSize } from '../core/artPack';
import type { Catalog } from '../core/packCatalog';
import { getAnyTheme } from '../core/plusThemes';
import { remoteArtFiles, remoteArtThemes, remoteThemeById, withDownloadedArt, type CatalogStatus, type RemoteArtTheme } from '../core/remoteCatalog';
import { PACK_BASE_RESOLVED, PACKS_ENABLED, getPackState, refreshCatalog, remoteArtFileUri, remoteArtOnDevice, subscribePacks } from './packs';

export type { CatalogStatus } from '../core/remoteCatalog';

const NONE: readonly RemoteArtTheme[] = Object.freeze([]) as readonly RemoteArtTheme[];

let focusHooked = false;

/** One app-wide listener: coming back to the foreground re-checks the catalogue (never throws). */
function hookFocusRefresh(): void {
  if (focusHooked || !PACKS_ENABLED) return;
  focusHooked = true;
  try {
    AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshCatalog(false);
    });
  } catch {
    // No AppState (tests / web): the mount-time check still runs.
  }
}

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
    if (!PACKS_ENABLED) return;
    hookFocusRefresh();
    void refreshCatalog(false);
  }, []);
  return themesFor(catalog);
}

const getStatus = () => getPackState().catalogStatus;

/**
 * T178: the remote collection's status for the Themes tab: 'loading' (first load, show skeletons),
 * 'ready', 'empty', 'unavailable' (offline / 404: show nothing alarming, pull to refresh retries)
 * or 'disabled'. Pair with useRemoteArtThemes() (which starts the load).
 */
export function useRemoteCatalogStatus(): CatalogStatus {
  return useSyncExternalStore(subscribePacks, getStatus, getStatus);
}

/** T178: true while catalog.json is being fetched (e.g. for a pull-to-refresh spinner). */
export function useRemoteCatalogRefreshing(): boolean {
  const get = () => getPackState().catalogRefreshing;
  return useSyncExternalStore(subscribePacks, get, get);
}

/** Pull to refresh: fetch catalog.json now, always (no-op while packs are disabled). Never rejects. */
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
  /** T168: file:// URIs of the downloaded transparent hero art per widget size (seamless widgets). */
  heroUris: Partial<Record<HeroSize, string>>;
};

const NO_HERO_URIS: Partial<Record<HeroSize, string>> = Object.freeze({});

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
    if (!base || !local) return { theme: base, wallpaperUri: null, thumbUri: null, heroUris: NO_HERO_URIS };
    const files = remoteArtFiles(local);
    const heroUris: Partial<Record<HeroSize, string>> = {};
    for (const s of Object.keys(files.heroes) as HeroSize[]) {
      const uri = remoteArtFileUri(base.id, files.heroes[s]);
      if (uri) heroUris[s] = uri;
    }
    return {
      theme: withDownloadedArt(base, local),
      wallpaperUri: remoteArtFileUri(base.id, files.wallpaper),
      thumbUri: remoteArtFileUri(base.id, files.thumb),
      heroUris,
    };
  }, [base, local]);
}
