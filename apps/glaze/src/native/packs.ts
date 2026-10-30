// Theme-pack storage on the phone (T46): the Transport for src/core/packDownloader.ts over
// expo-file-system (through the src/native/fs.ts adapter) plus a tiny observable store with the
// cache index, download progress and errors. Files live under documentDirectory/packs/<id>/,
// the index in documentDirectory/packs/index.json. Works in Expo Go (no native module).
// No request is ever made while the pack base URL is empty (src/config/packs.ts).
// Entitlement is NOT checked here: src/plus/usePackAccess.ts gates downloads on Glaze Plus.
// T160 (owner-1030 A): also the remote catalogue (catalog.json cached in documentDirectory/packs/
// catalog.json, re-fetched at most every 6 h or on pull, last good copy kept offline) and remote
// art pack downloads into documentDirectory/packs/<id>/ (src/core/remoteCatalog.ts decides).
import Constants from 'expo-constants';
import { Dimensions, PixelRatio } from 'react-native';
import { packBaseUrl, packEnvFrom } from '../config/packs';
import { base64Decode, base64Encode, concatBytes } from '../core/bytes';
import { isMotifId } from '../core/artwork';
import {
  PackError,
  downloadPack,
  downloadRemoteArtPack,
  fetchCatalogText,
  loadPackContent,
  loadRemoteArt,
  packsEnabled,
  remoteArtCacheEntry,
  removePack,
  resolvePackBaseUrl,
  type Transport,
} from '../core/packDownloader';
import type { Catalog, RemoteArtManifest } from '../core/packCatalog';
import { CATALOG_CACHE_FILE, catalogNeedsFetch, decideCatalog, parseCatalogCache, serializeCatalogCache, type CatalogCache, type CatalogFetch } from '../core/remoteCatalog';
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
  /** T160: the remote catalogue to list (last good copy), or null. */
  catalog: Catalog | null;
  /** True while catalog.json is being fetched. */
  catalogRefreshing: boolean;
  /** Verified, downloaded remote art packs by id (read on demand by remoteArtOnDevice). */
  remoteArt: Record<string, RemoteArtManifest>;
};

let state: PackStoreState = { index: { version: 1, packs: [] }, loaded: false, busy: {}, errors: {}, catalog: null, catalogRefreshing: false, remoteArt: {} };
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
/** Expo extra `packEnv` ('staging' | 'production', default production) picks the base URL. */
function configuredBaseUrl(): string {
  try {
    const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
    return packBaseUrl(packEnvFrom(extra?.packEnv));
  } catch {
    return '';
  }
}

/** The pack base URL for this build ('' = packs disabled, no request is ever made). */
export const PACK_BASE: string = configuredBaseUrl();

/** Normalised base URL, or null when disabled or malformed. */
export const PACK_BASE_RESOLVED: string | null = (() => {
  try {
    return resolvePackBaseUrl(PACK_BASE);
  } catch {
    return null;
  }
})();

export const PACKS_ENABLED = packsEnabled(PACK_BASE);

