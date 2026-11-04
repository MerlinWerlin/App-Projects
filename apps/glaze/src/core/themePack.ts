// Downloadable theme packs (T46, owner request 16 Oct 2026, R6). Pure model: manifest format and
// validation, artwork asset encoding, resume planning, integrity checks, the on-device cache index
// and size formatting. Network and files live behind src/core/packDownloader.ts's Transport.
// Whether a person may download a Plus pack is decided in src/plus (never here).
//
// Layout of a published pack (all paths relative to `<PACK_BASE_URL>/<pack id>/`):
//   manifest.json            PackManifest (small: theme metadata, asset list with sizes + SHA-256)
//   art/<theme id>.json.gz   gzip'd ArtAsset: the theme's ThemeArt plus the vector layers of every
//                            motif it uses (the bulk of the pack)
//   thumbs/<theme id>.png    optional preview thumbnail
// See docs/THEME_PACKS.md.

import { packObjectUrl } from './packHost.ts';
import {
  COMPOSITION_KINDS,
  DISPLAY_FONTS,
  FILL_ROLES,
  MOTIFS,
  iconArtOf,
  isMotifId,
  sanitizeIconArt,
  sanitizeWallpaperArt,
  wallpaperArtOf,
  type CompositionKind,
  type DisplayFont,
  type FillRole,
  type MotifLayer,
  type ThemeArt,
} from './artwork.ts';
import { isSha256Hex, sha256Hex, sha256HexChunked, utf8Decode, utf8Encode } from './bytes.ts';
import { isHex } from './colour.ts';
import { gunzip } from './inflate.ts';
import type { IconStyle } from './iconspec.ts';
import { packMotifLayers } from './packMotifs.ts';
import { SHAPES } from './shapes.ts';
import type { Theme, ThemeCategoryId } from './themes.ts';
import type { WallpaperParams } from './wallpaper.ts';

export const PACK_FORMAT = 'glaze-pack';
export const PACK_VERSION = 1;
export const ART_FORMAT = 'glaze-art';
export const MANIFEST_FILE = 'manifest.json';
/** Hard caps so a bad manifest can't ask the phone to store something huge. */
export const MAX_PACK_BYTES = 50 * 1000 * 1000;
export const MAX_PACK_ASSETS = 500;
export const MAX_PACK_THEMES = 64;

export const THEME_CATEGORY_IDS: readonly ThemeCategoryId[] = Object.freeze([
  'minimal',
  'dark',
  'pastel',
  'nature',
  'neon',
  'retro',
  'anime',
  'cute',
  'luxury',
  'seasonal',
] as ThemeCategoryId[]);

export type PackAsset = { path: string; bytes: number; sha256: string };

/** A theme as listed in a manifest: the theme JSON minus its artwork, which lives in `artAsset`. */
export type ThemeData = Omit<Theme, 'art' | 'iconStyle' | 'wallpaper'> & {
  iconStyle: Omit<IconStyle, 'art'>;
  wallpaper: Omit<WallpaperParams, 'art'>;
  /** Asset path of the gzip'd ArtAsset. */
  artAsset: string;
  /** Optional PNG thumbnail asset path. */
  thumbAsset?: string;
};

export type PackManifest = {
  format: typeof PACK_FORMAT;
  version: typeof PACK_VERSION;
  id: string;
  name: string;
  plus: true;
  /** Oldest app version that can show this pack (semver-ish "1.2.3"). */
  minAppVersion: string;
  themes: ThemeData[];
  assets: PackAsset[];
  /** Sum of every asset's bytes (the manifest itself not included). */
  totalBytes: number;
};

