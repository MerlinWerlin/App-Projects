// Theme-pack storage on the phone (T46): the Transport for src/core/packDownloader.ts over
// expo-file-system (through the src/native/fs.ts adapter) plus a tiny observable store with the
// cache index, download progress and errors. Files live under documentDirectory/packs/<id>/,
// the index in documentDirectory/packs/index.json. Works in Expo Go (no native module).
// No request is ever made while PACK_BASE_URL is empty (src/config/packs.ts).
// Entitlement is NOT checked here: src/plus/usePackAccess.ts gates downloads on Glaze Plus.
import Constants from 'expo-constants';
import { PACK_BASE_URL } from '../config/packs';
import { base64Decode, base64Encode, concatBytes } from '../core/bytes';
import { isMotifId } from '../core/artwork';
import { PackError, downloadPack, loadPackContent, packsEnabled, removePack, type Transport } from '../core/packDownloader';
import { registerPackMotifs, unregisterPackMotifs } from '../core/packMotifs';
import { restorePackMotifs } from '../core/packRestore';
import { cacheEntryFor, cacheIndexAdd, cacheIndexRemove, parseCacheIndex, type PackCacheIndex, type PackContent } from '../core/themePack';
import type { Theme } from '../core/themes';
import { t } from '../i18n';
import * as fs from './fs';

const ROOT = fs.documentDirectory ? `${fs.documentDirectory}packs/` : null;
const INDEX = ROOT ? `${ROOT}index.json` : null;

function uri(rel: string): string {
  if (!ROOT) throw new PackError('network', 'no documents folder on this device');
  return ROOT + rel;
}

function parentOf(u: string): string {
  return u.slice(0, u.lastIndexOf('/') + 1);
}

/** One-shot async iterable (RN fetch has no streaming body, so a response is a single chunk). */
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

async function readBytes(u: string): Promise<Uint8Array | null> {
  const info = await fs.getInfoAsync(u);
  if (!info.exists) return null;
  return base64Decode(await fs.readAsStringAsync(u, { encoding: fs.EncodingType.Base64 }));
}

export const deviceTransport: Transport = {
  async fetchRange(url, start) {
    const res = await fetch(url, start > 0 ? { headers: { Range: `bytes=${start}-` } } : undefined);
    if (res.status !== 200 && res.status !== 206) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { offset: res.status === 206 ? start : 0, chunks: once(bytes) };
  },
  async writeAppend(rel, chunk) {
    const u = uri(rel);
    await fs.makeDirectoryAsync(parentOf(u), { intermediates: true }).catch(() => undefined);
    // The legacy API can't append, so read + concat + write (assets are small; one chunk per fetch).
    const existing = await readBytes(u);
    const next = existing ? concatBytes([existing, chunk]) : chunk;
    await fs.writeAsStringAsync(u, base64Encode(next), { encoding: fs.EncodingType.Base64 });
  },
  async readFile(rel) {
    return readBytes(uri(rel));
  },
  async remove(rel) {
    await fs.deleteAsync(uri(rel), { idempotent: true });
  },
};

// ------------------------------------------------------------ store

export type PackStoreState = {
  index: PackCacheIndex;
  loaded: boolean;
  /** Progress 0..1 per pack id while downloading. */
  busy: Record<string, number>;
  errors: Record<string, string>;
};

let state: PackStoreState = { index: { version: 1, packs: [] }, loaded: false, busy: {}, errors: {} };
const listeners = new Set<() => void>();

