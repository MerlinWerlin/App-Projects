// T112 (run-97 follow-ups, offline parts): which phone-only stay keys go with a deleted booking or trip, which stay
// the arrival card offers, and where to scroll for a gift opened from the Map tab. Pure TypeScript, no RN imports.
import type { Item, Trip } from './model.ts';
import { currentStay, isStay, stayKey, type CurrentStay } from './staydetails.ts';
import { span, zonesReadable } from './timeline.ts';

/**
 * The stay-details keys to delete when these bookings are gone (a deleted booking, or every booking of a deleted
 * trip). Every gone booking's key is listed, not only hotels', so details saved before a booking's kind was changed
 * go too; a key is kept while a booking with the same id is still on the phone (e.g. the same id in another trip).
 */
export function stayKeysToDrop(gone: readonly Pick<Item, 'id'>[], remaining: readonly Pick<Trip, 'items'>[]): string[] {
  const still = new Set(remaining.flatMap((t) => t.items.map((i) => i.id)));
  const out = new Set<string>();
  for (const g of gone) if (g.id && !still.has(g.id)) out.add(stayKey(g.id));
  return [...out];
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * The stay the arrival card offers Stay details for: the one you're in at `now`, else this trip's next check-in
 * within the coming 24 hours (arrival day: the hotel is usually still ahead). Null when neither.
 */
export function arrivalStay(trip: Pick<Trip, 'id' | 'items'>, now: number): CurrentStay | null {
  const current = currentStay([trip], now);
  if (current) return current;
  let best: Item | null = null;
  let bestStart = Infinity;
  for (const item of trip.items) {
    if (!isStay(item) || !zonesReadable(item)) continue;
    const s = span(item).start;
    if (s > now && s - now <= DAY_MS && s < bestStart) {
      best = item;
      bestStart = s;
    }
  }
  return best ? { item: best, tripId: trip.id } : null;
}

/**
 * Where to scroll so a view measured in the window sits `pad` below the scroll view's top: the current offset plus
 * the gap between the two, never below 0.
 */
export function scrollTargetY(currentOffset: number, viewWindowY: number, scrollWindowY: number, pad: number): number {
  const y = currentOffset + (viewWindowY - scrollWindowY) - pad;
  return Number.isFinite(y) ? Math.max(0, Math.round(y)) : Math.max(0, currentOffset);
}
