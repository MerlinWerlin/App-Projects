// Theme-pack downloader (T46): pure orchestration over an injected Transport, so Node tests run it
// against a local fixture server and the app runs it over expo-file-system (src/native/packs.ts).
// Fetches the manifest, validates it, resumes partial assets with Range requests, verifies every
// asset's size and SHA-256 (retrying a corrupt asset once from scratch) and writes the manifest
// last, so a pack only counts as downloaded once every file is verified.
// It never decides entitlement (src/plus does) and makes no request when the base URL is empty.

import { concatBytes, sha256Hex, utf8Decode, utf8Encode } from './bytes.ts';
import {
  MANIFEST_FILE,
  packFileUrl,
  parsePackManifest,
  planDownload,
  supportsApp,
  packContentFromFiles,
  verifyAsset,
  type HaveFile,
  type PackAsset,
  type PackContent,
  type PackManifest,
  type PackCacheEntry,
} from './themePack.ts';
import type { Theme } from './themes.ts';
import {
  CATALOG_FILE,
  CATALOG_MAX_BYTES,
  REMOTE_ART_MANIFEST,
  assetsForDevice,
  manifestPath,
  packFolder,
  parseRemoteArtManifest,
  type RemoteArtAsset,
  type RemoteArtManifest,
} from './packCatalog.ts';
import { packObjectUrl } from './packHost.ts';

/** Result of a (possibly ranged) GET. `offset` is where the body starts: `start` for a 206, 0 when the server ignored Range. */
export type RangeResponse = { offset: number; chunks: AsyncIterable<Uint8Array> };

export interface Transport {
  /** GET `url` from byte `start` (sends `Range: bytes=start-` when start > 0). Rejects on HTTP errors. */
  fetchRange(url: string, start: number): Promise<RangeResponse>;
  /** Append to a local file (created if missing). Paths are relative to the pack store root. */
  writeAppend(path: string, chunk: Uint8Array): Promise<void>;
  /** Whole local file, or null if it doesn't exist. */
  readFile(path: string): Promise<Uint8Array | null>;
  /** Delete a local file or folder; no error if it is missing. */
  remove(path: string): Promise<void>;
}

export type PackErrorCode = 'disabled' | 'bad-url' | 'network' | 'manifest' | 'app-version' | 'integrity' | 'cancelled';

export class PackError extends Error {
  code: PackErrorCode;
  constructor(code: PackErrorCode, message: string) {
    super(message);
    this.name = 'PackError';
    this.code = code;
  }
}

export const MAX_MANIFEST_BYTES = 1_000_000;

/**
 * Normalised base URL, or null when packs are disabled (empty). HTTPS only, except plain HTTP to
 * the loopback address for the local fixture server in tests.
 */
export function resolvePackBaseUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (v === '') return null;
  if (!/^https:\/\/[^\s/]+/i.test(v) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(v)) {
    throw new PackError('bad-url', `pack base URL must be https: ${v}`);
  }
  return v.replace(/\/+$/, '');
}

export function packsEnabled(raw: string | null | undefined): boolean {
  try {
    return resolvePackBaseUrl(raw) !== null;
  } catch {
    return false;
  }
}

export const localPath = (packId: string, path: string) => `${packId}/${path}`;

async function readAll(r: RangeResponse, limit: number): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let n = 0;
  for await (const c of r.chunks) {
    n += c.length;
    if (n > limit) throw new PackError('manifest', 'manifest too large');
    parts.push(c);
  }
  return concatBytes(parts);
}

function asNetwork(e: unknown): PackError {
  if (e instanceof PackError) return e;
  return new PackError('network', e instanceof Error ? e.message : String(e));
}

