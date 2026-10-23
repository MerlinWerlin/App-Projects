// Photo packs (T103, owner feedback 22 Oct 2026, G5a): free themes whose wallpaper is a real,
// credited photograph (the Space collection uses official James Webb Space Telescope releases).
// A sibling of src/core/themePack.ts: the v1 art-pack format and its parser are unchanged;
// `parseAnyPackManifest` tells the two kinds apart by `format`.
//
// What is different from an art pack:
//   - free: `plus: false` (art packs must be Plus), and only ids in FREE_PHOTO_PACK_IDS may download.
//   - the manifest ships inside the app (src/core/spacePack.ts); only each theme's photo is fetched,
//     and only when the person taps Download, straight from the official image host in the manifest.
//   - every theme carries `photo` (PhotoSource): release page, image file, the exact published credit
//     line and the licence. Strict validation: https only, hosts on an allowlist, credit present,
//     licence known.
//   - the downloaded file is checked for size (cap), image content type and JPEG/PNG magic bytes,
//     and can be removed at any time. T108: it is written to a temp name, verified on disk and only
//     then moved into place; any failure deletes every file of that theme (no half-written photo).
// Network and files go through the same Transport as art packs (src/core/packDownloader.ts).
// Pure TS (no React Native / Expo), Node-testable. See docs/THEME_PACKS.md "Space (Webb) photo pack".

import {
  COMPOSITION_KINDS,
  DISPLAY_FONTS,
  iconArtOf,
  sanitizeIconArt,
  sanitizeWallpaperArt,
  wallpaperArtOf,
  type CompositionKind,
  type DisplayFont,
  type ThemeArt,
} from './artwork.ts';
import { isSha256Hex, sha256Hex, utf8Decode, utf8Encode } from './bytes.ts';
import { isHex } from './colour.ts';
import type { IconStyle } from './iconspec.ts';
import { PackError, localPath, type PackErrorCode, type RangeResponse, type Transport } from './packDownloader.ts';
import { SHAPES } from './shapes.ts';
import { PACK_FORMAT, THEME_CATEGORY_IDS, isAppVersion, parsePackManifest, type PackManifest, type ParseResult } from './themePack.ts';
import type { Theme } from './themes.ts';
import { WALLPAPER_KINDS, type WallpaperParams } from './wallpaper.ts';

export const PHOTO_PACK_FORMAT = 'glaze-photo-pack';
export const PHOTO_PACK_VERSION = 1;
/** Hard cap for one downloaded photo (the Webb files we use are 0.6–4.2 MB). */
export const MAX_PHOTO_BYTES = 8 * 1000 * 1000;
export const MAX_PHOTO_THEMES = 32;

/**
 * Photo packs that may make a network request. A deliberate, user-initiated exception to the
 * app's no-network rule, for these free packs only (docs/THEME_PACKS.md).
 */
export const FREE_PHOTO_PACK_IDS: readonly string[] = Object.freeze(['space-webb']);

/**
 * Hosts verified on 2026-10-22 (docs/THEME_PACKS.md). Release pages live on esawebb.org; the image
 * files on its CDN. Add NASA / STScI hosts here only after checking their release pages the same way.
 */
export const PHOTO_PAGE_HOSTS: readonly string[] = Object.freeze(['esawebb.org']);
export const PHOTO_IMAGE_HOSTS: readonly string[] = Object.freeze(['cdn.esawebb.org']);

export type PhotoLicenceId = 'CC-BY-4.0';
/** Licences that allow commercial use with credit, with the canonical licence link. */
export const PHOTO_LICENCES: Readonly<Record<PhotoLicenceId, { name: string; url: string }>> = Object.freeze({
  'CC-BY-4.0': { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
});

export function isPhotoLicence(v: unknown): v is PhotoLicenceId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PHOTO_LICENCES, v);
}

