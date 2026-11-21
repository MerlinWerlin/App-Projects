// The trip's destination for the screen (src/core/tripplace.ts): its countries by name, home left out.
import { useMemo } from 'react';
import { homeCountryFor } from '../core/arrival.ts';
import type { Trip } from '../core/model.ts';
import { destinationLine, titleNamesPlace, tripPlace, type TripPlace } from '../core/tripplace.ts';
import type { T } from '../i18n/core.ts';
import { holidayCountryName } from './HolidaysCard.tsx';
import { useHomeCountry } from './HomeCountryPicker.tsx';

export function useTripPlace(trip: Trip | null | undefined): TripPlace | null {
  const { homeIso } = useHomeCountry();
  return useMemo(() => (trip ? tripPlace(trip, homeCountryFor(trip, homeIso), holidayCountryName) : null), [trip, homeIso]);
}

/** The destination line to print under the trip's title, or '' when the title already names it (or nothing does). */
export function destinationUnderTitle(t: T, title: string, place: TripPlace | null): string {
  if (!place || titleNamesPlace(title, place)) return '';
  return destinationLine(place, (n) => t('tripPlace.more', { n }));
}
