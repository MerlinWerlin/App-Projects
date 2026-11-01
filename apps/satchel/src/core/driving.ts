// T122 Driving abroad + rental car. Pure TypeScript (no React Native); the guide table (src/content/driving.json)
// is passed in.
//
// 1) Driving guide per country (the customs-guide countries): side of the road, speed unit (km/h or mph), whether an
//    International Driving Permit is often asked for (general guidance for a short visit with an English-language
//    licence; null when the build was not sure), seat-belt / child-seat and phone-use notes, fuel words in the local
//    language, a toll / vignette note and one short extra note. GENERAL GUIDANCE ONLY, never legal advice, always
//    shown with "verify locally"; every row has https sources, a checked date and recheck: true where less certain.
// 2) Car bookings (kind 'car'): the countries a car booking is in (pick-up and drop-off zones), and the
//    "Drive on the LEFT / RIGHT" banner for a trip.
// 3) Rental car checklist, kept on this phone only (one AsyncStorage key per booking, rentalKey; never part of a
//    .satchel trip file: the Item model has no rental fields and tripfile.ts never reads these keys, guard test in
//    driving.test.ts): pick-up photos of every side, fuel level and odometer at pick-up and return, rental desk
//    phone, excess / insurance notes and the traveller's time to the return desk for the leave-by line.
// 4) km <-> mi conversion for speed limits and the distance driven.
import { sourceHosts } from './customs.ts';
import { countryForZone, fold } from './emergency.ts';
import type { Item, LocalDateTime, Trip } from './model.ts';
import { sortItems, zonesReadable } from './timeline.ts';
import { fromUtc, isLocalDateTime, isValidZone, toUtc } from './tz.ts';

export { sourceHosts };

export const DRIVING_CHECKED = '2026-11-01';

export const SIDES = ['left', 'right'] as const;
export type Side = (typeof SIDES)[number];
export const SPEED_UNITS = ['kmh', 'mph'] as const;
export type SpeedUnit = (typeof SPEED_UNITS)[number];
/** often: often asked for; not_usually: usually not needed for a short visit with an English-language licence; not_accepted: a foreign licence / IDP is not accepted. */
export const IDP_VALUES = ['often', 'not_usually', 'not_accepted'] as const;
export type Idp = (typeof IDP_VALUES)[number];

export type FuelWords = { petrol: string; diesel: string };

export type DrivingRow = {
  iso2: string;
  country: string;
  side: Side;
  speed: SpeedUnit;
  /** Null when the build was not sure. */
  idp: Idp | null;
  seatbelts: string | null;
  phone: string | null;
  fuel: FuelWords | null;
  tolls: string | null;
  note: string | null;
  sources: string[];
  /** ISO YYYY-MM-DD. */
  checked: string;
  recheck: boolean;
};

export type DrivingTable = { version: number; checked?: string; rule: string; countries: DrivingRow[] };

const ISO2 = /^[A-Z]{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const norm = (iso2: string | null | undefined) => (typeof iso2 === 'string' ? iso2.trim().toUpperCase() : '');
const clean = (s: unknown): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);

export function findDriving(table: DrivingTable, iso2: string | null | undefined): DrivingRow | null {
  const code = norm(iso2);
  if (!ISO2.test(code)) return null;
  return table.countries.find((r) => r.iso2 === code) ?? null;
}

export const hasDriving = (table: DrivingTable, iso2: string | null | undefined): boolean => findDriving(table, iso2) !== null;

/** Covered countries matching a name or ISO code (accents and case ignored), name order. Empty query: all. */
export function searchDriving(table: DrivingTable, query: string): DrivingRow[] {
  const q = fold(query ?? '').trim();
  const all = [...table.countries].sort((a, b) => a.country.localeCompare(b.country));
  if (!q) return all;
  const starts = all.filter((r) => fold(r.country).startsWith(q) || r.iso2.toLowerCase() === q);
  const rest = all.filter((r) => !starts.includes(r) && fold(r.country).includes(q));
  return [...starts, ...rest];
}

/** What a row is missing or has wrong (for the content test). Empty: the row is good. */
export function rowProblems(r: DrivingRow): string[] {
  const out: string[] = [];
  if (!ISO2.test(r.iso2 ?? '')) out.push('iso2');
  if (!clean(r.country)) out.push('country');
  if (!(SIDES as readonly string[]).includes(r.side)) out.push('side');
  if (!(SPEED_UNITS as readonly string[]).includes(r.speed)) out.push('speed');
  if (r.idp !== null && !(IDP_VALUES as readonly string[]).includes(r.idp)) out.push('idp');
  for (const k of ['seatbelts', 'phone', 'tolls', 'note'] as const) if (r[k] !== null && !clean(r[k])) out.push(k);
  if (r.fuel !== null && (!r.fuel || !clean(r.fuel.petrol) || !clean(r.fuel.diesel))) out.push('fuel');
  if (!Array.isArray(r.sources) || !r.sources.length || r.sources.some((u) => !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/.test(u))) out.push('sources');
  if (!ISO_DATE.test(r.checked ?? '')) out.push('checked');
  if (typeof r.recheck !== 'boolean') out.push('recheck');
  return out;
}

