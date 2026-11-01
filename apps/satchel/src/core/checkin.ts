// T143 check-in times. For each flight, train / ferry with a booking, stay and hire car Satchel works out when
// check-in opens and closes, always on the booking's own IANA zone (a flight: its departure clock; a stay: the
// hotel's; a car: the pick-up place's), never the phone's. Pure TS, offline, no React Native imports.
//
// Windows (every default is general guidance only, labelled "usual, check your booking" in the UI; Satchel never
// claims to know any carrier's or hotel's own rule and never names one):
//  - flight 'online': opens CHECKIN_OPENS_H (24 h) before departure, or the traveller's own opensH (24/30/36/48/72 h
//    or custom); closes 60 min before departure for an international flight, 45 min for a domestic one (scope: the
//    airport fields' own choice, else guessed from the two zones' countries, src/core/leaveby.ts guessScope), or the
//    traveller's own closesMin.
//  - flight 'bagDrop': closes at the bag-drop time typed in the airport fields (placed on the day nearest departure,
//    leaveby.ts placeNear), else bagDropMin before departure, else the same usual minutes as online check-in.
//  - train / ferry 'online' (only when it has a booking: a booking code or a ticket attached): closes 15 min (train)
//    / 30 min (ferry) before departure, or closesMin; opens only when the traveller set opensH.
//  - stay 'stayIn' (check-in from) and 'stayOut' (check-out by): the booking's times; a stamp saved without a clock
//    (date only) uses 15:00 / 10:00, marked usual. stayOut opens at 00:00 on the check-out day (a skipped midnight
//    reads as the first minute that exists).
//  - car 'desk': pick-up desk hours typed on the booking (deskFrom / deskTo, 'HH:mm' on the pick-up clock) on the
//    pick-up day; a closing time at or before the opening one runs past midnight into the next day.
// All maths runs on real instants (tz.ts toUtc / fromUtc), so a daylight-saving change inside a window and the date
// line are counted as the clocks really move.
//
// Per-booking settings ride on the Item as the optional `checkin` field (kept in .satchel; Plan this trip again keeps
// the offsets and desk hours, drops the tick). A value this build can't read is dropped, never refusing a file.
import { escapeText, foldLine, ICS_PRODID, itemUid, utcStamp } from './ics.ts';
import { guessScope, isClock, placeNear, readAirport, type FlightScope } from './leaveby.ts';
import type { Item, LocalDateTime, Trip } from './model.ts';
import { fromUtc, isLocalDateTime, isValidZone, localDate, toUtc, addDays, checkWallTime } from './tz.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** General guidance only: online check-in often opens about this many hours before a flight. */
export const CHECKIN_OPENS_H = 24;
/** The opening offsets offered as chips (hours before departure); any other whole number is "custom". */
export const OPENS_CHOICES: readonly number[] = [24, 30, 36, 48, 72];
export const MAX_OPENS_H = 168;
export const MAX_CLOSE_MIN = 360;
export const CLOSE_STEP = 5;
/** Usual closing minutes before departure (general guidance). */
export const USUAL_CLOSE_MIN = { international: 60, domestic: 45, train: 15, ferry: 30 } as const;
/** Usual stay times when the booking has no clock (general guidance). */
export const USUAL_STAY_IN = '15:00';
export const USUAL_STAY_OUT = '10:00';

/** The optional per-booking settings and tick. */
export type CheckinInfo = {
  /** Online check-in opens this many hours before departure (flights; trains / ferries only when set). */
  opensH?: number;
  /** Check-in closes this many minutes before departure. */
  closesMin?: number;
  /** Flights: bag drop closes this many minutes before departure (when no bag-drop time is typed). */
  bagDropMin?: number;
  /** Hire cars: pick-up desk hours, 'HH:mm' on the pick-up place's clock. */
  deskFrom?: string;
  deskTo?: string;
  /** "Mark checked in": when it was ticked (ISO instant). */
  doneAt?: string;
};
export const CHECKIN_KEYS = ['opensH', 'closesMin', 'bagDropMin', 'deskFrom', 'deskTo', 'doneAt'] as const;