function set(patch: Partial<PackStoreState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function subscribePacks(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getPackState(): PackStoreState {
  return state;
}

/** Packs download only once the owner configures hosting. */
export const PACKS_ENABLED = packsEnabled(PACK_BASE_URL);

export async function loadPackIndex(): Promise<void> {
  if (state.loaded || !INDEX) return;
  try {
    const info = await fs.getInfoAsync(INDEX);
    const raw = info.exists ? await fs.readAsStringAsync(INDEX) : null;
    set({ index: parseCacheIndex(raw), loaded: true });
  } catch {
    set({ loaded: true });
  }
}

async function saveIndex(index: PackCacheIndex): Promise<void> {
  set({ index });
  if (!INDEX || !ROOT) return;
  try {
    await fs.makeDirectoryAsync(ROOT, { intermediates: true }).catch(() => undefined);
    await fs.writeAsStringAsync(INDEX, JSON.stringify(index));
  } catch {
    // The files are still there; the index is rebuilt on the next download.
  }
}

const appVersion = () => Constants.expoConfig?.version ?? '0.0.0';

/** User-facing error text in the current language (catalogue keys plus.packErrors.*). */
function messageFor(e: unknown): string {
  if (e instanceof PackError) {
    if (e.code === 'network') return t('plus.packErrors.network');
    if (e.code === 'integrity') return t('plus.packErrors.integrity');
    if (e.code === 'app-version') return t('plus.packErrors.appVersion');
    if (e.code === 'cancelled') return t('plus.packErrors.cancelled');
    if (e.code === 'disabled') return t('plus.packErrors.disabled');
  }
  return t('plus.packErrors.generic');
}

/**
 * Download (or resume) a pack to the device. Call only through src/plus (entitlement checked there).
 * Returns null on success or a user-facing error message.
 */
export async function downloadPackToDevice(packId: string): Promise<string | null> {
  await loadPackIndex();
  if (packId in state.busy) return null;
  set({ busy: { ...state.busy, [packId]: 0 }, errors: { ...state.errors, [packId]: '' } });
  try {
    const r = await downloadPack({
      baseUrl: PACK_BASE_URL,
      packId,
      transport: deviceTransport,
      appVersion: appVersion(),
      onProgress: (p) => set({ busy: { ...state.busy, [packId]: p.totalBytes ? p.doneBytes / p.totalBytes : 0 } }),
    });
    contentCache.delete(packId);
    await saveIndex(cacheIndexAdd(state.index, cacheEntryFor(r.manifest, new Date())));
    return null;
  } catch (e) {
    const msg = messageFor(e);
    set({ errors: { ...state.errors, [packId]: msg } });
    return msg;
  } finally {
    const { [packId]: _done, ...rest } = state.busy;
    set({ busy: rest });
  }
}

/** Delete a pack's files and forget it. Free to call (removing never needs Plus). */
export async function removePackFromDevice(packId: string): Promise<void> {
  await loadPackIndex();
  contentCache.delete(packId);
  unregisterPackMotifs(packId);
  try {
    await removePack(deviceTransport, packId);
  } finally {
    await saveIndex(cacheIndexRemove(state.index, packId));
  }
}

const EMPTY_CONTENT: PackContent = { themes: [], motifs: {} };
/** Read-once cache per pack; cleared when the pack is (re)downloaded or removed. */
const contentCache = new Map<string, Promise<PackContent>>();

/**
 * Themes and pack-only motifs from a downloaded pack (verified again on read). Its motifs are
 * registered with src/core/packMotifs.ts so the renderers can draw them (T47). Never rejects.
 */
export function packContentOnDevice(packId: string): Promise<PackContent> {
  const cached = contentCache.get(packId);
  if (cached) return cached;
  const p = loadPackContent(deviceTransport, packId)
    .then((c) => {
      if (c.themes.length === 0) contentCache.delete(packId); // not on the phone (yet): read again next time
      else registerPackMotifs(packId, c.motifs, isMotifId);
      return c;
    })
    .catch(() => {
      contentCache.delete(packId);
      return EMPTY_CONTENT;
    });
  contentCache.set(packId, p);
  return p;
}

/** Themes from a downloaded pack (verified again on read). */
export function packThemesOnDevice(packId: string): Promise<Theme[]> {
  return packContentOnDevice(packId).then((c) => c.themes);
}

let restoring: Promise<void> | null = null;

/**
 * Cold start (T50): read every downloaded pack once and register its pack-only motifs, so a saved
 * style that uses one survives a restart. src/store/studio.ts awaits this before parsing the saved
 * state; app/_layout.tsx starts it early. Memoised, never rejects, no network.
 */
export function restoreDownloadedPacks(): Promise<void> {
  if (!restoring) {
    restoring = (async () => {
      try {
        await loadPackIndex();
        await restorePackMotifs(deviceTransport, state.index, (_t, id) => packContentOnDevice(id));
      } catch {
        // A broken pack folder must never block the app; its themes just stay hidden.
      }
    })();
  }
  return restoring;
}
