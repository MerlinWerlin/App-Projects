// Per-theme background choice (theme design | my photo), persisted on-device with AsyncStorage.
// Parsing/validation lives in src/core/background.ts so it is unit-tested.
// Photos are copied into the app's documents folder (via src/native/fs.ts only) because the
// picker hands back a cache file iOS may purge. Nothing leaves the phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  backgroundFor,
  orphanedPhoto,
  parseBackgrounds,
  photoFileName,
  serializeBackgrounds,
  setBackground,
  type BackgroundsState,
  type ThemeBackground,
} from '../core/background';
import * as FileSystem from '../native/fs';

const KEY = 'glaze.backgrounds';

// Reads wait for queued writes; writes run one at a time.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function photosDir(): string | null {
  const doc = FileSystem.documentDirectory;
  return doc ? `${doc}backgrounds/` : null;
}

/** iOS can move the app container between updates: re-point our copies at the current folder. */
function resolvePhotoUri(uri: string | undefined): string | undefined {
  if (!uri) return uri;
  const dir = photosDir();
  const m = /\/backgrounds\/([^/]+)$/.exec(uri);
  return dir && m && !uri.startsWith(dir) ? `${dir}${m[1]}` : uri;
}

async function read(): Promise<BackgroundsState> {
  try {
    const s = parseBackgrounds(await AsyncStorage.getItem(KEY));
    const out: BackgroundsState = {};
    for (const [id, b] of Object.entries(s)) out[id] = { ...b, photoUri: resolvePhotoUri(b.photoUri) };
    // Drop the key entirely when photoUri is undefined (keeps equality checks simple).
    for (const b of Object.values(out)) if (b.photoUri === undefined) delete b.photoUri;
    return out;
  } catch {
    return {};
  }
}

async function write(state: BackgroundsState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, serializeBackgrounds(state));
  } catch {
    // Storage full or unavailable: keep the in-memory state.
  }
}

export function loadBackgrounds(): Promise<BackgroundsState> {
  return serial(read);
}

export async function loadBackground(themeId: string): Promise<ThemeBackground> {
  const bg = backgroundFor(await loadBackgrounds(), themeId);
  // The photo copy is gone (e.g. not restored from a backup): show the theme design instead
  // of a blank preview. The stored choice is kept, so picking a photo again replaces it.
  if (bg.source === 'photo' && bg.photoUri && bg.photoUri.startsWith('file:')) {
    try {
      if (!(await FileSystem.getInfoAsync(bg.photoUri)).exists) return { ...bg, source: 'theme' };
    } catch {
      // Can't tell: keep the photo.
    }
  }
  return bg;
}

/**
 * Save one theme's background. If that replaces a photo copy no theme references any
 * more, the old copy is deleted after the new state is written (never while in use).
 */
export function saveBackground(themeId: string, bg: ThemeBackground): Promise<ThemeBackground> {
  return serial(async () => {
    const s = await read();
    const prevUri = s[themeId]?.photoUri;
    const next = setBackground(s, themeId, bg);
    await write(next);
    const orphan = prevUri && prevUri !== bg.photoUri ? orphanedPhoto(prevUri, next) : null;
    if (orphan) await removePhotoCopy(orphan);
    return backgroundFor(next, themeId);
  });
}

/**
 * Copy a picked photo into documents/backgrounds/ with a fresh name for this theme.
 * Returns the copy's uri, or null when the copy failed (the caller shows a friendly error;
 * a cache uri would vanish later, so we don't fall back to it).
 */
export async function keepPhotoCopy(sourceUri: string, themeId: string): Promise<string | null> {
  try {
    const dir = photosDir();
    if (!dir) return null;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}${photoFileName(themeId, Date.now(), sourceUri)}`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch {
    return null;
  }
}

/** Delete one of our copies (never touches files outside the backgrounds folder). */
export async function removePhotoCopy(uri: string): Promise<void> {
  try {
    const dir = photosDir();
    if (dir && uri.startsWith(dir)) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best effort.
  }
}

/** True when our copy is still on disk (it can go missing after a restore from backup). */
export async function photoCopyExists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}