/** Where a photo comes from and how it must be credited. The credit is data: shown exactly as published. */
export type PhotoSource = {
  /** Title as on the release page. */
  title: string;
  /** Release / image id, e.g. weic2216b. */
  releaseId: string;
  /** The official release page (shown as the tappable source link). */
  pageUrl: string;
  /** Direct image file on the official host (a JPEG sized for phones, not the TIFF). */
  imageUrl: string;
  /** Exact credit line as the release page states it. */
  credit: string;
  licence: PhotoLicenceId;
  licenceUrl: string;
  /** ISO date the page, credit and licence were last checked. */
  checkedAt: string;
  /** File size as published on the release page (for "Download 2.3 MB"); the real cap is MAX_PHOTO_BYTES. */
  approxBytes: number;
  /** Optional SHA-256 of the file, pinned once a release copy has been checked. */
  sha256?: string;
};

/** A theme whose wallpaper is a downloadable photo. Its generated wallpaper is the fallback until then. */
export type PhotoTheme = Theme & { packId: string; plus: false; photo: PhotoSource };

/** A photo theme as stored in a manifest (art inline; iconStyle / wallpaper without their art halves). */
export type PhotoThemeData = Omit<Theme, 'art' | 'iconStyle' | 'wallpaper' | 'plus' | 'packId'> & {
  plus: false;
  packId: string;
  iconStyle: Omit<IconStyle, 'art'>;
  wallpaper: Omit<WallpaperParams, 'art'>;
  art: ThemeArt;
  photo: PhotoSource;
};

export type PhotoPackManifest = {
  format: typeof PHOTO_PACK_FORMAT;
  version: typeof PHOTO_PACK_VERSION;
  kind: 'photo';
  id: string;
  name: string;
  plus: false;
  minAppVersion: string;
  themes: PhotoThemeData[];
};

// ------------------------------------------------------------ URLs

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
// No `URL` here: React Native's URL polyfill doesn't implement `hostname`. Strict shape instead:
// https, a bare host (no user info, no port), a plain path, no query or fragment.
const HTTPS_URL = /^https:\/\/([a-z0-9.-]+)(\/[A-Za-z0-9._~%/-]*)?$/;

/** Lower-case host of a strict https URL, or null. */
export function httpsHost(u: unknown): string | null {
  if (typeof u !== 'string' || u.length > 300) return null;
  const m = HTTPS_URL.exec(u);
  return m ? m[1] : null;
}

export function isAllowedPageUrl(u: unknown): u is string {
  const h = httpsHost(u);
  return h !== null && PHOTO_PAGE_HOSTS.includes(h);
}

export function isAllowedImageUrl(u: unknown): u is string {
  const h = httpsHost(u);
  return h !== null && PHOTO_IMAGE_HOSTS.includes(h) && /\.(jpe?g|png)$/i.test(u as string);
}

// ------------------------------------------------------------ validation

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const isText = (v: unknown, max = 200): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Problems with a PhotoSource (empty when valid). */
export function photoSourceErrors(raw: unknown, where = 'photo'): string[] {
  if (!isObj(raw)) return [`${where}: missing`];
  const e: string[] = [];
  if (!isText(raw.title)) e.push(`${where}: missing title`);
  if (typeof raw.releaseId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(raw.releaseId)) e.push(`${where}: bad releaseId`);
  if (typeof raw.pageUrl !== 'string' || !raw.pageUrl.startsWith('https://')) e.push(`${where}: pageUrl must be https`);
  else if (!isAllowedPageUrl(raw.pageUrl)) e.push(`${where}: pageUrl host not allowed`);
  if (typeof raw.imageUrl !== 'string' || !raw.imageUrl.startsWith('https://')) e.push(`${where}: imageUrl must be https`);
  else if (!isAllowedImageUrl(raw.imageUrl)) e.push(`${where}: imageUrl host not allowed or not a JPEG/PNG`);
  if (!isText(raw.credit, 400)) e.push(`${where}: missing credit`);
  if (!isPhotoLicence(raw.licence)) e.push(`${where}: unknown licence ${JSON.stringify(raw.licence)}`);
  else if (raw.licenceUrl !== PHOTO_LICENCES[raw.licence].url) e.push(`${where}: licenceUrl must be ${PHOTO_LICENCES[raw.licence].url}`);
  if (!isDate(raw.checkedAt)) e.push(`${where}: bad checkedAt`);
  if (typeof raw.approxBytes !== 'number' || !Number.isInteger(raw.approxBytes) || raw.approxBytes <= 0 || raw.approxBytes > MAX_PHOTO_BYTES)
    e.push(`${where}: bad approxBytes`);
  if (raw.sha256 !== undefined && !isSha256Hex(raw.sha256)) e.push(`${where}: bad sha256`);
  return e;
}

