// T70 forecast, device side: MET Norway Locationforecast 2.0 compact, cached per place in AsyncStorage so the last
// forecast still shows offline ("Forecast from <time>"). Free, no key; MET's terms ask for an identifying
// User-Agent, at most four decimals in the coordinates, and that clients respect Expires and use If-Modified-Since.
// Never throws and never blocks: every failure falls back to the cached forecast or to null (the card then shows
// daylight only). The online path is written from MET's documentation and is unverified from the cloud build box.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { LatLon } from '../core/poi.ts';
import { cacheKey, forecastUrl, normaliseForecast, parseForecast, userAgent, type Forecast } from '../core/weather.ts';
import { readNetwork } from './network.ts';

const TIMEOUT_MS = 15_000;
/** When a response carries no usable Expires header, wait this long before asking again. */
const DEFAULT_TTL_MS = 30 * 60_000;

type CacheEntry = { forecast: Forecast; fetchedAt: number; expires: number; lastModified?: string };

export type ForecastResult = {
  forecast: Forecast;
  fetchedAt: number;
  /** True when fetched now or still within the server's Expires time; false when shown from the cache because the phone is offline or the request failed. */
  live: boolean;
};

const version = (): string => {
  try {
    return Constants.expoConfig?.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
};

async function readCache(at: LatLon): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(at));
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<CacheEntry> | null;
    const forecast = normaliseForecast(o?.forecast);
    if (!o || !forecast || typeof o.fetchedAt !== 'number') return null;
    return {
      forecast,
      fetchedAt: o.fetchedAt,
      expires: typeof o.expires === 'number' ? o.expires : 0,
      ...(typeof o.lastModified === 'string' ? { lastModified: o.lastModified } : {}),
    };
  } catch {
    return null;
  }
}

async function writeCache(at: LatLon, e: CacheEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(at), JSON.stringify(e));
  } catch {
    // storage full or unavailable: the forecast still shows this session
  }
}

/** The cached forecast for a place, if any (instant, no network). */
export async function cachedForecast(at: LatLon): Promise<ForecastResult | null> {
  const e = await readCache(at);
  return e ? { forecast: e.forecast, fetchedAt: e.fetchedAt, live: e.expires > Date.now() } : null;
}

const expiresFrom = (res: Response, now: number): number => {
  const ms = Date.parse(res.headers.get('expires') ?? '');
  return Number.isFinite(ms) && ms > now ? ms : now + DEFAULT_TTL_MS;
};

async function fetchFresh(at: LatLon, cached: CacheEntry | null): Promise<ForecastResult | null> {
  const fallback = cached ? { forecast: cached.forecast, fetchedAt: cached.fetchedAt, live: false } : null;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'User-Agent': userAgent(version()), Accept: 'application/json' };
    if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;
    const res = await fetch(forecastUrl(at), { headers, signal: ctrl?.signal });
    const now = Date.now();
    if (res.status === 304 && cached) {
      const next = { ...cached, fetchedAt: now, expires: expiresFrom(res, now) };
      await writeCache(at, next);
      return { forecast: next.forecast, fetchedAt: now, live: true };
    }
    // 203 is MET's "this product version is deprecated" but still a valid body.
    if (res.status !== 200 && res.status !== 203) return fallback;
    const forecast = parseForecast(await res.json(), now);
    if (!forecast) return fallback;
    const lastModified = res.headers.get('last-modified');
    await writeCache(at, { forecast, fetchedAt: now, expires: expiresFrom(res, now), ...(lastModified ? { lastModified } : {}) });
    return { forecast, fetchedAt: now, live: true };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

const inFlight = new Map<string, Promise<ForecastResult | null>>();

/**
 * The best forecast for a place: the cache while it is within Expires, otherwise a fresh request when the phone
 * may be online, falling back to the cache (live: false) offline or on any failure. Null when there is nothing.
 */
export function loadForecast(at: LatLon): Promise<ForecastResult | null> {
  const key = cacheKey(at);
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async (): Promise<ForecastResult | null> => {
    try {
      const cached = await readCache(at);
      if (cached && cached.expires > Date.now()) return { forecast: cached.forecast, fetchedAt: cached.fetchedAt, live: true };
      if ((await readNetwork()) === 'offline') return cached ? { forecast: cached.forecast, fetchedAt: cached.fetchedAt, live: false } : null;
      return await fetchFresh(at, cached);
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}
