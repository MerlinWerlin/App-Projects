// T65: the "Your travels" numbers for the Trips card and the stats screen, from the saved trips (no network).
// "Include demo trips" is remembered on this phone and shared by both places.
import { useMemo } from 'react';
import table from '../content/emergency_numbers.json';
import { findCountry, type EmergencyTable } from '../core/emergency.ts';
import { deviceZone, todayIn } from '../core/format.ts';
import { isDemoTrip, localCountryName, travelStats, type TravelStats } from '../core/travelstats.ts';
import { usePersisted } from '../state/persisted.ts';
import { useTrips } from '../state/trips.tsx';

export const TRAVELS_DEMO_KEY = 'satchel.travels.includeDemo.v1';
const DEMO_OFF = false;

/** English country name from the bundled table, else the ISO code itself. */
export const countryName = (iso2: string): string => findCountry(table as unknown as EmergencyTable, iso2)?.country ?? iso2;

/** T68: the country's name in the app's language (Intl), else the English name from the bundled table. */
export const displayCountryName = (iso2: string, lang: string): string => localCountryName(iso2, lang, countryName(iso2));

/** Whole number with the language's grouping ("15,234"); plain digits if the engine can't format. */
export function formatInt(n: number, lang: string): string {
  try {
    return new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}

export function useTravelStats(): {
  stats: TravelStats;
  includeDemo: boolean;
  setIncludeDemo: (v: boolean) => void;
  hasDemo: boolean;
  hasTrips: boolean;
} {
  const { trips } = useTrips();
  const [includeDemo, setIncludeDemo] = usePersisted<boolean>(TRAVELS_DEMO_KEY, DEMO_OFF);
  const today = todayIn(deviceZone());
  const stats = useMemo(() => travelStats(trips, today, { includeDemo, countryName }), [trips, today, includeDemo]);
  const hasDemo = useMemo(() => trips.some(isDemoTrip), [trips]);
  return { stats, includeDemo, setIncludeDemo: (v: boolean) => setIncludeDemo(v), hasDemo, hasTrips: trips.length > 0 };
}
