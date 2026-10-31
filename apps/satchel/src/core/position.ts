// T72: a booking's map position (hotel / activity / car hire place, or a journey's from / to), as the booking form
// keeps it. The form stores every field as text (so its "unsaved changes" check stays a plain string compare), so a
// position travels through the draft as "lat,lon" or '' for none. The choices offered by "Pick a saved place" are
// the trip's saved places plus the positions its other bookings already have. Pure TypeScript.
import type { Item, Place, Trip } from './model.ts';
import { savedPlaces } from './places.ts';
import { haversineMeters, regionFor, validLatLon, type LatLon, type Region } from './poi.ts';

/** ~0.1 m, the same rounding as saved places: enough for a pin, and short in the stored JSON. */
export const roundPos = (p: LatLon): LatLon => ({ lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6 });

/** A place's position as draft text ("lat,lon"), or '' when it has none. Exact: a round trip keeps the numbers. */
export function encodePos(p: { lat?: unknown; lon?: unknown } | null | undefined): string {
  return p && validLatLon(p.lat, p.lon) ? `${p.lat},${p.lon}` : '';
}

/** Draft text back to a position; null for '' or anything unreadable or out of range. */
export function decodePos(s: string | null | undefined): LatLon | null {
  if (typeof s !== 'string') return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return validLatLon(lat, lon) ? { lat, lon } : null;
}

/** "35.68120, 139.76710": five decimals (about a metre), shown under the field and spoken. */
export function formatPos(p: LatLon): string {
  return `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
}

/**
 * `base` with the position from draft text: set when `pos` reads, removed (no stale lat / lon kept from an older
 * version of the place) when it is ''.
 */
export function withPos<P extends Place>(base: P, pos: string): P {
  const { lat: _lat, lon: _lon, ...rest } = base;
  const at = decodePos(pos);
  return (at ? { ...rest, lat: at.lat, lon: at.lon } : rest) as P;
}

export type PositionChoice = LatLon & {
  id: string;
  name: string;
  /** Where it comes from: a place saved on the trip, or another booking's place / from / to. */
  source: 'saved' | 'booking';
  /** The booking's title, for a booking choice. */
  booking?: string;
  /** A bundled demo point (kept labelled as sample). */
  sample: boolean;
};

/** Two choices closer than this are the same spot (the saved one wins). */
const SAME_SPOT_M = 10;

/**
 * What "Pick a saved place" lists for a booking: the trip's saved places (name order), then the positions other
 * bookings on the trip already have, skipping a spot already listed. `itemId` is the booking being edited, so its
 * own places are not offered back to it.
 */
export function positionChoices(trip: Trip, itemId?: string): PositionChoice[] {
  const out: PositionChoice[] = [];
  const near = (p: LatLon) => out.some((c) => haversineMeters(c, p) <= SAME_SPOT_M);
  for (const p of [...savedPlaces(trip)].sort((a, b) => a.name.localeCompare(b.name))) {
    if (near(p)) continue;
    out.push({ id: `saved:${p.id}`, name: p.name, lat: p.lat, lon: p.lon, source: 'saved', sample: p.sample === true });
  }
  const items: Item[] = Array.isArray(trip.items) ? trip.items : [];
  for (const it of items) {
    if (it.id === itemId) continue;
    for (const [role, place] of [['place', it.place], ['from', it.from], ['to', it.to]] as const) {
      if (!place || !validLatLon(place.lat, place.lon)) continue;
      const at = { lat: place.lat as number, lon: place.lon as number };
      if (near(at)) continue;
      out.push({ id: `item:${it.id}:${role}`, name: place.name?.trim() || it.title, ...at, source: 'booking', booking: it.title, sample: false });
    }
  }
  return out;
}

/**
 * Where the "Set on the map" picker opens: on the current position, else around the trip's choices (saved places
 * and other bookings), else null (the caller uses its own default).
 */
export function pickerRegion(current: LatLon | null, choices: readonly LatLon[]): Region | null {
  if (current) return { latitude: current.lat, longitude: current.lon, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  return regionFor(choices);
}