function photoThemeErrors(raw: unknown, i: number, packId: string): string[] {
  const where = `themes[${i}]`;
  if (!isObj(raw)) return [`${where}: not an object`];
  const e: string[] = [];
  if (typeof raw.id !== 'string' || !SLUG.test(raw.id)) e.push(`${where}: bad id`);
  if (!isText(raw.name)) e.push(`${where}: missing name`);
  if (typeof raw.tagline !== 'string') e.push(`${where}: missing tagline`);
  if (raw.plus !== false) e.push(`${where}: photo themes are free (plus: false)`);
  if (raw.packId !== packId) e.push(`${where}: packId must be ${packId}`);
  const pal = raw.palette;
  if (!isObj(pal) || !['bg', 'surface', 'accent', 'ink', 'glyph'].every((k) => typeof pal[k] === 'string' && isHex(pal[k] as string))) e.push(`${where}: bad palette`);
  const is = raw.iconStyle;
  if (!isObj(is) || typeof is.shape !== 'string' || !(SHAPES as readonly string[]).includes(is.shape) || !isObj(is.background) || typeof is.glyphColour !== 'string' || !isHex(is.glyphColour))
    e.push(`${where}: bad iconStyle`);
  const wp = raw.wallpaper;
  if (!isObj(wp) || typeof wp.kind !== 'string' || !(WALLPAPER_KINDS as readonly string[]).includes(wp.kind) || !Array.isArray(wp.colours) || !wp.colours.every((c) => typeof c === 'string' && isHex(c)) || typeof wp.seed !== 'number')
    e.push(`${where}: bad wallpaper`);
  const w = raw.widget;
  if (!isObj(w) || !['glass', 'solid', 'outline'].includes(w.style as string) || !['display', 'body'].includes(w.font as string) || typeof w.accent !== 'string' || !isHex(w.accent))
    e.push(`${where}: bad widget`);
  if (!sanitizeIconArt(raw.art) || !sanitizeWallpaperArt(raw.art)) e.push(`${where}: bad art`);
  if (raw.categories !== undefined && (!Array.isArray(raw.categories) || !raw.categories.every((c) => (THEME_CATEGORY_IDS as readonly unknown[]).includes(c))))
    e.push(`${where}: unknown category`);
  if (raw.tags !== undefined && (!Array.isArray(raw.tags) || !raw.tags.every((t) => typeof t === 'string'))) e.push(`${where}: bad tags`);
  if (raw.addedAt !== undefined && !isDate(raw.addedAt)) e.push(`${where}: bad addedAt`);
  e.push(...photoSourceErrors(raw.photo, `${where}.photo`));
  return e;
}

/** Validate an untrusted photo-pack manifest (object or JSON text). Never throws. */
export function parsePhotoPackManifest(input: unknown): ParseResult<PhotoPackManifest> {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, errors: ['manifest is not JSON'] };
    }
  }
  if (!isObj(raw)) return { ok: false, errors: ['manifest is not an object'] };
  if (raw.format !== PHOTO_PACK_FORMAT) return { ok: false, errors: [`unknown format ${JSON.stringify(raw.format)}`] };
  if (raw.version !== PHOTO_PACK_VERSION) return { ok: false, errors: [`unsupported version ${JSON.stringify(raw.version)}`] };
  const e: string[] = [];
  if (raw.kind !== 'photo') e.push('kind must be photo');
  const id = typeof raw.id === 'string' && SLUG.test(raw.id) ? raw.id : null;
  if (!id) e.push('bad pack id');
  if (!isText(raw.name)) e.push('missing pack name');
  if (raw.plus !== false) e.push('photo packs are free (plus: false)');
  if (!isAppVersion(raw.minAppVersion)) e.push('bad minAppVersion');
  if (!Array.isArray(raw.themes) || raw.themes.length === 0) e.push('no themes');
  else if (raw.themes.length > MAX_PHOTO_THEMES) e.push('too many themes');
  else {
    const ids = new Set<string>();
    raw.themes.forEach((t: unknown, i: number) => {
      e.push(...photoThemeErrors(t, i, id ?? ''));
      const tid = isObj(t) ? t.id : undefined;
      if (typeof tid === 'string') {
        if (ids.has(tid)) e.push(`themes[${i}]: duplicate id ${tid}`);
        ids.add(tid);
      }
    });
  }
  return e.length ? { ok: false, errors: e } : { ok: true, value: raw as unknown as PhotoPackManifest };
}