export const GUIDE_SECTIONS = ['idp', 'seatbelts', 'phone', 'fuel', 'tolls', 'note'] as const;
export type GuideSection = (typeof GUIDE_SECTIONS)[number];

/** The guide's sections in screen order, known ones first, the ones the build was not sure about (null) last. */
export function guideSections(row: DrivingRow): { id: GuideSection; known: boolean }[] {
  const all = GUIDE_SECTIONS.filter((id) => id !== 'note' || !!clean(row.note)).map((id) => ({ id, known: row[id] !== null }));
  return [...all.filter((s) => s.known), ...all.filter((s) => !s.known)];
}

// ------------------------------------------------------------------ units

export const KM_PER_MI = 1.609344;

export const kmToMi = (km: number): number => km / KM_PER_MI;
export const miToKm = (mi: number): number => mi * KM_PER_MI;

/** A speed or distance in the other unit, rounded to a whole number (null for anything not a finite number >= 0). */
export function convertWhole(value: number, from: 'km' | 'mi' | SpeedUnit): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const km = from === 'km' || from === 'kmh';
  return Math.round(km ? kmToMi(value) : miToKm(value));
}

/** Common limits in the country's own unit, each with the other unit: "50 km/h is about 31 mph". */
export const COMMON_LIMITS: Record<SpeedUnit, readonly number[]> = { kmh: [30, 50, 80, 100, 120, 130], mph: [20, 30, 40, 50, 60, 70] };

export function limitPairs(unit: SpeedUnit): { value: number; other: number }[] {
  return COMMON_LIMITS[unit].map((value) => ({ value, other: convertWhole(value, unit) ?? 0 }));
}

// ------------------------------------------------------------------ car bookings

export const isCarBooking = (item: Pick<Item, 'kind'>): boolean => item.kind === 'car';

/** The countries a car booking is in: the pick-up zone's country, then the drop-off's when different. */
export function carCountries(item: Pick<Item, 'kind' | 'start' | 'end'>): string[] {
  if (!isCarBooking(item)) return [];
  const out: string[] = [];
  for (const s of [item.start, item.end]) {
    if (!s || !isValidZone(s.tz)) continue;
    const iso = countryForZone(s.tz);
    if (iso && !out.includes(iso)) out.push(iso);
  }
  return out;
}

export type DrivingBanner = { iso2: string; country: string; side: Side; speed: SpeedUnit; itemIds: string[] };

/**
 * One banner per country the trip has a car booking in (in booking order) that the guide covers. The home country
 * (when given) is left out: you know which side you drive on at home.
 */
export function tripDrivingBanners(trip: Pick<Trip, 'items'>, table: DrivingTable, home: string | null = null): DrivingBanner[] {
  const out: DrivingBanner[] = [];
  const homeIso = norm(home);
  for (const item of sortItems(trip.items)) {
    if (!isCarBooking(item)) continue;
    for (const iso of carCountries(item)) {
      if (iso === homeIso) continue;
      const row = findDriving(table, iso);
      if (!row) continue;
      const hit = out.find((b) => b.iso2 === iso);
      if (hit) {
        if (!hit.itemIds.includes(item.id)) hit.itemIds.push(item.id);
      } else out.push({ iso2: iso, country: row.country, side: row.side, speed: row.speed, itemIds: [item.id] });
    }
  }
  return out;
}

/** The side shown on the trip card: one side when every banner agrees, 'mixed' when the trip needs both. */
export function cardSide(banners: readonly DrivingBanner[]): Side | 'mixed' | null {
  if (!banners.length) return null;
  return banners.every((b) => b.side === banners[0].side) ? banners[0].side : 'mixed';
}

// ------------------------------------------------------------------ rental checklist (phone only)

const RENTAL_PREFIX = 'satchel.rental.v1.';

/** The phone-only storage key for one car booking's checklist. */
export const rentalKey = (itemId: string): string => `${RENTAL_PREFIX}${itemId}`;
export const isRentalKey = (key: string): boolean => key.startsWith(RENTAL_PREFIX) && key.length > RENTAL_PREFIX.length;

export const PHOTO_SIDES = ['front', 'rear', 'left', 'right'] as const;
export type PhotoSide = (typeof PHOTO_SIDES)[number];
export type RentalPhoto = { uri: string; mime: string; takenAt: string };

/** Fuel in eighths of a tank: 0 empty ... 8 full. */
export const FUEL_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export const ODO_UNITS = ['km', 'mi'] as const;
export type OdoUnit = (typeof ODO_UNITS)[number];

