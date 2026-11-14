// T170 Today timetable: one trip day as a school-day style schedule, worked out on the phone from the trip's
// bookings. Pure TypeScript (Node runs it).
//  - Blocks: every booking that starts that day (in its own zone, what the ticket says), a journey arriving that
//    day after starting earlier (shown at its arrival), a stay's check-in on its first day and check-out on its
//    last, a hire car's pick-up and return. Notes are point-in-time blocks.
//  - Each block keeps its own wall clock and zone; `zone` is the day's main zone (itinerarytext.mainZone), and a
//    block in another zone carries that city so the screen can say "09:30 Sydney time" (a trip crossing zones).
//  - State against `now` (a real instant): done, now (under way), next (the first one still to start, across the
//    whole trip, so tomorrow's first block is "next" late at night), later.
//  - Free time: gaps of an hour or more between blocks, plus a free morning before a late first block and a free
//    evening after an early last one, on that day's own clock. A day with nothing planned is all free.
//  - Tonight: the stay whose nights include this day (a check-in today counts).
// Items whose zone this phone can't read (T43) are left off the timetable (the trip screen still lists them).
import { mainZone } from './itinerarytext.ts';
import { tripZoneAt } from './journal.ts';
import { isTransport, type Item, type LocalDate, type LocalDateTime, type Stamp, type Trip } from './model.ts';
import { groupByDay, sortItems, zonesReadable } from './timeline.ts';
import { addDays, fromUtc, isLocalDateTime, localDate, toUtc } from './tz.ts';
import { FREE_WORDS } from './itinerary.ts';

/** How a block looks: its own icon and colour on the timetable. */
export type BlockLook =
  | 'flight'
  | 'train'
  | 'ferry'
  | 'bus'
  | 'transfer'
  | 'carPickup'
  | 'carReturn'
  | 'car'
  | 'checkin'
  | 'checkout'
  | 'food'
  | 'tour'
  | 'activity'
  | 'free'
  | 'note';

/** whole: the booking itself. arrive: a journey that left on an earlier day. checkin / checkout: a stay's ends. */
export type BlockRole = 'whole' | 'arrive' | 'checkin' | 'checkout' | 'pickup' | 'return';
export type BlockState = 'done' | 'now' | 'next' | 'later';

export type Block = {
  type: 'block';
  key: string;
  item: Item;
  role: BlockRole;
  look: BlockLook;
  /** When the block starts and (if it lasts) ends, on its own clock. */
  start: Stamp;
  end?: Stamp;
  startUtc: number;
  endUtc: number;
  /** The block's zone differs from the day's: the screen names its city. */
  otherZone: boolean;
  /** The block ends on a later date than it starts (overnight journey). */
  endsNextDay: boolean;
  state: BlockState;
};

export type FreeBlock = {
  type: 'free';
  key: string;
  /** morning: before the first block. evening: after the last. between: a gap. day: nothing planned at all. */
  where: 'morning' | 'between' | 'evening' | 'day';
  from: LocalDateTime;
  to: LocalDateTime;
  minutes: number;
  /** The current time falls in this gap (only on today). */
  current: boolean;
};

export type Row = Block | FreeBlock;

export type DaySchedule = {
  date: LocalDate;
  /** The zone the day is read in. */
  zone: string;
  rows: Row[];
  blocks: Block[];
  /** The stay for tonight (check-in today or a night in the middle of a stay), else null. */
  tonight: Item | null;
  /** 1-based day of the trip, and the trip's length in days. 0 when the date is outside the trip. */
  dayNumber: number;
  totalDays: number;
};

/** Gaps shorter than this between blocks are not shown as free time. */
export const FREE_MIN = 60;
/** A free morning / evening is shown when at least this long. */
export const FREE_EDGE_MIN = 120;
/** The day's free time is counted from / to these wall-clock times. */
export const DAY_FROM = '08:00';
export const DAY_TO = '22:00';
/** An activity with no end time is counted as lasting this long (for gaps and "now"). */
export const ASSUMED_MIN = 60;
/** A point-in-time block (check-in, a note) is "now" for this many minutes after it starts. */
export const POINT_NOW_MIN = 15;

const MIN = 60_000;

const FOOD = /\b(breakfast|brunch|lunch|dinner|supper|restaurant|caf[eé]|bistro|brasserie|trattoria|izakaya|tasting|food\s+tour|wine|drinks|cocktails?|bar|pub|meal|picnic|high\s+tea|afternoon\s+tea|ramen|sushi|tapas)\b/i;
const TOUR = /\b(tour|guided|excursion|museum|gallery|safari|walk(?:ing)?|hike|trek|class|workshop|lesson|show|concert|theatre|theater|tickets?|admission|visit|sightseeing|day\s+trip|cruise|snorkel(?:ling)?|dive|diving|park|temple|castle|palace|cathedral|market)\b/i;
const TRANSFER = /\b(transfer|pick[\s-]?up|drop[\s-]?off|shuttle|taxi|uber|lyft|grab|chauffeur|driver|ride\s+to)\b/i;

