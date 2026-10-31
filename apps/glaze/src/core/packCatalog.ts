// owner-1030 A / T169 (theme hosting): the remote catalogue + remote art-pack contract.
// THE FORMAT IS THE CONTRACT between scripts/packs/build_packs.mjs (writes it),
// scripts/packs/release_assets.mjs (flattens it into GitHub Release assets; publish_r2.mjs is the
// older S3/R2 uploader, kept as reference) and the app (reads it). docs/THEME_PACKS.md and
// docs/PACK_HOSTING.md describe it in words.
//
// Logical layout under PACK_BASE_URL. On a GitHub release host every "/" becomes "__" in the asset
// name (src/core/packHost.ts packObjectUrl); on a folder host the paths are used as-is:
//
//   catalog.json                                   short cache (Cache-Control max-age=300)
//   art/<packId>/v<packVersion>/manifest.json      immutable (a new version gets a new folder)
//   art/<packId>/v<packVersion>/<file>             immutable; file names carry an 8-hex content hash
//
// One theme folder (themes/<id>/, src/core/artPack.ts) becomes one remote art pack with the same id.
// Pure TS, no React Native / Expo imports.

import { isArtPackId, PALETTE_KEYS, type ArtMeta, type ArtPalette } from './artPack.ts';
import { widgetOptionsOfPack, type WidgetOption } from './widgetOptions.ts';

export const CATALOG_FORMAT = 'glaze-catalog';
export const CATALOG_VERSION = 1;
export const CATALOG_FILE = 'catalog.json';
export const REMOTE_ART_FORMAT = 'glaze-remote-art-pack';
/** The version scripts/packs/build_packs.mjs writes (v1 has no widget option list). */
export const REMOTE_ART_VERSION = 1;
/** T187: v2 adds the `widgets` option list and the `widget-art` asset role (docs/THEME_PACKS.md). */
export const REMOTE_ART_VERSION_2 = 2;
export const REMOTE_ART_VERSIONS: readonly number[] = Object.freeze([1, 2]);
export const REMOTE_ART_MANIFEST = 'manifest.json';
/** Largest catalog.json the app will parse. */
export const CATALOG_MAX_BYTES = 2_000_000;
/** Largest single remote art pack (all files). */
export const REMOTE_ART_MAX_BYTES = 20_000_000;

/** What a file in a remote art pack is. Wallpapers come in device classes (long edge in px). */
export type RemoteArtRole = 'wallpaper' | 'widget-small' | 'widget-medium' | 'widget-large' | 'thumb' | 'widget-art';
export const REMOTE_ART_ROLES: readonly RemoteArtRole[] = Object.freeze(['wallpaper', 'widget-small', 'widget-medium', 'widget-large', 'thumb', 'widget-art'] as RemoteArtRole[]);
/** Roles a v1 manifest may use (`widget-art` is v2 only). */
const V1_ROLES: readonly string[] = ['wallpaper', 'widget-small', 'widget-medium', 'widget-large', 'thumb'];

export type RemoteArtAsset = {
  /** Relative to the pack version folder, e.g. "wallpaper-2796.1a2b3c4d.webp". No "/" or "..". */
  path: string;
  role: RemoteArtRole;
  width: number;
  height: number;
  bytes: number;
  /** 64 lower-case hex. */
  sha256: string;
  mime: 'image/webp' | 'image/png';
};

export type RemoteArtManifest = {
  format: typeof REMOTE_ART_FORMAT;
  version: 1 | 2;
  id: string;
  packVersion: number;
  name: string;
  plus: boolean;
  minAppVersion: string;
  palette: ArtPalette;
  meta: ArtMeta;
  /** ThumbHash (base64) of the wallpaper, for an instant blurred placeholder. */
  thumbhash: string;
  assets: RemoteArtAsset[];
  totalBytes: number;
  /**
   * T187: every widget option of the theme. v2: the manifest's `widgets` list (bad entries
   * dropped); v1 (or a v2 list with no valid entry): derived from the widget-* assets.
   */
  widgets: WidgetOption[];
};

export type CatalogPack = {
  id: string;
  name: string;
  packVersion: number;
  plus: boolean;
  /** Sum of the pack's asset bytes (what a full download costs). */
  bytes: number;
  /** Path of the manifest relative to PACK_BASE_URL: art/<id>/v<packVersion>/manifest.json */
  manifest: string;
  /** Path of the small thumbnail relative to PACK_BASE_URL (inside the version folder). */
  thumb: string;
  thumbhash: string;
  palette: ArtPalette;
  tags: string[];
  mood: string;
  addedAt: string;
};

