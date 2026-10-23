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
} from './themePack.ts';
import type { Theme } from './themes.ts';

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

/** Local state of each manifest asset: size, plus SHA-256 when the file is full length. */
async function inventory(transport: Transport, manifest: PackManifest): Promise<HaveFile[]> {
  const have: HaveFile[] = [];
  for (const a of manifest.assets) {
    const b = await transport.readFile(localPath(manifest.id, a.path));
    if (!b) continue;
    have.push(b.length === a.bytes ? { path: a.path, bytes: b.length, sha256: sha256Hex(b) } : { path: a.path, bytes: b.length });
  }
  return have;
}

export async function downloadPack(opts: DownloadOptions): Promise<DownloadResult> {
  const base = resolvePackBaseUrl(opts.baseUrl);
  if (base === null) throw new PackError('disabled', 'theme packs are not available yet');
  const { transport: t, packId } = opts;
  const retries = Math.max(0, opts.retries ?? 1);
  const cancelled = () => {
    if (opts.isCancelled?.()) throw new PackError('cancelled', 'download cancelled');
  };

  const manifest = await fetchManifest(t, base, packId);
  if (!supportsApp(manifest, opts.appVersion)) {
    throw new PackError('app-version', `${manifest.name} needs Glaze ${manifest.minAppVersion} or later`);
  }
  // The manifest is written last; drop any stale copy so a half-updated pack never looks complete.
  await t.remove(localPath(packId, MANIFEST_FILE));

  const plan = planDownload(manifest, await inventory(t, manifest));
  for (const p of plan.discard) await t.remove(localPath(packId, p));
  const byPath = new Map(manifest.assets.map((a) => [a.path, a]));
  const result: DownloadResult = { manifest, fetchedBytes: 0, resumed: [], retried: [] };
  let done = manifest.totalBytes - plan.bytesToFetch;
  const progress = () => opts.onProgress?.({ doneBytes: Math.max(0, Math.min(done, manifest.totalBytes)), totalBytes: manifest.totalBytes });
  progress();

  const fetchInto = async (asset: PackAsset, start: number): Promise<void> => {
    const local = localPath(packId, asset.path);
    if (start === 0) await t.remove(local);
    let res: RangeResponse;
    try {
      res = await t.fetchRange(packFileUrl(base, packId, asset.path), start);
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
    const bytes = await t.readFile(localPath(packId, asset.path));
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
    for (let attempt = 0; !ok && attempt < retries; attempt++) {
      result.retried.push(asset.path);
      done -= asset.bytes;
      await fetchInto(asset, 0);
      ok = await verifyLocal(asset);
    }
    if (!ok) {
      await t.remove(localPath(packId, asset.path));
      throw new PackError('integrity', `${asset.path} failed its integrity check`);
    }
  }
  cancelled();
  await t.writeAppend(localPath(packId, MANIFEST_FILE), utf8Encode(JSON.stringify(manifest)));
  done = manifest.totalBytes;
  progress();
  return result;
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
