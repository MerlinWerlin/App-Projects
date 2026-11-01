// Offline city maps, pure TS (T47). The catalog and pack format are fixed by the city map pack contract
// (release satchel-maps-v1: catalog.json + one uncompressed ustar per city of meta.json, pois.json and
// tiles/{z}/{x}/{y}.png raster tiles). This file validates what comes over the network before anything touches the
// disk, decides which tar entries may be written (nothing else: no path traversal, no surprise files), and holds
// the map helpers the Map tab needs (which installed city a spot is in, its region, sizes, zooms, tile counts).
import type { Region } from './poi.ts';

export const MAPS_RELEASE = 'satchel-maps-v1';
export const MAPS_BASE_URL = `https://github.com/MerlinWerlin/App-Projects/releases/download/${MAPS_RELEASE}/`;
export const CATALOG_URL = `${MAPS_BASE_URL}catalog.json`;

/**
 * Newest pack format this build understands (tools/maps/pois.mjs POIS_FORMAT, docs/MAP_PACKS.md). 1 = the first
 * packs (no `format` field): toilets and places by name only. 2 = adds police and, for hospitals/clinics, pharmacies
 * and police, phone / opening_hours / amenity / emergency. The catalog itself stays `version: 1`, so builds from
 * before format 2 still read the catalog and the packs (they ignore the extra fields).
 */
export const PACK_FORMAT = 2;

/** [west, south, east, north] in degrees. */
export type BBox = [number, number, number, number];

export type CityMap = {
  id: string;
  name: string;
  country: string;
  bbox: BBox;
  /** [lon, lat] */
  center: [number, number];
  minzoom: number;
  maxzoom: number;
  file: string;
  bytes: number;
  sha256?: string;
  tiles?: number;
  pois?: number;
  attribution?: string;
  /** Pack format (see PACK_FORMAT); absent on the first packs, which are format 1. */
  format?: number;
};

export type CityCatalog = {
  version: number;
  release: string;
  built: string;
  attribution: string;
  cities: CityMap[];
};

/** Web-mercator tiles stop at about ±85.05°. */
export const MAX_LAT = 85.0511287798;
export const MAX_ZOOM = 20;

const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const str = (v: unknown, max = 120): string | null => (typeof v === 'string' && v.trim() !== '' && v.length <= max ? v.trim() : null);

/** A bbox that is four finite numbers, west < east, south < north, inside the tileable world. */
export function validBBox(v: unknown): v is BBox {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(isNum)) return false;
  const [w, s, e, n] = v as number[];
  return w >= -180 && e <= 180 && w < e && s >= -MAX_LAT && n <= MAX_LAT && s < n;
}

export function bboxContains(b: BBox, lat: number, lon: number): boolean {
  return lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
}

/** One city entry (catalog or meta.json), or null when anything is off. */
export function parseCity(raw: unknown): CityMap | null {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : null;
  const name = str(raw.name);
  const country = str(raw.country, 8);
  if (!id || !name || !country) return null;
  if (!validBBox(raw.bbox)) return null;
  const bbox = [...raw.bbox] as BBox;
  if (!Array.isArray(raw.center) || raw.center.length !== 2 || !raw.center.every(isNum)) return null;
  const center = [raw.center[0], raw.center[1]] as [number, number];
  if (!bboxContains(bbox, center[1], center[0])) return null;
  if (!isInt(raw.minzoom, 0, MAX_ZOOM) || !isInt(raw.maxzoom, 0, MAX_ZOOM) || raw.minzoom > raw.maxzoom) return null;
  // the pack file must be a plain name in the release (never a path or a URL)
  if (typeof raw.file !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}\.tar$/.test(raw.file) || raw.file.includes('..')) return null;
  if (!isInt(raw.bytes, 1, 4 * 1024 ** 3)) return null;
  const city: CityMap = { id, name, country, bbox, center, minzoom: raw.minzoom, maxzoom: raw.maxzoom, file: raw.file, bytes: raw.bytes };
  if (typeof raw.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(raw.sha256)) city.sha256 = raw.sha256.toLowerCase();
  if (isInt(raw.tiles, 0, 1e8)) city.tiles = raw.tiles;
  if (isInt(raw.pois, 0, 1e8)) city.pois = raw.pois;
  const attribution = str(raw.attribution, 300);
  if (attribution) city.attribution = attribution;
  if (isInt(raw.format, 1, 999)) city.format = raw.format;
  return city;
}

/**
 * A pack's own meta.json, as tools/maps/build.mjs writes it. It cannot carry `bytes` or `sha256` (they are the size
 * and hash of the tar it sits inside), so those come from the catalog entry the pack was downloaded for (T153: before
 * this, parseCity rejected every real meta.json and every download ended as 'bad-pack'). Null when the meta is
 * invalid or is for another city than `entry`. Without an entry it is parseCity (a meta.json saved after install
 * carries the catalog's bytes, see packMetaToSave).
 */
