// Find your way back (T73): the maths and lists behind the offline compass screen (app/wayback.tsx). Pure
// TypeScript, no network: the initial great-circle bearing to a target, the arrow's angle relative to where the
// phone points (shortest turn, wraps at 0/360), compass words for the text fallback ("Head north-east"), a rough
// walking time, the GPS-accuracy note, and the pins a traveller drops where they stand ("I parked here", "Meeting
// point", a custom label), which persist on the phone and can be deleted or saved as a trip saved place.
import type { LocalDate, Trip } from './model.ts';
import { newId } from './model.ts';
import { activeTrip, savedPlaces, saveTargets, type PlaceDraft } from './places.ts';
import { haversineMeters, validLatLon, type LatLon } from './poi.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Any finite angle in degrees -> [0, 360). Non-finite -> NaN. */
export function normDeg(d: number): number {
  if (!Number.isFinite(d)) return NaN;
  const n = ((d % 360) + 360) % 360;
  return n >= 360 || Object.is(n, -0) ? 0 : n;
}

/** Below this the two points are "the same place" and there is no direction to show. */
export const SAME_POINT_M = 0.5;
/** Latitudes this close to ±90 count as standing on a pole. */
const POLE_EPS = 1e-9;

/**
 * Initial great-circle bearing from `from` to `to`, degrees clockwise from true north in [0, 360). Null when a
 * position is invalid or the two points are the same. Crossing the antimeridian takes the short way round. Standing
 * on the North Pole every way is south (180); on the South Pole every way is north (0).
 */
export function initialBearing(from: LatLon, to: LatLon): number | null {
  if (!validLatLon(from?.lat, from?.lon) || !validLatLon(to?.lat, to?.lon)) return null;
  if (haversineMeters(from, to) < SAME_POINT_M) return null;
  if (from.lat >= 90 - POLE_EPS) return 180;
  if (from.lat <= -90 + POLE_EPS) return 0;
  const f1 = rad(from.lat);
  const f2 = rad(to.lat);
  const dl = rad(to.lon - from.lon);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  if (Math.abs(y) < 1e-15 && Math.abs(x) < 1e-15) return null;
  return normDeg(deg(Math.atan2(y, x)));
}

/** Straight-line metres between two positions, or null when either is invalid. */
export function distanceTo(from: LatLon, to: LatLon): number | null {
  if (!validLatLon(from?.lat, from?.lon) || !validLatLon(to?.lat, to?.lon)) return null;
  return haversineMeters(from, to);
}

/**
 * Where the arrow points, relative to the top of the phone: the shortest signed turn from `heading` to `bearing`,
 * in (-180, 180]. Positive turns clockwise (right). Null when either angle is unknown.
 */
export function relativeAngle(bearing: number | null, heading: number | null): number | null {
  if (bearing == null || heading == null || !Number.isFinite(bearing) || !Number.isFinite(heading)) return null;
  const d = normDeg(bearing - heading);
  return d > 180 ? d - 360 : d;
}

/**
 * The next value to animate an arrow's rotation to, given the value it is at now (any number of whole turns, never
 * reset) and the new target angle: moves by the shortest turn, so 359° -> 1° turns 2° forwards, not 358° back.
 */
export function nextRotation(current: number, target: number): number {
  if (!Number.isFinite(target)) return Number.isFinite(current) ? current : 0;
  if (!Number.isFinite(current)) return normDeg(target);
  const step = relativeAngle(target, current) ?? 0;
  return current + step;
}

/** Shape of an expo-location heading reading (LocationHeadingObject). */
export type HeadingReading = { trueHeading?: number | null; magHeading?: number | null; accuracy?: number | null };

/**
 * The heading to use: trueHeading when it is known (>= 0), else magHeading, else null (no compass: the screen
 * falls back to words). iOS reports -1 for a heading it can't work out.
 */
export function pickHeading(h: HeadingReading | null | undefined): number | null {
  if (!h) return null;
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (ok(h.trueHeading)) return normDeg(h.trueHeading);
  if (ok(h.magHeading)) return normDeg(h.magHeading);
  return null;
}

