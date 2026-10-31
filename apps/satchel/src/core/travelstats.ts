// T65 "Your travels": lifetime stats worked out on the phone from the saved trips (no network, no airport table).
//   countries   from the IANA zones of each booking (countryForZone), the trip's home country left out
//   cities      the town at the end of each hotel address, else the zone's city ("Asia/Tokyo" -> Tokyo)
//   days away   calendar days covered by trips that have started, counted once even when trips overlap, each
//               booking's date read in its own zone (a flight landing the next morning at home adds that day)
//   flights     legs from flight items; great-circle km only for legs whose from/to carry coordinates
//               (Satchel has no airport table yet, so legs without coordinates are counted but not measured)
// Demo / sample trips are left out unless asked for. Pure TypeScript; Node runs it directly.
import { countryForZone } from './emergency.ts';
import { destinationZone } from './glance.ts';
import type { Item, LocalDate, Place, Trip } from './model.ts';
import { haversineMeters, validLatLon } from './poi.ts';
import { addDays, daysBetween, isValidZone, localDate } from './tz.ts';

export type Region = 'americas' | 'europe' | 'africa' | 'asia' | 'oceania';
export const REGIONS: readonly Region[] = ['americas', 'europe', 'africa', 'asia', 'oceania'];

export type CountryTile = { iso2: string; region: Region; planned: boolean };

export type TravelStats = {
  /** Trips that have started (on now or past) and are counted. */
  tripsTaken: number;
  /** Demo / sample trips left out because includeDemo was off. */
  demoLeftOut: number;
  /** Visited countries (ISO 3166 alpha-2), A–Z, home country excluded. */
  countries: string[];
  /** Countries only in upcoming trips (not yet visited), A–Z. */
  planned: string[];
  /** Every visited and planned country with its region, for the tile grid (visited first, then planned). */
  tiles: CountryTile[];
  /** The home country most trips start from, when the zone maps. */
  home: string | null;
  /** Visited cities, A–Z, deduplicated without case or accents. */
  cities: string[];
  daysAway: number;
  /** Trips (any phase) that touch today's calendar year. */
  tripsThisYear: number;
  longest: { tripId: string; name: string; days: number } | null;
  flights: { legs: number; measured: number; unmeasured: number; km: number };
  /** The soonest trip that has not started yet. */
  next: { tripId: string; name: string; days: number; zone: string | null } | null;
};

export type StatsOptions = {
  includeDemo?: boolean;
  /** Country name for an ISO code (from the bundled table): lets a trailing country in an address be skipped. */
  countryName?: (iso2: string) => string | null | undefined;
};

/** Lowercase without accents, for deduplication. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** "Tokyo" from "Asia/Tokyo"; "Buenos Aires" from "America/Argentina/Buenos_Aires". */
export const zoneCity = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ');

/** Demo trips (the bundled one, imported copies of it, anything marked demo). */
export const isDemoTrip = (t: Trip) => t.demo === true || t.id === 'demo';

/** Rough region for the tile grid, from the zone's area name. */
export function regionForZone(tz: string, iso2?: string | null): Region {
  const area = tz.split('/')[0];
  switch (area) {
    case 'America':
      return 'americas';
    case 'Europe':
    case 'Atlantic':
    case 'Arctic':
      return 'europe';
    case 'Africa':
      return 'africa';
    case 'Australia':
    case 'Pacific':
    case 'Antarctica':
      return 'oceania';
    case 'Indian':
      return iso2 === 'MV' || iso2 === 'IO' || iso2 === 'CX' || iso2 === 'CC' ? 'asia' : 'africa';
    default:
      return 'asia';
  }
}

/** Zones a booking touches (start and end), readable ones only. */
const zonesOf = (i: Item): string[] => [i.start.tz, i.end?.tz].filter((z): z is string => !!z && isValidZone(z));

/** The trip's first and last calendar days, widened by any booking whose own local date falls outside them. */
export function tripSpan(trip: Trip): { start: LocalDate; end: LocalDate } {
  let start = trip.startDate;
  let end = trip.endDate < trip.startDate ? trip.startDate : trip.endDate;
  for (const i of trip.items) {
    const s = localDate(i.start.local);
    const e = i.end ? localDate(i.end.local) : s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) && s < start) start = s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(e) && e > end) end = e;
  }
  return { start, end };
}

const spanDays = (s: { start: LocalDate; end: LocalDate }) => daysBetween(s.start, s.end) + 1;

/** The town in an address: its last part, skipping postcodes and a trailing country name. */
export function cityFromAddress(address: string | undefined, isCountry: (s: string) => boolean = () => false): string | null {
  if (!address) return null;
  const parts = address
    .split(/[,\n]/)
    .map((p) => p.replace(/\b[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}\b/g, '').replace(/\d+(-\d+)*/g, '').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 1);
  while (parts.length && isCountry(parts[parts.length - 1])) parts.pop();
  const last = parts[parts.length - 1];
  return last && parts.length > 1 ? last : null;
}

const hasCoords = (p: Place | undefined): p is Place & { lat: number; lon: number } => !!p && validLatLon(p.lat, p.lon);

