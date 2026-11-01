// owner-1030 A (T160): the app side of the remote catalogue (catalog.json on the pack host, format in
// src/core/packCatalog.ts). Fetch-free logic only, so Node tests cover it and src/native/packs.ts
// just does the I/O:
//  - what to show, given the cached copy and a fresh fetch: offline-safe, keeps the last good
//    catalogue, ignores a bad new one, never throws;
//  - when to fetch again (at most every CATALOG_REFRESH_MS, or when the person pulls to refresh);
//  - catalogue packs as gallery themes (an art-pack theme plus a `remoteArt` ref with the remote
//    thumbnail, thumbhash, size and Plus flag), merged after the bundled themes (bundled ids win);
//  - the theme detail's pack card for a remote art pack (free packs download without Plus).
// Entitlement is never read here (src/plus decides). Pure TS, no React Native / Expo imports.

import { ART_PACK_DEFAULT_ADDED_AT, ART_WALLPAPER_SIZE, HERO_SIZES, artPackTheme, isArtPackTheme, type ArtPackData, type ArtPackTheme, type HeroSize, type PixelSize } from './artPack.ts';
import { parseCatalog, type Catalog, type CatalogPack, type RemoteArtManifest, type RemoteArtRole } from './packCatalog.ts';
import { packObjectUrl } from './packHost.ts';
import type { PackAccessInput, PackDetailView } from './packDetail.ts';

/** Re-fetch catalog.json at most this often (unless the person pulls to refresh). */
export const CATALOG_REFRESH_MS = 6 * 60 * 60 * 1000;
/**
 * T178: after a failed attempt (offline, a 404 from before the release existed, a bad file) or when
 * the cached catalogue lists no packs, try again on the next launch / focus once this much time
 * has passed, never waiting the full 6 h. Short enough to recover quickly, long enough not to hammer.
 */
export const CATALOG_RETRY_MS = 2 * 60 * 1000;
/** The cached copy on the phone, under the pack store root (documentDirectory/packs/). */
export const CATALOG_CACHE_FILE = 'catalog.json';
/**
 * T178: part of the cache stamp. Bump it whenever the app's catalogue handling changes, so the
 * first launch of that code fetches a fresh catalogue instead of trusting a copy older code saved.
 */
export const CATALOG_CLIENT_REV = 't178';

/**
 * The cached catalogue: when it was fetched (ms since epoch), its text exactly as served and
 * (T178) the stamp of the app build + pack host it was saved under (absent on copies older code saved).
 */
export type CatalogCache = { savedAt: number; text: string; stamp?: string; etag?: string };

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** A catalogue from served text, or null when it isn't valid JSON or not a catalogue. Never throws. */
export function parseCatalogText(text: unknown): Catalog | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const r = parseCatalog(raw);
  return r.ok ? r.value : null;
}

function oneLine(x: unknown): string {
  return typeof x === 'string' || typeof x === 'number' ? String(x).replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

/** What the cache stamp is made of; missing parts (Expo Go, web, tests) read as ''. */
export type CatalogStampInput = {
  appVersion?: string | null;
  build?: string | number | null;
  /** The running JS bundle (expo-updates updateId), so a new build or an over-the-air update counts as new. */
  updateId?: string | null;
  baseUrl?: string | null;
};

/**
 * T178: the stamp a cached catalogue is saved under. A cache saved under another stamp (new app
 * version, build, JS bundle, pack host, or catalogue code) is refetched at once.
 */
export function catalogCacheStamp(i: CatalogStampInput): string {
  const base = oneLine(i.baseUrl).replace(/\/+$/, '');
  return [CATALOG_CLIENT_REV, oneLine(i.appVersion), oneLine(i.build), oneLine(i.updateId), base].join('|');
}

export function serializeCatalogCache(c: CatalogCache): string {
  const out: CatalogCache = { savedAt: c.savedAt, text: c.text };
  if (c.stamp) out.stamp = c.stamp;
  if (c.etag) out.etag = c.etag;
  return JSON.stringify(out);
}

/** The cached copy, or null if missing / damaged / not a valid catalogue. Never throws. */
export function parseCatalogCache(raw: unknown): CatalogCache | null {
  if (typeof raw !== 'string') return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || typeof v.savedAt !== 'number' || !Number.isFinite(v.savedAt) || typeof v.text !== 'string') return null;
  if (!parseCatalogText(v.text)) return null;
  const out: CatalogCache = { savedAt: v.savedAt, text: v.text };
  if (typeof v.stamp === 'string' && v.stamp) out.stamp = v.stamp;
  // T254: the ETag the copy was served with (sent back as If-None-Match).
  if (typeof v.etag === 'string' && v.etag && v.etag.length <= 200) out.etag = v.etag;
  return out;
}

