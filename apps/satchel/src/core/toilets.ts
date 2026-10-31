// Toilet finder (T49, owner feedback 1031 C): public toilets from OpenStreetMap (amenity=toilets). Pure logic only:
// the Toilet shape from the city-pack contract (docs: PACK_CONTRACT pois.json), parsing Overpass JSON and pack
// pois.json into Toilets, feature chips from the raw tags, distance + walking time, the compass direction and an
// arrow angle, the Overpass query and the Apple Maps walking link. src/native/toilets.ts does the file and network
// side; app/(tabs)/toilets.tsx shows it. No React Native imports here.
import type { Trip } from './model.ts';
import { activeTrip } from './places.ts';
import { distanceParts, haversineMeters, type LatLon } from './poi.ts';

/** One toilet. Keys are the raw OSM tag values; id = OSM type letter n/w/r + the OSM id (pack contract). */
export type Toilet = {
  id: string;
  lat: number;
  lon: number;
  name?: string;
  fee?: string;
  wheelchair?: string;
  changing_table?: string;
  opening_hours?: string;
  access?: string;
  unisex?: string;
  operator?: string;
};

export type ToiletHit = Toilet & {
  meters: number;
  /** Initial great-circle bearing from you, degrees clockwise from north, 0..359.99. */
  bearing: number;
  /** 8-point compass word key, e.g. 'toilets.dir.ne'. */
  dirKey: CompassKey;
  /** Minutes on foot at WALK_KMH (at least 1). */
  minutes: number;
};

export const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type Compass = (typeof COMPASS)[number];
export type CompassKey = `toilets.dir.${Compass}`;

/** Ordinary walking pace for the "x min walk" estimate. */
export const WALK_KMH = 4.8;
/** First Overpass radius, then one wider try if nothing is found. */
export const NEAR_RADIUS_M = 800;
export const WIDE_RADIUS_M = 2500;
/** At most this many results from one search. */
export const MAX_RESULTS = 60;

/** Access values that mean "not for you": dropped. 'customers' stays, labelled "customers only". */
const HIDDEN_ACCESS = new Set(['private', 'no']);

const TAG_KEYS = ['name', 'fee', 'wheelchair', 'changing_table', 'opening_hours', 'access', 'unisex', 'operator'] as const;

const validLat = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90;
const validLon = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** True when the toilet's access tag says it isn't open to the public (private / no). */
export function isHidden(t: Pick<Toilet, 'access'>): boolean {
  return !!t.access && HIDDEN_ACCESS.has(t.access.trim().toLowerCase());
}

/** One toilet from a pack's pois.json entry (already the contract shape), or null if unusable / not public. */
export function normalizeToilet(raw: unknown): Toilet | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id || !validLat(r.lat) || !validLon(r.lon)) return null;
  const t: Toilet = { id, lat: r.lat, lon: r.lon };
  for (const k of TAG_KEYS) {
    const v = str(r[k]);
    if (v) t[k] = v;
  }
  return isHidden(t) ? null : t;
}

/** Toilets from a pack's pois.json text or parsed object; [] for anything malformed. Deduped by id. */
export function parsePackToilets(json: unknown): Toilet[] {
  let data = json;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  const list = data && typeof data === 'object' ? (data as { toilets?: unknown }).toilets : undefined;
  if (!Array.isArray(list)) return [];
  return dedupe(list.map(normalizeToilet).filter((t): t is Toilet => t !== null));
}

const TYPE_LETTER: Record<string, string> = { node: 'n', way: 'w', relation: 'r' };

/**
 * Toilets from an Overpass `[out:json]` answer. Nodes carry lat/lon; ways and relations carry `center` (asked for
 * with `out center`). Elements without a position, with access=private/no, or not tagged amenity=toilets are dropped.
 * The older `diaper` tag counts as changing_table when changing_table is absent.
 */
