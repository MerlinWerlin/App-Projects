// T103: what the theme detail and gallery need to know about a photo theme (Space / Webb).
// `photoThemeOf(theme)` says whether a theme is a photo theme; `usePhotoTheme(theme)` gives its
// download state, the local file URI once downloaded, and download()/remove(). download() must be
// called only from a person's tap: it is the one network request (src/native/photoPacks.ts).
// T108: `view` is the tested Download control state (src/core/photoPack.ts photoDownloadView): a
// failed download is a friendly offline / error state with Retry, never "ready".
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  downloadedPhotoRows,
  isPhotoTheme,
  photoDownloadView,
  type DownloadedPhotoRow,
  type PhotoDownloadView,
  type PhotoFailure,
  type PhotoTheme,
} from '../core/photoPack';
import { SPACE_THEMES, spaceThemeById } from '../core/spacePack';
import type { Theme } from '../core/themes';
import {
  downloadPhotoTheme,
  getPhotoState,
  photoEntry,
  refreshPhoto,
  removePhotoTheme,
  subscribePhotos,
  type PhotoStatus,
} from '../native/photoPacks';

export { SPACE_THEMES };

/** The photo theme for a theme or id (null when it is not a photo theme). */
export function photoThemeOf(theme: Theme | string | null | undefined): PhotoTheme | null {
  if (!theme) return null;
  if (typeof theme === 'string') return spaceThemeById(theme) ?? null;
  return isPhotoTheme(theme) ? theme : (spaceThemeById(theme.id) ?? null);
}

export function isPhotoThemeId(id: string | null | undefined): boolean {
  return !!id && !!spaceThemeById(id);
}

export type PhotoThemeState = {
  photo: PhotoTheme | null;
  status: PhotoStatus;
  /** 0..1 while downloading. */
  progress: number;
  /** file:// URI of the downloaded photo (use as the wallpaper), or null. */
  uri: string | null;
  error: string;
  /** Why the last download failed (null unless status is 'error'). */
  failure: PhotoFailure | null;
  /** Size of the downloaded file (0 until downloaded). */
  bytes: number;
  /** What the Download control shows. */
  view: PhotoDownloadView;
  /** Start the download (also Retry). Call only from a tap. Resolves null or a user-facing error. */
  download: () => Promise<string | null>;
  remove: () => Promise<void>;
};

export type DownloadedPhotos = {
  rows: DownloadedPhotoRow[];
  totalBytes: number;
  /** Delete one downloaded photo (no network). */
  remove: (themeId: string) => Promise<void>;
};

/**
 * T105: downloaded Space photos for Settings › Storage. Looks on the phone only (no network): each
 * Space theme's meta file is read once per session.
 */
export function useDownloadedPhotos(): DownloadedPhotos {
  const state = useSyncExternalStore(subscribePhotos, getPhotoState, getPhotoState);
  useEffect(() => {
    for (const s of SPACE_THEMES) void refreshPhoto(s);
  }, []);
  const remove = useCallback(async (themeId: string) => {
    const s = spaceThemeById(themeId);
    if (s) await removePhotoTheme(s);
  }, []);
  const { rows, totalBytes } = downloadedPhotoRows(SPACE_THEMES, state);
  return { rows, totalBytes, remove };
}

export function usePhotoTheme(theme: Theme | string | null | undefined): PhotoThemeState {
  const photo = photoThemeOf(theme);
  useSyncExternalStore(subscribePhotos, getPhotoState, getPhotoState);
  useEffect(() => {
    if (photo) void refreshPhoto(photo); // local look-up only, no network
  }, [photo]);
  const download = useCallback(async () => (photo ? downloadPhotoTheme(photo) : null), [photo]);
  const remove = useCallback(async () => {
    if (photo) await removePhotoTheme(photo);
  }, [photo]);
  const e = photo ? photoEntry(photo.id) : null;
  const status: PhotoStatus = e?.status ?? 'not-downloaded';
  const progress = e?.progress ?? 0;
  const failure = e?.failure ?? null;
  return {
    photo,
    status,
    progress,
    uri: e?.uri ?? null,
    error: e?.error ?? '',
    failure,
    bytes: e?.bytes ?? 0,
    view: photoDownloadView({ status, progress, failure }),
    download,
    remove,
  };
}