/** Decompressed contents of an `art/<id>.json.gz` asset. */
export type ArtAsset = {
  format: typeof ART_FORMAT;
  version: 1;
  themeId: string;
  art: ThemeArt;
  /** Vector layers of every motif the art uses (motif box 0..100), so packs can bring new motifs. */
  motifs: Record<string, MotifLayer[]>;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

// ------------------------------------------------------------ paths and versions

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Relative, forward-slash, no `..`/`.` segments, no absolute or drive paths, conservative charset. */
export function isSafeAssetPath(p: unknown): p is string {
  if (typeof p !== 'string' || p.length === 0 || p.length > 200) return false;
  if (p.startsWith('/') || p.includes('\\') || /^[a-zA-Z]:/.test(p) || p.includes('://')) return false;
  if (!/^[A-Za-z0-9._/-]+$/.test(p)) return false;
  const segs = p.split('/');
  return segs.every((s) => s.length > 0 && s !== '.' && s !== '..');
}

function versionParts(v: string): number[] | null {
  const m = /^(\d{1,4})(?:\.(\d{1,4}))?(?:\.(\d{1,4}))?$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

export function isAppVersion(v: unknown): v is string {
  return typeof v === 'string' && versionParts(v) !== null;
}

/** -1, 0 or 1; unparsable versions sort first. */
export function compareVersions(a: string, b: string): number {
  const x = versionParts(a) ?? [-1, 0, 0];
  const y = versionParts(b) ?? [-1, 0, 0];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

export function supportsApp(manifest: Pick<PackManifest, 'minAppVersion'>, appVersion: string): boolean {
  return compareVersions(appVersion, manifest.minAppVersion) >= 0;
}

/**
 * `<base>/<packId>/<path>` with exactly one slash between parts, or the flat release-asset name
 * `<base>/<packId>__<path>` on a GitHub release host (T169, src/core/packHost.ts).
 */
export function packFileUrl(baseUrl: string, packId: string, path: string): string {
  return packObjectUrl(baseUrl, `${packId}/${path}`);
}

// ------------------------------------------------------------ manifest validation

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;

function themeErrors(raw: unknown, i: number, packId: string, assetPaths: Set<string>): string[] {
  const where = `themes[${i}]`;
  if (!isObj(raw)) return [`${where}: not an object`];
  const e: string[] = [];
  if (typeof raw.id !== 'string' || !SLUG.test(raw.id)) e.push(`${where}: bad id`);
  if (!isNonEmpty(raw.name)) e.push(`${where}: missing name`);
  if (typeof raw.tagline !== 'string') e.push(`${where}: missing tagline`);
  if (raw.plus !== true) e.push(`${where}: pack themes must be plus`);
  if (raw.packId !== packId) e.push(`${where}: packId must be ${packId}`);
  if (!isObj(raw.palette) || !['bg', 'surface', 'accent', 'ink', 'glyph'].every((k) => typeof (raw.palette as Record<string, unknown>)[k] === 'string' && isHex((raw.palette as Record<string, string>)[k])))
    e.push(`${where}: bad palette`);
  const is = raw.iconStyle;
  if (!isObj(is) || typeof is.shape !== 'string' || !(SHAPES as readonly string[]).includes(is.shape) || !isObj(is.background) || typeof is.glyphColour !== 'string' || !isHex(is.glyphColour))
    e.push(`${where}: bad iconStyle`);
  else if ('art' in is) e.push(`${where}: iconStyle.art belongs in the art asset`);
  const wp = raw.wallpaper;
  if (!isObj(wp) || typeof wp.kind !== 'string' || !Array.isArray(wp.colours) || typeof wp.seed !== 'number') e.push(`${where}: bad wallpaper`);
  else if ('art' in wp) e.push(`${where}: wallpaper.art belongs in the art asset`);
  if (!isObj(raw.widget)) e.push(`${where}: bad widget`);
  if ('art' in raw) e.push(`${where}: art belongs in the art asset`);
  if (!isSafeAssetPath(raw.artAsset) || !assetPaths.has(raw.artAsset)) e.push(`${where}: artAsset not in assets`);
  if (raw.thumbAsset !== undefined && (!isSafeAssetPath(raw.thumbAsset) || !assetPaths.has(raw.thumbAsset))) e.push(`${where}: thumbAsset not in assets`);
  if (raw.categories !== undefined && (!Array.isArray(raw.categories) || !raw.categories.every((c) => (THEME_CATEGORY_IDS as readonly unknown[]).includes(c))))
    e.push(`${where}: unknown category`);
  if (raw.tags !== undefined && (!Array.isArray(raw.tags) || !raw.tags.every((t) => typeof t === 'string'))) e.push(`${where}: bad tags`);
  if (raw.addedAt !== undefined && (typeof raw.addedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.addedAt))) e.push(`${where}: bad addedAt`);
  return e;
}

/** Validate an untrusted manifest (object or JSON text). Never throws. */
export function parsePackManifest(input: unknown): ParseResult<PackManifest> {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, errors: ['manifest is not JSON'] };
    }
  }
  if (!isObj(raw)) return { ok: false, errors: ['manifest is not an object'] };
  if (raw.format !== PACK_FORMAT) return { ok: false, errors: [`unknown format ${JSON.stringify(raw.format)}`] };
  if (raw.version !== PACK_VERSION) return { ok: false, errors: [`unsupported version ${JSON.stringify(raw.version)}`] };
  const e: string[] = [];
  const id = typeof raw.id === 'string' && SLUG.test(raw.id) ? raw.id : null;
  if (!id) e.push('bad pack id');
  if (!isNonEmpty(raw.name)) e.push('missing pack name');
  if (raw.plus !== true) e.push('packs are Plus content (plus: true)');
  if (!isAppVersion(raw.minAppVersion)) e.push('bad minAppVersion');

  const paths = new Set<string>();
  let sum = 0;
  if (!Array.isArray(raw.assets) || raw.assets.length === 0) e.push('no assets');
  else if (raw.assets.length > MAX_PACK_ASSETS) e.push('too many assets');
  else {
    raw.assets.forEach((a: unknown, i: number) => {
      if (!isObj(a)) return void e.push(`assets[${i}]: not an object`);
      if (!isSafeAssetPath(a.path)) e.push(`assets[${i}]: unsafe path ${JSON.stringify(a.path)}`);
      else if (a.path === MANIFEST_FILE) e.push(`assets[${i}]: reserved path`);
      else if (paths.has(a.path)) e.push(`assets[${i}]: duplicate path ${a.path}`);
      else paths.add(a.path);
      if (typeof a.bytes !== 'number' || !Number.isInteger(a.bytes) || a.bytes <= 0) e.push(`assets[${i}]: bad size`);
      else sum += a.bytes;
      if (!isSha256Hex(a.sha256)) e.push(`assets[${i}]: bad sha256`);
    });
  }
  if (typeof raw.totalBytes !== 'number' || raw.totalBytes !== sum) e.push(`totalBytes ${String(raw.totalBytes)} does not match assets (${sum})`);
  if (sum > MAX_PACK_BYTES) e.push('pack too large');

  if (!Array.isArray(raw.themes) || raw.themes.length === 0) e.push('no themes');
  else if (raw.themes.length > MAX_PACK_THEMES) e.push('too many themes');
  else {
    const ids = new Set<string>();
    raw.themes.forEach((t: unknown, i: number) => {
      e.push(...themeErrors(t, i, id ?? '', paths));
      const tid = isObj(t) ? t.id : undefined;
      if (typeof tid === 'string') {
        if (ids.has(tid)) e.push(`themes[${i}]: duplicate id ${tid}`);
        ids.add(tid);
      }
    });
  }
  return e.length ? { ok: false, errors: e } : { ok: true, value: raw as unknown as PackManifest };
}

