// T13 offline POI layers, device side: the points of interest in a downloaded city's pois.json (shipped inside the
// city pack, unpacked to <documents>/maps/<id>/pois.json by src/native/cityMaps.ts), read from the phone with no
// network, parsed once per city (src/core/packpois.ts) and kept in memory until the installed maps change. Never
// throws: a missing, oversized or unreadable file gives no points.
import * as FileSystem from 'expo-file-system/legacy';
import type { CityMap } from '../core/citymaps.ts';
import { parsePackPoiFile, POI_PACK_MAX_CHARS, type PackPoi } from '../core/packpois.ts';
import { cityMapsChanged } from '../core/signal.ts';
import { cityDir } from './cityMaps.ts';

export type CityPois = { city: CityMap; pois: PackPoi[]; truncated: boolean };

const cache = new Map<string, CityPois>();
cityMapsChanged.subscribe(() => cache.clear());

async function readCity(city: CityMap): Promise<CityPois> {
  const empty: CityPois = { city, pois: [], truncated: false };
  const dir = cityDir(city.id);
  if (!dir) return empty;
  try {
    const uri = `${dir}pois.json`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || (typeof info.size === 'number' && info.size > POI_PACK_MAX_CHARS * 4)) return empty;
    const r = parsePackPoiFile(await FileSystem.readAsStringAsync(uri));
    return r.ok ? { city, pois: r.pois, truncated: r.truncated } : empty;
  } catch {
    return empty;
  }
}

/** The POIs of each installed city (in the order given). */
export async function loadCityPois(installed: readonly CityMap[]): Promise<CityPois[]> {
  const out: CityPois[] = [];
  for (const city of installed) {
    let hit = cache.get(city.id);
    if (!hit) {
      hit = await readCity(city);
      cache.set(city.id, hit);
    }
    out.push(hit);
  }
  return out;
}