/** Fetch and validate a pack's manifest. */
export async function fetchManifest(transport: Transport, baseUrl: string, packId: string): Promise<PackManifest> {
  let bytes: Uint8Array;
  try {
    bytes = await readAll(await transport.fetchRange(packFileUrl(baseUrl, packId, MANIFEST_FILE), 0), MAX_MANIFEST_BYTES);
  } catch (e) {
    throw asNetwork(e);
  }
  const parsed = parsePackManifest(utf8Decode(bytes));
  if (!parsed.ok) throw new PackError('manifest', parsed.errors.slice(0, 5).join('; '));
  if (parsed.value.id !== packId) throw new PackError('manifest', `manifest is for ${parsed.value.id}, expected ${packId}`);
  return parsed.value;
}

export type DownloadProgress = { doneBytes: number; totalBytes: number };

export type DownloadOptions = {
  /** PACK_BASE_URL (src/config/packs.ts). Empty = disabled: rejects with code 'disabled' and makes no request. */
  baseUrl: string;
  packId: string;
  transport: Transport;
  appVersion: string;
  onProgress?: (p: DownloadProgress) => void;
  /** Extra attempts for an asset that fails its integrity check (default 1). */
  retries?: number;
  isCancelled?: () => boolean;
};

export type DownloadResult = {
  manifest: PackManifest;
  /** Bytes transferred in this call (less than totalBytes when resuming). */
  fetchedBytes: number;
  /** Assets continued from a partial file with a Range request. */
  resumed: string[];
  /** Assets re-fetched after failing verification. */
  retried: string[];
};

type AssetRunOptions = {
  transport: Transport;
  /** Local folder (relative to the pack store root) the files go into. */
  localDir: string;
  assets: readonly PackAsset[];
  /** Remote URL of an asset path. */
  urlFor: (path: string) => string;
  retries: number;
  isCancelled?: () => boolean;
  onProgress?: (p: DownloadProgress) => void;
};

type AssetRunResult = { fetchedBytes: number; resumed: string[]; retried: string[] };

function cancelCheck(isCancelled: (() => boolean) | undefined): () => void {
  return () => {
    if (isCancelled?.()) throw new PackError('cancelled', 'download cancelled');
  };
}

/** Local state of each asset: size, plus SHA-256 when the file is full length. */
async function inventoryOf(transport: Transport, localDir: string, assets: readonly PackAsset[]): Promise<HaveFile[]> {
  const have: HaveFile[] = [];
  for (const a of assets) {
    const b = await transport.readFile(localPath(localDir, a.path));
    if (!b) continue;
    have.push(b.length === a.bytes ? { path: a.path, bytes: b.length, sha256: sha256Hex(b) } : { path: a.path, bytes: b.length });
  }
  return have;
}

/**
 * Fetch (or resume) and verify every asset into `localDir`: Range resume from partial files, a
 * fresh start when the server ignores Range, size + SHA-256 checks with `retries` re-fetches, and
 * a corrupt file removed before rejecting with 'integrity'. Shared by theme packs and remote art
 * packs; the caller writes its manifest last once this resolves.
 */
