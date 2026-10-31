// T71 "Share plan": a clean plain-text itinerary for the system share sheet (Messages, Mail, Notes).
// Trip name and dates, then each day that has bookings, headed with the day's main zone; every line is the item's
// own wall clock (what the ticket says), with the zone named only when it differs from the day's main zone.
// Booking codes appear only when the traveller asks for them. Notes, seats, documents, the emergency card,
// medical notes and attachments are never part of this text. Pure: wording comes in through `ItineraryWords`.
import { formatDay, formatRange, formatTime, zoneCity } from './format.ts';
import { isTransport, type Item, type ItemKind, type LocalDate, type Trip } from './model.ts';
import { destinationZone, tripDays } from './glance.ts';
import { isLocalDateTime, isValidZone, localDate, toUtc } from './tz.ts';

export type ItineraryScope = { kind: 'trip' } | { kind: 'day'; date: LocalDate } | { kind: 'from'; date: LocalDate };

/** Every word the text uses, filled from the catalogue by the screen (tests pass English). */
export type ItineraryWords = {
  kind: (k: ItemKind) => string;
  /** "3 Nov – 11 Nov · 9 days" */
  dates: (range: string, days: number) => string;
  /** "Tue 3 Nov · Tokyo time" */
  dayHeading: (day: string, city: string) => string;
  /** "09:30 Sydney time" — only when the item's zone differs from the day's. */
  zoneTime: (time: string, city: string) => string;
  /** Shown in place of a time the booking doesn't have. */
  noTime: string;
  /** "Arrives 17:45" (same day, same zone) */
  arrives: (time: string) => string;
  /** "Booking code: DMO4KX" */
  code: (ref: string) => string;
  /** Body when nothing in the chosen range is booked. */
  nothing: string;
};

export type ItineraryOptions = { scope?: ItineraryScope; includeCodes?: boolean; lang?: string };

const hasTime = (i: Item) => isLocalDateTime(i.start.local);
const timed = (i: Item) => hasTime(i) && isValidZone(i.start.tz) && (!i.end || (isLocalDateTime(i.end.local) && isValidZone(i.end.tz)));
const dateOf = (i: Item): LocalDate => localDate(i.start.local);
const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Items in a day: real start order first, then any the phone can't place in time (stored order), then id. */
function dayOrder(items: Item[]): Item[] {
  const byId = (a: Item, b: Item) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const a = items.filter(timed).sort((x, y) => toUtc(x.start) - toUtc(y.start) || byId(x, y));
  const b = items.filter((i) => !timed(i)).sort((x, y) => (x.start.local < y.start.local ? -1 : x.start.local > y.start.local ? 1 : byId(x, y)));
  return [...a, ...b];
}

/** The zone most of the day's bookings start in; ties go to the trip's destination, then the home zone, then A–Z. */
export function mainZone(items: Item[], trip: Trip): string {
  const n = new Map<string, number>();
  for (const i of items) n.set(i.start.tz, (n.get(i.start.tz) ?? 0) + 1);
  const dest = destinationZone(trip);
  const rank = (tz: string) => (tz === dest ? 0 : tz === trip.homeTz ? 1 : 2);
  let best = '';
  for (const [tz, c] of n) {
    const bc = n.get(best) ?? 0;
    if (!best || c > bc || (c === bc && (rank(tz) < rank(best) || (rank(tz) === rank(best) && tz < best)))) best = tz;
  }
  return best || dest || trip.homeTz;
}

function itemLines(i: Item, dayZone: string, w: ItineraryWords, includeCodes: boolean, lang: string): string[] {
  const time = hasTime(i) ? formatTime(i.start.local) : w.noTime;
  const when = hasTime(i) && i.start.tz !== dayZone ? w.zoneTime(time, zoneCity(i.start.tz)) : time;
  const title = clean(i.title) || w.kind(i.kind);
  const out = [`${when}  ${w.kind(i.kind)}: ${title}`];
  const detail: string[] = [];
  if (isTransport(i.kind) && (i.from?.name || i.to?.name)) {
    const route = [clean(i.from?.name), clean(i.to?.name)].filter(Boolean).join(' → ');
    if (route && route !== title) detail.push(route);
  } else if (i.place) {
    const name = clean(i.place.name);
    if (name && name !== title) detail.push(name);
    const addr = clean(i.place.address) || clean(i.place.localAddress);
    if (addr) detail.push(addr);
  }
  if (isTransport(i.kind) && i.end && isLocalDateTime(i.end.local)) {
    let at = formatTime(i.end.local);
    if (i.end.tz !== dayZone) at = w.zoneTime(at, zoneCity(i.end.tz));
    if (localDate(i.end.local) !== dateOf(i)) at = `${at}, ${formatDay(localDate(i.end.local), lang)}`;
    detail.push(w.arrives(at));
  }
  const ref = clean(i.ref);
  if (includeCodes && ref) detail.push(w.code(ref));
  for (const d of detail) out.push(`   ${d}`);
  return out;
}

/** The itinerary as plain text. Days with nothing booked are left out; codes are off unless `includeCodes`. */
export function itineraryText(trip: Trip, words: ItineraryWords, opts: ItineraryOptions = {}): string {
  const scope = opts.scope ?? { kind: 'trip' };
  const lang = opts.lang ?? 'en';
  const includeCodes = opts.includeCodes === true;
  const byDay = new Map<LocalDate, Item[]>();
  for (const i of trip.items) {
    const d = dateOf(i);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (scope.kind === 'day' && d !== scope.date) continue;
    if (scope.kind === 'from' && d < scope.date) continue;
    const list = byDay.get(d) ?? [];
    list.push(i);
    byDay.set(d, list);
  }
  const head = [clean(trip.name), words.dates(formatRange(trip.startDate, trip.endDate, lang), tripDays(trip))];
  const blocks: string[] = [head.join('\n')];
  for (const date of [...byDay.keys()].sort()) {
    const items = dayOrder(byDay.get(date) ?? []);
    const zone = mainZone(items, trip);
    const lines = [words.dayHeading(formatDay(date, lang), zoneCity(zone))];
    for (const i of items) lines.push(...itemLines(i, zone, words, includeCodes, lang));
    blocks.push(lines.join('\n'));
  }
  if (blocks.length === 1) blocks.push(words.nothing);
  return `${blocks.join('\n\n')}\n`;
}

/** Days that have at least one booking (for the "One day" choice), in date order. */
export function daysWithPlans(trip: Trip): LocalDate[] {
  return [...new Set(trip.items.map(dateOf).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
}
