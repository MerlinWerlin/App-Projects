// T13 offline POI layers: the points of interest shipped inside each downloaded city pack (pois.json, built by
// tools/maps/pois.mjs: `toilets[]` + `places[]`) read for the Map tab's markers and Nearby list, the per-category
// toggles (kept on this phone, every offered category ON at first open) and the attribution line. Pure TypeScript,
// no React Native; the device side is src/native/packPois.ts.
//
// The parser never throws: a file over the size limit or that is not JSON gives a reason; inside a good file each
// entry is checked on its own (bad or out-of-range coordinates, unknown categories, duplicate ids and junk entries
// are skipped and counted), a missing name is allowed (the UI shows the category label instead), and at most
// POI_PACK_MAX_POINTS points are kept.
import type { CityMap } from './citymaps.ts';
import { validLatLon, type LatLon, type Poi, type PoiSet } from './poi.ts';
import { wheelchairLevel, type WheelchairLevel } from './stepfree.ts';

/** The categories the Map offers for downloaded cities, in chip / sheet order (ids from src/content/osm_poi_tags.json). */
export const OFFERED_POI_CATEGORIES = [
  'toilets',
  'drinking_water',
  'food',
  'supermarket',
  'pharmacy',
  'hospital_clinic',
  'police',
  'embassy',
  'atm_bank',
  'transport',
  'fuel',
  // T156 step-free travel: lifts (highway=elevator), last so the existing chip order is unchanged.
  'lift',
] as const;
export type OfferedCategory = (typeof OFFERED_POI_CATEGORIES)[number];
export const isOfferedCategory = (v: unknown): v is OfferedCategory => typeof v === 'string' && (OFFERED_POI_CATEGORIES as readonly string[]).includes(v);

/** Shown wherever pack POIs are on screen (ODbL 1.0 attribution for the extract). */
export const OSM_POI_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

/** A pois.json bigger than this (characters of text, about bytes) is not read: a pack is ~40 MB in all, POIs a few MB. */
export const POI_PACK_MAX_CHARS = 12_000_000;
/** At most this many points per city are kept (the map and the list only ever show the nearest few hundred). */
export const POI_PACK_MAX_POINTS = 60_000;
/** Longest name kept (OSM's own value limit). */
const MAX_NAME = 255;

/** T156: `wheelchair` is the OSM tag as yes / limited / no (src/core/stepfree.ts wheelchairLevel), when the pack has it. */
export type PackPoi = LatLon & { id: string; category: OfferedCategory; name?: string; wheelchair?: WheelchairLevel };

export type PackPoiFile =
  | { ok: true; format: number; pois: PackPoi[]; dropped: number; truncated: boolean }
  | { ok: false; reason: 'too-large' | 'malformed' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const cleanName = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s && s.length <= MAX_NAME ? s : undefined;
};
const cleanId = (v: unknown): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return typeof v === 'string' && v.trim() && v.length <= 64 ? v.trim() : null;
};

/**
 * pois.json (text or already parsed) -> the points the Map shows. `toilets[]` entries become category `toilets`;
 * `places[]` keep their category when the Map offers it. Toilets tagged access=private/no are left out.
 */
export function parsePackPoiFile(input: unknown, limits: { maxChars?: number; maxPoints?: number } = {}): PackPoiFile {
  const maxChars = limits.maxChars ?? POI_PACK_MAX_CHARS;
  const maxPoints = limits.maxPoints ?? POI_PACK_MAX_POINTS;
  let data = input;
  if (typeof data === 'string') {
    if (data.length > maxChars) return { ok: false, reason: 'too-large' };
    try {
      data = JSON.parse(data);
    } catch {
      return { ok: false, reason: 'malformed' };
    }
  }
  if (!isObj(data)) return { ok: false, reason: 'malformed' };
  const toilets = Array.isArray(data.toilets) ? data.toilets : [];
  const places = Array.isArray(data.places) ? data.places : [];
  if (!Array.isArray(data.toilets) && !Array.isArray(data.places)) return { ok: false, reason: 'malformed' };
  const f = data.format;
  const format = typeof f === 'number' && Number.isInteger(f) && f >= 1 && f <= 999 ? f : 1;

  const seen = new Set<string>();
  const pois: PackPoi[] = [];
  let dropped = 0;
  let truncated = false;
  const take = (raw: unknown, forced: OfferedCategory | null) => {
    if (!isObj(raw)) return void dropped++;
    const id = cleanId(raw.id);
    const category = forced ?? (isOfferedCategory(raw.category) ? raw.category : null);
    if (!id || !category || !validLatLon(raw.lat, raw.lon)) return void dropped++;
    if (forced === 'toilets' && (raw.access === 'private' || raw.access === 'no')) return void dropped++;
    const key = `${category === 'toilets' ? 't' : 'p'}:${id}`;
    if (seen.has(key)) return void dropped++;
    if (pois.length >= maxPoints) {
      truncated = true;
      return;
    }
    seen.add(key);
    const name = cleanName(raw.name);
    const wheelchair = wheelchairLevel(raw.wheelchair);
    pois.push({ id: key, category, lat: raw.lat as number, lon: raw.lon as number, ...(name ? { name } : {}), ...(wheelchair ? { wheelchair } : {}) });
  };
  for (const t of toilets) take(t, 'toilets');
  for (const p of places) take(p, null);
  return { ok: true, format, pois, dropped, truncated };
}

