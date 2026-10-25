// Trip timeline: sort, group by local day, overlaps, nights without a bed, and the "Next up" card.
import type { Item, LocalDate, Trip } from './model.ts';
import { isTransport } from './model.ts';
import { dateRange, localDate, toUtc } from './tz.ts';

export type Span = { start: number; end: number };

/** UTC span of an item. Point-in-time items (notes, or no end) last zero minutes. */
export function span(item: Item): Span {
  const start = toUtc(item.start);
  const end = item.end ? Math.max(start, toUtc(item.end)) : start;
  return { start, end };
}

/** Sorted by real (UTC) start, then end, then id, so the order is stable. */
export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const sa = span(a);
    const sb = span(b);
    return sa.start - sb.start || sa.end - sb.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

/** `continuing`: journeys that started on an earlier local day and arrive on (or run through) this one. */
export type Day = { date: LocalDate; items: Item[]; continuing: Item[] };

/**
 * Local dates after its start date that an item also touches: an overnight or date-line journey shows again on its
 * arrival day (end date in the end zone), and a multi-day journey on the days in between. Hotel stays don't repeat
 * on every day of the stay; the timeline already
 * checks for nights without a bed. A "negative" day shift (arriving on an earlier date across the date line) adds
 * nothing, because the item is already shown on its departure day.
 */
export function extraDays(item: Item): LocalDate[] {
  if (!item.end || item.kind === 'hotel' || item.kind === 'note') return [];
  const from = localDate(item.start.local);
  const to = localDate(item.end.local);
  if (to <= from) return [];
  // A hire car shows again on its return day only (not every day you have it).
  return item.kind === 'car' ? [to] : dateRange(from, to).slice(1);
}

/**
 * Days of the trip, each with the items that start on that local date (in the item's own zone, which is what the
 * ticket says) and the journeys still under way. Every date from the trip's start to end appears, empty or not;
 * items outside the range add days. Stored times and zones are never changed.
 */
export function groupByDay(trip: Trip): Day[] {
  const sorted = sortItems(trip.items);
  const dates = new Set(dateRange(trip.startDate, trip.endDate));
  for (const it of sorted) {
    dates.add(localDate(it.start.local));
    for (const d of extraDays(it)) dates.add(d);
  }
  return [...dates].sort().map((date) => ({
    date,
    items: sorted.filter((it) => localDate(it.start.local) === date),
    continuing: sorted.filter((it) => extraDays(it).includes(date)),
  }));
}

/** Items whose times clash. Hotel stays and notes overlap everything by nature, so only hotel-vs-hotel counts for them. */
export function overlaps(items: Item[]): [Item, Item][] {
  const timed = sortItems(items).filter((i) => i.kind !== 'note' && i.end);
  const out: [Item, Item][] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      const hotelA = a.kind === 'hotel';
      const hotelB = b.kind === 'hotel';
      if (hotelA !== hotelB) continue;
      if (a.kind === 'car' || b.kind === 'car') continue; // you drive the hire car to things
      const sa = span(a);
      const sb = span(b);
      if (sb.start < sa.end && sa.start < sb.end) out.push([a, b]);
    }
  }
  return out;
}

/**
 * Nights of the trip with no bed booked: a night is the local date you go to sleep on. A hotel covers the nights
 * from its check-in date up to (not including) its check-out date; an overnight transport (a red-eye or sleeper
 * train) covers the night of its departure date. The last day of the trip needs no bed.
 */
export function nightsWithoutBed(trip: Trip): LocalDate[] {
  const covered = new Set<LocalDate>();
  for (const it of trip.items) {
    if (it.kind === 'hotel' && it.end) {
      for (const d of dateRange(localDate(it.start.local), localDate(it.end.local)).slice(0, -1)) covered.add(d);
    } else if (isTransport(it.kind) && it.end && localDate(it.end.local) > localDate(it.start.local)) {
      covered.add(localDate(it.start.local));
    }
  }
  return dateRange(trip.startDate, trip.endDate)
    .slice(0, -1)
    .filter((d) => !covered.has(d));
}

export type NextUp = { item: Item; state: 'now' | 'next'; minutes: number } | null;

/**
 * The "Next up" card: an item happening now (started, not ended; a hotel stay never counts as "now", so it never
 * hides your flight) or else the next item to start.
 * `minutes` is minutes until start for "next", minutes until end for "now".
 */
export function nextUp(items: Item[], now: number): NextUp {
  const sorted = sortItems(items).filter((i) => i.kind !== 'note');
  const upcoming = sorted.find((i) => span(i).start > now);
  const current = sorted.filter((i) => i.kind !== 'hotel' && span(i).start <= now && span(i).end > now);
  if (current.length) {
    const it = current[current.length - 1];
    return { item: it, state: 'now', minutes: Math.ceil((span(it).end - now) / 60_000) };
  }
  if (upcoming) return { item: upcoming, state: 'next', minutes: Math.ceil((span(upcoming).start - now) / 60_000) };
  return null;
}

/** Trip state relative to today (in the phone's zone). */
export function tripPhase(trip: Trip, today: LocalDate): 'upcoming' | 'active' | 'past' {
  if (today < trip.startDate) return 'upcoming';
  if (today > trip.endDate) return 'past';
  return 'active';
}