/**
 * expo-location's heading accuracy is a calibration level: 3 high, 2 medium, 1 low, 0 none. At 1 or 0 the screen
 * suggests moving the phone in a figure of eight.
 */
export const needsCalibration = (h: HeadingReading | null | undefined): boolean =>
  !!h && typeof h.accuracy === 'number' && Number.isFinite(h.accuracy) && h.accuracy <= 1 && pickHeading(h) != null;

export const COMPASS_8 = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export const COMPASS_16 = ['n', 'nne', 'ne', 'ene', 'e', 'ese', 'se', 'sse', 's', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw'] as const;
export type Compass16 = (typeof COMPASS_16)[number];

/** Compass point for a bearing, each sector centred on its direction (8 points: 45° wide; 16 points: 22.5°). */
export function cardinal(bearing: number, points: 8 | 16 = 8): Compass16 | null {
  const b = normDeg(bearing);
  if (Number.isNaN(b)) return null;
  const list: readonly Compass16[] = points === 16 ? COMPASS_16 : COMPASS_8;
  return list[Math.round(b / (360 / list.length)) % list.length];
}

/** Catalogue key for a compass point, e.g. 'wayback.dir.ne' ("north-east"). */
export const cardinalKey = (c: Compass16): `wayback.dir.${Compass16}` => `wayback.dir.${c}`;

/** Steady walking pace (km/h) and how much longer than a straight line a street walk usually is. */
export const WALK_KMH = 4.8;
export const DETOUR = 1.3;

/**
 * Rough walking time for a straight-line distance: streets add about 30 %. Whole minutes, at least 1; null for a
 * distance that isn't a number. Split into hours and minutes for long ones.
 */
export function walkTime(meters: number | null): { minutes: number; h: number; m: number } | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  const minutes = Math.max(1, Math.round((meters * DETOUR) / ((WALK_KMH * 1000) / 60)));
  return { minutes, h: Math.floor(minutes / 60), m: minutes % 60 };
}

/** Beyond this the arrow is too far off to trust. Typical outdoor iPhone fixes are 5-20 m. */
export const POOR_ACCURACY_M = 50;
/** Closer than this (or inside the GPS uncertainty) you're there. */
export const ARRIVED_M = 20;

export type AccuracyNote = 'none' | 'poor' | 'unknown';

/** Whether to warn that the position is rough. Unknown accuracy only warns once we have a position. */
export function accuracyNote(accuracyM: number | null | undefined): AccuracyNote {
  if (accuracyM == null) return 'unknown';
  if (!Number.isFinite(accuracyM) || accuracyM < 0) return 'unknown';
  return accuracyM > POOR_ACCURACY_M ? 'poor' : 'none';
}

/** True when you're as close as GPS can tell: within ARRIVED_M, or within the fix's own uncertainty (up to 60 m). */
export function arrived(meters: number | null, accuracyM?: number | null): boolean {
  if (meters == null || !Number.isFinite(meters)) return false;
  const acc = typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM > 0 ? Math.min(accuracyM, 60) : 0;
  return meters <= Math.max(ARRIVED_M, acc);
}

// ------------------------------------------------------------------------------------------------- dropped pins

/** AsyncStorage key for the dropped pins (a WaybackPin[] read back through parsePins). Phone only. */
export const WAYBACK_PINS_KEY = 'satchel.wayback.pins.v1';

export type PinPreset = 'parked' | 'meeting' | 'custom';
export const PIN_PRESETS: readonly PinPreset[] = ['parked', 'meeting', 'custom'];
export const PIN_LABEL_MAX = 60;
/** The phone keeps at most this many pins; dropping another removes the oldest. */
export const PINS_MAX = 30;

export type WaybackPin = LatLon & {
  id: string;
  preset: PinPreset;
  /** The custom label (preset 'custom'); presets show their translated name. */
  label?: string;
  /** GPS uncertainty in metres when it was dropped, if known. */
  accuracy?: number;
  droppedAt: string;
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const cleanLabel = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, PIN_LABEL_MAX).trim() : '');
const isPreset = (v: unknown): v is PinPreset => typeof v === 'string' && (PIN_PRESETS as readonly string[]).includes(v);

