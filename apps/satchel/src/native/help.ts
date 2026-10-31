// Nearest help, device side (T59). Online first here (unlike the Toilets tab), because OpenStreetMap online is the
// freshest source and format 1 city packs list hospitals/clinics and pharmacies by name only (format 2 packs, T62,
// add police, phone numbers and hours; src/core/help.ts). So: when the phone is (or may be) online, one Overpass
// request (2 km, once more at 6 km if a category is still empty). Offline, or when Overpass fails, a downloaded city
// pack covering the point answers from its pois.json (parsed once per city, kept in memory until the installed maps
// change). Never throws: every failure is a reason. No data is invented.
import * as FileSystem from 'expo-file-system/legacy';
import { balancedHelp, HELP_NEAR_M, HELP_WIDE_M, helpOverpassQuery, nearestHelp, needsWider, packLimited, packMissing, parseOverpassHelp, parsePackHelpFile, type HelpCategory, type HelpHit, type HelpPlace } from '../core/help.ts';
import type { LatLon } from '../core/poi.ts';
import { cityMapsChanged } from '../core/signal.ts';
import { inBbox } from '../core/toilets.ts';
import { readNetwork } from './network.ts';
import { installedPacks, OVERPASS_URL, type Pack } from './toilets.ts';

const TIMEOUT_MS = 25_000;
/** Rows per category in one result, so pharmacies can't crowd out the only hospital. */
const PER_CATEGORY = 15;

export type HelpSearch =
  | { ok: true; source: 'online'; places: HelpHit[] }
  /** limited: a format 1 pack (no police, phone numbers or hours), so the screen says what's missing. */
  | { ok: true; source: 'offline'; city: string; places: HelpHit[]; missing: HelpCategory[]; fallback: boolean; limited: boolean }
  | { ok: false; reason: 'offline-no-pack' | 'network' | 'none-found'; packCity?: string; packLimited?: boolean };

type PackHelp = { format: number; places: HelpPlace[] };
const cache = new Map<string, PackHelp>();
// A city downloaded again (perhaps a newer pack format) or deleted: forget what was parsed.
cityMapsChanged.subscribe(() => cache.clear());

async function packPlaces(p: Pack): Promise<PackHelp> {
  const hit = cache.get(p.dir);
  if (hit) return hit;
  try {
    const file = parsePackHelpFile(await FileSystem.readAsStringAsync(`${p.dir}pois.json`));
    cache.set(p.dir, file);
    return file;
  } catch {
    return { format: 1, places: [] };
  }
}

type PackAnswer = { city: string; places: HelpHit[]; missing: HelpCategory[]; limited: boolean };

/** The installed pack covering the point (the one with the nearest result), or null when none covers it. */
async function fromPack(at: LatLon): Promise<PackAnswer | null> {
  let packs: Pack[] = [];
  try {
    packs = (await installedPacks()).filter((p) => inBbox(p.bbox, at));
  } catch {
    return null;
  }
  if (!packs.length) return null;
  let best: PackAnswer | null = null;
  for (const p of packs) {
    const { format, places: all } = await packPlaces(p);
    const places = balancedHelp(nearestHelp(all, at, Infinity, HELP_WIDE_M), PER_CATEGORY);
    if (!best || (places[0]?.meters ?? Infinity) < (best.places[0]?.meters ?? Infinity)) {
      best = { city: p.name, places, missing: packMissing(all, format), limited: packLimited(format) };
    }
  }
  return best;
}

/** One Overpass request; null on any network / server / parse failure. */
async function overpass(at: LatLon, radius: number): Promise<HelpPlace[] | null> {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: `data=${encodeURIComponent(helpOverpassQuery(at.lat, at.lon, radius))}`,
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (!json || typeof json !== 'object' || !Array.isArray((json as { elements?: unknown }).elements)) return null;
    return parseOverpassHelp(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Online hits: near radius, then the wide one when a category is empty. null when the first request failed. */
async function online(at: LatLon): Promise<HelpHit[] | null> {
  const near = await overpass(at, HELP_NEAR_M);
  if (near === null) return null;
  let hits = nearestHelp(near, at, Infinity);
  if (needsWider(hits)) {
    const wide = await overpass(at, HELP_WIDE_M);
    if (wide) hits = nearestHelp(wide, at, Infinity);
  }
  return balancedHelp(hits, PER_CATEGORY);
}

/** Nearest hospitals/clinics, pharmacies and police to a point. Never throws. */
export async function findHelp(at: LatLon): Promise<HelpSearch> {
  try {
    const net = await readNetwork();
    let failed = net === 'offline';
    if (!failed) {
      const hits = await online(at);
      if (hits === null) failed = true;
      else if (hits.length) return { ok: true, source: 'online', places: hits };
    }
    const pack = await fromPack(at);
    if (pack && pack.places.length && failed) return { ok: true, source: 'offline', city: pack.city, places: pack.places, missing: pack.missing, fallback: net !== 'offline', limited: pack.limited };
    if (!failed) return { ok: false, reason: 'none-found' };
    if (pack) return { ok: false, reason: 'none-found', packCity: pack.city, packLimited: pack.limited };
    return { ok: false, reason: net === 'offline' ? 'offline-no-pack' : 'network' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** Forget parsed pack data (after a city is deleted or updated). */
export function clearHelpCache(): void {
  cache.clear();
}