// ------------------------------------------------------------ themes <-> pack data

/** Motif ids a piece of art draws (composition motifs and stickers). */
export function motifsUsed(art: ThemeArt): string[] {
  return [...new Set([...art.motifs, ...art.stickers.map((s) => s.motif)])];
}

/** Manifest entry for a theme (artwork stripped out). */
export function themeToData(t: Theme, artAsset = `art/${t.id}.json.gz`): ThemeData {
  const { art: _art, iconStyle, wallpaper, ...rest } = t;
  const { art: _ia, ...icon } = iconStyle;
  const { art: _wa, ...wall } = wallpaper;
  return { ...rest, iconStyle: icon, wallpaper: wall, artAsset };
}

/** JSON text of a theme's art asset (the build script gzips it). */
export function artAssetJson(t: Theme): string {
  const motifs: Record<string, MotifLayer[]> = {};
  for (const id of motifsUsed(t.art)) {
    // Built-in motifs, plus pack-only ones registered from another pack (T47) so they round-trip.
    const layers = isMotifId(id) ? MOTIFS[id].layers : packMotifLayers(id);
    if (layers) motifs[id] = layers.map((l) => ({ ...l }));
  }
  const asset: ArtAsset = { format: ART_FORMAT, version: 1, themeId: t.id, art: t.art, motifs };
  return JSON.stringify(asset);
}

function isRole(v: unknown): v is FillRole {
  return typeof v === 'string' && (FILL_ROLES as readonly string[]).includes(v);
}

