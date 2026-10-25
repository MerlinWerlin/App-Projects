// Saved places on a trip (T29, docs/spec/FLOWS.md §11.1-11.2): add from the map (a sample point, a booking-free
// spot the user tapped), remove with a confirm, and the pins the map shows for them. Pure TypeScript; the UI saves
// the returned trip through the trips store. Saving the same spot twice updates it instead of duplicating it.
import type { LocalDate, SavedPlace, Trip } from './model.ts';
import { newId } from './model.ts';
import { haversineMeters, validLatLon, type LatLon } from './poi.ts';

export const PLACE_NAME_MAX = 80;
/** Two saves closer than this are the same spot. */
export const SAME_SPOT_M = 10;

export type PlaceDraft = { name: string; lat: number; lon: number; category?: string; sample?: boolean; address?: string };
export type PlaceError = 'name' | 'position';

const cleanName = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, PLACE_NAME_MAX).trim();
/** ~0.1 m; enough for a pin, and keeps stored JSON short. */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function validatePlace(d: Pick<PlaceDraft, 'name' | 'lat' | 'lon'>): PlaceError[] {
  const e: PlaceError[] = [];
  if (!cleanName(typeof d.name === 'string' ? d.name : '')) e.push('name');
  if (!validLatLon(d.lat, d.lon)) e.push('position');
  return e;
}

const isSaved = (p: unknown): p is SavedPlace => {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.name === 'string' && !!o.name.trim() && validLatLon(o.lat, o.lon);
};

/** The trip's saved places; malformed stored rows are skipped. */
export function savedPlaces(trip: Trip): SavedPlace[] {
  return Array.isArray(trip.places) ? trip.places.filter(isSaved) : [];
}

/** The saved place at (or within SAME_SPOT_M of) a position, or null. */
export function findSaved(trip: Trip, at: LatLon): SavedPlace | null {
  return savedPlaces(trip).find((p) => haversineMeters(p, at) <= SAME_SPOT_M) ?? null;
}

export type AddResult = { ok: true; trip: Trip; place: SavedPlace; updated: boolean } | { ok: false; errors: PlaceError[] };

/** Saves a place on the trip. A save at an already saved spot renames/updates that place and keeps its id. */
export function addPlace(trip: Trip, d: PlaceDraft, now = new Date().toISOString(), id = newId('place')): AddResult {
  const errors = validatePlace(d);
  if (errors.length) return { ok: false, errors };
  const at = { lat: round(d.lat), lon: round(d.lon) };
  const existing = findSaved(trip, at);
  const place: SavedPlace = {
    id: existing?.id ?? id,
    name: cleanName(d.name),
    lat: existing?.lat ?? at.lat,
    lon: existing?.lon ?? at.lon,
    savedAt: existing?.savedAt ?? now,
  };
  const category = d.category?.trim() || existing?.category;
  if (category) place.category = category;
  if (d.sample ?? existing?.sample) place.sample = true;
  const address = d.address?.trim() || existing?.address;
  if (address) place.address = address;
  const list = savedPlaces(trip);
  const places = existing ? list.map((p) => (p.id === existing.id ? place : p)) : [...list, place];
  return { ok: true, trip: { ...trip, places }, place, updated: !!existing };
}

/** The trip without that saved place (unchanged copy if it isn't there). */
export function removePlace(trip: Trip, placeId: string): Trip {
  return { ...trip, places: savedPlaces(trip).filter((p) => p.id !== placeId) };
}

const byStart = (a: Trip, b: Trip) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0);

/** The trip on today (the earliest-starting if several overlap), or null: then the user picks one. */
export function activeTrip(trips: readonly Trip[], today: LocalDate): Trip | null {
  return [...trips].filter((t) => t.startDate <= today && today <= t.endDate).sort(byStart)[0] ?? null;
}

/** Trips offered in the "Save to" picker: not-yet-ended trips by start date, then past trips, most recent first. */
export function saveTargets(trips: readonly Trip[], today: LocalDate): Trip[] {
  const live = trips.filter((t) => t.endDate >= today).sort(byStart);
  const past = trips.filter((t) => t.endDate < today).sort((a, b) => byStart(b, a));
  return [...live, ...past];
}

/**
 * The trips the map shows: just one when it was opened as that trip's "Trip map", otherwise all of them. An id
 * that no longer matches a trip (the trip was deleted) falls back to all trips; `scoped` says which happened.
 */
/** The map's ?tripId value for "every trip" (set by Show all trips, so the scope never depends on a param clearing). */
export const ALL_TRIPS = 'all';

/** The trip the map is scoped to from its ?tripId param: none for a missing, empty or ALL_TRIPS value. */
export function scopeParam(raw: string | readonly string[] | null | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && v && v !== ALL_TRIPS ? v : null;
}

export function scopeTrips<T extends { id: string }>(trips: readonly T[], tripId: string | null | undefined): { trips: readonly T[]; scoped: T | null } {
  const one = tripId ? trips.find((t) => t.id === tripId) : undefined;
  return one ? { trips: [one], scoped: one } : { trips, scoped: null };
}

/** A trip's saved places in name order, for the list on its timeline. */
export function placesByName(trip: Trip): SavedPlace[] {
  return [...savedPlaces(trip)].sort((a, b) => a.name.localeCompare(b.name));
}

export type SavedPin =LatLon & { id: string; tripId: string; tripName: string; placeId: string; name: string; category?: string; sample: boolean };

/** One map pin per saved place across all trips. */
export function savedPins(trips: readonly Trip[]): SavedPin[] {
  return trips.flatMap((trip) =>
    savedPlaces(trip).map((p) => ({
      id: `${trip.id}:${p.id}`,
      tripId: trip.id,
      tripName: trip.name,
      placeId: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      ...(p.category ? { category: p.category } : {}),
      sample: p.sample === true,
    })),
  );
}