async function fetchAndVerifyAssets(o: AssetRunOptions): Promise<AssetRunResult> {
  const t = o.transport;
  const cancelled = cancelCheck(o.isCancelled);
  const totalBytes = o.assets.reduce((n, a) => n + a.bytes, 0);
  const plan = planDownload({ assets: [...o.assets] }, await inventoryOf(t, o.localDir, o.assets));
  for (const p of plan.discard) await t.remove(localPath(o.localDir, p));
  const byPath = new Map(o.assets.map((a) => [a.path, a]));
  const result: AssetRunResult = { fetchedBytes: 0, resumed: [], retried: [] };
  let done = totalBytes - plan.bytesToFetch;
  const progress = () => o.onProgress?.({ doneBytes: Math.max(0, Math.min(done, totalBytes)), totalBytes });
  cancelled();
  progress();

  const fetchInto = async (asset: PackAsset, start: number): Promise<void> => {
    const local = localPath(o.localDir, asset.path);
    if (start === 0) await t.remove(local);
    let res: RangeResponse;
    try {
      res = await t.fetchRange(o.urlFor(asset.path), start);
    } catch (e) {
      throw asNetwork(e);
    }
    let written = start;
    if (res.offset !== start) {
      if (res.offset !== 0) throw new PackError('network', `unexpected range offset for ${asset.path}`);
      // Server ignored Range: start the file again.
      await t.remove(local);
      done -= start;
      written = 0;
    } else if (start > 0) result.resumed.push(asset.path);
    try {
      for await (const chunk of res.chunks) {
        cancelled();
        if (written + chunk.length > asset.bytes) {
          // Longer than the manifest says: keep only what fits; verification decides.
          const fit = chunk.subarray(0, Math.max(0, asset.bytes - written));
          if (fit.length) await t.writeAppend(local, fit);
          written = asset.bytes + 1;
          break;
        }
        await t.writeAppend(local, chunk);
        written += chunk.length;
        result.fetchedBytes += chunk.length;
        done += chunk.length;
        progress();
      }
    } catch (e) {
      throw asNetwork(e); // the partial file stays for the next attempt's Range request
    }
  };

  const verifyLocal = async (asset: PackAsset): Promise<boolean> => {
    const bytes = await t.readFile(localPath(o.localDir, asset.path));
    return !!bytes && verifyAsset(asset, bytes).ok;
  };

  const steps = [...plan.fetch, ...plan.verify.map((path) => ({ path, start: -1, bytes: byPath.get(path)!.bytes }))];
  for (const step of steps) {
    cancelled();
    const asset = byPath.get(step.path)!;
    let ok = false;
    if (step.start < 0) ok = await verifyLocal(asset);
    else {
      await fetchInto(asset, step.start);
      ok = await verifyLocal(asset);
    }
    for (let attempt = 0; !ok && attempt < o.retries; attempt++) {
      result.retried.push(asset.path);
      done -= asset.bytes;
      await fetchInto(asset, 0);
      ok = await verifyLocal(asset);
    }
    if (!ok) {
      await t.remove(localPath(o.localDir, asset.path));
      throw new PackError('integrity', `${asset.path} failed its integrity check`);
    }
  }
  cancelled();
  return result;
}

export async function downloadPack(opts: DownloadOptions): Promise<DownloadResult> {
  const base = resolvePackBaseUrl(opts.baseUrl);
  if (base === null) throw new PackError('disabled', 'theme packs are not available yet');
  const { transport: t, packId } = opts;

  const manifest = await fetchManifest(t, base, packId);
  if (!supportsApp(manifest, opts.appVersion)) {
    throw new PackError('app-version', `${manifest.name} needs Glaze ${manifest.minAppVersion} or later`);
  }
  // The manifest is written last; drop any stale copy so a half-updated pack never looks complete.
  await t.remove(localPath(packId, MANIFEST_FILE));

  const run = await fetchAndVerifyAssets({
    transport: t,
    localDir: packId,
    assets: manifest.assets,
    urlFor: (path) => packFileUrl(base, packId, path),
    retries: Math.max(0, opts.retries ?? 1),
    isCancelled: opts.isCancelled,
    onProgress: opts.onProgress,
  });
  await t.writeAppend(localPath(packId, MANIFEST_FILE), utf8Encode(JSON.stringify(manifest)));
  opts.onProgress?.({ doneBytes: manifest.totalBytes, totalBytes: manifest.totalBytes });
  return { manifest, ...run };
}

/** A downloaded pack's manifest, or null if it isn't (fully) downloaded. */
export async function readLocalManifest(transport: Transport, packId: string): Promise<PackManifest | null> {
  const b = await transport.readFile(localPath(packId, MANIFEST_FILE));
  if (!b) return null;
  const parsed = parsePackManifest(utf8Decode(b));
  return parsed.ok && parsed.value.id === packId ? parsed.value : null;
}

/**
 * Themes and pack-only motifs of a downloaded pack, re-verifying each art asset (a tampered file
 * hides that theme). Empty when the pack isn't (fully) downloaded.
 */
