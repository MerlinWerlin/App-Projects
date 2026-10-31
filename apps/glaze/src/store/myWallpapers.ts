// "My wallpapers" (T186, owner-1101 #4): wallpapers saved from inside Glaze, kept on this device.
// A saved PNG is copied into <documents>/my-wallpapers/ and listed in AsyncStorage
// (`glaze.myWallpapers.v1`, rules in src/core/myWallpapers.ts). The Wallpapers tab lists them,
// saves one to Photos again and deletes them. Nothing leaves the device. Every call is best effort:
// a failed copy or write never breaks the save that triggered it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, useState } from 'react';
import {
  MY_WALLPAPERS_KEY,
  addMyWallpaper,
  myWallpaperFile,
  myWallpaperId,
  myWallpapersDir,
  parseMyWallpapers,
  removeMyWallpaper,
  serializeMyWallpapers,
  type MyWallpaper,
  type MyWallpaperKind,
  type MyWallpapersState,
} from '../core/myWallpapers';
import * as FileSystem from '../native/fs';
import { ensurePhotosWriteAccess } from '../render/saveWallpaper';

type Listener = (state: MyWallpapersState) => void;

let cache: MyWallpapersState | null = null;
const listeners = new Set<Listener>();

export async function loadMyWallpapers(): Promise<MyWallpapersState> {
  if (cache) return cache;
  try {
    cache = parseMyWallpapers(await AsyncStorage.getItem(MY_WALLPAPERS_KEY));
  } catch {
    cache = { items: [] };
  }
  return cache;
}

async function commit(next: MyWallpapersState): Promise<void> {
  cache = next;
  for (const fn of listeners) fn(next);
  try {
    await AsyncStorage.setItem(MY_WALLPAPERS_KEY, serializeMyWallpapers(next));
  } catch {
    // Storage unavailable: the list lasts for this session only.
  }
}

async function deleteFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Already gone.
  }
}

export type RememberInput = {
  kind: MyWallpaperKind;
  /** The PNG that was just saved to Photos (a temp file). */
  uri: string;
  width: number;
  height: number;
  themeId?: string | null;
  loopId?: string | null;
};

/** Keep a copy of a wallpaper that was just saved to Photos and list it under My wallpapers. */
export async function rememberWallpaper(input: RememberInput): Promise<void> {
  try {
    const dir = myWallpapersDir(FileSystem.documentDirectory);
    if (!dir) return;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {
      // Already exists.
    }
    const id = myWallpaperId(Date.now(), Math.random().toString(36).slice(2));
    const to = myWallpaperFile(dir, id);
    await FileSystem.copyAsync({ from: input.uri, to });
    const item: MyWallpaper = { id, kind: input.kind, uri: to, width: input.width, height: input.height, createdAt: Date.now() };
    if (input.themeId) item.themeId = input.themeId;
    if (input.loopId) item.loopId = input.loopId;
    const { state, dropped } = addMyWallpaper(await loadMyWallpapers(), item);
    await commit(state);
    for (const d of dropped) await deleteFile(d.uri);
  } catch {
    // Best effort: the wallpaper is already in Photos.
  }
}

/** Remove one entry and its copy (copies already in Photos stay there). */
export async function forgetWallpaper(id: string): Promise<void> {
  const { state, removed } = removeMyWallpaper(await loadMyWallpapers(), id);
  if (!removed) return;
  await commit(state);
  await deleteFile(removed.uri);
}

export type SaveAgainResult = 'saved' | 'denied' | 'missing' | 'error';

/** Save the kept copy to Photos again (add-only access). */
export async function saveWallpaperAgain(item: MyWallpaper): Promise<SaveAgainResult> {
  try {
    const info = await FileSystem.getInfoAsync(item.uri);
    if (!info.exists) return 'missing';
    if (!(await ensurePhotosWriteAccess())) return 'denied';
    await MediaLibrary.saveToLibraryAsync(item.uri);
    return 'saved';
  } catch {
    return 'error';
  }
}

/** The list, kept in step with every add and delete. `loaded` is false until the first read. */
export function useMyWallpapers(): { items: MyWallpaper[]; loaded: boolean } {
  const [state, setState] = useState<MyWallpapersState | null>(cache);
  useEffect(() => {
    let alive = true;
    loadMyWallpapers().then(
      (s) => {
        if (alive) setState(s);
      },
      () => {
        if (alive) setState({ items: [] });
      },
    );
    const fn: Listener = (s) => setState(s);
    listeners.add(fn);
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);
  return { items: state?.items ?? [], loaded: state !== null };
}
