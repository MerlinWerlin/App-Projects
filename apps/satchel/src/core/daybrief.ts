// T71 morning brief ("Your day" card on the Trips tab): today on a trip that is on now, in the zone the traveller
// is in (journal.ts tripZoneAt). The first and the next booking (now / next with minutes, from timeline.nextUp),
// how many stops today, the hotel for tonight (with its address-card shortcut when an address is saved) and a
// heads-up for an early start tomorrow (a booking before 09:00 on its own clock). Pure and offline.
import { todayAgenda, type AgendaRow } from './glance.ts';
import { journalToday, tripZoneAt } from './journal.ts';
import type { Item, LocalDate, Trip } from './model.ts';
import { nextUp, sortItems, span, tripPhase, zonesReadable, type NextUp } from './timeline.ts';
import { addDays, daysBetween, fromUtc, localDate, localTime, toUtc } from './tz.ts';

/** A booking before this wall-clock time tomorrow gets a heads-up tonight. */
export const EARLY_BEFORE = '09:00';

export type DayBrief = {
  trip: Trip;
  /** The zone the traveller is in now; "today" is read in it. */
  zone: string;
  today: LocalDate;
  day: number;
  total: number;
  lastDay: boolean;
  /** Today's bookings in time order (notes left out), including a journey still under way from last night. */
  items: Item[];
  /** Bookings that start today (what "stops" counts). */
  stops: number;
  first: Item | null;
  /** Happening now (minutes left) or next today (minutes to go); null once today is done. */
  next: NonNullable<NextUp> | null;
  /** The bed for tonight: a stay whose nights include today. */
  tonight: { item: Item; hasAddress: boolean } | null;
  /** First early booking tomorrow (before 09:00 on its own clock). */
  early: Item | null;
};

/** UTC instants of a wall-clock day in a zone: [00:00, next 00:00). */
function dayBounds(date: LocalDate, tz: string): { from: number; to: number } {
  return { from: toUtc({ local: `${date}T00:00`, tz }), to: toUtc({ local: `${addDays(date, 1)}T00:00`, tz }) };
}

const hasAddress = (i: Item) => !!(i.place?.address?.trim() || i.place?.localAddress?.trim());

/** The trip that is on today where the traveller is (the earliest started when two overlap), or null. */
export function briefTrip(trips: Trip[], now: number): Trip | null {
  const on = trips.filter((t) => tripPhase(t, journalToday(t, now)) === 'active');
  on.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id < b.id ? -1 : 1));
  return on[0] ?? null;
}

/** The brief for the trip on today, or null when no trip is on. */
export function dayBrief(trips: Trip[], now: number): DayBrief | null {
  const trip = briefTrip(trips, now);
  if (!trip) return null;
  const zone = tripZoneAt(trip, now);
  const today = localDate(fromUtc(now, zone));
  const { from, to } = dayBounds(today, zone);
  const timed = sortItems(trip.items).filter((i) => zonesReadable(i) && i.kind !== 'note');

  const startsToday = (i: Item) => {
    const s = span(i).start;
    return s >= from && s < to;
  };
  // A journey that left yesterday and lands today (an overnight flight) belongs to today too; a hotel stay doesn't.
  const arrivesToday = (i: Item) => i.kind !== 'hotel' && span(i).start < from && span(i).end > from;
  const items = timed.filter((i) => startsToday(i) || arrivesToday(i));
  const n = nextUp(items, now);

  const tonight = timed.find((i) => i.kind === 'hotel' && i.end && localDate(i.start.local) <= today && localDate(i.end.local) > today) ?? null;

  const tomorrow = dayBounds(addDays(today, 1), zone);
  const early =
    timed.find((i) => {
      if (i.kind === 'hotel') return false;
      const s = span(i).start;
      return s >= tomorrow.from && s < tomorrow.to && localTime(i.start.local) < EARLY_BEFORE;
    }) ?? null;

  return {
    trip,
    zone,
    today,
    day: daysBetween(trip.startDate, today) + 1,
    total: daysBetween(trip.startDate, trip.endDate) + 1,
    lastDay: today === trip.endDate,
    items,
    stops: items.filter(startsToday).length,
    first: items[0] ?? null,
    next: n,
    tonight: tonight ? { item: tonight, hasAddress: hasAddress(tonight) } : null,
    early,
  };
}

/**
 * T72 decision (ops/DECISIONS.md): the Trips tab's "Today" mini timeline gives way to "Your day" for the trip the
 * brief is about, so the same bookings never show twice. It keeps only rows from other trips on today (two trips
 * overlapping), and so hides altogether in the usual case. With no brief (no trip on today where the traveller is)
 * it is the plain agenda, unchanged.
 */
export function agendaBesideBrief(trips: Trip[], now: number): AgendaRow[] {
  const rows = todayAgenda(trips, now);
  const b = briefTrip(trips, now);
  return b ? rows.filter((r) => r.item.tripId !== b.id && !b.items.some((i) => i.id === r.item.id)) : rows;
}
