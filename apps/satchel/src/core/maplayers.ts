// Map layers + legend (T117, owner-1031 D "deepen Map"). Pure logic for the Layers sheet on the Map tab: the
// registry of pin families the map draws (each with its pin-id prefix, legend icon and colour token), counts per
// family, the visibility filter (hidden families leave the map; where two families put a pin on the same spot the
// higher one in the registry stands in for the other), the bounds and region of the visible pins (crossing the
// antimeridian when that is the shorter way round), the stored choices (kept on this phone) and the trip scope.
// Also the pins for the families the map gained here: ideas with a map spot, way-back pins, saved toilets and
// today's day plan stops. No React Native imports.
import { dayPlan } from './dayplan.ts';
import { ideaSpot, readIdeas, type IdeaCategory } from './ideas.ts';
import type { LocalDate, Trip } from './model.ts';
import { validLatLon, type LatLon, type Region } from './poi.ts';
import { parseSaved } from './toiletplus.ts';
import { parsePins, type WaybackPin } from './wayback.ts';

// ---------------------------------------------------------------------------------------------- registry

/** Pin families, in stand-in order: on a shared spot the earlier family's pin is the one drawn. */
export const MAP_LAYERS = ['route', 'dayplan', 'bookings', 'ideas', 'saved', 'gifts', 'wayback', 'toilets', 'pois'] as const;
export type MapLayerId = (typeof MAP_LAYERS)[number];

/** Theme colour names a layer's pins use (the UI reads theme[tone]); route pins take their day's colour. */
export type LayerTone = 'accent' | 'accentStrong' | 'accentInk' | 'sea' | 'teal' | 'warn' | 'ok' | 'ink' | 'danger';

export type LayerSpec = {
  id: MapLayerId;
  /** Pin ids of this family start with this. */
  prefix: string;
  /** Ionicons glyph for the legend (and the badge on pins that carry one). */
  icon: string;
  tone: LayerTone;
  /** Pins take their day's colour (the legend says so); `tone` is day 1's. */
  byDay?: boolean;
  /** Only drawn while the map shows one trip. */
  tripOnly?: boolean;
  /** Kept on this phone, not on a trip, so the trip scope doesn't narrow it. */
  phone?: boolean;
};

export const LAYER_SPECS: Readonly<Record<MapLayerId, LayerSpec>> = {
  route: { id: 'route', prefix: 'r:', icon: 'trail-sign-outline', tone: 'accentStrong', byDay: true, tripOnly: true },
  dayplan: { id: 'dayplan', prefix: 'd:', icon: 'walk-outline', tone: 'danger' },
  bookings: { id: 'bookings', prefix: 'b:', icon: 'ticket-outline', tone: 'accent' },
  ideas: { id: 'ideas', prefix: 'i:', icon: 'bulb-outline', tone: 'accentInk' },
  saved: { id: 'saved', prefix: 's:', icon: 'bookmark-outline', tone: 'warn' },
  gifts: { id: 'gifts', prefix: 'g:', icon: 'gift-outline', tone: 'teal' },
  wayback: { id: 'wayback', prefix: 'w:', icon: 'flag-outline', tone: 'ink', phone: true },
  toilets: { id: 'toilets', prefix: 't:', icon: 'male-female-outline', tone: 'ok', phone: true },
  pois: { id: 'pois', prefix: 'p:', icon: 'location-outline', tone: 'sea' },
};

const RANK: Readonly<Record<MapLayerId, number>> = Object.fromEntries(MAP_LAYERS.map((id, i) => [id, i])) as Record<MapLayerId, number>;

/** The family a pin id belongs to; null for pins outside the layers (your position, the search pin, a dropped spot). */
export function layerOf(pinId: string): MapLayerId | null {
  for (const id of MAP_LAYERS) if (pinId.startsWith(LAYER_SPECS[id].prefix)) return id;
  return null;
}

// ---------------------------------------------------------------------------------------------- choices

/** Stored on this phone (AsyncStorage) under MAPLAYERS_KEY. */
export const MAPLAYERS_KEY = 'satchel.maplayers.v1';

export type MapScope = 'all' | 'trip';
export type LayerPrefs = { hidden: MapLayerId[]; scope: MapScope };

export const DEFAULT_LAYER_PREFS: LayerPrefs = { hidden: [], scope: 'all' };