export type AnyPackManifest = { kind: 'art'; manifest: PackManifest } | { kind: 'photo'; manifest: PhotoPackManifest };

/** Either pack kind, chosen by `format`. Art packs go through the unchanged v1 parser. */
export function parseAnyPackManifest(input: unknown): ParseResult<AnyPackManifest> {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, errors: ['manifest is not JSON'] };
    }
  }
  if (isObj(raw) && raw.format === PHOTO_PACK_FORMAT) {
    const r = parsePhotoPackManifest(raw);
    return r.ok ? { ok: true, value: { kind: 'photo', manifest: r.value } } : r;
  }
  if (isObj(raw) && raw.format === PACK_FORMAT) {
    const r = parsePackManifest(raw);
    return r.ok ? { ok: true, value: { kind: 'art', manifest: r.value } } : r;
  }
  return { ok: false, errors: [`unknown format ${JSON.stringify(isObj(raw) ? raw.format : undefined)}`] };
}

// ------------------------------------------------------------ themes <-> data

/** Full theme from its manifest entry (icon and wallpaper art halves derived from `art`). */
export function photoThemeFromData(d: PhotoThemeData): PhotoTheme {
  const displayFont: DisplayFont = (DISPLAY_FONTS as readonly string[]).includes(d.art.displayFont) ? d.art.displayFont : 'display';
  const composition: CompositionKind = (COMPOSITION_KINDS as readonly string[]).includes(d.art.composition) ? d.art.composition : 'none';
  const art: ThemeArt = { ...d.art, displayFont, composition };
  return {
    ...d,
    iconStyle: { ...d.iconStyle, art: iconArtOf(art) },
    wallpaper: { ...d.wallpaper, art: wallpaperArtOf(art) },
    art,
    photo: { ...d.photo },
  };
}

/** Manifest entry for a photo theme (art halves stripped from iconStyle / wallpaper). */
export function photoThemeToData(t: PhotoTheme): PhotoThemeData {
  const { iconStyle, wallpaper, ...rest } = t;
  const { art: _ia, ...icon } = iconStyle;
  const { art: _wa, ...wall } = wallpaper;
  return { ...rest, iconStyle: icon, wallpaper: wall };
}

export function isPhotoTheme(t: unknown): t is PhotoTheme {
  return isObj(t) && isObj(t.photo) && typeof t.packId === 'string' && photoSourceErrors(t.photo).length === 0;
}

// ------------------------------------------------------------ image checks

export type PhotoKind = 'jpeg' | 'png';

/** JPEG (FF D8 FF) or PNG (89 50 4E 47 0D 0A 1A 0A) by magic bytes, else null. */
export function sniffImage(b: Uint8Array): PhotoKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return 'png';
  return null;
}

/** True for image/jpeg, image/jpg, image/pjpeg or image/png (parameters ignored). Undefined = unknown, allowed (magic bytes decide). */
export function isImageContentType(ct: string | null | undefined): boolean {
  if (ct === undefined || ct === null || ct === '') return true;
  const base = ct.split(';')[0].trim().toLowerCase();
  return base === 'image/jpeg' || base === 'image/jpg' || base === 'image/pjpeg' || base === 'image/png';
}

// ------------------------------------------------------------ download on demand

/** A Transport response may also say the Content-Type it received (the phone transport does). */
export type PhotoRangeResponse = RangeResponse & { contentType?: string | null };