export type Reading = { fuel: number | null; odo: number | null };
export const STAGES = ['pickup', 'return'] as const;
export type Stage = (typeof STAGES)[number];

export type RentalChecklist = {
  photos: Record<PhotoSide, RentalPhoto | null>;
  pickup: Reading;
  return: Reading;
  odoUnit: OdoUnit;
  deskPhone: string;
  excess: string;
  insurance: string;
  /** Minutes from where you'll be to the return desk (null: not set, no leave-by time yet). */
  travelMin: number | null;
};

export const RENTAL_LIMITS = { phone: 40, note: 600, odo: 9_999_999, travel: 300, uri: 1000 } as const;
export const TRAVEL_STEP = 5;
/** Time kept back for refuelling and handing the car back, before the drop-off time (general guidance). */
export const RETURN_BUFFER_MIN = 15;

const NO_READING: Reading = { fuel: null, odo: null };

export const EMPTY_RENTAL: RentalChecklist = {
  photos: { front: null, rear: null, left: null, right: null },
  pickup: NO_READING,
  return: NO_READING,
  odoUnit: 'km',
  deskPhone: '',
  excess: '',
  insurance: '',
  travelMin: null,
};

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanPhoto(v: unknown): RentalPhoto | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const p = v as Record<string, unknown>;
  const uri = str(p.uri, RENTAL_LIMITS.uri);
  if (!uri) return null;
  return { uri, mime: str(p.mime, 60) || 'image/jpeg', takenAt: str(p.takenAt, 40) };
}

function cleanFuel(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 8 ? v : null;
}

/** Odometer: a whole number 0..9,999,999 (a typed "12,345" or "12 345" is read too). */
export function parseOdo(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= RENTAL_LIMITS.odo ? v : null;
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\s,.'’]/g, '');
  if (!/^\d{1,7}$/.test(t)) return null;
  return Number(t);
}

function cleanReading(v: unknown): Reading {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...NO_READING };
  const r = v as Record<string, unknown>;
  return { fuel: cleanFuel(r.fuel), odo: parseOdo(r.odo) };
}

/** Stored value -> RentalChecklist. Anything missing, damaged or too long is dropped or cut, never thrown on. */
export function cleanRental(raw: unknown): RentalChecklist {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_RENTAL, photos: { ...EMPTY_RENTAL.photos } };
  const r = raw as Record<string, unknown>;
  const ph = r.photos && typeof r.photos === 'object' && !Array.isArray(r.photos) ? (r.photos as Record<string, unknown>) : {};
  const travel = typeof r.travelMin === 'number' && Number.isInteger(r.travelMin) && r.travelMin >= 0 && r.travelMin <= RENTAL_LIMITS.travel ? r.travelMin : null;
  return {
    photos: { front: cleanPhoto(ph.front), rear: cleanPhoto(ph.rear), left: cleanPhoto(ph.left), right: cleanPhoto(ph.right) },
    pickup: cleanReading(r.pickup),
    return: cleanReading(r.return),
    odoUnit: r.odoUnit === 'mi' ? 'mi' : 'km',
    deskPhone: str(r.deskPhone, RENTAL_LIMITS.phone),
    excess: str(r.excess, RENTAL_LIMITS.note),
    insurance: str(r.insurance, RENTAL_LIMITS.note),
    travelMin: travel,
  };
}

export const photoCount = (c: RentalChecklist): number => PHOTO_SIDES.filter((s) => !!c.photos[s]).length;
export const photoUris = (c: RentalChecklist): string[] => PHOTO_SIDES.map((s) => c.photos[s]?.uri ?? '').filter(Boolean);

export function isEmptyRental(c: RentalChecklist): boolean {
  return (
    photoCount(c) === 0 &&
    STAGES.every((s) => c[s].fuel === null && c[s].odo === null) &&
    !c.deskPhone &&
    !c.excess &&
    !c.insurance &&
    c.travelMin === null
  );
}

/** Sets one side's photo. `replaced` is the earlier photo's file (the caller deletes it once the save worked). */
export function withPhoto(c: RentalChecklist, side: PhotoSide, photo: RentalPhoto | null): { next: RentalChecklist; replaced: string | null } {
  const old = c.photos[side]?.uri ?? null;
  return { next: { ...c, photos: { ...c.photos, [side]: photo } }, replaced: old && old !== photo?.uri ? old : null };
}

export function withReading(c: RentalChecklist, stage: Stage, patch: Partial<Reading>): RentalChecklist {
  const next = { ...c[stage], ...patch };
  return { ...c, [stage]: { fuel: cleanFuel(next.fuel), odo: parseOdo(next.odo) } };
}