export function parseOverpass(json: unknown): Toilet[] {
  let data = json;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  const elements = data && typeof data === 'object' ? (data as { elements?: unknown }).elements : undefined;
  if (!Array.isArray(elements)) return [];
  const out: Toilet[] = [];
  for (const e of elements) {
    if (!e || typeof e !== 'object') continue;
    const el = e as { type?: unknown; id?: unknown; lat?: unknown; lon?: unknown; center?: { lat?: unknown; lon?: unknown }; tags?: unknown };
    const letter = typeof el.type === 'string' ? TYPE_LETTER[el.type] : undefined;
    if (!letter || (typeof el.id !== 'number' && typeof el.id !== 'string')) continue;
    const lat = el.type === 'node' ? el.lat : el.center?.lat;
    const lon = el.type === 'node' ? el.lon : el.center?.lon;
    if (!validLat(lat) || !validLon(lon)) continue;
    const tags = (el.tags && typeof el.tags === 'object' ? el.tags : {}) as Record<string, unknown>;
    if (tags.amenity !== undefined && tags.amenity !== 'toilets') continue;
    const t: Toilet = { id: `${letter}${el.id}`, lat, lon };
    for (const k of TAG_KEYS) {
      const v = str(tags[k]);
      if (v) t[k] = v;
    }
    if (!t.changing_table) {
      const diaper = str(tags.diaper);
      if (diaper) t.changing_table = diaper;
    }
    if (!isHidden(t)) out.push(t);
  }
  return dedupe(out);
}

/** First occurrence of each id wins. */
export function dedupe<T extends { id: string }>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  return list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

// ------------------------------------------------------------------------------------------------ feature chips

export type ToiletChip =
  | { id: 'free' | 'paid' | 'feeUnknown' | 'wheelchair' | 'wheelchairLimited' | 'noWheelchair' | 'changingTable' | 'unisex' | 'customersOnly' | 'open247' }
  | { id: 'hours'; text: string };

const yes = (v: string | undefined) => !!v && ['yes', 'designated', 'true', '1'].includes(v.trim().toLowerCase());
const HOURS_MAX = 40;

/** Open round the clock, as OSM opening_hours writes it ('24/7', 'Mo-Su 00:00-24:00', '00:00-24:00'). */
export function isAlwaysOpen(hours: string | undefined): boolean {
  if (!hours) return false;
  const h = hours.trim().replace(/\s+/g, ' ');
  return /^24\/7$/i.test(h) || /^(Mo-Su )?00:00-24:00$/i.test(h);
}

/** Feature chips in display order: fee, wheelchair, changing table, unisex, access, hours. */
export function toiletChips(t: Toilet): ToiletChip[] {
  const chips: ToiletChip[] = [];
  const fee = t.fee?.trim().toLowerCase();
  if (!fee) chips.push({ id: 'feeUnknown' });
  else if (fee === 'no' || fee === 'free') chips.push({ id: 'free' });
  else chips.push({ id: 'paid' });
  const wc = t.wheelchair?.trim().toLowerCase();
  if (yes(wc)) chips.push({ id: 'wheelchair' });
  else if (wc === 'limited') chips.push({ id: 'wheelchairLimited' });
  else if (wc === 'no') chips.push({ id: 'noWheelchair' });
  if (yes(t.changing_table) || t.changing_table?.trim().toLowerCase() === 'limited') chips.push({ id: 'changingTable' });
  if (yes(t.unisex)) chips.push({ id: 'unisex' });
  if (t.access?.trim().toLowerCase() === 'customers') chips.push({ id: 'customersOnly' });
  if (isAlwaysOpen(t.opening_hours)) chips.push({ id: 'open247' });
  else if (t.opening_hours?.trim()) {
    const h = t.opening_hours.trim();
    chips.push({ id: 'hours', text: h.length > HOURS_MAX ? `${h.slice(0, HOURS_MAX - 1)}…` : h });
  }
  return chips;
}

// ------------------------------------------------------------------------------------------- distance, direction

export const haversine = haversineMeters;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Initial great-circle bearing from a to b, degrees clockwise from north in [0, 360). 0 for the same point. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const f1 = rad(a.lat);
  const f2 = rad(b.lat);
  const dl = rad(b.lon - a.lon);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  if (y === 0 && x === 0) return 0;
  const b360 = (deg(Math.atan2(y, x)) + 360) % 360;
  return b360 >= 360 ? 0 : b360;
}

/** 8-point compass word for a bearing (each sector 45° wide, centred on its direction). */
export function compass8(bearing: number): Compass {
  const b = ((bearing % 360) + 360) % 360;
  return COMPASS[Math.round(b / 45) % 8] as Compass;
}