/**
 * T254: the ETag to send as If-None-Match, or null for a full fetch. Only for a cached copy saved
 * under this app's stamp (a new build / OTA / host still refetches in full, T178).
 */
export function catalogRequestEtag(cache: CatalogCache | null, stamp?: string | null): string | null {
  if (!cache || !cache.etag) return null;
  if (typeof stamp === 'string' && stamp !== '' && (cache.stamp ?? '') !== stamp) return null;
  return cache.etag;
}

/** Optional context for catalogNeedsFetch (T178). */
export type CatalogFetchContext = {
  /** catalogCacheStamp of the running app; a cache saved under another stamp is refetched. */
  stamp?: string | null;
  /** When this session last tried to fetch (ms since epoch), for the CATALOG_RETRY_MS backoff. */
  lastAttemptAt?: number | null;
};

/** How many packs a cached copy lists (null when unknown: only savedAt given, or bad text). */
function cachedPackCount(cache: Partial<CatalogCache>): number | null {
  if (typeof cache.text !== 'string') return null;
  const c = parseCatalogText(cache.text);
  return c ? c.packs.length : null;
}

/**
 * Whether to fetch catalog.json now:
 *  - always when forced (pull to refresh);
 *  - otherwise never within CATALOG_RETRY_MS of this session's last attempt (no hammering);
 *  - then yes when nothing is cached (first launch, or every earlier fetch failed / 404'd), once
 *    the copy is CATALOG_REFRESH_MS old (or dated in the future after a clock change), when the
 *    cache was saved under another stamp (T178: first launch of a new app version / build / host),
 *    or when the cached catalogue lists no packs and is older than CATALOG_RETRY_MS.
 */
export function catalogNeedsFetch(
  cache: (Pick<CatalogCache, 'savedAt'> & Partial<CatalogCache>) | null,
  now: number,
  force = false,
  ctx: CatalogFetchContext = {},
): boolean {
  if (force) return true;
  const last = ctx.lastAttemptAt;
  if (typeof last === 'number' && last > 0 && now - last >= 0 && now - last < CATALOG_RETRY_MS) return false;
  if (!cache) return true;
  const age = now - cache.savedAt;
  if (age < 0 || age >= CATALOG_REFRESH_MS) return true;
  if (typeof ctx.stamp === 'string' && ctx.stamp !== '' && (cache.stamp ?? '') !== ctx.stamp) return true;
  return cachedPackCount(cache) === 0 && age >= CATALOG_RETRY_MS;
}

/**
 * Outcome of one fetch attempt; null when no fetch was made. T254: a fetch may carry the served
 * ETag, or be `notModified` (HTTP 304 to If-None-Match: the cached copy is still current).
 */
export type CatalogFetch = { ok: true; text: string; etag?: string | null } | { ok: true; notModified: true } | { ok: false; error: string } | null;

export type CatalogDecision = {
  /** What the gallery lists (null: nothing remote to show). */
  catalog: Catalog | null;
  /** The copy to keep. */
  cache: CatalogCache | null;
  /** True when `cache` is new and should be written to disk. */
  save: boolean;
  /** Why the fetch didn't replace the cached copy (offline, bad file), or null. */
  error: string | null;
  /**
   * T254: true when the listed catalogue is the same as the cached one (a 304, or the same text
   * served again), so the screen can keep its current list instead of rebuilding it.
   */
  unchanged?: boolean;
};