/** Parse a gzip'd (or plain JSON) art asset. Throws on anything invalid. */
export function decodeArtAsset(bytes: Uint8Array): ArtAsset {
  const plain = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzip(bytes) : bytes;
  const raw: unknown = JSON.parse(utf8Decode(plain));
  if (!isObj(raw) || raw.format !== ART_FORMAT || raw.version !== 1 || typeof raw.themeId !== 'string') throw new Error('art asset: bad header');
  const motifs: Record<string, MotifLayer[]> = {};
  if (isObj(raw.motifs)) {
    for (const [id, layers] of Object.entries(raw.motifs)) {
      if (!SLUG.test(id) || !Array.isArray(layers)) continue;
      const ok = layers.filter((l): l is MotifLayer => isObj(l) && typeof l.d === 'string' && l.d.length < 20000 && isRole(l.role)).slice(0, 5);
      if (ok.length) motifs[id] = ok.map((l) => (l.opacity === undefined ? { d: l.d, role: l.role } : { d: l.d, role: l.role, opacity: Number(l.opacity) }));
    }
  }
  // T47: art may use the pack's own motifs, but only ones whose layers ship in this asset.
  const packOnly = new Set(Object.keys(motifs).filter((id) => !isMotifId(id)));
  const a = raw.art;
  const icon = sanitizeIconArt(a, packOnly);
  const wall = sanitizeWallpaperArt(a, packOnly);
  if (!isObj(a) || !icon || !wall) throw new Error('art asset: bad art');
  const displayFont = (DISPLAY_FONTS as readonly unknown[]).includes(a.displayFont) ? (a.displayFont as DisplayFont) : 'display';
  const composition = (COMPOSITION_KINDS as readonly unknown[]).includes(a.composition) ? (a.composition as CompositionKind) : wall.composition;
  const art: ThemeArt = { ...icon, motifs: wall.motifs, composition, displayFont };
  return { format: ART_FORMAT, version: 1, themeId: raw.themeId, art, motifs };
}

/** Rebuild a full Theme from its manifest entry and decoded art. */
export function themeFromData(data: ThemeData, art: ThemeArt): Theme {
  const { artAsset: _a, thumbAsset: _t, ...rest } = data;
  return {
    ...rest,
    iconStyle: { ...rest.iconStyle, art: iconArtOf(art) },
    wallpaper: { ...rest.wallpaper, art: wallpaperArtOf(art) },
    art,
  };
}

/** Themes of a downloaded pack plus the vector layers of the motifs it brings that the app doesn't ship. */
export type PackContent = { themes: Theme[]; motifs: Record<string, MotifLayer[]> };

/**
 * Themes and pack-only motifs of a downloaded pack from its verified files (path → bytes).
 * Themes whose art fails to decode are skipped (and contribute no motifs).
 */
export function packContentFromFiles(manifest: PackManifest, files: (path: string) => Uint8Array | null | undefined): PackContent {
  const themes: Theme[] = [];
  const motifs: Record<string, MotifLayer[]> = {};
  for (const d of manifest.themes) {
    const bytes = files(d.artAsset);
    if (!bytes) continue;
    try {
      const asset = decodeArtAsset(bytes);
      if (asset.themeId !== d.id) continue;
      themes.push(themeFromData(d, asset.art));
      for (const [id, layers] of Object.entries(asset.motifs)) if (!isMotifId(id) && !motifs[id]) motifs[id] = layers;
    } catch {
      // A broken asset hides that one theme; the rest of the pack still works.
    }
  }
  return { themes, motifs };
}

/** Themes of a downloaded pack from its verified files (path → bytes). Themes whose art fails to decode are skipped. */
export function themesFromPack(manifest: PackManifest, files: (path: string) => Uint8Array | null | undefined): Theme[] {
  return packContentFromFiles(manifest, files).themes;
}

// ------------------------------------------------------------ resume planning and integrity

/** What is already on disk for an asset (sha256 when the file is complete and was hashed). */
export type HaveFile = { path: string; bytes: number; sha256?: string };
/** Fetch `path` starting at byte `start` (an HTTP Range request when start > 0). */
export type FetchStep = { path: string; start: number; bytes: number };
export type DownloadPlan = {
  fetch: FetchStep[];
  /** Full-size files with no known hash: hash them, then treat as complete or refetch. */
  verify: string[];
  complete: string[];
  /** Local files to delete first (oversized, wrong hash, or not in the manifest). */
  discard: string[];
  bytesToFetch: number;
};

