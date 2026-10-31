// Nearest help (T59, owner feedback "deepen the tabs"): hospitals and clinics, pharmacies and police stations from
// OpenStreetMap, for the Emergency tab. Pure logic only: parsing a city pack's pois.json `places` and an Overpass
// answer into HelpPlaces, the dialable phone number, hours / emergency-department chips, distance + walking
// direction (shared with the Toilets tab, src/core/toilets.ts), the Overpass query and per-category filtering.
// src/native/help.ts does the file and network side; app/help.tsx shows it. No React Native imports here.
//
// Pack contract (tools/maps/pois.mjs, docs/MAP_PACKS.md): pois.json = { format?, toilets: [...], places: [{ id, lat,
// lon, category, name?, ... }] }. Format 1 packs (no `format` field) carry hospitals/clinics and pharmacies by name
// only: no police, no phone, no hours. Format 2 packs (T62) add `police` places and `amenity` / `phone` /
// `opening_hours` / `emergency` on every help place, so Nearest help works fully offline. Both are read.
import { telUri } from './emergency.ts';
import type { LatLon } from './poi.ts';
import { haversineMeters } from './poi.ts';
import { bearingDeg, compass8, dedupe, isAlwaysOpen, walkMinutes, type Compass } from './toilets.ts';

export type HelpCategory = 'medical' | 'pharmacy' | 'police';
/** Display order of the categories (and the filter chips after "All"). */
export const HELP_CATEGORIES: readonly HelpCategory[] = ['medical', 'pharmacy', 'police'];
/** What format 1 city packs contain (the first tools/maps/build.mjs POI_TAGS): no police stations. */
export const PACK_CATEGORIES: readonly HelpCategory[] = ['medical', 'pharmacy'];
/** The pois.json format that added police, phone numbers and opening hours (tools/maps/pois.mjs POIS_FORMAT). */
export const PACK_HELP_FORMAT = 2;

/** The categories a pack of this format can hold. */
export const packCategories = (format: number): readonly HelpCategory[] => (format >= PACK_HELP_FORMAT ? HELP_CATEGORIES : PACK_CATEGORIES);
/** True when a pack of this format lacks police, phone numbers and hours (the screen then says so). */
export const packLimited = (format: number): boolean => format < PACK_HELP_FORMAT;

/** The OSM amenity behind a place, when known (packs merge hospital + clinic into one category). */
export type HelpKind = 'hospital' | 'clinic' | 'pharmacy' | 'police';

const AMENITY: Record<string, { category: HelpCategory; kind: HelpKind }> = {
  hospital: { category: 'medical', kind: 'hospital' },
  clinic: { category: 'medical', kind: 'clinic' },
  pharmacy: { category: 'pharmacy', kind: 'pharmacy' },
  police: { category: 'police', kind: 'police' },
};

/** Pack `places[].category` values that are help, mapped to ours. */
const PACK_CATEGORY: Record<string, HelpCategory> = { hospital_clinic: 'medical', pharmacy: 'pharmacy', police: 'police' };

export type HelpPlace = {
  /** OSM type letter n/w/r + OSM id (pack contract). */
  id: string;
  lat: number;
  lon: number;
  category: HelpCategory;
  kind?: HelpKind;
  name?: string;
  /** The first number from phone / contact:phone, as tagged (shown); `tel` is the dialable form. */
  phone?: string;
  tel?: string;
  opening_hours?: string;
  /** emergency=yes on a hospital: it has an emergency department. */
  emergency?: boolean;
};

export type HelpHit = HelpPlace & {
  meters: number;
  /** Initial great-circle bearing from you, degrees clockwise from north. */
  bearing: number;
  dirKey: `help.dir.${Compass}`;
  minutes: number;
};

/** Hospitals are sparser than toilets: a wider first search, then one wider try if a category is still empty. */
export const HELP_NEAR_M = 2000;
export const HELP_WIDE_M = 6000;
/** Overpass result cap and how many rows one search shows. */
export const HELP_MAX = 90;

const validLat = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90;
const validLon = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const HIDDEN_ACCESS = new Set(['private', 'no']);

/** The first dialable number in an OSM phone value ('+81 75-1234; +81 75-5678' -> '+81 75-1234'). */
export function firstPhone(raw: unknown): { phone: string; tel: string } | null {
  const s = str(raw);
  if (!s) return null;
  for (const part of s.split(/[;,]/)) {
    const phone = part.trim();
    const tel = telUri(phone);
    if (phone && tel) return { phone, tel };
  }
  return null;
}

