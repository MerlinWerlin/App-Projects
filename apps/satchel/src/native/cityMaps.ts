// Offline city maps on the phone (T47). Fetches the catalog from the satchel-maps-v1 release (keeping a copy in
// <documents>/maps/catalog.json so the list shows offline), downloads one city's tar pack to the cache folder, then
// unpacks it into <documents>/maps/<id>/ by walking the tar: each 512-byte header is read as a base64 byte range,
// decoded in src/core/tar.ts, and each allowed entry (src/core/citymaps.ts packEntryPath) is copied across as base64.
// '.complete' is written last; a city without it is not installed. The tar is always deleted afterwards and a
// partial city folder is deleted on any failure or cancel. Nothing here throws to the UI: every call returns a
// result with a reason. After an install, a delete or a new saved catalog copy, cityMapsChanged (src/core/signal.ts)
// fires so the readiness card and Nearest help reload what they show (T63).
import * as FileSystem from 'expo-file-system/legacy';
import { CATALOG_URL, packEntryPath, packMetaToSave, packUrl, parseCatalog, parseCity, parsePackMeta, tilePathTemplate, type CityCatalog, type CityMap } from '../core/citymaps.ts';
import { cityMapsChanged } from '../core/signal.ts';
import { base64ToBytes, BLOCK, nextHeaderOffset, parseTarHeader } from '../core/tar.ts';

const B64 = FileSystem.EncodingType.Base64;
const CATALOG_TIMEOUT_MS = 12_000;

function docRoot(): string | null {
  try {
    return FileSystem.documentDirectory ?? null;
  } catch {
    return null;
  }
}
function cacheRoot(): string | null {
  try {
    return FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? null;
  } catch {
    return null;
  }
}

/** <documents>/maps/ (ends with '/'), or null where there is no storage. */
export function mapsDir(): string | null {
  const root = docRoot();
  return root ? `${root}maps/` : null;
}
export function cityDir(id: string): string | null {
  const m = mapsDir();
  return m ? `${m}${id}/` : null;
}

/** The LocalTile settings for an installed city. */
export function offlineTilesFor(city: CityMap): { pathTemplate: string; minZoom: number; maxZoom: number } | null {
  const dir = cityDir(city.id);
  return dir ? { pathTemplate: tilePathTemplate(dir), minZoom: city.minzoom, maxZoom: city.maxzoom } : null;
}

const quietDelete = (uri: string) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

// ---- catalog ----

export type CatalogFailure = 'offline' | 'not-published' | 'bad-data';
export type CatalogResult =
  | { ok: true; catalog: CityCatalog; /** set when this is the saved copy because the live one failed */ stale?: CatalogFailure }
  | { ok: false; reason: CatalogFailure };

/** The saved catalog copy, or null. */
export async function loadCachedCatalog(): Promise<CityCatalog | null> {
  const dir = mapsDir();
  if (!dir) return null;
  try {
    const info = await FileSystem.getInfoAsync(`${dir}catalog.json`);
    if (!info.exists) return null;
    return parseCatalog(JSON.parse(await FileSystem.readAsStringAsync(`${dir}catalog.json`)));
  } catch {
    return null;
  }
}

/** The live catalog (saved for offline use), or the saved copy when the live one can't be had. */
export async function fetchCatalog(): Promise<CatalogResult> {
  let failure: CatalogFailure;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), CATALOG_TIMEOUT_MS);
  try {
    const res = await fetch(CATALOG_URL, { signal: ctrl?.signal, headers: { Accept: 'application/json' } });
    if (res.status === 404) failure = 'not-published';
    else if (!res.ok) failure = 'offline';
    else {
      const text = await res.text();
      let catalog: CityCatalog | null = null;
      try {
        catalog = parseCatalog(JSON.parse(text));
      } catch {
        catalog = null;
      }
      if (catalog) {
        const dir = mapsDir();
        if (dir) {
          try {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
            await FileSystem.writeAsStringAsync(`${dir}catalog.json`, text);
            cityMapsChanged.emit();
          } catch {
            // the live copy still shows; it just won't be there offline
          }
        }
        return { ok: true, catalog };
      }
      failure = 'bad-data';
    }
  } catch {
    failure = 'offline';
  } finally {
    clearTimeout(timer);
  }
  const cached = await loadCachedCatalog();
  return cached ? { ok: true, catalog: cached, stale: failure } : { ok: false, reason: failure };
}

