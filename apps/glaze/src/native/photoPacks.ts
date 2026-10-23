// Photo-pack storage on the phone (T103): download a free photo theme's image on demand, keep it
// under documentDirectory/packs/<pack id>/photos/, remove it again. Works in Expo Go (expo-file-system
// through src/native/fs.ts and the global fetch; no native module).
//
// NETWORK: this is the one deliberate exception to the app's no-network rule, for the free Space
// pack only (FREE_PHOTO_PACK_IDS). A request is made only from downloadPhotoTheme(), which UI calls
// only from a person's tap on Download, and it is a single GET to the official image URL in the
// manifest. No other request, no headers beyond the default, no tracking.
//
// T108: a failed or blocked download (offline, HTTP error, proxy refusal, wrong type, size or hash,
// a failed write) never leaves a half-written file: src/core/photoPack.ts downloadPhoto streams into a
// temp name, verifies on disk, then moves into place, and deletes everything on failure. The store
// keeps the friendly failure kind so the UI shows the offline / error state with Retry.
import { PackError } from '../core/packDownloader';
import {
  HttpStatusError,
  downloadPhoto,
  photoFailureOf,
  readPhotoMeta,
  removePhoto,
  PHOTO_FAILURE_KEYS,
  type PhotoDownloadStatus,
  type PhotoFailure,
  type PhotoRangeResponse,
  type PhotoTheme,
  type PhotoTransport,
} from '../core/photoPack';
import { t } from '../i18n';
import * as fs from './fs';
import { deviceTransport } from './packs';

const ROOT = fs.documentDirectory ? `${fs.documentDirectory}packs/` : null;

function uri(rel: string): string {
  if (!ROOT) throw new PackError('network', 'no documents folder on this device');
  return ROOT + rel;
}

/** One-shot async iterable (RN fetch has no streaming body). */
function once(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        next: async () => {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: bytes };
        },
      };
    },
  };
}

/** The pack Transport, with a fetch that also reports Content-Type (checked by downloadPhoto) and a move. */
const photoTransport: PhotoTransport = {
  async fetchRange(url: string, start: number): Promise<PhotoRangeResponse> {
    const res = await fetch(url, start > 0 ? { headers: { Range: `bytes=${start}-` } } : undefined);
    if (res.status !== 200 && res.status !== 206) throw new HttpStatusError(res.status);
    const contentType = res.headers.get('content-type');
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { offset: res.status === 206 ? start : 0, contentType, chunks: once(bytes) };
  },
  writeAppend: (p: string, c: Uint8Array) => deviceTransport.writeAppend(p, c),
  readFile: (p: string) => deviceTransport.readFile(p),
  remove: (p: string) => deviceTransport.remove(p),
  async move(from: string, to: string): Promise<void> {
    const dest = uri(to);
    await fs.deleteAsync(dest, { idempotent: true });
    await fs.moveAsync({ from: uri(from), to: dest });
  },
};

// ------------------------------------------------------------ store

export type PhotoStatus = PhotoDownloadStatus;
export type PhotoEntry = {
  status: PhotoStatus;
  progress: number;
  uri: string | null;
  /** User-facing one-line message for the failure ('' unless status is 'error'). */
  error: string;
  /** Why the last download failed (null unless status is 'error'). */
  failure: PhotoFailure | null;
  /** Size on the phone once downloaded (0 otherwise). */
  bytes: number;
};
export type PhotoStoreState = Readonly<Record<string, PhotoEntry>>;

const EMPTY: PhotoEntry = Object.freeze({ status: 'not-downloaded', progress: 0, uri: null, error: '', failure: null, bytes: 0 }) as PhotoEntry;
let state: PhotoStoreState = {};
const listeners = new Set<() => void>();
const checked = new Set<string>();

function put(id: string, e: Partial<PhotoEntry>) {
  state = { ...state, [id]: { ...(state[id] ?? EMPTY), ...e } };
  for (const l of listeners) l();
}

export function subscribePhotos(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getPhotoState(): PhotoStoreState {
  return state;
}

export function photoEntry(themeId: string): PhotoEntry {
  return state[themeId] ?? EMPTY;
}

/** Look on the phone (no network) for an already-downloaded photo. Never rejects. */
export async function refreshPhoto(theme: PhotoTheme): Promise<void> {
  if (checked.has(theme.id) || !ROOT) return;
  checked.add(theme.id);
  try {
    const meta = await readPhotoMeta(photoTransport, theme);
    if (!meta) return;
    const fileUri = ROOT + meta.path;
    const info = await fs.getInfoAsync(fileUri);
    if (info.exists && (info.size === undefined || info.size === meta.bytes)) {
      put(theme.id, { status: 'ready', progress: 1, uri: fileUri, error: '', failure: null, bytes: meta.bytes });
    }
  } catch {
    // Unreadable store: the theme just shows its generated wallpaper.
  }
}

/**
 * Download one photo theme's image. Call ONLY from a person's tap on Download (or Retry).
 * Returns null on success or a user-facing error message. Never rejects.
 */
export async function downloadPhotoTheme(theme: PhotoTheme): Promise<string | null> {
  if (photoEntry(theme.id).status === 'downloading') return null;
  if (!ROOT) {
    const msg = t(PHOTO_FAILURE_KEYS.storage.body);
    put(theme.id, { status: 'error', progress: 0, uri: null, error: msg, failure: 'storage', bytes: 0 });
    return msg;
  }
  put(theme.id, { status: 'downloading', progress: 0, uri: null, error: '', failure: null, bytes: 0 });
  try {
    const meta = await downloadPhoto({
      allowNetwork: true,
      theme,
      transport: photoTransport,
      onProgress: (p) => put(theme.id, { progress: p.totalBytes ? Math.min(1, p.doneBytes / p.totalBytes) : 0 }),
    });
    checked.add(theme.id);
    put(theme.id, { status: 'ready', progress: 1, uri: ROOT + meta.path, error: '', failure: null, bytes: meta.bytes });
    return null;
  } catch (e) {
    const failure = photoFailureOf(e);
    const msg = t(PHOTO_FAILURE_KEYS[failure].body);
    // downloadPhoto already deleted every file of this theme: it does not count as downloaded.
    put(theme.id, { status: 'error', progress: 0, uri: null, error: msg, failure, bytes: 0 });
    return msg;
  }
}

/** Delete a downloaded photo (always allowed, no network). Never rejects. */
export async function removePhotoTheme(theme: PhotoTheme): Promise<void> {
  try {
    await removePhoto(photoTransport, theme);
  } catch {
    // Already gone or unreadable: forget it anyway.
  }
  put(theme.id, { status: 'not-downloaded', progress: 0, uri: null, error: '', failure: null, bytes: 0 });
}