export type Catalog = {
  format: typeof CATALOG_FORMAT;
  version: 1;
  generatedAt: string;
  packs: CatalogPack[];
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const HEX64 = /^[0-9a-f]{64}$/;
const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,120}$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function posInt(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x > 0;
}
function str(x: unknown, max = 400): x is string {
  return typeof x === 'string' && x.length > 0 && x.length <= max;
}

export function manifestPath(id: string, packVersion: number): string {
  return `art/${id}/v${packVersion}/${REMOTE_ART_MANIFEST}`;
}
export function packFolder(id: string, packVersion: number): string {
  return `art/${id}/v${packVersion}`;
}

function parsePalette(x: unknown): ArtPalette | null {
  if (!isObj(x)) return null;
  const out: Record<string, string> = {};
  for (const k of PALETTE_KEYS) {
    const v = x[k];
    if (typeof v !== 'string' || !HEX_COLOUR.test(v)) return null;
    out[k] = v.toUpperCase();
  }
  return out as ArtPalette;
}

/** A relative file name inside a pack version folder: no slashes, no "..", no URL. */
export function isSafeAssetPath(p: unknown): p is string {
  return typeof p === 'string' && FILE_NAME.test(p) && !p.includes('..') && p !== REMOTE_ART_MANIFEST;
}

export function parseCatalog(raw: unknown): ParseResult<Catalog> {
  if (!isObj(raw)) return { ok: false, error: 'catalog: not an object' };
  if (raw.format !== CATALOG_FORMAT) return { ok: false, error: 'catalog: unknown format' };
  if (raw.version !== CATALOG_VERSION) return { ok: false, error: 'catalog: unsupported version' };
  if (!str(raw.generatedAt, 40)) return { ok: false, error: 'catalog: generatedAt missing' };
  if (!Array.isArray(raw.packs)) return { ok: false, error: 'catalog: packs missing' };
  const seen = new Set<string>();
  const packs: CatalogPack[] = [];
  for (const p of raw.packs) {
    // One bad entry hides that pack only; the rest of the catalogue still lists.
    if (!isObj(p) || !isArtPackId(p.id) || seen.has(p.id as string)) continue;
    const id = p.id as string;
    const palette = parsePalette(p.palette);
    if (!str(p.name, 60) || !posInt(p.packVersion) || typeof p.plus !== 'boolean' || !posInt(p.bytes) || !palette) continue;
    if (p.manifest !== manifestPath(id, p.packVersion)) continue;
    if (typeof p.thumb !== 'string' || !p.thumb.startsWith(packFolder(id, p.packVersion) + '/') || !isSafeAssetPath(p.thumb.slice(packFolder(id, p.packVersion).length + 1))) continue;
    if (typeof p.thumbhash !== 'string' || !B64.test(p.thumbhash) || p.thumbhash.length > 64) continue;
    if (p.bytes > REMOTE_ART_MAX_BYTES) continue;
    const tags = Array.isArray(p.tags) ? p.tags.filter((t): t is string => str(t, 40)).slice(0, 20) : [];
    seen.add(id);
    packs.push({
      id,
      name: p.name,
      packVersion: p.packVersion,
      plus: p.plus,
      bytes: p.bytes,
      manifest: p.manifest,
      thumb: p.thumb,
      thumbhash: p.thumbhash,
      palette,
      tags,
      mood: typeof p.mood === 'string' ? p.mood.slice(0, 200) : '',
      addedAt: typeof p.addedAt === 'string' ? p.addedAt.slice(0, 10) : '',
    });
  }
  return { ok: true, value: { format: CATALOG_FORMAT, version: 1, generatedAt: raw.generatedAt, packs } };
}