// ---- installed cities ----

/** Cities fully unpacked on this phone (meta.json valid and '.complete' present). */
export async function listInstalled(): Promise<CityMap[]> {
  const dir = mapsDir();
  if (!dir) return [];
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return [];
    const names = await FileSystem.readDirectoryAsync(dir);
    const out: CityMap[] = [];
    for (const name of names) {
      if (name === 'catalog.json') continue;
      try {
        const done = await FileSystem.getInfoAsync(`${dir}${name}/.complete`);
        if (!done.exists) continue;
        const city = parseCity(JSON.parse(await FileSystem.readAsStringAsync(`${dir}${name}/meta.json`)));
        if (city && city.id === name) out.push(city);
      } catch {
        // not a city folder, or unreadable: not installed
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export type DeleteResult = { ok: true } | { ok: false; reason: 'no-storage' | 'failed' };

export async function deleteCity(id: string): Promise<DeleteResult> {
  const dir = cityDir(id);
  if (!dir) return { ok: false, reason: 'no-storage' };
  try {
    // .complete first, so a half-finished delete never looks installed
    await quietDelete(`${dir}.complete`);
    await FileSystem.deleteAsync(dir, { idempotent: true });
    cityMapsChanged.emit();
    return { ok: true };
  } catch {
    cityMapsChanged.emit(); // '.complete' may already be gone, so the city no longer counts as installed
    return { ok: false, reason: 'failed' };
  }
}

// ---- download and unpack ----

export type DownloadPhase = 'download' | 'unpack';
export type DownloadFailure = 'cancelled' | 'offline' | 'not-published' | 'no-space' | 'bad-pack' | 'no-storage' | 'failed';
export type DownloadResult = { ok: true; city: CityMap } | { ok: false; reason: DownloadFailure };
export type DownloadJob = { promise: Promise<DownloadResult>; cancel: () => void };

type UnpackOutcome = 'ok' | 'cancelled' | 'bad-pack' | 'failed';

async function unpack(tarUri: string, size: number, dir: string, cancelled: () => boolean, onFraction: (f: number) => void): Promise<UnpackOutcome> {
  const made = new Set<string>();
  let off = 0;
  let sawMeta = false;
  let lastReport = 0;
  while (off + BLOCK <= size) {
    if (cancelled()) return 'cancelled';
    let header: Uint8Array | null;
    try {
      header = base64ToBytes(await FileSystem.readAsStringAsync(tarUri, { encoding: B64, position: off, length: BLOCK }));
    } catch {
      return 'failed';
    }
    if (!header || header.length < BLOCK) return 'bad-pack';
    const h = parseTarHeader(header);
    if (h === 'end') break;
    if (typeof h === 'string') return 'bad-pack';
    if (off + BLOCK + h.size > size) return 'bad-pack';
    const rel = h.type === 'file' ? packEntryPath(h.name) : null;
    if (rel) {
      const dest = `${dir}${rel}`;
      const parent = dest.slice(0, dest.lastIndexOf('/') + 1);
      try {
        if (!made.has(parent)) {
          await FileSystem.makeDirectoryAsync(parent, { intermediates: true }).catch(() => {});
          made.add(parent);
        }
        const body = h.size > 0 ? await FileSystem.readAsStringAsync(tarUri, { encoding: B64, position: off + BLOCK, length: h.size }) : '';
        await FileSystem.writeAsStringAsync(dest, body, { encoding: B64 });
      } catch {
        return 'failed';
      }
      if (rel === 'meta.json') sawMeta = true;
    }
    off = nextHeaderOffset(off, h.size);
    if (off - lastReport > size / 100) {
      lastReport = off;
      onFraction(off / size);
    }
  }
  return sawMeta ? 'ok' : 'bad-pack';
}

/**
 * Downloads and installs one city. `onProgress` gets the phase and that phase's 0..1 fraction. Cancel stops the
 * download or the unpacking; the result then says 'cancelled' and nothing is left behind.
 */
export function downloadCity(city: CityMap, onProgress: (phase: DownloadPhase, fraction: number) => void): DownloadJob {
  let isCancelled = false;
  let resumable: FileSystem.DownloadResumable | null = null;
  const cancel = () => {
    isCancelled = true;
    resumable?.cancelAsync().catch(() => {});
  };

  const run = async (): Promise<DownloadResult> => {
    const dir = cityDir(city.id);
    const cache = cacheRoot();
    if (!dir || !cache) return { ok: false, reason: 'no-storage' };
    const tmp = `${cache}satchel-map-${city.id}.tar`;
    const fail = async (reason: DownloadFailure): Promise<DownloadResult> => {
      await quietDelete(tmp);
      await quietDelete(dir);
      return { ok: false, reason };
    };
    try {
      try {
        const free = await FileSystem.getFreeDiskStorageAsync();
        // the pack plus its unpacked copy, with room to spare
        if (Number.isFinite(free) && free > 0 && free < city.bytes * 2 + 50_000_000) return { ok: false, reason: 'no-space' };
      } catch {
        // can't tell: try anyway
      }
      await quietDelete(tmp);
      await quietDelete(dir); // a partial earlier attempt
      onProgress('download', 0);
      resumable = FileSystem.createDownloadResumable(packUrl(city), tmp, {}, (d) => {
        const total = d.totalBytesExpectedToWrite > 0 ? d.totalBytesExpectedToWrite : city.bytes;
        onProgress('download', total > 0 ? Math.min(1, d.totalBytesWritten / total) : 0);
      });
      if (isCancelled) return await fail('cancelled');
      let res: FileSystem.FileSystemDownloadResult | undefined;
      try {
        res = await resumable.downloadAsync();
      } catch {
        return await fail(isCancelled ? 'cancelled' : 'offline');
      }
      if (isCancelled || !res) return await fail(isCancelled ? 'cancelled' : 'offline');
      if (res.status === 404) return await fail('not-published');
      if (res.status < 200 || res.status >= 300) return await fail('offline');
      const info = await FileSystem.getInfoAsync(tmp);
      if (!info.exists || info.size < BLOCK) return await fail('bad-pack');
      onProgress('download', 1);

      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      onProgress('unpack', 0);
      const outcome = await unpack(tmp, info.size, dir, () => isCancelled, (f) => onProgress('unpack', f));
      if (outcome !== 'ok') return await fail(outcome);

      // meta.json has no bytes/sha256 (they describe the tar it was in): take them from the catalog entry and save
      // them back, so listInstalled (parseCity) reads the city later without the catalog (T153).
      let meta: CityMap | null = null;
      let rawMeta: unknown = null;
      try {
        rawMeta = JSON.parse(await FileSystem.readAsStringAsync(`${dir}meta.json`));
        meta = parsePackMeta(rawMeta, city);
      } catch {
        meta = null;
      }
      if (!meta || meta.id !== city.id) return await fail('bad-pack');
      try {
        await FileSystem.writeAsStringAsync(`${dir}meta.json`, JSON.stringify(packMetaToSave(rawMeta, meta)));
      } catch {
        return await fail('failed');
      }
      if (isCancelled) return await fail('cancelled');
      await FileSystem.writeAsStringAsync(`${dir}.complete`, '');
      await quietDelete(tmp);
      onProgress('unpack', 1);
      cityMapsChanged.emit();
      return { ok: true, city: meta };
    } catch {
      return await fail(isCancelled ? 'cancelled' : 'failed');
    }
  };

  return { promise: run(), cancel };
}