/** Reads the stored pin list defensively: malformed rows are skipped, duplicates by id keep the first. Newest first. */
export function parsePins(raw: unknown): WaybackPin[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: WaybackPin[] = [];
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id || seen.has(o.id) || !validLatLon(o.lat, o.lon)) continue;
    const preset: PinPreset = isPreset(o.preset) ? o.preset : 'custom';
    const label = cleanLabel(o.label);
    if (preset === 'custom' && !label) continue;
    seen.add(o.id);
    const pin: WaybackPin = { id: o.id, preset, lat: o.lat as number, lon: o.lon as number, droppedAt: typeof o.droppedAt === 'string' ? o.droppedAt : '' };
    if (label) pin.label = label;
    if (typeof o.accuracy === 'number' && Number.isFinite(o.accuracy) && o.accuracy >= 0) pin.accuracy = o.accuracy;
    out.push(pin);
  }
  return sortPins(out);
}

const sortPins = (pins: WaybackPin[]) => [...pins].sort((a, b) => (a.droppedAt < b.droppedAt ? 1 : a.droppedAt > b.droppedAt ? -1 : 0));

export type PinDraft = { preset: PinPreset; label?: string; lat: number; lon: number; accuracy?: number | null };
export type PinError = 'label' | 'position';

export function validatePin(d: PinDraft): PinError[] {
  const e: PinError[] = [];
  if (d.preset === 'custom' && !cleanLabel(d.label)) e.push('label');
  if (!validLatLon(d.lat, d.lon)) e.push('position');
  return e;
}

export type DropResult = { ok: true; pins: WaybackPin[]; pin: WaybackPin } | { ok: false; errors: PinError[] };

/** Adds a pin at the top of the list (newest first), keeping at most PINS_MAX. */
export function dropPin(list: readonly WaybackPin[], d: PinDraft, now = new Date().toISOString(), id = newId('pin')): DropResult {
  const errors = validatePin(d);
  if (errors.length) return { ok: false, errors };
  const pin: WaybackPin = { id, preset: d.preset, lat: round6(d.lat), lon: round6(d.lon), droppedAt: now };
  const label = cleanLabel(d.label);
  if (label) pin.label = label;
  if (typeof d.accuracy === 'number' && Number.isFinite(d.accuracy) && d.accuracy >= 0) pin.accuracy = Math.round(d.accuracy);
  const rest = parsePins(list).filter((p) => p.id !== id);
  return { ok: true, pin, pins: [pin, ...rest].slice(0, PINS_MAX) };
}

/** The list without that pin (an unchanged copy if it isn't there). */
export function removePin(list: readonly WaybackPin[], id: string): WaybackPin[] {
  return parsePins(list).filter((p) => p.id !== id);
}

/** Renames a pin (it becomes a custom one). Unchanged when the label is empty or the pin is missing. */
export function renamePin(list: readonly WaybackPin[], id: string, label: string): WaybackPin[] {
  const l = cleanLabel(label);
  const pins = parsePins(list);
  if (!l) return pins;
  return pins.map((p) => (p.id === id ? { ...p, preset: 'custom', label: l } : p));
}

/** The name a pin is shown with: its custom label, or the preset's catalogue key for the UI to translate. */
export function pinName(pin: WaybackPin): { text: string } | { key: `wayback.preset.${PinPreset}` } {
  if (pin.label) return { text: pin.label };
  return { key: `wayback.preset.${pin.preset}` };
}

/** The saved-place draft for keeping a pin with a trip (places.addPlace), named with what the UI shows. */
export function pinToPlace(pin: WaybackPin, name: string): PlaceDraft {
  return { name: cleanLabel(name) || cleanLabel(pin.label), lat: pin.lat, lon: pin.lon };
}

// ------------------------------------------------------------------------------------------------------ targets

