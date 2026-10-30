// Toilet finder, device side (T49). Offline first: a downloaded city pack (PACK_CONTRACT: documentDirectory +
// 'maps/<id>/' with meta.json, pois.json and a '.complete' marker written last) whose bbox holds the point answers
// from its pois.json, parsed once per city and kept in memory. Otherwise, when the phone is (or may be) online, one
// Overpass request (800 m, then once more at 2500 m if nothing turned up). Never throws: every failure is a reason.
import * as FileSystem from 'expo-file-system/legacy';
import type { LatLon } from '../core/poi.ts';
import { inBbox, MAX_RESULTS, NEAR_RADIUS_M, nearestToilets, overpassQuery, parseBbox, parseOverpass, parsePackToilets, WIDE_RADIUS_M, type Bbox, type Toilet, type ToiletHit } from '../core/toilets.ts';
import { readNetwork } from './network.ts';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT_MS = 20_000;

export type ToiletSearch =
  | { ok: true; source: 'offline'; city: string; toilets: ToiletHit[] }
  | { ok: true; source: 'online'; toilets: ToiletHit[] }
  | { ok: false; reason: 'offline-no-pack' | 'network' | 'none-found' };

type Pack = { id: string; dir: string; name: string; bbox: Bbox };

const poisCache = new Map<string, Toilet[]>();

const mapsDir = (): string | null => {
  try {
    const d = FileSystem.documentDirectory;
    return d ? `${d}maps/` : null;
  } catch {
    return null;
  }
};

async function exists(uri: string): Promise<boolean> {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

/** Installed (complete) city packs with a usable bbox. */
async function installedPacks(): Promise<Pack[]> {
  const root = mapsDir();
  if (!root || !(await exists(root))) return [];
  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(root);
  } catch {
    return [];
  }
  const packs: Pack[] = [];
  for (const id of names) {
    const dir = `${root}${id}/`;
    if (!(await exists(`${dir}.complete`))) continue;
    try {
      const meta = JSON.parse(await FileSystem.readAsStringAsync(`${dir}meta.json`)) as { name?: unknown; bbox?: unknown };
      const bbox = parseBbox(meta.bbox);
      if (bbox) packs.push({ id, dir, name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : id, bbox });
    } catch {
      // unreadable meta: treat as not installed
    }
  }
  return packs;
}

async function packToilets(p: Pack): Promise<Toilet[]> {
  const hit = poisCache.get(p.dir);
  if (hit) return hit;
  try {
    const list = parsePackToilets(await FileSystem.readAsStringAsync(`${p.dir}pois.json`));
    poisCache.set(p.dir, list);
    return list;
  } catch {
    return [];
  }
}

/** The pack covering the point and its toilets within the wide radius, or null when no installed pack covers it. */
async function fromPack(at: LatLon): Promise<{ city: string; toilets: ToiletHit[] } | null> {
  const packs = (await installedPacks()).filter((p) => inBbox(p.bbox, at));
  if (!packs.length) return null;
  let best: { city: string; toilets: ToiletHit[] } | null = null;
  for (const p of packs) {
    const toilets = nearestToilets(await packToilets(p), at, MAX_RESULTS, WIDE_RADIUS_M);
    if (!best || (toilets[0]?.meters ?? Infinity) < (best.toilets[0]?.meters ?? Infinity)) best = { city: p.name, toilets };
  }
  return best;
}

/** One Overpass request; null on any network / server / parse failure. */
async function overpass(at: LatLon, radius: number): Promise<Toilet[] | null> {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: `data=${encodeURIComponent(overpassQuery(at.lat, at.lon, radius))}`,
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (!json || typeof json !== 'object' || !Array.isArray((json as { elements?: unknown }).elements)) return null;
    return parseOverpass(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Nearest public toilets to a point: offline pack first, then OpenStreetMap online. Never throws. */
export async function findToilets(at: LatLon): Promise<ToiletSearch> {
  try {
    const pack = await fromPack(at);
    if (pack && pack.toilets.length) return { ok: true, source: 'offline', city: pack.city, toilets: pack.toilets };
    const net = await readNetwork();
    if (net === 'offline') return pack ? { ok: false, reason: 'none-found' } : { ok: false, reason: 'offline-no-pack' };
    let failed = false;
    for (const radius of [NEAR_RADIUS_M, WIDE_RADIUS_M]) {
      const list = await overpass(at, radius);
      if (list === null) {
        failed = true;
        break;
      }
      const toilets = nearestToilets(list, at);
      if (toilets.length) return { ok: true, source: 'online', toilets };
    }
    if (failed) return pack ? { ok: false, reason: 'none-found' } : { ok: false, reason: 'network' };
    return { ok: false, reason: 'none-found' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** Forget parsed pack data (after a city is deleted or updated). */
export function clearToiletCache(): void {
  poisCache.clear();
}
