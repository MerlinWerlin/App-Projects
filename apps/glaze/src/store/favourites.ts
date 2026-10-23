// T77: liked themes (the heart on Themes cards) and liked wallpapers (the heart on Wallpapers
// tiles). Device-local only: AsyncStorage `glaze.favourites.v1` (themes) and
// `glaze.wallpaperFavourites.v1` (wallpapers, by theme id) = { liked: [id, ...] }, oldest like
// first. Never uploaded, never counted. Pure rules (parse, toggle, ordering) live in
// src/core/discovery.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { FAVOURITES_KEY, WALLPAPER_FAVOURITES_KEY, parseFavourites, serializeFavourites, toggleFavourite } from '../core/discovery';

type Listener = (liked: string[]) => void;

type FavouritesStore = {
  load: () => Promise<string[]>;
  toggle: (id: string) => Promise<string[]>;
  subscribe: (fn: Listener) => () => void;
  cached: () => string[] | null;
};

/** One device-local list of liked ids under `key`. */
function createFavouritesStore(key: string): FavouritesStore {
  let cache: string[] | null = null;
  const listeners = new Set<Listener>();

  async function load(): Promise<string[]> {
    if (cache) return cache;
    try {
      cache = parseFavourites(await AsyncStorage.getItem(key));
    } catch {
      cache = [];
    }
    return cache;
  }

  async function commit(next: string[]): Promise<string[]> {
    cache = next;
    for (const fn of listeners) fn(next);
    try {
      await AsyncStorage.setItem(key, serializeFavourites(next));
    } catch {
      // Storage unavailable: the like lasts for this session only.
    }
    return next;
  }

  return {
    load,
    toggle: async (id: string): Promise<string[]> => commit(toggleFavourite(await load(), id)),
    subscribe: (fn: Listener): (() => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    cached: (): string[] | null => cache,
  };
}

const themeStore: FavouritesStore = createFavouritesStore(FAVOURITES_KEY);
const wallpaperStore: FavouritesStore = createFavouritesStore(WALLPAPER_FAVOURITES_KEY);

export function loadFavourites(): Promise<string[]> {
  return themeStore.load();
}

/** Likes or unlikes a theme. Returns the new list (oldest like first). */
export function toggleFavouriteTheme(id: string): Promise<string[]> {
  return themeStore.toggle(id);
}

export function onFavouritesChanged(fn: Listener): () => void {
  return themeStore.subscribe(fn);
}

function useStore(store: FavouritesStore): { liked: string[]; toggle: (id: string) => void } {
  const [liked, setLiked] = useState<string[]>(store.cached() ?? []);

  useEffect(() => {
    let alive = true;
    store.load().then((l: string[]) => {
      if (alive) setLiked(l);
    });
    const off = store.subscribe((l: string[]) => {
      if (alive) setLiked(l);
    });
    return () => {
      alive = false;
      off();
    };
  }, [store]);

  const toggle = useCallback(
    (id: string) => {
      void store.toggle(id);
    },
    [store],
  );

  return { liked, toggle };
}

/** Live liked theme ids (oldest first; empty while loading) and a stable toggle. */
export function useFavourites(): { liked: string[]; toggle: (id: string) => void } {
  return useStore(themeStore);
}

/** Live liked wallpaper ids (theme ids; oldest first; empty while loading) and a stable toggle. */
export function useWallpaperFavourites(): { liked: string[]; toggle: (id: string) => void } {
  return useStore(wallpaperStore);
}