export const CHECK_STEPS = ['photo_front', 'photo_rear', 'photo_left', 'photo_right', 'pickup_fuel', 'pickup_odo', 'return_fuel', 'return_odo'] as const;
export type CheckStep = (typeof CHECK_STEPS)[number];

/** The checklist ticks: one per photo side and per reading. */
export function checklistSteps(c: RentalChecklist): { id: CheckStep; done: boolean }[] {
  return CHECK_STEPS.map((id) => {
    if (id.startsWith('photo_')) return { id, done: !!c.photos[id.slice(6) as PhotoSide] };
    const [stage, field] = id.split('_') as [Stage, 'fuel' | 'odo'];
    return { id, done: c[stage][field] !== null };
  });
}

export function checklistProgress(c: RentalChecklist): { done: number; total: number; pickupDone: boolean } {
  const steps = checklistSteps(c);
  const pickupDone = steps.filter((s) => !s.id.startsWith('return_')).every((s) => s.done);
  return { done: steps.filter((s) => s.done).length, total: steps.length, pickupDone };
}

/** Fuel level as a short fraction: 0 'E', 8 'F', 4 '1/2', 2 '1/4', 6 '3/4', else n/8. */
export function fuelFraction(n: number): string {
  if (n <= 0) return 'E';
  if (n >= 8) return 'F';
  if (n === 4) return '1/2';
  if (n === 2) return '1/4';
  if (n === 6) return '3/4';
  return `${n}/8`;
}

export type ReturnCompare = {
  /** Distance driven in the odometer's unit, and in the other one. Null without both readings or when return < pick-up. */
  driven: { value: number; other: number } | null;
  odoBackwards: boolean;
  /** The car goes back with less fuel than it came with (the desk may charge for refuelling). */
  fuelLower: boolean;
};

export function compareReturn(c: RentalChecklist): ReturnCompare {
  const a = c.pickup.odo;
  const b = c.return.odo;
  const odoBackwards = a !== null && b !== null && b < a;
  const value = a !== null && b !== null && b >= a ? b - a : null;
  const fa = c.pickup.fuel;
  const fb = c.return.fuel;
  return {
    driven: value === null ? null : { value, other: convertWhole(value, c.odoUnit) ?? 0 },
    odoBackwards,
    fuelLower: fa !== null && fb !== null && fb < fa,
  };
}

export type Moment = { utc: number; local: LocalDateTime; tz: string };
export type ReturnPlan = { returnAt: Moment; leaveAt: Moment | null; bufferMin: number };

/**
 * When the car goes back: the booking's drop-off (end) on its own zone's clock, and "leave by" = drop-off minus the
 * traveller's travel time minus RETURN_BUFFER_MIN for fuel and the hand-back, on the same clock (real instants, so a
 * daylight-saving change in between counts as the clock moves). Null without a readable drop-off.
 */
export function returnPlan(item: Pick<Item, 'kind' | 'end'>, travelMin: number | null): ReturnPlan | null {
  if (!isCarBooking(item) || !item.end || !isValidZone(item.end.tz) || !isLocalDateTime(item.end.local)) return null;
  const utc = toUtc(item.end);
  if (!Number.isFinite(utc)) return null;
  const tz = item.end.tz;
  const returnAt: Moment = { utc, local: item.end.local, tz };
  if (travelMin === null || !Number.isFinite(travelMin) || travelMin < 0) return { returnAt, leaveAt: null, bufferMin: RETURN_BUFFER_MIN };
  const at = utc - (travelMin + RETURN_BUFFER_MIN) * 60_000;
  return { returnAt, leaveAt: { utc: at, local: fromUtc(at, tz), tz }, bufferMin: RETURN_BUFFER_MIN };
}

/** Steps the travel time by TRAVEL_STEP within 0..RENTAL_LIMITS.travel; from "not set" a step up starts at 30. */
export function stepTravel(current: number | null, dir: 1 | -1): number | null {
  if (current === null) return dir > 0 ? 30 : null;
  const next = current + dir * TRAVEL_STEP;
  if (next < 0) return null;
  return Math.min(RENTAL_LIMITS.travel, next);
}

/** Car bookings of the trip in booking order (for the guide screen's "Your car" links). */
export function carBookings(trip: Pick<Trip, 'items'>): Item[] {
  return sortItems(trip.items).filter((i) => isCarBooking(i) && zonesReadable(i));
}

/** Rental keys of deleted car bookings (a deleted trip takes every one of its bookings' keys). */
export function rentalKeysToDrop(gone: readonly Pick<Item, 'id' | 'kind'>[], remaining: readonly Pick<Trip, 'items'>[]): string[] {
  const still = new Set(remaining.flatMap((t) => t.items.map((i) => i.id)));
  const out = new Set<string>();
  for (const g of gone) if (g.id && g.kind === 'car' && !still.has(g.id)) out.add(rentalKey(g.id));
  return [...out];
}