/**
 * The pack Transport plus a rename (T108). A photo is streamed into a temp file, checked on disk,
 * and only then moved to its real name, so a half-written file never sits where the app looks.
 */
export interface PhotoTransport extends Transport {
  /** Move / rename a local file (replacing `to` if present). Paths relative to the pack store root. */
  move(from: string, to: string): Promise<void>;
}

/**
 * What a transport throws for a non-2xx answer (server error, proxy refusal, 404). Lets the UI tell
 * "you're offline" from "the site didn't send it". A plain Error whose message starts with
 * `HTTP <status>` is treated the same way.
 */
export class HttpStatusError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

/** Why a photo download failed, in the person's terms (drives the friendly error state + Retry). */
export type PhotoFailure = 'offline' | 'blocked' | 'bad-file' | 'storage' | 'cancelled' | 'other';
export const PHOTO_FAILURES: readonly PhotoFailure[] = Object.freeze(['offline', 'blocked', 'bad-file', 'storage', 'cancelled', 'other'] as PhotoFailure[]);

/** A PackError (same codes as before) that also says which friendly failure it is. */
export class PhotoError extends PackError {
  failure: PhotoFailure;
  constructor(code: PackErrorCode, failure: PhotoFailure, message: string) {
    super(code, message);
    this.name = 'PhotoError';
    this.failure = failure;
  }
}

/** Status code of an HTTP failure thrown by a transport, or null when it was not an HTTP answer. */
export function httpStatusOf(e: unknown): number | null {
  if (e instanceof HttpStatusError) return e.status;
  const m = e instanceof Error ? /^HTTP (\d{3})\b/.exec(e.message) : null;
  return m ? Number(m[1]) : null;
}

/** The friendly failure for anything downloadPhoto (or a transport) threw. Never throws. */
export function photoFailureOf(e: unknown): PhotoFailure {
  if (e instanceof PhotoError) return e.failure;
  if (e instanceof PackError) {
    if (e.code === 'cancelled') return 'cancelled';
    if (e.code === 'integrity') return 'bad-file';
    if (e.code === 'network') return httpStatusOf(e) !== null ? 'blocked' : 'offline';
    return 'other';
  }
  if (httpStatusOf(e) !== null) return 'blocked';
  // fetch rejects with a TypeError ("Network request failed") when there is no connection.
  if (e instanceof Error) return 'offline';
  return 'other';
}

/** Stored next to the photo once it is complete and verified; its presence means "downloaded". */
export type PhotoMeta = {
  themeId: string;
  /** Path relative to the pack store root, e.g. space-webb/photos/space-pillars.jpg */
  path: string;
  kind: PhotoKind;
  bytes: number;
  sha256: string;
  imageUrl: string;
  credit: string;
  downloadedAt: string;
};

export const photoFile = (packId: string, themeId: string, kind: PhotoKind) => localPath(packId, `photos/${themeId}.${kind === 'png' ? 'png' : 'jpg'}`);
export const photoMetaFile = (packId: string, themeId: string) => localPath(packId, `photos/${themeId}.json`);
/** Temp names used while downloading (T108); never read as a photo. */
export const photoTempFile = (packId: string, themeId: string) => localPath(packId, `photos/${themeId}.part`);
export const photoMetaTempFile = (packId: string, themeId: string) => localPath(packId, `photos/${themeId}.json.part`);

