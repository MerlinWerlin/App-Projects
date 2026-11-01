// T231 b: optional online refinement of an app's family. When the phone is online, the name of an
// app Glaze has no icon for is looked up in Apple's public App Store search
// (itunes.apple.com/search, no account, no key) and the top result's primaryGenreName is used, but
// only when that result's name closely matches the scanned name. Results (including "no match") are
// cached per name with a TTL. Network errors are never cached and never thrown: the on-device
// keyword family (categorizeAppName) simply stands.
// Only the app NAME is sent (plus the store country); nothing else leaves the phone.
// Pure TypeScript: the fetch is injected (src/native/appCategory.ts supplies the real one), so Node
// runs the tests with a mock.

import { categorizeAppName, familyFromGenre, type AppFamily } from './appCategory.ts';
import { compactLabel, stringSimilarity, tokenSimilarity } from './homeScan.ts';

export const APP_STORE_SEARCH = 'https://itunes.apple.com/search';
export const CATEGORY_CACHE_KEY = 'glaze.appCategory.v1';
/** A found genre is kept for 30 days; a "no close match" for 7 (the app may launch / rename). */
export const CATEGORY_TTL_MS = 30 * 24 * 3600 * 1000;
export const CATEGORY_MISS_TTL_MS = 7 * 24 * 3600 * 1000;
export const CATEGORY_TIMEOUT_MS = 4000;
/** Most lookups one scan makes (each is one small request). */
export const MAX_LOOKUPS = 40;
/** Most names kept in the cache (oldest dropped). */
export const MAX_CACHE_ENTRIES = 400;
/** How close the App Store name must be to the scanned name. */
export const NAME_MATCH_THRESHOLD = 0.8;

export type CategoryCacheEntry = { genre: string | null; at: number };
export type CategoryCache = Record<string, CategoryCacheEntry>;
/** Returns parsed JSON, or throws (timeout, offline, HTTP error). */
export type FetchJson = (url: string, timeoutMs: number) => Promise<unknown>;

/** Search URL for one name: software only, one result, the device's store (default 'au'). */
export function appStoreSearchUrl(name: string, country?: string | null): string {
  const c = typeof country === 'string' && /^[a-z]{2}$/i.test(country.trim()) ? country.trim().toLowerCase() : 'au';
  return `${APP_STORE_SEARCH}?term=${encodeURIComponent(String(name ?? '').trim())}&entity=software&limit=1&country=${c}`;
}

/**
 * True when an App Store title is the scanned name. Titles often carry a subtitle
 * ("Name: Banking & Money", "Name - Food Delivery"), so the part before the separator counts too.
 */
export function namesMatch(scanned: string, trackName: string): boolean {
  const a = String(scanned ?? '');
  const b = String(trackName ?? '');
  if (!compactLabel(a) || !compactLabel(b)) return false;
  const heads = [b, b.split(/\s*[:|–—]\s*|\s+-\s+/)[0]];
  return heads.some((h) => compactLabel(h) === compactLabel(a) || Math.max(stringSimilarity(a, h), tokenSimilarity(a, h)) >= NAME_MATCH_THRESHOLD);
}

/** primaryGenreName of the first result when its trackName matches `name`; else null. */
export function genreFromSearch(json: unknown, name: string): string | null {
  if (!json || typeof json !== 'object') return null;
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const r = results[0] as { trackName?: unknown; primaryGenreName?: unknown } | null;
  if (!r || typeof r.trackName !== 'string' || typeof r.primaryGenreName !== 'string') return null;
  if (!namesMatch(name, r.trackName)) return null;
  const g = r.primaryGenreName.trim();
  return g ? g.slice(0, 60) : null;
}

// ---------------------------------------------------------------- cache

export function cacheKey(name: string): string {
  return compactLabel(name).slice(0, 60);
}

export function parseCategoryCache(raw: unknown): CategoryCache {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  const out: CategoryCache = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, e] of Object.entries(v as Record<string, unknown>)) {
    if (!k || !e || typeof e !== 'object') continue;
    const { genre, at } = e as { genre?: unknown; at?: unknown };
    if (typeof at !== 'number' || !Number.isFinite(at)) continue;
    if (genre !== null && typeof genre !== 'string') continue;
    out[k] = { genre: genre as string | null, at };
  }
  return out;
}

export function serializeCategoryCache(cache: CategoryCache): string {
  const entries = Object.entries(cache)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_CACHE_ENTRIES);
  return JSON.stringify(Object.fromEntries(entries));
}

/** The cached entry for a name when still fresh, else undefined. */
export function freshEntry(cache: CategoryCache, name: string, now: number): CategoryCacheEntry | undefined {
  const e = cache[cacheKey(name)];
  if (!e) return undefined;
  const ttl = e.genre ? CATEGORY_TTL_MS : CATEGORY_MISS_TTL_MS;
  return now - e.at >= 0 && now - e.at < ttl ? e : undefined;
}

// ---------------------------------------------------------------- refinement

/** Family for a name: the App Store genre when it maps to one, else the keyword rules. */
export function familyFor(name: string, genre: string | null | undefined): AppFamily {
  return familyFromGenre(genre) ?? categorizeAppName(name).family;
}

/** Keyword families for every name (instant, offline). */
export function keywordFamilies(names: readonly string[]): Record<string, AppFamily> {
  const out: Record<string, AppFamily> = {};
  for (const n of names ?? []) if (typeof n === 'string') out[n] = categorizeAppName(n).family;
  return out;
}

export type RefineDeps = { fetchJson: FetchJson; country?: string | null; now?: number; cache?: CategoryCache; maxLookups?: number };

/**
 * Families for `names`, refined with App Store genres where a fresh cache entry or a lookup gives
 * one. Never throws; a failed lookup leaves that name on its keyword family and out of the cache.
 * Returns the updated cache for the caller to save.
 */
export async function refineFamilies(
  names: readonly string[],
  deps: RefineDeps,
): Promise<{ families: Record<string, AppFamily>; cache: CategoryCache; looked: number; changed: boolean }> {
  const now = deps.now ?? Date.now();
  const cache: CategoryCache = { ...(deps.cache ?? {}) };
  const families = keywordFamilies(names);
  let looked = 0;
  let changed = false;
  const max = Math.max(0, deps.maxLookups ?? MAX_LOOKUPS);
  for (const name of Object.keys(families)) {
    if (!cacheKey(name)) continue;
    let entry = freshEntry(cache, name, now);
    if (!entry && looked < max) {
      looked++;
      try {
        const json = await deps.fetchJson(appStoreSearchUrl(name, deps.country), CATEGORY_TIMEOUT_MS);
        entry = { genre: genreFromSearch(json, name), at: now };
        cache[cacheKey(name)] = entry;
        changed = true;
      } catch {
        entry = undefined; // offline / timeout / bad response: keyword family stands, retry next time
      }
    }
    if (entry) families[name] = familyFor(name, entry.genre);
  }
  return { families, cache, looked, changed };
}