export const compassKey = (bearing: number): CompassKey => `toilets.dir.${compass8(bearing)}`;

/** Rotation for an up-pointing (north) arrow icon: whole degrees in [0, 360), for `rotate: '<n>deg'`. */
export const arrowDegrees = (bearing: number): number => Math.round(((bearing % 360) + 360) % 360) % 360;

/** Whole minutes on foot at WALK_KMH, at least 1. */
export function walkMinutes(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 1;
  return Math.max(1, Math.round(meters / ((WALK_KMH * 1000) / 60)));
}

/** Distance split for the UI ('120' + 'm', '1.4' + 'km'), the same rounding as the map list. */
export const toiletDistance = distanceParts;

/** Nearest first (ties keep input order), deduped by id, at most `limit`, optionally within `maxMeters`. */
export function nearestToilets(toilets: readonly Toilet[], from: LatLon, limit = MAX_RESULTS, maxMeters = Infinity): ToiletHit[] {
  return dedupe(toilets)
    .map((t, i) => {
      const meters = haversineMeters(from, t);
      const bearing = bearingDeg(from, t);
      return { hit: { ...t, meters, bearing, dirKey: compassKey(bearing), minutes: walkMinutes(meters) }, i };
    })
    .filter((x) => x.hit.meters <= maxMeters)
    .sort((a, b) => a.hit.meters - b.hit.meters || a.i - b.i)
    .slice(0, Math.max(0, limit))
    .map((x) => x.hit);
}

// ------------------------------------------------------------------------------------------------ pack + links

/** [west, south, east, north] from a pack's meta.json; null when malformed. */
export type Bbox = [number, number, number, number];

export function parseBbox(v: unknown): Bbox | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const [w, s, e, n] = v;
  if (!validLon(w) || !validLat(s) || !validLon(e) || !validLat(n) || s > n) return null;
  return [w, s, e, n];
}

/** True when the point lies inside the box (edges included). A box with west > east crosses the antimeridian. */
export function inBbox(b: Bbox, p: LatLon): boolean {
  const [w, s, e, n] = b;
  if (p.lat < s || p.lat > n) return false;
  return w <= e ? p.lon >= w && p.lon <= e : p.lon >= w || p.lon <= e;
}

const fixed = (n: number) => String(Number(n.toFixed(6)));

/** The Overpass QL for public toilets within `radius` metres (1..10000) of a point, nodes/ways/relations, centres. */
export function overpassQuery(lat: number, lon: number, radius: number): string {
  const r = Math.min(10_000, Math.max(1, Math.round(Number.isFinite(radius) ? radius : NEAR_RADIUS_M)));
  return `[out:json][timeout:20];nwr["amenity"="toilets"](around:${r},${fixed(lat)},${fixed(lon)});out center ${MAX_RESULTS};`;
}

/** Apple Maps walking directions to the point, labelled with the name when there is one. */
export function appleMapsWalkUrl(lat: number, lon: number, name?: string): string {
  const base = `http://maps.apple.com/?daddr=${fixed(lat)},${fixed(lon)}&dirflg=w`;
  const q = name?.trim();
  return q ? `${base}&q=${encodeURIComponent(q)}` : base;
}

// ------------------------------------------------------------------------------------------------- near my hotel

export type Stay = { name: string; lat: number; lon: number };

const dateOf = (local: string | undefined) => (local ?? '').slice(0, 10);

/**
 * The hotel to search around on the trip happening today: the stay covering today, else the next one, else the
 * latest one before today. Only hotel items whose place has coordinates count. Null when there is none.
 */
export function stayFor(trips: readonly Trip[], today: string): Stay | null {
  const trip = activeTrip(trips, today);
  if (!trip) return null;
  const stays = trip.items
    .filter((i) => i.kind === 'hotel' && i.place && validLat(i.place.lat) && validLon(i.place.lon))
    .map((i) => ({ from: dateOf(i.start.local), to: dateOf(i.end?.local) || dateOf(i.start.local), name: i.place?.name || i.title, lat: i.place?.lat as number, lon: i.place?.lon as number }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const pick = stays.find((s) => s.from <= today && today <= s.to) ?? stays.find((s) => s.from > today) ?? [...stays].reverse().find((s) => s.from < today);
  return pick ? { name: pick.name, lat: pick.lat, lon: pick.lon } : null;
}