/** The look of a booking (for its whole block), from its kind and title words. */
export function lookOf(item: Item): BlockLook {
  const words = `${item.title} ${item.place?.name ?? ''}`;
  switch (item.kind) {
    case 'flight':
    case 'train':
    case 'ferry':
      return item.kind;
    case 'bus':
      return TRANSFER.test(words) ? 'transfer' : 'bus';
    case 'car':
      return 'car';
    case 'hotel':
      return 'checkin';
    case 'note':
      return FREE_WORDS.test(item.title) ? 'free' : FOOD.test(words) ? 'food' : 'note';
    default:
      if (FREE_WORDS.test(item.title)) return 'free';
      if (TRANSFER.test(words)) return 'transfer';
      if (FOOD.test(words)) return 'food';
      if (TOUR.test(words)) return 'tour';
      return 'activity';
  }
}

const readable = (i: Item) => zonesReadable(i) && isLocalDateTime(i.start.local) && (!i.end || isLocalDateTime(i.end.local));
const startDate = (i: Item) => localDate(i.start.local);
const endDate = (i: Item) => localDate((i.end ?? i.start).local);

/** Every date the trip's timetable covers: the trip's own days plus any booking outside them (timeline.groupByDay). */
export function scheduleDays(trip: Trip): LocalDate[] {
  return groupByDay(trip).map((d) => d.date);
}

/** The date "today" is on this trip: today where the traveller is (the zone their last booking left them in). */
export function tripToday(trip: Trip, now: number): LocalDate {
  return localDate(fromUtc(now, tripZoneAt(trip, now)));
}

/** The day the timetable opens on: today when it's a trip day, else the first day (before) or last day (after). */
export function openingDay(trip: Trip, now: number): LocalDate {
  const days = scheduleDays(trip);
  const today = tripToday(trip, now);
  if (!days.length) return today;
  if (days.includes(today)) return today;
  return today < days[0] ? days[0] : days[days.length - 1];
}

/** Raw blocks (no state yet) for a date. */
function rawBlocks(trip: Trip, date: LocalDate): Omit<Block, 'state' | 'otherZone'>[] {
  const out: Omit<Block, 'state' | 'otherZone'>[] = [];
  for (const it of sortItems(trip.items)) {
    if (!readable(it)) continue;
    const s = toUtc(it.start);
    const e = it.end ? Math.max(s, toUtc(it.end)) : s;
    const sd = startDate(it);
    const ed = endDate(it);
    const push = (role: BlockRole, look: BlockLook, start: Stamp, end: Stamp | undefined) => {
      const su = toUtc(start);
      const eu = end ? Math.max(su, toUtc(end)) : it.kind === 'activity' ? su + ASSUMED_MIN * MIN : su;
      out.push({ type: 'block', key: `${it.id}-${role}`, item: it, role, look, start, end, startUtc: su, endUtc: eu, endsNextDay: !!end && localDate(end.local) > localDate(start.local) });
    };
    if (it.kind === 'hotel') {
      if (sd === date) push('checkin', 'checkin', it.start, undefined);
      if (it.end && ed === date && ed !== sd) push('checkout', 'checkout', it.end, undefined);
      continue;
    }
    if (it.kind === 'car' && it.end && ed !== sd) {
      if (sd === date) push('pickup', 'carPickup', it.start, undefined);
      if (ed === date) push('return', 'carReturn', it.end, undefined);
      continue;
    }
    if (sd === date) {
      push('whole', lookOf(it), it.start, it.end);
      continue;
    }
    // A journey that left on an earlier day and lands (or is still going) today.
    if (isTransport(it.kind) && it.end && sd < date && ed >= date && e > s) {
      push('arrive', lookOf(it), it.start, it.end);
    }
  }
  return out;
}

/** The stay whose nights include `date` (check-in on or before it, check-out after it). */
export function stayTonight(trip: Trip, date: LocalDate): Item | null {
  const stays = sortItems(trip.items).filter((i) => i.kind === 'hotel' && i.end && readable(i) && startDate(i) <= date && endDate(i) > date);
  return stays[stays.length - 1] ?? null;
}

/** The first block start (UTC) after `now` anywhere in the trip, for "next". */
function nextStart(trip: Trip, now: number): number | null {
  let best: number | null = null;
  for (const it of trip.items) {
    if (!readable(it)) continue;
    const points = [toUtc(it.start)];
    if (it.end && (it.kind === 'hotel' || it.kind === 'car')) points.push(toUtc(it.end));
    for (const p of points) if (p > now && (best === null || p < best)) best = p;
  }
  return best;
}

const wallMinutes = (a: LocalDateTime, b: LocalDateTime) => Math.round((toUtc({ local: b, tz: 'UTC' }) - toUtc({ local: a, tz: 'UTC' })) / MIN);