export async function loadPackContent(transport: Transport, packId: string): Promise<PackContent> {
  const manifest = await readLocalManifest(transport, packId);
  if (!manifest) return { themes: [], motifs: {} };
  const files = new Map<string, Uint8Array>();
  for (const d of manifest.themes) {
    const asset = manifest.assets.find((a) => a.path === d.artAsset);
    const bytes = asset ? await transport.readFile(localPath(packId, asset.path)) : null;
    if (asset && bytes && verifyAsset(asset, bytes).ok) files.set(asset.path, bytes);
  }
  return packContentFromFiles(manifest, (p) => files.get(p));
}

/** Themes of a downloaded pack, re-verifying each art asset (a tampered file hides that theme). */
export async function loadPackThemes(transport: Transport, packId: string): Promise<Theme[]> {
  return (await loadPackContent(transport, packId)).themes;
}

/** Delete a pack's folder. */
export async function removePack(transport: Transport, packId: string): Promise<void> {
  await transport.remove(packId);
}

// ------------------------------------------------------------ remote art packs + catalogue (owner-1030 A, T160)
// Layout under the base URL (src/core/packCatalog.ts): catalog.json and art/<id>/v<n>/manifest.json
// + hashed files. On the phone a remote art pack lives in <id>/ (same store root as theme packs):
// only the files this phone needs (assetsForDevice) plus manifest.json, written last, listing just
// those files, so a pack only counts as downloaded once every file it lists is verified.

/** GET a small text file in full (no Range), rejecting with 'network' or, above `limit` bytes, `tooLarge`. */
export async function fetchText(transport: Transport, url: string, limit: number, tooLarge: PackErrorCode = 'manifest'): Promise<string> {
  let res: RangeResponse;
  try {
    res = await transport.fetchRange(url, 0);
  } catch (e) {
    throw asNetwork(e);
  }
  const parts: Uint8Array[] = [];
  let n = 0;
  try {
    for await (const c of res.chunks) {
      n += c.length;
      if (n > limit) throw new PackError(tooLarge, 'response too large');
      parts.push(c);
    }
  } catch (e) {
    throw asNetwork(e);
  }
  return utf8Decode(concatBytes(parts));
}

/**
 * catalog.json as text. Rejects 'disabled' without any request while the base URL is empty, and
 * 'network' when offline or the file is too big. Parsing and keeping the last good copy is
 * src/core/remoteCatalog.ts's job.
 */
export async function fetchCatalogText(transport: Transport, baseUrl: string): Promise<string> {
  const base = resolvePackBaseUrl(baseUrl);
  if (base === null) throw new PackError('disabled', 'theme packs are not available yet');
  return fetchText(transport, packObjectUrl(base, CATALOG_FILE), CATALOG_MAX_BYTES, 'network');
}

function parseManifestText(text: string, id: string): RemoteArtManifest | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const r = parseRemoteArtManifest(raw, id);
  return r.ok ? r.value : null;
}

/** Fetch and validate a remote art pack's manifest (art/<id>/v<n>/manifest.json). `baseUrl` is already resolved. */
export async function fetchRemoteArtManifest(transport: Transport, baseUrl: string, id: string, packVersion: number): Promise<RemoteArtManifest> {
  const text = await fetchText(transport, packObjectUrl(baseUrl, manifestPath(id, packVersion)), MAX_MANIFEST_BYTES);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PackError('manifest', 'manifest is not JSON');
  }
  const r = parseRemoteArtManifest(raw, id);
  if (!r.ok) throw new PackError('manifest', r.error);
  if (r.value.packVersion !== packVersion) throw new PackError('manifest', `manifest is v${r.value.packVersion}, expected v${packVersion}`);
  return r.value;
}

/** The on-phone manifest: the remote one cut down to the files this phone downloaded. */
export function deviceManifest(m: RemoteArtManifest, assets: readonly RemoteArtAsset[]): RemoteArtManifest {
  const kept = assets.map((a) => ({ ...a }));
  return { ...m, assets: kept, totalBytes: kept.reduce((n, a) => n + a.bytes, 0) };
}

