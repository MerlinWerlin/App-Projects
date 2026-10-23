// Real platform deps for the outline pipeline (expo-image-manipulator, jpeg-js, upng-js,
// expo-file-system). Not imported by node tests; see outlinePipeline.test.ts for the fakes.
import { Image } from 'react-native';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import * as FileSystem from './fs';
import * as jpeg from 'jpeg-js';
import UPNG from 'upng-js';
import { fitWithin, normTurns, rotate90Dims } from '../core/image.ts';
import { filesToPrune, outlineNameTime, type CacheEntry } from '../core/cachePrune.ts';
import { makeOutlinePipeline, type OutlineDeps, type OutlinePipeline } from './outlinePipeline.ts';

function getSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve(width > 0 && height > 0 ? { width, height } : null),
      () => resolve(null),
    );
  });
}

function resizeAction(w: number, h: number, maxPx: number): Action | null {
  if (Math.max(w, h) <= maxPx) return null;
  const fit = fitWithin(w, h, maxPx);
  return w >= h ? { resize: { width: fit.width } } : { resize: { height: fit.height } };
}

const JPEG_OPTS = { compress: 0.9, format: SaveFormat.JPEG, base64: true };

export async function resizeToJpegBase64(
  uri: string,
  maxPx: number,
  rotateTurns: number,
): Promise<{ base64: string; width: number; height: number }> {
  const turns = normTurns(rotateTurns);
  const actions: Action[] = [];
  if (turns) actions.push({ rotate: 90 * turns });
  const size = await getSize(uri);
  if (size) {
    const r = rotate90Dims(size.width, size.height, turns);
    const resize = resizeAction(r.width, r.height, maxPx);
    if (resize) actions.push(resize);
  } else {
    // Size unknown: cap the width; the check below catches tall images.
    actions.push({ resize: { width: maxPx } });
  }
  let out = await manipulateAsync(uri, actions, JPEG_OPTS);
  // EXIF orientation can make getSize disagree with the manipulator; shrink again if needed.
  const again = resizeAction(out.width, out.height, maxPx);
  if (again) out = await manipulateAsync(out.uri, [again], JPEG_OPTS);
  if (!out.base64) throw new Error('Couldn’t read that image.');
  return { base64: out.base64, width: out.width, height: out.height };
}

export function decodeJpeg(bytes: Uint8Array) {
  const img = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: img.width, height: img.height, data: img.data };
}

export function encodePng(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  // UPNG wants a tightly packed ArrayBuffer; copy if the view does not cover its whole buffer.
  const exact =
    rgba.byteOffset === 0 && rgba.byteLength === rgba.buffer.byteLength
      ? (rgba.buffer as ArrayBuffer)
      : (rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength) as ArrayBuffer);
  return new Uint8Array(UPNG.encode([exact], width, height, 0));
}

export async function writeCacheFile(name: string, base64: string): Promise<string> {
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error('Cache folder is not available on this device.');
  const dir = `${base}outline/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const path = `${dir}${name}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

/** How many outline PNGs survive a launch-time prune. */
export const OUTLINE_CACHE_KEEP = 10;

/**
 * Delete all but the newest `keep` files in cacheDirectory/outline/. Age comes from the
 * timestamp in the pipeline's file name, else from getInfoAsync's modificationTime.
 * Best effort: never throws.
 */
export async function pruneOutlineCache(keep: number = OUTLINE_CACHE_KEEP): Promise<void> {
  try {
    const base = FileSystem.cacheDirectory;
    if (!base) return;
    const dir = `${base}outline/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists || !info.isDirectory) return;
    const names = await FileSystem.readDirectoryAsync(dir);
    if (names.length <= keep) return;
    const entries: CacheEntry[] = [];
    for (const name of names) {
      let time = outlineNameTime(name);
      if (time === null) {
        try {
          const fi = await FileSystem.getInfoAsync(`${dir}${name}`);
          // modificationTime is in seconds; name timestamps are in ms.
          time = fi.exists && typeof fi.modificationTime === 'number' ? fi.modificationTime * 1000 : Number.NaN;
        } catch {
          time = Number.NaN;
        }
      }
      entries.push({ name, time });
    }
    for (const name of filesToPrune(entries, keep)) {
      try {
        await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
      } catch {
        // Ignore: a file we can't delete now will be retried next launch.
      }
    }
  } catch {
    // Pruning is housekeeping only.
  }
}

export function yieldFn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export const outlineDeps: OutlineDeps = { resizeToJpegBase64, decodeJpeg, encodePng, writeCacheFile, yieldFn };

let shared: OutlinePipeline | null = null;
/** One pipeline per app run, so its decoded-source cache survives re-renders. */
export function getOutlinePipeline(): OutlinePipeline {
  if (!shared) shared = makeOutlinePipeline(outlineDeps);
  return shared;
}

/** Rotate the original by clockwise quarter turns (Original mode). PNG stays PNG to keep transparency. */
export async function rotateImage(uri: string, turns: number): Promise<{ uri: string; width: number; height: number }> {
  const t = normTurns(turns);
  const png = /\.png($|[?#])/i.test(uri);
  const out = await manipulateAsync(uri, t ? [{ rotate: 90 * t }] : [], {
    compress: 0.95,
    format: png ? SaveFormat.PNG : SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height };
}
