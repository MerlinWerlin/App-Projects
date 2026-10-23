// Thin adapter: AsyncStorage for small prefs/lists, expo-file-system for local image copies.
// Images never leave the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from './fs';
import { addRecent, parseRecent, removeRecent, serializeRecent, type RecentItem } from '../core/recent';

export const KEYS = {
  recent: 'linework.recent.v1',
  firstRunDone: 'linework.firstRunDone.v1',
} as const;

function imagesDir(): string {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Local storage is not available on this device.');
  return `${base}images/`;
}

function extensionOf(uri: string): string {
  const path = uri.split('?')[0].split('#')[0];
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(path);
  return m ? m[1].toLowerCase() : 'jpg';
}

function isOwnCopy(uri: string): boolean {
  const base = FileSystem.documentDirectory;
  return !!base && uri.startsWith(`${base}images/`);
}

export async function loadRecent(): Promise<RecentItem[]> {
  try {
    const dir = recentImagesDir();
    const json = await AsyncStorage.getItem(KEYS.recent);
    return dir ? parseRecent(json, dir) : parseRecent(json);
  } catch {
    return [];
  }
}

/** Persists own copies as names relative to the images folder (full uris are rebuilt on load). */
export async function saveRecent(list: RecentItem[]): Promise<void> {
  const dir = recentImagesDir();
  await AsyncStorage.setItem(KEYS.recent, dir ? serializeRecent(list, dir) : JSON.stringify(list));
}

/** Images folder for resolving recent refs, or null where there is no documents folder. */
function recentImagesDir(): string | null {
  const base = FileSystem.documentDirectory;
  return base ? `${base}images/` : null;
}

/** Copies a picked/captured image into the app's documents folder and returns the new uri. */
export async function importImage(uri: string): Promise<string> {
  const dir = imagesDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const suffix = Math.random().toString(36).slice(2, 6);
  const to = `${dir}${Date.now()}-${suffix}.${extensionOf(uri)}`;
  await FileSystem.copyAsync({ from: uri, to });
  return to;
}

async function deleteQuietly(uri: string): Promise<void> {
  if (!isOwnCopy(uri)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore: a leftover file is harmless
  }
}

/** Adds an image to the recent list (newest first, cap 12) and deletes copies pushed off the end. */
export async function rememberImage(uri: string, width?: number, height?: number): Promise<RecentItem[]> {
  const current = await loadRecent();
  const { list, evicted } = addRecent(current, { uri, addedAt: Date.now(), width, height });
  await saveRecent(list);
  await Promise.all(evicted.map((e) => deleteQuietly(e.uri)));
  return list;
}

/** Removes an image from the recent list and deletes its local copy. */
export async function forgetImage(uri: string): Promise<RecentItem[]> {
  const list = removeRecent(await loadRecent(), uri);
  await saveRecent(list);
  await deleteQuietly(uri);
  return list;
}

export async function imageExists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

export async function isFirstRun(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEYS.firstRunDone)) !== '1';
  } catch {
    return false;
  }
}

export async function markFirstRunDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.firstRunDone, '1');
  } catch {
    // ignore: worst case the tips show again next launch
  }
}