/** Offline-safe choice between the cached catalogue and a fresh fetch. Never throws. */
export function decideCatalog(cached: CatalogCache | null, fetched: CatalogFetch, now: number, stamp?: string | null): CatalogDecision {
  const keep = (error: string | null): CatalogDecision => ({ catalog: cached ? parseCatalogText(cached.text) : null, cache: cached, save: false, error });
  if (!fetched) return keep(null);
  if (!fetched.ok) return keep(fetched.error || 'fetch failed');
  if ('notModified' in fetched) {
    // T254: 304 Not Modified. Only meaningful with a cached copy; it restarts the TTL.
    if (!cached) return keep('not modified without a cached copy');
    const cache: CatalogCache = { ...cached, savedAt: now };
    if (stamp) cache.stamp = stamp;
    return { catalog: parseCatalogText(cached.text), cache, save: true, error: null, unchanged: true };
  }
  const fresh = parseCatalogText(fetched.text);
  if (!fresh) return keep('bad catalogue ignored');
  const cache: CatalogCache = stamp ? { savedAt: now, text: fetched.text, stamp } : { savedAt: now, text: fetched.text };
  const etag = typeof fetched.etag === 'string' && fetched.etag ? fetched.etag : '';
  if (etag) cache.etag = etag;
  const unchanged = !!cached && cached.text === fetched.text;
  return unchanged ? { catalog: fresh, cache, save: true, error: null, unchanged } : { catalog: fresh, cache, save: true, error: null };
}

/**
 * T178: what the Themes tab should draw for the remote collection.
 *  - 'disabled': packs are off in this build (no request is ever made);
 *  - 'loading': nothing to list yet and the first attempt is still running (show skeletons);
 *  - 'ready': a catalogue with at least one pack is listed (a background refresh may be running);
 *  - 'empty': the catalogue lists no packs;
 *  - 'unavailable': no catalogue and the attempt failed (offline, 404). Never an error for the
 *    person: show the bundled themes, at most a quiet "pull to refresh" hint.
 */
export type CatalogStatus = 'disabled' | 'loading' | 'ready' | 'empty' | 'unavailable';

export function catalogStatus(i: { enabled: boolean; catalog: Pick<Catalog, 'packs'> | null; refreshing: boolean; attempted: boolean }): CatalogStatus {
  if (!i.enabled) return 'disabled';
  const pending = i.refreshing || !i.attempted;
  if (i.catalog) return i.catalog.packs.length > 0 ? 'ready' : pending ? 'loading' : 'empty';
  return pending ? 'loading' : 'unavailable';
}

// ------------------------------------------------------------------ catalogue packs as themes

/** What makes a gallery theme a remote art pack (not bundled in the app). */
export type RemoteArtRef = {
  packId: string;
  packVersion: number;
  /** Plus flag from the catalogue; src/plus gates the download on it. */
  plus: boolean;
  /** Full download size of the pack (the phone fetches a bit less: one wallpaper size). */
  bytes: number;
  /** Absolute URL of the small thumbnail, or null when packs are disabled. */
  thumbUrl: string | null;
  /** ThumbHash (base64) for an instant blurred placeholder. */
  thumbhash: string;
};

export type RemoteArtTheme = Omit<ArtPackTheme, 'plus'> & { plus: boolean; remoteArt: RemoteArtRef };

export function isRemoteArtTheme(t: unknown): t is RemoteArtTheme {
  return isArtPackTheme(t) && isObj((t as { remoteArt?: unknown }).remoteArt) && typeof (t as RemoteArtTheme).remoteArt.packId === 'string';
}

const NO_HEROES = {} as Record<HeroSize, PixelSize>;

/** The gallery theme for a catalogue pack (palette → icon style, wallpaper fallback, categories). */
export function remoteArtTheme(p: CatalogPack, baseUrl: string | null): RemoteArtTheme {
  const data: ArtPackData = {
    id: p.id,
    palette: p.palette,
    meta: { name: p.name, mood: p.mood, tags: p.tags, credits: '', licence: 'original', generator: '', prompt: '', addedAt: p.addedAt || ART_PACK_DEFAULT_ADDED_AT, category: p.category || undefined },
    wallpaper: ART_WALLPAPER_SIZE,
    heroes: NO_HEROES,
    bytes: {},
  };
  const base = artPackTheme(data);
  return {
    ...base,
    plus: p.plus,
    remoteArt: Object.freeze({
      packId: p.id,
      packVersion: p.packVersion,
      plus: p.plus,
      bytes: p.bytes,
      thumbUrl: baseUrl && baseUrl.trim() ? packObjectUrl(baseUrl, p.thumb) : null,
      thumbhash: p.thumbhash,
    }),
  };
}

/**
 * Gallery themes for every catalogue pack that the app doesn't already bundle (a bundled theme
 * with the same id wins). Empty when there is no catalogue or packs are disabled (no base URL).
 */
