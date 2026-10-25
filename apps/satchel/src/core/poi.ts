// Points of interest for the map: OpenStreetMap tag -> category mapping (rules from src/content/osm_poi_tags.json),
// category toggles, distance sort, and pins for trip bookings. Pure TypeScript; the JSON is passed in by the caller
// (the UI imports it, tests read it from disk).
import type { ItemKind, Trip } from './model.ts';

export type LatLon = { lat: number; lon: number };
export type OsmTag = { key: string; value: string };

export type PoiCategory = {
  id: string;
  label: string;
  iconHint: string;
  tags: OsmTag[];
  exclude: OsmTag[];
  defaultOn: boolean;
  /** 1–5; when two categories match the same tags, the higher priority wins (file order breaks ties). */
  priority: number;
};

/** The toggles Map v0 offers (docs/PLAN.md §3, FLOWS §11), in display order. Other categories stay in the content. */
export const MAP_V0_CATEGORIES = ['toilets', 'drinking_water', 'fuel', 'food', 'pharmacy', 'atm_bank', 'hospital_clinic', 'transport'] as const;
export type MapCategory = (typeof MAP_V0_CATEGORIES)[number];
export const isMapCategory = (id: string): id is MapCategory => (MAP_V0_CATEGORIES as readonly string[]).includes(id);

export type Poi = LatLon & { id: string; name: string; category: string };
export type PoiSet = { city: string; source: string; sample: boolean; center: LatLon; pois: Poi[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const validLatLon = (lat: unknown, lon: unknown): boolean => {
  const a = num(lat);
  const o = num(lon);
  return a !== null && o !== null && a >= -90 && a <= 90 && o >= -180 && o <= 180;
};

const tagList = (v: unknown): OsmTag[] =>
  Array.isArray(v)
    ? v.flatMap((t) => {
        if (!isObj(t)) return [];
        const key = str(t.key);
        const value = str(t.value);
        return key && value ? [{ key, value }] : [];
      })
    : [];

/** Reads the osm_poi_tags content file; skips malformed rows rather than throwing. */
export function parsePoiCategories(raw: unknown): PoiCategory[] {
  if (!isObj(raw) || !Array.isArray(raw.categories)) return [];
  const seen = new Set<string>();
  const out: PoiCategory[] = [];
  for (const c of raw.categories) {
    if (!isObj(c)) continue;
    const id = str(c.id);
    const tags = tagList(c.tags);
    if (!id || seen.has(id) || tags.length === 0) continue;
    seen.add(id);
    out.push({
      id,
      label: str(c.label) ?? id,
      iconHint: str(c.icon_hint) ?? id,
      tags,
      exclude: tagList(c.exclude),
      defaultOn: c.default_on !== false,
      priority: num(c.priority) ?? 0,
    });
  }
  return out;
}

const has = (tags: Record<string, string>, t: OsmTag) => tags[t.key] === t.value;

/** The category for a set of OSM tags, or null if none matches. Exclusions veto their own category only. */
export function categoryForTags(tags: Record<string, string>, cats: readonly PoiCategory[]): string | null {
  let best: PoiCategory | null = null;
  for (const c of cats) {
    if (c.exclude.some((t) => has(tags, t))) continue;
    if (!c.tags.some((t) => has(tags, t))) continue;
    if (!best || c.priority > best.priority) best = c;
  }
  return best?.id ?? null;
}

/**
 * Reads a bundled POI file ({city, source, sample, center, pois:[{id, name, lat, lon, tags}]}) and maps each
 * point to a category. Points with bad coordinates, no name or no matching category are dropped.
 */
export function parsePoiSet(raw: unknown, cats: readonly PoiCategory[]): PoiSet | null {
  if (!isObj(raw) || !Array.isArray(raw.pois) || !isObj(raw.center)) return null;
  const city = str(raw.city);
  const source = str(raw.source);
  if (!city || !source || !validLatLon(raw.center.lat, raw.center.lon)) return null;
  const seen = new Set<string>();
  const pois: Poi[] = [];
  for (const p of raw.pois) {
    if (!isObj(p) || !isObj(p.tags)) continue;
    const id = str(p.id);
    const name = str(p.name);
    if (!id || !name || seen.has(id) || !validLatLon(p.lat, p.lon)) continue;
    const tags: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.tags)) if (typeof v === 'string') tags[k] = v;
    const category = categoryForTags(tags, cats);
    if (!category) continue;
    seen.add(id);
    pois.push({ id, name, lat: p.lat as number, lon: p.lon as number, category });
  }
  return { city, source, sample: raw.sample !== false, center: { lat: raw.center.lat as number, lon: raw.center.lon as number }, pois };
}