const yesish = (v: unknown) => typeof v === 'string' && ['yes', 'true', '1', 'designated'].includes(v.trim().toLowerCase());

function addDetails(p: HelpPlace, src: Record<string, unknown>): HelpPlace {
  const ph = firstPhone(src.phone) ?? firstPhone(src['contact:phone']);
  if (ph) {
    p.phone = ph.phone;
    p.tel = ph.tel;
  }
  const hours = str(src.opening_hours);
  if (hours) p.opening_hours = hours;
  if (p.category === 'medical' && (src.emergency === true || yesish(src.emergency))) p.emergency = true;
  return p;
}

function parseJson(json: unknown): unknown {
  if (typeof json !== 'string') return json;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** A pois.json's format: its `format` field when it is a whole number of 1 or more, else 1 (the first packs). */
export function packFormatOf(json: unknown): number {
  const data = parseJson(json);
  const f = data && typeof data === 'object' ? (data as { format?: unknown }).format : undefined;
  return typeof f === 'number' && Number.isInteger(f) && f >= 1 ? f : 1;
}

/** A pack's help places and its format, from pois.json text or parsed JSON (parsed once). */
export function parsePackHelpFile(json: unknown): { format: number; places: HelpPlace[] } {
  const data = parseJson(json);
  return { format: packFormatOf(data), places: parsePackHelp(data) };
}

/** Help places from a pack's pois.json (text or parsed); [] for anything malformed. Deduped by id. */
export function parsePackHelp(json: unknown): HelpPlace[] {
  const data = parseJson(json);
  const list = data && typeof data === 'object' ? (data as { places?: unknown }).places : undefined;
  if (!Array.isArray(list)) return [];
  const out: HelpPlace[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = str(r.id);
    const category = typeof r.category === 'string' ? PACK_CATEGORY[r.category] : undefined;
    if (!id || !category || !validLat(r.lat) || !validLon(r.lon)) continue;
    if (typeof r.access === 'string' && HIDDEN_ACCESS.has(r.access.trim().toLowerCase())) continue;
    const p: HelpPlace = { id, lat: r.lat, lon: r.lon, category };
    const am = typeof r.amenity === 'string' ? AMENITY[r.amenity] : undefined;
    if (am && am.category === category) p.kind = am.kind;
    else if (category !== 'medical') p.kind = category;
    const name = str(r.name);
    if (name) p.name = name;
    out.push(addDetails(p, r));
  }
  return dedupe(out);
}

const TYPE_LETTER: Record<string, string> = { node: 'n', way: 'w', relation: 'r' };

/**
 * Help places from an Overpass `[out:json]` answer. Nodes carry lat/lon; ways and relations carry `center`.
 * Elements without a position, not tagged as one of our amenities, or with access=private/no are dropped.
 * The English name is preferred, as the city packs do.
 */
export function parseOverpassHelp(json: unknown): HelpPlace[] {
  const data = parseJson(json);
  const elements = data && typeof data === 'object' ? (data as { elements?: unknown }).elements : undefined;
  if (!Array.isArray(elements)) return [];
  const out: HelpPlace[] = [];
  for (const e of elements) {
    if (!e || typeof e !== 'object') continue;
    const el = e as { type?: unknown; id?: unknown; lat?: unknown; lon?: unknown; center?: { lat?: unknown; lon?: unknown }; tags?: unknown };
    const letter = typeof el.type === 'string' ? TYPE_LETTER[el.type] : undefined;
    if (!letter || (typeof el.id !== 'number' && typeof el.id !== 'string')) continue;
    const lat = el.type === 'node' ? el.lat : el.center?.lat;
    const lon = el.type === 'node' ? el.lon : el.center?.lon;
    if (!validLat(lat) || !validLon(lon)) continue;
    const tags = (el.tags && typeof el.tags === 'object' ? el.tags : {}) as Record<string, unknown>;
    const am = typeof tags.amenity === 'string' ? AMENITY[tags.amenity] : undefined;
    if (!am) continue;
    if (typeof tags.access === 'string' && HIDDEN_ACCESS.has(tags.access.trim().toLowerCase())) continue;
    const p: HelpPlace = { id: `${letter}${el.id}`, lat, lon, category: am.category, kind: am.kind };
    const name = str(tags['name:en']) ?? str(tags.name);
    if (name) p.name = name;
    out.push(addDetails(p, tags));
  }
  return dedupe(out);
}

/** The Overpass QL for hospitals, clinics, pharmacies and police within `radius` metres (1..15000), with centres. */
export function helpOverpassQuery(lat: number, lon: number, radius: number): string {
  const r = Math.min(15_000, Math.max(1, Math.round(Number.isFinite(radius) ? radius : HELP_NEAR_M)));
  const f = (n: number) => String(Number(n.toFixed(6)));
  return `[out:json][timeout:25];nwr["amenity"~"^(hospital|clinic|pharmacy|police)$"](around:${r},${f(lat)},${f(lon)});out center ${HELP_MAX * 2};`;
}

/** Nearest first (ties keep input order), deduped by id, at most `limit`, optionally within `maxMeters`. */
export function nearestHelp(places: readonly HelpPlace[], from: LatLon, limit = HELP_MAX, maxMeters = Infinity): HelpHit[] {
  return dedupe(places)
    .map((p, i) => {
      const meters = haversineMeters(from, p);
      const bearing = bearingDeg(from, p);
      const hit: HelpHit = { ...p, meters, bearing, dirKey: `help.dir.${compass8(bearing)}`, minutes: walkMinutes(meters) };
      return { hit, i };
    })
    .filter((x) => x.hit.meters <= maxMeters)
    .sort((a, b) => a.hit.meters - b.hit.meters || a.i - b.i)
    .slice(0, Math.max(0, limit))
    .map((x) => x.hit);
}

/**
 * A balanced list: up to `perCategory` nearest of each category, so a dense pharmacy street can't push the only
 * hospital off the list. Result stays sorted by distance.
 */
export function balancedHelp(hits: readonly HelpHit[], perCategory = 12): HelpHit[] {
  const seen: Record<HelpCategory, number> = { medical: 0, pharmacy: 0, police: 0 };
  return [...hits]
    .sort((a, b) => a.meters - b.meters)
    .filter((h) => (seen[h.category] < perCategory ? (seen[h.category]++, true) : false));
}

export type HelpFilter = 'all' | HelpCategory;

export function filterHelp<T extends { category: HelpCategory }>(hits: readonly T[], filter: HelpFilter): T[] {
  return filter === 'all' ? [...hits] : hits.filter((h) => h.category === filter);
}

export function countByCategory(hits: readonly { category: HelpCategory }[]): Record<HelpCategory, number> {
  const out: Record<HelpCategory, number> = { medical: 0, pharmacy: 0, police: 0 };
  for (const h of hits) out[h.category]++;
  return out;
}

/**
 * Categories with no rows that the source can't have (police in format 1 packs): say so instead of "none nearby".
 * `format` is the pack's pois.json format (1 when unknown, so old callers keep the old answer).
 */
export function packMissing(places: readonly { category: HelpCategory }[], format = 1): HelpCategory[] {
  const have = countByCategory(places);
  const can = packCategories(format);
  return HELP_CATEGORIES.filter((c) => have[c] === 0 && !can.includes(c));
}

/** True when some category has nothing within reach, so the wider radius is worth one more request. */
export function needsWider(hits: readonly { category: HelpCategory }[]): boolean {
  const c = countByCategory(hits);
  return HELP_CATEGORIES.some((k) => c[k] === 0);
}

// ------------------------------------------------------------------------------------------------------- chips

export type HelpChip = { id: 'emergencyDept' | 'open247' } | { id: 'hours'; text: string };
const HOURS_MAX = 48;

/** Chips in display order: emergency department, then 24/7 or the raw hours (shortened). */
export function helpChips(p: Pick<HelpPlace, 'emergency' | 'opening_hours'>): HelpChip[] {
  const chips: HelpChip[] = [];
  if (p.emergency) chips.push({ id: 'emergencyDept' });
  if (isAlwaysOpen(p.opening_hours)) chips.push({ id: 'open247' });
  else if (p.opening_hours?.trim()) {
    const h = p.opening_hours.trim();
    chips.push({ id: 'hours', text: h.length > HOURS_MAX ? `${h.slice(0, HOURS_MAX - 1)}…` : h });
  }
  return chips;
}

/** Catalogue key for the place's type line ('Hospital', 'Clinic', 'Hospital or clinic', 'Pharmacy', 'Police'). */
export function kindKey(p: Pick<HelpPlace, 'category' | 'kind'>): `help.kind.${HelpKind | 'medical'}` {
  if (p.kind) return `help.kind.${p.kind}`;
  return p.category === 'medical' ? 'help.kind.medical' : `help.kind.${p.category}`;
}
