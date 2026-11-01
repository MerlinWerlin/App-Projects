// Types for tools/maps/pois.mjs, so the app's strict typecheck can read the fixture test (src/core/mappack.test.ts).
export declare const POIS_FORMAT: number;
export declare const POIS_ATTRIBUTION: string;
export declare const POI_TAGS: Record<string, [string, string][]>;
export declare const HELP_POI_CATEGORIES: string[];
export declare const TOILET_KEYS: string[];

export type OverpassElement = {
  type: string;
  id: number | string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type PackPlace = {
  id: string;
  lat: number;
  lon: number;
  category: string;
  name?: string;
  amenity?: string;
  phone?: string;
  opening_hours?: string;
  emergency?: string;
  /** T156: the OSM wheelchair tag, when the place has one. */
  wheelchair?: string;
};

export type PackToilet = { id: string; lat: number; lon: number } & Record<string, string | number>;

export type PoisFile = { format: number; built: string; attribution: string; toilets: PackToilet[]; places: PackPlace[] };

export declare function overpassQuery(bbox: [number, number, number, number]): string;
export declare function toPois(elements: readonly OverpassElement[] | unknown, built: string): PoisFile;
