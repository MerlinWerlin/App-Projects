import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FAVOURITES_CAP,
  FavouritesRepo,
  applyFavouriteEdit,
  canAddFavourite,
  initialFavourites,
  sameFavourites,
  splitApps,
  type FavouriteEdit,
} from '../core/favourites';
import type { TvApp } from '../core/types';
import { savedTvStore } from './tvs';

const NO_APPS: readonly TvApp[] = [];

/**
 * Favourites for the active TV (T73), over the pure rules in src/core/favourites.ts.
 * Saved TVs persist through savedTvStore's per-TV pins (AsyncStorage via src/native/kv.ts); demo and
 * unsaved TVs keep theirs in memory until restart. Shared across mounts of the Apps tab.
 */
export const favouritesRepo = new FavouritesRepo(savedTvStore);

export interface FavouritesState {
  /** Favourite ids, reconciled with the TV's current apps (user order). */
  ids: string[];
  favourites: TvApp[];
  others: TvApp[];
  /** Below the cap, so another app can be added. */
  canAdd: boolean;
  cap: number;
  /** Applies an edit and persists it. Returns whether the list changed. */
  edit: (e: FavouriteEdit) => boolean;
}

/**
 * `apps` is the TV's current list (null while loading). Ids the TV no longer reports are hidden;
 * they leave storage on the next edit, so a briefly short list from the TV loses nothing.
 */
export function useFavourites(tvId: string | null, apps: readonly TvApp[] | null): FavouritesState {
  // undefined = not read yet; null = never saved.
  const [stored, setStored] = useState<{ tvId: string; ids: string[] | null } | undefined>(() =>
    tvId ? { tvId, ids: favouritesRepo.peek(tvId) ?? null } : undefined,
  );

  useEffect(() => {
    if (!tvId) return;
    const known = favouritesRepo.peek(tvId);
    if (known) {
      setStored({ tvId, ids: known });
      return;
    }
    let cancelled = false;
    void favouritesRepo.load(tvId).then((ids) => {
      if (!cancelled) setStored({ tvId, ids });
    });
    return () => {
      cancelled = true;
    };
  }, [tvId]);

  const saved = stored && stored.tvId === tvId ? stored.ids : null;
  const list = apps ?? NO_APPS;
  const ids = useMemo(() => initialFavourites(saved, list), [saved, list]);
  const sections = useMemo(() => splitApps(list, ids), [list, ids]);

  const edit = useCallback(
    (e: FavouriteEdit): boolean => {
      if (!tvId) return false;
      const next = applyFavouriteEdit(ids, e);
      if (sameFavourites(next, ids)) return false;
      setStored({ tvId, ids: next });
      void favouritesRepo.save(tvId, next);
      return true;
    },
    [tvId, ids],
  );

  return {
    ids,
    favourites: sections.favourites,
    others: sections.others,
    canAdd: canAddFavourite(ids),
    cap: FAVOURITES_CAP,
    edit,
  };
}