const intIn = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;

/** A stored or imported value as clean CheckinInfo, or undefined when nothing usable is left. Unknown keys are dropped. */
export function readCheckin(raw: unknown): CheckinInfo | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: CheckinInfo = {};
  if (intIn(r.opensH, 1, MAX_OPENS_H)) out.opensH = r.opensH;
  if (intIn(r.closesMin, 0, MAX_CLOSE_MIN)) out.closesMin = r.closesMin;
  if (intIn(r.bagDropMin, 0, MAX_CLOSE_MIN)) out.bagDropMin = r.bagDropMin;
  if (isClock(r.deskFrom) && isClock(r.deskTo)) {
    out.deskFrom = r.deskFrom;
    out.deskTo = r.deskTo;
  }
  if (typeof r.doneAt === 'string' && r.doneAt && !Number.isNaN(Date.parse(r.doneAt))) out.doneAt = r.doneAt;
  return Object.keys(out).length ? out : undefined;
}

/** The item with its check-in settings replaced (an empty result removes the field). */
export function withCheckin<I extends Item>(item: I, next: CheckinInfo | undefined): I {
  const { checkin: _c, ...rest } = item;
  const clean = readCheckin(next);
  return (clean ? { ...rest, checkin: clean } : rest) as I;
}

/** "Mark checked in" on / off. */
export const setDone = <I extends Item>(item: I, done: boolean, now: number): I =>
  withCheckin(item, { ...(readCheckin(item.checkin) ?? {}), doneAt: done ? new Date(now).toISOString() : undefined });

export const isDone = (item: Pick<Item, 'checkin'>): boolean => !!readCheckin(item.checkin)?.doneAt;

// ------------------------------------------------------------------ windows

export type WindowKind = 'online' | 'bagDrop' | 'stayIn' | 'stayOut' | 'desk';
export type Moment = { utc: number; local: LocalDateTime };

export type CheckinWindow = {
  itemId: string;
  kind: WindowKind;
  /** The clock every time is on. */
  tz: string;
  /** Null: no opening time (a closing deadline only). */
  opens: Moment | null;
  /** Null: open-ended (stay check-in, until check-out). */
  closes: Moment | null;
  /** True when a time is a usual default rather than from the booking or the traveller. */
  usual: boolean;
  /** Flights: the scope the closing default is for, and whether it is guessed. */
  scope?: FlightScope;
  /** A typed wall time skipped by a daylight-saving change (read as the clock would show). */
  skipped?: boolean;
  /** The booking's own start (departure / pick-up / check-in), for overdue and past. */
  departs: number;
};

const mo = (utc: number, tz: string): Moment => ({ utc, local: fromUtc(utc, tz) });
const stampOk = (s: { local?: unknown; tz?: unknown } | undefined): s is { local: string; tz: string } =>
  !!s && typeof s.tz === 'string' && isValidZone(s.tz) && typeof s.local === 'string';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const timed = (local: string) => isLocalDateTime(local);
const dateOnly = (local: string) => DATE_RE.test(local) && isLocalDateTime(`${local}T00:00`);

/** A train / ferry "with a booking": a booking code or a ticket attached. */
export const hasBooking = (i: Pick<Item, 'ref' | 'attachments'>): boolean =>
  !!(i.ref ?? '').trim() || (Array.isArray(i.attachments) && i.attachments.some((a) => a && a.role === 'ticket'));

/** Kinds this works for (cars only with desk hours, trains / ferries only with a booking). */
export function checkinApplies(i: Item): boolean {
  if (i.kind === 'flight' || i.kind === 'hotel') return true;
  if (i.kind === 'train' || i.kind === 'ferry') return hasBooking(i);
  if (i.kind === 'car') return !!readCheckin(i.checkin)?.deskFrom;
  return false;
}

/** The flight's scope: the airport fields' choice, else guessed from the zones' countries. */
export function flightScope(i: Item): { scope: FlightScope; guessed: boolean } {
  const a = readAirport(i.airport);
  if (a?.scope) return { scope: a.scope, guessed: false };
  return { scope: guessScope({ start: i.start, end: stampOk(i.end) ? i.end : undefined }), guessed: true };
}

