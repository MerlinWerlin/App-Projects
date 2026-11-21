// Jared's 1.0 feedback: "give the option to do multiple itineraries, because what if someone wants to do multiple
// trips?" Satchel always kept a list of trips (each with its own title, dates, bookings, tickets and documents), so
// there is nothing to migrate: a phone with one trip simply has a list of one. What was missing is choosing which
// trip Home and the Itinerary tab show. The choice is one id, shared by both screens and kept on the phone; when
// it is unset, or that trip was deleted, they fall back to the trip on now, else the next, else the last.

export const FOCUS_TRIP_KEY = 'satchel.focusTrip.v1';
export const NO_FOCUS: string | null = null;

/** The trip the user picked, while it still exists; else the automatic one. */
export function chosenTrip<T extends { id: string }>(trips: readonly T[], picked: unknown, auto: T | null): T | null {
  if (typeof picked === 'string') {
    const hit = trips.find((x) => x.id === picked);
    if (hit) return hit;
  }
  return auto;
}