const isLayer = (v: unknown): v is MapLayerId => typeof v === 'string' && (MAP_LAYERS as readonly string[]).includes(v);

/** Reads the stored choices defensively: unknown layers are dropped, duplicates kept once, anything else is the default. */
export function parseLayerPrefs(raw: unknown): LayerPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_LAYER_PREFS;
  const r = raw as Record<string, unknown>;
  const hidden = Array.isArray(r.hidden) ? MAP_LAYERS.filter((id) => (r.hidden as unknown[]).includes(id)) : [];
  return { hidden, scope: r.scope === 'trip' ? 'trip' : 'all' };
}

export const isShown = (prefs: LayerPrefs, id: MapLayerId): boolean => !prefs.hidden.includes(id);

/** Shows a hidden layer or hides a shown one (hidden list kept in registry order). */
export function toggleLayer(prefs: LayerPrefs, id: MapLayerId): LayerPrefs {
  const hide = isShown(prefs, id);
  return { ...prefs, hidden: MAP_LAYERS.filter((x) => (x === id ? hide : prefs.hidden.includes(x))) };
}

export const showAllLayers = (prefs: LayerPrefs): LayerPrefs => ({ ...prefs, hidden: [] });
export const withScope = (prefs: LayerPrefs, scope: MapScope): LayerPrefs => ({ ...prefs, scope });

/**
 * The trip the map shows: a ?tripId param wins (ALL_TRIPS 'all' = every trip, chosen there); with no param, the
 * stored "Only this trip" scopes to `tripId` (the trip on now, else the next one), when there is one.
 */
export function startScope(param: string | readonly string[] | null | undefined, prefs: LayerPrefs, tripId: string | null): string | null {
  const v = Array.isArray(param) ? param[0] : param;
  if (typeof v === 'string' && v) return v === 'all' ? null : v;
  return prefs.scope === 'trip' && tripId ? tripId : null;
}

// ---------------------------------------------------------------------------------------------- counts + filter

export type LayerCounts = Record<MapLayerId, number>;

/** How many pins each family has (before hiding or standing in), for the sheet. */
export function layerCounts(pins: readonly { id: string }[]): LayerCounts {
  const out = Object.fromEntries(MAP_LAYERS.map((id) => [id, 0])) as LayerCounts;
  for (const p of pins) {
    const l = layerOf(p.id);
    if (l) out[l] += 1;
  }
  return out;
}

/** About a metre: pins closer than this are one spot. */
export const spotKey = (p: LatLon): string => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;

/**
 * The pins to draw: hidden families left out, and a pin dropped when an earlier family (registry order) has a shown
 * pin on the same spot (so a saved place stands in for its sample point, a route stop for the idea it is). Pins of
 * one family never hide each other; pins outside the layers always show. Order is kept.
 */
export function visiblePins<P extends LatLon & { id: string }>(pins: readonly P[], prefs: LayerPrefs): P[] {
  const shown = pins.filter((p) => {
    const l = layerOf(p.id);
    return !l || isShown(prefs, l);
  });
  const best = new Map<string, number>();
  for (const p of shown) {
    const l = layerOf(p.id);
    if (!l) continue;
    const k = spotKey(p);
    const r = RANK[l];
    if (!best.has(k) || r < (best.get(k) as number)) best.set(k, r);
  }
  return shown.filter((p) => {
    const l = layerOf(p.id);
    return !l || RANK[l] <= (best.get(spotKey(p)) as number);
  });
}

/** How many families are hidden (the Layers button says so). */
export const hiddenCount = (prefs: LayerPrefs): number => prefs.hidden.length;

// ---------------------------------------------------------------------------------------------- bounds

/** West / east are in -180..180; `crosses` when the box runs east over the antimeridian (east < west). */
export type Bounds = { south: number; north: number; west: number; east: number; crosses: boolean };

const wrap = (lon: number) => {
  if (lon >= -180 && lon <= 180) return lon;
  const x = ((((lon + 180) % 360) + 360) % 360) - 180;
  return x === -180 && lon > 0 ? 180 : x;
};

/**
 * The smallest box holding every point: longitudes go the shorter way round, so pins in Fiji and Samoa make a box
 * over the antimeridian rather than one round the whole world. Invalid points are skipped; null for none.
 */