/** A wall time on a date in a zone: the instant and whether the clock skips it. */
function at(date: string, time: string, tz: string): { m: Moment; skipped: boolean } {
  const stamp = { local: `${date}T${time}`, tz };
  const utc = toUtc(stamp);
  return { m: mo(utc, tz), skipped: checkWallTime(stamp).kind === 'skipped' };
}

/** Every check-in window of one booking, in time order (empty when none applies or it can't be placed). */
export function windowsFor(i: Item): CheckinWindow[] {
  if (!i || !checkinApplies(i) || !stampOk(i.start)) return [];
  const own = readCheckin(i.checkin) ?? {};
  const tz = i.start.tz;
  const out: CheckinWindow[] = [];

  if (i.kind === 'flight' || i.kind === 'train' || i.kind === 'ferry') {
    if (!timed(i.start.local)) return [];
    const dep = toUtc(i.start);
    let usualClose: number;
    let scope: FlightScope | undefined;
    if (i.kind === 'flight') {
      scope = flightScope(i).scope;
      usualClose = USUAL_CLOSE_MIN[scope];
    } else usualClose = USUAL_CLOSE_MIN[i.kind];
    const closeMin = own.closesMin ?? usualClose;
    const opensH = own.opensH ?? (i.kind === 'flight' ? CHECKIN_OPENS_H : undefined);
    out.push({
      itemId: i.id,
      kind: 'online',
      tz,
      opens: opensH === undefined ? null : mo(dep - opensH * HOUR, tz),
      closes: mo(dep - closeMin * MIN, tz),
      usual: own.closesMin === undefined || (i.kind === 'flight' && own.opensH === undefined),
      ...(scope ? { scope } : {}),
      departs: dep,
    });
    if (i.kind === 'flight') {
      const a = readAirport(i.airport);
      const depM = mo(dep, tz);
      if (a?.bagDrop) {
        const g = placeNear(a.bagDrop, depM, tz);
        out.push({ itemId: i.id, kind: 'bagDrop', tz, opens: null, closes: g.at, usual: false, skipped: g.skipped, departs: dep });
      } else {
        const m = own.bagDropMin ?? usualClose;
        out.push({ itemId: i.id, kind: 'bagDrop', tz, opens: null, closes: mo(dep - m * MIN, tz), usual: own.bagDropMin === undefined, departs: dep });
      }
    }
    return out;
  }

  if (i.kind === 'hotel') {
    const inDate = localDate(i.start.local);
    if (!dateOnly(inDate)) return [];
    const inTimed = timed(i.start.local);
    const ci = inTimed ? { m: mo(toUtc(i.start), tz), skipped: checkWallTime(i.start).kind === 'skipped' } : at(inDate, USUAL_STAY_IN, tz);
    out.push({ itemId: i.id, kind: 'stayIn', tz, opens: ci.m, closes: null, usual: !inTimed, skipped: ci.skipped || undefined, departs: ci.m.utc });
    if (stampOk(i.end)) {
      const outTz = i.end.tz;
      const outDate = localDate(i.end.local);
      if (dateOnly(outDate)) {
        const outTimed = timed(i.end.local);
        const co = outTimed ? { m: mo(toUtc(i.end as { local: string; tz: string }), outTz), skipped: checkWallTime(i.end).kind === 'skipped' } : at(outDate, USUAL_STAY_OUT, outTz);
        const dayStart = at(outDate, '00:00', outTz).m;
        out.push({ itemId: i.id, kind: 'stayOut', tz: outTz, opens: dayStart.utc < co.m.utc ? dayStart : null, closes: co.m, usual: !outTimed, skipped: co.skipped || undefined, departs: co.m.utc });
      }
    }
    for (const w of out) if (w.skipped === undefined) delete w.skipped;
    return out;
  }

  if (i.kind === 'car' && own.deskFrom && own.deskTo) {
    const day = localDate(i.start.local);
    if (!dateOnly(day)) return [];
    const from = at(day, own.deskFrom, tz);
    const toDay = own.deskTo <= own.deskFrom ? addDays(day, 1) : day;
    const to = at(toDay, own.deskTo, tz);
    const dep = timed(i.start.local) ? toUtc(i.start) : from.m.utc;
    const w: CheckinWindow = { itemId: i.id, kind: 'desk', tz, opens: from.m, closes: to.m, usual: false, departs: dep };
    if (from.skipped || to.skipped) w.skipped = true;
    return [w];
  }
  return [];
}

