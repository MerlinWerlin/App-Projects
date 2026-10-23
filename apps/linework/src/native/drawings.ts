// "My drawings" storage (T67): the list lives in AsyncStorage; the snapshot (and a copy of the traced photo) are
// copied into the app's documents folder so they survive cache clears. Local only: nothing is uploaded, and the
// gallery is never gated by Plus.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from './fs';
import {
  addDrawing,
  drawingFiles,
  newDrawingId,
  parseDrawings,
  removeDrawing,
  serializeDrawings,
  type Drawing,
  type DrawingFit,
} from '../core/drawings';

export const DRAWINGS_KEY = 'linework.drawings';

function drawingsDir(): string | null {
  const base = FileSystem.documentDirectory;
  return base ? `${base}drawings/` : null;
}

function extensionOf(uri: string, fallback: string): string {
  const path = uri.split('?')[0].split('#')[0];
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(path);
  return m ? m[1].toLowerCase() : fallback;
}

function isLocalFile(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('/');
}

// Writes are chained so two quick saves/deletes never overwrite each other's list.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

export async function loadDrawings(): Promise<Drawing[]> {
  try {
    const dir = drawingsDir();
    const json = await AsyncStorage.getItem(DRAWINGS_KEY);
    return dir ? parseDrawings(json, dir) : parseDrawings(json);
  } catch {
    return [];
  }
}

async function store(list: Drawing[]): Promise<void> {
  const dir = drawingsDir();
  await AsyncStorage.setItem(DRAWINGS_KEY, dir ? serializeDrawings(list, dir) : JSON.stringify(list));
}

async function deleteQuietly(uri: string): Promise<void> {
  const dir = drawingsDir();
  if (!dir || !uri.startsWith(dir)) return; // only ever delete our own copies
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore: a leftover file is harmless
  }
}

export type SaveDrawingInput = {
  /** The paper-check snapshot (a cache file). */
  photoUri: string;
  photoWidth?: number;
  photoHeight?: number;
  /** The traced photo / outline, when the reference is a photo. */
  sourceUri?: string;
  templateId?: string;
  fit?: DrawingFit;
};

/** Copies the snapshot (and the source photo) into the drawings folder and adds it to the front of the list. */
export function saveDrawing(input: SaveDrawingInput): Promise<Drawing> {
  return serial(async () => {
    const dir = drawingsDir();
    if (!dir) throw new Error('Local storage is not available on this device.');
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const now = Date.now();
    const id = newDrawingId(now, Math.random());
    const photoUri = `${dir}${id}-photo.${extensionOf(input.photoUri, 'jpg')}`;
    await FileSystem.copyAsync({ from: input.photoUri, to: photoUri });
    let sourceUri: string | undefined;
    if (input.sourceUri && isLocalFile(input.sourceUri)) {
      const to = `${dir}${id}-source.${extensionOf(input.sourceUri, 'png')}`;
      try {
        await FileSystem.copyAsync({ from: input.sourceUri, to });
        sourceUri = to;
      } catch {
        // The before/after still works without it (side by side shows only the snapshot then).
      }
    }
    const entry: Drawing = { id, createdAt: now, photoUri };
    if (sourceUri) entry.sourceUri = sourceUri;
    if (input.templateId) entry.templateId = input.templateId;
    if (input.photoWidth && input.photoHeight) {
      entry.photoWidth = input.photoWidth;
      entry.photoHeight = input.photoHeight;
    }
    if (input.fit) entry.fit = input.fit;
    const { list, evicted } = addDrawing(await loadDrawings(), entry);
    try {
      await store(list);
    } catch (e) {
      await Promise.all(drawingFiles(entry).map(deleteQuietly));
      throw e;
    }
    await Promise.all(evicted.flatMap(drawingFiles).map(deleteQuietly));
    return entry;
  });
}

/** Removes a drawing from the list and deletes its files. Returns the new list. */
export function deleteDrawing(id: string): Promise<Drawing[]> {
  return serial(async () => {
    const { list, removed } = removeDrawing(await loadDrawings(), id);
    await store(list);
    if (removed) await Promise.all(drawingFiles(removed).map(deleteQuietly));
    return list;
  });
}