export function boundsOf(points: readonly LatLon[]): Bounds | null {
  const ok = points.filter((p) => validLatLon(p.lat, p.lon));
  if (!ok.length) return null;
  const south = Math.min(...ok.map((p) => p.lat));
  const north = Math.max(...ok.map((p) => p.lat));
  const lons = [...new Set(ok.map((p) => wrap(p.lon)))].sort((a, b) => a - b);
  // The widest empty stretch of longitude is left outside the box; the box starts just east of it.
  let gap = lons[0] + 360 - lons[lons.length - 1];
  let start = 0;
  for (let i = 1; i < lons.length; i++) {
    const g = lons[i] - lons[i - 1];
    if (g > gap) {
      gap = g;
      start = i;
    }
  }
  const west = lons[start];
  const east = lons[(start + lons.length - 1) % lons.length];
  return { south, north, west, east, crosses: east < west };
}

/** Degrees of longitude the box spans (0..360). */
export const lonSpan = (b: Bounds): number => (b.crosses ? b.east + 360 - b.west : b.east - b.west);

/**
 * A map region framing the box with `pad` (1.3 = 30% more) and at least `minDelta` degrees (one pin: about 1 km).
 * The centre longitude is wrapped into -180..180 (east of 180 becomes negative).
 */
export function regionOfBounds(b: Bounds, pad = 1.3, minDelta = 0.01): Region {
  const span = lonSpan(b);
  return {
    latitude: (b.south + b.north) / 2,
    longitude: wrap(b.west + span / 2),
    latitudeDelta: Math.min(180, Math.max(minDelta, (b.north - b.south) * pad)),
    longitudeDelta: Math.min(360, Math.max(minDelta, span * pad)),
  };
}

/** "Fit to visible pins": the region framing them, or null when no pin is shown. */
export function fitRegion(pins: readonly LatLon[]): Region | null {
  const b = boundsOf(pins);
  return b ? regionOfBounds(b) : null;
}

// ---------------------------------------------------------------------------------------------- new families

export type IdeaPin = LatLon & { id: string; tripId: string; ideaId: string; name: string; category: IdeaCategory; done: boolean; tripName: string };

/** Ideas with a map spot on these trips (planned or not); a tap opens the idea. */
export function ideaPins(trips: readonly Pick<Trip, 'id' | 'name' | 'ideas'>[]): IdeaPin[] {
  const out: IdeaPin[] = [];
  for (const trip of trips) {
    for (const i of readIdeas(trip)) {
      const at = ideaSpot(i);
      if (at) out.push({ id: `i:${trip.id}/${i.id}`, tripId: trip.id, ideaId: i.id, name: i.name, category: i.category, done: i.done === true, tripName: trip.name, lat: at.lat, lon: at.lon });
    }
  }
  return out;
}

export type WaybackLayerPin = WaybackPin & { pinId: string };

/** Way-back pins dropped on this phone (stored list, read defensively); a tap opens Find my way back to it. */
export function waybackLayerPins(raw: unknown): WaybackLayerPin[] {
  return parsePins(raw).map((p) => ({ ...p, pinId: p.id, id: `w:${p.id}` }));
}

export type ToiletLayerPin = LatLon & { id: string; toiletId: string; name?: string; note: string };

/** Toilets saved on this phone (Toilets tab); their place only, no lookups. */
export function toiletLayerPins(raw: unknown): ToiletLayerPin[] {
  return parseSaved(raw).map((s) => ({ id: `t:${s.toilet.id}`, toiletId: s.toilet.id, lat: s.toilet.lat, lon: s.toilet.lon, ...(s.toilet.name ? { name: s.toilet.name } : {}), note: s.note }));
}

export type DayPlanPin = LatLon & { id: string; tripId: string; day: LocalDate; n: number; name: string; kind: 'booking' | 'idea' | 'place' };

/** Today's Plan my day stops for the trip on today (numbered in walking order); none outside its dates. */
export function dayPlanPins(trip: Trip | null, today: LocalDate): DayPlanPin[] {
  if (!trip || today < trip.startDate || today > trip.endDate) return [];
  return dayPlan(trip, today).stops.map((s) => ({ id: `d:${trip.id}/${s.key}`, tripId: trip.id, day: today, n: s.n, name: s.name, kind: s.kind, lat: s.lat, lon: s.lon }));
}