export function planDownload(manifest: Pick<PackManifest, 'assets'>, alreadyHave: readonly HaveFile[]): DownloadPlan {
  const have = new Map(alreadyHave.map((h) => [h.path, h]));
  const plan: DownloadPlan = { fetch: [], verify: [], complete: [], discard: [], bytesToFetch: 0 };
  const want = new Set<string>();
  for (const a of manifest.assets) {
    want.add(a.path);
    const h = have.get(a.path);
    let start = 0;
    if (h && h.bytes > 0) {
      if (h.bytes === a.bytes) {
        if (h.sha256 === undefined) {
          plan.verify.push(a.path);
          continue;
        }
        if (h.sha256 === a.sha256) {
          plan.complete.push(a.path);
          continue;
        }
        plan.discard.push(a.path);
      } else if (h.bytes < a.bytes) start = h.bytes;
      else plan.discard.push(a.path);
    }
    plan.fetch.push({ path: a.path, start, bytes: a.bytes });
    plan.bytesToFetch += a.bytes - start;
  }
  for (const h of alreadyHave) if (!want.has(h.path) && h.path !== MANIFEST_FILE) plan.discard.push(h.path);
  return plan;
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'size' | 'hash' };

export function verifyAsset(asset: PackAsset, bytes: Uint8Array): VerifyResult {
  if (bytes.length !== asset.bytes) return { ok: false, reason: 'size' };
  return sha256Hex(bytes) === asset.sha256 ? { ok: true } : { ok: false, reason: 'hash' };
}

/** T258: verifyAsset with the hash done in slices that yield to the event loop (pack downloads). */
export async function verifyAssetAsync(asset: PackAsset, bytes: Uint8Array): Promise<VerifyResult> {
  if (bytes.length !== asset.bytes) return { ok: false, reason: 'size' };
  return (await sha256HexChunked(bytes)) === asset.sha256 ? { ok: true } : { ok: false, reason: 'hash' };
}

// ------------------------------------------------------------ cache index (what's downloaded)

export type PackCacheEntry = {
  id: string;
  name: string;
  /** Manifest format version the pack was stored with. */
  version: number;
  /**
   * T222: content version of a downloaded remote art pack (catalogue `packVersion`), so a newer
   * catalogue entry triggers an update. Absent on theme packs and on entries written before T222
   * (src/core/packUpdates.ts downloadedPackVersion back-fills those from the manifest, else 1).
   */
  packVersion?: number;
  bytes: number;
  themeIds: string[];
  /** ISO timestamp. */
  downloadedAt: string;
};
export type PackCacheIndex = { version: 1; packs: PackCacheEntry[] };

export const EMPTY_CACHE_INDEX: PackCacheIndex = Object.freeze({ version: 1, packs: Object.freeze([]) as unknown as PackCacheEntry[] }) as PackCacheIndex;

export function cacheEntryFor(manifest: PackManifest, now: Date): PackCacheEntry {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    bytes: manifest.totalBytes,
    themeIds: manifest.themes.map((t) => t.id),
    downloadedAt: now.toISOString(),
  };
}

/** Add or replace a pack (sorted by name so Settings is stable). */
export function cacheIndexAdd(index: PackCacheIndex, entry: PackCacheEntry): PackCacheIndex {
  const packs = index.packs.filter((p) => p.id !== entry.id);
  const copy: PackCacheEntry = { ...entry, themeIds: [...entry.themeIds] };
  if (copy.packVersion === undefined) delete copy.packVersion;
  packs.push(copy);
  packs.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { version: 1, packs };
}

/** T222: record a downloaded pack's packVersion (back-fill of an entry written before T222). */
export function cacheIndexSetPackVersion(index: PackCacheIndex, id: string, packVersion: number): PackCacheIndex {
  if (!Number.isInteger(packVersion) || packVersion <= 0) return index;
  const hit = index.packs.find((p) => p.id === id);
  if (!hit || hit.packVersion === packVersion) return index;
  return { version: 1, packs: index.packs.map((p) => (p.id === id ? { ...p, themeIds: [...p.themeIds], packVersion } : p)) };
}

export function cacheIndexRemove(index: PackCacheIndex, id: string): PackCacheIndex {
  return { version: 1, packs: index.packs.filter((p) => p.id !== id) };
}

export function totalCacheBytes(index: PackCacheIndex): number {
  return index.packs.reduce((n, p) => n + p.bytes, 0);
}

export function isPackDownloaded(index: PackCacheIndex, id: string | undefined): boolean {
  return !!id && index.packs.some((p) => p.id === id);
}