/** The timetable for one day of a trip. */
export function daySchedule(trip: Trip, date: LocalDate, now: number): DaySchedule {
  const raw = rawBlocks(trip, date);
  const dayItems = raw.map((b) => b.item);
  const zone = dayItems.length ? mainZone(dayItems, trip) : tripZoneAt(trip, toUtc({ local: `${date}T12:00`, tz: trip.homeTz }));
  const next = nextStart(trip, now);
  const ordered = [...raw].sort((a, b) => a.startUtc - b.startUtc || a.endUtc - b.endUtc || (a.key < b.key ? -1 : 1));
  const blocks: Block[] = ordered.map((b) => {
    const point = b.endUtc === b.startUtc;
    const until = point ? b.startUtc + POINT_NOW_MIN * MIN : b.endUtc;
    const state: BlockState = b.startUtc <= now && now < until ? 'now' : until <= now ? 'done' : next !== null && b.startUtc === next ? 'next' : 'later';
    return { ...b, otherZone: b.start.tz !== zone, state };
  });
  // Only the latest "now" block stays "now" (a long tour and a lunch inside it: lunch is what's on).
  const nows = blocks.filter((b) => b.state === 'now');
  for (const b of nows.slice(0, -1)) if (b.look !== 'free') b.state = 'done';

  // Free time, on the day's own clock.
  const rows: Row[] = [];
  const dayStart = `${date}T${DAY_FROM}`;
  const dayEnd = `${date}T${DAY_TO}`;
  const local = (utc: number) => fromUtc(utc, zone);
  const isToday = localDate(fromUtc(now, zone)) === date;
  const free = (where: FreeBlock['where'], from: LocalDateTime, to: LocalDateTime): FreeBlock => {
    const fu = toUtc({ local: from, tz: zone });
    const tu = toUtc({ local: to, tz: zone });
    return { type: 'free', key: `free-${where}-${from}`, where, from, to, minutes: wallMinutes(from, to), current: isToday && fu <= now && now < tu };
  };
  const timed = blocks.filter((b) => b.look !== 'free' && b.item.kind !== 'note');
  if (!blocks.length) {
    rows.push(free('day', dayStart, dayEnd));
  } else {
    let cursor: number | null = null;
    for (const b of blocks) {
      const counts = timed.includes(b);
      if (counts && cursor === null) {
        const first = local(b.startUtc);
        if (localDate(first) === date && first > dayStart && wallMinutes(dayStart, first) >= FREE_EDGE_MIN) rows.push(free('morning', dayStart, first));
      } else if (counts && cursor !== null && b.startUtc - cursor >= FREE_MIN * MIN) {
        rows.push(free('between', local(cursor), local(b.startUtc)));
      }
      rows.push(b);
      if (counts) cursor = Math.max(cursor ?? 0, b.endUtc);
    }
    if (cursor !== null) {
      const last = local(cursor);
      if (localDate(last) === date && last < dayEnd && wallMinutes(last, dayEnd) >= FREE_EDGE_MIN) rows.push(free('evening', last, dayEnd));
    }
  }

  const inTrip = date >= trip.startDate && date <= trip.endDate;
  return {
    date,
    zone,
    rows,
    blocks,
    tonight: stayTonight(trip, date),
    dayNumber: inTrip ? Math.round((toUtc({ local: `${date}T00:00`, tz: 'UTC' }) - toUtc({ local: `${trip.startDate}T00:00`, tz: 'UTC' })) / 86_400_000) + 1 : 0,
    totalDays: Math.round((toUtc({ local: `${trip.endDate}T00:00`, tz: 'UTC' }) - toUtc({ local: `${trip.startDate}T00:00`, tz: 'UTC' })) / 86_400_000) + 1,
  };
}

/** One chip of the day strip: date, how many blocks, and the look of the day's main booking (a flight day shows a plane). */
export type StripDay = { date: LocalDate; count: number; lead: BlockLook | null; past: boolean; today: boolean };

const LEAD_ORDER: BlockLook[] = ['flight', 'train', 'ferry', 'checkin', 'checkout', 'carPickup', 'tour', 'food', 'transfer', 'bus', 'activity', 'carReturn', 'car', 'note', 'free'];

/** The day strip across the whole trip. */
export function dayStrip(trip: Trip, now: number): StripDay[] {
  const today = tripToday(trip, now);
  return scheduleDays(trip).map((date) => {
    const raw = rawBlocks(trip, date);
    const looks = new Set(raw.map((b) => b.look));
    return { date, count: raw.length, lead: LEAD_ORDER.find((l) => looks.has(l)) ?? null, past: date < today, today: date === today };
  });
}

/** Today and tomorrow on this trip (tomorrow null on the last day). */
export function todayTomorrow(trip: Trip, now: number): { today: LocalDate; tomorrow: LocalDate | null } {
  const today = openingDay(trip, now);
  const tomorrow = addDays(today, 1);
  return { today, tomorrow: scheduleDays(trip).includes(tomorrow) ? tomorrow : null };
}

/** The block a "Now" / "Next" headline talks about on a day, or null. */
export function headline(s: DaySchedule): Block | null {
  return s.blocks.find((b) => b.state === 'now') ?? s.blocks.find((b) => b.state === 'next') ?? null;
}
