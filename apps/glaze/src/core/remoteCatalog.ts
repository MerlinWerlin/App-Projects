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
/** The cached copy on the phone, under the pack store root (documentDirectory/packs/). */
export const CATALOG_CACHE_FILE = 'catalog.json';

/** The cached catalogue: when it was fetched (ms since epoch) and its text exactly as served. */
export type CatalogCache = { savedAt: number; text: string };

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

export function serializeCatalogCache(c: CatalogCache): string {
  return JSON.stringify({ savedAt: c.savedAt, text: c.text });
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
  return parseCatalogText(v.text) ? { savedAt: v.savedAt, text: v.text } : null;
}

/**
 * Whether to fetch catalog.json now: always when forced (pull to refresh) or nothing is cached;
 * otherwise once the copy is CATALOG_REFRESH_MS old (or dated in the future after a clock change).
 */
export function catalogNeedsFetch(cache: Pick<CatalogCache, 'savedAt'> | null, now: number, force = false): boolean {
  if (force || !cache) return true;
  const age = now - cache.savedAt;
  return age < 0 || age >= CATALOG_REFRESH_MS;
}

/** Outcome of one fetch attempt; null when no fetch was made. */
export type CatalogFetch = { ok: true; text: string } | { ok: false; error: string } | null;

export type CatalogDecision = {
  /** What the gallery lists (null: nothing remote to show). */
  catalog: Catalog | null;
  /** The copy to keep. */
  cache: CatalogCache | null;
  /** True when `cache` is new and should be written to disk. */
  save: boolean;
  /** Why the fetch didn't replace the cached copy (offline, bad file), or null. */
  error: string | null;
};

/** Offline-safe choice between the cached catalogue and a fresh fetch. Never throws. */
export function decideCatalog(cached: CatalogCache | null, fetched: CatalogFetch, now: number): CatalogDecision {
  const keep = (error: string | null): CatalogDecision => ({ catalog: cached ? parseCatalogText(cached.text) : null, cache: cached, save: false, error });
  if (!fetched) return keep(null);
  if (!fetched.ok) return keep(fetched.error || 'fetch failed');
  const fresh = parseCatalogText(fetched.text);
  if (!fresh) return keep('bad catalogue ignored');
  return { catalog: fresh, cache: { savedAt: now, text: fetched.text }, save: true, error: null };
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
    meta: { name: p.name, mood: p.mood, tags: p.tags, credits: '', licence: 'original', generator: '', prompt: '', addedAt: p.addedAt || ART_PACK_DEFAULT_ADDED_AT },
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

export function remoteArtFiles(m: Pick<RemoteArtManifest, 'assets'>): RemoteArtFiles {
  const find = (role: RemoteArtRole) => m.assets.find((a) => a.role === role)?.path ?? null;
  const heroes: Partial<Record<HeroSize, string>> = {};
  for (const s of HERO_SIZES) {
    const p = find(HERO_ROLE[s]);
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