export function parseRemoteArtManifest(raw: unknown, expectId?: string): ParseResult<RemoteArtManifest> {
  if (!isObj(raw)) return { ok: false, error: 'manifest: not an object' };
  if (raw.format !== REMOTE_ART_FORMAT) return { ok: false, error: 'manifest: unknown format' };
  if (raw.version !== 1 && raw.version !== 2) return { ok: false, error: 'manifest: unsupported version' };
  const version: 1 | 2 = raw.version;
  if (!isArtPackId(raw.id)) return { ok: false, error: 'manifest: bad id' };
  if (expectId !== undefined && raw.id !== expectId) return { ok: false, error: 'manifest: wrong pack id' };
  if (!posInt(raw.packVersion)) return { ok: false, error: 'manifest: bad packVersion' };
  if (!str(raw.name, 60)) return { ok: false, error: 'manifest: bad name' };
  if (typeof raw.plus !== 'boolean') return { ok: false, error: 'manifest: bad plus' };
  if (typeof raw.minAppVersion !== 'string' || !SEMVER.test(raw.minAppVersion)) return { ok: false, error: 'manifest: bad minAppVersion' };
  const palette = parsePalette(raw.palette);
  if (!palette) return { ok: false, error: 'manifest: bad palette' };
  if (!isObj(raw.meta) || !str(raw.meta.name, 60)) return { ok: false, error: 'manifest: bad meta' };
  if (typeof raw.thumbhash !== 'string' || !B64.test(raw.thumbhash)) return { ok: false, error: 'manifest: bad thumbhash' };
  if (!Array.isArray(raw.assets) || raw.assets.length === 0) return { ok: false, error: 'manifest: no assets' };
  const paths = new Set<string>();
  const roles = new Set<string>();
  const assets: RemoteArtAsset[] = [];
  let sum = 0;
  for (const a of raw.assets) {
    if (!isObj(a)) return { ok: false, error: 'manifest: bad asset' };
    if (!isSafeAssetPath(a.path) || paths.has(a.path)) return { ok: false, error: `manifest: bad asset path ${String(a.path)}` };
    if (typeof a.role !== 'string' || !(version === 1 ? V1_ROLES : (REMOTE_ART_ROLES as readonly string[])).includes(a.role)) return { ok: false, error: 'manifest: bad asset role' };
    if (!posInt(a.width) || !posInt(a.height) || !posInt(a.bytes)) return { ok: false, error: 'manifest: bad asset size' };
    if (typeof a.sha256 !== 'string' || !HEX64.test(a.sha256)) return { ok: false, error: 'manifest: bad asset hash' };
    if (a.mime !== 'image/webp' && a.mime !== 'image/png') return { ok: false, error: 'manifest: bad asset mime' };
    paths.add(a.path);
    roles.add(a.role);
    sum += a.bytes;
    assets.push({ path: a.path, role: a.role as RemoteArtRole, width: a.width, height: a.height, bytes: a.bytes, sha256: a.sha256, mime: a.mime });
  }
  for (const need of ['wallpaper', 'thumb'] as const) if (!roles.has(need)) return { ok: false, error: `manifest: no ${need} asset` };
  if (raw.totalBytes !== sum) return { ok: false, error: 'manifest: totalBytes does not match assets' };
  if (sum > REMOTE_ART_MAX_BYTES) return { ok: false, error: 'manifest: pack too large' };
  if (version === 2 && !Array.isArray(raw.widgets)) return { ok: false, error: 'manifest: v2 needs a widgets list' };
  const widgets = widgetOptionsOfPack({ version, widgets: raw.widgets, assets });
  return {
    ok: true,
    value: {
      format: REMOTE_ART_FORMAT,
      version,
      id: raw.id,
      packVersion: raw.packVersion,
      name: raw.name,
      plus: raw.plus,
      minAppVersion: raw.minAppVersion,
      palette,
      meta: raw.meta as ArtMeta,
      thumbhash: raw.thumbhash,
      assets,
      totalBytes: sum,
      widgets,
    },
  };
}

/**
 * The wallpaper a phone should download: the smallest wallpaper whose long edge is at least the
 * screen's long edge in pixels, else the largest one.
 */
export function pickWallpaper(m: Pick<RemoteArtManifest, 'assets'>, screenLongEdgePx: number): RemoteArtAsset | null {
  const walls = m.assets.filter((a) => a.role === 'wallpaper').sort((a, b) => Math.max(a.width, a.height) - Math.max(b.width, b.height));
  if (walls.length === 0) return null;
  return walls.find((w) => Math.max(w.width, w.height) >= screenLongEdgePx) ?? walls[walls.length - 1];
}

/** Assets one phone needs: the picked wallpaper plus every non-wallpaper asset. */
export function assetsForDevice(m: Pick<RemoteArtManifest, 'assets'>, screenLongEdgePx: number): RemoteArtAsset[] {
  const wall = pickWallpaper(m, screenLongEdgePx);
  return m.assets.filter((a) => a.role !== 'wallpaper' || a === wall);
}
