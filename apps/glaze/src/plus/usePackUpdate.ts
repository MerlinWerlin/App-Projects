// T222 (owner-1101e): the theme page's "Update" state for a downloaded remote art pack whose
// catalogue entry is newer (e.g. v1 on the phone with 3 widget pieces, v2 in the catalogue).
// The update normally runs by itself in the background (src/native/packs.ts runPackUpdates); this
// hook shows it pending / updating / failed and offers a manual Update. A Plus pack's manual update
// needs Glaze Plus like its download (entitlement is read only here, in src/plus).
import { useCallback, useSyncExternalStore } from 'react';
import { packUpdateView, type PackUpdateView } from '../core/packUpdates';
import type { RemoteArtRef } from '../core/remoteCatalog';
import { PACKS_ENABLED, catalogPack, downloadedPackVersionOf, getPackState, subscribePacks, updatePackNow } from '../native/packs';
import { usePlus } from './entitlement';

export type PackUpdate = {
  view: PackUpdateView;
  /** Update now (ignores the background retry backoff). 'locked' = show the Plus sheet. */
  update: () => Promise<'locked' | 'disabled' | 'ok' | 'error'>;
};

const NONE: PackUpdateView = Object.freeze({ kind: 'none' }) as PackUpdateView;

export function usePackUpdate(theme: { remoteArt?: RemoteArtRef } | null | undefined): PackUpdate {
  const { plus } = usePlus();
  const store = useSyncExternalStore(subscribePacks, getPackState, getPackState);
  const remote = theme?.remoteArt ?? null;
  const id = remote?.packId ?? null;
  const view: PackUpdateView = id
    ? packUpdateView({
        catalogVersion: catalogPack(id)?.packVersion ?? remote?.packVersion,
        downloadedVersion: downloadedPackVersionOf(id),
        progress: id in store.busy ? store.busy[id] : undefined,
        failure: store.updateFailures[id],
      })
    : NONE;
  const needsPlus = !!remote?.plus;
  const entitled = plus === true;
  const update = useCallback(async () => {
    if (!id) return 'ok' as const;
    if (needsPlus && !entitled) return 'locked' as const;
    if (!PACKS_ENABLED) return 'disabled' as const;
    return (await updatePackNow(id)) === null ? ('ok' as const) : ('error' as const);
  }, [id, needsPlus, entitled]);
  return { view: view.kind === 'none' ? NONE : view, update };
}