/** Initial toggle state: each offered category's default_on from the content (on if unknown). */
export function defaultToggles(cats: readonly PoiCategory[], offered: readonly string[] = MAP_V0_CATEGORIES): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of offered) out[id] = cats.find((c) => c.id === id)?.defaultOn ?? true;
  return out;
}

export function filterByCategories<P extends { category: string }>(pois: readonly P[], on: Record<string, boolean>): P[] {
  return pois.filter((p) => on[p.category] === true);
}

const R = 6_371_008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nearest first; ties keep their original order. Returns new objects with `meters`. */
export function sortByDistance<P extends LatLon>(points: readonly P[], from: LatLon): (P & { meters: number })[] {
  return points
    .map((p, i) => ({ p: { ...p, meters: haversineMeters(from, p) }, i }))
    .sort((x, y) => x.p.meters - y.p.meters || x.i - y.i)
    .map((x) => x.p);
}

/** '350 m' under 1 km (rounded to 10 m), '1.2 km' under 10 km, '14 km' beyond. Number part only + unit. */
export function distanceParts(m: number): { n: string; unit: 'm' | 'km' } {
  if (!Number.isFinite(m) || m < 0) return { n: '0', unit: 'm' };
  if (m < 1000) return { n: String(Math.max(10, Math.round(m / 10) * 10)), unit: 'm' };
  const km = m / 1000;
  return { n: km < 10 ? km.toFixed(1) : String(Math.round(km)), unit: 'km' };
}

export type BookingPin = LatLon & { id: string; tripId: string; itemId: string; kind: ItemKind; name: string; title: string };

/** One pin per located place on a booking (place, from, to), deduplicated per trip by coordinates + name. */
export function bookingPins(trips: readonly Trip[]): BookingPin[] {
  const out: BookingPin[] = [];
  const seen = new Set<string>();
  for (const trip of trips) {
    for (const item of trip.items) {
      for (const [role, place] of [['place', item.place], ['from', item.from], ['to', item.to]] as const) {
        if (!place || !validLatLon(place.lat, place.lon)) continue;
        const lat = place.lat as number;
        const lon = place.lon as number;
        const key = `${trip.id}|${place.name}|${lat.toFixed(5)}|${lon.toFixed(5)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: `${item.id}:${role}`, tripId: trip.id, itemId: item.id, kind: item.kind, name: place.name, title: item.title, lat, lon });
      }
    }
  }
  return out;
}

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** A map region covering every point with 30% padding and a minimum span (about 2 km); null for no points. */
export function regionFor(points: readonly LatLon[], minDelta = 0.02): Region | null {
  if (points.length === 0) return null;
  let s = 90;
  let n = -90;
  let w = 180;
  let e = -180;
  for (const p of points) {
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
    w = Math.min(w, p.lon);
    e = Math.max(e, p.lon);
  }
  return {
    latitude: (s + n) / 2,
    longitude: (w + e) / 2,
    latitudeDelta: Math.min(180, Math.max(minDelta, (n - s) * 1.3)),
    longitudeDelta: Math.min(360, Math.max(minDelta, (e - w) * 1.3)),
  };
}