/** Every file a photo theme may have on disk (meta, temps, final), for clean-up. */
export function photoPaths(packId: string, themeId: string): string[] {
  return [
    photoMetaFile(packId, themeId),
    photoMetaTempFile(packId, themeId),
    photoTempFile(packId, themeId),
    photoFile(packId, themeId, 'jpeg'),
    photoFile(packId, themeId, 'png'),
  ];
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export type PhotoDownloadOptions = {
  /**
   * Must be true, and is passed only from a person's tap on Download. False rejects with
   * 'disabled' before any request.
   */
  allowNetwork: boolean;
  theme: Pick<PhotoTheme, 'id' | 'packId' | 'photo'>;
  transport: PhotoTransport;
  maxBytes?: number;
  onProgress?: (p: { doneBytes: number; totalBytes: number }) => void;
  isCancelled?: () => boolean;
  now?: () => Date;
};

/**
 * Fetch one photo theme's image from the official host in its manifest, verify it and store it with
 * its meta file. Exactly one GET, to `theme.photo.imageUrl`.
 *
 * T108: the body is streamed into a temp file (`<id>.part`), read back and verified on disk (size
 * cap, image Content-Type, JPEG/PNG magic bytes, SHA-256 when pinned), then moved to its real name;
 * the meta file goes through a temp name too and is written last. On ANY failure (offline, HTTP
 * error, proxy refusal, wrong type, size or hash, cancel, a failed write or move) every temp and
 * final file of that theme is deleted, so nothing half-written remains and the photo does not count
 * as downloaded. Failures reject with a PhotoError (a PackError, same codes as before, + `failure`).
 */
export async function downloadPhoto(opts: PhotoDownloadOptions): Promise<PhotoMeta> {
  const { theme, transport: t } = opts;
  if (!opts.allowNetwork) throw new PhotoError('disabled', 'other', 'photo downloads need a tap on Download');
  if (!FREE_PHOTO_PACK_IDS.includes(theme.packId)) throw new PhotoError('disabled', 'other', `${theme.packId} is not a free photo pack`);
  if (!SLUG.test(theme.id)) throw new PhotoError('manifest', 'other', 'bad theme id');
  const errs = photoSourceErrors(theme.photo);
  if (errs.length) throw new PhotoError('bad-url', 'other', errs.join('; '));
  const cap = Math.min(opts.maxBytes ?? MAX_PHOTO_BYTES, MAX_PHOTO_BYTES);
  const total = theme.photo.approxBytes;
  const temp = photoTempFile(theme.packId, theme.id);
  const metaTemp = photoMetaTempFile(theme.packId, theme.id);
  const cancelled = (): void => {
    if (opts.isCancelled?.()) throw new PhotoError('cancelled', 'cancelled', 'download cancelled');
  };
  const clear = async (): Promise<void> => {
    for (const p of photoPaths(theme.packId, theme.id)) await t.remove(p);
  };
  /** Run a file step: a failure there is a storage problem, not a network one. */
  const disk = async <T>(step: () => Promise<T>): Promise<T> => {
    try {
      return await step();
    } catch (e) {
      throw e instanceof PackError ? e : new PhotoError('network', 'storage', `could not save the photo: ${errText(e)}`);
    }
  };

  try {
    await disk(clear);
    cancelled();
    let res: PhotoRangeResponse;
    try {
      res = await t.fetchRange(theme.photo.imageUrl, 0);
    } catch (e) {
      if (e instanceof PackError) throw e;
      throw new PhotoError('network', httpStatusOf(e) !== null ? 'blocked' : 'offline', errText(e));
    }
    if (res.offset !== 0) throw new PhotoError('network', 'blocked', 'unexpected range offset');
    if (!isImageContentType(res.contentType)) throw new PhotoError('integrity', 'bad-file', `not an image (${String(res.contentType)})`);

    let n = 0;
    const it = res.chunks[Symbol.asyncIterator]();
    for (;;) {
      let step: IteratorResult<Uint8Array>;
      try {
        step = await it.next();
      } catch (e) {
        throw e instanceof PackError ? e : new PhotoError('network', 'offline', errText(e));
      }
      if (step.done) break;
      cancelled();
      const c = step.value;
      n += c.length;
      if (n > cap) throw new PhotoError('integrity', 'bad-file', `photo larger than ${cap} bytes`);
      await disk(() => t.writeAppend(temp, c));
      opts.onProgress?.({ doneBytes: n, totalBytes: Math.max(total, n) });
    }

    // Verify what is actually on disk, not what we meant to write.
    const bytes = await disk(() => t.readFile(temp));
    if (n === 0) throw new PhotoError('integrity', 'bad-file', 'empty file');
    if (!bytes || bytes.length !== n) throw new PhotoError('network', 'storage', 'the saved photo is incomplete');
    const kind = sniffImage(bytes);
    if (!kind) throw new PhotoError('integrity', 'bad-file', 'not a JPEG or PNG file');
    const sha256 = sha256Hex(bytes);
    if (theme.photo.sha256 && theme.photo.sha256 !== sha256) throw new PhotoError('integrity', 'bad-file', 'photo hash does not match the manifest');
    cancelled();

    const path = photoFile(theme.packId, theme.id, kind);
    await disk(() => t.move(temp, path));
    const meta: PhotoMeta = {
      themeId: theme.id,
      path,
      kind,
      bytes: n,
      sha256,
      imageUrl: theme.photo.imageUrl,
      credit: theme.photo.credit,
      downloadedAt: (opts.now?.() ?? new Date()).toISOString(),
    };
    // Meta last, through its own temp name: a photo counts as downloaded only once it is complete.
    await disk(() => t.writeAppend(metaTemp, utf8Encode(JSON.stringify(meta))));
    await disk(() => t.move(metaTemp, photoMetaFile(theme.packId, theme.id)));
    return meta;
  } catch (e) {
    await clear().catch(() => undefined);
    if (e instanceof PhotoError) throw e;
    if (e instanceof PackError) throw new PhotoError(e.code, photoFailureOf(e), e.message);
    throw new PhotoError('network', photoFailureOf(e), errText(e));
  }
}

/** Sanitised meta of a downloaded photo, or null. Pass `verify` to re-check the file's size, type and hash. */
export async function readPhotoMeta(transport: Transport, theme: Pick<PhotoTheme, 'id' | 'packId'>, verify = false): Promise<PhotoMeta | null> {
  const b = await transport.readFile(photoMetaFile(theme.packId, theme.id));
  if (!b) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(utf8Decode(b));
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.themeId !== theme.id || (raw.kind !== 'jpeg' && raw.kind !== 'png')) return null;
  const kind = raw.kind;
  const path = photoFile(theme.packId, theme.id, kind);
  if (raw.path !== path || typeof raw.bytes !== 'number' || !isSha256Hex(raw.sha256)) return null;
  const meta: PhotoMeta = {
    themeId: theme.id,
    path,
    kind,
    bytes: raw.bytes,
    sha256: raw.sha256,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
    credit: typeof raw.credit === 'string' ? raw.credit : '',
    downloadedAt: typeof raw.downloadedAt === 'string' ? raw.downloadedAt : '',
  };
  if (verify) {
    const file = await transport.readFile(path);
    if (!file || file.length !== meta.bytes || sniffImage(file) !== kind || sha256Hex(file) !== meta.sha256) return null;
  }
  return meta;
}