export async function loadPackIndex(): Promise<void> {
  if (state.loaded) return;
  // No file system (web): nothing is on the phone, so measuring is done (Settings stops its skeleton).
  if (!INDEX) {
    set({ loaded: true });
    return;
  }
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
  // T160: a remote art pack (Settings › Storage re-download goes through here too).
  if (PACKS_ENABLED && !state.catalog) await refreshCatalog();
  if (catalogPack(packId)) return downloadRemoteArtToDevice(packId);
  await loadPackIndex();
  if (packId in state.busy) return null;
  set({ busy: { ...state.busy, [packId]: 0 }, errors: { ...state.errors, [packId]: '' } });
  try {
    const r = await downloadPack({
      baseUrl: PACK_BASE,
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
  remoteCache.delete(packId);
  if (packId in state.remoteArt) {
    const { [packId]: _gone, ...rest } = state.remoteArt;
    set({ remoteArt: rest });
  }
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

// ------------------------------------------------------------ T160: remote catalogue + art packs

const CATALOG_URI = ROOT ? `${ROOT}${CATALOG_CACHE_FILE}` : null;
/** Don't hit the network again within a minute in one session (a pull still waits for this). */
const MIN_ATTEMPT_GAP_MS = 60_000;
let catalogCache: CatalogCache | null = null;
let catalogCacheRead = false;
let lastAttempt = 0;
let catalogRun: Promise<void> | null = null;

/** The catalogue entry for an id, if the remote catalogue lists it. */
export function catalogPack(id: string) {
  return state.catalog?.packs.find((p) => p.id === id) ?? null;
}

async function readCatalogCache(): Promise<CatalogCache | null> {
  if (catalogCacheRead || !CATALOG_URI) return catalogCache;
  catalogCacheRead = true;
  try {
    const info = await fs.getInfoAsync(CATALOG_URI);
    catalogCache = info.exists ? parseCatalogCache(await fs.readAsStringAsync(CATALOG_URI)) : null;
  } catch {
    catalogCache = null;
  }
  return catalogCache;
}

/**
 * Load the cached catalogue and, when it is stale (6 h) or `force` (pull to refresh), fetch a new
 * one. Offline or a bad file keeps the last good copy. Does nothing at all (no file read, no
 * request) while packs are disabled. Never rejects.
 */
export function refreshCatalog(force = false): Promise<void> {
  if (!PACKS_ENABLED || !PACK_BASE_RESOLVED) return Promise.resolve();
  if (catalogRun) return catalogRun;
  catalogRun = (async () => {
    try {
      const cached = await readCatalogCache();
      const now = Date.now();
      // Show the cached copy at once; a fetch (if due) replaces it when it arrives.
      if (!state.catalog && cached) set({ catalog: decideCatalog(cached, null, now).catalog });
      let fetched: CatalogFetch = null;
      if (catalogNeedsFetch(cached, now, force) && now - lastAttempt >= MIN_ATTEMPT_GAP_MS) {
        lastAttempt = now;
        set({ catalogRefreshing: true });
        try {
          fetched = { ok: true, text: await fetchCatalogText(deviceTransport, PACK_BASE) };
        } catch (e) {
          fetched = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
      const d = decideCatalog(cached, fetched, now);
      if (d.save && d.cache && CATALOG_URI && ROOT) {
        catalogCache = d.cache;
        try {
          await fs.makeDirectoryAsync(ROOT, { intermediates: true }).catch(() => undefined);
          await fs.writeAsStringAsync(CATALOG_URI, serializeCatalogCache(d.cache));
        } catch {
          // Still listed for this session; cached next time.
        }
      }
      set({ catalog: d.catalog, catalogRefreshing: false });
    } catch {
      set({ catalogRefreshing: false });
    } finally {
      catalogRun = null;
    }
  })();
  return catalogRun;
}

/** The phone's screen long edge in pixels (picks the wallpaper size class to download). */
function screenLongEdgePx(): number {
  try {
    const s = Dimensions.get('screen');
    return Math.round(Math.max(s.width, s.height) * PixelRatio.get());
  } catch {
    return 2796;
  }
}

/** file:// URI of a file in a downloaded remote art pack. */
export function remoteArtFileUri(id: string, path: string | null | undefined): string | null {
  return ROOT && path ? `${ROOT}${id}/${path}` : null;
}

/** Read-once cache of verified downloaded remote art packs. */
const remoteCache = new Map<string, Promise<RemoteArtManifest | null>>();

/**
 * A downloaded remote art pack, verified again on first read. A pack that fails verification is
 * dropped from the index so the theme offers the download again. Never rejects.
 */
export function remoteArtOnDevice(id: string): Promise<RemoteArtManifest | null> {
  const cached = remoteCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    try {
      await loadPackIndex();
      const m = await loadRemoteArt(deviceTransport, id);
      if (m) set({ remoteArt: { ...state.remoteArt, [id]: m } });
      else {
        remoteCache.delete(id);
        if (state.index.packs.some((x) => x.id === id)) await saveIndex(cacheIndexRemove(state.index, id));
      }
      return m;
    } catch {
      remoteCache.delete(id);
      return null;
    }
  })();
  remoteCache.set(id, p);
  return p;
}

/**
 * Download (or resume) a remote art pack listed in the catalogue. Call only through src/plus
 * (a Plus pack's entitlement is checked there; free packs need none). Returns null on success or
 * a user-facing error message.
 */
export async function downloadRemoteArtToDevice(id: string): Promise<string | null> {
  await loadPackIndex();
  if (id in state.busy) return null;
  const entry = catalogPack(id);
  if (!entry) return t('plus.packErrors.generic');
  set({ busy: { ...state.busy, [id]: 0 }, errors: { ...state.errors, [id]: '' } });
  try {
    const r = await downloadRemoteArtPack({
      baseUrl: PACK_BASE,
      id,
      packVersion: entry.packVersion,
      transport: deviceTransport,
      appVersion: appVersion(),
      screenLongEdgePx: screenLongEdgePx(),
      onProgress: (p) => set({ busy: { ...state.busy, [id]: p.totalBytes ? p.doneBytes / p.totalBytes : 0 } }),
    });
    remoteCache.set(id, Promise.resolve(r.manifest));
    set({ remoteArt: { ...state.remoteArt, [id]: r.manifest } });
    await saveIndex(cacheIndexAdd(state.index, remoteArtCacheEntry(r.manifest, new Date())));
    return null;
  } catch (e) {
    const msg = messageFor(e);
    set({ errors: { ...state.errors, [id]: msg } });
    return msg;
  } finally {
    const { [id]: _done, ...rest } = state.busy;
    set({ busy: rest });
  }
}