export type TargetKind = 'hotel' | 'place' | 'pin';
export type Target = LatLon & { key: string; kind: TargetKind; name: string; tripName?: string };

export const hotelKey = (itemId: string) => `hotel:${itemId}`;
export const placeKey = (tripId: string, placeId: string) => `place:${tripId}:${placeId}`;
export const pinKey = (pinId: string) => `pin:${pinId}`;

const dateOf = (local: string | undefined) => (local ?? '').slice(0, 10);

/** The trip the screen offers targets from: the one on today, else the next one, else the latest past one. */
export function focusTrip(trips: readonly Trip[], today: LocalDate): Trip | null {
  return activeTrip(trips, today) ?? saveTargets(trips, today)[0] ?? null;
}

/** A trip's hotels with a map position, the stay covering today first, then by check-in date. */
export function hotelTargets(trip: Trip, today: LocalDate): Target[] {
  const stays = (Array.isArray(trip.items) ? trip.items : [])
    .filter((i) => i.kind === 'hotel' && !!i.place && validLatLon(i.place.lat, i.place.lon))
    .map((i) => ({
      from: dateOf(i.start?.local),
      to: dateOf(i.end?.local) || dateOf(i.start?.local),
      t: { key: hotelKey(i.id), kind: 'hotel' as const, name: i.place?.name?.trim() || i.title, lat: i.place?.lat as number, lon: i.place?.lon as number, tripName: trip.name },
    }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const now = stays.filter((s) => s.from <= today && today <= s.to);
  return [...now, ...stays.filter((s) => !now.includes(s))].map((s) => s.t);
}

export function placeTargets(trip: Trip): Target[] {
  return savedPlaces(trip)
    .map((p) => ({ key: placeKey(trip.id, p.id), kind: 'place' as const, name: p.name, lat: p.lat, lon: p.lon, tripName: trip.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Everything the screen offers: the focus trip's hotels, then its saved places, then your pins (newest first). */
export function waybackTargets(trips: readonly Trip[], today: LocalDate, pins: readonly WaybackPin[], pinLabel: (p: WaybackPin) => string): Target[] {
  const trip = focusTrip(trips, today);
  const fromTrip = trip ? [...hotelTargets(trip, today), ...placeTargets(trip)] : [];
  const fromPins = parsePins(pins).map((p) => ({ key: pinKey(p.id), kind: 'pin' as const, name: pinLabel(p), lat: p.lat, lon: p.lon }));
  return [...fromTrip, ...fromPins];
}

/** Finds a target by key in any trip (the address card opens the screen for its own hotel), or null. */
export function resolveTarget(key: string | null | undefined, trips: readonly Trip[], pins: readonly WaybackPin[], pinLabel: (p: WaybackPin) => string): Target | null {
  if (typeof key !== 'string' || !key) return null;
  const [kind, a, b] = key.split(':');
  if (kind === 'hotel' && a) {
    for (const trip of trips) {
      const item = (Array.isArray(trip.items) ? trip.items : []).find((i) => i.id === a);
      if (item?.place && validLatLon(item.place.lat, item.place.lon)) {
        return { key, kind: 'hotel', name: item.place.name?.trim() || item.title, lat: item.place.lat as number, lon: item.place.lon as number, tripName: trip.name };
      }
    }
    return null;
  }
  if (kind === 'place' && a && b) {
    const trip = trips.find((t) => t.id === a);
    const p = trip ? savedPlaces(trip).find((x) => x.id === b) : undefined;
    return trip && p ? { key, kind: 'place', name: p.name, lat: p.lat, lon: p.lon, tripName: trip.name } : null;
  }
  if (kind === 'pin' && a) {
    const p = parsePins(pins).find((x) => x.id === a);
    return p ? { key, kind: 'pin', name: pinLabel(p), lat: p.lat, lon: p.lon } : null;
  }
  return null;
}

/** True when a booking's place can be found again: the address card shows "Find my way back" only then. */
export const canFindWayBack = (place: { lat?: number; lon?: number } | null | undefined): boolean => !!place && validLatLon(place.lat, place.lon);