export function parsePackMeta(raw: unknown, entry?: Pick<CityMap, 'id' | 'bytes' | 'sha256'>): CityMap | null {
  if (!entry) return parseCity(raw);
  if (!isObj(raw) || raw.id !== entry.id) return null;
  const merged: Record<string, unknown> = { ...raw };
  if (!isInt(merged.bytes, 1, 4 * 1024 ** 3)) merged.bytes = entry.bytes;
  if (merged.sha256 === undefined && entry.sha256) merged.sha256 = entry.sha256;
  return parseCity(merged);
}

/** The meta.json kept on the phone after an install: the pack's own fields plus the catalog's bytes (and sha256). */
export function packMetaToSave(raw: unknown, meta: CityMap): Record<string, unknown> {
  const out: Record<string, unknown> = isObj(raw) ? { ...raw } : { ...meta };
  out.bytes = meta.bytes;
  if (meta.sha256) out.sha256 = meta.sha256;
  return out;
}

/** The catalog with only its valid cities (duplicates by id dropped), or null when it is not a v1 catalog. */
export function parseCatalog(raw: unknown): CityCatalog | null {
  if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.cities)) return null;
  const seen = new Set<string>();
  const cities: CityMap[] = [];
  for (const c of raw.cities) {
    const city = parseCity(c);
    if (!city || seen.has(city.id)) continue;
    seen.add(city.id);
    cities.push(city);
  }
  return {
    version: 1,
    release: str(raw.release) ?? MAPS_RELEASE,
    built: str(raw.built, 40) ?? '',
    attribution: str(raw.attribution, 300) ?? '© OpenStreetMap contributors',
    cities,
  };
}

/** A city's pack format: 1 when the entry predates the `format` field (or carries a junk one). */
export const packFormat = (city: Pick<CityMap, 'format'>): number => city.format ?? 1;

/** Download URL of a city's pack. */
export const packUrl = (city: CityMap) => `${MAPS_BASE_URL}${city.file}`;

/**
 * The relative path a tar entry may be written to, or null for anything else. Only meta.json, pois.json and
 * tiles/<z>/<x>/<y>.png with z in 0..20 and x, y inside that zoom's grid. A leading "./" is tolerated.
 */
export function packEntryPath(name: string): string | null {
  const n = name.startsWith('./') ? name.slice(2) : name;
  if (n === 'meta.json' || n === 'pois.json') return n;
  const m = /^tiles\/(0|[1-9]\d{0,1})\/(0|[1-9]\d{0,6})\/(0|[1-9]\d{0,6})\.png$/.exec(n);
  if (!m) return null;
  const z = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  if (z > MAX_ZOOM) return null;
  const size = 2 ** z;
  return x < size && y < size ? n : null;
}

/** The map region showing the whole city. */
export function regionForCity(city: CityMap): Region {
  const [w, s, e, n] = city.bbox;
  return { latitude: (s + n) / 2, longitude: (w + e) / 2, latitudeDelta: n - s, longitudeDelta: e - w };
}

const area = (b: BBox) => (b[2] - b[0]) * (b[3] - b[1]);

/** The installed city whose bbox holds the point (the smallest one when several overlap), or null. */
export function pickCityFor(lat: number, lon: number, installed: readonly CityMap[]): CityMap | null {
  let best: CityMap | null = null;
  for (const c of installed) {
    if (!bboxContains(c.bbox, lat, lon)) continue;
    if (!best || area(c.bbox) < area(best.bbox)) best = c;
  }
  return best;
}

/** "850 KB", "12 MB", "1.2 GB" (decimal units, as iOS Settings shows storage). */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1000;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  const n = v < 10 && i > 0 ? Math.round(v * 10) / 10 : Math.round(v);
  return `${n} ${units[i]}`;
}

/** The zoom levels a city pack has tiles for. */
export function zoomsOf(city: Pick<CityMap, 'minzoom' | 'maxzoom'>): number[] {
  const out: number[] = [];
  for (let z = city.minzoom; z <= city.maxzoom; z++) out.push(z);
  return out;
}

/** Slippy-map tile column/row of a point at zoom z. */
export function lonToTileX(lon: number, z: number): number {
  const n = 2 ** z;
  return Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
}
export function latToTileY(lat: number, z: number): number {
  const n = 2 ** z;
  const r = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)));
}

/** How many tiles cover the bbox from minzoom to maxzoom. */
export function tileCountEstimate(bbox: BBox, minzoom: number, maxzoom: number): number {
  let total = 0;
  for (let z = minzoom; z <= maxzoom; z++) {
    const xs = lonToTileX(bbox[2], z) - lonToTileX(bbox[0], z) + 1;
    const ys = latToTileY(bbox[1], z) - latToTileY(bbox[3], z) + 1;
    total += xs * ys;
  }
  return total;
}

/** react-native-maps LocalTile wants a plain file path with {z}/{x}/{y}, not a file:// URI. */
export function tilePathTemplate(cityDirUri: string): string {
  let p = cityDirUri.replace(/^file:\/\//, '');
  try {
    p = decodeURI(p);
  } catch {
    // keep it as is
  }
  return `${p.endsWith('/') ? p : `${p}/`}tiles/{z}/{x}/{y}.png`;
}

/** Overall 0..1 progress: downloading is most of the wait, unpacking the rest. */
export function overallProgress(phase: 'download' | 'unpack', fraction: number): number {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return phase === 'download' ? f * 0.75 : 0.75 + f * 0.25;
}