export function remoteArtThemes(catalog: Catalog | null, baseUrl: string | null, bundledIds: Iterable<string>): RemoteArtTheme[] {
  if (!catalog || !baseUrl) return [];
  const taken = new Set(bundledIds);
  const out: RemoteArtTheme[] = [];
  for (const p of catalog.packs) {
    if (taken.has(p.id)) continue;
    taken.add(p.id);
    out.push(remoteArtTheme(p, baseUrl));
  }
  return out;
}

/** Bundled list first, then remote entries whose id isn't bundled. Returns `bundled` itself when nothing is added. */
export function mergeRemoteThemes<B extends { id: string }, R extends { id: string }>(bundled: readonly B[], remote: readonly R[]): readonly (B | R)[] {
  if (remote.length === 0) return bundled;
  const ids = new Set(bundled.map((t) => t.id));
  const extra = remote.filter((t) => !ids.has(t.id));
  return extra.length === 0 ? bundled : [...bundled, ...extra];
}

/** Find a remote theme by id. */
export function remoteThemeById(list: readonly RemoteArtTheme[], id: string | null | undefined): RemoteArtTheme | undefined {
  return typeof id === 'string' ? list.find((t) => t.id === id) : undefined;
}

// ------------------------------------------------------------------ after the download

/** Relative paths (inside the pack's local folder) of the downloaded files by role. */
export type RemoteArtFiles = { wallpaper: string | null; thumb: string | null; heroes: Partial<Record<HeroSize, string>> };

const HERO_ROLE: Readonly<Record<HeroSize, RemoteArtRole>> = { small: 'widget-small', medium: 'widget-medium', large: 'widget-large' };

export function remoteArtFiles(m: Pick<RemoteArtManifest, 'assets'> & { widgets?: RemoteArtManifest['widgets'] }): RemoteArtFiles {
  const find = (role: RemoteArtRole) => m.assets.find((a) => a.role === role)?.path ?? null;
  const heroes: Partial<Record<HeroSize, string>> = {};
  // T201 (owner-1101d #4, the cropped Firefly Grove fox): a v2 pack's own art options come FIRST.
  // A v1 widget-medium / widget-large file may be a pre-cropped strip of square art; the v2 list
  // has the whole piece (fitted later). Order: a v2 `art` option suggested for the size (one over
  // the wallpaper first), then the v1 role file, then any v2 option for the size.
  const own = (m.widgets ?? []).filter((o) => !o.derived);
  for (const s of HERO_SIZES) {
    const forSize = own.filter((o) => o.sizes.includes(s));
    const art = forSize.filter((o) => o.kind === 'art');
    const p =
      (art.find((o) => o.background === 'wallpaper') ?? art[0])?.image ?? find(HERO_ROLE[s]) ?? forSize[0]?.image ?? null;
    if (p) heroes[s] = p;
  }
  return { wallpaper: find('wallpaper'), thumb: find('thumb'), heroes };
}

/** The theme with the downloaded manifest's credit, licence and hero sizes (shown on the detail). */
export function withDownloadedArt(theme: RemoteArtTheme, m: RemoteArtManifest): RemoteArtTheme {
  if (m.id !== theme.id) return theme;
  const files = remoteArtFiles(m);
  return {
    ...theme,
    artPack: Object.freeze({
      ...theme.artPack,
      heroes: Object.freeze(HERO_SIZES.filter((s) => !!files.heroes[s])),
      credits: typeof m.meta.credits === 'string' ? m.meta.credits : '',
      licence: m.meta.licence,
      generator: typeof m.meta.generator === 'string' ? m.meta.generator : '',
    }),
  };
}

/**
 * The theme detail's pack card for a remote art pack. Unlike bundled-Plus packs, a free remote
 * pack also needs the download, so 'free' and 'not-downloaded' both offer Download.
 */
export function remoteArtDetailView(access: PackAccessInput): PackDetailView {
  switch (access.state) {
    case 'locked':
      return { kind: 'locked' };
    case 'ready':
      return { kind: 'ready' };
    case 'downloading': {
      const p = Number.isFinite(access.progress) ? Math.min(1, Math.max(0, access.progress)) : 0;
      return { kind: 'downloading', progress: p, percent: Math.min(99, Math.floor(p * 100)) };
    }
    case 'error':
      return { kind: 'error', message: access.error && access.error.trim() ? access.error : null };
    case 'disabled':
      return { kind: 'error', message: access.error && access.error.trim() ? access.error : null };
    default:
      return { kind: 'download' };
  }
}