/** A downloaded city's points as a Map point set (not sample); unnamed points go by their category label. */
export function packPoiSet(city: Pick<CityMap, 'id' | 'name' | 'bbox'>, pois: readonly PackPoi[], label: (category: OfferedCategory) => string): PoiSet {
  const [w, s, e, n] = city.bbox;
  return {
    city: city.name,
    source: `pack:${city.id}`,
    sample: false,
    center: { lat: (s + n) / 2, lon: (w + e) / 2 },
    pois: pois.map((p): Poi => ({ id: p.id, lat: p.lat, lon: p.lon, category: p.category, name: p.name ?? label(p.category), ...(p.wheelchair ? { wheelchair: p.wheelchair } : {}) })),
  };
}

// ------------------------------------------------------------------------------------------------ toggles

/** Stored on this phone (AsyncStorage) under this key: `{ off: [category ids] }`. */
export const POI_TOGGLES_KEY = 'satchel.poitoggles.v1';

export type PoiToggles = Record<OfferedCategory, boolean>;

/**
 * The toggles from what is stored. Release standard §1: with nothing stored (first open) EVERY offered category is
 * on, whatever the content file's default_on says; afterwards only the categories the user turned off are off.
 */
export function parsePoiToggles(raw: unknown): PoiToggles {
  const off = isObj(raw) && Array.isArray(raw.off) ? raw.off : [];
  return Object.fromEntries(OFFERED_POI_CATEGORIES.map((id) => [id, !off.includes(id)])) as PoiToggles;
}

/** What to store for these toggles. */
export const storePoiToggles = (t: PoiToggles): { off: OfferedCategory[] } => ({ off: OFFERED_POI_CATEGORIES.filter((id) => !t[id]) });

export const togglePoiCategory = (t: PoiToggles, id: OfferedCategory): PoiToggles => ({ ...t, [id]: !t[id] });
export const allPoiCategoriesOn = (): PoiToggles => parsePoiToggles(null);
export const poiCategoriesOff = (t: PoiToggles): number => OFFERED_POI_CATEGORIES.filter((id) => !t[id]).length;

/** How many points of each offered category the set has (for the sheet's counts). */
export function poiCategoryCounts(pois: readonly { category: string }[]): Record<OfferedCategory, number> {
  const out = Object.fromEntries(OFFERED_POI_CATEGORIES.map((id) => [id, 0])) as Record<OfferedCategory, number>;
  for (const p of pois) if (isOfferedCategory(p.category)) out[p.category] += 1;
  return out;
}

/** The points whose category is on (sample-set categories outside the offered list stay shown). */
export function filterPoisByToggles<P extends { category: string }>(pois: readonly P[], t: PoiToggles): P[] {
  return pois.filter((p) => !isOfferedCategory(p.category) || t[p.category]);
}

/**
 * What the Nearby list says when it is empty. `noneOn`: every category is off; `noneInCats`: some are off and
 * nothing is left; `none`: everything is on and the city simply has no points. Release standard §1: whenever a
 * filter is the reason (`noneOn` / `noneInCats`) the list keeps its one-tap "Show all" button.
 */
export function poiListEmpty(total: number, shown: number, t: PoiToggles): { kind: 'noneOn' | 'noneInCats' | 'none'; showAll: boolean } | null {
  if (shown > 0) return null;
  const off = poiCategoriesOff(t);
  if (off === OFFERED_POI_CATEGORIES.length) return { kind: 'noneOn', showAll: true };
  if (off > 0) return { kind: 'noneInCats', showAll: true };
  return { kind: 'none', showAll: false };
}

/** Markers drawn at once (the nearest to where the map looks); the list is capped the same way. */
export const POI_MARKER_LIMIT = 150;
export const POI_LIST_LIMIT = 200;

/** The `limit` points nearest `from` (cheap planar distance; fine at city scale), nearest first, ties in file order. */
export function nearestPois<P extends LatLon>(pois: readonly P[], from: LatLon, limit: number): P[] {
  const k = Math.cos((from.lat * Math.PI) / 180);
  return pois
    .map((p, i) => ({ p, i, d: (p.lat - from.lat) ** 2 + ((p.lon - from.lon) * k) ** 2 }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, Math.max(0, limit))
    .map((x) => x.p);
}