export type RemoteArtDownloadOptions = {
  /** The pack base URL (src/config/packs.ts). Empty = disabled: rejects with 'disabled' and makes no request. */
  baseUrl: string;
  /** Pack id and version, from the catalogue entry. */
  id: string;
  packVersion: number;
  transport: Transport;
  appVersion: string;
  /** The phone's screen long edge in pixels (picks the wallpaper size class). */
  screenLongEdgePx: number;
  onProgress?: (p: DownloadProgress) => void;
  retries?: number;
  isCancelled?: () => boolean;
};

export type RemoteArtDownloadResult = {
  /** What is on the phone now (device subset of the remote manifest). */
  manifest: RemoteArtManifest;
  fetchedBytes: number;
  resumed: string[];
  retried: string[];
};

/**
 * Download (or resume) a remote art pack: the manifest, then the files this phone needs with the
 * same resume + SHA-256 verification as theme packs, then the local manifest last. A different
 * version already on the phone is removed first (file names carry content hashes).
 */
export async function downloadRemoteArtPack(opts: RemoteArtDownloadOptions): Promise<RemoteArtDownloadResult> {
  const base = resolvePackBaseUrl(opts.baseUrl);
  if (base === null) throw new PackError('disabled', 'theme packs are not available yet');
  const { transport: t, id } = opts;
  if (opts.isCancelled?.()) throw new PackError('cancelled', 'download cancelled');
  const manifest = await fetchRemoteArtManifest(t, base, id, opts.packVersion);
  if (!supportsApp(manifest, opts.appVersion)) {
    throw new PackError('app-version', `${manifest.name} needs Glaze ${manifest.minAppVersion} or later`);
  }
  const old = await readLocalRemoteArt(t, id);
  if (old && old.packVersion !== manifest.packVersion) await t.remove(id);
  // Written last; drop any stale copy so a half-updated pack never looks complete.
  await t.remove(localPath(id, REMOTE_ART_MANIFEST));

  const assets = assetsForDevice(manifest, opts.screenLongEdgePx);
  const folder = packFolder(id, manifest.packVersion);
  const run = await fetchAndVerifyAssets({
    transport: t,
    localDir: id,
    assets,
    urlFor: (path) => packObjectUrl(base, `${folder}/${path}`),
    retries: Math.max(0, opts.retries ?? 1),
    isCancelled: opts.isCancelled,
    onProgress: opts.onProgress,
  });
  const local = deviceManifest(manifest, assets);
  await t.writeAppend(localPath(id, REMOTE_ART_MANIFEST), utf8Encode(JSON.stringify(local)));
  opts.onProgress?.({ doneBytes: local.totalBytes, totalBytes: local.totalBytes });
  return { manifest: local, ...run };
}

/** A downloaded remote art pack's (device) manifest, or null if it isn't (fully) downloaded. */
export async function readLocalRemoteArt(transport: Transport, id: string): Promise<RemoteArtManifest | null> {
  const b = await transport.readFile(localPath(id, REMOTE_ART_MANIFEST));
  return b ? parseManifestText(utf8Decode(b), id) : null;
}

/**
 * The downloaded remote art pack after re-verifying every file it lists, or null when it isn't on
 * the phone or a file was tampered with / damaged (the theme then offers the download again).
 */
export async function loadRemoteArt(transport: Transport, id: string): Promise<RemoteArtManifest | null> {
  const m = await readLocalRemoteArt(transport, id);
  if (!m) return null;
  for (const a of m.assets) {
    const bytes = await transport.readFile(localPath(id, a.path));
    if (!bytes || !verifyAsset(a, bytes).ok) return null;
  }
  return m;
}

/** Cache-index entry (Settings › Storage) for a downloaded remote art pack. */
export function remoteArtCacheEntry(m: RemoteArtManifest, now: Date): PackCacheEntry {
  return { id: m.id, name: m.name, version: m.version, bytes: m.totalBytes, themeIds: [m.id], downloadedAt: now.toISOString() };
}
