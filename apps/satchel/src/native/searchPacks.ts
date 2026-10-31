// Search on the Map (T94), device side: the toilets and places in each downloaded city pack's pois.json, read from
// the phone (no network), parsed once per pack and kept in memory. Never throws: an unreadable pack gives nothing.
import * as FileSystem from 'expo-file-system/legacy';
import { parsePackPlaces, type PackPlace } from '../core/mapsearch.ts';
import { parsePackToilets, type Toilet } from '../core/toilets.ts';
import { installedPacks } from './toilets.ts';

export type PackPois = { id: string; city: string; toilets: Toilet[]; places: PackPlace[] };

const cache = new Map<string, PackPois>();

/** Every installed city pack's POIs. */
export async function packPois(): Promise<PackPois[]> {
  try {
    const packs = await installedPacks();
    const out: PackPois[] = [];
    for (const p of packs) {
      let hit = cache.get(p.dir);
      if (!hit) {
        try {
          const json: unknown = JSON.parse(await FileSystem.readAsStringAsync(`${p.dir}pois.json`));
          hit = { id: p.id, city: p.name, toilets: parsePackToilets(json), places: parsePackPlaces(json) };
        } catch {
          hit = { id: p.id, city: p.name, toilets: [], places: [] };
        }
        cache.set(p.dir, hit);
      }
      out.push(hit);
    }
    return out;
  } catch {
    return [];
  }
}

/** Forget parsed packs (after a city is downloaded or deleted). */
export function clearSearchPackCache(): void {
  cache.clear();
}
