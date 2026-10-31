// T179 (owner-1031): the theme page of a remote catalogue theme (one of the free Codex art packs),
// pure logic only so Node tests cover it; app/theme/[id].tsx draws it.
//  - the one primary action in the glass bar: Download (with its size) > determinate progress >
//    calm Try again > Apply once the art is on the phone (a Plus pack without Plus: Unlock);
//  - which picture the hero shows (the downloaded wallpaper, else the catalogue thumbnail with its
//    thumbhash placeholder);
//  - theme lookups by id that fall back to the remote catalogue, so a remote theme never lands on
//    "Theme not found" in Widget Studio / the wallpaper maker / Your look;
//  - whether the page waits (skeleton) for the cached catalogue before saying "not found".
// Pure TS, no React Native / Expo imports.

import type { PackDetailView } from './packDetail.ts';

/** What the glass bar of a remote theme page holds. */
export type RemotePrimary =
  | { kind: 'download'; bytes: number | null }
  | { kind: 'downloading'; progress: number; percent: number }
  | { kind: 'retry'; reason: 'offline' | 'app-version' }
  | { kind: 'unlock' }
  | { kind: 'apply' };

/**
 * The one primary action for a remote theme. Every failure (offline, a 404 on the host, a damaged
 * file) reads as the calm "offline" Try again, except "needs a newer Glaze", which no retry fixes.
 * `appVersionMessage` is the localised plus.packErrors.appVersion text the store reports.
 */
export function remotePrimary(view: PackDetailView, bytes: number | null | undefined, appVersionMessage?: string | null): RemotePrimary {
  switch (view.kind) {
    case 'ready':
    case 'none':
    case 'bundled':
      return { kind: 'apply' };
    case 'locked':
      return { kind: 'unlock' };
    case 'downloading': {
      const p = Number.isFinite(view.progress) ? Math.min(1, Math.max(0, view.progress)) : 0;
      return { kind: 'downloading', progress: p, percent: Math.min(99, Math.max(0, Math.floor(view.percent))) };
    }
    case 'error':
      return { kind: 'retry', reason: appVersionMessage && view.message && view.message === appVersionMessage ? 'app-version' : 'offline' };
    default:
      return { kind: 'download', bytes: typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : null };
  }
}

/** The hero picture: the downloaded wallpaper once it is on the phone, else the catalogue thumbnail. */
export type RemoteHeroArt = { stage: 'downloaded' | 'preview' | 'placeholder'; uri: string | null };

export function remoteHeroArt(input: { wallpaperUri: string | null | undefined; thumbUrl: string | null | undefined }): RemoteHeroArt {
  const local = typeof input.wallpaperUri === 'string' && input.wallpaperUri.trim() ? input.wallpaperUri : null;
  if (local) return { stage: 'downloaded', uri: local };
  const thumb = typeof input.thumbUrl === 'string' && input.thumbUrl.trim() ? input.thumbUrl : null;
  return thumb ? { stage: 'preview', uri: thumb } : { stage: 'placeholder', uri: null };
}

/** A theme by id: bundled (incl. Plus and art packs) first, then the remote catalogue. */
export function resolveAnyTheme<T extends { id: string }>(
  id: string | null | undefined,
  bundled: (id: string) => T | undefined,
  remote: readonly T[],
): T | undefined {
  if (typeof id !== 'string' || !id) return undefined;
  return bundled(id) ?? remote.find((t) => t.id === id);
}

/**
 * What the page shows while it looks a theme up: the theme, a skeleton while the cached catalogue
 * is still being read (a remote id opened before the catalogue arrives), or "not found".
 */
export function themePageState(input: { found: boolean; packsEnabled: boolean; catalogSettled: boolean }): 'show' | 'wait' | 'missing' {
  if (input.found) return 'show';
  return input.packsEnabled && !input.catalogSettled ? 'wait' : 'missing';
}