/** Every window of the trip's bookings, by the time that matters next (opening, else closing). */
export function tripWindows(trip: Pick<Trip, 'items'>): CheckinWindow[] {
  const all: CheckinWindow[] = [];
  for (const i of trip.items ?? []) all.push(...windowsFor(i));
  return all.sort((a, b) => keyTime(a) - keyTime(b) || a.itemId.localeCompare(b.itemId));
}
const keyTime = (w: CheckinWindow) => (w.opens ?? w.closes ?? { utc: w.departs }).utc;

// ------------------------------------------------------------------ state at a moment

/**
 * later: opens in the future. open: open now (closes later, or open-ended). overdue: a check-in deadline has passed
 * while the booking is still ahead and it isn't ticked. done: ticked (check-in windows only). past: over.
 */
export type WindowState = 'later' | 'open' | 'overdue' | 'done' | 'past';
/** Windows the "Mark checked in" tick covers (check-out isn't a check-in). */
export const TICKED_KINDS: readonly WindowKind[] = ['online', 'bagDrop', 'stayIn', 'desk'];

export type WindowStatus = {
  window: CheckinWindow;
  state: WindowState;
  /** Whole minutes (rounded up) until it opens (later) or closes (open with a closing time); else null. */
  minutes: number | null;
};

export function windowState(w: CheckinWindow, now: number, done: boolean): WindowStatus {
  const until = (t: number) => Math.max(0, Math.ceil((t - now) / MIN));
  if (done && TICKED_KINDS.includes(w.kind)) return { window: w, state: 'done', minutes: null };
  if (w.opens && now < w.opens.utc) return { window: w, state: 'later', minutes: until(w.opens.utc) };
  if (w.kind === 'stayIn') {
    // Open-ended: "check-in from 15:00" is open until the stay is over (the check-out window takes over that day).
    return { window: w, state: 'open', minutes: null };
  }
  if (w.closes && now < w.closes.utc) return { window: w, state: 'open', minutes: until(w.closes.utc) };
  if (w.kind === 'stayOut' || w.kind === 'desk' || now >= w.departs) return { window: w, state: 'past', minutes: null };
  return { window: w, state: 'overdue', minutes: null };
}

/** The windows of the trip with their state; past ones (and a stay's check-in once its check-out day has come) left out. */
export function tripStatus(trip: Pick<Trip, 'items'>, now: number): WindowStatus[] {
  const byId = new Map((trip.items ?? []).map((i) => [i.id, i]));
  const out: WindowStatus[] = [];
  const all = tripWindows(trip);
  for (const w of all) {
    const item = byId.get(w.itemId);
    const s = windowState(w, now, !!item && isDone(item));
    if (s.state === 'past') continue;
    if (w.kind === 'stayIn' && s.state !== 'later') {
      const co = all.find((x) => x.itemId === w.itemId && x.kind === 'stayOut');
      if (co && (!co.opens || now >= co.opens.utc)) continue;
      if (!co && now >= w.departs + 24 * HOUR) continue;
    }
    out.push(s);
  }
  const rank: Record<WindowState, number> = { overdue: 0, open: 1, later: 2, done: 3, past: 4 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || keyTime(a.window) - keyTime(b.window));
}

/** The status of one booking's windows (all of them, past included), for its own card. */
export function itemStatus(item: Item, now: number): WindowStatus[] {
  return windowsFor(item).map((w) => windowState(w, now, isDone(item)));
}

