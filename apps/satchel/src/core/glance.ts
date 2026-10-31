// T50 "at a glance" helpers for the Trips home: greeting by time of day, the trip in focus and its countdown,
// boarding-pass route codes, day-of-trip progress, quick stats, today's agenda and the destination vs home clock.
// Pure and offline (Intl.DateTimeFormat only, through tz.ts).
import type { Item, LocalDate, Trip } from './model.ts';
import { span, sortItems, tripPhase, zonesReadable } from './timeline.ts';
import { daysBetween, fromUtc, isValidZone, localDate, zoneDiffMinutes } from './tz.ts';

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/** Morning 05–11, afternoon 12–17, evening 18–21, night otherwise. */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** "Tokyo" from "Asia/Tokyo". */
const cityOf = (tz: string) => (tz.split('/').pop() ?? tz).replace(/_/g, ' ');

/**
 * The zone the trip is mostly in: the readable zone, other than home, where its bookings start or end most often
 * (hotel nights count double, since that's where you sleep). Null when every booking is in the home zone.
 */
export function destinationZone(trip: Trip): string | null {
  const score = new Map<string, number>();
  const add = (tz: string | undefined, w: number) => {
    if (!tz || tz === trip.homeTz || !isValidZone(tz)) return;
    score.set(tz, (score.get(tz) ?? 0) + w);
  };
  for (const i of trip.items) {
    const w = i.kind === 'hotel' ? 2 : 1;
    add(i.start.tz, w);
    add(i.end?.tz, w);
  }
  let best: string | null = null;
  let top = 0;
  for (const [tz, n] of score) if (n > top || (n === top && best !== null && tz < best)) [best, top] = [tz, n];
  return best;
}

/** A three-letter code: an explicit one in the place name ("Narita (NRT)") wins, else the first letters of the city. */
export function placeCode(name: string): string {
  const m = /\b([A-Z]{3})\b/.exec(name);
  if (m) return m[1];
  const letters = name.normalize('NFD').replace(/[^A-Za-z]/g, '');
  return (letters.slice(0, 3) || '---').toUpperCase();
}

export type Route = { fromCode: string; fromCity: string; toCode: string; toCity: string } | null;

/**
 * Boarding-pass route for a trip card: home city -> destination city. Uses the outbound booking's place names when
 * they carry an explicit code. Null when the trip has no destination outside the home zone.
 */
export function tripRoute(trip: Trip): Route {
  const dest = destinationZone(trip);
  if (!dest) return null;
  const fromCity = cityOf(trip.homeTz);
  const toCity = cityOf(dest);
  const outbound = sortItems(trip.items).find((i) => i.end?.tz === dest && i.from && i.to);
  const explicit = (name?: string) => (name && /\b[A-Z]{3}\b/.test(name) ? placeCode(name) : null);
  return {
    fromCode: explicit(outbound?.from?.name) ?? placeCode(fromCity),
    fromCity,
    toCode: explicit(outbound?.to?.name) ?? placeCode(toCity),
    toCity,
  };
}

/** Number of calendar days the trip spans (start and end inclusive). */
export const tripDays = (trip: Trip) => daysBetween(trip.startDate, trip.endDate) + 1;

export type Countdown =
  | { kind: 'upcoming'; days: number }
  | { kind: 'today' }
  | { kind: 'active'; day: number; total: number; progress: number }
  | { kind: 'past' };

/** Where today sits relative to a trip. `progress` is 0..1 through the trip's days (day 1 of 4 = 0.25). */
export function countdown(trip: Trip, today: LocalDate): Countdown {
  const phase = tripPhase(trip, today);
  if (phase === 'past') return { kind: 'past' };
  if (phase === 'upcoming') return { kind: 'upcoming', days: daysBetween(today, trip.startDate) };
  if (today === trip.startDate) return { kind: 'today' };
  const total = tripDays(trip);
  const day = daysBetween(trip.startDate, today) + 1;
  return { kind: 'active', day, total, progress: Math.min(1, Math.max(0, day / total)) };
}

/** The trip to headline: one on now (the earliest started), else the soonest upcoming. */
export function focusTrip(trips: Trip[], today: LocalDate): Trip | null {
  const live = trips.filter((t) => tripPhase(t, today) !== 'past').sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  return live[0] ?? null;
}

export type Stats = { trips: number; bookings: number; daysAway: number };

/** Quick stats over trips not yet over: how many, their bookings (notes excluded), and the days they span. */
export function quickStats(trips: Trip[], today: LocalDate): Stats {
  const live = trips.filter((t) => tripPhase(t, today) !== 'past');
  return {
    trips: live.length,
    bookings: live.reduce((n, t) => n + t.items.filter((i) => i.kind !== 'note').length, 0),
    daysAway: live.reduce((n, t) => n + tripDays(t), 0),
  };
}

export type AgendaRow = { item: Item; tripName: string; state: 'done' | 'now' | 'later' };

/**
 * Today's bookings across trips on now: items that start today in their own zone (or are under way), in time
 * order, each marked done / now / later against `now`. Items with an unreadable zone are skipped.
 */
export function todayAgenda(trips: Trip[], now: number): AgendaRow[] {
  const rows: AgendaRow[] = [];
  for (const trip of trips) {
    for (const item of sortItems(trip.items)) {
      if (!zonesReadable(item)) continue;
      const s = span(item);
      const startsToday = localDate(item.start.local) === localDate(fromUtc(now, item.start.tz));
      const underway = item.kind !== 'hotel' && s.start <= now && s.end > now;
      if (!startsToday && !underway) continue;
      const state = s.end < now || (s.end === s.start && s.start < now) ? 'done' : s.start <= now ? 'now' : 'later';
      rows.push({ item, tripName: trip.name, state });
    }
  }
  return rows.sort((a, b) => span(a.item).start - span(b.item).start);
}

export type ClockPair = { destCity: string; destTime: string; homeCity: string; homeTime: string; diffMinutes: number };

/** Wall clocks at the destination and at home right now, and how far ahead the destination is (minutes). */
export function clockPair(destTz: string, homeTz: string, now: number): ClockPair | null {
  if (!isValidZone(destTz) || !isValidZone(homeTz)) return null;
  return {
    destCity: cityOf(destTz),
    destTime: fromUtc(now, destTz).slice(11, 16),
    homeCity: cityOf(homeTz),
    homeTime: fromUtc(now, homeTz).slice(11, 16),
    diffMinutes: zoneDiffMinutes(destTz, homeTz, now),
  };
}

/** "+2h", "−1h 30m", "+5h 45m"; empty string for the same time. */
export function formatOffset(min: number): string {
  if (!min) return '';
  const sign = min > 0 ? '+' : '−';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h ? `${h}h` : ''}${h && m ? ' ' : ''}${m ? `${String(m).padStart(h ? 2 : 1, '0')}m` : ''}`;
}