/** Sanitize a persisted index (junk entries dropped, never throws). */
export function parseCacheIndex(input: unknown): PackCacheIndex {
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { version: 1, packs: [] };
    }
  }
  if (!isObj(raw) || !Array.isArray(raw.packs)) return { version: 1, packs: [] };
  let index: PackCacheIndex = { version: 1, packs: [] };
  for (const p of raw.packs) {
    if (!isObj(p) || typeof p.id !== 'string' || !SLUG.test(p.id) || !isNonEmpty(p.name)) continue;
    if (typeof p.bytes !== 'number' || !Number.isFinite(p.bytes) || p.bytes < 0) continue;
    index = cacheIndexAdd(index, {
      id: p.id,
      name: p.name,
      version: typeof p.version === 'number' ? p.version : PACK_VERSION,
      ...(typeof p.packVersion === 'number' && Number.isInteger(p.packVersion) && p.packVersion > 0 ? { packVersion: p.packVersion } : {}),
      bytes: Math.round(p.bytes),
      themeIds: Array.isArray(p.themeIds) ? p.themeIds.filter((t): t is string => typeof t === 'string') : [],
      downloadedAt: typeof p.downloadedAt === 'string' ? p.downloadedAt : '',
    });
  }
  return index;
}

// ------------------------------------------------------------ sizes

const UNITS: [number, string, string][] = [
  [1e9, 'gigabyte', 'GB'],
  [1e6, 'megabyte', 'MB'],
  [1e3, 'kilobyte', 'kB'],
];

/** Human file size in decimal units (as iOS Settings shows them), localised with Intl. */
export function formatBytes(n: number, locale?: string): string {
  const bytes = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  for (const [size, unit, abbr] of UNITS) {
    if (bytes >= size) {
      const v = bytes / size;
      const digits = v < 10 ? 1 : 0;
      try {
        return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: digits }).format(v);
      } catch {
        return `${v.toFixed(digits).replace(/\.0$/, '')} ${abbr}`;
      }
    }
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'byte', unitDisplay: 'long' }).format(bytes);
  } catch {
    return `${bytes} bytes`;
  }
}

/** Bytes as UTF-8 manifest text (shared by the build script and tests). */
export function manifestBytes(m: PackManifest): Uint8Array {
  return utf8Encode(`${JSON.stringify(m)}\n`);
}

// ------------------------------------------------------------ building (ops/build-pack.ts, tests)

export type BuiltPack = { manifest: PackManifest; files: { path: string; bytes: Uint8Array }[] };

/**
 * Build a pack from themes. `gzip` is injected (node:zlib at build time) so this stays pure.
 * The gzip OS header byte is normalised to 255 ("unknown") so builds match across platforms.
 */
export function buildPack(
  opts: {
    id: string;
    name: string;
    minAppVersion: string;
    themes: readonly Theme[];
    /** Optional PNG preview per theme (stored as thumbs/<id>.png). */
    thumbnail?: (t: Theme) => Uint8Array;
  },
  gzip: (b: Uint8Array) => Uint8Array,
): BuiltPack {
  const files: { path: string; bytes: Uint8Array }[] = [];
  const themes: ThemeData[] = [];
  for (const t of opts.themes) {
    if (!t.plus || t.packId !== opts.id) throw new Error(`${t.id}: not a Plus theme of ${opts.id}`);
    const path = `art/${t.id}.json.gz`;
    const z = new Uint8Array(gzip(utf8Encode(artAssetJson(t))));
    if (z.length > 9) z[9] = 255;
    files.push({ path, bytes: z });
    const data = themeToData(t, path);
    if (opts.thumbnail) {
      const thumbAsset = `thumbs/${t.id}.png`;
      files.push({ path: thumbAsset, bytes: opts.thumbnail(t) });
      data.thumbAsset = thumbAsset;
    }
    themes.push(data);
  }
  const assets = files.map((f) => ({ path: f.path, bytes: f.bytes.length, sha256: sha256Hex(f.bytes) }));
  const manifest: PackManifest = {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    id: opts.id,
    name: opts.name,
    plus: true,
    minAppVersion: opts.minAppVersion,
    themes,
    assets,
    totalBytes: assets.reduce((n, a) => n + a.bytes, 0),
  };
  const check = parsePackManifest(JSON.parse(JSON.stringify(manifest)));
  if (!check.ok) throw new Error(`built manifest is invalid: ${check.errors.join('; ')}`);
  return { manifest, files };
}