/** Days, hours and minutes of a duration, for "opens in 3 h 20 min" (the screen picks the words). */
export function splitMinutes(min: number): { d: number; h: number; m: number } {
  const total = Math.max(0, Math.round(min));
  return { d: Math.floor(total / 1440), h: Math.floor((total % 1440) / 60), m: total % 60 };
}

/** A car pick-up time outside its desk hours (worth a look). */
export function pickupOutsideDesk(i: Item): boolean {
  const w = windowsFor(i).find((x) => x.kind === 'desk');
  if (!w || !w.opens || !w.closes || !timed(i.start.local)) return false;
  const p = toUtc(i.start);
  return p < w.opens.utc || p > w.closes.utc;
}

// ------------------------------------------------------------------ Your day and readiness

/** Kinds that count for Your day and readiness: online check-in and bag drop for journeys, a car's desk. */
const ACTION_KINDS: readonly WindowKind[] = ['online', 'desk'];

/**
 * The Your day pick: an online check-in or desk window open now and not ticked (closing soonest), else the next one
 * opening within `withinH` hours. Null when none.
 */
export function briefCheckin(trip: Pick<Trip, 'items'>, now: number, withinH = 24): { status: WindowStatus; item: Item } | null {
  const byId = new Map((trip.items ?? []).map((i) => [i.id, i]));
  const s = tripStatus(trip, now).filter((x) => ACTION_KINDS.includes(x.window.kind));
  const open = s.filter((x) => x.state === 'open' || x.state === 'overdue');
  const pick = open[0] ?? s.find((x) => x.state === 'later' && x.minutes !== null && x.minutes <= withinH * 60);
  const item = pick ? byId.get(pick.window.itemId) : undefined;
  return pick && item ? { status: pick, item } : null;
}

/** The readiness row (src/core/readiness.ts): warn while an online check-in is open (or overdue) and not ticked. */
export type CheckinCheck = {
  id: 'checkin';
  status: 'pass' | 'warn';
  reason: 'open' | 'overdue' | 'ok';
  done: number;
  total: number;
  fix: { kind: 'checkin'; itemId: string } | null;
};

export function checkinCheck(trip: Pick<Trip, 'items'>, now: number): CheckinCheck | null {
  const journeys = (trip.items ?? []).filter((i) => ['flight', 'train', 'ferry'].includes(i.kind) && windowsFor(i).length);
  if (!journeys.length) return null;
  const s = tripStatus(trip, now).filter((x) => x.window.kind === 'online');
  const overdue = s.filter((x) => x.state === 'overdue');
  const open = s.filter((x) => x.state === 'open');
  const ticked = journeys.filter(isDone).length;
  const first = overdue[0] ?? open[0];
  if (!first) return { id: 'checkin', status: 'pass', reason: 'ok', done: ticked, total: journeys.length, fix: null };
  return {
    id: 'checkin',
    status: 'warn',
    reason: overdue.length ? 'overdue' : 'open',
    done: overdue.length + open.length,
    total: journeys.length,
    fix: { kind: 'checkin', itemId: first.window.itemId },
  };
}

// ------------------------------------------------------------------ calendar reminder

export type ReminderWords = { summary: string; description: string };

/**
 * A one-event .ics (via src/core/ics.ts primitives) that reminds at the window's opening (or, with none, 30 min
 * before it closes), with an alert at that moment. Null when the moment has passed or the window has no time.
 */
export function reminderIcs(w: CheckinWindow, words: ReminderWords, now: number): { text: string; at: number } | null {
  const atMs = w.opens ? w.opens.utc : w.closes ? w.closes.utc - 30 * MIN : null;
  if (atMs === null || atMs <= now) return null;
  const end = w.closes && w.closes.utc > atMs ? Math.min(w.closes.utc, atMs + 30 * MIN) : atMs + 15 * MIN;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${itemUid(`checkin-${w.kind}-${w.itemId}`)}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(atMs)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(words.summary)}`,
    `DESCRIPTION:${escapeText(words.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(words.summary)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return { text: lines.map(foldLine).join('\r\n') + '\r\n', at: atMs };
}
