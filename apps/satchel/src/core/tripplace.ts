// Jared's 1.0 feedback: a trip can carry its own title ("Girls trip") and still say where it goes. The trip's name is
// its title; where it goes comes from the bookings, never from the title. tripDestination lists the countries the
// bookings visit (home left out, in visit order); titleNamesPlace says when the title already names the place, so a
// trip called "Japan in spring" doesn't print "Japan" twice. All on the phone, no network.
import { tripCountries } from './arrival.ts';
import { destinationZone } from './glance.ts';
import type { Trip } from './model.ts';

/** Most countries named before the line says "+N more". */
export const DESTINATION_MAX = 3;

export type TripPlace = {
  /** The countries the bookings reach, as display names, in visit order. */
  countries: string[];
  /** The destination zone's city ("Tokyo" for Asia/Tokyo), or null without bookings abroad. */
  city: string | null;
};

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const zoneCity = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ');

function bookingsMention(trip: Trip, city: string): boolean {
  const want = norm(city);
  return trip.items.some((i) => {
    const r = i as unknown as Record<string, unknown>;
    const texts: unknown[] = [i.title, r.from, r.to, r.place].flatMap((v) => (v && typeof v === 'object' ? [(v as Record<string, unknown>).name, (v as Record<string, unknown>).address] : [v]));
    return texts.some((x) => typeof x === 'string' && norm(x).includes(want));
  });
}

export function tripPlace(trip: Trip, home: string | null, countryName: (iso2: string) => string): TripPlace {
  const countries = tripCountries(trip, home).map((c) => countryName(c.iso2)).filter((n, i, all) => n && all.indexOf(n) === i);
  const dest = destinationZone(trip);
  const city = dest ? zoneCity(dest) : null;
  // A time zone is named after one city (Bali is "Asia/Makassar"): use that name only when the bookings mention it.
  return { countries, city: city && bookingsMention(trip, city) ? city : null };
}

/** "Japan", "Japan · South Korea", "Japan · Korea · Taiwan +2"; '' when the bookings name no country abroad. */
export function destinationLine(place: TripPlace, more: (n: number) => string): string {
  const shown = place.countries.slice(0, DESTINATION_MAX).join(' · ');
  const extra = place.countries.length - DESTINATION_MAX;
  return extra > 0 ? `${shown} ${more(extra)}` : shown;
}


/** True when the title already names one of the trip's countries or its destination city. */
export function titleNamesPlace(title: string, place: TripPlace): boolean {
  const t = norm(title);
  return [...place.countries, ...(place.city ? [place.city] : [])].some((p) => p.length > 1 && t.includes(norm(p)));
}

/** The place for the Home headline ("Day 2 of 9 in Tokyo"): the destination city, else the first country, else null. */
export function headlinePlace(place: TripPlace): string | null {
  return place.city ?? place.countries[0] ?? null;
}