/** Delete one theme's photo and meta. Always allowed; makes no request. */
export async function removePhoto(transport: Transport, theme: Pick<PhotoTheme, 'id' | 'packId'>): Promise<void> {
  for (const p of photoPaths(theme.packId, theme.id)) await transport.remove(p);
}

/** Delete every downloaded photo of a pack. */
export async function removePhotoPack(transport: Transport, packId: string): Promise<void> {
  await transport.remove(localPath(packId, 'photos'));
}

// ------------------------------------------------------------ presentation helpers (UI calls these)

/** "CC BY 4.0" for a licence id. */
export function licenceName(id: PhotoLicenceId): string {
  return PHOTO_LICENCES[id].name;
}

/** Download state of one photo theme as the phone store keeps it (src/native/photoPacks.ts). */
export type PhotoDownloadStatus = 'not-downloaded' | 'downloading' | 'ready' | 'error';

/** i18n keys (ui.photoCredit.*) for each friendly failure: a title and a one-line body. */
export const PHOTO_FAILURE_KEYS = Object.freeze({
  offline: { title: 'ui.photoCredit.offlineTitle', body: 'ui.photoCredit.offlineBody' },
  blocked: { title: 'ui.photoCredit.errorTitle', body: 'ui.photoCredit.blockedBody' },
  'bad-file': { title: 'ui.photoCredit.errorTitle', body: 'ui.photoCredit.badFileBody' },
  storage: { title: 'ui.photoCredit.errorTitle', body: 'ui.photoCredit.storageBody' },
  cancelled: { title: 'ui.photoCredit.errorTitle', body: 'ui.photoCredit.cancelledBody' },
  other: { title: 'ui.photoCredit.errorTitle', body: 'ui.photoCredit.otherBody' },
} as const) satisfies Readonly<Record<PhotoFailure, { title: string; body: string }>>;

