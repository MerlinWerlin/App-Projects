// T123 run-100 follow-ups (offline parts). Pure TypeScript, no React Native.
// 1) Help-card edit sheet: which photo files to delete when the sheet goes away without saving (Cancel, swipe down,
//    the back gesture). Only copies picked during this visit are candidates, and a saved card's photo is never one.
// 2) Low-battery essentials: the "Drive on the LEFT / RIGHT" lines for the trip on now (else the next one) when it
//    has a car booking abroad the driving guide covers.
// 3) Your day: the car booking due back today (drop-off on today's calendar in the zone you're in, not yet passed),
//    for the rental checklist's "Leave by" line.
import { setupTrip } from './battery.ts';
import { isCarBooking, tripDrivingBanners, type DrivingBanner, type DrivingTable } from './driving.ts';
import type { Item, LocalDate, Trip } from './model.ts';
import { sortItems, span, zonesReadable } from './timeline.ts';
import { addDays, toUtc } from './tz.ts';

/**
 * Photo files to delete when the help-card edit sheet is dismissed unsaved: every copy picked in this visit, once
 * each, except any file a saved card still points at (`keep`: the card's stored photo, and a photo a save in flight
 * is writing). Empty strings are ignored.
 */
export function unsavedHelpPhotos(picked: readonly string[], keep: readonly (string | null | undefined)[]): string[] {
  const kept = new Set(keep.filter((u): u is string => typeof u === 'string' && u !== ''));
  const out: string[] = [];
  for (const u of picked) if (typeof u === 'string' && u && !kept.has(u) && !out.includes(u)) out.push(u);
  return out;
}

export type EssentialsDriving = { tripId: string; banners: DrivingBanner[] };

/**
 * Driving lines for the essentials screen: the trip on today (else the next one, battery.ts setupTrip) and its
 * car-country banners, home country left out (`homeFor` gives it per trip). Null when that trip has none.
 */
export function essentialsDriving(trips: Trip[], today: LocalDate, table: DrivingTable, homeFor: (trip: Trip) => string | null = () => null): EssentialsDriving | null {
  const trip = setupTrip(trips, today);
  if (!trip) return null;
  const banners = tripDrivingBanners(trip, table, homeFor(trip));
  return banners.length ? { tripId: trip.id, banners } : null;
}

/**
 * The car booking on this trip that goes back today: its drop-off falls on `today` in `zone` (real instants, so a
 * drop-off in another zone counts on the day it happens where you are) and hasn't passed yet. The earliest when two
 * do. Null without one.
 */
export function carDueBack(trip: Pick<Trip, 'items'>, zone: string, today: LocalDate, now: number): Item | null {
  const from = toUtc({ local: `${today}T00:00`, tz: zone });
  const to = toUtc({ local: `${addDays(today, 1)}T00:00`, tz: zone });
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const due = sortItems(trip.items)
    .filter((i) => isCarBooking(i) && !!i.end && zonesReadable(i))
    .map((i) => ({ i, back: span(i).end }))
    .filter(({ back }) => back >= from && back < to && back >= now)
    .sort((a, b) => a.back - b.back);
  return due[0]?.i ?? null;
}
