// Downloaded places and optional sample places must stay separate, including before the first pack exists.
import type { PoiSet } from './poi.ts';

export const poiSetKey = (set: PoiSet): string => `${set.source}|${set.city}`;

export function availablePoiSets(downloaded: readonly PoiSet[], samples: readonly PoiSet[], showSamples: boolean): PoiSet[] {
  return [...downloaded.filter((set) => !set.sample), ...(showSamples ? samples.filter((set) => set.sample) : [])];
}

export function selectPoiSet(sets: readonly PoiSet[], selectedKey: string | null, visibleCityId?: string): PoiSet | null {
  return sets.find((set) => poiSetKey(set) === selectedKey)
    ?? sets.find((set) => !set.sample && set.source === `pack:${visibleCityId}`)
    ?? sets.find((set) => set.sample)
    ?? null;
}