/** One of the i18n keys above (literal types, so the typed `t()` accepts them). */
export type PhotoFailureTitleKey = (typeof PHOTO_FAILURE_KEYS)[PhotoFailure]['title'];
export type PhotoFailureBodyKey = (typeof PHOTO_FAILURE_KEYS)[PhotoFailure]['body'];

/** What the Download control shows (theme detail credit card and the Apply › Wallpaper step). */
export type PhotoDownloadView =
  | { kind: 'download' }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready' }
  | { kind: 'failed'; failure: PhotoFailure; titleKey: PhotoFailureTitleKey; bodyKey: PhotoFailureBodyKey; retry: true };

/**
 * T108: the one place that decides the Download control's state. A failed download always shows the
 * friendly offline / error state with Retry (never a raw error, never "ready").
 */
export function photoDownloadView(s: { status: PhotoDownloadStatus; progress: number; failure: PhotoFailure | null }): PhotoDownloadView {
  if (s.status === 'ready') return { kind: 'ready' };
  if (s.status === 'downloading') {
    const p = Number.isFinite(s.progress) ? Math.min(1, Math.max(0, s.progress)) : 0;
    return { kind: 'downloading', percent: Math.round(p * 100) };
  }
  if (s.status === 'error') {
    const failure: PhotoFailure = s.failure && (PHOTO_FAILURES as readonly string[]).includes(s.failure) ? s.failure : 'other';
    const k = PHOTO_FAILURE_KEYS[failure];
    return { kind: 'failed', failure, titleKey: k.title, bodyKey: k.body, retry: true };
  }
  return { kind: 'download' };
}

/** Params for ui.photoCredit.* strings that carry the credit: the credit line exactly as published. */
export function photoCreditParams(photo: Pick<PhotoSource, 'credit' | 'licence'>): { credit: string; licence: string } {
  return { credit: photo.credit, licence: licenceName(photo.licence) };
}

/**
 * T105: what Apply's Wallpaper step (Save to Photos) saves. A person's own photo always wins; a
 * Space theme saves its downloaded Webb photo, and offers the download first while the photo is not
 * on the phone (the drawn space wallpaper stays available as the fallback).
 */
export type WallpaperSource = 'own-photo' | 'space-photo' | 'space-offer-download' | 'generated';

export function wallpaperSourceFor(s: { ownPhoto: boolean; isSpace: boolean; spaceReady: boolean }): WallpaperSource {
  if (s.ownPhoto) return 'own-photo';
  if (!s.isSpace) return 'generated';
  return s.spaceReady ? 'space-photo' : 'space-offer-download';
}

/** One downloaded photo for Settings › Storage. */
export type DownloadedPhotoRow = { themeId: string; name: string; bytes: number; credit: string };

/**
 * T105: the downloaded photos to list in Settings › Storage (manifest order) with their size, and the
 * total. `entries` is the phone store's state by theme id; only 'ready' photos are listed.
 */
export function downloadedPhotoRows(
  themes: readonly Pick<PhotoTheme, 'id' | 'name' | 'photo'>[],
  entries: Readonly<Record<string, { status: PhotoDownloadStatus; bytes: number } | undefined>>,
): { rows: DownloadedPhotoRow[]; totalBytes: number } {
  const rows: DownloadedPhotoRow[] = [];
  for (const t of themes) {
    const e = entries[t.id];
    if (!e || e.status !== 'ready') continue;
    const bytes = Number.isFinite(e.bytes) && e.bytes > 0 ? Math.round(e.bytes) : 0;
    rows.push({ themeId: t.id, name: t.name, bytes, credit: t.photo.credit });
  }
  return { rows, totalBytes: rows.reduce((a, r) => a + r.bytes, 0) };
}