export function travelStats(trips: readonly Trip[], today: LocalDate, opts: StatsOptions = {}): TravelStats {
  const counted = opts.includeDemo ? [...trips] : trips.filter((t) => !isDemoTrip(t));
  const demoLeftOut = trips.length - counted.length;
  const started = counted.filter((t) => tripSpan(t).start <= today);
  const upcoming = counted.filter((t) => tripSpan(t).start > today);

  const names = new Set<string>();
  if (opts.countryName) {
    for (const t of counted)
      for (const i of t.items)
        for (const z of zonesOf(i)) {
          const c = countryForZone(z);
          const n = c ? opts.countryName(c) : null;
          if (n) names.add(fold(n));
        }
  }
  const isCountry = (s: string) => names.has(fold(s));

  // home country: the most common one across the counted trips
  const homeVotes = new Map<string, number>();
  for (const t of counted) {
    const h = countryForZone(t.homeTz);
    if (h) homeVotes.set(h, (homeVotes.get(h) ?? 0) + 1);
  }
  let home: string | null = null;
  for (const [c, n] of homeVotes) if (home === null || n > (homeVotes.get(home) ?? 0) || (n === homeVotes.get(home) && c < home)) home = c;

  const visited = new Map<string, Region>();
  const plannedMap = new Map<string, Region>();
  const cities = new Map<string, string>();
  const collect = (t: Trip, into: Map<string, Region>, withCities: boolean) => {
    const tripHome = countryForZone(t.homeTz);
    const zonesWithHotelCity = new Set<string>();
    if (withCities) {
      for (const i of t.items) {
        if (i.kind !== 'hotel') continue;
        const city = cityFromAddress(i.place?.address, isCountry);
        if (!city || i.start.tz === t.homeTz) continue;
        zonesWithHotelCity.add(i.start.tz);
        if (!cities.has(fold(city))) cities.set(fold(city), city);
      }
    }
    for (const i of t.items) {
      for (const z of zonesOf(i)) {
        const c = countryForZone(z);
        if (c && c !== tripHome && !into.has(c)) into.set(c, regionForZone(z, c));
        if (withCities && z !== t.homeTz && !zonesWithHotelCity.has(z)) {
          const city = zoneCity(z);
          if (!cities.has(fold(city))) cities.set(fold(city), city);
        }
      }
    }
  };
  for (const t of started) collect(t, visited, true);
  for (const t of upcoming) collect(t, plannedMap, false);
  for (const c of visited.keys()) plannedMap.delete(c);

  // days away: union of started trips' days, up to today
  const days = new Set<LocalDate>();
  for (const t of started) {
    const s = tripSpan(t);
    const last = s.end < today ? s.end : today;
    for (let d = s.start, n = 0; d <= last && n < 3660; d = addDays(d, 1), n++) days.add(d);
  }

  const year = today.slice(0, 4);
  const tripsThisYear = counted.filter((t) => {
    const s = tripSpan(t);
    return s.start.slice(0, 4) <= year && s.end.slice(0, 4) >= year;
  }).length;

  let longest: TravelStats['longest'] = null;
  for (const t of started) {
    const n = spanDays(tripSpan(t));
    if (!longest || n > longest.days) longest = { tripId: t.id, name: t.name, days: n };
  }

  const flights = { legs: 0, measured: 0, unmeasured: 0, km: 0 };
  let meters = 0;
  for (const t of started)
    for (const i of t.items) {
      if (i.kind !== 'flight' || localDate(i.start.local) > today) continue;
      flights.legs++;
      if (hasCoords(i.from) && hasCoords(i.to)) {
        flights.measured++;
        meters += haversineMeters(i.from, i.to);
      } else flights.unmeasured++;
    }
  flights.km = Math.round(meters / 1000);

  let next: TravelStats['next'] = null;
  for (const t of upcoming) {
    const s = tripSpan(t).start;
    const days = daysBetween(today, s);
    if (!next || days < next.days) next = { tripId: t.id, name: t.name, days, zone: destinationZone(t) };
  }

  const sortAZ = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const countries = [...visited.keys()].sort(sortAZ);
  const planned = [...plannedMap.keys()].sort(sortAZ);
  return {
    tripsTaken: started.length,
    demoLeftOut,
    countries,
    planned,
    tiles: [
      ...countries.map((iso2) => ({ iso2, region: visited.get(iso2) as Region, planned: false })),
      ...planned.map((iso2) => ({ iso2, region: plannedMap.get(iso2) as Region, planned: true })),
    ],
    home,
    cities: [...cities.values()].sort((a, b) => sortAZ(fold(a), fold(b))),
    daysAway: days.size,
    tripsThisYear,
    longest,
    flights,
    next,
  };
}

/** True when there is nothing to show yet (no started trip and nothing coming up). */
export const statsEmpty = (s: TravelStats) => s.tripsTaken === 0 && s.next === null;

/** Small stable number from a country code, so each tile keeps its colour and pattern. */
export function tileSeed(iso2: string): number {
  let h = 7;
  for (const ch of iso2) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
}

/**
 * T68: a country's name in the app's language (Intl.DisplayNames, region names), falling back to `fallback` (the
 * bundled table's English name) when the engine has no DisplayNames, doesn't know the code or can't use the
 * language. Formatters are cached per language.
 */
const regionNames = new Map<string, { of(code: string): string | undefined } | null>();
export function localCountryName(iso2: string, lang: string, fallback: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return fallback;
  let names = regionNames.get(lang);
  if (names === undefined) {
    try {
      const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: 'region'; fallback: 'none' }) => { of(code: string): string | undefined } }).DisplayNames;
      names = typeof DN === 'function' ? new DN([lang], { type: 'region', fallback: 'none' }) : null;
    } catch {
      names = null;
    }
    regionNames.set(lang, names);
  }
  if (!names) return fallback;
  try {
    const n = names.of(code);
    // some engines name codes they don't know "Unknown Region" instead of returning nothing
    const unknown = names.of('ZZ');
    return n && code !== 'ZZ' && n !== code && n !== unknown ? n : fallback;
  } catch {
    return fallback;
  }
}
