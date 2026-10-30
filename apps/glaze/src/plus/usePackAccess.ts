// Plus gate for downloadable theme packs (T46). Combines the Glaze Plus entitlement (read only
// here, in src/plus) with what is downloaded on the phone. One-time Glaze Plus; no subscriptions.
// Screens show the existing PlusLockSheet when `state === 'locked'`.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { isPackDownloaded, totalCacheBytes, type PackCacheEntry } from '../core/themePack';
import type { Theme } from '../core/themes';
import type { RemoteArtRef } from '../core/remoteCatalog';
import {
  PACKS_ENABLED,
  catalogPack,
  downloadPackToDevice,
  downloadRemoteArtToDevice,
  getPackState,
  loadPackIndex,
  removePackFromDevice,
  subscribePacks,
  type PackStoreState,
} from '../native/packs';
import { useT } from '../i18n';
import { usePlus } from './entitlement';

/**
 * - free: not Plus content.
 * - locked: Plus content and the person doesn't have Glaze Plus → show PlusLockSheet.
 * - ready: usable (bundled Plus theme, or its pack is downloaded).
 * - disabled: Plus owned but packs are switched off (PACK_BASE_URL empty). The pack themes' data is
 *   also bundled today, so the theme still works; Settings shows plus.packErrors.disabled (same words as PACKS_DISABLED_MESSAGE).
 * - not-downloaded / downloading / error: Plus owned, pack hosted, not on the phone yet.
 */
export type PackAccessState = 'free' | 'locked' | 'ready' | 'disabled' | 'not-downloaded' | 'downloading' | 'error';

export type PackAccess = {
  state: PackAccessState;
  /** True when the theme can be previewed and applied now. */
  usable: boolean;
  /** 0..1 while downloading. */
  progress: number;
  error: string | null;
  /** Start or resume the download. Returns 'locked' (show the Plus sheet) without touching the network if not entitled. */
  download: () => Promise<'locked' | 'disabled' | 'ok' | 'error'>;
};

function usePackStore(): PackStoreState {
  const s = useSyncExternalStore(subscribePacks, getPackState, getPackState);
  useEffect(() => {
    void loadPackIndex();
  }, []);
  return s;
}

/**
 * T160: a remote art pack (catalogue theme with `remoteArt`) always needs its download, free or
 * Plus: free packs download without Plus; Plus packs are 'locked' without it (show PlusLockSheet).
 */
export function usePackAccess(theme: (Pick<Theme, 'plus' | 'packId'> & { remoteArt?: RemoteArtRef }) | null | undefined): PackAccess {
  const { plus } = usePlus();
  const store = usePackStore();
  const remote = theme?.remoteArt ?? null;
  const packId = remote ? remote.packId : theme?.packId;
  const entitled = plus === true;
  const needsPlus = remote ? remote.plus : !!theme?.plus;

  let state: PackAccessState;
  if (remote) {
    if (needsPlus && !entitled) state = 'locked';
    else if (isPackDownloaded(store.index, remote.packId)) state = 'ready';
    else if (!PACKS_ENABLED) state = 'disabled';
    else if (remote.packId in store.busy) state = 'downloading';
    else if (store.errors[remote.packId]) state = 'error';
    else state = 'not-downloaded';
  } else if (!theme || !theme.plus) state = 'free';
  else if (!entitled) state = 'locked';
  else if (!packId || isPackDownloaded(store.index, packId)) state = 'ready';
  else if (!PACKS_ENABLED) state = 'disabled';
  else if (packId in store.busy) state = 'downloading';
  else if (store.errors[packId]) state = 'error';
  else state = 'not-downloaded';

  const remoteId = remote?.packId ?? null;
  const download = useCallback(async () => {
    if (needsPlus && !entitled) return 'locked' as const;
    if (!packId) return 'ok' as const;
    if (!PACKS_ENABLED) return 'disabled' as const;
    const err = remoteId ? await downloadRemoteArtToDevice(remoteId) : await downloadPackToDevice(packId);
    return err === null ? ('ok' as const) : ('error' as const);
  }, [needsPlus, entitled, packId, remoteId]);

  return {
    state,
    usable: remote ? state === 'ready' : state === 'free' || state === 'ready' || state === 'disabled',
    progress: packId ? (store.busy[packId] ?? 0) : 0,
    error: packId ? store.errors[packId] || null : null,
    download,
  };
}

export type PackStorage = {
  packs: readonly PackCacheEntry[];
  totalBytes: number;
  enabled: boolean;
  disabledMessage: string;
  /** Progress 0..1 per pack id being (re)downloaded. */
  busy: Readonly<Record<string, number>>;
  errors: Readonly<Record<string, string>>;
  /** Removing is always allowed (it frees space). */
  remove: (packId: string) => Promise<void>;
  /** Fresh copy: delete then download. 'locked' means show the Plus sheet. */
  redownload: (packId: string) => Promise<'locked' | 'disabled' | 'ok' | 'error'>;
};

/** Settings › Storage: what's downloaded, how big, remove / re-download. */
export function usePackStorage(): PackStorage {
  const { plus } = usePlus();
  const { t } = useT();
  const store = usePackStore();
  const remove = useCallback((id: string) => removePackFromDevice(id), []);
  const redownload = useCallback(
    async (id: string) => {
      // T160: a free remote art pack re-downloads without Plus.
      const remote = catalogPack(id);
      if (plus !== true && !(remote && !remote.plus)) return 'locked' as const;
      if (!PACKS_ENABLED) return 'disabled' as const;
      await removePackFromDevice(id);
      return (await downloadPackToDevice(id)) === null ? ('ok' as const) : ('error' as const);
    },
    [plus],
  );
  return {
    packs: store.index.packs,
    totalBytes: totalCacheBytes(store.index),
    enabled: PACKS_ENABLED,
    disabledMessage: t('plus.packErrors.disabled'),
    busy: store.busy,
    errors: store.errors,
    remove,
    redownload,
  };
}
